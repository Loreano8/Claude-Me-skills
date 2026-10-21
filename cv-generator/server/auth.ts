import { createHmac, randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCb) as (password: string, salt: Buffer, keylen: number) => Promise<Buffer>;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algo, salt, hash] = stored.split('$');
  if (algo !== 'scrypt' || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'base64');
  const actual = await scrypt(password, Buffer.from(salt, 'base64'), expected.length);
  return timingSafeEqual(actual, expected);
}

const b64url = (data: Buffer | string) => Buffer.from(data).toString('base64url');

/**
 * Jeton de session signé (HMAC), envoyé par le client dans l'en-tête Authorization.
 * Fonctionne pareil pour le site et pour l'application Android (pas de cookie).
 */
export function signToken(userId: number, secret: string, ttlDays = 90): string {
  const payload = b64url(JSON.stringify({ uid: userId, exp: Date.now() + ttlDays * 86_400_000 }));
  const sig = b64url(createHmac('sha256', secret).update(payload).digest());
  return `${payload}.${sig}`;
}

export function verifyToken(token: string, secret: string): number | null {
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  const expected = createHmac('sha256', secret).update(payload).digest();
  const given = Buffer.from(sig, 'base64url');
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const { uid, exp } = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return typeof uid === 'number' && typeof exp === 'number' && exp > Date.now() ? uid : null;
  } catch {
    return null;
  }
}

/** E-mail en minuscules, ou numéro de téléphone réduit à ses chiffres (avec le + initial). */
export function normalizeIdentifier(raw: string): string | null {
  const value = raw.trim();
  if (value.includes('@')) {
    const email = value.toLowerCase();
    return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ? email : null;
  }
  const phone = value.replace(/[\s.\-()]/g, '');
  return /^\+?\d{8,15}$/.test(phone) ? phone : null;
}
