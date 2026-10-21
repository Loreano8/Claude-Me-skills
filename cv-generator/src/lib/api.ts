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
} from '../../shared/schema.ts';
import { useAccount, type AccountUser, type Pack } from './account.ts';

// Sur le web, l'API est servie par le même domaine. Dans l'application Android,
// VITE_API_URL pointe vers le serveur en ligne.
const API_BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '';

export class ApiError extends Error {}

async function request<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
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
        ...(account.token ? { Authorization: `Bearer ${account.token}` } : {}),
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
    if (res.status === 401 && path.startsWith('/api/ai/')) {
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

export const api = {
  structure: (req: StructureRequest) => post<StructureResult>('/api/ai/structure', req),
  adapt: (req: AdaptRequest) => post<AdaptResult>('/api/ai/adapt', req),
  coverLetter: (req: CoverLetterRequest) => post<CoverLetterResult>('/api/ai/cover-letter', req),
  translate: (req: TranslateRequest) => post<TranslateResult>('/api/ai/translate', req),

  register: (identifier: string, password: string, name: string) => post<Session>('/api/auth/register', { identifier, password, name }),
  login: (identifier: string, password: string) => post<Session>('/api/auth/login', { identifier, password }),
  me: () => request<{ user: AccountUser }>('GET', '/api/me'),
  health: () => request<{ ai: boolean; accounts: boolean; payments: boolean }>('GET', '/api/health'),
  packs: () => request<{ packs: Pack[]; payments: boolean }>('GET', '/api/packs'),
  checkout: (packId: string) => post<{ url: string }>('/api/payments/checkout', { packId }),
};

/** Met à jour le solde depuis le serveur (au démarrage, au retour d'un paiement…). */
export async function refreshAccount(): Promise<void> {
  const state = useAccount.getState();
  try {
    const health = await api.health();
    useAccount.setState({ enabled: health.accounts });
    if (!health.accounts || !state.token) return;
    const { user } = await api.me();
    useAccount.setState({ user });
  } catch (error) {
    // Jeton expiré : on déconnecte. Hors ligne : on garde le dernier solde connu.
    if (error instanceof ApiError && /session/i.test(error.message)) state.logout();
  }
}
