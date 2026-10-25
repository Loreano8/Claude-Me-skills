import { describe, expect, it, vi } from 'vitest';
import { createAccounts } from '../server/accounts.ts';
import { normalizeIdentifier, signToken, verifyToken } from '../server/auth.ts';
import { createPayments, fedapay, type PaymentProvider } from '../server/payments.ts';
import { testDb } from './pglite.ts';

const opts = { freeCredits: 1, freeIpCooldownDays: 30 };
let seq = 0;
const dev = () => `device-${++seq}-xxxxxxxx`;

describe('comptes', () => {
  it('inscrit avec 1 crédit offert puis connecte', async () => {
    const accounts = createAccounts(await testDb(), opts);
    const user = await accounts.register({ identifier: ' Awa@Mail.com ', password: 'secret12', name: 'Awa', ip: '1.1.1.1', device: dev() });
    expect(user.credits).toBe(1);
    expect((await accounts.login('awa@mail.com', 'secret12')).id).toBe(user.id);
    await expect(accounts.login('awa@mail.com', 'mauvais')).rejects.toMatchObject({ status: 401 });
    await expect(accounts.register({ identifier: 'awa@mail.com', password: 'secret12', ip: '2.2.2.2', device: dev() })).rejects.toMatchObject({ status: 409 });
  });

  it('accepte un numéro de téléphone et refuse un identifiant invalide', () => {
    expect(normalizeIdentifier('+229 97 00 00 00')).toBe('+22997000000');
    expect(normalizeIdentifier('bonjour')).toBeNull();
  });

  it('n’offre le crédit gratuit qu’une fois par appareil et par connexion internet', async () => {
    const accounts = createAccounts(await testDb(), opts);
    const reg = (id: string, ip: string, device: string) => accounts.register({ identifier: id, password: 'secret12', ip, device }).then((u) => u.credits);
    expect(await reg('u1@x.com', '9.9.9.9', 'phone-AAAAAAAA')).toBe(1);
    expect(await reg('u2@x.com', '8.8.8.8', 'phone-AAAAAAAA')).toBe(0); // même téléphone, autre réseau
    expect(await reg('u3@x.com', '9.9.9.9', 'phone-BBBBBBBB')).toBe(0); // autre téléphone, même connexion
    expect(await reg('u4@x.com', '7.7.7.7', 'phone-CCCCCCCC')).toBe(1); // nouvelle personne
    expect(await reg('u5@x.com', '6.6.6.6', '')).toBe(0); // pas d’identifiant d’appareil
  });

  it('dépense, refuse quand il n’y a plus de crédit, et rembourse', async () => {
    const accounts = createAccounts(await testDb(), opts);
    const user = await accounts.register({ identifier: 'a@b.co', password: 'secret12', ip: '1.1.1.1', device: dev() });
    expect(await accounts.spend(user.id, 'structure')).toBe(0);
    await expect(accounts.spend(user.id, 'adapt')).rejects.toMatchObject({ status: 402 });
    expect(await accounts.refund(user.id, 'structure')).toBe(1);
  });

  it('signe et vérifie les jetons de session', () => {
    const token = signToken(42, 'secret');
    expect(verifyToken(token, 'secret')).toBe(42);
    expect(verifyToken(token, 'autre')).toBeNull();
    expect(verifyToken(token.slice(0, -2) + 'xx', 'secret')).toBeNull();
  });
});

describe('paiements', () => {
  function fakeProvider(status: string): PaymentProvider & { statusRef: { value: string } } {
    const statusRef = { value: status };
    return {
      name: 'fake',
      statusRef,
      createCheckout: async () => ({ ref: 'tx-1', url: 'https://pay.example/tx-1' }),
      fetchStatus: async () => statusRef.value as never,
    };
  }

  it('ajoute les crédits une seule fois quand le paiement est approuvé', async () => {
    const db = await testDb();
    const accounts = createAccounts(db, opts);
    const provider = fakeProvider('pending');
    const payments = createPayments(db, accounts, provider);
    const user = await accounts.register({ identifier: 'a@b.co', password: 'secret12', ip: '1.1.1.1', device: dev() });
    expect(await payments.checkout(user, 'candidature', 'https://site/return')).toBe('https://pay.example/tx-1');
    expect((await payments.confirm('tx-1')).status).toBe('pending');
    expect((await accounts.get(user.id))!.credits).toBe(1);
    provider.statusRef.value = 'approved';
    expect((await payments.confirm('tx-1')).credits).toBe(11);
    await payments.confirm('tx-1');
    expect((await accounts.get(user.id))!.credits).toBe(11);
  });

  it('refuse un pack inconnu', async () => {
    const db = await testDb();
    const accounts = createAccounts(db, opts);
    const user = await accounts.register({ identifier: 'a@b.co', password: 'secret12', ip: '1.1.1.1', device: dev() });
    await expect(createPayments(db, accounts, fakeProvider('pending')).checkout(user, 'gratuit', 'x')).rejects.toMatchObject({ status: 400 });
  });

  it('appelle l’API FedaPay pour créer le paiement et lire son statut', async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fetchImpl = vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      const body = url.endsWith('/token')
        ? { token: 'tok', url: 'https://checkout.fedapay.com/tok' }
        : { 'v1/transaction': { id: 123, status: url.endsWith('/123') ? 'approved' : 'pending' } };
      return new Response(JSON.stringify(body), { status: 200 });
    }) as unknown as typeof fetch;
    const provider = fedapay('sk_test', 'sandbox', fetchImpl);
    const user = { id: 1, identifier: 'a@b.co', name: 'Awa', credits: 0 };
    const res = await provider.createCheckout({ user, pack: { id: 'p', name: 'P', credits: 3, price: 500 }, returnUrl: 'https://site/return' });
    expect(res).toEqual({ ref: '123', url: 'https://checkout.fedapay.com/tok' });
    expect(calls[0].url).toBe('https://sandbox-api.fedapay.com/v1/transactions');
    expect(JSON.parse(String(calls[0].init.body))).toMatchObject({ amount: 500, currency: { iso: 'XOF' }, callback_url: 'https://site/return' });
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBe('Bearer sk_test');
    expect(await provider.fetchStatus('123')).toBe('approved');
  });
});

describe('santé du serveur', () => {
  it('interroge la base pour la garder active', async () => {
    const { createApp } = await import('../server/app.ts');
    const app = createApp({ ai: null, allowedOrigins: [], rateLimitPerHour: 5, accounts: createAccounts(await testDb(), opts) });
    expect(await (await app.request('/api/health')).json()).toMatchObject({ ok: true, accounts: true, db: true });
  });
});

describe('parrainage', () => {
  it('récompense le filleul et le parrain une seule fois, au premier achat du filleul', async () => {
    const db = await testDb();
    const accounts = createAccounts(db, opts);
    let n = 0;
    const provider: PaymentProvider = {
      name: 'fake',
      createCheckout: async () => ({ ref: `tx-${++n}`, url: 'https://pay.example' }),
      fetchStatus: async () => 'approved',
    };
    const payments = createPayments(db, accounts, provider);
    const parrain = await accounts.register({ identifier: 'p@x.co', password: 'secret12', ip: '1.1.1.1', device: dev() });
    const { code } = await accounts.referral(parrain.id);
    expect(code).toMatch(/^[A-Z2-9]{6}$/);
    expect((await accounts.referral(parrain.id)).code).toBe(code); // le code ne change pas

    const filleul = await accounts.register({ identifier: 'f@x.co', password: 'secret12', ip: '2.2.2.2', device: dev(), referralCode: code.toLowerCase() });
    expect(await accounts.referral(parrain.id)).toMatchObject({ invited: 1, rewarded: 0 });

    await payments.checkout(filleul, 'essentiel', 'x');
    expect((await payments.confirm('tx-1')).credits).toBe(1 + 3 + 1); // offert + pack + bonus parrainage
    expect((await accounts.get(parrain.id))!.credits).toBe(1 + 1);
    expect(await accounts.referral(parrain.id)).toMatchObject({ invited: 1, rewarded: 1 });

    await payments.checkout(filleul, 'essentiel', 'x');
    await payments.confirm('tx-2');
    expect((await accounts.get(filleul.id))!.credits).toBe(5 + 3); // pas de second bonus
    expect((await accounts.get(parrain.id))!.credits).toBe(2);
  });

  it('ignore un code inconnu', async () => {
    const accounts = createAccounts(await testDb(), opts);
    const u = await accounts.register({ identifier: 'z@x.co', password: 'secret12', ip: '3.3.3.3', device: dev(), referralCode: 'NOPE42' });
    expect(u.credits).toBe(1);
  });
});
