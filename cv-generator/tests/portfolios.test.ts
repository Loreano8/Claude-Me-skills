import { describe, expect, it } from 'vitest';
import { createApp } from '../server/app.ts';
import { createAccounts } from '../server/accounts.ts';
import { createPortfolios } from '../server/portfolios.ts';
import { signToken } from '../server/auth.ts';
import { testDb } from './pglite.ts';
import { SAMPLE_NURSE } from '../src/portfolio/samples.ts';

async function setup() {
  const db = await testDb();
  const accounts = createAccounts(db, { freeCredits: 1, freeIpCooldownDays: 30 });
  const app = createApp({ ai: null, accounts, portfolios: createPortfolios(db, accounts), sessionSecret: 's', publicUrl: 'https://cvcasa.com', allowedOrigins: [], rateLimitPerHour: 5 });
  const user = await accounts.register({ identifier: 'pf@x.co', password: 'secret1234', ip: '8.8.8.8', device: 'device-pf-000001' });
  const other = await accounts.register({ identifier: 'pf2@x.co', password: 'secret1234', ip: '8.8.4.4', device: 'device-pf-000002' });
  const call = (method: string, path: string, body: unknown, uid: number | null = user.id) =>
    app.request(path, { method, headers: { 'content-type': 'application/json', ...(uid ? { authorization: `Bearer ${signToken(uid, 's')}` } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return { app, accounts, user, other, call };
}

const data = { ...SAMPLE_NURSE, cvUrl: '' };

describe('portfolio en ligne', () => {
  it('publie avec une adresse tirée du nom, la sert au public, puis la retire', async () => {
    const { app, call } = await setup();
    expect((await call('POST', '/api/portfolio', { theme: 'classique', data }, null)).status).toBe(401);
    const res = await (await call('POST', '/api/portfolio', { theme: 'classique', data })).json();
    expect(res.portfolio.slug).toBe('prenom-nom');
    expect(res.portfolio.url).toBe('https://cvcasa.com/p/#prenom-nom');
    const pub = await (await app.request('/api/portfolio/public/prenom-nom')).json();
    expect(pub.theme).toBe('classique');
    expect(pub.pro).toBe(false);
    expect(pub.data.name).toBe('Prénom Nom');

    await call('POST', '/api/portfolio/stop', {});
    expect((await app.request('/api/portfolio/public/prenom-nom')).status).toBe(404);
    const mine = await (await call('GET', '/api/portfolio', undefined)).json();
    expect(mine.portfolio.published).toBe(false);
  });

  it('donne une autre adresse au deuxième homonyme et refuse une adresse prise', async () => {
    const { call, other } = await setup();
    await call('POST', '/api/portfolio', { theme: 'classique', data });
    const second = await (await call('POST', '/api/portfolio', { theme: 'classique', data }, other.id)).json();
    expect(second.portfolio.slug).toBe('prenom-nom-2');
    const taken = await call('POST', '/api/portfolio', { theme: 'classique', slug: 'prenom-nom', data }, other.id);
    expect(taken.status).toBe(409);
    expect((await call('POST', '/api/portfolio', { theme: 'classique', slug: 'admin', data }, other.id)).status).toBe(409);
    expect((await call('POST', '/api/portfolio', { theme: 'classique', slug: 'Pas Valide!', data }, other.id)).status).toBe(400);
  });

  it('un design Pro demande 2 crédits, pris une seule fois', async () => {
    const { call, accounts, user } = await setup();
    const locked = await call('POST', '/api/portfolio', { theme: 'creatif', data });
    expect(locked.status).toBe(402);
    expect((await locked.json()).code).toBe('pro');
    // 1 crédit offert : pas assez.
    const poor = await call('POST', '/api/portfolio', { theme: 'creatif', data, unlock: true });
    expect((await poor.json()).code).toBe('credits');
    await accounts.grant(user.id, 3, 'test');
    const ok = await (await call('POST', '/api/portfolio', { theme: 'creatif', data, unlock: true })).json();
    expect(ok.portfolio.pro).toBe(true);
    expect(ok.credits).toBe(2);
    // Changer de design ensuite ne coûte rien.
    const again = await (await call('POST', '/api/portfolio', { theme: 'colonne', data, unlock: true })).json();
    expect(again.credits).toBe(2);
  });

  it('refuse une image qui n’en est pas une', async () => {
    const { call } = await setup();
    const bad = { ...data, projects: [{ title: 'x', text: '', link: '', image: 'javascript:alert(1)' }] };
    expect((await call('POST', '/api/portfolio', { theme: 'classique', data: bad })).status).toBe(400);
  });
});
