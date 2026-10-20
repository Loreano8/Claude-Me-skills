import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../server/app.ts';
import { AiError, type Ai } from '../server/ai.ts';
import { toAiContent } from '../src/lib/cv.ts';
import { sampleAdapt, sampleCv, sampleLetter } from './fixtures.ts';

function fakeAi(overrides: Partial<Ai> = {}): Ai {
  return {
    structure: vi.fn(async () => ({ cv: sampleAdapt.cv, suggestions: ['ok'] })),
    adapt: vi.fn(async () => sampleAdapt),
    coverLetter: vi.fn(async () => sampleLetter),
    ...overrides,
  };
}

const post = (app: ReturnType<typeof createApp>, path: string, body: unknown, ip = '1.1.1.1') =>
  app.request(path, { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': ip }, body: JSON.stringify(body) });

describe('API', () => {
  it('indique si l’IA est configurée', async () => {
    const app = createApp({ ai: null, allowedOrigins: [], rateLimitPerHour: 5 });
    expect(await (await app.request('/api/health')).json()).toEqual({ ok: true, ai: false });
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
