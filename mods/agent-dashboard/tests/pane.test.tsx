import { expect, test } from 'claude-code/testing'

const PANE = {
  plugin: 'agent-dashboard',
  component: 'Pane',
  requestId: 'agent-dashboard',
  props: {
    title: 'Agents',
    isFocused: false,
    bodyColumns: 60,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 30 },
    view: {},
  },
} as const

test('the pane shows a subagent, its tool, and the session counts', async ($, on) => {
  on('agent.spawn', () => ({ model: 'claude-haiku-5-5', agentId: 'agent-1' }))
  on('tool.call', () => ({ result: {} }))
  on('turn.complete', (_: unknown, e: { answer: string }) => ({ text: e.answer }))
  on('session.usage', () => ({
    value: {
      startedAt: 0,
      context: { window: 200000, percent: 12 },
      rateLimits: [{ kind: '5h', percentUsed: 40, source: 'api' }],
    },
  }))

  await $.agent.spawn({ prompt: 'Find the bug', description: 'Hunt the login bug' })
  await $.tool.call({ tool: 'Grep', pattern: 'login', agentId: 'agent-1' })
  await $.tool.call({ tool: 'Bash', command: 'ls' })
  await $.turn.complete({ answer: 'done', durationMs: 1, isAborted: false, turnId: 'a', reason: 'answer', agentId: 'agent-1' })
  await $.turn.complete({ answer: 'ok', durationMs: 1, isAborted: false, turnId: 'm', reason: 'answer' })

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect((await ui.find({ type: 'Text', text: /Hunt the login bug/ }))?.text).toContain('✓')
    expect((await ui.find({ type: 'Text', text: /^Agents ·/ }))?.text).toBe('Agents · 0 running · 1 done')
    expect(await ui.find({ type: 'Text', text: /Grep \(agent\)/ })).toBeTruthy()
    expect((await ui.find({ type: 'Text', text: /turns/ }))?.text).toBe('1 turns · 2 tool calls · context 12%')
    expect((await ui.find({ type: 'Text', text: /limits/ }))?.text).toBe('limits: 5h 40%')
    await ui.unmount()
  }
})

test('an empty session says so', async ($, on) => {
  on('session.usage', () => ({ value: { startedAt: 0, context: { window: 200000 }, rateLimits: [] } }))
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await ui.find({ type: 'Text', text: /No subagent yet/ })).toBeTruthy()
  expect(await ui.find({ type: 'Text', text: /No tool call yet/ })).toBeTruthy()
  await ui.unmount()
})
