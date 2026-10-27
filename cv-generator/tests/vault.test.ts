import { describe, expect, it } from 'vitest';
import { createApp } from '../server/app.ts';
import { createAccounts } from '../server/accounts.ts';
import { signToken } from '../server/auth.ts';
import { createVault, maskEmail } from '../server/vault.ts';
import { testDb } from './pglite.ts';

const KEY = 'q'.repeat(43) + '=';

async function setup(withMail = true) {
  const db = await testDb();
  const accounts = createAccounts(db, { freeCredits: 1, freeIpCooldownDays: 30 });
  const sent: { to: string; text: string }[] = [];
  const vault = createVault(db, accounts, withMail ? async (to, _s, text) => void sent.push({ to, text }) : null);
  const app = createApp({ ai: null, accounts, vault, sessionSecret: 's', allowedOrigins: [], rateLimitPerHour: 50 });
  const user = await accounts.register({ identifier: 'awa@gmail.com', password: 'secret12', ip: '7.7.7.7', device: 'device-coffre-001' });
  const headers = { 'content-type': 'application/json', authorization: `Bearer ${signToken(user.id, 's')}` };
  const call = (method: string, path: string, body?: unknown, h: Record<string, string> = headers) =>
    app.request(path, { method, headers: h, body: body ? JSON.stringify(body) : undefined });
  const lastCode = () => sent.at(-1)!.text.match(/\b(\d{6})\b/)![1];
  return { app, accounts, call, sent, lastCode, user };
}

describe('coffre-fort', () => {
  it('garde le double de la clé et le rend avec le mot de passe du compte', async () => {
    const { call } = await setup();
    expect((await call('POST', '/api/vault/key', { key: KEY })).status).toBe(200);
    expect((await call('POST', '/api/vault/recover', { password: 'mauvais' })).status).toBe(400);
    expect(await (await call('POST', '/api/vault/recover', { password: 'secret12' })).json()).toEqual({ key: KEY });
    expect((await call('POST', '/api/vault/recover', { password: 'secret12' }, { 'content-type': 'application/json' })).status).toBe(401);
  });

  it('rend la clé avec un code reçu par e-mail, valable une seule fois', async () => {
    const { call, sent, lastCode } = await setup();
    await call('POST', '/api/vault/key', { key: KEY });
    const res = await call('POST', '/api/vault/recover/email');
    expect(await res.json()).toEqual({ to: 'a**@gmail.com' });
    expect(sent[0].to).toBe('awa@gmail.com');
    expect((await call('POST', '/api/vault/recover', { code: '000000' === lastCode() ? '111111' : '000000' })).status).toBe(400);
    const code = lastCode();
    expect(await (await call('POST', '/api/vault/recover', { code })).json()).toEqual({ key: KEY });
    expect((await call('POST', '/api/vault/recover', { code })).status).toBe(400);
  });

  it('sans service d’e-mail : l’option est signalée comme indisponible', async () => {
    const { app, call } = await setup(false);
    expect((await (await app.request('/api/health')).json()).email).toBe(false);
    expect((await call('POST', '/api/vault/recover/email')).status).toBe(503);
  });
});

describe('mot de passe oublié', () => {
  it('envoie un code puis change le mot de passe, sans révéler qui est inscrit', async () => {
    const { call, accounts, lastCode, sent } = await setup();
    const plain = { 'content-type': 'application/json' };
    expect(await (await call('POST', '/api/auth/forgot', { identifier: 'inconnu@gmail.com' }, plain)).json()).toEqual({ ok: true, to: null });
    expect(sent).toHaveLength(0);
    await call('POST', '/api/auth/forgot', { identifier: 'AWA@gmail.com' }, plain);
    const res = await call('POST', '/api/auth/reset', { identifier: 'awa@gmail.com', code: lastCode(), password: 'nouveau99' }, plain);
    expect(res.status).toBe(200);
    expect((await res.json()).token).toBeTruthy();
    await expect(accounts.login('awa@gmail.com', 'nouveau99')).resolves.toMatchObject({ identifier: 'awa@gmail.com' });
  });

  it('masque l’adresse', () => {
    expect(maskEmail('zdmedeton@gmail.com')).toBe('z********@gmail.com');
  });
});
