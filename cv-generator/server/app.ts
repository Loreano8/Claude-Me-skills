import { Hono, type Context } from 'hono';
import { cors } from 'hono/cors';
import { bodyLimit } from 'hono/body-limit';
import { z } from 'zod';
import { AdaptRequest, CoverLetterRequest, StructureRequest, TranslateRequest } from '../shared/schema.ts';
import { AiError, type Ai } from './ai.ts';
import { AccountError, type Accounts, type User } from './accounts.ts';
import { signToken, verifyToken } from './auth.ts';
import { PACKS, PaymentError, type Payments } from './payments.ts';

export interface AppOptions {
  ai: Ai | null;
  allowedOrigins: string[];
  rateLimitPerHour: number;
  /** Comptes et crédits. Sans base de données (développement local), l'IA est en accès libre. */
  accounts?: Accounts | null;
  payments?: Payments | null;
  sessionSecret?: string;
  /** Adresse publique du site, pour revenir après un paiement. */
  publicUrl?: string;
  /** Jeton secret de l'administrateur (ajout manuel de crédits). */
  adminToken?: string;
}

// Limite simple en mémoire : suffisante pour une seule instance du serveur.
function createRateLimiter(limit: number) {
  const hits = new Map<string, number[]>();
  return (key: string): boolean => {
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

function clientKey(c: Context): string {
  return c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || c.req.header('x-real-ip') || 'local';
}

const Credentials = z.object({
  identifier: z.string().max(120),
  password: z.string().max(200),
  name: z.string().max(80).optional(),
});

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);

function resultPage(title: string, message: string, backUrl: string): string {
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title><style>body{font-family:system-ui,sans-serif;background:#f1f5f9;color:#0f172a;display:grid;place-items:center;min-height:100vh;margin:0;padding:16px}
main{background:#fff;border-radius:20px;padding:28px;max-width:420px;text-align:center;box-shadow:0 4px 20px #0001}a{display:inline-block;margin-top:16px;background:#2549eb;color:#fff;padding:12px 20px;border-radius:12px;text-decoration:none;font-weight:600}</style></head>
<body><main><h1>${escapeHtml(title)}</h1><p>${escapeHtml(message)}</p><a href="${escapeHtml(backUrl)}">Retour à CV Studio</a>
<p style="color:#64748b;font-size:14px">Dans l’application, vous pouvez simplement fermer cette page.</p></main></body></html>`;
}

export function createApp({ ai, allowedOrigins, rateLimitPerHour, accounts = null, payments = null, sessionSecret = '', publicUrl = '', adminToken = '' }: AppOptions) {
  const app = new Hono();
  const allow = createRateLimiter(rateLimitPerHour);
  const allowAuth = createRateLimiter(20);

  app.use('/api/*', cors({ origin: allowedOrigins, allowMethods: ['GET', 'POST'], exposeHeaders: ['X-Credits-Remaining'] }));
  app.use(
    '/api/*',
    bodyLimit({
      maxSize: 15 * 1024 * 1024,
      onError: (c) => c.json({ error: 'Fichier trop volumineux (15 Mo maximum).' }, 413),
    }),
  );

  app.get('/api/health', (c) => c.json({ ok: true, ai: ai !== null, accounts: accounts !== null, payments: payments !== null }));

  async function currentUser(c: Context): Promise<User | null> {
    if (!accounts) return null;
    const token = c.req.header('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
    const uid = token ? verifyToken(token, sessionSecret) : null;
    return uid ? accounts.get(uid) : null;
  }

  const publicUser = (u: User) => ({ identifier: u.identifier, name: u.name, credits: u.credits });

  function accountError(c: Context, error: unknown) {
    if (error instanceof AccountError || error instanceof PaymentError) {
      return c.json({ error: error.message }, error.status as 400);
    }
    console.error(error);
    return c.json({ error: 'Erreur interne du serveur.' }, 500);
  }

  // ---- Comptes ---------------------------------------------------------------

  app.post('/api/auth/register', async (c) => {
    if (!accounts) return c.json({ error: 'Les comptes ne sont pas activés sur ce serveur.' }, 503);
    if (!allowAuth(clientKey(c))) return c.json({ error: 'Trop de tentatives. Réessayez plus tard.' }, 429);
    const parsed = Credentials.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: 'Requête invalide.' }, 400);
    try {
      const user = await accounts.register({ ...parsed.data, ip: clientKey(c), device: c.req.header('x-device-id') ?? '' });
      return c.json({ token: signToken(user.id, sessionSecret), user: publicUser(user) });
    } catch (error) {
      return accountError(c, error);
    }
  });

  app.post('/api/auth/login', async (c) => {
    if (!accounts) return c.json({ error: 'Les comptes ne sont pas activés sur ce serveur.' }, 503);
    if (!allowAuth(clientKey(c))) return c.json({ error: 'Trop de tentatives. Réessayez plus tard.' }, 429);
    const parsed = Credentials.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: 'Requête invalide.' }, 400);
    try {
      const user = await accounts.login(parsed.data.identifier, parsed.data.password);
      return c.json({ token: signToken(user.id, sessionSecret), user: publicUser(user) });
    } catch (error) {
      return accountError(c, error);
    }
  });

  app.get('/api/me', async (c) => {
    const user = await currentUser(c);
    return user ? c.json({ user: publicUser(user) }) : c.json({ error: 'Session expirée. Reconnectez-vous.' }, 401);
  });

  // ---- Crédits et paiement ------------------------------------------------

  app.get('/api/packs', (c) => c.json({ packs: PACKS, payments: payments !== null }));

  app.post('/api/payments/checkout', async (c) => {
    const user = await currentUser(c);
    if (!user || !payments) return c.json({ error: user ? 'Le paiement en ligne n’est pas encore activé.' : 'Connectez-vous pour acheter des crédits.' }, user ? 503 : 401);
    const body = (await c.req.json().catch(() => null)) as { packId?: string } | null;
    try {
      const returnUrl = `${new URL(c.req.url).origin}/api/payments/return`;
      return c.json({ url: await payments.checkout(user, String(body?.packId ?? ''), returnUrl) });
    } catch (error) {
      return accountError(c, error);
    }
  });

  // Le client revient ici après avoir payé sur la page FedaPay.
  app.get('/api/payments/return', async (c) => {
    const back = `${publicUrl || new URL(c.req.url).origin}/#apercu`;
    const ref = c.req.query('id') ?? c.req.query('transaction_id') ?? '';
    if (!payments || !ref) return c.html(resultPage('Paiement', 'Aucun paiement à vérifier.', back), 400);
    try {
      const result = await payments.confirm(ref);
      if (result.status === 'approved') {
        return c.html(resultPage('Paiement reçu ✅', 'Vos crédits ont été ajoutés à votre compte. Merci !', back));
      }
      if (result.status === 'pending') {
        return c.html(resultPage('Paiement en cours…', 'Le paiement n’est pas encore confirmé. Vos crédits seront ajoutés automatiquement dès sa validation.', back));
      }
      return c.html(resultPage('Paiement non abouti', 'Le paiement a été annulé ou refusé. Aucun montant n’a été prélevé.', back));
    } catch (error) {
      console.error(error);
      return c.html(resultPage('Paiement', 'Impossible de vérifier le paiement pour le moment. S’il a abouti, vos crédits seront ajoutés automatiquement.', back), 502);
    }
  });

  // Notification envoyée par FedaPay. Le statut est revérifié auprès de FedaPay : un faux message est sans effet.
  app.post('/api/payments/webhook', async (c) => {
    if (!payments) return c.json({ ok: false }, 503);
    const body = (await c.req.json().catch(() => null)) as { entity?: { id?: unknown } } | null;
    const ref = body?.entity?.id;
    if (ref === undefined || ref === null) return c.json({ ok: false }, 400);
    try {
      await payments.confirm(String(ref));
      return c.json({ ok: true });
    } catch (error) {
      if (error instanceof PaymentError && error.status === 404) return c.json({ ok: true });
      console.error(error);
      return c.json({ ok: false }, 500);
    }
  });

  // Ajout manuel de crédits (ex. paiement reçu directement par mobile money).
  app.post('/api/admin/credits', async (c) => {
    if (!accounts || !adminToken || c.req.header('authorization') !== `Bearer ${adminToken}`) {
      return c.json({ error: 'Accès refusé.' }, 403);
    }
    const body = (await c.req.json().catch(() => null)) as { identifier?: string; credits?: number } | null;
    const user = await accounts.findByIdentifier(String(body?.identifier ?? ''));
    const credits = Number(body?.credits);
    if (!user || !Number.isInteger(credits) || credits === 0) return c.json({ error: 'Utilisateur ou nombre de crédits invalide.' }, 400);
    try {
      return c.json({ identifier: user.identifier, credits: await accounts.grant(user.id, credits, 'admin') });
    } catch (error) {
      return accountError(c, error);
    }
  });

  // ---- IA (1 crédit par action) ----------------------------------------------

  function aiRoute<S extends z.ZodType, R>(
    action: string,
    schema: S,
    handler: (ai: Ai, body: z.output<S>) => Promise<R>,
    check?: (body: z.output<S>) => string | null,
  ) {
    return async (c: Context) => {
      if (!ai) {
        return c.json({ error: 'Les fonctions IA ne sont pas configurées sur ce serveur (ANTHROPIC_API_KEY manquante).' }, 503);
      }
      if (!allow(clientKey(c))) {
        return c.json({ error: 'Trop de demandes en peu de temps. Réessayez dans une heure.' }, 429);
      }
      const parsed = schema.safeParse(await c.req.json().catch(() => null));
      if (!parsed.success) {
        return c.json({ error: 'Requête invalide.', details: parsed.error.issues.slice(0, 5) }, 400);
      }
      const problem = check?.(parsed.data);
      if (problem) return c.json({ error: problem }, 400);

      let user: User | null = null;
      if (accounts) {
        user = await currentUser(c);
        if (!user) return c.json({ error: 'Créez un compte gratuit ou connectez-vous pour utiliser l’IA.', code: 'auth' }, 401);
        try {
          const remaining = await accounts.spend(user.id, action);
          c.header('X-Credits-Remaining', String(remaining));
        } catch (error) {
          if (error instanceof AccountError && error.status === 402) {
            return c.json({ error: 'Vous n’avez plus de crédits. Rechargez pour continuer.', code: 'credits' }, 402);
          }
          return accountError(c, error);
        }
      }
      try {
        return c.json(await handler(ai, parsed.data));
      } catch (error) {
        if (user && accounts) {
          const credits = await accounts.refund(user.id, action).catch(() => null);
          if (credits !== null) c.header('X-Credits-Remaining', String(credits));
        }
        if (error instanceof AiError) {
          return c.json({ error: error.message, code: error.code }, error.status as 400);
        }
        console.error(error);
        return c.json({ error: 'Erreur interne du serveur.' }, 500);
      }
    };
  }

  app.post(
    '/api/ai/structure',
    aiRoute('structure', StructureRequest, (ai, body) => ai.structure(body), (body) =>
      !body.text.trim() && !body.file && !body.current ? 'Écrivez quelques informations ou joignez un ancien CV.' : null,
    ),
  );

  app.post(
    '/api/ai/adapt',
    aiRoute('adapt', AdaptRequest, (ai, body) => ai.adapt(body), (body) =>
      !body.job.text.trim() && !body.job.file ? 'Collez le texte de l’offre ou joignez le fichier de l’annonce.' : null,
    ),
  );

  app.post(
    '/api/ai/cover-letter',
    aiRoute('cover-letter', CoverLetterRequest, (ai, body) => ai.coverLetter(body)),
  );

  app.post(
    '/api/ai/translate',
    aiRoute('translate', TranslateRequest, (ai, body) => ai.translate(body)),
  );

  return app;
}
