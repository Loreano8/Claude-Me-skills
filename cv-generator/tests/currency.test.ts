import { describe, expect, it } from 'vitest';
import { SEED_RATES, currencyForTimeZone, formatMoney, packAmount, regionForTimeZone, roundAmount } from '../shared/currency.ts';
import { createRates } from '../server/rates.ts';
import { testDb } from './pglite.ts';

const pack = (id: string, price: number) => ({ id, price });

describe('devises d’affichage', () => {
  it('devine la devise et la région d’après le fuseau horaire', () => {
    expect(currencyForTimeZone('Africa/Porto-Novo')).toBe('XOF');
    expect(currencyForTimeZone('Africa/Lagos')).toBe('XOF');
    expect(currencyForTimeZone('Africa/Douala')).toBe('XAF');
    expect(currencyForTimeZone('Europe/Paris')).toBe('EUR');
    expect(currencyForTimeZone('Europe/London')).toBe('GBP');
    expect(currencyForTimeZone('America/New_York')).toBe('USD');
    expect(currencyForTimeZone('America/Toronto')).toBe('CAD');
    expect(currencyForTimeZone('Asia/Tokyo')).toBe('USD');
    expect(currencyForTimeZone('')).toBe('USD');
    expect([regionForTimeZone('Africa/Dakar'), regionForTimeZone('Europe/Brussels'), regionForTimeZone('America/Chicago'), regionForTimeZone('Asia/Dubai')]).toEqual(['afrique', 'europe', 'amerique', 'monde']);
  });

  it('donne le vrai prix en FCFA et en dollars, une conversion indicative ailleurs', () => {
    expect(packAmount(pack('essentiel', 500), 'XOF', SEED_RATES)).toEqual({ amount: 500, exact: true });
    expect(packAmount(pack('candidature', 1500), 'USD', SEED_RATES)).toEqual({ amount: 3, exact: true });
    expect(packAmount(pack('pro', 3000), 'EUR', SEED_RATES)).toEqual({ amount: 4.53, exact: false });
    // FCFA d'Afrique centrale : pas de Mobile Money, donc le prix en dollars converti (pas 500).
    expect(packAmount(pack('essentiel', 500), 'XAF', SEED_RATES)).toEqual({ amount: 594, exact: false });
    expect(packAmount(pack('pro', 3000), 'NGN', SEED_RATES)).toEqual({ amount: 6760, exact: false });
    expect([roundAmount(0.906), roundAmount(11.7475), roundAmount(129.99), roundAmount(1352.07)]).toEqual([0.91, 11.7, 130, 1350]);
  });

  it('écrit les montants lisiblement', () => {
    expect(formatMoney(1500, 'XOF', 'fr-FR').replace(/\s/g, ' ')).toBe('1 500 FCFA');
    expect(formatMoney(3, 'USD', 'en-GB')).toBe('$3');
    expect(formatMoney(2.72, 'EUR', 'fr-FR', false).replace(/\s/g, ' ')).toBe('≈ 2,72 €');
    expect(formatMoney(0, 'EUR', 'fr-FR').replace(/\s/g, ' ')).toBe('0 €');
  });
});

describe('cours des devises', () => {
  it('lit les cours une fois par jour, les garde, et résiste à une panne', async () => {
    const db = await testDb();
    const clock = { t: Date.parse('2026-11-16T08:00:00Z') };
    let calls = 0;
    let fail = false;
    const fake = (async () => {
      calls++;
      if (fail) throw new Error('panne');
      return new Response(JSON.stringify({ result: 'success', rates: { XOF: 600, EUR: 0.9, USD: 1 } }));
    }) as unknown as typeof fetch;
    const rates = createRates(db, fake, () => new Date(clock.t));
    const first = await rates.get();
    expect(first.rates).toMatchObject({ XOF: 600, EUR: 0.9, GBP: SEED_RATES.GBP });
    expect(first.at).toBe('2026-11-16T08:00:00.000Z');
    await rates.get();
    expect(calls).toBe(1);
    // Un autre serveur (nouvelle instance) relit les cours gardés dans la base, sans rappeler le service.
    expect((await createRates(db, fake, () => new Date(clock.t)).get()).rates.XOF).toBe(600);
    expect(calls).toBe(1);
    // Le lendemain, le service est en panne : on garde les derniers cours connus.
    clock.t += 25 * 3_600_000;
    fail = true;
    expect((await rates.get()).rates.XOF).toBe(600);
    // Sans rien du tout : cours de secours.
    const empty = createRates(await testDb(), fake, () => new Date(clock.t));
    expect(await empty.get()).toEqual({ rates: SEED_RATES, at: null });
  });
});

describe('devise et région par pays', () => {
  it('donne la devise et la région du pays du visiteur', async () => {
    const { currencyForCountry, regionForCountry, isCountry } = await import('../shared/currency.ts');
    expect(['BJ', 'TG', 'SN', 'CI', 'NE'].map(currencyForCountry)).toEqual(['XOF', 'XOF', 'XOF', 'XOF', 'XOF']);
    expect(['NG', 'GH', 'CM', 'FR', 'BE', 'GB', 'US', 'CA', 'JP', 'CD'].map(currencyForCountry)).toEqual(['NGN', 'GHS', 'XAF', 'EUR', 'EUR', 'GBP', 'USD', 'CAD', 'USD', 'USD']);
    expect(['BJ', 'NG', 'FR', 'GB', 'US', 'BR', 'JP'].map(regionForCountry)).toEqual(['afrique', 'afrique', 'europe', 'europe', 'amerique', 'amerique', 'monde']);
    expect([isCountry('BJ'), isCountry('XX'), isCountry('T1'), isCountry('bj'), isCountry(undefined)]).toEqual([true, false, false, false, false]);
  });
});
