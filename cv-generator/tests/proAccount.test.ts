import { describe, expect, it } from 'vitest';

describe('version Pro liée au compte', () => {
  it('se paie une seule fois, puis vaut pour tous les CV et tous les appareils', async () => {
    const { createApp } = await import('../server/app.ts');
    const { createAccounts } = await import('../server/accounts.ts');
    const { signToken } = await import('../server/auth.ts');
    const { testDb } = await import('./pglite.ts');
    const db = await testDb();
    const accounts = createAccounts(db, { freeCredits: 1, freeIpCooldownDays: 30 });
    const app = createApp({ ai: null, accounts, sessionSecret: 's', allowedOrigins: [], rateLimitPerHour: 5 });
    const user = await accounts.register({ identifier: 'pro@x.co', password: 'secret1234', ip: '9.9.9.9', device: 'device-pro-00001' });
    await accounts.grant(user.id, 5, 'test');
    const auth = { authorization: `Bearer ${signToken(user.id, 's')}` };
    const me = async () => (await (await app.request('/api/me', { headers: auth })).json()).user;
    expect((await me()).pro).toBe(false);
    expect((await (await app.request('/api/unlock', { method: 'POST', headers: auth })).json()).credits).toBe(4);
    expect((await me()).pro).toBe(true);
    // Deuxième demande (autre appareil, autre CV) : rien n'est repris.
    expect((await (await app.request('/api/unlock', { method: 'POST', headers: auth })).json()).credits).toBe(4);
    expect((await me()).credits).toBe(4);
  });
});
