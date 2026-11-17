import type { EngineInterface, Register } from 'claude-code'

// The cheaper model simple turns go to. An alias or a full model id.
const CHEAP = 'haiku'
const MAX_CHARS = 220

// A request reads as simple when it asks for one of these...
const SIMPLE = [
  /\b(r[ée]sume|r[ée]sumer|summari[sz]e|summary|tl;?dr)\b/i,
  /\b(tradui[st]?|traduire|translate|translation)\b/i,
  /\b(reformule[rz]?|rephrase|reword|paraphrase)\b/i,
  /\b(corrige[rz]? (l'|les )?(orthographe|fautes)|fix (the )?(typos|spelling|grammar)|proofread)\b/i,
  /\b(d[ée]finition|define|que veut dire|qu'est-ce que|c'est quoi|what is|what does .* mean)\b/i,
  /\b(explique[rz]? simplement|explain (briefly|simply)|en une phrase|in one sentence)\b/i,
  /\b(liste[rz]?|list|donne[rz]?-moi (une )?id[ée]es?|give me (some )?ideas)\b/i,
]
// ...and none of these, which call for the main model.
const HEAVY = [
  /```/,
  /\b(code|coder|cr[ée]e[rz]?|create|build|construi[st]|impl[ée]ment|implement|refactor|debug|d[ée]bogue|fix (the |a |this )?(bug|error|test)|bug|erreur|error|stack ?trace)\b/i,
  /\b(d[ée]ploie|deploy|commit|push|pull request|merge|migration|base de donn[ée]es|database|architecture)\b/i,
  /\b(vid[ée]o|video|render|rendu|mod|plugin|skill|agent)\b/i,
]

export function isSimple(text: string): boolean {
  const t = text.trim()
  if (t === '' || t.startsWith('/') || t.length > MAX_CHARS) return false
  if (t.split('\n').length > 4) return false
  if (HEAVY.some(r => r.test(t))) return false
  return SIMPLE.some(r => r.test(t))
}

async function isOn($: EngineInterface): Promise<boolean> {
  return (await $.store.get('enabled')) !== false
}

export const register: Register = on => {
  // Turns of the main loop judged simple, by turn id. Module memory: a reload
  // forgets them, and those turns simply go back to the session's model.
  const cheapTurns = new Set<string>()

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'eco',
      description: 'Limit saver: send simple requests to Haiku (on | off | status)',
      argumentHint: 'on | off | status',
    })

    return next(e)
  })

  on('command.run', { command: 'eco' }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()
    if (arg === 'on' || arg === 'off') {
      await $.store.set('enabled', arg === 'on')
      $.ui.status(undefined)
    }
    const enabled = await isOn($)
    const routed = Number((await $.store.get('routed')) ?? 0)

    return {
      text:
        `Limit saver is ${enabled ? 'ON' : 'OFF'}. ` +
        `${routed} simple request${routed === 1 ? '' : 's'} sent to ${CHEAP} so far (all sessions). ` +
        'Use /eco on, /eco off or /eco status.',
    }
  })

  // Decide once per main-loop turn, from the prompt it starts with.
  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined && (await isOn($)) && isSimple(e.text)) {
      cheapTurns.add(e.turnId)
      $.ui.status(`eco · this request runs on ${CHEAP}`)
      await $.store.set('routed', Number((await $.store.get('routed')) ?? 0) + 1)
    }

    return next(e)
  })

  // Every model request of a simple turn goes to the cheaper model.
  on('turn.step', async function* ($, e, next) {
    if (!cheapTurns.has(e.turnId)) return yield* next(e)

    return yield* next({ ...e, model: CHEAP })
  })

  on('turn.complete', async ($, e, next) => {
    if (cheapTurns.delete(e.turnId)) $.ui.status(undefined)

    return next(e)
  })
}
