import type { AiCvContent, Lang } from '../../shared/schema.ts';
import type { CoverLetter, CvDocument, CvSettings, Personal } from '../types.ts';

export const uid = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);

export const ACCENTS = ['#1F4E79', '#0F766E', '#7F1D1D', '#334155', '#5B21B6', '#166534', '#B45309', '#111827'];

export function todayFr(): string {
  return new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** Date du jour telle qu'elle s'écrit en tête de lettre (« le 20 octobre 2026 » / « 20 October 2026 »). */
export function letterDate(lang: Lang): string {
  return lang === 'en'
    ? new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : `le ${todayFr()}`;
}

export function emptyPersonal(): Personal {
  return {
    firstName: '',
    lastName: '',
    title: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    country: '',
    birthDate: '',
    nationality: '',
    drivingLicense: '',
    linkedin: '',
    website: '',
  };
}

export function defaultSettings(): CvSettings {
  return {
    template: 'moderne',
    accent: ACCENTS[0],
    headingLang: 'fr',
    showPhoto: true,
    photoShape: 'round',
    showBirthDate: false,
    showNationality: false,
    showSignature: false,
    signaturePlace: '',
    signatureDate: '',
  };
}

export function emptyCv(label = 'Mon CV'): CvDocument {
  return {
    id: uid(),
    label,
    updatedAt: Date.now(),
    personal: emptyPersonal(),
    photo: null,
    signature: null,
    summary: '',
    experiences: [],
    education: [],
    skills: [],
    softSkills: [],
    languages: [],
    certifications: [],
    interests: [],
    settings: defaultSettings(),
  };
}

export function emptyLetter(): CoverLetter {
  return {
    recipientName: '',
    recipientCompany: '',
    recipientAddress: '',
    place: '',
    date: letterDate('fr'),
    subject: '',
    salutation: 'Madame, Monsieur,',
    body: '',
    closing: "Je vous prie d'agréer, Madame, Monsieur, l'expression de mes salutations distinguées.",
    showSignature: true,
    accent: ACCENTS[0],
    lang: 'fr',
  };
}

const lines = (text: string) =>
  text
    .split('\n')
    .map((l) => l.replace(/^\s*[-•*–]\s*/, '').trim())
    .filter(Boolean);

export function achievementsList(text: string): string[] {
  return lines(text);
}

/** Contenu du CV tel qu'envoyé à l'IA (sans photo, signature ni réglages). */
export function toAiContent(cv: CvDocument): AiCvContent {
  return {
    personal: { ...cv.personal },
    summary: cv.summary,
    experiences: cv.experiences.map(({ id: _id, achievements, ...e }) => ({ ...e, achievements: lines(achievements) })),
    education: cv.education.map(({ id: _id, ...e }) => e),
    skills: [...cv.skills],
    softSkills: [...cv.softSkills],
    languages: cv.languages.map(({ id: _id, ...l }) => l),
    certifications: cv.certifications.map(({ id: _id, ...c }) => c),
    interests: [...cv.interests],
  };
}

/**
 * Applique un contenu renvoyé par l'IA sur un CV, en gardant photo, signature et réglages.
 * - merge (défaut) : les infos personnelles non vides de l'IA complètent celles du CV ;
 * - keepPersonal : seules le titre change (CV adapté à une offre) ;
 * - keepContact : tout peut être traduit sauf les moyens de contact (CV traduit).
 */
export function applyAiContent(
  cv: CvDocument,
  ai: AiCvContent,
  opts: { mode?: 'merge' | 'keepPersonal' | 'keepContact' } = {},
): CvDocument {
  const p = cv.personal;
  const personal: Personal =
    opts.mode === 'keepPersonal'
      ? { ...p, title: ai.personal.title || p.title }
      : opts.mode === 'keepContact'
        ? { ...p, ...nonEmpty(ai.personal), email: p.email, phone: p.phone, linkedin: p.linkedin, website: p.website }
        : { ...emptyPersonal(), ...p, ...nonEmpty(ai.personal) };
  return {
    ...cv,
    updatedAt: Date.now(),
    personal,
    summary: ai.summary,
    experiences: ai.experiences.map((e) => ({ ...e, id: uid(), achievements: e.achievements.join('\n') })),
    education: ai.education.map((e) => ({ ...e, id: uid() })),
    skills: dedupe(ai.skills),
    softSkills: dedupe(ai.softSkills),
    languages: ai.languages.map((l) => ({ ...l, id: uid() })),
    certifications: ai.certifications.map((c) => ({ ...c, id: uid() })),
    interests: dedupe(ai.interests),
  };
}

function nonEmpty<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => typeof v !== 'string' || v.trim() !== '')) as Partial<T>;
}

function dedupe(items: string[]): string[] {
  const seen = new Set<string>();
  return items
    .map((s) => s.trim())
    .filter((s) => {
      const key = s.toLowerCase();
      if (!s || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export function fullName(p: Personal): string {
  return [p.firstName, p.lastName].map((s) => s.trim()).filter(Boolean).join(' ');
}

export function cvFileName(cv: CvDocument, ext: string, kind = 'CV'): string {
  const name = fullName(cv.personal).normalize('NFD').replace(/[̀-ͯ]/g, '');
  const slug = name.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '');
  return `${kind}${slug ? `_${slug}` : ''}.${ext}`;
}

export function isCvEmpty(cv: CvDocument): boolean {
  return (
    !fullName(cv.personal) &&
    !cv.summary &&
    cv.experiences.length === 0 &&
    cv.education.length === 0 &&
    cv.skills.length === 0
  );
}
