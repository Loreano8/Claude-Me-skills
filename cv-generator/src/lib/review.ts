import type { CvDocument, Experience } from '../types.ts';
import { achievementsList } from './cv.ts';

/** Une partie du CV que l'adaptation a modifiée, et que l'on peut garder ou ramener à l'original. */
export interface Change {
  key: string;
  label: string;
  before: string[];
  after: string[];
}

const sameText = (a: string, b: string) => a.trim().replace(/\s+/g, ' ') === b.trim().replace(/\s+/g, ' ');
const sameList = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => sameText(x, b[i]));

/** Retrouve, dans le CV d'origine, l'expérience correspondant à une expérience adaptée (même employeur et même début). */
function originalOf(base: CvDocument, e: Experience): Experience | undefined {
  const norm = (s: string) => s.trim().toLowerCase();
  return (
    base.experiences.find((b) => norm(b.company) === norm(e.company) && b.startDate === e.startDate) ??
    base.experiences.find((b) => norm(b.company) === norm(e.company) && norm(b.position) === norm(e.position))
  );
}

/** Les changements entre le CV d'origine et sa version adaptée, dans l'ordre du CV. */
export function listChanges(base: CvDocument, adapted: CvDocument): Change[] {
  const out: Change[] = [];
  if (!sameText(base.personal.title, adapted.personal.title)) out.push({ key: 'title', label: 'Titre du CV', before: [base.personal.title], after: [adapted.personal.title] });
  if (!sameText(base.summary, adapted.summary)) out.push({ key: 'summary', label: 'Profil', before: [base.summary], after: [adapted.summary] });
  for (const e of adapted.experiences) {
    const o = originalOf(base, e);
    if (!o) continue;
    const before = achievementsList(o.achievements);
    const after = achievementsList(e.achievements);
    if (!sameList(before, after) || !sameText(o.position, e.position)) {
      out.push({ key: `exp:${e.id}`, label: [e.position, e.company].filter(Boolean).join(' · ') || 'Expérience', before: [o.position, ...before], after: [e.position, ...after] });
    }
  }
  if (!sameList(base.skills, adapted.skills)) out.push({ key: 'skills', label: 'Compétences', before: [base.skills.join(', ')], after: [adapted.skills.join(', ')] });
  if (!sameList(base.softSkills, adapted.softSkills)) out.push({ key: 'softSkills', label: 'Qualités', before: [base.softSkills.join(', ')], after: [adapted.softSkills.join(', ')] });
  return out;
}

/** Applique un choix : `keep` remet la version adaptée de cette partie, sinon celle du CV d'origine. */
export function choose(current: CvDocument, base: CvDocument, adapted: CvDocument, key: string, keep: boolean): CvDocument {
  const from = keep ? adapted : base;
  if (key === 'title') return { ...current, personal: { ...current.personal, title: from.personal.title } };
  if (key === 'summary') return { ...current, summary: from.summary };
  if (key === 'skills') return { ...current, skills: [...from.skills] };
  if (key === 'softSkills') return { ...current, softSkills: [...from.softSkills] };
  if (key.startsWith('exp:')) {
    const id = key.slice(4);
    const adaptedExp = adapted.experiences.find((e) => e.id === id);
    const source = keep ? adaptedExp : adaptedExp && originalOf(base, adaptedExp);
    if (!source) return current;
    return {
      ...current,
      experiences: current.experiences.map((e) => (e.id === id ? { ...e, position: source.position, achievements: source.achievements } : e)),
    };
  }
  return current;
}
