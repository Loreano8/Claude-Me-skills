import { useSyncExternalStore } from 'react';
import { Capacitor } from '@capacitor/core';
import { CURRENCIES, SEED_RATES, currencyForCountry, currencyForTimeZone, formatMoney, isCountry, isCurrency, packAmount, regionForCountry, regionForTimeZone, type Currency, type Rates, type Region } from '../../shared/currency.ts';
import { LOCALE } from '../i18n.ts';
import { api } from './api.ts';

// Devise d'affichage du visiteur : celle de son pays, ou celle qu'il choisit pour la visite en cours.
// Son choix n'est gardé que jusqu'à la fermeture de la page : à la visite suivante, on repart de la devise du pays.
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

// Pays du visiteur : donné par le réseau devant le site (Cloudflare), retenu une semaine sur l'appareil.
// Tant qu'on ne le connaît pas (toute première visite, hors ligne), on se rabat sur le fuseau horaire.
const COUNTRY_KEY = 'cvcasa-pays';
const TRACE_URL = 'https://cvcasa.com/cdn-cgi/trace';
const WEEK = 7 * 86_400_000;
const known = read<{ country: string; at: number }>(COUNTRY_KEY);
const country = known && isCountry(known.country) ? known.country : null;

// Sur le site, le choix de devise vaut pour la visite en cours (oublié à la fermeture de la page).
// Dans l'application, Android ferme souvent l'appli en arrière-plan : le choix y est gardé 30 jours,
// et oublié plus tôt si la personne change de pays.
const NATIVE = Capacitor.isNativePlatform();
const KEEP_MS = 30 * 86_400_000;

function readSession(key: string): string | null {
  try {
    if (!NATIVE) return sessionStorage.getItem(key);
    const kept = read<{ currency: string; at: number; country: string | null }>(key);
    if (!kept || Date.now() - kept.at > KEEP_MS) return null;
    return kept.country && country && kept.country !== country ? null : kept.currency;
  } catch {
    return null;
  }
}

/** Pays du visiteur (code à 2 lettres) quand le réseau l'a donné, sinon null. */
export const COUNTRY: string | null = country;

/** Région du visiteur (exemples affichés : villes, photos). Fixée au chargement de la page. */
export const REGION: Region = country ? regionForCountry(country) : regionForTimeZone(timeZone());

const saved = readSession(KEY);
const chosen = isCurrency(saved);
let state: { currency: Currency; rates: Rates } = {
  currency: chosen ? (saved as Currency) : country ? currencyForCountry(country) : currencyForTimeZone(timeZone()),
  rates: SEED_RATES,
};

/** Demande le pays au réseau (rien d'autre n'est lu ni gardé) et ajuste la devise si le visiteur n'a rien choisi. */
function loadCountry() {
  if (known && isCountry(known.country) && Date.now() - known.at < WEEK) return;
  fetch(TRACE_URL)
    .then((r) => (r.ok ? r.text() : ''))
    .then((text) => {
      const loc = /^loc=([A-Z]{2})$/m.exec(text)?.[1];
      if (!isCountry(loc)) return;
      try {
        localStorage.setItem(COUNTRY_KEY, JSON.stringify({ country: loc, at: Date.now() }));
      } catch {
        /* stockage indisponible */
      }
      const kept = NATIVE ? read<{ country: string | null }>(KEY) : null;
      const moved = !!kept?.country && kept.country !== loc;
      if ((moved || !readSession(KEY)) && state.currency !== currencyForCountry(loc)) {
        state = { ...state, currency: currencyForCountry(loc) };
        emit();
      }
    })
    .catch(() => {});
}
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

const cached = read<{ rates: Rates; at: number }>(RATES_KEY);
if (cached?.rates && CURRENCIES.every((c) => cached.rates[c] > 0)) state = { ...state, rates: cached.rates };

let asked = false;
function loadRates() {
  if (asked) return;
  asked = true;
  loadCountry();
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
    if (NATIVE) localStorage.setItem(KEY, JSON.stringify({ currency, at: Date.now(), country: read<{ country: string }>(COUNTRY_KEY)?.country ?? country }));
    else sessionStorage.setItem(KEY, currency);
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
