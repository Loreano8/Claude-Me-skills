import { describe, expect, it } from 'vitest';
import { generateKeyPairSync } from 'node:crypto';
import { createAccounts } from '../server/accounts.ts';
import { createPush } from '../server/push.ts';
import { createWatches, offersPush, searchLocation, searchPrompt, type RawOffer, type WatchSearch } from '../server/watch.ts';
import { WatchCriteria } from '../shared/schema.ts';
import { testDb } from './pglite.ts';

const offer = (url: string, title = 'Comptable'): RawOffer => ({
  title, company: 'Société', location: 'Lyon', contract: 'CDI', salary: '', experience: '', beninEligible: 'oui', deadline: '', url, summary: '', skills: ['Excel'],
});
const base = { jobs: ['Comptable'], contracts: ['cdi' as const], level: 'tous' as const, minSalary: 0, keywords: '', email: '' };

describe('veille à l’étranger', () => {
  it('accepte une ville libre sans zone cochée, refuse une recherche sans lieu', () => {
    expect(WatchCriteria.safeParse({ ...base, zones: [], place: 'Tokyo' }).success).toBe(true);
    expect(WatchCriteria.safeParse({ ...base, zones: ['france', 'canada'] }).success).toBe(true);
    expect(WatchCriteria.safeParse({ ...base, zones: [] }).success).toBe(false);
  });

  it('dit à la recherche où chercher et d’où la personne postule', () => {
    const p = searchPrompt(WatchCriteria.parse({ ...base, zones: ['france'], place: 'Lyon', country: 'FR' }), [], new Date('2026-11-18'));
    expect(p).toContain('Zones : France');
    expect(p).toContain('Ville ou pays précis demandé : Lyon');
    expect(p).toContain('La personne vit actuellement : France');
    expect(searchLocation('FR')).toEqual({ type: 'approximate', country: 'FR' });
    // Le Bénin n'est pas accepté par l'outil de recherche : fuseau horaire seulement.
    expect(searchLocation('BJ')).toEqual({ type: 'approximate', timezone: 'Africa/Porto-Novo' });
  });
});

describe('notification des nouvelles offres', () => {
  async function setup(found: RawOffer[][], push?: boolean) {
    const db = await testDb();
    const accounts = createAccounts(db, { freeCredits: 1, freeIpCooldownDays: 30 });
    let calls = 0;
    const search: WatchSearch = async () => ({ offers: found[Math.min(calls++, found.length - 1)], note: '' });
    const sent: { userId: number; title: string; body: string; tab: string }[] = [];
    const watches = createWatches(db, accounts, search, null, 'https://cvcasa.com', async (userId, msg) => void sent.push({ userId, ...msg }));
    const user = await accounts.register({ identifier: 'p@x.co', password: 'secret1234', ip: '7.7.7.9', device: 'device-push-0001' });
    await accounts.grant(user.id, 10, 'test');
    await watches.save(user.id, { criteria: { ...base, zones: ['benin'], ...(push === undefined ? {} : { push }) }, profile: 'Comptable', frequency: 'daily' });
    await watches.start(user);
    const due = async () => {
      await db.query(`update job_watches set next_run_at = now() - interval '1 minute', paid_until = now() + interval '7 days' where user_id = $1`, [user.id]);
      await db.query('delete from job_search_cache');
      return watches.runDue();
    };
    return { sent, due, user };
  }

  it('prévient le téléphone seulement quand il y a de vraies nouvelles offres', async () => {
    const { sent, due, user } = await setup([[offer('https://a.bj/1'), offer('https://a.bj/2', 'Aide-comptable')], [offer('https://a.bj/1')]]);
    await due();
    expect(sent).toEqual([{ userId: user.id, title: '2 nouvelles offres pour vous', body: 'Comptable – Société · Aide-comptable – Société', tab: 'veille' }]);
    await due(); // rien de nouveau : pas de notification
    expect(sent).toHaveLength(1);
  });

  it('respecte le choix « pas de notification sur mon téléphone »', async () => {
    const { sent, due } = await setup([[offer('https://a.bj/1')]], false);
    await due();
    expect(sent).toEqual([]);
  });

  it('texte en anglais pour une personne qui lit l’anglais', () => {
    expect(offersPush([{ ...offer('https://a/1'), match: 0, matched: [], missing: [] }], 'en')).toEqual({ title: 'A new job for you', body: 'Comptable – Société' });
  });
});

describe('envoi Firebase', () => {
  it('signe la demande, envoie à chaque téléphone et oublie les téléphones désinstallés', async () => {
    const db = await testDb();
    const accounts = createAccounts(db, { freeCredits: 1, freeIpCooldownDays: 30 });
    const user = await accounts.register({ identifier: 'f@x.co', password: 'secret1234', ip: '7.7.7.10', device: 'device-push-0002' });
    const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const account = JSON.stringify({ project_id: 'cvcasa-test', client_email: 'push@cvcasa-test.iam.gserviceaccount.com', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }) });
    const calls: { url: string; body: string }[] = [];
    const fake = (async (url: string, init?: RequestInit) => {
      calls.push({ url: String(url), body: String(init?.body ?? '') });
      if (String(url).includes('oauth2')) return new Response(JSON.stringify({ access_token: 'jeton-google' }));
      return String(init?.body).includes('telephone-desinstalle') ? new Response('{}', { status: 404 }) : new Response('{}');
    }) as typeof fetch;
    const push = createPush(db, account, fake);
    expect(push.enabled).toBe(true);
    await push.register(user.id, 'telephone-actif-'.padEnd(40, 'x'));
    await push.register(user.id, 'telephone-desinstalle-'.padEnd(40, 'y'));
    expect(await push.send(user.id, { title: 'Une nouvelle offre pour vous', body: 'Comptable – Société', tab: 'veille' })).toBe(1);
    expect(calls[0].url).toBe('https://oauth2.googleapis.com/token');
    expect(calls[0].body).toContain('assertion=');
    expect(calls.filter((c) => c.url.endsWith('/projects/cvcasa-test/messages:send'))).toHaveLength(2);
    expect(JSON.parse(calls[1].body).message.data).toEqual({ tab: 'veille' });
    // Le téléphone désinstallé est oublié.
    expect(await db.query('select token from push_tokens where user_id = $1', [user.id])).toHaveLength(1);
    // Sans clé : désactivé, aucun envoi.
    expect(createPush(db, '').enabled).toBe(false);
  });
});
