export type AgentRow = {
  id: string
  description: string
  model: string
  isDone: boolean
  tool?: string
}

export type CallRow = { id: string; loop: string; tool: string; isDone: boolean }

export type Stats = { turns: number; toolCalls: number }

declare module 'claude-code' {
  interface PluginState {
    'agent-dashboard': {
      agents: Shaped<AgentRow[]>
      calls: Shaped<CallRow[]>
      stats: Shaped<Stats>
    }
  }
}
