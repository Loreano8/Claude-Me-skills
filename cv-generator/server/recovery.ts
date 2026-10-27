import { randomInt } from 'node:crypto';
import { z } from 'zod';
import type { Db } from './db.ts';
import { AccountError, type Accounts } from './accounts.ts';
import { hashPassword, normalizeIdentifier, verifyPassword } from './auth.ts';
import type { Support, SupportIdentity } from './support.ts';

// Récupération de compte sans e-mail : la personne définit à l'avance une phrase secrète ; le jour où elle
// oublie son mot de passe, elle remplit un formulaire. Le serveur compare aussitôt ses réponses avec le compte
// (prénom, phrase secrète, dernier achat, crédits) et range la demande pour l'administrateur, qui valide d'un
// toucher : un mot de passe provisoire part alors dans la conversation « Nous contacter » de la personne.

/** Phrase secrète comparée sans tenir compte des majuscules, accents ni espaces en trop. */
export const normalizePhrase = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

export const RecoveryInput = z.object({
  identifier: z.string().trim().min(3).max(120),
  name: z.string().trim().max(80).default(''),
  phrase: z.string().max(200).default(''),
  /** Montant du dernier achat : 'none' (jamais acheté), un prix en FCFA, ou 'unknown'. */
  lastPurchase: z.string().max(20).default('unknown'),
  credits: z.number().int().min(0).max(10_000).nullable().default(null),
  note: z.string().trim().max(500).default(''),
});
export type RecoveryInput = z.output<typeof RecoveryInput>;

export type Check = 'ok' | 'wrong' | 'unknown' | 'not_set';
export interface RecoveryChecks {
  account: boolean;
  name: Check;
  phrase: Check;
  purchase: Check;
  credits: Check;
}

export interface RecoveryRequest {
  id: number;
  identifier: string;
  status: 'pending' | 'approved' | 'refused';
  given: { name: string; lastPurchase: string; credits: number | null; note: string };
  /** Ce que le compte contient réellement (prénom, dernier achat, crédits), pour comparer d'un coup d'œil. */
  actual: { name: string; lastPurchase: number | null; credits: number } | null;
  checks: RecoveryChecks;
  createdAt: string;
}

const tempPassword = () => Array.from({ length: 10 }, () => 'abcdefghjkmnpqrstuvwxyz23456789'[randomInt(31)]).join('');

export function createRecovery(db: Db, accounts: Accounts, support: Support) {
  async function lastPurchase(userId: number): Promise<number | null> {
    const [row] = await db.query<{ amount: number }>(
      `select amount from payments where user_id = $1 and status = 'approved' order by created_at desc limit 1`,
      [userId],
    );
    return row?.amount ?? null;
  }

  return {
    /** Phrase secrète (un mot suffit), ou réponse à une question secrète choisie par la personne. */
    async setSecret(userId: number, answer: string, question: string | null = null): Promise<void> {
      const clean = normalizePhrase(answer);
      if (clean.length < 2) throw new AccountError('Écrivez au moins un mot.', 400);
      const q = question?.trim().slice(0, 150) || null;
      await db.query('update users set secret_phrase_hash = $2, secret_question = $3 where id = $1', [userId, await hashPassword(clean), q]);
    },

    async secretStatus(userId: number): Promise<{ set: boolean; question: string | null }> {
      const [row] = await db.query<{ set: boolean; question: string | null }>(
        'select secret_phrase_hash is not null as set, secret_question as question from users where id = $1',
        [userId],
      );
      return { set: row?.set ?? false, question: row?.question ?? null };
    },

    /** Question secrète à afficher dans le formulaire « mot de passe oublié » (null si le compte n'en a pas). */
    async questionFor(rawIdentifier: string): Promise<string | null> {
      const identifier = normalizeIdentifier(rawIdentifier);
      if (!identifier) return null;
      const [row] = await db.query<{ question: string | null }>('select secret_question as question from users where identifier = $1', [identifier]);
      return row?.question ?? null;
    },

    /** Formulaire « mot de passe oublié » : vérifications automatiques, puis demande rangée pour l'administrateur. */
    async request(who: SupportIdentity, input: RecoveryInput): Promise<{ secret?: string }> {
      const identifier = normalizeIdentifier(input.identifier) ?? input.identifier.trim().toLowerCase();
      const [user] = await db.query<{ id: number; name: string; credits: number; secret_phrase_hash: string | null }>(
        'select id, name, credits, secret_phrase_hash from users where identifier = $1',
        [identifier],
      );
      let checks: RecoveryChecks = { account: false, name: 'unknown', phrase: 'unknown', purchase: 'unknown', credits: 'unknown' };
      if (user) {
        const paid = await lastPurchase(user.id);
        checks = {
          account: true,
          name: !user.name ? 'not_set' : !input.name ? 'unknown' : normalizePhrase(input.name) === normalizePhrase(user.name) ? 'ok' : 'wrong',
          phrase: !user.secret_phrase_hash
            ? 'not_set'
            : !input.phrase.trim()
              ? 'unknown'
              : (await verifyPassword(normalizePhrase(input.phrase), user.secret_phrase_hash))
                ? 'ok'
                : 'wrong',
          purchase:
            input.lastPurchase === 'unknown'
              ? 'unknown'
              : input.lastPurchase === 'none'
                ? paid === null
                  ? 'ok'
                  : 'wrong'
                : paid === Number(input.lastPurchase)
                  ? 'ok'
                  : 'wrong',
          credits: input.credits === null ? 'unknown' : Math.abs(input.credits - user.credits) <= 2 ? 'ok' : 'wrong',
        };
      }
      // Message dans « Nous contacter » : la personne voit sa demande, et la réponse y arrivera.
      const posted = await support.post(who, {
        body: `Demande de récupération de compte pour ${identifier}.${input.note ? `\n\n${input.note}` : ''}\n\n(Réponses vérifiées automatiquement ; la phrase secrète n’est jamais affichée.)`,
        name: input.name,
        contact: identifier,
      });
      await db.query(
        `insert into recovery_requests (user_id, identifier, thread_id, given, checks) values ($1, $2, $3, $4, $5)`,
        [
          user?.id ?? null,
          identifier,
          posted.threadId,
          JSON.stringify({ name: input.name, lastPurchase: input.lastPurchase, credits: input.credits, note: input.note }),
          JSON.stringify(checks),
        ],
      );
      return posted.secret ? { secret: posted.secret } : {};
    },

    async adminList(): Promise<RecoveryRequest[]> {
      const rows = await db.query<{
        id: number;
        identifier: string;
        status: RecoveryRequest['status'];
        given: RecoveryRequest['given'] | string;
        checks: RecoveryChecks | string;
        created_at: string;
        user_id: number | null;
        name: string | null;
        credits: number | null;
      }>(
        `select r.id, r.identifier, r.status, r.given, r.checks, r.created_at, r.user_id, u.name, u.credits
         from recovery_requests r left join users u on u.id = r.user_id
         order by (r.status = 'pending') desc, r.created_at desc limit 100`,
      );
      const parse = <T>(v: T | string): T => (typeof v === 'string' ? (JSON.parse(v) as T) : v);
      return Promise.all(
        rows.map(async (r) => ({
          id: r.id,
          identifier: r.identifier,
          status: r.status,
          given: parse(r.given),
          checks: parse(r.checks),
          actual: r.user_id ? { name: r.name ?? '', credits: r.credits ?? 0, lastPurchase: await lastPurchase(r.user_id) } : null,
          createdAt: r.created_at,
        })),
      );
    },

    /** Décision de l'administrateur ; la réponse part dans la conversation « Nous contacter » de la personne. */
    async decide(id: number, approve: boolean): Promise<{ password?: string }> {
      const [req] = await db.query<{ user_id: number | null; thread_id: number | null; status: string }>(
        'select user_id, thread_id, status from recovery_requests where id = $1',
        [id],
      );
      if (!req) throw new AccountError('Demande introuvable.', 404);
      if (req.status !== 'pending') throw new AccountError('Cette demande a déjà été traitée.', 409);
      if (approve && !req.user_id) throw new AccountError('Aucun compte ne correspond à cette demande.', 400);
      let password: string | undefined;
      let message: string;
      if (approve) {
        password = tempPassword();
        await accounts.setPassword(req.user_id!, password);
        message =
          `Votre identité est vérifiée. Voici votre mot de passe provisoire : ${password}\n\n` +
          'Connectez-vous avec, puis changez-le dans « Mes crédits » → « Changer mon mot de passe ».';
      } else {
        message =
          'Nous n’avons pas pu vérifier que ce compte vous appartient : les informations ne correspondent pas. ' +
          'Répondez-nous ici avec d’autres détails (date et montant de vos achats, prénom du compte…) et nous regarderons à nouveau.';
      }
      await db.query(`update recovery_requests set status = $2, decided_at = now() where id = $1`, [id, approve ? 'approved' : 'refused']);
      if (req.thread_id) await support.adminReply(req.thread_id, message);
      return password ? { password } : {};
    },
  };
}

export type Recovery = ReturnType<typeof createRecovery>;
