import { describe, expect, it } from 'vitest';
import { createAccounts } from '../server/accounts.ts';
import { createAmbassadors } from '../server/ambassadors.ts';
import { BEP20_TOKENS, bscChain, createCrypto, type Chain, type ChainTx } from '../server/crypto.ts';
import { createPayments } from '../server/payments.ts';
import { testDb } from './pglite.ts';

const US = '0x1111111111111111111111111111111111111111';
const PROOF = `data:image/png;base64,${'A'.repeat(1200)}`;
const MIN = 60_000;
const hash = (n: number) => '0x' + String(n).padStart(64, '0');

async function setup(auto = true) {
  const db = await testDb();
  const clock = { t: Date.now() };
  const accounts = createAccounts(db, { freeCredits: 1, freeIpCooldownDays: 0 });
  const payments = createPayments(db, accounts, null, createAmbassadors(db, () => new Date(clock.t)));
  const txs = new Map<string, ChainTx>();
  const chain: Chain = { fetch: async (h) => txs.get(h) ?? null };
  const crypto = createCrypto(db, payments, chain, { address: US.toUpperCase().replace('0X', '0x'), tokens: ['USDT'], auto }, () => new Date(clock.t));
  let seq = 0;
  const person = () => accounts.register({ identifier: `c${++seq}@ex.com`, password: 'secret12', ip: `10.1.0.${seq}`, device: `device-c${seq}-xxxxxx` });
  /** Un envoi sur la (fausse) blockchain, fait maintenant. */
  const send = (n: number, amount: number, over: Partial<ChainTx> & { token?: string; to?: string } = {}) => {
    txs.set(hash(n), { success: true, confirmations: 20, time: new Date(clock.t), transfers: [{ token: over.token ?? BEP20_TOKENS.USDT, from: '0x2222222222222222222222222222222222222222', to: over.to ?? US, amount }], ...over });
    return hash(n);
  };
  const credits = async (id: number) => (await accounts.get(id))!.credits;
  return { db, clock, accounts, crypto, person, send, credits };
}

describe('paiement crypto (USDT BEP20)', () => {
  it('le client peut annuler sa commande ouverte : plus de rappel, et rien à annuler ensuite', async () => {
    const { crypto, person } = await setup();
    const u = await person();
    const v = await person();
    const order = await crypto.open(u, 'essentiel');
    // Personne d'autre ne peut l'annuler.
    await expect(crypto.cancel(v.id, order.id)).rejects.toMatchObject({ status: 410 });
    await crypto.cancel(u.id, order.id);
    expect(await crypto.current(u.id)).toBeNull();
    await expect(crypto.cancel(u.id, order.id)).rejects.toMatchObject({ status: 410 });
    await expect(crypto.submit(u.id, order.id, '0x' + 'a'.repeat(64), PROOF)).rejects.toMatchObject({ status: 410 });
    // Il peut repartir sur une nouvelle commande.
    expect(await crypto.open(u, 'essentiel')).toMatchObject({ status: 'open' });
  });

  it('cas clair : crédits ajoutés automatiquement, une seule fois', async () => {
    const { crypto, person, send, credits, clock } = await setup();
    const u = await person();
    const order = await crypto.open(u, 'essentiel');
    expect(order).toMatchObject({ amount: 1, token: 'USDT', network: 'BEP20', status: 'open' });
    clock.t += 2 * MIN;
    const h = send(1, 1);
    expect(await crypto.submit(u.id, order.id, h.toUpperCase().replace('0X', '0x'), PROOF)).toMatchObject({ status: 'paid', credits: 4 });
    expect(await credits(u.id)).toBe(4);
    // Le même identifiant ne sert plus, ni pour lui ni pour un autre.
    const again = await crypto.open(u, 'essentiel');
    await expect(crypto.submit(u.id, again.id, h, PROOF)).rejects.toMatchObject({ status: 409 });
    const v = await person();
    const other = await crypto.open(v, 'essentiel');
    await expect(crypto.submit(v.id, other.id, h, PROOF)).rejects.toMatchObject({ status: 409 });
    expect(await credits(v.id)).toBe(1);
  });

  it('refuse un faux USDT, une autre adresse, une transaction échouée, inconnue ou pas encore confirmée', async () => {
    const { crypto, person, send, credits } = await setup();
    const u = await person();
    const order = await crypto.open(u, 'essentiel');
    await expect(crypto.submit(u.id, order.id, send(1, 1, { token: '0x9999999999999999999999999999999999999999' }), PROOF)).rejects.toThrow(/officiel/);
    await expect(crypto.submit(u.id, order.id, send(2, 1, { to: '0x3333333333333333333333333333333333333333' }), PROOF)).rejects.toThrow(/adresse/);
    await expect(crypto.submit(u.id, order.id, send(3, 1, { success: false }), PROOF)).rejects.toThrow(/échoué/);
    await expect(crypto.submit(u.id, order.id, hash(404), PROOF)).rejects.toMatchObject({ status: 404 });
    await expect(crypto.submit(u.id, order.id, send(4, 1, { confirmations: 2 }), PROOF)).rejects.toMatchObject({ status: 425 });
    await expect(crypto.submit(u.id, order.id, 'abc', PROOF)).rejects.toThrow(/invalide/);
    await expect(crypto.submit(u.id, order.id, send(5, 1), '')).rejects.toThrow(/capture/);
    expect(await credits(u.id)).toBe(1);
  });

  it('deux commandes ouvertes au moment du paiement : rien d’automatique, l’administrateur tranche', async () => {
    const { crypto, person, send, credits, clock } = await setup();
    const payer = await person();
    const thief = await person();
    const thiefOrder = await crypto.open(thief, 'essentiel');
    clock.t += MIN;
    const order = await crypto.open(payer, 'essentiel');
    clock.t += MIN;
    const h = send(1, 1);
    // Le tricheur passe le premier avec l'identifiant vu sur la blockchain.
    expect(await crypto.submit(thief.id, thiefOrder.id, h, PROOF)).toEqual({ status: 'review' });
    expect(await crypto.submit(payer.id, order.id, h, PROOF)).toEqual({ status: 'review' });
    expect(await credits(thief.id)).toBe(1);
    const list = await crypto.adminList();
    expect(list.orders.filter((o) => o.status === 'review')).toHaveLength(2);
    expect(list.orders[0].proof).toBe(PROOF);
    expect(list.orders[0].chain).toMatchObject({ amount: 1 });
    // L'administrateur valide le vrai payeur : l'autre ne peut plus être validé avec le même identifiant.
    expect(await crypto.decide(order.id, 'approve')).toMatchObject({ status: 'paid', credits: 4 });
    await expect(crypto.decide(thiefOrder.id, 'approve')).rejects.toMatchObject({ status: 409 });
    expect(await crypto.decide(thiefOrder.id, 'refuse', 'Pas de preuve')).toMatchObject({ status: 'refused' });
    expect(await credits(thief.id)).toBe(1);
  });

  it('montant insuffisant ou paiement hors délai : vérification manuelle', async () => {
    const { crypto, person, send, credits, clock } = await setup();
    const u = await person();
    const order = await crypto.open(u, 'candidature');
    expect(order.amount).toBe(3);
    expect(await crypto.submit(u.id, order.id, send(1, 2.5), PROOF)).toEqual({ status: 'review' });
    expect(await credits(u.id)).toBe(1);
    // Une commande en vérification bloque l'ouverture d'une autre.
    await expect(crypto.open(u, 'essentiel')).rejects.toMatchObject({ status: 409 });
    const v = await person();
    const old = send(2, 1); // payé avant d'ouvrir la commande
    clock.t += 10 * MIN;
    const late = await crypto.open(v, 'essentiel');
    expect(await crypto.submit(v.id, late.id, old, PROOF)).toEqual({ status: 'review' });
  });

  it('validation manuelle activée : tout passe par l’administrateur', async () => {
    const { crypto, person, send, credits } = await setup();
    await crypto.setAuto(false);
    const u = await person();
    const order = await crypto.open(u, 'pro');
    expect(await crypto.submit(u.id, order.id, send(1, 5), PROOF)).toEqual({ status: 'review' });
    expect((await crypto.current(u.id))?.status).toBe('review');
    expect(await crypto.decide(order.id, 'approve')).toMatchObject({ credits: 26 });
    expect(await credits(u.id)).toBe(26);
    expect((await crypto.adminList()).auto).toBe(false);
  });

  it('limite le nombre d’essais et ne garde qu’une commande ouverte par compte', async () => {
    const { crypto, person, send } = await setup();
    const u = await person();
    const first = await crypto.open(u, 'essentiel');
    const second = await crypto.open(u, 'essentiel');
    await expect(crypto.submit(u.id, first.id, send(1, 1), PROOF)).rejects.toMatchObject({ status: 410 });
    for (let i = 0; i < 8; i++) await expect(crypto.submit(u.id, second.id, hash(900 + i), PROOF)).rejects.toMatchObject({ status: 404 });
    await expect(crypto.submit(u.id, second.id, send(2, 1), PROOF)).rejects.toMatchObject({ status: 410 });
  });

  it('deux monnaies acceptées : l’USDC envoyé pour une commande en USDT est refusé', async () => {
    const db = await testDb();
    const accounts = createAccounts(db, { freeCredits: 1, freeIpCooldownDays: 0 });
    const txs = new Map<string, ChainTx>();
    const crypto = createCrypto(db, createPayments(db, accounts, null, null), { fetch: async (h) => txs.get(h) ?? null }, { address: US, tokens: ['USDT', 'USDC'], auto: true });
    const u = await accounts.register({ identifier: 'two@ex.com', password: 'secret12', ip: '10.2.0.1', device: 'device-two-xxxxxx' });
    const tx = (token: string): ChainTx => ({ success: true, confirmations: 20, time: new Date(), transfers: [{ token, from: '0x2222222222222222222222222222222222222222', to: US, amount: 1 }] });
    expect(crypto.config().tokens).toEqual(['USDT', 'USDC']);
    const order = await crypto.open(u, 'essentiel', 'USDT');
    txs.set(hash(1), tx(BEP20_TOKENS.USDC));
    await expect(crypto.submit(u.id, order.id, hash(1), PROOF)).rejects.toThrow(/officielle/);
    const usdc = await crypto.open(u, 'essentiel', 'USDC');
    expect(usdc.token).toBe('USDC');
    expect(await crypto.submit(u.id, usdc.id, hash(1), PROOF)).toMatchObject({ status: 'paid', credits: 4 });
    await expect(crypto.open(u, 'essentiel', 'DOGE')).rejects.toThrow(/acceptée/);
  });

  it('lit un transfert BEP20 depuis la réponse d’un nœud', async () => {
    const pad = (a: string) => '0x' + a.slice(2).padStart(64, '0');
    const replies: Record<string, unknown> = {
      eth_getTransactionReceipt: { status: '0x1', blockNumber: '0x64', logs: [{ address: BEP20_TOKENS.USDT.toUpperCase().replace('0X', '0x'), topics: ['0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef', pad('0x2222222222222222222222222222222222222222'), pad(US)], data: '0x' + (3n * 10n ** 18n).toString(16) }] },
      eth_getBlockByNumber: { timestamp: '0x' + (1_800_000_000).toString(16) },
      eth_blockNumber: '0x72',
    };
    const fake = (async (_url: string, init: { body: string }) => new Response(JSON.stringify({ result: replies[JSON.parse(init.body).method] }))) as unknown as typeof fetch;
    const tx = await bscChain(fake, ['https://node.example']).fetch(hash(1));
    expect(tx).toMatchObject({ success: true, confirmations: 15, transfers: [{ token: BEP20_TOKENS.USDT, to: US, amount: 3 }] });
    expect(tx!.time.getTime()).toBe(1_800_000_000_000);
  });
});

describe('paiement crypto : montant inférieur', () => {
  it('crédite au prorata du montant reçu, au tarif du petit pack, et rien sous la valeur d’un crédit', async () => {
    const { crypto, person, send, credits, db } = await setup();
    const u = await person();
    const order = await crypto.open(u, 'candidature'); // 3 USDT pour 10 crédits
    expect(await crypto.submit(u.id, order.id, send(1, 2), PROOF)).toEqual({ status: 'review' });
    // Petit pack : 3 crédits pour 1 USDT → 2 USDT = 6 crédits.
    expect((await crypto.adminList()).orders[0]).toMatchObject({ prorata: 6, status: 'review' });
    expect(await crypto.decide(order.id, 'prorata')).toMatchObject({ status: 'paid', credits: 7 });
    expect(await credits(u.id)).toBe(7);
    const [pay] = await db.query<{ credits: number; amount: number }>(`select credits, amount from payments where user_id = $1`, [u.id]);
    expect(pay).toMatchObject({ credits: 6, amount: 1000 }); // prix retenu : 2/3 de 1 500 FCFA
    // Presque rien envoyé : pas de prorata possible.
    const v = await person();
    const tiny = await crypto.open(v, 'essentiel');
    expect(await crypto.submit(v.id, tiny.id, send(2, 0.2), PROOF)).toEqual({ status: 'review' });
    expect((await crypto.adminList()).orders.find((o) => o.id === tiny.id)?.prorata).toBe(0);
    await expect(crypto.decide(tiny.id, 'prorata')).rejects.toThrow(/trop faible/);
    expect(await credits(v.id)).toBe(1);
  });
});

describe('offre de lancement', () => {
  it('donne plus de crédits par pack jusqu’à la date de fin, puis revient aux packs habituels', async () => {
    const db = await testDb();
    const clock = { t: Date.parse('2026-12-01T10:00:00Z') };
    const accounts = createAccounts(db, { freeCredits: 1, freeIpCooldownDays: 0 });
    const payments = createPayments(db, accounts, null, null, { launchUntil: new Date('2026-12-31T23:00:00Z'), now: () => new Date(clock.t) });
    const u = await accounts.register({ identifier: 'launch@ex.com', password: 'secret12', ip: '10.3.0.1', device: 'device-launch-xxxx' });
    const now = payments.currentPacks();
    expect(now.launchUntil).toBe('2026-12-31T23:00:00.000Z');
    expect(now.packs.map((p) => [p.credits, p.baseCredits, p.price])).toEqual([[5, 3, 500], [16, 10, 1500], [35, 25, 3000]]);
    expect((await payments.packFor(u, 'candidature')).credits).toBe(16);
    // Un achat pendant l'offre crédite bien 5 crédits.
    await db.transaction(async (tx) => { await payments.recordPaidInTx(tx, u.id, await payments.packFor(u, 'essentiel'), 'crypto', '0xabc'); });
    expect((await accounts.get(u.id))!.credits).toBe(6);
    clock.t = Date.parse('2027-01-01T00:00:00Z');
    const after = payments.currentPacks();
    expect(after.launchUntil).toBeNull();
    expect(after.packs.map((p) => p.credits)).toEqual([3, 10, 25]);
    expect(after.packs[0].baseCredits).toBeUndefined();
    // Sans date réglée : pas d'offre.
    expect(createPayments(db, accounts, null, null).currentPacks()).toMatchObject({ launchUntil: null, packs: [{ credits: 3 }, { credits: 10 }, { credits: 25 }] });
  });
});

describe('historique des crédits', () => {
  it('retrace chaque mouvement avec le solde qui en résulte, et le montant des achats', async () => {
    const db = await testDb();
    const accounts = createAccounts(db, { freeCredits: 1, freeIpCooldownDays: 0 });
    const payments = createPayments(db, accounts, null, null);
    const u = await accounts.register({ identifier: 'hist@ex.com', password: 'secret12', ip: '10.4.0.1', device: 'device-hist-xxxxx' });
    await accounts.spend(u.id, 'structure');
    await db.transaction(async (tx) => { await payments.recordPaidInTx(tx, u.id, await payments.packFor(u, 'candidature'), 'crypto', '0xhist'); });
    await accounts.spend(u.id, 'unlock', 2);
    await accounts.refund(u.id, 'adapt');
    const h = await accounts.history(u.id);
    expect(h.credits).toBe(9);
    expect(h.items.map((m) => [m.reason, m.delta, m.balance])).toEqual([
      ['refund:adapt', 1, 9],
      ['unlock', -2, 8],
      ['purchase', 10, 10],
      ['structure', -1, 0],
      ['welcome', 1, 1],
    ]);
    expect(h.items[2]).toMatchObject({ amount: 1500, provider: 'crypto' });
    expect(h.items[0].amount).toBeNull();
    expect((await accounts.history(999_999)).items).toEqual([]);
  });
});
