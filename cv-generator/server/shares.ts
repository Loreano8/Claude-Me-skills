import { randomBytes } from 'node:crypto';
import type { Db } from './db.ts';

// CV partagés par lien ou QR code : la personne choisit de publier le PDF de son CV, accessible à qui a le lien.
// Le lien est long et aléatoire (impossible à deviner), expire au bout de 90 jours, et peut être arrêté à tout moment.

export const SHARE_DAYS = 90;
export const MAX_SHARE_BYTES = 3 * 1024 * 1024;
const MAX_SHARES_PER_USER = 10;

export class ShareError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 404 | 413 | 429,
  ) {
    super(message);
  }
}

export interface Share {
  token: string;
  name: string;
  expiresAt: string;
}

const isPdf = (b: Buffer) => b.subarray(0, 5).toString('latin1') === '%PDF-';

export function createShares(db: Db) {
  return {
    /** Publie (ou remplace) le PDF d'un CV de la personne ; renvoie le lien secret. */
    async publish(userId: number, cvKey: string, name: string, pdfBase64: string): Promise<Share> {
      const pdf = Buffer.from(pdfBase64, 'base64');
      if (!pdf.length || !isPdf(pdf)) throw new ShareError('Le fichier envoyé n’est pas un PDF.', 400);
      if (pdf.length > MAX_SHARE_BYTES) throw new ShareError('Ce CV est trop lourd pour être partagé (3 Mo maximum).', 413);
      const key = cvKey.slice(0, 64);
      const label = name.trim().slice(0, 80) || 'CV';
      return db.transaction(async (tx) => {
        const [existing] = await tx.query<{ token: string }>('select token from shared_cvs where user_id = $1 and cv_key = $2', [userId, key]);
        if (existing) {
          const [row] = await tx.query<{ expires_at: string }>(
            `update shared_cvs set pdf = $1, name = $2, created_at = now(), expires_at = now() + interval '${SHARE_DAYS} days' where token = $3 returning expires_at`,
            [pdf, label, existing.token],
          );
          return { token: existing.token, name: label, expiresAt: new Date(row.expires_at).toISOString() };
        }
        const [{ n }] = await tx.query<{ n: number }>('select count(*)::int as n from shared_cvs where user_id = $1 and expires_at > now()', [userId]);
        if (n >= MAX_SHARES_PER_USER) throw new ShareError(`Vous partagez déjà ${MAX_SHARES_PER_USER} CV : arrêtez le partage de l’un d’eux d’abord.`, 429);
        const token = randomBytes(18).toString('base64url');
        const [row] = await tx.query<{ expires_at: string }>(
          `insert into shared_cvs (token, user_id, cv_key, name, pdf, expires_at) values ($1, $2, $3, $4, $5, now() + interval '${SHARE_DAYS} days') returning expires_at`,
          [token, userId, key, label, pdf],
        );
        return { token, name: label, expiresAt: new Date(row.expires_at).toISOString() };
      });
    },

    /** Le partage en cours pour ce CV, s'il existe encore. */
    async current(userId: number, cvKey: string): Promise<Share | null> {
      const [row] = await db.query<{ token: string; name: string; expires_at: string }>(
        'select token, name, expires_at from shared_cvs where user_id = $1 and cv_key = $2 and expires_at > now()',
        [userId, cvKey.slice(0, 64)],
      );
      return row ? { token: row.token, name: row.name, expiresAt: new Date(row.expires_at).toISOString() } : null;
    },

    /** Arrête le partage : le lien ne marche plus. */
    async stop(userId: number, cvKey: string): Promise<void> {
      await db.query('delete from shared_cvs where user_id = $1 and cv_key = $2', [userId, cvKey.slice(0, 64)]);
    },

    /** Lecture publique par le lien. */
    async open(token: string): Promise<{ name: string; pdf: Buffer } | null> {
      if (!/^[A-Za-z0-9_-]{20,40}$/.test(token)) return null;
      const [row] = await db.query<{ name: string; pdf: Buffer | Uint8Array }>('select name, pdf from shared_cvs where token = $1 and expires_at > now()', [token]);
      return row ? { name: row.name, pdf: Buffer.from(row.pdf) } : null;
    },
  };
}

export type Shares = ReturnType<typeof createShares>;
