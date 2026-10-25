import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../server/app.ts';
import { createAccounts } from '../server/accounts.ts';
import { signToken } from '../server/auth.ts';
import { createSupport, notifier } from '../server/support.ts';
import { testDb } from './pglite.ts';

async function setup() {
  const db = await testDb();
  const notify = vi.fn(async () => {});
  const accounts = createAccounts(db, { freeCredits: 1, freeIpCooldownDays: 30 });
  const support = createSupport(db, notify);
  const app = createApp({ ai: null, allowedOrigins: [], rateLimitPerHour: 100, accounts, support, sessionSecret: 's', adminToken: 'adm' });
  const call = (method: string, path: string, body?: unknown, headers: Record<string, string> = {}) =>
    app.request(path, { method, headers: { 'content-type': 'application/json', ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { call, notify, accounts };
}

describe('nous contacter', () => {
  it('garde la conversation du visiteur grâce à son secret, et le propriétaire répond', async () => {
    const { call, notify } = await setup();
    const first = await (await call('POST', '/api/support', { body: 'Bonjour, mon paiement est en attente', name: 'Awa', contact: '+22997000000' })).json();
    expect(first.secret).toMatch(/^[0-9a-f]{48}$/);
    expect(first.messages).toHaveLength(1);
    expect(notify).toHaveBeenCalledWith(expect.stringContaining('mon paiement est en attente'));

    const me = { 'x-support-secret': first.secret };
    await call('POST', '/api/support', { body: 'Merci !' }, me);
    expect((await (await call('GET', '/api/support', undefined, me)).json()).messages).toHaveLength(2);
    expect((await (await call('GET', '/api/support')).json()).messages).toEqual([]); // un autre visiteur ne voit rien

    expect((await call('GET', '/api/admin/support')).status).toBe(403);
    const admin = { authorization: 'Bearer adm' };
    const { threads } = await (await call('GET', '/api/admin/support', undefined, admin)).json();
    expect(threads[0]).toMatchObject({ name: 'Awa', contact: '+22997000000', unread: 2, lastMessage: 'Merci !' });
    await call('POST', `/api/admin/support/${threads[0].id}`, { body: 'Bonjour Awa, c’est réglé.' }, admin);

    expect((await (await call('GET', '/api/support/unread', undefined, me)).json()).unread).toBe(1);
    const after = await (await call('GET', '/api/support', undefined, me)).json();
    expect(after.messages.at(-1)).toMatchObject({ author: 'admin', body: 'Bonjour Awa, c’est réglé.' });
    expect((await (await call('GET', '/api/support/unread', undefined, me)).json()).unread).toBe(0);
  });

  it('retrouve la conversation d’un client connecté sur un autre appareil', async () => {
    const { call, accounts } = await setup();
    const user = await accounts.register({ identifier: 'k@x.co', password: 'secret12', ip: '1.1.1.1', device: 'device-1234' });
    const auth = { authorization: `Bearer ${signToken(user.id, 's')}` };
    await call('POST', '/api/support', { body: 'Question depuis mon téléphone' }, auth);
    const other = await (await call('GET', '/api/support', undefined, auth)).json();
    expect(other.messages[0].body).toBe('Question depuis mon téléphone');
  });

  it('prévient le propriétaire par e-mail et WhatsApp selon les réglages', async () => {
    const fetchImpl = vi.fn(async () => new Response('ok')) as unknown as typeof fetch;
    await notifier({ RESEND_API_KEY: 're_x', SUPPORT_NOTIFY_EMAIL: 'moi@x.co', CALLMEBOT_PHONE: '+229', CALLMEBOT_APIKEY: 'k' }, 'https://site/#admin', fetchImpl)('Salut');
    const urls = (fetchImpl as unknown as { mock: { calls: [string][] } }).mock.calls.map((c) => c[0]);
    expect(urls).toEqual(['https://api.resend.com/emails', expect.stringContaining('api.callmebot.com')]);
    await notifier({}, 'x', fetchImpl)('rien');
    expect((fetchImpl as unknown as { mock: { calls: unknown[] } }).mock.calls).toHaveLength(2);
  });
});
