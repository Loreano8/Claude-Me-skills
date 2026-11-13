import { describe, expect, it } from 'vitest';
import { createAccounts } from '../server/accounts.ts';
import { AMBASSADOR_RULES as R, createAmbassadors } from '../server/ambassadors.ts';
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
    await ambassadors.apply(a.id, { momoNumber: '+229 01 00 00 00 00', momoName: 'Titulaire' });
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
    await ambassadors.apply(a.id, { momoNumber: '0100000000', momoName: 'Titulaire' });
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

  it('ne paie rien pour un filleul sur le même téléphone ou la même connexion', async () => {
    const { ambassadors, person, ambassador } = await setup();
    const { a, code } = await ambassador();
    const sameNet = await person(code, '10.0.0.1');
    const sameDevice = await person(code, '172.16.0.9', 'device-1-xxxxxxxx');
    expect(await ambassadors.onFirstCv(sameNet.id)).toBe(0);
    expect(await ambassadors.onFirstCv(sameDevice.id)).toBe(0);
    expect((await ambassadors.summary(a.id)).earnings.pending).toBe(0);
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
    await expect(ambassadors.apply(a.id, { momoNumber: '12', momoName: 'X Y' })).rejects.toMatchObject({ status: 400 });
  });
});
