import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { AgentRow, CallRow, Stats } from '../types'

const PANE = 'agent-dashboard'
const TITLE = 'Agents'
// Change a tag when its fields change: it declines what an earlier version
// stored, which outlives a reload.
const agents = atom({ plugin: 'agent-dashboard', key: 'agents' } as const, [] as AgentRow[], {
  shape: 'agents-1',
})
const calls = atom({ plugin: 'agent-dashboard', key: 'calls' } as const, [] as CallRow[], {
  shape: 'calls-1',
})
const stats = atom({ plugin: 'agent-dashboard', key: 'stats' } as const, { turns: 0, toolCalls: 0 } as Stats, {
  shape: 'stats-1',
})

const short = (text: string, max: number) => (text.length > max ? text.slice(0, max - 1) + '…' : text)
const pct = (n: number | undefined) => (n === undefined ? '–' : `${Math.round(n)}%`)

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'agent-board',
      description: 'Open the agents dashboard pane',
    })
    void $.ui.open({ id: PANE, title: TITLE })

    return next(e)
  })

  on('command.run', { command: 'agent-board' }, async $ => {
    await $.ui.open({ id: PANE, title: TITLE })

    return { text: 'Agents dashboard opened.' }
  })

  // A subagent starts: list it as running.
  on('agent.spawn', async ($, e, next) => {
    const started = await next(e)
    if (started.deny === undefined && started.agentId !== undefined) {
      const row: AgentRow = {
        id: started.agentId,
        description: e.description || short(e.prompt, 40),
        model: started.model,
        isDone: false,
      }
      await update($, agents, list => [...list.filter(a => a.id !== row.id), row].slice(-30))
    }

    return started
  })

  // Every tool call, in the main loop or an agent's: count it, show it, and
  // mark the agent's current tool.
  on('tool.call', async ($, e, next) => {
    const loop = e.agentId ?? 'main'
    const row: CallRow = { id: e.tool_use_id, loop, tool: e.tool, isDone: false }
    await update($, calls, list => [...list, row].slice(-60))
    await update($, stats, s => ({ ...s, toolCalls: s.toolCalls + 1 }))
    if (e.agentId !== undefined) {
      await update($, agents, list => list.map(a => (a.id === e.agentId ? { ...a, tool: e.tool } : a)))
    }
    const ran = await next(e)
    await update($, calls, list => list.map(c => (c.id === row.id ? { ...c, isDone: true } : c)))

    return ran
  })

  // A turn ends: an agent's end marks it done; the main loop's counts a turn.
  on('turn.complete', async ($, e, next) => {
    if (e.agentId !== undefined) {
      await update($, agents, list =>
        list.map(a => (a.id === e.agentId ? { ...a, isDone: true, tool: undefined } : a)),
      )
    } else {
      await update($, stats, s => ({ ...s, turns: s.turns + 1 }))
    }

    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const agentList = await read($, agents)
    const callList = await read($, calls)
    const s = await read($, stats)
    const usage = await $.session.usage().catch(() => undefined)
    const rows = e.viewport?.rows ?? 30
    const running = agentList.filter(a => !a.isDone)
    const room = Math.max(3, rows - 12 - Math.min(agentList.length, 8))
    const limits = (usage?.rateLimits ?? []).map(l => `${l.kind} ${pct(l.percentUsed)}`).join(' · ')

    return (
      <Box flexDirection="column">
        <Text bold>
          Agents · {running.length} running · {agentList.length - running.length} done
        </Text>
        {agentList.length === 0 && <Text dimColor>No subagent yet.</Text>}
        {agentList.slice(-8).map(a => (
          <Text dimColor={a.isDone}>
            {a.isDone ? '✓' : '●'} {short(a.description, 34)} · {a.model}
            {a.tool !== undefined && !a.isDone ? ` · ${a.tool}` : ''}
          </Text>
        ))}
        <Text> </Text>
        <Text bold>Recent tools</Text>
        {callList.length === 0 && <Text dimColor>No tool call yet.</Text>}
        {callList.slice(-room).map(c => (
          <Text dimColor={c.isDone}>
            {c.isDone ? '  ' : '▶ '}
            {c.tool}
            {c.loop === 'main' ? '' : ' (agent)'}
          </Text>
        ))}
        <Text> </Text>
        <Text bold>Session</Text>
        <Text>
          {s.turns} turns · {s.toolCalls} tool calls · context {pct(usage?.context.percent)}
        </Text>
        {limits !== '' && <Text dimColor>limits: {limits}</Text>}
      </Box>
    )
  })
}
