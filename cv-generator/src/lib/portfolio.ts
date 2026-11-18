import type { CvDocument } from '../types.ts';
import type { PortfolioData, PortfolioField, PortfolioProject } from '../../shared/portfolio.ts';

// Remplissage automatique du portfolio à partir du CV : la personne n'a rien à retaper.
// Seuls les projets (images, liens) et le choix du design s'ajoutent à la main.

const NOW_YEAR = new Date().getFullYear();

function year(date: string): number | null {
  const m = /(19|20)\d{2}/.exec(date);
  return m ? Number(m[0]) : null;
}

/** Années d'expérience : du premier poste à aujourd'hui (ou à la fin du dernier poste). */
export function yearsOfExperience(cv: CvDocument): number {
  const starts = cv.experiences.map((e) => year(e.startDate)).filter((y): y is number => y !== null);
  if (!starts.length) return 0;
  const ends = cv.experiences.map((e) => (e.current ? NOW_YEAR : year(e.endDate) ?? NOW_YEAR));
  return Math.max(0, Math.max(...ends) - Math.min(...starts));
}

/** Premier chiffre parlant d'une réalisation : « 30 % », « 120 », « 2 M ». */
export function keyNumber(line: string): string | null {
  // Une année (« depuis 2021 ») n'est pas un résultat : on passe au chiffre suivant.
  for (const m of line.matchAll(/(?:^|[\s(])([+−-]?\s?\d[\d\s.,]*(?:\s?(?:%|k|K|M|Md|h|x))?)(?=[\s).,;:]|$)/g)) {
    const v = m[1].replace(/\s+/g, ' ').trim().replace(/[.,]$/, '');
    if (/^(19|20)\d{2}$/.test(v) || !/\d/.test(v) || v.length > 14) continue;
    return v;
  }
  return null;
}

const L = {
  fr: { years: (n: number) => `${n} an${n > 1 ? 's' : ''}`, exp: 'd’expérience', certs: 'certifications', langs: 'langues parlées', roles: 'postes occupés', tech: 'Compétences techniques', soft: 'Qualités', today: 'aujourd’hui' },
  en: { years: (n: number) => `${n} yr${n > 1 ? 's' : ''}`, exp: 'of experience', certs: 'certifications', langs: 'languages', roles: 'roles held', tech: 'Technical skills', soft: 'Strengths', today: 'Present' },
};

export function portfolioFromCv(cv: CvDocument, extras: { projects?: PortfolioProject[]; showPhoto?: boolean; showPhone?: boolean; cvUrl?: string; video?: string; accent?: string; lang?: 'fr' | 'en'; field?: PortfolioField | 'aucun' } = {}): PortfolioData {
  // Langue de la page : celle des titres du CV, sauf si la personne en choisit une autre.
  const lang = extras.lang ?? (cv.settings.headingLang === 'en' ? 'en' : 'fr');
  const l = L[lang];
  const p = cv.personal;
  const name = `${p.firstName} ${p.lastName}`.trim();
  const years = yearsOfExperience(cv);

  const stats: PortfolioData['stats'] = [];
  if (years >= 1) stats.push({ value: l.years(years), label: l.exp });
  if (cv.certifications.length) stats.push({ value: String(cv.certifications.length), label: l.certs });
  if (cv.languages.length > 1) stats.push({ value: String(cv.languages.length), label: l.langs });
  if (stats.length < 3 && cv.experiences.length > 1) stats.push({ value: String(cv.experiences.length), label: l.roles });

  // Réalisations chiffrées : ce qui accroche un recruteur en quelques secondes.
  const wins: PortfolioData['wins'] = [];
  for (const e of cv.experiences) {
    for (const line of e.achievements.split('\n').map((s) => s.trim()).filter(Boolean)) {
      const value = keyNumber(line);
      if (!value || wins.length >= 3) continue;
      wins.push({ value, title: line.length > 80 ? `${line.slice(0, 77).trimEnd()}…` : line, text: [e.position, e.company].filter(Boolean).join(' · ').slice(0, 200) });
    }
  }

  const badges = [
    ...cv.certifications.slice(0, 2).map((c) => c.name),
    cv.languages.length ? cv.languages.slice(0, 3).map((x) => x.name).join(' · ') : '',
  ]
    .filter(Boolean)
    .map((b) => b.slice(0, 50))
    .slice(0, 4);

  const links: PortfolioData['links'] = [];
  if (p.linkedin.trim()) links.push({ label: 'LinkedIn', url: p.linkedin.trim() });
  if (p.website.trim()) links.push({ label: lang === 'en' ? 'Website' : 'Site', url: p.website.trim() });

  return {
    lang,
    name: name.slice(0, 80),
    title: p.title.slice(0, 120),
    location: [p.city, p.country].filter((s) => s.trim()).join(', ').slice(0, 120),
    pitch: cv.summary.trim().slice(0, 600),
    photo: extras.showPhoto !== false && cv.photo && cv.photo.length < 400_000 ? cv.photo : '',
    email: p.email.trim().slice(0, 120),
    phone: extras.showPhone ? p.phone.trim().slice(0, 40) : '',
    links,
    badges,
    stats: stats.slice(0, 3),
    wins,
    credentials: cv.certifications.slice(0, 10).map((c) => ({ name: c.name.slice(0, 120), issuer: c.issuer.slice(0, 120), date: c.date.slice(0, 30) })),
    experiences: cv.experiences.slice(0, 8).map((e) => ({
      position: e.position.slice(0, 120),
      company: e.company.slice(0, 120),
      location: e.location.slice(0, 80),
      dates: [e.startDate, e.current ? l.today : e.endDate].filter(Boolean).join(' – ').slice(0, 40),
      points: e.achievements.split('\n').map((s) => s.trim()).filter(Boolean).slice(0, 5).map((s) => s.slice(0, 240)),
    })),
    education: cv.education.slice(0, 6).map((e) => ({ degree: e.degree.slice(0, 160), school: e.school.slice(0, 160), dates: [e.startDate, e.endDate].filter(Boolean).join(' – ').slice(0, 40) })),
    skills: [
      { group: l.tech, items: cv.skills.slice(0, 14).map((s) => s.slice(0, 60)) },
      { group: l.soft, items: cv.softSkills.slice(0, 14).map((s) => s.slice(0, 60)) },
    ].filter((g) => g.items.length),
    languages: cv.languages.slice(0, 6).map((x) => [x.name, x.level].filter(Boolean).join(' · ').slice(0, 60)),
    projects: (extras.projects ?? []).slice(0, 6),
    cvUrl: (extras.cvUrl ?? '').slice(0, 300),
    video: (extras.video ?? '').trim().slice(0, 300),
    accent: /^#[0-9a-fA-F]{6}$/.test(extras.accent ?? '') ? extras.accent! : '',
    // Domaine : détecté d'après le CV, sauf si la personne en a choisi un (ou aucun motif).
    field: extras.field === 'aucun' ? '' : (extras.field ?? detectField(cv)),
  };
}

// ---- Retouches propres au portfolio (sans toucher au CV) ------------------------

/** Parties qu'on peut masquer sur la page. */
export const HIDEABLE_SECTIONS = ['badges', 'stats', 'wins', 'experiences', 'credentials', 'education', 'skills', 'languages'] as const;
export type HideableSection = (typeof HIDEABLE_SECTIONS)[number];

/** Ce que la personne a retouché ; un champ absent = on garde ce qui vient du CV. */
export interface PortfolioOverrides {
  /** Domaine choisi à la main (motifs du métier) ; « aucun » = pas de motif. */
  field?: PortfolioField | 'aucun';
  /** Langue des titres de la page (À propos / About…). */
  lang?: 'fr' | 'en';
  name?: string;
  title?: string;
  location?: string;
  pitch?: string;
  stats?: PortfolioData['stats'];
  wins?: PortfolioData['wins'];
  hidden?: HideableSection[];
}

export function applyOverrides(base: PortfolioData, o: PortfolioOverrides): PortfolioData {
  const d: PortfolioData = { ...base };
  if (o.name !== undefined && o.name.trim()) d.name = o.name.slice(0, 80);
  if (o.title !== undefined) d.title = o.title.slice(0, 120);
  if (o.location !== undefined) d.location = o.location.slice(0, 120);
  if (o.pitch !== undefined) d.pitch = o.pitch.slice(0, 600);
  if (o.stats) d.stats = o.stats.filter((s) => s.value.trim() || s.label.trim()).slice(0, 3).map((s) => ({ value: s.value.slice(0, 14), label: s.label.slice(0, 60) }));
  if (o.wins) d.wins = o.wins.filter((w) => w.value.trim() || w.title.trim()).slice(0, 4).map((w) => ({ value: w.value.slice(0, 14), title: w.title.slice(0, 80), text: w.text.slice(0, 200) }));
  for (const h of o.hidden ?? []) {
    if (h in d && Array.isArray(d[h])) (d[h] as unknown[]) = [];
  }
  return d;
}

export function hasOverrides(o: PortfolioOverrides): boolean {
  return Object.values(o).some((v) => (Array.isArray(v) ? v.length > 0 : v !== undefined));
}

// ---- Domaine de la personne (motifs du métier sur le portfolio) ------------------

const FIELD_WORDS: Record<Exclude<PortfolioField, 'general'>, string[]> = {
  sante: ['infirmi', 'nurse', 'sage-femme', 'midwife', 'médec', 'medic', 'docteur', 'doctor', 'pharmac', 'soins', 'santé', 'health', 'hôpital', 'hospital', 'clinique', 'clinic', 'patient', 'aide-soignant', 'kiné', 'dentist', 'laborantin', 'biolog', 'réanimation', 'urgences', 'paramédical', 'caregiver'],
  tech: ['développeu', 'developer', 'software', 'logiciel', 'informatique', 'devops', 'data', 'javascript', 'python', 'java', 'react', 'node', 'sql', 'réseau', 'network', 'cyber', 'cloud', 'programm', 'full stack', 'fullstack', 'backend', 'frontend', 'it support', 'technicien support', 'système'],
  design: ['design', 'graphi', 'ux', 'ui ', 'figma', 'photoshop', 'illustrat', 'motion', 'créati', 'creative', 'architecte d’intérieur', 'photograph', 'vidéaste', 'video editor', 'directeur artistique', 'art director', 'mode', 'fashion'],
  finance: ['comptab', 'account', 'finance', 'audit', 'fiscal', 'tax', 'banque', 'bank', 'contrôleur de gestion', 'controller', 'trésor', 'treasury', 'paie', 'payroll', 'syscohada', 'sage', 'analyste financier', 'assurance', 'insurance', 'microfinance'],
  education: ['enseignant', 'teacher', 'professeur', 'formateur', 'trainer', 'éducat', 'education', 'instituteur', 'pédagog', 'tutor', 'école', 'school', 'animateur'],
  btp: ['btp', 'génie civil', 'civil engineer', 'chantier', 'construction', 'architecte', 'architect', 'topograph', 'électricien', 'electrician', 'plomb', 'mécanicien', 'mechanic', 'maintenance', 'ingénieur', 'engineer', 'soudeur', 'conducteur de travaux'],
  commerce: ['commercial', 'sales', 'vente', 'vendeu', 'marketing', 'business developer', 'chargé de clientèle', 'customer', 'retail', 'e-commerce', 'communication', 'community manager', 'relation client'],
  juridique: ['juriste', 'lawyer', 'avocat', 'droit', 'legal', 'notaire', 'huissier', 'conformité', 'compliance', 'contrat'],
  hotellerie: ['hôtel', 'hotel', 'restaura', 'cuisin', 'chef', 'serveu', 'barman', 'tourisme', 'tourism', 'réception', 'hospitality', 'pâtiss', 'traiteur'],
  logistique: ['logisti', 'transport', 'supply chain', 'entrepôt', 'warehouse', 'chauffeur', 'driver', 'transit', 'douane', 'customs', 'achat', 'procurement', 'stock', 'magasinier'],
};

/** Le domaine le plus probable d'après le titre (compte double), les postes, la formation et les compétences. */
export function detectField(cv: CvDocument): PortfolioField {
  const title = `${cv.personal.title} `.toLowerCase();
  const rest = [...cv.experiences.map((e) => e.position), ...cv.education.map((e) => e.degree), ...cv.skills].join(' ').toLowerCase();
  let best: PortfolioField = 'general';
  let bestScore = 0;
  for (const [field, words] of Object.entries(FIELD_WORDS) as [Exclude<PortfolioField, 'general'>, string[]][]) {
    const score = words.reduce((n, w) => n + (title.includes(w) ? 3 : 0) + (rest.includes(w) ? 1 : 0), 0);
    if (score > bestScore) {
      best = field;
      bestScore = score;
    }
  }
  return best;
}
