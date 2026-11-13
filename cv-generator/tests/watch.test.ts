import { describe, expect, it } from 'vitest';
import { createApp } from '../server/app.ts';
import { createAccounts } from '../server/accounts.ts';
import { cleanOffers, createWatches, matchOffer, nextRunAt, offersEmail, type RawOffer, type WatchSearch } from '../server/watch.ts';
import { signToken } from '../server/auth.ts';
import type { WatchSaveRequest } from '../shared/schema.ts';
import { testDb } from './pglite.ts';

const offer = (url: string, extra: Partial<RawOffer> = {}): RawOffer => ({
  title: 'Comptable',
  company: 'Société de transport',
  location: 'Cotonou',
  contract: 'CDI',
  salary: '',
  experience: '2 ans',
  beninEligible: 'oui',
  deadline: '',
  url,
  summary: 'Tenue de la comptabilité.',
  skills: ['Excel', 'Sage', 'Paie', 'Fiscalité'],
  ...extra,
});

const SAVE: WatchSaveRequest = {
  criteria: { jobs: ['Comptable'], contracts: ['cdi'], zones: ['benin'], level: 'tous', minSalary: 0, keywords: '', email: '' },
  profile: 'Comptable. Compétences : Excel, Sage, gestion de la paie.',
  frequency: 'daily',
};

async function setup(found: RawOffer[][]) {
  const db = await testDb();
  const accounts = createAccounts(db, { freeCredits: 1, freeIpCooldownDays: 30 });
  let calls = 0;
  const search: WatchSearch = async () => ({ offers: found[Math.min(calls++, found.length - 1)], note: 'Voici les offres du jour.' });
  const mails: { to: string; subject: string }[] = [];
  const watches = createWatches(db, accounts, search, async (to, subject) => void mails.push({ to, subject }), 'https://cvcasa.com');
  const app = createApp({ ai: null, accounts, watches, cronSecret: 'cron-secret', sessionSecret: 's', allowedOrigins: [], rateLimitPerHour: 50 });
  const user = await accounts.register({ identifier: 'veille@x.co', password: 'secret1234', ip: '7.7.7.8', device: 'device-watch-0001' });
  const token = signToken(user.id, 's');
  const post = (path: string, body: unknown = {}, headers: Record<string, string> = { authorization: `Bearer ${token}` }) =>
    app.request(path, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
  return { db, accounts, user, app, post, mails, calls: () => calls };
}

describe('veille emploi : règles', () => {
  it('programme l’envoi à 7 h 30 au Bénin (6 h 30 UTC)', () => {
    expect(nextRunAt('daily', new Date('2026-11-12T05:00:00Z')).toISOString()).toBe('2026-11-12T06:30:00.000Z');
    expect(nextRunAt('daily', new Date('2026-11-12T07:00:00Z')).toISOString()).toBe('2026-11-13T06:30:00.000Z');
    expect(nextRunAt('weekly', new Date('2026-11-12T07:00:00Z')).toISOString()).toBe('2026-11-19T06:30:00.000Z');
  });

  it('écarte les liens inventés, en double ou déjà envoyés', () => {
    const hosts = new Set(['emploi.example.bj']);
    const out = cleanOffers(
      [offer('https://emploi.example.bj/offre/1'), offer('https://www.emploi.example.bj/offre/1/'), offer('https://site-invente.com/x'), offer('pas un lien'), offer('https://emploi.example.bj/offre/2')],
      hosts,
      new Set(['emploi.example.bj/offre/2']),
    );
    expect(out.map((o) => o.url)).toEqual(['https://emploi.example.bj/offre/1']);
  });

  it('dit quelles compétences demandées sont déjà dans le CV', () => {
    const m = matchOffer(offer('https://a.bj/1'), 'Comptable. Excel, Sage, gestion de la paie.');
    expect(m.matched).toEqual(['Excel', 'Sage', 'Paie']);
    expect(m.missing).toEqual(['Fiscalité']);
    expect(m.match).toBe(75);
  });

  it('e-mail simple, avec les liens et un rappel contre les arnaques', () => {
    const mail = offersEmail([{ ...offer('https://a.bj/1'), match: 75, matched: ['Excel'], missing: [] }], '', 'https://cvcasa.com/#veille');
    expect(mail.subject).toBe('Votre veille emploi : 1 offre pour vous');
    expect(mail.text).toContain('https://a.bj/1');
    expect(mail.text).toContain('Aucun recruteur sérieux ne demande d’argent');
  });
});

describe('veille emploi : parcours', () => {
  it('première recherche offerte, ensuite 1 crédit, sans renvoyer les mêmes offres', async () => {
    const { post, accounts, user } = await setup([[offer('https://a.bj/1'), offer('https://a.bj/2')], [offer('https://a.bj/2'), offer('https://a.bj/3')]]);
    expect((await post('/api/watch/run')).status).toBe(404);
    expect((await post('/api/watch', SAVE)).status).toBe(200);

    const first = await (await post('/api/watch/run')).json();
    expect(first.free).toBe(true);
    expect(first.run.offers.map((o: RawOffer) => o.url)).toEqual(['https://a.bj/1', 'https://a.bj/2']);
    expect((await accounts.get(user.id))!.credits).toBe(1);

    // Même jour, mêmes critères : la recherche est reprise du cache, rien de nouveau.
    const second = await (await post('/api/watch/run')).json();
    expect(second.free).toBe(false);
    expect(second.credits).toBe(0);
    expect(second.run.offers).toEqual([]);

    const third = await post('/api/watch/run');
    expect(third.status).toBe(402);
  });

  it('veille chaque matin : débite la semaine, envoie par e-mail, se met en pause sans crédits', async () => {
    const { post, accounts, user, db, mails, app } = await setup([[offer('https://a.bj/1')]]);
    await post('/api/watch', SAVE);
    expect((await post('/api/watch/start')).status).toBe(402);
    await accounts.grant(user.id, 4, 'test');
    const started = await (await post('/api/watch/start')).json();
    expect(started.watch.active).toBe(true);
    expect(started.credits).toBe(1);

    // Le planificateur doit donner le secret.
    expect((await post('/api/watch/cron', {}, { 'x-cron-secret': 'faux' })).status).toBe(401);
    await db.query(`update job_watches set next_run_at = now() - interval '1 minute' where user_id = $1`, [user.id]);
    expect(await (await post('/api/watch/cron', {}, { 'x-cron-secret': 'cron-secret' })).json()).toMatchObject({ done: 1, paused: 0, failed: 0 });
    expect(mails).toEqual([{ to: 'veille@x.co', subject: 'Votre veille emploi : 1 offre pour vous' }]);

    // Semaine terminée et plus assez de crédits : pause et e-mail.
    await db.query(`update job_watches set next_run_at = now() - interval '1 minute', paid_until = now() - interval '1 minute' where user_id = $1`, [user.id]);
    expect(await (await post('/api/watch/cron', {}, { 'x-cron-secret': 'cron-secret' })).json()).toMatchObject({ done: 0, paused: 1, failed: 0 });
    expect(mails[1].subject).toBe('Votre veille emploi est en pause');
    const state = await (await app.request('/api/watch', { headers: { authorization: `Bearer ${(await import('../server/auth.ts')).signToken(user.id, 's')}` } })).json();
    expect(state.watch.active).toBe(false);
    expect(state.runs).toHaveLength(1);
  });
});
