import { createHash, randomInt } from 'node:crypto';
import type { Db } from './db.ts';
import { AccountError, type Accounts, type User } from './accounts.ts';
import { normalizeIdentifier } from './auth.ts';

// Coffre-fort : les documents restent sur le téléphone, chiffrés avec une clé propre à la personne.
// Le serveur garde un double de cette clé, rattaché au compte, pour qu'un code oublié puisse être
// réinitialisé (mot de passe du compte, ou code reçu par e-mail). Sans le téléphone, la clé seule n'ouvre rien.
//
// Le même envoi de code par e-mail sert à « Mot de passe du compte oublié ».

export type Mailer = (to: string, subject: string, text: string) => Promise<void>;

/** Envoi d'e-mails via Resend : actif avec RESEND_API_KEY et EMAIL_FROM (adresse d'un domaine vérifié chez Resend). */
export function resendMailer(env: Record<string, string | undefined>, fetchImpl: typeof fetch = fetch): Mailer | null {
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) return null;
  return async (to, subject, text) => {
    const res = await fetchImpl('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: env.EMAIL_FROM, to, subject, text }),
    });
    if (!res.ok) throw new Error(`Resend ${res.status} : ${await res.text().catch(() => '')}`);
  };
}

export type CodePurpose = 'vault' | 'password';

const CODE_TTL_MIN = 15;
const MAX_ATTEMPTS = 5;
const hash = (s: string) => createHash('sha256').update(s).digest('hex');

/** « a***@gmail.com » : montre où le code est parti sans tout dévoiler. */
export function maskEmail(email: string): string {
  const [user, domain] = email.split('@');
  return `${user.slice(0, 1)}${'*'.repeat(Math.max(2, user.length - 1))}@${domain}`;
}

export function createVault(db: Db, accounts: Accounts, mailer: Mailer | null) {
  async function sendCode(user: User, purpose: CodePurpose): Promise<{ to: string }> {
    if (!mailer) throw new AccountError('L’envoi d’e-mails n’est pas encore activé.', 503);
    if (!user.identifier.includes('@')) {
      throw new AccountError('Votre compte utilise un numéro de téléphone : utilisez plutôt le mot de passe de votre compte.', 400);
    }
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    await db.transaction(async (tx) => {
      await tx.query('update email_codes set used = true where user_id = $1 and purpose = $2 and not used', [user.id, purpose]);
      await tx.query(
        `insert into email_codes (user_id, purpose, code_hash, expires_at) values ($1, $2, $3, now() + make_interval(mins => $4))`,
        [user.id, purpose, hash(code), CODE_TTL_MIN],
      );
    });
    const what = purpose === 'vault' ? 'réinitialiser le code de votre coffre-fort' : 'choisir un nouveau mot de passe';
    await mailer(
      user.identifier,
      `Votre code CV Studio : ${code}`,
      `Bonjour${user.name ? ` ${user.name}` : ''},\n\nVoici votre code pour ${what} dans CV Studio :\n\n${code}\n\nIl est valable ${CODE_TTL_MIN} minutes. Si vous n’avez rien demandé, ignorez simplement cet e-mail.\n\nL’équipe CV Studio`,
    );
    return { to: maskEmail(user.identifier) };
  }

  async function checkCode(user: User, purpose: CodePurpose, code: string): Promise<void> {
    const [row] = await db.query<{ id: number; code_hash: string; attempts: number }>(
      `select id, code_hash, attempts from email_codes
       where user_id = $1 and purpose = $2 and not used and expires_at > now() order by id desc limit 1`,
      [user.id, purpose],
    );
    if (!row) throw new AccountError('Code expiré. Demandez-en un nouveau.', 400);
    if (row.attempts >= MAX_ATTEMPTS) throw new AccountError('Trop d’essais. Demandez un nouveau code.', 429);
    if (row.code_hash !== hash(code.trim())) {
      await db.query('update email_codes set attempts = attempts + 1 where id = $1', [row.id]);
      throw new AccountError('Code incorrect.', 400);
    }
    await db.query('update email_codes set used = true where id = $1', [row.id]);
  }

  async function key(userId: number): Promise<string> {
    const [row] = await db.query<{ key: string }>('select key from vault_keys where user_id = $1', [userId]);
    if (!row) throw new AccountError('Aucune clé de coffre-fort enregistrée pour ce compte.', 404);
    return row.key;
  }

  return {
    emailEnabled: mailer !== null,

    /** Garde (ou remplace) le double de la clé du coffre de ce compte. */
    async saveKey(userId: number, value: string): Promise<void> {
      if (!/^[A-Za-z0-9+/=]{40,100}$/.test(value)) throw new AccountError('Clé invalide.', 400);
      await db.query(
        `insert into vault_keys (user_id, key) values ($1, $2)
         on conflict (user_id) do update set key = excluded.key, updated_at = now()`,
        [userId, value],
      );
    },

    /** Code oublié : la personne prouve que c'est elle avec le mot de passe de son compte. */
    async recoverWithPassword(user: User, password: string): Promise<string> {
      await accounts.login(user.identifier, password);
      return key(user.id);
    },

    sendVaultCode: (user: User) => sendCode(user, 'vault'),

    async recoverWithCode(user: User, code: string): Promise<string> {
      await checkCode(user, 'vault', code);
      return key(user.id);
    },

    /** Mot de passe du compte oublié : code envoyé à l'e-mail du compte. */
    async sendPasswordCode(rawIdentifier: string): Promise<{ to: string } | null> {
      const identifier = normalizeIdentifier(rawIdentifier);
      const user = identifier ? await accounts.findByIdentifier(identifier) : null;
      // Pas de compte : on ne le dit pas (sinon on révélerait qui est inscrit).
      if (!user) return null;
      return sendCode(user, 'password');
    },

    async resetPassword(rawIdentifier: string, code: string, password: string): Promise<User> {
      const user = await accounts.findByIdentifier(rawIdentifier);
      if (!user) throw new AccountError('Code incorrect.', 400);
      if (password.length < 6) throw new AccountError('Le mot de passe doit faire au moins 6 caractères.', 400);
      await checkCode(user, 'password', code);
      await accounts.setPassword(user.id, password);
      return user;
    },
  };
}

export type Vault = ReturnType<typeof createVault>;
