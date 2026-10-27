import { describe, expect, it } from 'vitest';
import { createApp } from '../server/app.ts';
import { createAccounts } from '../server/accounts.ts';
import { signToken } from '../server/auth.ts';
import { createSupport } from '../server/support.ts';
import { createRecovery, normalizePhrase } from '../server/recovery.ts';
import { testDb } from './pglite.ts';

async function setup() {
  const db = await testDb();
  const accounts = createAccounts(db, { freeCredits: 1, freeIpCooldownDays: 30 });
  const support = createSupport(db);
  const recovery = createRecovery(db, accounts, support);
  const app = createApp({ ai: null, accounts, support, recovery, adminToken: 'adm', sessionSecret: 's', allowedOrigins: [], rateLimitPerHour: 50 });
  const user = await accounts.register({ identifier: 'awa@gmail.com', password: 'secret12', name: 'Awa', ip: '5.5.5.5', device: 'device-recup-001' });
  const json = { 'content-type': 'application/json' };
  const auth = { ...json, authorization: `Bearer ${signToken(user.id, 's')}` };
  const admin = { ...json, authorization: 'Bearer adm' };
  const call = (method: string, path: string, headers: Record<string, string>, body?: unknown) =>
    app.request(path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  return { accounts, support, call, json, auth, admin, user };
}

describe('phrase secrète et récupération de compte', () => {
  it('compare sans tenir compte des majuscules, accents et espaces', () => {
    expect(normalizePhrase('  Le CHAT   mange des Bananes vertes ! ')).toBe(normalizePhrase('le chat mange des bananes vertes'));
    expect(normalizePhrase('Été à Cotonou')).toBe('ete a cotonou');
  });

  it('vérifie automatiquement les réponses, puis l’administrateur valide et la personne reçoit son mot de passe', async () => {
    const { accounts, call, json, auth, admin } = await setup();
    expect(await (await call('GET', '/api/account/secret', auth)).json()).toEqual({ set: false, question: null });
    expect((await call('POST', '/api/account/secret', auth, { phrase: ' ! ' })).status).toBe(400);
    await call('POST', '/api/account/secret', auth, { phrase: 'Le chat mange des bananes' });
    expect(await (await call('GET', '/api/account/secret', auth)).json()).toEqual({ set: true, question: null });

    // La personne, déconnectée, remplit le formulaire : la demande arrive dans « Nous contacter ».
    const sent = await call('POST', '/api/auth/recovery', json, { identifier: 'AWA@gmail.com', name: 'awa', phrase: 'le CHAT mange des bananes', lastPurchase: 'none', credits: 2 });
    const { secret } = await sent.json();
    expect(secret).toBeTruthy();

    const { requests } = await (await call('GET', '/api/admin/recovery', admin)).json();
    expect(requests[0]).toMatchObject({ identifier: 'awa@gmail.com', status: 'pending', checks: { account: true, name: 'ok', phrase: 'ok', purchase: 'ok', credits: 'ok' } });
    expect(JSON.stringify(requests[0])).not.toContain('bananes');

    const { password } = await (await call('POST', `/api/admin/recovery/${requests[0].id}`, admin, { approve: true })).json();
    await expect(accounts.login('awa@gmail.com', password)).resolves.toMatchObject({ name: 'Awa' });

    // Le mot de passe provisoire arrive dans la conversation de la personne.
    const thread = await (await call('GET', '/api/support', { ...json, 'x-support-secret': secret })).json();
    expect(thread.messages.at(-1)).toMatchObject({ author: 'admin' });
    expect(thread.messages.at(-1).body).toContain(password);

    // Une demande déjà traitée ne peut pas l'être deux fois.
    expect((await call('POST', `/api/admin/recovery/${requests[0].id}`, admin, { approve: true })).status).toBe(409);
  });

  it('signale les réponses fausses et refuse sans changer le mot de passe', async () => {
    const { accounts, call, json, auth, admin } = await setup();
    await call('POST', '/api/account/secret', auth, { phrase: 'Le chat mange des bananes' });
    await call('POST', '/api/auth/recovery', json, { identifier: 'awa@gmail.com', name: 'Paul', phrase: 'mauvaise phrase', lastPurchase: '1500', credits: 40 });
    const { requests } = await (await call('GET', '/api/admin/recovery', admin)).json();
    expect(requests[0].checks).toEqual({ account: true, name: 'wrong', phrase: 'wrong', purchase: 'wrong', credits: 'wrong' });
    await call('POST', `/api/admin/recovery/${requests[0].id}`, admin, { approve: false });
    await expect(accounts.login('awa@gmail.com', 'secret12')).resolves.toBeTruthy();
  });

  it('accepte un seul mot, ou une question secrète montrée dans le formulaire', async () => {
    const { call, json, auth, admin } = await setup();
    expect((await call('POST', '/api/account/secret', auth, { phrase: 'Mangue' })).status).toBe(200);
    await call('POST', '/api/account/secret', auth, { phrase: 'Lomé', question: 'Ville de naissance de votre père ?' });
    expect(await (await call('GET', '/api/account/secret', auth)).json()).toEqual({ set: true, question: 'Ville de naissance de votre père ?' });
    expect(await (await call('GET', '/api/auth/recovery/question?identifier=AWA@gmail.com', json)).json()).toEqual({ question: 'Ville de naissance de votre père ?' });
    expect(await (await call('GET', '/api/auth/recovery/question?identifier=inconnu@gmail.com', json)).json()).toEqual({ question: null });
    await call('POST', '/api/auth/recovery', json, { identifier: 'awa@gmail.com', phrase: 'LOME' });
    const { requests } = await (await call('GET', '/api/admin/recovery', admin)).json();
    expect(requests[0].checks.phrase).toBe('ok');
  });

  it('change le mot de passe avec l’ancien', async () => {
    const { accounts, call, auth } = await setup();
    expect((await call('POST', '/api/account/password', auth, { current: 'faux', password: 'nouveau99' })).status).toBe(400);
    expect((await call('POST', '/api/account/password', auth, { current: 'secret12', password: 'nouveau99' })).status).toBe(200);
    await expect(accounts.login('awa@gmail.com', 'nouveau99')).resolves.toBeTruthy();
  });
});
