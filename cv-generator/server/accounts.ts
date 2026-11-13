import { normalizeSource } from './sources.ts';
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

/** Code de parrainage choisi : 4 à 12 lettres ou chiffres, sans accent ni espace (il se tape et se dicte facilement). */
export const REFERRAL_CODE_PATTERN = /^[A-Z0-9]{4,12}$/;
/** Codes réservés : ne doivent pas faire croire à un code officiel (début du code, ou code exact pour les mots courts). */
const RESERVED_PREFIXES = ['CVCASA', 'ADMIN', 'OFFICIEL', 'OFFICIAL', 'SUPPORT'];
const RESERVED_EXACT = ['GRATUIT', 'FREE', 'PROMO', 'TEST', 'CODE', 'PROMO2026'];
/** Nombre de personnalisations possibles (chaque ancien code reste valable). */
export const REFERRAL_CODE_CHANGES = 3;

/** Compte auquel appartient un code (actuel ou ancien code personnalisé). */
async function ownerOfCode(db: Db, code: string): Promise<number | null> {
  const [row] = await db.query<{ id: number }>(
    'select id from users where referral_code = $1 union all select user_id as id from referral_aliases where code = $1 limit 1',
    [code],
  );
  return row?.id ?? null;
}

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

    async register(input: { identifier: string; password: string; name?: string; ip: string; device: string; referralCode?: string; referralTyped?: boolean; source?: string }): Promise<User> {
      const identifier = normalizeIdentifier(input.identifier);
      if (!identifier) throw new AccountError('Indiquez un e-mail ou un numéro de téléphone valide.', 400);
      if (input.password.length < 8) throw new AccountError('Le mot de passe doit faire au moins 8 caractères.', 400);
      const passwordHash = await hashPassword(input.password);
      return db.transaction(async (tx) => {
        const [existing] = await tx.query('select id from users where identifier = $1', [identifier]);
        if (existing) throw new AccountError('Un compte existe déjà avec cet identifiant. Connectez-vous.', 409);
        const device = input.device.trim().slice(0, 100);
        // Verrou par appareil et par connexion : deux inscriptions en même temps n'obtiennent pas chacune le crédit offert.
        await tx.query('select pg_advisory_xact_lock(hashtext($1)), pg_advisory_xact_lock(hashtext($2))', [`device:${device}`, `ip:${input.ip}`]);
        const [{ n }] = await tx.query<{ n: number }>(
          `select count(*)::int as n from credit_ledger l join users u on u.id = l.user_id
           where l.reason = 'welcome'
             and (u.signup_device = $1 or (u.signup_ip = $2 and l.created_at > now() - make_interval(days => $3)))`,
          [device, input.ip, opts.freeIpCooldownDays],
        );
        const code = (input.referralCode ?? '').replace(/\s+/g, '').toUpperCase();
        const referrerId = code ? await ownerOfCode(tx, code) : null;
        // Code tapé (ou repris d'un lien) mais inconnu : on le signale plutôt que de l'ignorer.
        // Anciennes versions de l'appli (pas de champ visible) : un code périmé gardé en mémoire est ignoré, pour ne pas bloquer l'inscription.
        if (code && !referrerId && input.referralTyped) throw new AccountError('Ce code de parrainage n’existe pas. Vérifiez-le ou laissez la case vide.', 400);
        const referrer = referrerId ? { id: referrerId } : undefined;
        const [user] = await tx.query<User>(
          `insert into users (identifier, name, password_hash, signup_ip, signup_device, referred_by, signup_source) values ($1, $2, $3, $4, $5, $6, $7) returning ${USER_COLUMNS}`,
          [identifier, (input.name ?? '').trim().slice(0, 80), passwordHash, input.ip, device, referrer?.id ?? null, input.source ? normalizeSource(input.source) : ''],
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

    /** Prénom affiché (e-mails, messages) : modifiable dans Réglages. */
    async setName(userId: number, name: string): Promise<User | null> {
      const clean = name.replace(/\s+/g, ' ').trim().slice(0, 60);
      const [row] = await db.query<User>(`update users set name = $2 where id = $1 returning ${USER_COLUMNS}`, [userId, clean]);
      return row ?? null;
    },

    async setPassword(userId: number, password: string): Promise<void> {
      await db.query('update users set password_hash = $2, password_changed_at = now() where id = $1', [userId, await hashPassword(password)]);
    },

    /** Compte d'une session : refusé si le jeton date d'avant le dernier changement de mot de passe. */
    async forSession(userId: number, issuedAt: number): Promise<User | null> {
      const [row] = await db.query<User & { password_changed_at: string | null }>(`select ${USER_COLUMNS}, password_changed_at from users where id = $1`, [userId]);
      if (!row) return null;
      // Marge d'une seconde : le jeton remis juste après le changement reste valable.
      if (row.password_changed_at && issuedAt < new Date(row.password_changed_at).getTime() - 1000) return null;
      const { password_changed_at: _changed, ...user } = row;
      return user;
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
          const candidate = newReferralCode();
          if (await ownerOfCode(db, candidate)) continue; // déjà pris (code actuel ou ancien code de quelqu'un)
          await db.query('update users set referral_code = $2 where id = $1 and referral_code is null', [userId, candidate]);
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
     * Code de parrainage personnalisé (ambassadeurs) : unique, 4 à 12 lettres ou chiffres, 3 changements au plus.
     * L'ancien code reste valable (liens déjà partagés) et ne peut pas être repris par quelqu'un d'autre.
     */
    async setReferralCode(userId: number, raw: string): Promise<string> {
      const code = raw.replace(/\s+/g, '').toUpperCase();
      if (!REFERRAL_CODE_PATTERN.test(code)) throw new AccountError('Choisissez un code de 4 à 12 lettres ou chiffres, sans espace ni accent.', 400);
      if (RESERVED_PREFIXES.some((r) => code.startsWith(r)) || RESERVED_EXACT.includes(code)) throw new AccountError('Ce code est réservé. Choisissez-en un autre.', 400);
      await this.referral(userId); // garantit un code actuel
      return db.transaction(async (tx) => {
        // Deux personnes qui veulent le même code au même moment : la seconde reçoit « déjà pris », pas une erreur.
        await tx.query('select pg_advisory_xact_lock(hashtext($1))', [`code:${code}`]);
        const [me] = await tx.query<{ referral_code: string }>('select referral_code from users where id = $1 for update', [userId]);
        if (me.referral_code === code) return code;
        const owner = await ownerOfCode(tx, code);
        if (owner && owner !== userId) throw new AccountError('Ce code est déjà pris. Essayez une variante (par exemple avec votre ville ou un chiffre).', 409);
        const [{ n }] = await tx.query<{ n: number }>('select count(*)::int as n from referral_aliases where user_id = $1', [userId]);
        if (n >= REFERRAL_CODE_CHANGES && !owner) throw new AccountError(`Vous avez déjà changé votre code ${REFERRAL_CODE_CHANGES} fois.`, 409);
        // Reprendre un de ses anciens codes : il redevient le code principal.
        if (owner === userId) await tx.query('delete from referral_aliases where code = $1', [code]);
        await tx.query('insert into referral_aliases (code, user_id) values ($1, $2) on conflict (code) do nothing', [me.referral_code, userId]);
        await tx.query('update users set referral_code = $2 where id = $1', [userId, code]);
        return code;
      });
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
