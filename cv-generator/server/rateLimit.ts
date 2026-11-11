import { createHash } from 'node:crypto';
import type { Db } from './db.ts';

export type RateLimiter = (key: string) => Promise<boolean>;

/** Limite par heure gardée en mémoire : remise à zéro au redémarrage (suffisant sans base, et pour les actions gratuites). */
export function memoryRateLimiter(limit: number): RateLimiter {
  const hits = new Map<string, number[]>();
  return async (key) => {
    const now = Date.now();
    const recent = (hits.get(key) ?? []).filter((t) => now - t < 3_600_000);
    if (recent.length >= limit) {
      hits.set(key, recent);
      return false;
    }
    recent.push(now);
    hits.set(key, recent);
    return true;
  };
}

/**
 * Limite par heure gardée en base : elle tient même quand le serveur redémarre ou tourne en plusieurs exemplaires.
 * La clé (adresse IP) n'est jamais stockée telle quelle, seulement son empreinte.
 */
export function dbRateLimiter(db: Db, bucket: string, limit: number): RateLimiter {
  const fallback = memoryRateLimiter(limit);
  return async (key) => {
    const hashed = createHash('sha256').update(key).digest('hex').slice(0, 32);
    try {
      const [row] = await db.query<{ n: number }>("select count(*)::int as n from rate_hits where bucket = $1 and key = $2 and at > now() - interval '1 hour'", [bucket, hashed]);
      if ((row?.n ?? 0) >= limit) return false;
      await db.query('insert into rate_hits (bucket, key) values ($1, $2)', [bucket, hashed]);
      // Ménage occasionnel des anciennes lignes.
      if (Math.random() < 0.02) await db.query("delete from rate_hits where at < now() - interval '2 hours'");
      return true;
    } catch (error) {
      console.error('Limite de tentatives', error);
      return fallback(key);
    }
  };
}
