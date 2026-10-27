import type { Db } from './db.ts';
import { randomInt } from 'node:crypto';
import { hashPassword, normalizeIdentifier, verifyPassword } from './auth.ts';

/** Crédits offerts au parrain et au filleul quand le filleul fait son premier achat. */
export const REFERRAL_BONUS = 1;
/** Prix de la version Pro d'un CV. 2 crédits : le crédit offert à l'inscription ne suffit pas, il faut recharger. */
export const UNLOCK_COST = 2;
/** Dossier ou scan au-delà de la limite gratuite (2 pages scannées, ou 2 pièces en plus du CV et de la lettre). */
export const DOSSIER_COST = 1;

// Sans 0/O ni 1/I/L : un code se lit et se dicte sans confusion.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const newReferralCode = () => Array.from({ length: 6 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join('');

export interface ReferralInfo {
  code: string;
  /** Amis inscrits avec ce code. */
  invited: number;
  /** Amis qui ont fait leur premier achat (récompense versée). */
  rewarded: number;
}

export interface User {
  id: number;
  identifier: string;
  name: string;
  credits: number;
}

export class AccountError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export interface AccountOptions {
  /** Crédits offerts à l'inscription. */
  freeCredits: number;
  /**
   * Anti-abus : le crédit offert n'est donné qu'une seule fois par appareil, et une seule fois
   * par connexion internet (adresse IP) pendant ce nombre de jours.
   */
  freeIpCooldownDays: number;
}

const USER_COLUMNS = 'id, identifier, name, credits';

export function createAccounts(db: Db, opts: AccountOptions) {
  async function addCredits(tx: Db, userId: number, delta: number, reason: string, ref = ''): Promise<number> {
    const [row] = await tx.query<{ credits: number }>(
      'update users set credits = credits + $2 where id = $1 and credits + $2 >= 0 returning credits',
      [userId, delta],
    );
    if (!row) throw new AccountError('Crédits insuffisants.', 402);
    await tx.query('insert into credit_ledger (user_id, delta, reason, ref) values ($1, $2, $3, $4)', [userId, delta, reason, ref]);
    return row.credits;
  }

  return {
    /** Petite requête à la base : la garde active (Supabase gratuit met en pause un projet inactif). */
    async ping(): Promise<boolean> {
      await db.query('select 1');
      return true;
    },

    async register(input: { identifier: string; password: string; name?: string; ip: string; device: string; referralCode?: string }): Promise<User> {
      const identifier = normalizeIdentifier(input.identifier);
      if (!identifier) throw new AccountError('Indiquez un e-mail ou un numéro de téléphone valide.', 400);
      if (input.password.length < 6) throw new AccountError('Le mot de passe doit faire au moins 6 caractères.', 400);
      const passwordHash = await hashPassword(input.password);
      return db.transaction(async (tx) => {
        const [existing] = await tx.query('select id from users where identifier = $1', [identifier]);
        if (existing) throw new AccountError('Un compte existe déjà avec cet identifiant. Connectez-vous.', 409);
        const device = input.device.trim().slice(0, 100);
        const [{ n }] = await tx.query<{ n: number }>(
          `select count(*)::int as n from credit_ledger l join users u on u.id = l.user_id
           where l.reason = 'welcome'
             and (u.signup_device = $1 or (u.signup_ip = $2 and l.created_at > now() - make_interval(days => $3)))`,
          [device, input.ip, opts.freeIpCooldownDays],
        );
        const code = (input.referralCode ?? '').trim().toUpperCase();
        const [referrer] = code ? await tx.query<{ id: number }>('select id from users where referral_code = $1', [code]) : [];
        const [user] = await tx.query<User>(
          `insert into users (identifier, name, password_hash, signup_ip, signup_device, referred_by) values ($1, $2, $3, $4, $5, $6) returning ${USER_COLUMNS}`,
          [identifier, (input.name ?? '').trim().slice(0, 80), passwordHash, input.ip, device, referrer?.id ?? null],
        );
        // Sans identifiant d'appareil (client trop ancien ou bricolé), pas de crédit offert.
        if (opts.freeCredits > 0 && device.length >= 8 && n === 0) {
          user.credits = await addCredits(tx, user.id, opts.freeCredits, 'welcome');
        }
        return user;
      });
    },

    async login(rawIdentifier: string, password: string): Promise<User> {
      const identifier = normalizeIdentifier(rawIdentifier);
      const [row] = identifier
        ? await db.query<User & { password_hash: string }>(`select ${USER_COLUMNS}, password_hash from users where identifier = $1`, [identifier])
        : [];
      if (!row || !(await verifyPassword(password, row.password_hash))) {
        throw new AccountError('Identifiant ou mot de passe incorrect.', 401);
      }
      const { password_hash: _hash, ...user } = row;
      return user;
    },

    async setPassword(userId: number, password: string): Promise<void> {
      await db.query('update users set password_hash = $2 where id = $1', [userId, await hashPassword(password)]);
    },

    async get(userId: number): Promise<User | null> {
      const [user] = await db.query<User>(`select ${USER_COLUMNS} from users where id = $1`, [userId]);
      return user ?? null;
    },

    async findByIdentifier(raw: string): Promise<User | null> {
      const identifier = normalizeIdentifier(raw);
      if (!identifier) return null;
      const [user] = await db.query<User>(`select ${USER_COLUMNS} from users where identifier = $1`, [identifier]);
      return user ?? null;
    },

    /** Code de parrainage de l'utilisateur (créé à la première demande) et ses résultats. */
    async referral(userId: number): Promise<ReferralInfo> {
      const current = async () => (await db.query<{ referral_code: string | null }>('select referral_code from users where id = $1', [userId]))[0];
      let row = await current();
      if (!row) throw new AccountError('Compte introuvable.', 404);
      for (let attempt = 0; !row.referral_code && attempt < 5; attempt++) {
        try {
          // « is null » : si deux demandes arrivent en même temps, la première gagne.
          await db.query('update users set referral_code = $2 where id = $1 and referral_code is null', [userId, newReferralCode()]);
        } catch {
          // Code déjà attribué à quelqu'un d'autre (très rare) : on en tire un autre.
        }
        row = await current();
      }
      if (!row.referral_code) throw new AccountError('Impossible de créer votre code de parrainage. Réessayez.', 500);
      const [{ invited, rewarded }] = await db.query<{ invited: number; rewarded: number }>(
        'select count(*)::int as invited, count(*) filter (where referral_rewarded)::int as rewarded from users where referred_by = $1',
        [userId],
      );
      return { code: row.referral_code!, invited, rewarded };
    },

    /**
     * Après un achat confirmé (dans la même transaction) : si c'est le premier achat d'un filleul,
     * le filleul et son parrain reçoivent chacun leur bonus, une seule fois.
     */
    async rewardReferralInTx(tx: Db, userId: number): Promise<void> {
      const [row] = await tx.query<{ referred_by: number }>(
        'update users set referral_rewarded = true where id = $1 and referred_by is not null and not referral_rewarded returning referred_by',
        [userId],
      );
      if (!row) return;
      await addCredits(tx, userId, REFERRAL_BONUS, 'referral-welcome');
      await addCredits(tx, row.referred_by, REFERRAL_BONUS, 'referral', String(userId));
    },

    /** Retire des crédits (1 par défaut, avant un appel à l'IA) ; lève une erreur 402 s'il n'y en a pas assez. */
    spend: (userId: number, reason: string, amount = 1) => db.transaction((tx) => addCredits(tx, userId, -amount, reason)),
    /** Rend le crédit si l'appel à l'IA a échoué. */
    refund: (userId: number, reason: string, amount = 1) => db.transaction((tx) => addCredits(tx, userId, amount, `refund:${reason}`)),
    grant: (userId: number, credits: number, reason: string, ref = '') =>
      db.transaction((tx) => addCredits(tx, userId, credits, reason, ref)),
    addCreditsInTx: addCredits,
  };
}

export type Accounts = ReturnType<typeof createAccounts>;
