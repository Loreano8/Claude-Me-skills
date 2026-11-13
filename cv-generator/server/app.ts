import { Hono, type Context } from 'hono';
import { cors } from 'hono/cors';
import { bodyLimit } from 'hono/body-limit';
import { z } from 'zod';
import { AdaptRequest, AnalyzeTemplateRequest, ClarifyRequest, KeywordsRequest, LetterQuestionsRequest, StyleRequest, TranscribeRequest, CoverLetterRequest, JobFetchRequest, InterviewRequest, ReviseRequest, StructureRequest, TranslateRequest } from '../shared/schema.ts';
import { AiError, type Ai } from './ai.ts';
import { AccountError, DOSSIER_COST, REFERRAL_BONUS, UNLOCK_COST, type Accounts, type User } from './accounts.ts';
import { signToken, verifyToken } from './auth.ts';
import { PACKS, PaymentError, type Payments } from './payments.ts';
import { TestimonialInput, type Testimonials } from './testimonials.ts';
import { SupportError, SupportMessageInput, type Support } from './support.ts';
import { fetchJobPage, JobPageError } from './jobPage.ts';
import type { Mailer, Vault } from './vault.ts';
import { AmbassadorError, type Ambassadors } from './ambassadors.ts';
import type { Sources } from './sources.ts';
import { RecoveryInput, type Recovery } from './recovery.ts';
import { memoryRateLimiter, type RateLimiter } from './rateLimit.ts';
import { ShareError, type Shares } from './shares.ts';
import type { Turnstile } from './turnstile.ts';
import { WatchError, type Watches } from './watch.ts';
import { LetterTranslateRequest, WatchSaveRequest } from '../shared/schema.ts';
import { isUiLang, translate, type UiLang } from '../shared/i18n.ts';
import { createHash, createHmac, randomInt, timingSafeEqual } from 'node:crypto';

export interface AppOptions {
  /** Téléchargement des pages d'offres (remplaçable dans les tests). */
  fetchPage?: typeof fetchJobPage;
  ai: Ai | null;
  /** Le même moteur, pour une interface en anglais (conseils, questions et analyses en anglais). */
  aiEn?: Ai | null;
  allowedOrigins: string[];
  rateLimitPerHour: number;
  /** Limite des tentatives de connexion et de codes (en base quand elle existe, pour survivre aux redémarrages). */
  authLimiter?: RateLimiter | null;
  /** CV partagés par lien ou QR code. */
  shares?: Shares | null;
  /** Veille emploi (recherche d'offres chaque matin ou chaque semaine). */
  watches?: Watches | null;
  /** Secret des appels automatiques (planificateur de la base) qui lancent les veilles. */
  cronSecret?: string;
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
  /** Provenance des visiteurs (liens de pub). */
  sources?: Sources | null;
  sessionSecret?: string;
  /** Adresse publique du site, pour revenir après un paiement. */
  publicUrl?: string;
  /** Adresse publique de l'API (ex. fonction Supabase), si elle diffère de celle de la requête. */
  apiPublicUrl?: string;
  /** Jeton secret de l'administrateur (ajout manuel de crédits). */
  adminToken?: string;
  /** Deuxième vérification de l'administrateur : un code envoyé à cette adresse (actif si les deux sont réglés). */
  adminEmail?: string;
  adminMailer?: Mailer | null;
  /** Programme Ambassadeur (gains en FCFA pour les filleuls). */
  ambassadors?: Ambassadors | null;
  /** Vérification anti-robot (inscription, message sans compte). Absente : pas de vérification. */
  turnstile?: Turnstile | null;
}

// Limite simple en mémoire : suffisante pour une seule instance du serveur.
/** Langue de l'interface de la personne (en-tête X-Lang envoyé par le site et l'application). */
export function uiLang(c: Context): UiLang {
  const l = c.req.header('x-lang');
  return isUiLang(l) ? l : 'fr';
}

function clientKey(c: Context): string {
  return c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || c.req.header('x-real-ip') || 'local';
}

const Credentials = z.object({
  identifier: z.string().max(120),
  password: z.string().max(200),
  name: z.string().max(80).optional(),
  referralCode: z.string().max(20).optional(),
  /** Provenance du visiteur (lien de pub ?src=…). */
  source: z.string().max(60).optional(),
});

export function createApp({ fetchPage = fetchJobPage, ai, aiEn = null, allowedOrigins, rateLimitPerHour, accounts = null, payments = null, testimonials = null, support = null, vault = null, recovery = null, sources = null, sessionSecret = '', publicUrl = '', apiPublicUrl = '', adminToken = '', adminEmail = '', adminMailer = null, ambassadors = null, authLimiter = null, shares = null, watches = null, cronSecret = '', turnstile = null }: AppOptions) {
  const app = new Hono();
  const allow = memoryRateLimiter(rateLimitPerHour);
  const allowAuth = authLimiter ?? memoryRateLimiter(20);
  const allowFree = memoryRateLimiter(30);

  app.use('/api/*', cors({ origin: allowedOrigins, allowMethods: ['GET', 'POST'], exposeHeaders: ['X-Credits-Remaining'] }));
  app.use(
    '/api/*',
    bodyLimit({
      maxSize: 15 * 1024 * 1024,
      onError: (c) => c.json({ error: 'Fichier trop volumineux (15 Mo maximum).' }, 413),
    }),
  );

  // Interface en anglais (en-tête X-Lang: en) : les messages d'erreur partent en anglais.
  app.use('/api/*', async (c, next) => {
    await next();
    if (uiLang(c) !== 'en' || c.res.status < 400 || !c.res.headers.get('content-type')?.includes('application/json')) return;
    const data = (await c.res.clone().json().catch(() => null)) as { error?: unknown } | null;
    if (!data || typeof data.error !== 'string') return;
    const headers = new Headers(c.res.headers);
    headers.delete('content-length');
    c.res = new Response(JSON.stringify({ ...data, error: translate('en', data.error) }), { status: c.res.status, headers });
  });

  app.get('/api/health', async (c) => {
    // Appelée chaque jour par une tâche automatique : la requête à la base empêche la mise en veille du projet.
    const db = accounts ? await accounts.ping().catch(() => false) : null;
    return c.json(
      { ok: db !== false, ai: ai !== null, accounts: accounts !== null, payments: payments !== null, email: vault?.emailEnabled ?? false, db, captcha: turnstile?.siteKey ?? null },
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
    if (!(await allowAuth(clientKey(c)))) return c.json({ error: 'Trop de tentatives. Réessayez plus tard.' }, 429);
    const raw = (await c.req.json().catch(() => null)) as { captcha?: unknown } | null;
    const parsed = Credentials.safeParse(raw);
    if (!parsed.success) return c.json({ error: 'Requête invalide.' }, 400);
    if (turnstile && !(await turnstile.verify(String(raw?.captcha ?? ''), clientKey(c)))) {
      return c.json({ error: 'La vérification anti-robot n’a pas abouti. Réessayez.', code: 'captcha' }, 400);
    }
    try {
      const user = await accounts.register({ ...parsed.data, ip: clientKey(c), device: c.req.header('x-device-id') ?? '' });
      return c.json({ token: signToken(user.id, sessionSecret), user: publicUser(user) });
    } catch (error) {
      return accountError(c, error);
    }
  });

  app.post('/api/auth/login', async (c) => {
    if (!accounts) return c.json({ error: 'Les comptes ne sont pas activés sur ce serveur.' }, 503);
    if (!(await allowAuth(clientKey(c)))) return c.json({ error: 'Trop de tentatives. Réessayez plus tard.' }, 429);
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

  // Espace administrateur, deux serrures :
  // 1. le jeton secret (comparé à durée constante ; essais ratés limités par adresse) ;
  // 2. un code à 6 chiffres envoyé par e-mail à l'administrateur, qui ouvre une session de 12 h.
  // Sans adresse ou sans envoi d'e-mails configurés (développement, tests), le jeton seul suffit.
  const digest = (v: string) => createHash('sha256').update(v).digest();
  const same = (a: string, b: string) => timingSafeEqual(digest(a), digest(b));
  const tokenOk = (c: Context) => Boolean(adminToken) && same(c.req.header('authorization') ?? '', `Bearer ${adminToken}`);
  const twoStep = Boolean(adminEmail && adminMailer);
  // Clé de signature liée au jeton : changer ADMIN_TOKEN ferme toutes les sessions ouvertes.
  const adminSign = (v: string) => createHmac('sha256', `${sessionSecret}|${adminToken}`).update(v).digest('base64url');
  const signedOk = (value: string, kind: string, extra = '') => {
    const [exp, sig] = value.split('.');
    return Boolean(exp && sig) && Number(exp) > Date.now() && same(sig, adminSign(`${kind}|${exp}|${extra}`));
  };
  const isAdmin = (c: Context) => tokenOk(c) && (!twoStep || signedOk(c.req.header('x-admin-session') ?? '', 'session'));
  const refuse = async (c: Context) => {
    if (!(await allowAuth(`admin:${clientKey(c)}`))) return c.json({ error: 'Trop de tentatives. Réessayez plus tard.' }, 429);
    return c.json({ error: 'Accès refusé.' }, 403);
  };
  app.use('/api/admin/*', async (c, next) => {
    const step = c.req.path === '/api/admin/code' || c.req.path === '/api/admin/verify';
    if (step ? tokenOk(c) : isAdmin(c)) return next();
    return refuse(c);
  });

  // Étape 2 : envoi du code (valable 10 minutes) à l'adresse de l'administrateur.
  app.post('/api/admin/code', async (c) => {
    if (!twoStep) return c.json({ session: '', twoStep: false });
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const exp = Date.now() + 10 * 60_000;
    try {
      await adminMailer!(adminEmail, `Code CVCasa administrateur : ${code}`, `Votre code pour ouvrir l'espace administrateur CVCasa : ${code}\n\nIl est valable 10 minutes. Si vous n'avez rien demandé, quelqu'un connaît votre jeton administrateur : changez ADMIN_TOKEN.`);
    } catch (error) {
      console.error('Code administrateur', error);
      return c.json({ error: 'Envoi du code impossible pour le moment. Réessayez.' }, 502);
    }
    const [user, domain] = adminEmail.split('@');
    return c.json({ twoStep: true, challenge: `${exp}.${adminSign(`code|${exp}|${code}`)}`, to: `${user.slice(0, 2)}•••@${domain}` });
  });

  // Vérification du code : ouvre une session de 12 h (le code n'est jamais gardé, seulement sa signature).
  app.post('/api/admin/verify', async (c) => {
    if (!twoStep) return c.json({ session: '' });
    const b = (await c.req.json().catch(() => null)) as { challenge?: string; code?: string } | null;
    const code = String(b?.code ?? '').replace(/\D/g, '');
    if (!(await allowAuth(`admin-code:${clientKey(c)}`))) return c.json({ error: 'Trop de tentatives. Réessayez plus tard.' }, 429);
    if (code.length !== 6 || !signedOk(String(b?.challenge ?? ''), 'code', code)) return c.json({ error: 'Code incorrect ou expiré.' }, 400);
    const exp = Date.now() + 12 * 3600_000;
    return c.json({ session: `${exp}.${adminSign(`session|${exp}|`)}` });
  });

  // ——— Programme Ambassadeur ———
  const ambassadorError = (c: Context, error: unknown) => {
    if (error instanceof AmbassadorError) return c.json({ error: error.message }, error.status as 400);
    console.error(error);
    return c.json({ error: 'Erreur interne du serveur.' }, 500);
  };
  const tellAdmin = (subject: string, text: string) => {
    if (adminMailer && adminEmail) void adminMailer(adminEmail, subject, text).catch((e) => console.error('Alerte admin', e));
  };

  app.get('/api/ambassador', async (c) => {
    const user = await currentUser(c);
    if (!user || !accounts || !ambassadors) return c.json({ error: 'Connectez-vous pour voir votre espace ambassadeur.' }, 401);
    const [summary, referral] = await Promise.all([ambassadors.summary(user.id), accounts.referral(user.id)]);
    return c.json({ ...summary, code: referral.code });
  });

  app.post('/api/ambassador/apply', async (c) => {
    const user = await currentUser(c);
    if (!user || !accounts || !ambassadors) return c.json({ error: 'Connectez-vous pour devenir ambassadeur.' }, 401);
    const b = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
    try {
      const before = await ambassadors.summary(user.id);
      const summary = await ambassadors.apply(user.id, {
        firstName: String(b?.firstName ?? ''),
        lastName: String(b?.lastName ?? ''),
        momoNumber: String(b?.momoNumber ?? ''),
        motivation: String(b?.motivation ?? ''),
        contractVersion: String(b?.contractVersion ?? ''),
        accept: b?.accept === true,
        signature: String(b?.signature ?? ''),
        signatureImage: String(b?.signatureImage ?? ''),
        ip: clientKey(c),
      });
      if (!before.status || before.status === 'refused') tellAdmin('CVCasa : nouvelle demande d’ambassadeur', `Nouvelle demande d'ambassadeur : ${summary.momoName} (${user.identifier}), contrat signé. À valider dans l'espace administrateur.`);
      return c.json(summary);
    } catch (error) {
      return ambassadorError(c, error);
    }
  });

  // Code de parrainage personnalisé : réservé aux ambassadeurs (en attente ou validés).
  app.post('/api/ambassador/code', async (c) => {
    const user = await currentUser(c);
    if (!user || !accounts || !ambassadors) return c.json({ error: 'Connectez-vous pour continuer.' }, 401);
    const b = (await c.req.json().catch(() => null)) as { code?: string } | null;
    try {
      const s = await ambassadors.summary(user.id);
      if (s.status !== 'active' && s.status !== 'pending') return c.json({ error: 'Le code personnalisé est réservé aux ambassadeurs.' }, 403);
      const code = await accounts.setReferralCode(user.id, String(b?.code ?? ''));
      return c.json({ ...s, code });
    } catch (error) {
      if (error instanceof AccountError) return accountError(c, error);
      return ambassadorError(c, error);
    }
  });

  app.post('/api/ambassador/number', async (c) => {
    const user = await currentUser(c);
    if (!user || !accounts || !ambassadors) return c.json({ error: 'Connectez-vous pour continuer.' }, 401);
    const b = (await c.req.json().catch(() => null)) as { momoNumber?: string; documents?: unknown } | null;
    try {
      const change = await ambassadors.requestNumberChange(user.id, { momoNumber: String(b?.momoNumber ?? ''), documents: Array.isArray(b?.documents) ? (b!.documents as never) : [] });
      tellAdmin('CVCasa : changement de numéro ambassadeur', `${user.identifier} demande à recevoir ses gains sur ${change.newNumber} (au lieu de ${change.oldNumber}). Justificatifs à vérifier dans l'espace administrateur.`);
      return c.json(await ambassadors.summary(user.id));
    } catch (error) {
      return ambassadorError(c, error);
    }
  });

  app.post('/api/ambassador/payout', async (c) => {
    const user = await currentUser(c);
    if (!user || !accounts || !ambassadors) return c.json({ error: 'Connectez-vous pour demander un retrait.' }, 401);
    try {
      const payout = await ambassadors.requestPayout(user.id);
      tellAdmin('CVCasa : demande de retrait ambassadeur', `${user.identifier} demande un retrait de ${payout.amount} FCFA : envoyez ${payout.net} FCFA par Mobile Money (frais de ${payout.fee} FCFA déduits), puis marquez « Payé » dans l'espace administrateur.`);
      return c.json(await ambassadors.summary(user.id));
    } catch (error) {
      return ambassadorError(c, error);
    }
  });

  app.get('/api/admin/ambassadors', async (c) => {
    if (!ambassadors || !isAdmin(c)) return c.json({ error: 'Accès refusé.' }, 403);
    return c.json(await ambassadors.adminList());
  });

  app.post('/api/admin/ambassadors/:id', async (c) => {
    if (!ambassadors || !isAdmin(c)) return c.json({ error: 'Accès refusé.' }, 403);
    const b = (await c.req.json().catch(() => null)) as { status?: string } | null;
    try {
      await ambassadors.setStatus(Number(c.req.param('id')), String(b?.status ?? '') as never);
      return c.json(await ambassadors.adminList());
    } catch (error) {
      return ambassadorError(c, error);
    }
  });

  app.post('/api/admin/ambassadors/:id/cancel', async (c) => {
    if (!ambassadors || !isAdmin(c)) return c.json({ error: 'Accès refusé.' }, 403);
    try {
      await ambassadors.cancelUnpaid(Number(c.req.param('id')));
      return c.json(await ambassadors.adminList());
    } catch (error) {
      return ambassadorError(c, error);
    }
  });

  app.get('/api/admin/number-changes/:id', async (c) => {
    if (!ambassadors || !isAdmin(c)) return c.json({ error: 'Accès refusé.' }, 403);
    try {
      return c.json({ documents: await ambassadors.numberChangeDocuments(Number(c.req.param('id'))) });
    } catch (error) {
      return ambassadorError(c, error);
    }
  });

  app.post('/api/admin/number-changes/:id', async (c) => {
    if (!ambassadors || !isAdmin(c)) return c.json({ error: 'Accès refusé.' }, 403);
    const b = (await c.req.json().catch(() => null)) as { approve?: boolean; note?: string } | null;
    try {
      await ambassadors.decideNumberChange(Number(c.req.param('id')), b?.approve === true, String(b?.note ?? ''));
      return c.json(await ambassadors.adminList());
    } catch (error) {
      return ambassadorError(c, error);
    }
  });

  app.post('/api/admin/payouts/:id', async (c) => {
    if (!ambassadors || !isAdmin(c)) return c.json({ error: 'Accès refusé.' }, 403);
    const b = (await c.req.json().catch(() => null)) as { decision?: string; note?: string } | null;
    const decision = b?.decision === 'paid' ? 'paid' : b?.decision === 'refused' ? 'refused' : null;
    if (!decision) return c.json({ error: 'Décision inconnue.' }, 400);
    try {
      await ambassadors.decidePayout(Number(c.req.param('id')), decision, String(b?.note ?? ''));
      return c.json(await ambassadors.adminList());
    } catch (error) {
      return ambassadorError(c, error);
    }
  });

  // Ajout manuel de crédits (ex. paiement reçu directement par mobile money).
  // Compte bloqué (mot de passe oublié, sans e-mail) : l'administrateur donne un mot de passe provisoire,
  // transmis à la personne par « Nous contacter ». Elle pourra le changer ensuite.
  app.post('/api/admin/password', async (c) => {
    if (!accounts || !isAdmin(c)) {
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
    if (!accounts || !isAdmin(c)) {
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
    if (!(await allowAuth(clientKey(c)))) return c.json({ error: 'Trop de tentatives. Réessayez plus tard.' }, 429);
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
    if (!(await allowAuth(clientKey(c)))) return c.json({ error: 'Trop de demandes. Réessayez plus tard.' }, 429);
    const user = await currentUser(c);
    if (!user) return c.json({ error: 'Connectez-vous à votre compte pour réinitialiser le code.', code: 'auth' }, 401);
    try {
      return c.json(await vault.sendVaultCode(user, uiLang(c)));
    } catch (error) {
      return vaultError(c, error);
    }
  });

  // Mot de passe du compte oublié : code envoyé à l'e-mail du compte, puis nouveau mot de passe.
  app.post('/api/auth/forgot', async (c) => {
    if (!vault) return c.json({ error: 'Indisponible.' }, 503);
    if (!(await allowAuth(clientKey(c)))) return c.json({ error: 'Trop de demandes. Réessayez plus tard.' }, 429);
    try {
      const sent = await vault.sendPasswordCode(String((await body(c)).identifier ?? ''), uiLang(c));
      return c.json({ ok: true, to: sent?.to ?? null });
    } catch (error) {
      return vaultError(c, error);
    }
  });

  app.post('/api/auth/reset', async (c) => {
    if (!vault || !accounts) return c.json({ error: 'Indisponible.' }, 503);
    if (!(await allowAuth(clientKey(c)))) return c.json({ error: 'Trop de tentatives. Réessayez plus tard.' }, 429);
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

  app.post('/api/account/name', async (c) => {
    const user = await currentUser(c);
    if (!user || !accounts) return c.json({ error: 'Session expirée. Reconnectez-vous.' }, 401);
    const name = String((await body(c)).name ?? '').trim();
    if (name.length < 1 || name.length > 60) return c.json({ error: 'Indiquez un prénom (60 caractères au plus).' }, 400);
    const updated = await accounts.setName(user.id, name);
    return updated ? c.json({ user: publicUser(updated) }) : c.json({ error: 'Compte introuvable.' }, 404);
  });

  app.post('/api/account/password', async (c) => {
    if (!(await allowAuth(clientKey(c)))) return c.json({ error: 'Trop de tentatives. Réessayez plus tard.' }, 429);
    const user = await currentUser(c);
    if (!user || !accounts) return c.json({ error: 'Connectez-vous.', code: 'auth' }, 401);
    const b = await body(c);
    const next = String(b.password ?? '');
    if (next.length < 8) return c.json({ error: 'Le mot de passe doit faire au moins 8 caractères.' }, 400);
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
    if (!(await allowAuth(clientKey(c)))) return c.json({ error: 'Trop de demandes. Réessayez plus tard.' }, 429);
    return c.json({ question: await recovery.questionFor(c.req.query('identifier') ?? '') });
  });

  app.post('/api/auth/recovery', async (c) => {
    if (!recovery) return c.json({ error: 'Indisponible.' }, 503);
    if (!(await allowAuth(clientKey(c)))) return c.json({ error: 'Trop de demandes. Réessayez plus tard.' }, 429);
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

  // ---- CV partagés par lien ou QR code -------------------------------------------
  const shareError = (c: Context, error: unknown) => {
    if (error instanceof ShareError) return c.json({ error: error.message }, error.status);
    console.error('Partage', error);
    return c.json({ error: 'Partage impossible pour le moment.' }, 500);
  };
  const shareLink = (token: string) => `${(publicUrl || '').replace(/\/$/, '')}/v/#${token}`;

  app.post('/api/share', async (c) => {
    if (!shares) return c.json({ error: 'Partage indisponible.' }, 503);
    const user = await currentUser(c);
    if (!user) return c.json({ error: 'Créez un compte gratuit ou connectez-vous pour partager votre CV.', code: 'auth' }, 401);
    const b = await body(c);
    try {
      const share = await shares.publish(user.id, String(b.cvKey ?? ''), String(b.name ?? ''), String(b.pdf ?? ''));
      return c.json({ ...share, url: shareLink(share.token) });
    } catch (error) {
      return shareError(c, error);
    }
  });

  app.post('/api/share/status', async (c) => {
    if (!shares) return c.json({ share: null });
    const user = await currentUser(c);
    if (!user) return c.json({ share: null });
    const share = await shares.current(user.id, String((await body(c)).cvKey ?? ''));
    return c.json({ share: share ? { ...share, url: shareLink(share.token) } : null });
  });

  app.post('/api/share/stop', async (c) => {
    if (!shares) return c.json({ ok: true });
    const user = await currentUser(c);
    if (!user) return c.json({ error: 'Connectez-vous.', code: 'auth' }, 401);
    await shares.stop(user.id, String((await body(c)).cvKey ?? ''));
    return c.json({ ok: true });
  });

  // ---- Veille emploi ----------------------------------------------------------

  const watchError = (c: Context, error: unknown) => {
    if (error instanceof WatchError) return c.json({ error: error.message, code: error.code || undefined }, error.status);
    return accountError(c, error);
  };
  const watchUser = async (c: Context) => (watches && watches.enabled ? currentUser(c) : null);

  app.get('/api/watch', async (c) => {
    if (!watches?.enabled) return c.json({ available: false, watch: null, runs: [] });
    const user = await currentUser(c);
    if (!user) return c.json({ available: true, watch: null, runs: [] });
    return c.json({ available: true, ...(await watches.get(user.id)) });
  });

  app.post('/api/watch', async (c) => {
    const user = await watchUser(c);
    if (!watches?.enabled) return c.json({ error: 'La veille emploi n’est pas disponible.' }, 503);
    if (!user) return c.json({ error: 'Créez un compte gratuit ou connectez-vous pour lancer votre veille.', code: 'auth' }, 401);
    const parsed = WatchSaveRequest.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: 'Cochez au moins un métier, un type de contrat et une zone.' }, 400);
    return c.json({ watch: await watches.save(user.id, parsed.data) });
  });

  app.post('/api/watch/run', async (c) => {
    const user = await watchUser(c);
    if (!watches?.enabled) return c.json({ error: 'La veille emploi n’est pas disponible.' }, 503);
    if (!user) return c.json({ error: 'Créez un compte gratuit ou connectez-vous pour lancer votre veille.', code: 'auth' }, 401);
    if (!(await allow(clientKey(c)))) return c.json({ error: 'Trop de demandes en peu de temps. Réessayez dans une heure.' }, 429);
    try {
      const out = await watches.runNow(user);
      if (out.credits !== null) c.header('X-Credits-Remaining', String(out.credits));
      return c.json(out);
    } catch (error) {
      return watchError(c, error);
    }
  });

  app.post('/api/watch/start', async (c) => {
    const user = await watchUser(c);
    if (!watches?.enabled) return c.json({ error: 'La veille emploi n’est pas disponible.' }, 503);
    if (!user) return c.json({ error: 'Connectez-vous.', code: 'auth' }, 401);
    try {
      const out = await watches.start(user);
      c.header('X-Credits-Remaining', String(out.credits));
      return c.json(out);
    } catch (error) {
      return watchError(c, error);
    }
  });

  app.post('/api/watch/stop', async (c) => {
    const user = await watchUser(c);
    if (!watches?.enabled || !user) return c.json({ ok: true });
    await watches.stop(user.id);
    return c.json({ ok: true });
  });

  // Appelé toutes les 15 minutes par le planificateur de la base, avec un secret partagé.
  app.post('/api/watch/cron', async (c) => {
    const given = c.req.header('x-cron-secret') ?? '';
    if (!watches?.enabled || !cronSecret || !timingSafeEqual(digest(given), digest(cronSecret))) return c.json({ error: 'Non autorisé.' }, 401);
    return c.json(await watches.runDue());
  });

  // Lecture publique : le nom (pour la page de présentation) puis le PDF.
  app.get('/api/cv/:token/info', async (c) => {
    const found = shares && (await shares.open(c.req.param('token')));
    return found ? c.json({ name: found.name }) : c.json({ error: 'Ce lien a expiré ou a été arrêté.' }, 404);
  });
  app.get('/api/cv/:token', async (c) => {
    const found = shares && (await shares.open(c.req.param('token')));
    if (!found) return c.text('Ce lien a expiré ou a été arrêté.', 404);
    const file = `${found.name.replace(/[^\p{L}\p{N}]+/gu, '_') || 'CV'}.pdf`;
    return new Response(new Uint8Array(found.pdf), {
      headers: {
        'content-type': 'application/pdf',
        'content-disposition': `inline; filename="${encodeURIComponent(file)}"`,
        'cache-control': 'private, max-age=300',
        'x-robots-tag': 'noindex',
      },
    });
  });

  app.get('/api/testimonials', async (c) => c.json({ testimonials: testimonials ? await testimonials.listApproved() : [] }));

  app.post('/api/testimonials', async (c) => {
    if (!testimonials) return c.json({ error: 'Les témoignages ne sont pas activés sur ce serveur.' }, 503);
    if (!(await allowAuth(clientKey(c)))) return c.json({ error: 'Trop de tentatives. Réessayez plus tard.' }, 429);
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


  // Visite comptée une fois par session de navigation (aucune donnée personnelle).
  app.post('/api/visit', async (c) => {
    if (!sources) return c.json({ ok: true });
    if (!(await allowFree(clientKey(c)))) return c.json({ ok: true });
    const body = (await c.req.json().catch(() => null)) as { source?: unknown } | null;
    await sources.visit(String(body?.source ?? '')).catch((e) => console.error('Visite', e));
    return c.json({ ok: true });
  });

  app.get('/api/admin/sources', async (c) => {
    if (!sources || !isAdmin(c)) return c.json({ error: 'Accès refusé.' }, 403);
    const days = Math.min(365, Math.max(1, Number(c.req.query('days')) || 30));
    return c.json({ days, sources: await sources.stats(days) });
  });

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
    if (!(await allowAuth(clientKey(c)))) return c.json({ error: 'Trop de messages en peu de temps. Réessayez plus tard.' }, 429);
    const raw = (await c.req.json().catch(() => null)) as { captcha?: unknown } | null;
    const parsed = SupportMessageInput.safeParse(raw);
    if (!parsed.success) return c.json({ error: 'Écrivez votre message (2 000 caractères maximum).' }, 400);
    const who = await supportIdentity(c);
    // Sans compte, un message demande la vérification anti-robot (contre le spam).
    if (turnstile && !(await currentUser(c)) && !(await turnstile.verify(String(raw?.captcha ?? ''), clientKey(c)))) {
      return c.json({ error: 'La vérification anti-robot n’a pas abouti. Réessayez.', code: 'captcha' }, 400);
    }
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
      if (!(await (free ? allowFree : allow)(clientKey(c)))) {
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
        const result = await handler(uiLang(c) === 'en' && aiEn ? aiEn : ai, parsed.data);
        // Premier CV créé par un filleul : prime d'inscription pour son ambassadeur (3 premiers filleuls).
        if (action === 'structure' && user && ambassadors) await ambassadors.onFirstCv(user.id).catch((e) => console.error('Ambassadeur', e));
        return c.json(result);
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
    if (!(await allowFree(clientKey(c)))) return c.json({ error: 'Trop de demandes en peu de temps. Réessayez plus tard.' }, 429);
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

  // Mots-clés de l'offre (vérificateur gratuit) : la présence dans le CV est calculée sur l'appareil.
  app.post(
    '/api/ai/keywords',
    aiRoute(
      'keywords',
      KeywordsRequest,
      (ai, body) => ai.keywords(body),
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
  app.post('/api/ai/translate-letter', aiRoute('translate-letter', LetterTranslateRequest, (ai, body) => ai.translateLetter(body)));
  app.post('/api/ai/letter-questions', aiRoute('letter-questions', LetterQuestionsRequest, (ai, body) => ai.letterQuestions(body), undefined, true));

  app.post(
    '/api/ai/translate',
    aiRoute('translate', TranslateRequest, (ai, body) => ai.translate(body)),
  );

  return app;
}
