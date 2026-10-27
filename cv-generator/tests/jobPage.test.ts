import { describe, expect, it, vi } from 'vitest';
import { checkPublicUrl, extractJob, fetchJobPage, firstUrl, JobPageError } from '../server/jobPage.ts';
import { createApp } from '../server/app.ts';
import { createAccounts } from '../server/accounts.ts';
import { signToken } from '../server/auth.ts';
import type { Ai } from '../server/ai.ts';
import { toAiContent } from '../src/lib/cv.ts';
import { sampleClarify, sampleCv } from './fixtures.ts';
import { testDb } from './pglite.ts';

const LONG = 'Missions : tenue de la comptabilité générale, déclarations fiscales, paie de 120 salariés. '.repeat(5);

const html = (body: string, head = '') => `<!doctype html><html><head><title>Offre</title>${head}</head><body>${body}</body></html>`;

function page(body: string, init: ResponseInit = {}) {
  return new Response(body, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' }, ...init });
}

describe('lecture d’une offre à partir d’un lien', () => {
  it('trouve le lien dans un texte partagé', () => {
    expect(firstUrl('Regardez cette offre : https://www.linkedin.com/jobs/view/123/?ref=x).')).toBe('https://www.linkedin.com/jobs/view/123/?ref=x');
    expect(firstUrl('pas de lien')).toBeNull();
  });

  it('refuse les adresses internes', () => {
    for (const bad of ['http://localhost/x', 'http://127.0.0.1/', 'http://10.0.0.2/', 'http://192.168.1.1/', 'http://169.254.169.254/latest', 'http://[::1]/', 'ftp://exemple.com/', 'http://intranet/', 'https://exemple.com:8443/']) {
      expect(() => checkPublicUrl(bad), bad).toThrow(JobPageError);
    }
    expect(checkPublicUrl('https://www.emploi.bj/offre/42').hostname).toBe('www.emploi.bj');
  });

  it('préfère les données structurées JobPosting', () => {
    const ld = { '@context': 'https://schema.org', '@type': 'JobPosting', title: 'Comptable', hiringOrganization: { name: 'Groupe Sahel' }, jobLocation: { address: { addressLocality: 'Cotonou', addressCountry: 'BJ' } }, description: `<p>${LONG}</p>` };
    const job = extractJob(html('<div>menu</div>', `<script type="application/ld+json">${JSON.stringify(ld)}</script>`), 'https://x.bj/o');
    expect(job.text).toContain('Poste : Comptable');
    expect(job.text).toContain('Entreprise : Groupe Sahel');
    expect(job.text).toContain('Lieu : Cotonou, BJ');
    expect(job.text).not.toContain('menu');
  });

  it('se rabat sur le résumé de partage quand la page montre peu de texte (publication LinkedIn)', () => {
    const job = extractJob(
      html('<p>Connexion</p>', `<meta property="og:title" content="Groupe Sahel recrute"><meta property="og:description" content="Nous recrutons un comptable confirmé à Cotonou &amp; Porto-Novo">`),
      'https://www.linkedin.com/posts/x',
    );
    expect(job.title).toBe('Groupe Sahel recrute');
    expect(job.text).toContain('comptable confirmé à Cotonou & Porto-Novo');
  });

  it('suit les redirections publiques et refuse la page de connexion', async () => {
    const ok = vi.fn(async (u: URL | string) =>
      String(u).includes('/a') ? new Response(null, { status: 301, headers: { location: '/b' } }) : page(html(`<main><h1>Comptable</h1><p>${LONG}</p></main>`)),
    );
    const res = await fetchJobPage('https://emploi.example.com/a', ok as unknown as typeof fetch);
    expect(res.url).toBe('https://emploi.example.com/b');
    expect(res.text).toContain('Comptable');

    const wall = vi.fn(async () => new Response(null, { status: 302, headers: { location: 'https://www.linkedin.com/authwall?trk=x' } }));
    await expect(fetchJobPage('https://www.linkedin.com/posts/x', wall as unknown as typeof fetch)).rejects.toMatchObject({ status: 422 });

    const internal = vi.fn(async () => new Response(null, { status: 302, headers: { location: 'http://169.254.169.254/' } }));
    await expect(fetchJobPage('https://exemple.com/x', internal as unknown as typeof fetch)).rejects.toMatchObject({ status: 400 });
  });

  it('expose la lecture du lien sans compte', async () => {
    const fetchPage = vi.fn(async (url: string) => ({ url, title: 'Comptable', text: LONG }));
    const app = createApp({ ai: null, allowedOrigins: [], rateLimitPerHour: 5, fetchPage });
    const res = await app.request('/api/job/fetch', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url: 'https://emploi.bj/o/1' }) });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ title: 'Comptable' });

    const failing = createApp({ ai: null, allowedOrigins: [], rateLimitPerHour: 5, fetchPage: async () => { throw new JobPageError('Impossible de lire cette page', 422); } });
    const bad = await failing.request('/api/job/fetch', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url: 'https://emploi.bj/o/1' }) });
    expect(bad.status).toBe(422);
  });
});

describe('questions sur l’offre', () => {
  it('sont gratuites mais demandent un compte', async () => {
    const accounts = createAccounts(await testDb(), { freeCredits: 1, freeIpCooldownDays: 30 });
    const clarify = vi.fn(async () => sampleClarify);
    const app = createApp({ ai: { clarify } as unknown as Ai, accounts, sessionSecret: 's', allowedOrigins: [], rateLimitPerHour: 5 });
    const body = JSON.stringify({ cv: toAiContent(sampleCv()), job: { text: LONG } });
    const call = (auth?: string) =>
      app.request('/api/ai/clarify', { method: 'POST', headers: { 'content-type': 'application/json', ...(auth ? { authorization: `Bearer ${auth}` } : {}) }, body });

    expect((await call()).status).toBe(401);
    const user = await accounts.register({ identifier: 'q@x.co', password: 'secret12', ip: '9.9.9.9', device: 'device-question-1' });
    const res = await call(signToken(user.id, 's'));
    expect(res.status).toBe(200);
    expect((await res.json()).questions).toHaveLength(1);
    expect((await accounts.get(user.id))?.credits).toBe(1);
  });
});

describe('pages LinkedIn', () => {
  it('décode une description encodée deux fois et refuse la page d’inscription', async () => {
    const ld = { '@type': 'JobPosting', title: 'Comptable', description: '&lt;p&gt;Tenue de la comptabilité &amp;amp; paie.&lt;/p&gt;'.repeat(20) };
    const job = extractJob(html('', `<script type="application/ld+json">${JSON.stringify(ld)}</script>`), 'https://www.linkedin.com/jobs/view/1');
    expect(job.text).not.toContain('<p>');
    expect(job.text).toContain('Tenue de la comptabilité');

    const signup = vi.fn(async () => page(html(`<main><p>${'Inscrivez-vous sur LinkedIn, c’est gratuit. E-mail Mot de passe. '.repeat(6)}</p></main>`).replace('<title>Offre</title>', '<title>S’inscrire | LinkedIn</title>')));
    await expect(fetchJobPage('https://www.linkedin.com/feed/update/urn:li:activity:1/', signup as unknown as typeof fetch)).rejects.toMatchObject({ status: 422 });
  });
});

describe('liens WhatsApp', () => {
  it('explique de copier le texte du message au lieu de lire la page', async () => {
    const never = vi.fn();
    for (const u of ['https://whatsapp.com/channel/0029Val4LD696H4LE4lwYh2F/120', 'https://chat.whatsapp.com/AbCdEf', 'https://wa.me/22900000000']) {
      await expect(fetchJobPage(u, never as unknown as typeof fetch)).rejects.toThrow(/Copiez le texte/);
    }
    expect(never).not.toHaveBeenCalled();
  });
});

describe('services payants du scanner', () => {
  it('la retranscription coûte 1 crédit par page, remboursé en cas d’échec ; le dossier coûte 1 crédit', async () => {
    const { sampleTranscript } = await import('./fixtures.ts');
    const accounts = createAccounts(await testDb(), { freeCredits: 1, freeIpCooldownDays: 30 });
    const user = await accounts.register({ identifier: 'scan@x.co', password: 'secret12', ip: '8.8.8.8', device: 'device-scan-000001' });
    await accounts.grant(user.id, 4, 'test'); // 5 crédits
    let fail = false;
    const transcribe = vi.fn(async () => {
      if (fail) throw new Error('panne');
      return sampleTranscript;
    });
    const app = createApp({ ai: { transcribe } as unknown as Ai, accounts, sessionSecret: 's', allowedOrigins: [], rateLimitPerHour: 50 });
    const auth = { 'content-type': 'application/json', authorization: `Bearer ${signToken(user.id, 's')}` };
    const page = { name: 'p.jpg', mediaType: 'image/jpeg', data: 'AAAA' };
    const send = (n: number) => app.request('/api/ai/transcribe', { method: 'POST', headers: auth, body: JSON.stringify({ files: Array.from({ length: n }, () => page) }) });

    expect((await send(2)).status).toBe(200);
    expect((await accounts.get(user.id))?.credits).toBe(3);
    fail = true;
    expect((await send(2)).status).toBe(500);
    expect((await accounts.get(user.id))?.credits).toBe(3);
    fail = false;
    const tooMany = await send(4);
    expect(tooMany.status).toBe(402);
    expect((await tooMany.json()).error).toContain('4 crédits');

    const unlock = await app.request('/api/dossier/unlock', { method: 'POST', headers: auth });
    expect(await unlock.json()).toEqual({ credits: 2 });
  });
});
