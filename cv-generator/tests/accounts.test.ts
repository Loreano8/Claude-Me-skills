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

  it('ouvre l’offre de retour une seule fois, après 10 jours d’absence, pour 72 heures', async () => {
    const db = await testDb();
    const accounts = createAccounts(db, opts);
    const provider = fakeProvider('pending');
    const payments = createPayments(db, accounts, provider);
    const user = await accounts.register({ identifier: 'r@b.co', password: 'secret12', ip: '1.1.1.1', device: dev() });
    const day = 86_400_000;
    const now = Date.now();

    // Personne active : pas d'offre, mais elle reste possible plus tard.
    expect(await payments.returnOffer(user, new Date(now))).toEqual({ active: null, possible: true, notBefore: null });
    await expect(payments.checkout(user, 'retour', 'x')).rejects.toMatchObject({ status: 410 });

    // Retour après 11 jours : l'offre s'ouvre pour 72 heures, au prix du pack de 3.
    const back = await payments.returnOffer(user, new Date(now + 11 * day));
    expect(back.active?.pack).toMatchObject({ credits: 4, price: 500 });
    expect(new Date(back.active!.expiresAt).getTime()).toBe(now + 11 * day + 72 * 3_600_000);
    expect((await payments.returnOffer(user, new Date(now + 12 * day))).active).not.toBeNull();

    // Achetée : 4 crédits ajoutés, puis plus jamais proposée.
    expect(back.notBefore).toBeNull();
    await db.query('update users set return_offer_until = $2 where id = $1', [user.id, new Date(Date.now() + 3_600_000).toISOString()]);
    await payments.checkout(user, 'retour', 'x');
    provider.statusRef.value = 'approved';
    expect((await payments.confirm('tx-1')).credits).toBe(5);
    expect(await payments.returnOffer(user, new Date(now + 60 * day))).toEqual({ active: null, possible: false, notBefore: null });
  });

  it('attend 30 jours après un achat avant de proposer l’offre de retour', async () => {
    const db = await testDb();
    const accounts = createAccounts(db, opts);
    const provider = fakeProvider('approved');
    const payments = createPayments(db, accounts, provider);
    const user = await accounts.register({ identifier: 'p@b.co', password: 'secret12', ip: '1.1.1.1', device: dev() });
    await payments.checkout(user, 'essentiel', 'x');
    await payments.confirm('tx-1');
    const offer = await payments.returnOffer(user, new Date(Date.now() + 15 * 86_400_000));
    expect(offer.active).toBeNull();
    expect(new Date(offer.notBefore!).getTime()).toBeGreaterThan(Date.now() + 29 * 86_400_000);
  });

  it('ne rouvre pas une offre de retour expirée', async () => {
    const db = await testDb();
    const accounts = createAccounts(db, opts);
    const payments = createPayments(db, accounts, fakeProvider('pending'));
    const user = await accounts.register({ identifier: 'x@b.co', password: 'secret12', ip: '1.1.1.1', device: dev() });
    const later = Date.now() + 11 * 86_400_000;
    await payments.returnOffer(user, new Date(later));
    expect(await payments.returnOffer(user, new Date(later + 4 * 86_400_000))).toEqual({ active: null, possible: false, notBefore: null });
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

describe('version Pro d’un CV', () => {
  it('coûte 2 crédits : le crédit offert ne suffit pas', async () => {
    const { createApp } = await import('../server/app.ts');
    const { signToken } = await import('../server/auth.ts');
    const accounts = createAccounts(await testDb(), opts);
    const app = createApp({ ai: null, allowedOrigins: [], rateLimitPerHour: 5, accounts, sessionSecret: 's' });
    const user = await accounts.register({ identifier: 'pro@x.co', password: 'secret12', ip: '1.1.1.1', device: dev() });
    const unlock = (auth?: string) => app.request('/api/unlock', { method: 'POST', headers: auth ? { authorization: `Bearer ${auth}` } : {} });
    expect((await unlock()).status).toBe(401);
    expect((await unlock(signToken(user.id, 's'))).status).toBe(402);
    expect((await accounts.get(user.id))?.credits).toBe(1);
    await accounts.grant(user.id, 2, 'test');
    const res = await unlock(signToken(user.id, 's'));
    expect(await res.json()).toEqual({ credits: 1 });
  });
});
