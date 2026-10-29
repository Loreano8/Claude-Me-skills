import { Capacitor } from '@capacitor/core';

// Provenance du visiteur : chaque pub a son lien (?src=facebook-video1, ou les paramètres utm_*).
// Gardée 30 jours sur l'appareil (première pub qui a amené la personne), puis envoyée à l'inscription.

const KEY = 'cvcasa-source';
const SESSION_KEY = 'cvcasa-visit';
const MAX_AGE = 30 * 24 * 3600 * 1000;

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '';

/** Provenance lue dans l'adresse : ?src=…, sinon utm_source (+ utm_campaign). */
export function sourceFromUrl(href: string): string | null {
  const params = new URL(href).searchParams;
  const src = params.get('src') ?? (params.get('utm_source') ? [params.get('utm_source'), params.get('utm_campaign')].filter(Boolean).join('-') : null);
  const clean = src?.trim().slice(0, 60);
  return clean || null;
}

/** Provenance retenue pour l'inscription (vide si aucune pub, ou trop ancienne). */
export function pendingSource(): string {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null') as { source: string; at: number } | null;
    return saved && Date.now() - saved.at < MAX_AGE ? saved.source : '';
  } catch {
    return '';
  }
}

/** À l'ouverture : retient la provenance, la retire de l'adresse et compte la visite (une fois par session). */
export function captureSource(): void {
  if (Capacitor.isNativePlatform()) return;
  const url = new URL(window.location.href);
  const fromUrl = sourceFromUrl(url.href);
  try {
    // La première pub qui a amené la personne garde le mérite pendant 30 jours.
    if (fromUrl && !pendingSource()) localStorage.setItem(KEY, JSON.stringify({ source: fromUrl, at: Date.now() }));
  } catch {
    // Stockage indisponible : la visite est quand même comptée.
  }
  if (fromUrl) {
    for (const p of ['src', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid']) url.searchParams.delete(p);
    window.history.replaceState(null, '', url.pathname + url.search + url.hash);
  }
  try {
    if (sessionStorage.getItem(SESSION_KEY)) return;
    sessionStorage.setItem(SESSION_KEY, '1');
  } catch {
    // Pas de stockage de session : on compte quand même.
  }
  void fetch(`${API_BASE}/api/visit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source: fromUrl ?? pendingSource() }),
    keepalive: true,
  }).catch(() => {});
}
