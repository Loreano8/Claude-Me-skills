import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../server/app.ts';
import type { Ai } from '../server/ai.ts';
import { createAccounts } from '../server/accounts.ts';
import { signToken } from '../server/auth.ts';
import { toAiContent } from '../src/lib/cv.ts';
import { findCliches } from '../src/lib/naturalCheck.ts';
import { sampleCv, sampleLetterQuestions, sampleStyle } from './fixtures.ts';
import { testDb } from './pglite.ts';

describe('relecture naturelle', () => {
  it('repère les formules toutes faites, accents compris, sans faux positifs', () => {
    const hits = findCliches([
      { where: 'accroche', text: 'Comptable motivée et rigoureuse, forte de 5 ans d’expérience.' },
      { where: 'paragraphe 1', text: 'C’est avec un grand intérêt que je postule — au sein de votre prestigieuse entreprise.' },
      { where: 'paragraphe 2', text: 'Ma motivation vient de mon stage. J’ai réduit les retards de paiement de 30 %.' },
    ]);
    const labels = hits.map((h) => h.label);
    expect(labels).toEqual(expect.arrayContaining(['motivé', 'rigoureux', 'fort de…', 'c’est avec un grand intérêt…', 'tiret long (—)', 'prestigieuse entreprise']));
    expect(hits.find((h) => h.label === 'motivé')?.where).toEqual(['accroche']);
    expect(findCliches([{ where: 'x', text: 'Ma motivation vient de mon stage. Dynamisation des ventes.' }])).toEqual([]);
  });
});

describe('« Écrire comme moi » et questions avant la lettre', () => {
  it('sont gratuites mais demandent un compte', async () => {
    const accounts = createAccounts(await testDb(), { freeCredits: 1, freeIpCooldownDays: 30 });
    const style = vi.fn(async () => sampleStyle);
    const letterQuestions = vi.fn(async () => sampleLetterQuestions);
    const app = createApp({ ai: { style, letterQuestions } as unknown as Ai, accounts, sessionSecret: 's', allowedOrigins: [], rateLimitPerHour: 5 });
    const call = (path: string, body: unknown, auth?: string) =>
      app.request(path, { method: 'POST', headers: { 'content-type': 'application/json', ...(auth ? { authorization: `Bearer ${auth}` } : {}) }, body: JSON.stringify(body) });

    expect((await call('/api/ai/style', { text: 'Bonjour' })).status).toBe(401);
    const user = await accounts.register({ identifier: 's@x.co', password: 'secret12', ip: '8.8.8.8', device: 'device-style-1' });
    const token = signToken(user.id, 's');
    expect((await call('/api/ai/style', {}, token)).status).toBe(400);
    const res = await call('/api/ai/style', { text: 'Je suis comptable. J’aime les chiffres justes.' }, token);
    expect(res.status).toBe(200);
    expect((await res.json()).traits).toContain('Ton direct');

    const q = await call('/api/ai/letter-questions', { cv: toAiContent(sampleCv()), job: { text: 'Comptable' } }, token);
    expect(q.status).toBe(200);
    expect((await q.json()).questions).toHaveLength(2);
    expect((await accounts.get(user.id))?.credits).toBe(1);
  });

  it('transmet le style aux demandes de rédaction', async () => {
    const coverLetter = vi.fn(async () => ({ paragraphs: [] }));
    const app = createApp({ ai: { coverLetter } as unknown as Ai, allowedOrigins: [], rateLimitPerHour: 5 });
    await app.request('/api/ai/cover-letter', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ cv: toAiContent(sampleCv()), job: { text: 'Comptable' }, style: '- Ton direct' }),
    });
    expect((coverLetter.mock.calls[0] as unknown[])[0]).toMatchObject({ style: '- Ton direct' });
  });
});
