import { Capacitor } from '@capacitor/core';
import type {
  AdaptRequest,
  AdaptResult,
  CoverLetterRequest,
  CoverLetterResult,
  StructureRequest,
  StructureResult,
} from '../../shared/schema.ts';

// Sur le web, l'API est servie par le même domaine. Dans l'application Android,
// VITE_API_URL pointe vers le serveur en ligne.
const API_BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '';

export class ApiError extends Error {}

async function post<T>(path: string, body: unknown): Promise<T> {
  if (!API_BASE && Capacitor.isNativePlatform()) {
    throw new ApiError('Les fonctions IA ne sont pas encore activées dans cette version de l’application.');
  }
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError('Impossible de joindre le serveur. Vérifiez votre connexion internet.');
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError((data as { error?: string } | null)?.error ?? `Erreur ${res.status}`);
  }
  return data as T;
}

export const api = {
  structure: (req: StructureRequest) => post<StructureResult>('/api/ai/structure', req),
  adapt: (req: AdaptRequest) => post<AdaptResult>('/api/ai/adapt', req),
  coverLetter: (req: CoverLetterRequest) => post<CoverLetterResult>('/api/ai/cover-letter', req),
};
