// Devises d'affichage. Deux prix sont réels : le prix en FCFA (payé par Mobile Money) et le prix en dollars
// (payé en crypto, 1 USDT ou USDC = 1 $). Les autres devises sont une conversion indicative du prix en dollars.

export const CURRENCIES = ['XOF', 'USD', 'EUR', 'GBP', 'CAD', 'CHF', 'XAF', 'NGN', 'GHS', 'MAD', 'KES', 'ZAR'] as const;
export type Currency = (typeof CURRENCIES)[number];

/** Prix en dollars de chaque pack (aussi le montant à envoyer en crypto). */
export const USD_PRICES: Record<string, number> = { essentiel: 1, retour: 1, candidature: 3, pro: 5 };

/** Cours de secours (unités pour 1 $), utilisés tant que le serveur n'a pas donné les cours du jour. */
export const SEED_RATES: Record<Currency, number> = {
  XOF: 594.28,
  USD: 1,
  EUR: 0.906,
  GBP: 0.7564,
  CAD: 1.4259,
  CHF: 0.8384,
  XAF: 594.28,
  NGN: 1352.07,
  GHS: 11.7475,
  MAD: 9.8825,
  KES: 129.99,
  ZAR: 16.92,
};

export type Rates = Record<Currency, number>;
export const isCurrency = (x: unknown): x is Currency => typeof x === 'string' && (CURRENCIES as readonly string[]).includes(x);

/** Grande région du visiteur : elle choisit les exemples affichés (villes, photos), pas les prix. */
export type Region = 'afrique' | 'europe' | 'amerique' | 'monde';

// Fuseau horaire → devise. Les fuseaux d'Afrique de l'Ouest francophone donnent le FCFA ; « Africa/Lagos » aussi,
// car beaucoup de téléphones au Bénin et au Niger annoncent ce fuseau.
const TZ_CURRENCY: Record<string, Currency> = {
  'Africa/Porto-Novo': 'XOF', 'Africa/Lome': 'XOF', 'Africa/Abidjan': 'XOF', 'Africa/Dakar': 'XOF', 'Africa/Niamey': 'XOF', 'Africa/Ouagadougou': 'XOF', 'Africa/Bamako': 'XOF', 'Africa/Bissau': 'XOF', 'Africa/Lagos': 'XOF',
  'Africa/Douala': 'XAF', 'Africa/Libreville': 'XAF', 'Africa/Brazzaville': 'XAF', 'Africa/Ndjamena': 'XAF', 'Africa/Bangui': 'XAF', 'Africa/Malabo': 'XAF',
  'Africa/Accra': 'GHS', 'Africa/Nairobi': 'KES', 'Africa/Casablanca': 'MAD', 'Africa/El_Aaiun': 'MAD', 'Africa/Johannesburg': 'ZAR',
  'Europe/London': 'GBP', 'Europe/Belfast': 'GBP', 'Europe/Jersey': 'GBP', 'Europe/Guernsey': 'GBP', 'Europe/Isle_of_Man': 'GBP',
  'Europe/Zurich': 'CHF', 'Europe/Vaduz': 'CHF',
  'America/Toronto': 'CAD', 'America/Montreal': 'CAD', 'America/Vancouver': 'CAD', 'America/Edmonton': 'CAD', 'America/Winnipeg': 'CAD', 'America/Halifax': 'CAD', 'America/Regina': 'CAD', 'America/St_Johns': 'CAD', 'America/Moncton': 'CAD',
};

export function regionForTimeZone(tz: string): Region {
  if (tz.startsWith('Africa/') || tz.startsWith('Indian/')) return 'afrique';
  if (tz.startsWith('Europe/') || tz === 'Atlantic/Reykjavik' || tz === 'Atlantic/Canary' || tz === 'Atlantic/Madeira') return 'europe';
  if (tz.startsWith('America/') || tz.startsWith('US/') || tz.startsWith('Canada/') || tz === 'Pacific/Honolulu') return 'amerique';
  return 'monde';
}

export function currencyForTimeZone(tz: string): Currency {
  const exact = TZ_CURRENCY[tz];
  if (exact) return exact;
  const region = regionForTimeZone(tz);
  return region === 'europe' ? 'EUR' : 'USD';
}

/** Montant arrondi comme on l'afficherait sur une étiquette : pas de centimes au-delà de 100, dizaines au-delà de 1 000. */
export function roundAmount(value: number): number {
  if (value >= 1000) return Math.round(value / 10) * 10;
  if (value >= 100) return Math.round(value);
  if (value >= 10) return Math.round(value * 10) / 10;
  return Math.round(value * 100) / 100;
}

/**
 * Prix d'un pack dans la devise choisie. `exact` est faux pour une conversion indicative (à afficher avec « ≈ »).
 * En FCFA d'Afrique de l'Ouest on donne le vrai prix Mobile Money ; ailleurs, le prix en dollars converti.
 */
export function packAmount(pack: { id: string; price: number }, currency: Currency, rates: Rates): { amount: number; exact: boolean } {
  if (currency === 'XOF') return { amount: pack.price, exact: true };
  const usd = USD_PRICES[pack.id];
  if (!usd) return { amount: roundAmount((pack.price / rates.XOF) * rates[currency]), exact: false };
  if (currency === 'USD') return { amount: usd, exact: true };
  return { amount: roundAmount(usd * rates[currency]), exact: false };
}

/** « 500 FCFA », « 3 $ », « ≈ 2,72 € ». */
export function formatMoney(amount: number, currency: Currency, locale: string, exact = true): string {
  let text: string;
  if (currency === 'XOF' || currency === 'XAF') text = `${amount.toLocaleString(locale, { maximumFractionDigits: 0 })} FCFA`;
  else {
    const digits = Number.isInteger(amount) ? 0 : amount >= 10 ? 1 : 2;
    text = new Intl.NumberFormat(locale, { style: 'currency', currency, currencyDisplay: 'narrowSymbol', minimumFractionDigits: digits, maximumFractionDigits: digits }).format(amount);
  }
  return exact ? text : `≈ ${text}`;
}
