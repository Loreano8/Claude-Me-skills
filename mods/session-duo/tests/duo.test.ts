import { expect, test } from 'claude-code/testing'

// One machine-wide store and a switchable "current session", so one test can
// play both sessions.
function engine(on: any) {
  const store: Record<string, unknown> = {}
  const sent: { to: unknown; text: string }[] = []
  const me = { id: 'session-A' }
  on('store.get', (_: unknown, e: { key: string }) => ({ value: store[e.key] }))
  on('store.set', (_: unknown, e: { key: string; value: unknown }) => ((store[e.key] = e.value), { value: undefined }))
  on('store.delete', (_: unknown, e: { key: string }) => (delete store[e.key], { value: undefined }))
  on('session.id', () => ({ value: me.id }))
  on('session.cwd', () => ({ value: '/home/loreano/moua' }))
  on('clock.now', () => ({ value: 1 }))
  on('ui.status', () => ({ value: undefined }))
  on('ui.toast', () => ({ value: undefined }))
  on('session.send', (_: unknown, e: { to: unknown; text: string }) => (sent.push(e), { isDelivered: true }))
  on('turn.complete', (_: unknown, e: { answer: string }) => ({ text: e.answer }))
  return { store, sent, me }
}

const run = ($: any, command: string, args: string) =>
  $.command.run({ command, args, origin: 'user', presentation: 'inline' })

const answer = ($: any, text: string) =>
  $.turn.complete({ answer: text, durationMs: 1, isAborted: false, turnId: 't-' + text.length, reason: 'answer' })

test('two sessions pair up and hand work across', async ($, on) => {
  const { sent, me } = engine(on)

  me.id = 'session-A'
  expect((await run($, 'duo', 'plan')).text).toContain('now the planner')
  me.id = 'session-B'
  expect((await run($, 'duo', 'build')).text).toContain('The planner is session session-')

  me.id = 'session-A'
  await answer($, 'Plan: 1) home page 2) login')
  expect((await run($, 'handoff', '')).text).toBe('Sent to the builder.')
  expect(sent[0]?.to).toBe('session-B')
  expect(sent[0]?.text).toContain('[duo · from the planner]')
  expect(sent[0]?.text).toContain('home page')
})

test('with auto on, only the builder reports back', async ($, on) => {
  const { sent, me } = engine(on)
  me.id = 'session-A'
  await run($, 'duo', 'plan')
  me.id = 'session-B'
  await run($, 'duo', 'build')
  await run($, 'duo', 'auto on')

  await answer($, 'Built the home page')
  expect(sent.length).toBe(1)
  expect(sent[0]?.to).toBe('session-A')

  me.id = 'session-A'
  await answer($, 'Next: the login page')
  expect(sent.length).toBe(1)
})

test('a session without a role is told what to do', async ($, on) => {
  engine(on)
  expect((await run($, 'handoff', 'hello')).text).toContain('/duo plan or /duo build')
})
