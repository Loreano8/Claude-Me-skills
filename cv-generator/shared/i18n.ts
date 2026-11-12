// Traduction de l'interface (site, application, messages du serveur).
// Le texte français sert de clé : il reste lisible dans le code, et sa version anglaise est dans shared/i18n/en.ts.
// La langue de l'interface est indépendante de celle des documents (CV, lettre, e-mail au recruteur),
// qui gardent leur propre langue.
import { EN } from './i18n/en.ts';

export type UiLang = 'fr' | 'en';
export const UI_LANGS: UiLang[] = ['fr', 'en'];
export const isUiLang = (v: unknown): v is UiLang => v === 'fr' || v === 'en';

/** Remplace {0}, {1}… par les valeurs données. */
function fill(s: string, vars?: readonly (string | number)[]): string {
  return vars ? s.replace(/\{(\d+)\}/g, (_, i: string) => String(vars[Number(i)] ?? '')) : s;
}

/**
 * Version anglaise d'un texte français. Si la phrase exacte n'est pas au dictionnaire, on essaie la même phrase
 * avec ses nombres remplacés par {n} (« 3 crédits » → « {n} crédits »), pour les messages qui contiennent un chiffre.
 * Texte inconnu : le français est gardé (jamais de texte vide).
 */
export function translate(lang: UiLang, fr: string, vars?: readonly (string | number)[]): string {
  if (lang === 'fr' || !fr) return fill(fr, vars);
  const exact = EN[fr];
  if (exact !== undefined) return fill(exact, vars);
  if (!vars && /\d/.test(fr)) {
    const nums: string[] = [];
    const key = fr.replace(/\d+(?:[  .,]\d{3})*/g, (m) => (nums.push(m), '{n}'));
    const pattern = EN[key];
    if (pattern !== undefined) {
      let i = 0;
      return pattern.replace(/\{n\}/g, () => nums[i++] ?? '');
    }
  }
  return fill(fr, vars);
}

export const hasTranslation = (fr: string) => EN[fr] !== undefined;
