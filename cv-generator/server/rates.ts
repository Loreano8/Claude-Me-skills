import type { Db } from './db.ts';
import { CURRENCIES, SEED_RATES, type Rates } from '../shared/currency.ts';

// Cours des devises (pour afficher un prix indicatif en euros, livres, nairas…). Lus une fois par jour auprès d'un
// service public, gardés dans la base ; en cas de panne, on garde les derniers cours connus, puis les cours de secours.

const SOURCE = 'https://open.er-api.com/v6/latest/USD';
const DAY = 86_400_000;

export function createRates(db: Db, fetchImpl: typeof fetch = fetch, now: () => Date = () => new Date()) {
  let memo: { rates: Rates; at: number } | null = null;

  async function stored(): Promise<{ rates: Rates; at: number } | null> {
    const [row] = await db.query<{ value: string }>(`select value from app_flags where key = 'fx'`).catch(() => []);
    if (!row) return null;
    try {
      const v = JSON.parse(row.value) as { rates: Rates; at: number };
      return CURRENCIES.every((c) => v.rates[c] > 0) ? v : null;
    } catch {
      return null;
    }
  }

  async function refresh(): Promise<{ rates: Rates; at: number } | null> {
    try {
      const res = await fetchImpl(SOURCE);
      const data = (await res.json()) as { result?: string; rates?: Record<string, number> };
      if (!res.ok || data.result !== 'success' || !data.rates) return null;
      const rates = { ...SEED_RATES };
      for (const c of CURRENCIES) if (data.rates[c] > 0) rates[c] = data.rates[c];
      const fresh = { rates, at: now().getTime() };
      await db.query(`insert into app_flags (key, value) values ('fx', $1) on conflict (key) do update set value = excluded.value`, [JSON.stringify(fresh)]);
      return fresh;
    } catch (error) {
      console.error('Cours des devises', error);
      return null;
    }
  }

  return {
    async get(): Promise<{ rates: Rates; at: string | null }> {
      const t = now().getTime();
      if (!memo || t - memo.at > DAY) memo = (await stored()) ?? memo;
      if (!memo || t - memo.at > DAY) memo = (await refresh()) ?? memo;
      return memo ? { rates: memo.rates, at: new Date(memo.at).toISOString() } : { rates: SEED_RATES, at: null };
    },
  };
}

export type RatesService = ReturnType<typeof createRates>;
