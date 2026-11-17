import { expect, test } from 'claude-code/testing'

// Runs one main-loop turn with the given prompt and reports the model its
// first request was sent to.
async function modelFor($: any, on: any, text: string, turnId: string, store: Record<string, unknown> = {}): Promise<string> {
  let seen = ''
  on('store.get', (_: unknown, e: { key: string }) => ({ value: store[e.key] }))
  on('store.set', (_: unknown, e: { key: string; value: unknown }) => ((store[e.key] = e.value), { value: undefined }))
  on('turn.start', (_: unknown, e: { turnId: string }) => ({ turnId: e.turnId }))
  on('turn.step', async function* (_: unknown, e: { turnId: string; index: number; model: string }) {
    seen = e.model
    return { turnId: e.turnId, index: e.index, answer: 'ok', toolUses: [], stopReason: 'end_turn', usage: null }
  })
  on('turn.complete', (_: unknown, e: { answer: string }) => ({ text: e.answer }))

  await $.turn.start({ text, turnId })
  for await (const _ of $.turn.step({ turnId, index: 0, model: 'claude-opus-5-5', messageCount: 1 })) {
    // the stream's chunks are not needed here
  }
  await $.turn.complete({ answer: 'ok', durationMs: 1, isAborted: false, turnId, reason: 'answer' })

  return seen
}

test('a short summary request goes to haiku', async ($, on) => {
  expect(await modelFor($, on, 'Résume ce fichier en 3 points', 't1')).toBe('haiku')
})

test('a translation goes to haiku', async ($, on) => {
  expect(await modelFor($, on, 'Translate this sentence into English: bonjour à tous', 't2')).toBe('haiku')
})

test('a coding request stays on the session model', async ($, on) => {
  expect(await modelFor($, on, 'Crée un script qui résume mes fichiers', 't3')).toBe('claude-opus-5-5')
})

test('a long request stays on the session model', async ($, on) => {
  expect(await modelFor($, on, 'Résume ' + 'ceci '.repeat(80), 't4')).toBe('claude-opus-5-5')
})

test('when switched off, nothing is rerouted', async ($, on) => {
  expect(await modelFor($, on, 'Résume ce fichier', 't5', { enabled: false })).toBe('claude-opus-5-5')
})

test('a routed request is counted', async ($, on) => {
  const store: Record<string, unknown> = { routed: 4 }
  await modelFor($, on, 'Reformule cette phrase', 't6', store)
  expect(store.routed).toBe(5)
})
