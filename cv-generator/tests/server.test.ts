import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../server/app.ts';
import { AiError, type Ai } from '../server/ai.ts';
import { toAiContent } from '../src/lib/cv.ts';
import { sampleAdapt, sampleCv, sampleInterview, sampleLetter, sampleRevise, sampleTemplateAnalysis, sampleTranslation, sampleClarify, sampleTranscript, sampleStyle, sampleLetterQuestions } from './fixtures.ts';

function fakeAi(overrides: Partial<Ai> = {}): Ai {
  return {
    structure: vi.fn(async () => ({ cv: sampleAdapt.cv, suggestions: ['ok'], language: 'fr' as const })),
    adapt: vi.fn(async () => sampleAdapt),
    coverLetter: vi.fn(async () => sampleLetter),
    translate: vi.fn(async () => sampleTranslation),
    interview: vi.fn(async () => sampleInterview),
    revise: vi.fn(async () => sampleRevise),
    analyzeTemplate: vi.fn(async () => sampleTemplateAnalysis),
    clarify: vi.fn(async () => sampleClarify),
    transcribe: vi.fn(async () => sampleTranscript),
    style: vi.fn(async () => sampleStyle),
    letterQuestions: vi.fn(async () => sampleLetterQuestions),
    ...overrides,
  };
}

let deviceSeq = 0;
const post = (app: ReturnType<typeof createApp>, path: string, body: unknown, ip = '1.1.1.1') =>
  app.request(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip, 'x-device-id': `test-device-${++deviceSeq}` },
    body: JSON.stringify(body),
  });

describe('API', () => {
  it('indique si l’IA est configurée', async () => {
    const app = createApp({ ai: null, allowedOrigins: [], rateLimitPerHour: 5 });
    expect(await (await app.request('/api/health')).json()).toMatchObject({ ok: true, ai: false, accounts: false });
    const res = await post(app, '/api/ai/structure', { text: 'x' });
    expect(res.status).toBe(503);
  });

  it('structure un texte libre', async () => {
    const ai = fakeAi();
    const app = createApp({ ai, allowedOrigins: [], rateLimitPerHour: 5 });
    const res = await post(app, '/api/ai/structure', { text: 'Awa, comptable' });
    expect(res.status).toBe(200);
    expect((await res.json()).suggestions).toEqual(['ok']);
    expect(ai.structure).toHaveBeenCalledWith(expect.objectContaining({ text: 'Awa, comptable', file: null, current: null, lang: 'fr' }));
  });

  it('refuse une demande vide ou invalide', async () => {
    const app = createApp({ ai: fakeAi(), allowedOrigins: [], rateLimitPerHour: 50 });
    expect((await post(app, '/api/ai/structure', { text: '  ' })).status).toBe(400);
    expect((await post(app, '/api/ai/adapt', { cv: toAiContent(sampleCv()), job: { text: '' } })).status).toBe(400);
    expect((await post(app, '/api/ai/adapt', { cv: { nope: true }, job: { text: 'offre' } })).status).toBe(400);
    expect((await post(app, '/api/ai/structure', { text: 'x', file: { name: 'a.exe', mediaType: 'application/x-msdownload', data: 'AA==' } })).status).toBe(400);
  });

  it('adapte le CV et rédige la lettre', async () => {
    const app = createApp({ ai: fakeAi(), allowedOrigins: [], rateLimitPerHour: 50 });
    const cv = toAiContent(sampleCv());
    const adapt = await post(app, '/api/ai/adapt', { cv, job: { text: 'Responsable comptable' } });
    expect(adapt.status).toBe(200);
    expect((await adapt.json()).analysis.matchScore).toBe(72);
    const letter = await post(app, '/api/ai/cover-letter', { cv, job: { text: '' }, notes: 'Candidature spontanée chez X' });
    expect(letter.status).toBe(200);
    expect((await letter.json()).paragraphs).toHaveLength(3);
  });

  it('prépare la fiche d’entretien', async () => {
    const app = createApp({ ai: fakeAi(), allowedOrigins: [], rateLimitPerHour: 50 });
    const cv = toAiContent(sampleCv());
    expect((await post(app, '/api/ai/interview', { cv, job: { text: '' } })).status).toBe(400);
    const res = await post(app, '/api/ai/interview', { cv, job: { text: 'Responsable comptable' } });
    expect(res.status).toBe(200);
    expect((await res.json()).questions).toHaveLength(2);
  });

  it('traduit le CV pour un marché donné', async () => {
    const ai = fakeAi();
    const app = createApp({ ai, allowedOrigins: [], rateLimitPerHour: 50 });
    const res = await post(app, '/api/ai/translate', { cv: toAiContent(sampleCv()), targetLang: 'en', market: 'uk' });
    expect(res.status).toBe(200);
    expect((await res.json()).cv.personal.title).toBe('Senior Accountant');
    expect(ai.translate).toHaveBeenCalledWith(expect.objectContaining({ targetLang: 'en', market: 'uk' }));
    expect((await post(app, '/api/ai/translate', { cv: toAiContent(sampleCv()), targetLang: 'xx' })).status).toBe(400);
  });

  it('transmet les erreurs de l’IA avec un message lisible', async () => {
    const app = createApp({
      ai: fakeAi({ structure: async () => Promise.reject(new AiError('Refusé', 422, 'refusal')) }),
      allowedOrigins: [],
      rateLimitPerHour: 50,
    });
    const res = await post(app, '/api/ai/structure', { text: 'x' });
    expect(res.status).toBe(422);
    expect((await res.json()).error).toBe('Refusé');
  });

  it('limite le nombre de demandes par adresse IP', async () => {
    const app = createApp({ ai: fakeAi(), allowedOrigins: [], rateLimitPerHour: 2 });
    expect((await post(app, '/api/ai/structure', { text: 'a' }, '9.9.9.9')).status).toBe(200);
    expect((await post(app, '/api/ai/structure', { text: 'a' }, '9.9.9.9')).status).toBe(200);
    expect((await post(app, '/api/ai/structure', { text: 'a' }, '9.9.9.9')).status).toBe(429);
    expect((await post(app, '/api/ai/structure', { text: 'a' }, '8.8.8.8')).status).toBe(200);
  });

  it('autorise les origines configurées (application Android)', async () => {
    const app = createApp({ ai: fakeAi(), allowedOrigins: ['https://localhost'], rateLimitPerHour: 5 });
    const res = await app.request('/api/health', { headers: { origin: 'https://localhost' } });
    expect(res.headers.get('access-control-allow-origin')).toBe('https://localhost');
    const other = await app.request('/api/health', { headers: { origin: 'https://evil.example' } });
    expect(other.headers.get('access-control-allow-origin')).toBeNull();
  });
});

describe('API avec comptes et crédits', async () => {
  const { testDb } = await import('./pglite.ts');
  const { createAccounts } = await import('../server/accounts.ts');
  const { createPayments } = await import('../server/payments.ts');

  async function setup(aiOverrides: Partial<Ai> = {}) {
    const db = await testDb();
    const accounts = createAccounts(db, { freeCredits: 1, freeIpCooldownDays: 0 });
    const status = { value: 'pending' };
    const payments = createPayments(db, accounts, {
      name: 'fedapay',
      createCheckout: async () => ({ ref: '777', url: 'https://checkout.example/777' }),
      fetchStatus: async () => status.value as never,
    });
    const app = createApp({ ai: fakeAi(aiOverrides), accounts, payments, sessionSecret: 's3cret', adminToken: 'adm', publicUrl: 'https://site.example', allowedOrigins: [], rateLimitPerHour: 50 });
    return { app, status };
  }

  const authed = (app: ReturnType<typeof createApp>, path: string, token: string, body: unknown) =>
    app.request(path, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify(body) });

  it('demande un compte, offre 1 génération puis demande de recharger', async () => {
    const { app } = await setup();
    expect((await post(app, '/api/ai/structure', { text: 'x' })).status).toBe(401);
    const reg = await post(app, '/api/auth/register', { identifier: 'awa@mail.com', password: 'secret12' });
    const { token, user } = await reg.json();
    expect(user.credits).toBe(1);
    const first = await authed(app, '/api/ai/structure', token, { text: 'Awa comptable' });
    expect(first.status).toBe(200);
    expect(first.headers.get('x-credits-remaining')).toBe('0');
    const second = await authed(app, '/api/ai/adapt', token, { cv: toAiContent(sampleCv()), job: { text: 'offre' } });
    expect(second.status).toBe(402);
    expect((await second.json()).code).toBe('credits');
  });

  it('ne dépense pas de crédit pour une demande vide et rembourse si l’IA échoue', async () => {
    const { app } = await setup({ structure: async () => Promise.reject(new AiError('Panne', 502, 'upstream')) });
    const { token } = await (await post(app, '/api/auth/register', { identifier: '+229 97 00 00 00', password: 'secret12' })).json();
    expect((await authed(app, '/api/ai/structure', token, { text: ' ' })).status).toBe(400);
    const failed = await authed(app, '/api/ai/structure', token, { text: 'x' });
    expect(failed.status).toBe(502);
    expect(failed.headers.get('x-credits-remaining')).toBe('1');
  });

  it('crédite le compte après un paiement confirmé (retour client puis notification)', async () => {
    const { app, status } = await setup();
    const { token } = await (await post(app, '/api/auth/register', { identifier: 'a@b.co', password: 'secret12' })).json();
    const checkout = await authed(app, '/api/payments/checkout', token, { packId: 'essentiel' });
    expect((await checkout.json()).url).toBe('https://checkout.example/777');
    status.value = 'approved';
    const back = await app.request('/api/payments/return?id=777&status=approved');
    expect(back.status).toBe(302);
    expect(back.headers.get('location')).toBe('https://site.example/#paiement-approved');
    await post(app, '/api/payments/webhook', { name: 'transaction.approved', entity: { id: 777 } });
    // Événements étrangers à CVCasa : ignorés sans erreur (sinon FedaPay coupe le webhook).
    for (const event of [{ name: 'customer.created', entity: { id: 777 } }, { name: 'transaction.approved', entity: { id: 999 } }, {}]) {
      expect((await post(app, '/api/payments/webhook', event)).status).toBe(200);
    }
    const me = await app.request('/api/me', { headers: { authorization: `Bearer ${token}` } });
    expect((await me.json()).user.credits).toBe(4);
  });

  it('permet à l’administrateur d’ajouter des crédits', async () => {
    const { app } = await setup();
    await post(app, '/api/auth/register', { identifier: 'a@b.co', password: 'secret12' });
    expect((await authed(app, '/api/admin/credits', 'mauvais', { identifier: 'a@b.co', credits: 5 })).status).toBe(403);
    const res = await authed(app, '/api/admin/credits', 'adm', { identifier: 'a@b.co', credits: 5 });
    expect((await res.json()).credits).toBe(6);
  });
});

describe('corrections et modèles', () => {
  it('applique des corrections dictées', async () => {
    const ai = fakeAi();
    const app = createApp({ ai, allowedOrigins: [], rateLimitPerHour: 5 });
    expect((await post(app, '/api/ai/revise', { cv: toAiContent(sampleCv()), instructions: '  ' })).status).toBe(400);
    const res = await post(app, '/api/ai/revise', { cv: toAiContent(sampleCv()), instructions: 'enlève le permis' });
    expect(res.status).toBe(200);
    expect((await res.json()).changes).toHaveLength(2);
    expect(ai.revise).toHaveBeenCalledWith(expect.objectContaining({ instructions: 'enlève le permis', lang: 'fr' }));
  });

  it('analyse un modèle importé (image ou PDF seulement)', async () => {
    const ai = fakeAi();
    const app = createApp({ ai, allowedOrigins: [], rateLimitPerHour: 5 });
    const file = (mediaType: string) => ({ file: { name: 'modele', mediaType, data: 'aGVsbG8=' } });
    expect((await post(app, '/api/ai/analyze-template', file('text/plain'))).status).toBe(400);
    const res = await post(app, '/api/ai/analyze-template', file('image/png'));
    expect(res.status).toBe(200);
    expect((await res.json()).style.layout).toBe('sidebar-right');
  });
});
