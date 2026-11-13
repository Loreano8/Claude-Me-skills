import { describe, expect, it } from 'vitest';
import { createAccounts } from '../server/accounts.ts';
import { testDb } from './pglite.ts';

describe('codes de parrainage', () => {
  async function setup() {
    const accounts = createAccounts(await testDb(), { freeCredits: 1, freeIpCooldownDays: 0 });
    let i = 0;
    const person = (referralCode?: string) => {
      const n = ++i;
      return accounts.register({ identifier: `r${n}@ex.com`, password: 'secret12', ip: `10.1.0.${n}`, device: `device-${n}-xxxxxxxx`, referralCode });
    };
    return { accounts, person };
  }

  it('code facultatif à l’inscription, refusé s’il n’existe pas, insensible à la casse et aux espaces', async () => {
    const { accounts, person } = await setup();
    const a = await person();
    const { code } = await accounts.referral(a.id);
    expect((await person()).id).toBeTruthy(); // sans code
    await expect(person('INCONNU9')).rejects.toMatchObject({ status: 400 });
    await person(` ${code.toLowerCase().slice(0, 3)} ${code.toLowerCase().slice(3)} `);
    expect((await accounts.referral(a.id)).invited).toBe(1);
  });

  it('code personnalisé unique ; les anciens liens marchent toujours ; 3 changements au plus', async () => {
    const { accounts, person } = await setup();
    const a = await person();
    const b = await person();
    const first = (await accounts.referral(a.id)).code;
    expect(await accounts.setReferralCode(a.id, 'awa229')).toBe('AWA229');
    await expect(accounts.setReferralCode(b.id, 'AWA229')).rejects.toMatchObject({ status: 409 }); // déjà pris
    await expect(accounts.setReferralCode(b.id, first)).rejects.toMatchObject({ status: 409 }); // ancien code d'un autre
    await expect(accounts.setReferralCode(b.id, 'ab')).rejects.toMatchObject({ status: 400 });
    await expect(accounts.setReferralCode(b.id, 'CVCASA1')).rejects.toMatchObject({ status: 400 }); // réservé
    await person(first); // ancien lien
    await person('AWA229'); // nouveau code
    expect((await accounts.referral(a.id)).invited).toBe(2);
    await accounts.setReferralCode(a.id, 'AWACOTONOU');
    await accounts.setReferralCode(a.id, 'AWA2');
    await expect(accounts.setReferralCode(a.id, 'AWA3')).rejects.toMatchObject({ status: 409 });
    expect(await accounts.setReferralCode(a.id, 'AWA229')).toBe('AWA229'); // reprendre un ancien code reste possible
    await person('AWA2');
    expect((await accounts.referral(a.id)).invited).toBe(3);
  });
});
