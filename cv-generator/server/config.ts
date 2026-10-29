import Anthropic from '@anthropic-ai/sdk';
import { createAi, DEFAULT_MODEL } from './ai.ts';
import { createApp } from './app.ts';
import { createAccounts } from './accounts.ts';
import { createPgDb, migrate, type Db } from './db.ts';
import { createPayments, fedapay } from './payments.ts';
import { createTestimonials } from './testimonials.ts';
import { createSupport, notifier } from './support.ts';
import { createVault, resendMailer } from './vault.ts';
import { createRecovery } from './recovery.ts';
import { createSources } from './sources.ts';

export type Settings = Record<string, string | undefined>;

/**
 * Construit le serveur à partir de ses réglages. Utilisé par le serveur Node (server/index.ts)
 * et par la fonction Supabase (server/edge.ts) : le comportement est le même partout.
 */
export async function createServer(env: Settings, opts: { db?: Db; migrate?: boolean } = {}) {
  const production = env.NODE_ENV === 'production';
  const model = env.CLAUDE_MODEL || DEFAULT_MODEL;
  // En production, l'IA n'est ouverte que si les comptes (et donc les crédits) sont actifs :
  // sinon n'importe qui pourrait l'utiliser gratuitement avec la clé du propriétaire.
  const hasDb = Boolean(opts.db || env.DATABASE_URL);
  const aiAllowed = Boolean(env.ANTHROPIC_API_KEY) && (!production || hasDb);
  if (env.ANTHROPIC_API_KEY && !aiAllowed) console.warn('IA désactivée : DATABASE_URL manquante en production.');
  const ai = aiAllowed ? createAi(new Anthropic({ apiKey: env.ANTHROPIC_API_KEY }), model) : null;

  // Comptes et crédits : actifs dès qu'une base de données est configurée.
  let accounts = null;
  let payments = null;
  let testimonials = null;
  let support = null;
  let vault = null;
  let recovery = null;
  let sources = null;
  if (hasDb) {
    if (!env.SESSION_SECRET) throw new Error('SESSION_SECRET est obligatoire avec une base de données.');
    // DATABASE_SSL=true pour une base externe (Supabase…) ; inutile pour la base interne de Render.
    const db = opts.db ?? createPgDb(env.DATABASE_URL!, env.DATABASE_SSL === 'true');
    if (opts.migrate !== false) await migrate(db);
    testimonials = createTestimonials(db);
    support = createSupport(db, notifier(env, `${(env.PUBLIC_URL ?? '').replace(/\/$/, '')}/#admin`));
    accounts = createAccounts(db, {
      freeCredits: Number(env.FREE_CREDITS ?? 1),
      freeIpCooldownDays: Number(env.FREE_IP_COOLDOWN_DAYS ?? 30),
    });
    vault = createVault(db, accounts, resendMailer(env));
    recovery = createRecovery(db, accounts, support);
    sources = createSources(db);
    if (env.FEDAPAY_SECRET_KEY) {
      payments = createPayments(db, accounts, fedapay(env.FEDAPAY_SECRET_KEY, env.FEDAPAY_ENV === 'live' ? 'live' : 'sandbox'));
    }
  }

  const app = createApp({
    ai,
    accounts,
    payments,
    testimonials,
    support,
    vault,
    recovery,
    sources,
    sessionSecret: env.SESSION_SECRET ?? '',
    publicUrl: env.PUBLIC_URL ?? '',
    apiPublicUrl: env.API_PUBLIC_URL ?? '',
    adminToken: env.ADMIN_TOKEN ?? '',
    allowedOrigins: (env.ALLOWED_ORIGINS ?? 'http://localhost:5173,https://localhost,capacitor://localhost')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
    rateLimitPerHour: Number(env.RATE_LIMIT_PER_HOUR ?? 30),
  });

  const summary =
    `IA ${ai ? `active (${model})` : 'désactivée'}, comptes ${accounts ? 'actifs' : 'désactivés (accès libre)'}, ` +
    `paiement ${payments ? `FedaPay ${env.FEDAPAY_ENV ?? 'sandbox'}` : 'désactivé'}`;
  return { app, summary };
}
