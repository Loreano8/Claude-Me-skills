import type { EngineInterface, Register } from 'claude-code'

type Role = 'planner' | 'builder'
type Seat = { sessionId: string; cwd: string; at: number }

const TAG = '[duo · from the '
const other = (role: Role): Role => (role === 'planner' ? 'builder' : 'planner')

// $.store is shared by every session on this machine: it is where the two
// sessions find each other.
async function seatOf($: EngineInterface, role: Role): Promise<Seat | undefined> {
  return (await $.store.get(`seat:${role}`)) as Seat | undefined
}

async function roleOf($: EngineInterface): Promise<Role | undefined> {
  const me = await $.session.id()
  for (const role of ['planner', 'builder'] as const) {
    if ((await seatOf($, role))?.sessionId === me) return role
  }
  return undefined
}

async function sendToPartner($: EngineInterface, text: string): Promise<string> {
  const role = await roleOf($)
  if (role === undefined) return 'This session has no role yet: run /duo plan or /duo build first.'
  const partner = await seatOf($, other(role))
  if (partner === undefined) return `No ${other(role)} session yet: run /duo ${role === 'planner' ? 'build' : 'plan'} in another session.`
  const sent = await $.session.send({ to: { sessionId: partner.sessionId }, text: `${TAG}${role}]\n${text}` })

  return sent.isDelivered
    ? `Sent to the ${other(role)}.`
    : `Not delivered to the ${other(role)}: ${sent.reason}. Is that session still open?`
}

export const register: Register = on => {
  // The main loop's last answer, for /handoff with no text. Module memory.
  let lastAnswer = ''

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'duo',
      description: 'Pair two sessions: plan | build | status | auto on|off | off',
      argumentHint: 'plan | build | status | auto on|off | off',
    })
    await $.command.register({
      name: 'handoff',
      description: 'Send your last answer (or the given text) to the other duo session',
      argumentHint: '[message]',
    })
    const role = await roleOf($)
    if (role !== undefined) $.ui.status(`duo · ${role}`)

    return next(e)
  })

  on('command.run', { command: 'duo' }, async ($, e) => {
    const [verb, arg] = e.args.trim().toLowerCase().split(/\s+/)
    const me = await $.session.id()

    if (verb === 'plan' || verb === 'build') {
      const role: Role = verb === 'plan' ? 'planner' : 'builder'
      await $.store.set(`seat:${role}`, { sessionId: me, cwd: await $.session.cwd(), at: await $.clock.now() } satisfies Seat)
      const mine = await seatOf($, other(role))
      if (mine?.sessionId === me) await $.store.delete(`seat:${other(role)}`)
      $.ui.status(`duo · ${role}`)
      const partner = await seatOf($, other(role))

      return {
        text:
          `This session is now the ${role}. ` +
          (partner ? `The ${other(role)} is session ${partner.sessionId.slice(0, 8)} (${partner.cwd}). Use /handoff to send work.` : `Now run /duo ${role === 'planner' ? 'build' : 'plan'} in another session.`),
      }
    }
    if (verb === 'auto') {
      await $.store.set('auto', arg === 'on')
      return { text: `Auto report ${arg === 'on' ? 'ON: the builder sends its answer to the planner after each task' : 'OFF'}.` }
    }
    if (verb === 'off') {
      const role = await roleOf($)
      if (role !== undefined) await $.store.delete(`seat:${role}`)
      $.ui.status(undefined)
      return { text: 'This session left the duo.' }
    }
    const role = await roleOf($)
    const planner = await seatOf($, 'planner')
    const builder = await seatOf($, 'builder')
    const auto = (await $.store.get('auto')) === true

    return {
      text:
        `This session: ${role ?? 'no role'}. ` +
        `Planner: ${planner ? planner.sessionId.slice(0, 8) : 'none'}. Builder: ${builder ? builder.sessionId.slice(0, 8) : 'none'}. ` +
        `Auto report: ${auto ? 'on' : 'off'}.`,
    }
  })

  on('command.run', { command: 'handoff' }, async ($, e) => {
    const text = e.args.trim() || lastAnswer
    if (text === '') return { text: 'Nothing to hand off yet: give a message, or ask Claude for a plan first.' }

    return { text: await sendToPartner($, text) }
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId === undefined && e.reason === 'answer' && e.answer.trim() !== '') {
      lastAnswer = e.answer
      // The builder reports back on its own when auto is on. The planner never
      // sends on its own, so the two sessions cannot loop.
      if ((await $.store.get('auto')) === true && (await roleOf($)) === 'builder') {
        $.ui.toast(await sendToPartner($, `Report:\n${e.answer}`))
      }
    }

    return next(e)
  })

  // A duo message arrives: say so, then let it reach the model as usual.
  on('session.receive', async ($, e, next) => {
    if (e.agentId === undefined && e.text.includes(TAG)) {
      const from = e.text.includes(`${TAG}planner]`) ? 'planner' : 'builder'
      $.ui.toast(`Duo: work from the ${from}`)
    }

    return next(e)
  })
}
