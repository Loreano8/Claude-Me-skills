import type { Keyword } from '../../shared/schema.ts';
import type { CvDocument } from '../types.ts';

/** Texte comparable : minuscules, sans accents ni ponctuation, espaces simples, bordé d'espaces pour chercher des mots entiers. */
export function normalize(text: string): string {
  return ` ${text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9+#]+/g, ' ')
    .trim()} `;
}

/** Tout le texte du CV qu'un recruteur ou un logiciel de tri peut lire. */
export function cvText(cv: CvDocument): string {
  return [
    cv.personal.title,
    cv.summary,
    ...cv.experiences.flatMap((e) => [e.position, e.company, e.achievements]),
    ...cv.education.flatMap((e) => [e.degree, e.school, e.details]),
    ...cv.skills,
    ...cv.softSkills,
    ...cv.languages.flatMap((l) => [l.name, l.level]),
    ...cv.certifications.flatMap((c) => [c.name, c.issuer]),
  ].join(' \n ');
}

/** Un mot-clé est présent si lui ou l'une de ses variantes apparaît en mots entiers (au pluriel près). */
export function hasKeyword(text: string, k: Keyword): boolean {
  return [k.term, ...k.variants].some((form) => {
    const n = normalize(form).trim();
    if (!n) return false;
    return text.includes(` ${n} `) || text.includes(` ${n}s `) || (n.endsWith('s') && text.includes(` ${n.slice(0, -1)} `));
  });
}

export interface Coverage {
  present: Keyword[];
  missing: Keyword[];
  /** Part des mots-clés présents, de 0 à 100. */
  percent: number;
}

export function coverage(cv: CvDocument, keywords: Keyword[]): Coverage {
  const text = normalize(cvText(cv));
  const present = keywords.filter((k) => hasKeyword(text, k));
  const missing = keywords.filter((k) => !present.includes(k));
  return { present, missing, percent: keywords.length ? Math.round((present.length / keywords.length) * 100) : 0 };
}
