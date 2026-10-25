import { Hono, type Context } from 'hono';
import { cors } from 'hono/cors';
import { bodyLimit } from 'hono/body-limit';
import { z } from 'zod';
import { AdaptRequest, AnalyzeTemplateRequest, CoverLetterRequest, InterviewRequest, ReviseRequest, StructureRequest, TranslateRequest } from '../shared/schema.ts';
import { AiError, type Ai } from './ai.ts';
import { AccountError, REFERRAL_BONUS, UNLOCK_COST, type Accounts, type User } from './accounts.ts';
import { signToken, verifyToken } from './auth.ts';
import { PACKS, PaymentError, type Payments } from './payments.ts';
import { TestimonialInput, type Testimonials } from './testimonials.ts';
import { SupportError, SupportMessageInput, type Support } from './support.ts';

export interface AppOptions {
  ai: Ai | null;
  allowedOrigins: string[];
  rateLimitPerHour: number;
  /** Comptes et crédits. Sans base de données (développement local), l'IA est en accès libre. */
  accounts?: Accounts | null;
  payments?: Payments | null;
  /** Témoignages des utilisateurs embauchés (validés à la main avant publication). */
  testimonials?: Testimonials | null;
  /** Messagerie « Nous contacter ». */
  support?: Support | null;
  sessionSecret?: string;
  /** Adresse publique du site, pour revenir après un paiement. */
  publicUrl?: string;
  /** Adresse publique de l'API (ex. fonction Supabase), si elle diffère de celle de la requête. */
  apiPublicUrl?: string;
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
  referralCode: z.string().max(20).optional(),
});

export function createApp({ ai, allowedOrigins, rateLimitPerHour, accounts = null, payments = null, testimonials = null, support = null, sessionSecret = '', publicUrl = '', apiPublicUrl = '', adminToken = '' }: AppOptions) {
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

  app.get('/api/health', async (c) => {
    // Appelée chaque jour par une tâche automatique : la requête à la base empêche la mise en veille du projet.
    const db = accounts ? await accounts.ping().catch(() => false) : null;
    return c.json({ ok: db !== false, ai: ai !== null, accounts: accounts !== null, payments: payments !== null, db }, db === false ? 503 : 200);
  });

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

  app.get('/api/referral', async (c) => {
    const user = await currentUser(c);
    if (!user || !accounts) return c.json({ error: 'Connectez-vous pour parrainer vos amis.' }, 401);
    return c.json({ ...(await accounts.referral(user.id)), bonus: REFERRAL_BONUS });
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
      const returnUrl = `${apiPublicUrl || new URL(c.req.url).origin}/api/payments/return`;
      return c.json({ url: await payments.checkout(user, String(body?.packId ?? ''), returnUrl) });
    } catch (error) {
      return accountError(c, error);
    }
  });

  // Le client revient ici après avoir payé sur la page FedaPay : on vérifie, puis on le renvoie
  // sur le site, qui affiche le résultat (#paiement-approved, #paiement-pending, #paiement-failed…).
  app.get('/api/payments/return', async (c) => {
    const site = publicUrl || new URL(c.req.url).origin;
    const ref = c.req.query('id') ?? c.req.query('transaction_id') ?? '';
    if (!payments || !ref) return c.redirect(`${site}/#paiement-error`);
    try {
      const { status } = await payments.confirm(ref);
      const outcome = status === 'approved' || status === 'pending' ? status : 'failed';
      return c.redirect(`${site}/#paiement-${outcome}`);
    } catch (error) {
      console.error(error);
      return c.redirect(`${site}/#paiement-error`);
    }
  });

  // Notification envoyée par FedaPay. Le statut est revérifié auprès de FedaPay : un faux message est sans effet.
  // On répond toujours 200 : FedaPay désactive un webhook qui renvoie des erreurs, et le retour du client
  // (/api/payments/return) confirme de toute façon le paiement.
  app.post('/api/payments/webhook', async (c) => {
    const body = (await c.req.json().catch(() => null)) as { name?: unknown; entity?: { id?: unknown } } | null;
    const ref = body?.entity?.id;
    const isTransaction = typeof body?.name === 'string' && body.name.startsWith('transaction.');
    if (!payments || !isTransaction || ref === undefined || ref === null) return c.json({ ok: true, ignored: true });
    try {
      await payments.confirm(String(ref));
      return c.json({ ok: true });
    } catch (error) {
      if (!(error instanceof PaymentError && error.status === 404)) console.error('Webhook FedaPay', error);
      return c.json({ ok: true, ignored: true });
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

  // Version Pro d'un CV (UNLOCK_COST crédits) : PDF sans mention, tous les modèles, export Word.
  // Le CV reste sur l'appareil : le serveur ne fait que débiter le crédit.
  app.post('/api/unlock', async (c) => {
    if (!accounts) return c.json({ credits: null });
    const user = await currentUser(c);
    if (!user) return c.json({ error: 'Créez un compte gratuit ou connectez-vous pour passer en version Pro.', code: 'auth' }, 401);
    try {
      const credits = await accounts.spend(user.id, 'unlock', UNLOCK_COST);
      c.header('X-Credits-Remaining', String(credits));
      return c.json({ credits });
    } catch (error) {
      if (error instanceof AccountError && error.status === 402) {
        return c.json({ error: `La version Pro coûte ${UNLOCK_COST} crédits. Rechargez pour continuer.`, code: 'credits' }, 402);
      }
      return accountError(c, error);
    }
  });

  // ---- Témoignages -----------------------------------------------------------

  app.get('/api/testimonials', async (c) => c.json({ testimonials: testimonials ? await testimonials.listApproved() : [] }));

  app.post('/api/testimonials', async (c) => {
    if (!testimonials) return c.json({ error: 'Les témoignages ne sont pas activés sur ce serveur.' }, 503);
    if (!allowAuth(clientKey(c))) return c.json({ error: 'Trop de tentatives. Réessayez plus tard.' }, 429);
    const parsed = TestimonialInput.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: 'Remplissez le prénom, le poste et l’entreprise, et cochez la case d’accord.' }, 400);
    return c.json(await testimonials.submit(parsed.data, c.req.header('x-device-id') ?? ''));
  });

  app.post('/api/testimonials/:id/withdraw', async (c) => {
    if (!testimonials) return c.json({ error: 'Les témoignages ne sont pas activés sur ce serveur.' }, 503);
    const body = (await c.req.json().catch(() => null)) as { secret?: unknown } | null;
    const ok = await testimonials.withdraw(Number(c.req.param('id')), String(body?.secret ?? ''));
    return ok ? c.json({ ok: true }) : c.json({ error: 'Témoignage introuvable ou déjà retiré.' }, 404);
  });

  const isAdmin = (c: Context) => Boolean(adminToken) && c.req.header('authorization') === `Bearer ${adminToken}`;

  app.get('/api/admin/testimonials', async (c) => {
    if (!testimonials || !isAdmin(c)) return c.json({ error: 'Accès refusé.' }, 403);
    return c.json({ testimonials: await testimonials.listAll() });
  });

  app.post('/api/admin/testimonials/:id', async (c) => {
    if (!testimonials || !isAdmin(c)) return c.json({ error: 'Accès refusé.' }, 403);
    const body = (await c.req.json().catch(() => null)) as { status?: unknown } | null;
    const status = body?.status;
    if (status !== 'approved' && status !== 'rejected' && status !== 'pending') return c.json({ error: 'Statut invalide.' }, 400);
    const ok = await testimonials.setStatus(Number(c.req.param('id')), status);
    return ok ? c.json({ ok: true }) : c.json({ error: 'Témoignage introuvable.' }, 404);
  });

  // ---- Nous contacter ---------------------------------------------------------

  const supportOff = (c: Context) => c.json({ error: 'La messagerie n’est pas activée sur ce serveur.' }, 503);
  const supportIdentity = async (c: Context) => ({ userId: (await currentUser(c))?.id ?? null, secret: c.req.header('x-support-secret') ?? null });
  const supportError = (c: Context, error: unknown) => {
    if (error instanceof SupportError) return c.json({ error: error.message }, error.status as 400);
    console.error(error);
    return c.json({ error: 'Erreur interne du serveur.' }, 500);
  };

  app.get('/api/support', async (c) => {
    if (!support) return supportOff(c);
    return c.json({ messages: await support.thread(await supportIdentity(c)) });
  });

  app.get('/api/support/unread', async (c) => {
    if (!support) return c.json({ unread: 0 });
    return c.json({ unread: await support.unread(await supportIdentity(c)) });
  });

  app.post('/api/support', async (c) => {
    if (!support) return supportOff(c);
    if (!allowAuth(clientKey(c))) return c.json({ error: 'Trop de messages en peu de temps. Réessayez plus tard.' }, 429);
    const parsed = SupportMessageInput.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: 'Écrivez votre message (2 000 caractères maximum).' }, 400);
    const who = await supportIdentity(c);
    const res = await support.post(who, parsed.data);
    return c.json({ ...res, messages: await support.thread({ ...who, secret: res.secret ?? who.secret }) });
  });

  app.get('/api/admin/support', async (c) => {
    if (!support || !isAdmin(c)) return c.json({ error: 'Accès refusé.' }, 403);
    return c.json({ threads: await support.adminList() });
  });

  app.get('/api/admin/support/:id', async (c) => {
    if (!support || !isAdmin(c)) return c.json({ error: 'Accès refusé.' }, 403);
    try {
      return c.json({ messages: await support.adminThread(Number(c.req.param('id'))) });
    } catch (error) {
      return supportError(c, error);
    }
  });

  app.post('/api/admin/support/:id', async (c) => {
    if (!support || !isAdmin(c)) return c.json({ error: 'Accès refusé.' }, 403);
    const body = (await c.req.json().catch(() => null)) as { body?: unknown } | null;
    try {
      await support.adminReply(Number(c.req.param('id')), String(body?.body ?? ''));
      return c.json({ messages: await support.adminThread(Number(c.req.param('id'))) });
    } catch (error) {
      return supportError(c, error);
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
    '/api/ai/interview',
    aiRoute('interview', InterviewRequest, (ai, body) => ai.interview(body), (body) =>
      !body.job.text.trim() && !body.job.file ? 'Collez le texte de l’offre ou joignez le fichier de l’annonce.' : null,
    ),
  );

  app.post(
    '/api/ai/revise',
    aiRoute('revise', ReviseRequest, (ai, body) => ai.revise(body), (body) =>
      !body.instructions.trim() ? 'Dites ou écrivez ce qu’il faut corriger.' : null,
    ),
  );

  app.post(
    '/api/ai/analyze-template',
    aiRoute('analyze-template', AnalyzeTemplateRequest, (ai, body) => ai.analyzeTemplate(body), (body) =>
      body.file.mediaType === 'text/plain' ? 'Importez une image ou un PDF du CV modèle.' : null,
    ),
  );

  app.post(
    '/api/ai/translate',
    aiRoute('translate', TranslateRequest, (ai, body) => ai.translate(body)),
  );

  return app;
}
