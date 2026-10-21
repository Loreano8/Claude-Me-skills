import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import Anthropic from '@anthropic-ai/sdk';
import { createAi, DEFAULT_MODEL } from './ai.ts';
import { createApp } from './app.ts';
import { createAccounts } from './accounts.ts';
import { createPgDb, migrate } from './db.ts';
import { createPayments, fedapay } from './payments.ts';

try {
  process.loadEnvFile();
} catch {
  // Pas de fichier .env : on utilise les variables d'environnement déjà définies.
}

const env = process.env;
const port = Number(env.PORT ?? 8787);
const model = env.CLAUDE_MODEL || DEFAULT_MODEL;
// En production, l'IA n'est ouverte que si les comptes (et donc les crédits) sont actifs :
// sinon n'importe qui pourrait l'utiliser gratuitement avec la clé du propriétaire.
const aiAllowed = Boolean(env.ANTHROPIC_API_KEY) && (env.NODE_ENV !== 'production' || Boolean(env.DATABASE_URL));
if (env.ANTHROPIC_API_KEY && !aiAllowed) console.warn('IA désactivée : DATABASE_URL manquante en production.');
const ai = aiAllowed ? createAi(new Anthropic(), model) : null;

// Comptes et crédits : actifs dès qu'une base de données est configurée.
let accounts = null;
let payments = null;
if (env.DATABASE_URL) {
  if (!env.SESSION_SECRET) throw new Error('SESSION_SECRET est obligatoire quand DATABASE_URL est défini.');
  const db = createPgDb(env.DATABASE_URL);
  await migrate(db);
  accounts = createAccounts(db, {
    freeCredits: Number(env.FREE_CREDITS ?? 1),
    freeIpCooldownDays: Number(env.FREE_IP_COOLDOWN_DAYS ?? 30),
  });
  const provider = env.FEDAPAY_SECRET_KEY ? fedapay(env.FEDAPAY_SECRET_KEY, env.FEDAPAY_ENV === 'live' ? 'live' : 'sandbox') : null;
  payments = createPayments(db, accounts, provider);
}

const app = createApp({
  ai,
  accounts,
  payments: payments && env.FEDAPAY_SECRET_KEY ? payments : null,
  sessionSecret: env.SESSION_SECRET ?? '',
  publicUrl: env.PUBLIC_URL ?? '',
  adminToken: env.ADMIN_TOKEN ?? '',
  allowedOrigins: (env.ALLOWED_ORIGINS ?? 'http://localhost:5173,https://localhost,capacitor://localhost')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  rateLimitPerHour: Number(env.RATE_LIMIT_PER_HOUR ?? 30),
});

// En production, le même serveur sert aussi le site web compilé (dossier dist).
if (env.NODE_ENV === 'production') {
  app.use('/*', serveStatic({ root: './dist' }));
  app.get('*', serveStatic({ path: './dist/index.html' }));
}

serve({ fetch: app.fetch, port }, () => {
  console.log(
    `API CV Studio sur http://localhost:${port} — IA ${ai ? `active (${model})` : 'désactivée'}, ` +
      `comptes ${accounts ? 'actifs' : 'désactivés (accès libre)'}, paiement ${env.FEDAPAY_SECRET_KEY ? `FedaPay ${env.FEDAPAY_ENV ?? 'sandbox'}` : 'désactivé'}`,
  );
});
