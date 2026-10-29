// Parrainage côté appli : le code du parrain arrive dans le lien (?ref=CODE) et est gardé
// jusqu'à l'inscription.

const KEY = 'cv-studio-ref';

/** Adresse publique du site, pour les liens de parrainage (l'appli Android n'a pas d'adresse web). */
export const PUBLIC_SITE = ((import.meta.env.VITE_PUBLIC_SITE as string | undefined) ?? 'https://cvcasa.com').replace(/\/$/, '');

export const referralLink = (code: string) => `${PUBLIC_SITE}/?ref=${code}`;

/** À l'ouverture : mémorise le code présent dans l'adresse et le retire de la barre d'adresse. */
export function captureReferral(): void {
  const url = new URL(window.location.href);
  const code = url.searchParams.get('ref')?.trim().toUpperCase();
  if (!code || !/^[A-Z0-9]{4,12}$/.test(code)) return;
  try {
    localStorage.setItem(KEY, code);
  } catch {
    // Stockage indisponible (navigation privée) : tant pis pour le parrainage.
  }
  url.searchParams.delete('ref');
  window.history.replaceState(null, '', url.pathname + url.search + url.hash);
}

export function pendingReferral(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function clearReferral(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // rien à faire
  }
}
