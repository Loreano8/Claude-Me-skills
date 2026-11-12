// Langue de l'interface côté site et application : choisie une fois au démarrage.
// Changer de langue recharge la page (tout est déjà enregistré sur l'appareil), ce qui permet d'utiliser t()
// partout, y compris dans les listes déclarées en haut des fichiers.
import { isUiLang, translate, type UiLang } from '../shared/i18n.ts';

const KEY = 'cvcasa-lang';

function detect(): UiLang {
  if (typeof window === 'undefined') return 'fr';
  try {
    // Lien partagé avec ?lang=en : on le retient.
    const asked = new URLSearchParams(window.location.search).get('lang');
    if (isUiLang(asked)) {
      localStorage.setItem(KEY, asked);
      return asked;
    }
    const saved = localStorage.getItem(KEY);
    if (isUiLang(saved)) return saved;
  } catch {
    /* stockage indisponible : langue du téléphone */
  }
  const phone = (navigator.languages?.[0] ?? navigator.language ?? 'fr').toLowerCase();
  // Français par défaut ; anglais pour un téléphone réglé en anglais (ou dans une autre langue).
  return phone.startsWith('fr') ? 'fr' : 'en';
}

export const LANG: UiLang = detect();
/** Pour les dates et les nombres affichés dans l'interface (pas dans les documents). */
export const LOCALE = LANG === 'en' ? 'en-GB' : 'fr-FR';

/** Texte de l'interface dans la langue choisie. Le français est la clé : t('Mon CV'), t('{0} crédits', [n]). */
export const t = (fr: string, vars?: readonly (string | number)[]): string => translate(LANG, fr, vars);

export function setLang(lang: UiLang): void {
  if (lang === LANG) return;
  try {
    localStorage.setItem(KEY, lang);
  } catch {
    /* sans stockage, le choix ne tient que jusqu'au prochain démarrage */
  }
  // Une adresse avec un #… ne recharge pas la page à elle seule : on retire ?lang= puis on recharge.
  const url = new URL(window.location.href);
  url.searchParams.delete('lang');
  window.history.replaceState(null, '', url.toString());
  window.location.reload();
}

export type { UiLang };
