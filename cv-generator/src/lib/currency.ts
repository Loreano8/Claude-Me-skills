import { useSyncExternalStore } from 'react';
import { CURRENCIES, SEED_RATES, currencyForTimeZone, formatMoney, isCurrency, packAmount, regionForTimeZone, type Currency, type Rates, type Region } from '../../shared/currency.ts';
import { LOCALE } from '../i18n.ts';
import { api } from './api.ts';

// Devise d'affichage du visiteur : devinée d'après le fuseau horaire de son appareil, puis celle qu'il choisit.
// Les cours du jour viennent du serveur (une fois par jour) ; en attendant, des cours de secours.

const KEY = 'cvcasa-devise';
const RATES_KEY = 'cvcasa-cours';
const DAY = 86_400_000;

function timeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  } catch {
    return '';
  }
}

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

/** Région du visiteur (exemples affichés : villes, photos). */
export const REGION: Region = regionForTimeZone(timeZone());

const saved = read<string>(KEY);
let state: { currency: Currency; rates: Rates } = {
  currency: isCurrency(saved) ? saved : currencyForTimeZone(timeZone()),
  rates: SEED_RATES,
};
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

const cached = read<{ rates: Rates; at: number }>(RATES_KEY);
if (cached?.rates && CURRENCIES.every((c) => cached.rates[c] > 0)) state = { ...state, rates: cached.rates };

let asked = false;
function loadRates() {
  if (asked) return;
  asked = true;
  if (cached && Date.now() - cached.at < DAY) return;
  api.rates().then(
    (r) => {
      const rates = r.rates as Rates;
      if (!CURRENCIES.every((c) => rates[c] > 0)) return;
      state = { ...state, rates };
      try {
        localStorage.setItem(RATES_KEY, JSON.stringify({ rates, at: Date.now() }));
      } catch {
        /* stockage indisponible : on garde les cours en mémoire */
      }
      emit();
    },
    () => {},
  );
}

export function setCurrency(currency: Currency) {
  state = { ...state, currency };
  try {
    localStorage.setItem(KEY, JSON.stringify(currency));
  } catch {
    /* stockage indisponible */
  }
  emit();
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  loadRates();
  return () => listeners.delete(l);
};

/** Devise choisie et prix des packs dans cette devise. */
export function useMoney() {
  const { currency, rates } = useSyncExternalStore(subscribe, () => state);
  const price = (pack: { id: string; price: number }) => {
    const { amount, exact } = packAmount(pack, currency, rates);
    return formatMoney(amount, currency, LOCALE, exact);
  };
  /** Prix d'un crédit du pack (toujours indicatif hors FCFA). */
  const perCredit = (pack: { id: string; price: number; credits: number }) => {
    const { amount } = packAmount(pack, currency, rates);
    const one = amount / pack.credits;
    const rounded = currency === 'XOF' || currency === 'XAF' || one >= 100 ? Math.round(one) : Math.round(one * 100) / 100;
    return formatMoney(rounded, currency, LOCALE, currency === 'XOF');
  };
  return {
    currency,
    setCurrency,
    price,
    perCredit,
    /** Le paiement Mobile Money se fait en FCFA d'Afrique de l'Ouest ; dans les autres devises, on paie en crypto. */
    mobileMoney: currency === 'XOF',
  };
}
