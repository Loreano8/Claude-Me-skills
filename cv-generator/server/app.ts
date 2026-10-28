import { Hono, type Context } from 'hono';
import { cors } from 'hono/cors';
import { bodyLimit } from 'hono/body-limit';
import { z } from 'zod';
import { AdaptRequest, AnalyzeTemplateRequest, ClarifyRequest, LetterQuestionsRequest, StyleRequest, TranscribeRequest, CoverLetterRequest, JobFetchRequest, InterviewRequest, ReviseRequest, StructureRequest, TranslateRequest } from '../shared/schema.ts';
import { AiError, type Ai } from './ai.ts';
import { AccountError, DOSSIER_COST, REFERRAL_BONUS, UNLOCK_COST, type Accounts, type User } from './accounts.ts';
import { signToken, verifyToken } from './auth.ts';
import { PACKS, PaymentError, type Payments } from './payments.ts';
import { TestimonialInput, type Testimonials } from './testimonials.ts';
import { SupportError, SupportMessageInput, type Support } from './support.ts';
import { fetchJobPage, JobPageError } from './jobPage.ts';
import type { Vault } from './vault.ts';
import { RecoveryInput, type Recovery } from './recovery.ts';

export interface AppOptions {
  /** Téléchargement des pages d'offres (remplaçable dans les tests). */
  fetchPage?: typeof fetchJobPage;
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
  /** Coffre-fort (double de la clé) et codes envoyés par e-mail. */
  vault?: Vault | null;
  /** Récupération de compte par formulaire (phrase secrète), validée par l'administrateur. */
  recovery?: Recovery | null;
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

export function createApp({ fetchPage = fetchJobPage, ai, allowedOrigins, rateLimitPerHour, accounts = null, payments = null, testimonials = null, support = null, vault = null, recovery = null, sessionSecret = '', publicUrl = '', apiPublicUrl = '', adminToken = '' }: AppOptions) {
  const app = new Hono();
  const allow = createRateLimiter(rateLimitPerHour);
  const allowAuth = createRateLimiter(20);
  const allowFree = createRateLimiter(30);

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
    return c.json(
      { ok: db !== false, ai: ai !== null, accounts: accounts !== null, payments: payments !== null, email: vault?.emailEnabled ?? false, db },
      db === false ? 503 : 200,
    );
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

  // Offre de retour : consultée à chaque ouverture de l'appli (c'est ce qui l'ouvre au retour).
  app.get('/api/offer', async (c) => {
    const user = await currentUser(c);
    if (!user) return c.json({ error: 'Session expirée. Reconnectez-vous.' }, 401);
    if (!payments) return c.json({ active: null, possible: false, notBefore: null });
    return c.json(await payments.returnOffer(user));
  });

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
  // Compte bloqué (mot de passe oublié, sans e-mail) : l'administrateur donne un mot de passe provisoire,
  // transmis à la personne par « Nous contacter ». Elle pourra le changer ensuite.
  app.post('/api/admin/password', async (c) => {
    if (!accounts || !adminToken || c.req.header('authorization') !== `Bearer ${adminToken}`) {
      return c.json({ error: 'Accès refusé.' }, 403);
    }
    const body = (await c.req.json().catch(() => null)) as { identifier?: string } | null;
    const user = await accounts.findByIdentifier(String(body?.identifier ?? ''));
    if (!user) return c.json({ error: 'Aucun compte avec cet identifiant.' }, 404);
    const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
    const password = Array.from(crypto.getRandomValues(new Uint32Array(10)), (n) => alphabet[n % alphabet.length]).join('');
    await accounts.setPassword(user.id, password);
    return c.json({ identifier: user.identifier, password });
  });

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
  /** Débite un service sans IA (le document reste sur l'appareil : le serveur ne fait que débiter). */
  function spendRoute(reason: string, cost: number, what: string, authMessage: string) {
    return async (c: Context) => {
      if (!accounts) return c.json({ credits: null });
      const user = await currentUser(c);
      if (!user) return c.json({ error: authMessage, code: 'auth' }, 401);
      try {
        const credits = await accounts.spend(user.id, reason, cost);
        c.header('X-Credits-Remaining', String(credits));
        return c.json({ credits });
      } catch (error) {
        if (error instanceof AccountError && error.status === 402) {
          return c.json({ error: `${what} coûte ${cost} crédit${cost > 1 ? 's' : ''}. Rechargez pour continuer.`, code: 'credits' }, 402);
        }
        return accountError(c, error);
      }
    };
  }

  app.post('/api/unlock', spendRoute('unlock', UNLOCK_COST, 'La version Pro', 'Créez un compte gratuit ou connectez-vous pour passer en version Pro.'));
  // Dossier ou scan au-delà de la limite gratuite.
  app.post('/api/dossier/unlock', spendRoute('dossier', DOSSIER_COST, 'Ce dossier', 'Créez un compte gratuit ou connectez-vous pour créer ce dossier.'));

  // ---- Coffre-fort et codes par e-mail ----------------------------------------

  const vaultError = (c: Context, error: unknown) => {
    if (error instanceof AccountError) return c.json({ error: error.message }, error.status as 400);
    console.error(error);
    return c.json({ error: 'Envoi impossible pour le moment. Réessayez plus tard.' }, 502);
  };
  const body = async (c: Context) => ((await c.req.json().catch(() => null)) ?? {}) as Record<string, unknown>;

  app.post('/api/vault/key', async (c) => {
    if (!vault) return c.json({ error: 'Coffre-fort indisponible.' }, 503);
    const user = await currentUser(c);
    if (!user) return c.json({ error: 'Connectez-vous pour protéger votre coffre-fort.', code: 'auth' }, 401);
    try {
      await vault.saveKey(user.id, String((await body(c)).key ?? ''));
      return c.json({ ok: true });
    } catch (error) {
      return vaultError(c, error);
    }
  });

  app.post('/api/vault/recover', async (c) => {
    if (!vault) return c.json({ error: 'Coffre-fort indisponible.' }, 503);
    if (!allowAuth(clientKey(c))) return c.json({ error: 'Trop de tentatives. Réessayez plus tard.' }, 429);
    const user = await currentUser(c);
    if (!user) return c.json({ error: 'Connectez-vous à votre compte pour réinitialiser le code.', code: 'auth' }, 401);
    const b = await body(c);
    try {
      const key = b.code ? await vault.recoverWithCode(user, String(b.code)) : await vault.recoverWithPassword(user, String(b.password ?? ''));
      return c.json({ key });
    } catch (error) {
      if (error instanceof AccountError && error.status === 401) return c.json({ error: 'Mot de passe incorrect.' }, 400);
      return vaultError(c, error);
    }
  });

  app.post('/api/vault/recover/email', async (c) => {
    if (!vault) return c.json({ error: 'Coffre-fort indisponible.' }, 503);
    if (!allowAuth(clientKey(c))) return c.json({ error: 'Trop de demandes. Réessayez plus tard.' }, 429);
    const user = await currentUser(c);
    if (!user) return c.json({ error: 'Connectez-vous à votre compte pour réinitialiser le code.', code: 'auth' }, 401);
    try {
      return c.json(await vault.sendVaultCode(user));
    } catch (error) {
      return vaultError(c, error);
    }
  });

  // Mot de passe du compte oublié : code envoyé à l'e-mail du compte, puis nouveau mot de passe.
  app.post('/api/auth/forgot', async (c) => {
    if (!vault) return c.json({ error: 'Indisponible.' }, 503);
    if (!allowAuth(clientKey(c))) return c.json({ error: 'Trop de demandes. Réessayez plus tard.' }, 429);
    try {
      const sent = await vault.sendPasswordCode(String((await body(c)).identifier ?? ''));
      return c.json({ ok: true, to: sent?.to ?? null });
    } catch (error) {
      return vaultError(c, error);
    }
  });

  app.post('/api/auth/reset', async (c) => {
    if (!vault || !accounts) return c.json({ error: 'Indisponible.' }, 503);
    if (!allowAuth(clientKey(c))) return c.json({ error: 'Trop de tentatives. Réessayez plus tard.' }, 429);
    const b = await body(c);
    try {
      const user = await vault.resetPassword(String(b.identifier ?? ''), String(b.code ?? ''), String(b.password ?? ''));
      return c.json({ token: signToken(user.id, sessionSecret), user: publicUser(user) });
    } catch (error) {
      return vaultError(c, error);
    }
  });

  // ---- Phrase secrète, changement de mot de passe, récupération de compte -----

  app.get('/api/account/secret', async (c) => {
    const user = await currentUser(c);
    if (!user || !recovery) return c.json({ error: 'Connectez-vous.', code: 'auth' }, 401);
    return c.json(await recovery.secretStatus(user.id));
  });

  app.post('/api/account/secret', async (c) => {
    const user = await currentUser(c);
    if (!user || !recovery) return c.json({ error: 'Connectez-vous.', code: 'auth' }, 401);
    try {
      const b = await body(c);
      await recovery.setSecret(user.id, String(b.phrase ?? ''), b.question ? String(b.question) : null);
      return c.json({ set: true });
    } catch (error) {
      return vaultError(c, error);
    }
  });

  app.post('/api/account/password', async (c) => {
    if (!allowAuth(clientKey(c))) return c.json({ error: 'Trop de tentatives. Réessayez plus tard.' }, 429);
    const user = await currentUser(c);
    if (!user || !accounts) return c.json({ error: 'Connectez-vous.', code: 'auth' }, 401);
    const b = await body(c);
    const next = String(b.password ?? '');
    if (next.length < 6) return c.json({ error: 'Le mot de passe doit faire au moins 6 caractères.' }, 400);
    try {
      await accounts.login(user.identifier, String(b.current ?? ''));
    } catch {
      return c.json({ error: 'Mot de passe actuel incorrect.' }, 400);
    }
    await accounts.setPassword(user.id, next);
    return c.json({ ok: true });
  });

  app.get('/api/auth/recovery/question', async (c) => {
    if (!recovery) return c.json({ question: null });
    if (!allowAuth(clientKey(c))) return c.json({ error: 'Trop de demandes. Réessayez plus tard.' }, 429);
    return c.json({ question: await recovery.questionFor(c.req.query('identifier') ?? '') });
  });

  app.post('/api/auth/recovery', async (c) => {
    if (!recovery) return c.json({ error: 'Indisponible.' }, 503);
    if (!allowAuth(clientKey(c))) return c.json({ error: 'Trop de demandes. Réessayez plus tard.' }, 429);
    const parsed = RecoveryInput.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: 'Indiquez au moins l’e-mail ou le téléphone de votre compte.' }, 400);
    return c.json(await recovery.request(await supportIdentity(c), parsed.data));
  });

  app.get('/api/admin/recovery', async (c) => {
    if (!recovery || !isAdmin(c)) return c.json({ error: 'Accès refusé.' }, 403);
    return c.json({ requests: await recovery.adminList() });
  });

  app.post('/api/admin/recovery/:id', async (c) => {
    if (!recovery || !isAdmin(c)) return c.json({ error: 'Accès refusé.' }, 403);
    try {
      return c.json(await recovery.decide(Number(c.req.param('id')), (await body(c)).approve === true));
    } catch (error) {
      return vaultError(c, error);
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
    const { threadId: _thread, ...res } = await support.post(who, parsed.data);
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
    /** Action gratuite (compte exigé, aucun crédit débité), avec sa propre limite. */
    free = false,
    /** Nombre de crédits de l'action (1 par défaut). */
    cost: (body: z.output<S>) => number = () => 1,
  ) {
    return async (c: Context) => {
      if (!ai) {
        return c.json({ error: 'Les fonctions IA ne sont pas configurées sur ce serveur (ANTHROPIC_API_KEY manquante).' }, 503);
      }
      if (!(free ? allowFree : allow)(clientKey(c))) {
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
        if (!user) return c.json({ error: 'Créez un compte gratuit ou connectez-vous pour continuer.', code: 'auth' }, 401);
        if (!free) {
          try {
            const remaining = await accounts.spend(user.id, action, cost(parsed.data));
            c.header('X-Credits-Remaining', String(remaining));
          } catch (error) {
            if (error instanceof AccountError && error.status === 402) {
              const n = cost(parsed.data);
              const message = n > 1 ? `Cette action coûte ${n} crédits. Rechargez pour continuer.` : 'Vous n’avez plus de crédits. Rechargez pour continuer.';
              return c.json({ error: message, code: 'credits' }, 402);
            }
            return accountError(c, error);
          }
        }
      }
      try {
        return c.json(await handler(ai, parsed.data));
      } catch (error) {
        if (user && accounts && !free) {
          const credits = await accounts.refund(user.id, action, cost(parsed.data)).catch(() => null);
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
      !body.text.trim() && !body.file && !body.files.length && !body.current ? 'Écrivez quelques informations ou joignez un ancien CV.' : null,
    ),
  );

  // Lecture d'une offre à partir de son lien : gratuite, sans compte.
  app.post('/api/job/fetch', async (c) => {
    if (!allowFree(clientKey(c))) return c.json({ error: 'Trop de demandes en peu de temps. Réessayez plus tard.' }, 429);
    const parsed = JobFetchRequest.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: 'Lien invalide.' }, 400);
    try {
      return c.json(await fetchPage(parsed.data.url));
    } catch (error) {
      if (error instanceof JobPageError) return c.json({ error: error.message }, error.status as 400);
      console.error(error);
      return c.json({ error: 'Impossible de lire ce lien. Copiez le texte de l’annonce.' }, 502);
    }
  });

  // Questions sur l'offre avant l'adaptation (poste à choisir, exigence absente du CV…) : gratuites.
  app.post(
    '/api/ai/clarify',
    aiRoute(
      'clarify',
      ClarifyRequest,
      (ai, body) => ai.clarify(body),
      (body) => (!body.job.text.trim() && !body.job.file ? 'Collez le texte de l’offre ou joignez le fichier de l’annonce.' : null),
      true,
    ),
  );

  // Document manuscrit (ou imprimé) photographié → texte tapé : 1 crédit par page.
  app.post(
    '/api/ai/transcribe',
    aiRoute(
      'transcribe',
      TranscribeRequest,
      (ai, body) => ai.transcribe(body),
      (body) => (body.files.some((f) => f.mediaType === 'text/plain') ? 'Envoyez des photos ou des PDF du document.' : null),
      false,
      (body) => body.files.length,
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

  // « Écrire comme moi » : analyse du style d'écriture, gratuite.
  app.post(
    '/api/ai/style',
    aiRoute(
      'style',
      StyleRequest,
      (ai, body) => ai.style(body),
      (body) => (!body.text.trim() && !body.files.length ? 'Importez un document que vous avez écrit, ou collez un texte.' : null),
      true,
    ),
  );

  // Questions avant la lettre (motivation, exemple vécu) : gratuites.
  app.post('/api/ai/letter-questions', aiRoute('letter-questions', LetterQuestionsRequest, (ai, body) => ai.letterQuestions(body), undefined, true));

  app.post(
    '/api/ai/translate',
    aiRoute('translate', TranslateRequest, (ai, body) => ai.translate(body)),
  );

  return app;
}
