import type { Db } from './db.ts';
import { hashPassword, normalizeIdentifier, verifyPassword } from './auth.ts';

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

    async register(input: { identifier: string; password: string; name?: string; ip: string; device: string }): Promise<User> {
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
        const [user] = await tx.query<User>(
          `insert into users (identifier, name, password_hash, signup_ip, signup_device) values ($1, $2, $3, $4, $5) returning ${USER_COLUMNS}`,
          [identifier, (input.name ?? '').trim().slice(0, 80), passwordHash, input.ip, device],
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

    /** Retire un crédit avant un appel à l'IA ; lève une erreur 402 s'il n'en reste plus. */
    spend: (userId: number, reason: string) => db.transaction((tx) => addCredits(tx, userId, -1, reason)),
    /** Rend le crédit si l'appel à l'IA a échoué. */
    refund: (userId: number, reason: string) => db.transaction((tx) => addCredits(tx, userId, 1, `refund:${reason}`)),
    grant: (userId: number, credits: number, reason: string, ref = '') =>
      db.transaction((tx) => addCredits(tx, userId, credits, reason, ref)),
    addCreditsInTx: addCredits,
  };
}

export type Accounts = ReturnType<typeof createAccounts>;
