import { Capacitor } from '@capacitor/core';
import type {
  AdaptRequest,
  AdaptResult,
  CoverLetterRequest,
  CoverLetterResult,
  StructureRequest,
  StructureResult,
  TranslateRequest,
  TranslateResult,
  InterviewRequest,
  InterviewResult,
  ReviseRequest,
  ReviseResult,
  AnalyzeTemplateRequest,
  TemplateAnalysis,
  ClarifyRequest,
  ClarifyResult,
  JobFetchResult,
  TranscribeRequest,
  TranscribeResult,
  StyleRequest,
  StyleResult,
  LetterQuestionsRequest,
  LetterQuestionsResult,
} from '../../shared/schema.ts';
import { styleForAi } from './writingStyle.ts';
import { useAccount, type AccountUser, type Pack, type ReturnOffer } from './account.ts';
import { deviceId } from './device.ts';

// Sur le web, l'API est servie par le même domaine. Dans l'application Android,
// VITE_API_URL pointe vers le serveur en ligne.
const API_BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '';

export class ApiError extends Error {}

async function request<T>(method: 'GET' | 'POST', path: string, body?: unknown, extraHeaders: Record<string, string> = {}): Promise<T> {
  if (!API_BASE && Capacitor.isNativePlatform()) {
    throw new ApiError('Les fonctions en ligne ne sont pas encore activées dans cette version de l’application.');
  }
  const account = useAccount.getState();
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Device-Id': await deviceId(),
        ...(account.token ? { Authorization: `Bearer ${account.token}` } : {}),
        ...extraHeaders,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError('Impossible de joindre le serveur. Vérifiez votre connexion internet.');
  }

  const remaining = res.headers.get('X-Credits-Remaining');
  if (remaining !== null) account.setCredits(Number(remaining));

  const data = (await res.json().catch(() => null)) as { error?: unknown; code?: unknown } | null;
  if (!res.ok) {
    const message = typeof data?.error === 'string' ? data.error : null;
    // Pas de réponse de notre API : site publié sans serveur (ex. version de démonstration).
    if (!message) throw new ApiError('Les fonctions IA ne sont pas encore activées sur ce site.');
    if (res.status === 401 && (path.startsWith('/api/ai/') || path.startsWith('/api/vault/') || path === '/api/unlock' || path === '/api/dossier/unlock')) {
      account.logout();
      account.open('account', message);
    }
    if (res.status === 402) account.open('credits', message);
    throw new ApiError(message);
  }
  return data as T;
}

const post = <T>(path: string, body: unknown) => request<T>('POST', path, body);

type Session = { token: string; user: AccountUser };

/** Ajoute le style « Écrire comme moi » aux demandes de rédaction. */
type Styled<T> = Omit<T, 'style'>;
const styled = <T extends object>(req: T) => ({ ...req, style: styleForAi() });

export const api = {
  structure: (req: Styled<StructureRequest>) => post<StructureResult>('/api/ai/structure', styled(req)),
  adapt: (req: Styled<AdaptRequest>) => post<AdaptResult>('/api/ai/adapt', styled(req)),
  coverLetter: (req: Styled<CoverLetterRequest>) => post<CoverLetterResult>('/api/ai/cover-letter', styled(req)),
  translate: (req: TranslateRequest) => post<TranslateResult>('/api/ai/translate', req),
  interview: (req: Styled<InterviewRequest>) => post<InterviewResult>('/api/ai/interview', styled(req)),
  revise: (req: Styled<ReviseRequest>) => post<ReviseResult>('/api/ai/revise', styled(req)),
  writingStyle: (req: StyleRequest) => post<StyleResult>('/api/ai/style', req),
  letterQuestions: (req: LetterQuestionsRequest) => post<LetterQuestionsResult>('/api/ai/letter-questions', req),
  analyzeTemplate: (req: AnalyzeTemplateRequest) => post<TemplateAnalysis>('/api/ai/analyze-template', req),
  clarify: (req: ClarifyRequest) => post<ClarifyResult>('/api/ai/clarify', req),
  fetchJob: (url: string) => post<JobFetchResult>('/api/job/fetch', { url }),
  transcribe: (req: TranscribeRequest) => post<TranscribeResult>('/api/ai/transcribe', req),
  dossierUnlock: () => post<{ credits: number | null }>('/api/dossier/unlock', {}),

  vaultSaveKey: (key: string) => post<{ ok: true }>('/api/vault/key', { key }),
  vaultRecover: (proof: { password: string } | { code: string }) => post<{ key: string }>('/api/vault/recover', proof),
  vaultSendCode: () => post<{ to: string }>('/api/vault/recover/email', {}),
  secretStatus: () => request<{ set: boolean; question: string | null }>('GET', '/api/account/secret'),
  /** Phrase secrète, ou réponse à une question secrète (question fournie). */
  setSecret: (phrase: string, question: string | null = null) => post<{ set: true }>('/api/account/secret', { phrase, question }),
  recoveryQuestion: (identifier: string) => request<{ question: string | null }>('GET', `/api/auth/recovery/question?identifier=${encodeURIComponent(identifier)}`),
  changePassword: (current: string, password: string) => post<{ ok: true }>('/api/account/password', { current, password }),
  /** Formulaire « mot de passe oublié » : la demande arrive dans « Nous contacter » (secret gardé sur l'appareil). */
  async recoveryRequest(form: { identifier: string; name: string; phrase: string; lastPurchase: string; credits: number | null; note: string }) {
    const res = await request<{ secret?: string }>('POST', '/api/auth/recovery', form, supportHeaders());
    if (res.secret) saveSupportSecret(res.secret);
    return res;
  },
  forgotPassword: (identifier: string) => post<{ ok: true; to: string | null }>('/api/auth/forgot', { identifier }),
  resetPassword: (identifier: string, code: string, password: string) => post<Session>('/api/auth/reset', { identifier, code, password }),

  register: (identifier: string, password: string, name: string, referralCode?: string | null) =>
    post<Session>('/api/auth/register', { identifier, password, name, ...(referralCode ? { referralCode } : {}) }),
  referral: () => request<{ code: string; invited: number; rewarded: number; bonus: number }>('GET', '/api/referral'),
  login: (identifier: string, password: string) => post<Session>('/api/auth/login', { identifier, password }),
  me: () => request<{ user: AccountUser }>('GET', '/api/me'),
  health: () => request<{ ai: boolean; accounts: boolean; payments: boolean; email?: boolean }>('GET', '/api/health'),
  packs: () => request<{ packs: Pack[]; payments: boolean }>('GET', '/api/packs'),
  offer: () => request<ReturnOffer>('GET', '/api/offer'),
  unlock: () => post<{ credits: number | null }>('/api/unlock', {}),
  checkout: (packId: string) => post<{ url: string }>('/api/payments/checkout', { packId }),

  support: () => request<{ messages: SupportMessage[] }>('GET', '/api/support', undefined, supportHeaders()),
  supportUnread: () => request<{ unread: number }>('GET', '/api/support/unread', undefined, supportHeaders()),
  supportPost: (m: { body: string; name?: string; contact?: string }) =>
    request<{ secret?: string; messages: SupportMessage[] }>('POST', '/api/support', m, supportHeaders()),

  testimonials: () => request<{ testimonials: PublicTestimonial[] }>('GET', '/api/testimonials'),
  submitTestimonial: (t: PublicTestimonial & { consent: true }) => post<{ id: number; secret: string }>('/api/testimonials', t),
  withdrawTestimonial: (id: number, secret: string) => post<{ ok: true }>(`/api/testimonials/${id}/withdraw`, { secret }),
};

export interface SupportMessage {
  id: number;
  author: 'user' | 'admin';
  body: string;
  createdAt: string;
}

const SUPPORT_KEY = 'cv-studio-support';

/** Secret de la conversation « Nous contacter », gardé sur l'appareil (pour les visiteurs sans compte). */
export function supportHeaders(): Record<string, string> {
  try {
    const secret = localStorage.getItem(SUPPORT_KEY);
    return secret ? { 'X-Support-Secret': secret } : {};
  } catch {
    return {};
  }
}

export function saveSupportSecret(secret: string): void {
  try {
    localStorage.setItem(SUPPORT_KEY, secret);
  } catch {
    // Stockage indisponible : la conversation restera liée au compte s'il y en a un.
  }
}

/** Appels de l'espace administrateur, avec le jeton admin (jamais celui du compte client). */
export async function adminRequest<T>(token: string, method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError('Impossible de joindre le serveur. Vérifiez votre connexion internet.');
  }
  const data = (await res.json().catch(() => null)) as { error?: unknown } | null;
  if (!res.ok) throw new ApiError(typeof data?.error === 'string' ? data.error : 'Erreur du serveur.');
  return data as T;
}

export interface PublicTestimonial {
  firstName: string;
  jobTitle: string;
  company: string;
  city: string;
  message: string;
}

/** Met à jour le solde depuis le serveur (au démarrage, au retour d'un paiement…). */
export async function refreshAccount(): Promise<void> {
  const state = useAccount.getState();
  try {
    const health = await api.health();
    useAccount.setState({ enabled: health.accounts });
    if (!health.accounts || !state.token) return;
    const { user } = await api.me();
    useAccount.setState({ user });
    // Ouvre l'offre de retour si la personne revient après une absence (sans bloquer le reste).
    const offer = await api.offer().catch(() => null);
    if (offer) useAccount.setState({ offer });
  } catch (error) {
    // Jeton expiré : on déconnecte. Hors ligne : on garde le dernier solde connu.
    if (error instanceof ApiError && /session/i.test(error.message)) state.logout();
  }
}
