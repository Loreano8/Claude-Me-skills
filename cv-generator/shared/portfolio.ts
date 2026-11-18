import { z } from 'zod';

// Portfolio en ligne : une page publique (cvcasa.com/p/#lien) construite à partir du CV,
// avec des projets en plus si la personne le veut. Partagé entre l'appli, le serveur et la page publique.

export const PORTFOLIO_THEMES = ['classique', 'pastel', 'epure', 'bento', 'magazine', 'colonne', 'creatif', 'soleil', 'onde', 'defile', 'aurore'] as const;
export type PortfolioTheme = (typeof PORTFOLIO_THEMES)[number];
/** Rangement des designs à l'écran : les simples, puis les animés (lumières qui bougent). */
export const ANIMATED_THEMES: readonly PortfolioTheme[] = ['soleil', 'onde', 'defile', 'aurore'];
/** Le design offert ; les autres font partie du Portfolio Pro (sans mention CVCasa). */
export const FREE_PORTFOLIO_THEME: PortfolioTheme = 'classique';
export const PORTFOLIO_PRO_COST = 2;

const str = (max: number) => z.string().trim().max(max);

export const PortfolioProject = z.object({
  title: str(80),
  text: str(400),
  link: str(300),
  /** Image en data URL (JPEG réduit par l'appli). */
  image: z.string().max(400_000).regex(/^(data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+)?$/),
});
export type PortfolioProject = z.infer<typeof PortfolioProject>;

export const PortfolioData = z.object({
  lang: z.enum(['fr', 'en']),
  name: str(80),
  title: str(120),
  location: str(120),
  pitch: str(600),
  photo: z.string().max(400_000).regex(/^(data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+)?$/),
  email: str(120),
  phone: str(40),
  links: z.array(z.object({ label: str(30), url: str(300) })).max(3),
  badges: z.array(str(50)).max(4),
  stats: z.array(z.object({ value: str(14), label: str(60) })).max(3),
  wins: z.array(z.object({ value: str(14), title: str(80), text: str(200) })).max(4),
  credentials: z.array(z.object({ name: str(120), issuer: str(120), date: str(30) })).max(10),
  experiences: z
    .array(z.object({ position: str(120), company: str(120), location: str(80), dates: str(40), points: z.array(str(240)).max(5) }))
    .max(8),
  education: z.array(z.object({ degree: str(160), school: str(160), dates: str(40) })).max(6),
  skills: z.array(z.object({ group: str(40), items: z.array(str(60)).max(14) })).max(3),
  languages: z.array(str(60)).max(6),
  projects: z.array(PortfolioProject).max(6),
  /** Lien vers le CV en PDF (partage CVCasa), facultatif. */
  cvUrl: str(300),
  /** Vidéo de présentation (YouTube, Vimeo ou Loom), facultative. */
  video: str(300).default(''),
  /** Couleur principale choisie (#RRGGBB) ; vide = celle du design. */
  accent: z.string().regex(/^(#[0-9a-fA-F]{6})?$/).default(''),
});
export type PortfolioData = z.infer<typeof PortfolioData>;

export const PortfolioSaveRequest = z.object({
  theme: z.enum(PORTFOLIO_THEMES),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9](?:[a-z0-9-]{1,38})[a-z0-9]$/).optional(),
  data: PortfolioData,
});
export type PortfolioSaveRequest = z.infer<typeof PortfolioSaveRequest>;

export interface PortfolioState {
  slug: string;
  theme: PortfolioTheme;
  pro: boolean;
  data: PortfolioData;
  updatedAt: string;
}

/** « S'inspirer d'un portfolio que j'aime » : une capture d'écran, on en tire un design et une couleur (jamais le contenu). */
export const PortfolioStyleResult = z.object({
  isPortfolio: z.boolean().describe('L’image montre-t-elle bien une page web de type portfolio ou CV en ligne ?'),
  theme: z.enum(PORTFOLIO_THEMES).describe('Le design CVCasa le plus proche'),
  accent: z.string().describe('Couleur principale de la page, #RRGGBB'),
  summary: z.string().describe('Ce qui fait le style de cette page, en une phrase'),
});
export type PortfolioStyleResult = z.infer<typeof PortfolioStyleResult>;

/** Ce que voit le visiteur. */
export interface PublicPortfolio {
  theme: PortfolioTheme;
  pro: boolean;
  data: PortfolioData;
}

/** « Prénom Nom » → « prenom-nom ». */
export function slugify(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

/** Titres des parties de la page, dans la langue du portfolio (pas celle de l'appli). */
export const PORTFOLIO_LABELS = {
  fr: {
    downloadCv: 'Télécharger mon CV',
    contact: 'Me contacter',
    credentials: 'Diplômes et certifications',
    experience: 'Parcours',
    wins: 'Réalisations',
    projects: 'Projets',
    skills: 'Compétences',
    education: 'Formation',
    languages: 'Langues',
    madeWith: 'Page créée avec',
    makeYours: 'Créez la vôtre',
    about: 'À propos',
    video: 'Ma présentation en vidéo',
    watch: 'Voir la vidéo',
  },
  en: {
    downloadCv: 'Download my CV',
    contact: 'Contact me',
    credentials: 'Licences & certifications',
    experience: 'Experience',
    wins: 'Highlights',
    projects: 'Projects',
    skills: 'Skills',
    education: 'Education',
    languages: 'Languages',
    madeWith: 'Made with',
    makeYours: 'Create yours',
    about: 'About',
    video: 'Video introduction',
    watch: 'Watch the video',
  },
} as const;
