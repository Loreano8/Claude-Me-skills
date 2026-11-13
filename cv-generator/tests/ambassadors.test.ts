import { describe, expect, it } from 'vitest';
import { createAccounts } from '../server/accounts.ts';
import { AMBASSADOR_RULES as R, createAmbassadors } from '../server/ambassadors.ts';
import { AMBASSADOR_CONTRACT_VERSION } from '../shared/ambassadorContract.ts';

/** Demande avec contrat signé (nom légal + signature identique). */
const form = (momoNumber = '+229 01 00 00 00 00', extra: Record<string, unknown> = {}) => ({
  firstName: 'Prénom', lastName: 'Nom', momoNumber, contractVersion: AMBASSADOR_CONTRACT_VERSION, accept: true, signature: 'Prénom Nom', signatureImage: `data:image/png;base64,${'A'.repeat(400)}`, ...extra,
});
import { createPayments, type PaymentProvider } from '../server/payments.ts';
import { testDb } from './pglite.ts';

const DAY = 86_400_000;

async function setup() {
  const db = await testDb();
  const clock = { t: Date.now() };
  const ambassadors = createAmbassadors(db, () => new Date(clock.t));
  const accounts = createAccounts(db, { freeCredits: 1, freeIpCooldownDays: 0 });
  let n = 0;
  const provider: PaymentProvider = {
    name: 'fake',
    createCheckout: async () => ({ ref: `tx-${++n}`, url: 'https://pay.example' }),
    fetchStatus: async () => 'approved' as never,
  };
  const payments = createPayments(db, accounts, provider, ambassadors);
  let seq = 0;
  const person = (code?: string, net?: string, device?: string) => {
    const i = ++seq;
    return accounts.register({ identifier: `p${i}@ex.com`, password: 'secret12', ip: net ?? `10.0.0.${i}`, device: device ?? `device-${i}-xxxxxxxx`, referralCode: code });
  };
  /** Un ambassadeur validé et son code. */
  const ambassador = async () => {
    const a = await person();
    const { code } = await accounts.referral(a.id);
    await ambassadors.apply(a.id, form('+229 01 00 00 00 00'));
    await ambassadors.setStatus(a.id, 'active');
    return { a, code };
  };
  const buy = async (userId: number, pack: string) => {
    const user = (await accounts.get(userId))!;
    await payments.checkout(user, pack, 'x');
    return payments.confirm(`tx-${n}`);
  };
  return { db, clock, ambassadors, accounts, person, ambassador, buy };
}

describe('programme Ambassadeur', () => {
  it('rien tant que l’ambassadeur n’est pas validé', async () => {
    const { accounts, ambassadors, person } = await setup();
    const a = await person();
    const { code } = await accounts.referral(a.id);
    await ambassadors.apply(a.id, form('0100000000'));
    const f = await person(code);
    expect(await ambassadors.onFirstCv(f.id)).toBe(0);
    expect((await ambassadors.summary(a.id)).status).toBe('pending');
  });

  it('prime d’inscription pour les 3 premiers filleuls seulement, une fois chacun', async () => {
    const { ambassadors, person, ambassador } = await setup();
    const { a, code } = await ambassador();
    const got: number[] = [];
    for (let i = 0; i < 5; i++) {
      const f = await person(code);
      got.push(await ambassadors.onFirstCv(f.id));
      expect(await ambassadors.onFirstCv(f.id)).toBe(0); // un second CV ne rapporte rien
    }
    expect(got).toEqual([R.signupReward, R.signupReward, R.signupReward, 0, 0]);
    const s = await ambassadors.summary(a.id);
    expect(s.stats).toMatchObject({ invited: 5, signupsRewarded: 3 });
    expect(s.earnings.pending).toBe(3 * R.signupReward);
  });

  it('même téléphone : rien du tout ; même connexion : pas de prime d’inscription, mais les achats comptent', async () => {
    const { ambassadors, person, ambassador, buy } = await setup();
    const { a, code } = await ambassador();
    const sameDevice = await person(code, '172.16.0.9', 'device-1-xxxxxxxx');
    expect(await ambassadors.onFirstCv(sameDevice.id)).toBe(0);
    await buy(sameDevice.id, 'essentiel');
    expect((await ambassadors.summary(a.id)).earnings.pending).toBe(0);
    // Même adresse internet (wifi d'école, données mobiles partagées) : vraie personne, autre téléphone.
    const sameNet = await person(code, '10.0.0.1');
    expect(await ambassadors.onFirstCv(sameNet.id)).toBe(0);
    await buy(sameNet.id, 'essentiel');
    expect((await ambassadors.summary(a.id)).earnings.pending).toBe(R.firstPurchaseReward + 50);
  });

  it('déduit les frais d’envoi Mobile Money du retrait', async () => {
    const { clock, ambassadors, person, ambassador, buy } = await setup();
    const { a, code } = await ambassador();
    for (let i = 0; i < 6; i++) await buy((await person(code)).id, 'pro'); // 6 × (100 + 300) = 2 400
    clock.t += (R.holdDays + 1) * DAY;
    const p = await ambassadors.requestPayout(a.id);
    expect(p).toMatchObject({ amount: 2400, fee: 24, net: 2376 });
    expect((await ambassadors.summary(a.id)).payouts[0]).toMatchObject({ amount: 2400, fee: 24, net: 2376 });
    const admin = await ambassadors.adminList();
    expect(admin.payouts[0]).toMatchObject({ net: 2376, status: 'requested' });
  });

  it('une demande refusée peut être refaite ; la triche annule les gains non versés', async () => {
    const { ambassadors, person, accounts, buy } = await setup();
    const a = await person();
    const { code } = await accounts.referral(a.id);
    await ambassadors.apply(a.id, form('0100000000'));
    await ambassadors.setStatus(a.id, 'refused');
    expect((await ambassadors.apply(a.id, form('0100000001'))).status).toBe('pending');
    await ambassadors.setStatus(a.id, 'active');
    await buy((await person(code)).id, 'essentiel');
    expect((await ambassadors.summary(a.id)).earnings.pending).toBe(150);
    await ambassadors.setStatus(a.id, 'suspended');
    await expect(ambassadors.requestPayout(a.id)).rejects.toMatchObject({ status: 403 });
    expect(await ambassadors.cancelUnpaid(a.id)).toBe(2);
    expect((await ambassadors.summary(a.id)).earnings.pending).toBe(0);
  });

  it('garde l’historique des gains si le filleul supprime son compte', async () => {
    const { db, ambassadors, person, ambassador, buy } = await setup();
    const { a, code } = await ambassador();
    const f = await person(code);
    await buy(f.id, 'essentiel');
    await db.query('delete from payments where user_id = $1', [f.id]);
    await db.query('delete from users where id = $1', [f.id]);
    expect((await ambassadors.summary(a.id)).earnings.pending).toBe(150);
  });

  it('prime au premier achat puis 10 % de chaque achat, et l’entreprise reste gagnante', async () => {
    const { ambassadors, person, ambassador, buy } = await setup();
    const { a, code } = await ambassador();
    const f = await person(code);
    await buy(f.id, 'essentiel'); // 500 FCFA
    await buy(f.id, 'candidature'); // 1 500 FCFA
    const s = await ambassadors.summary(a.id);
    expect(s.stats.buyers).toBe(1);
    expect(s.earnings.pending).toBe(R.firstPurchaseReward + 50 + 150);
    // Sur le pack à 500 : 100 + 50 = 150 FCFA reversés, bien moins que ce qu'il rapporte.
    expect(R.firstPurchaseReward + 500 * (R.commissionPercent / 100)).toBeLessThan(500 * 0.4);
  });

  it('arrête le pourcentage après 12 mois', async () => {
    const { clock, ambassadors, person, ambassador, buy } = await setup();
    const { a, code } = await ambassador();
    const f = await person(code);
    clock.t += 13 * 31 * DAY;
    await buy(f.id, 'essentiel');
    expect((await ambassadors.summary(a.id)).earnings.pending).toBe(R.firstPurchaseReward);
  });

  it('bloque les gains 14 jours, retrait dès 2 000 FCFA, puis payé ou refusé par l’administrateur', async () => {
    const { clock, ambassadors, person, ambassador, buy } = await setup();
    const { a, code } = await ambassador();
    for (let i = 0; i < 2; i++) {
      const f = await person(code);
      await buy(f.id, 'pro'); // 3 000 FCFA : 100 + 300
      await buy(f.id, 'pro'); // + 300
      await buy(f.id, 'pro'); // + 300
    }
    let s = await ambassadors.summary(a.id);
    expect(s.earnings).toMatchObject({ pending: 2000, available: 0 });
    await expect(ambassadors.requestPayout(a.id)).rejects.toMatchObject({ status: 400 });

    clock.t += (R.holdDays + 1) * DAY;
    s = await ambassadors.summary(a.id);
    expect(s.earnings).toMatchObject({ pending: 0, available: 2000 });
    const p = await ambassadors.requestPayout(a.id);
    expect(p.amount).toBe(2000);
    await expect(ambassadors.requestPayout(a.id)).rejects.toMatchObject({ status: 409 });

    await ambassadors.decidePayout(p.id, 'refused', 'numéro invalide');
    expect((await ambassadors.summary(a.id)).earnings.available).toBe(2000);
    const again = await ambassadors.requestPayout(a.id);
    await ambassadors.decidePayout(again.id, 'paid');
    s = await ambassadors.summary(a.id);
    expect(s.earnings).toMatchObject({ available: 0, requested: 0, paid: 2000 });
    await expect(ambassadors.decidePayout(again.id, 'paid')).rejects.toMatchObject({ status: 409 });
  });

  it('respecte le plafond mensuel', async () => {
    const { ambassadors, person, ambassador, buy } = await setup();
    const { a, code } = await ambassador();
    const f = await person(code);
    for (let i = 0; i < 90; i++) await buy(f.id, 'pro'); // 100 + 90 × 300 = 27 100 FCFA demandés
    expect((await ambassadors.summary(a.id)).earnings.pending).toBe(R.monthlyCap);
  });

  it('refuse un numéro Mobile Money vide', async () => {
    const { ambassadors, person } = await setup();
    const a = await person();
    await expect(ambassadors.apply(a.id, form('12'))).rejects.toMatchObject({ status: 400 });
  });
  it('exige le contrat signé avec le nom légal exact', async () => {
    const { ambassadors, person } = await setup();
    const a = await person();
    await expect(ambassadors.apply(a.id, form(undefined, { accept: false }))).rejects.toMatchObject({ status: 400 });
    await expect(ambassadors.apply(a.id, form(undefined, { contractVersion: 'ancienne' }))).rejects.toMatchObject({ status: 400 });
    await expect(ambassadors.apply(a.id, form(undefined, { signature: 'Quelqu’un d’autre' }))).rejects.toMatchObject({ status: 400 });
    await expect(ambassadors.apply(a.id, form(undefined, { lastName: 'N' }))).rejects.toMatchObject({ status: 400 });
    await expect(ambassadors.apply(a.id, form(undefined, { signatureImage: '' }))).rejects.toMatchObject({ status: 400 });
    await expect(ambassadors.apply(a.id, form(undefined, { signatureImage: 'data:text/html;base64,PHNjcmlwdD4=' }))).rejects.toMatchObject({ status: 400 });
    // Accents, majuscules et ordre « Nom Prénom » acceptés.
    const s = await ambassadors.apply(a.id, form(undefined, { signature: '  NOM   prenom ' }));
    expect(s).toMatchObject({ status: 'pending', legalFirstName: 'Prénom', legalLastName: 'Nom', momoName: 'Prénom Nom' });
    expect(s.contract).toMatchObject({ version: AMBASSADOR_CONTRACT_VERSION, current: true });
  });

  it('une fois validé, le numéro ne change que sur justificatifs, et pas de retrait pendant l’examen', async () => {
    const { clock, ambassadors, person, ambassador, buy } = await setup();
    const { a, code } = await ambassador();
    await expect(ambassadors.apply(a.id, form('+229 99 99 99 99 99'))).rejects.toMatchObject({ status: 409 });
    const doc = (name: string) => ({ name, mediaType: 'image/jpeg', data: 'aGVsbG8=' });
    await expect(ambassadors.requestNumberChange(a.id, { momoNumber: '+229 99 99 99 99 99', documents: [doc('cni.jpg')] })).rejects.toMatchObject({ status: 400 });
    for (let i = 0; i < 6; i++) await buy((await person(code)).id, 'pro');
    clock.t += (R.holdDays + 1) * DAY;
    const change = await ambassadors.requestNumberChange(a.id, { momoNumber: '+229 99 99 99 99 99', documents: [doc('cni.jpg'), doc('compte.jpg')] });
    await expect(ambassadors.requestPayout(a.id)).rejects.toMatchObject({ status: 409 });
    expect((await ambassadors.summary(a.id)).numberChange).toMatchObject({ status: 'requested', newNumber: '+22999999999 99'.replace(' ', '') });
    expect(await ambassadors.numberChangeDocuments(change.id)).toHaveLength(2);
    await ambassadors.decideNumberChange(change.id, true);
    expect(await ambassadors.numberChangeDocuments(change.id)).toHaveLength(0); // justificatifs effacés
    const s = await ambassadors.summary(a.id);
    expect(s.momoNumber).toBe('+22999999999' + '99');
    expect((await ambassadors.requestPayout(a.id)).amount).toBe(2400);
    expect((await ambassadors.adminList()).payouts[0]).toMatchObject({ momoNumber: '+2299999999999' });
  });
});
