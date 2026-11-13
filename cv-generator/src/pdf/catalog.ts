import type { CatalogTemplateId, TemplateStyle } from '../../shared/schema.ts';
import type { CvSettings } from '../types.ts';

import { t } from '../i18n.ts';
export type TemplateCategory = 'polyvalent' | 'classique' | 'creatif' | 'international';

export interface CatalogEntry {
  id: CatalogTemplateId;
  name: string;
  category: TemplateCategory;
  /** Pour qui ce modèle est fait (affiché sous la vignette). */
  idealFor: string;
  /** Fiche de style pour le moteur de mise en page ; absente pour les 3 modèles dessinés à la main. */
  style?: TemplateStyle;
  /** Couleur proposée en choisissant ce modèle. */
  accent: string;
  /** Réglages appliqués en choisissant ce modèle (ex. pas de photo pour l'Amérique du Nord). */
  settings?: Partial<CvSettings>;
  /** Explication affichée quand ces réglages sont appliqués. */
  settingsNote?: string;
}

export const CATEGORY_LABELS: Record<TemplateCategory, string> = {
  polyvalent: t('Polyvalents'),
  classique: t('Sobres et classiques'),
  creatif: t('Créatifs'),
  international: t('International'),
};

const base: Omit<TemplateStyle, 'accent'> = {
  layout: 'single',
  sidebarTone: 'accent',
  font: 'sans',
  headingStyle: 'underline',
  headerAlign: 'left',
  skillsStyle: 'list',
  density: 'normal',
  educationFirst: false,
  photoShape: 'round',
};

const style = (accent: string, s: Partial<TemplateStyle>): TemplateStyle => ({ ...base, ...s, accent });

export const CATALOG: CatalogEntry[] = [
  { id: 'moderne', name: t('Moderne'), category: 'polyvalent', accent: '#1d4ed8', idealFor: t('La plupart des métiers. Colonne colorée avec photo.') },
  { id: 'classique', name: t('Classique ATS'), category: 'classique', accent: '#1f2937', idealFor: t('Grandes entreprises : le mieux lu par les logiciels de tri.') },
  { id: 'elegant', name: t('Élégant'), category: 'polyvalent', accent: '#0f766e', idealFor: t('Se démarquer avec sobriété. Bandeau et frise des dates.') },
  { id: 'prestige', name: t('Prestige'), category: 'polyvalent', accent: '#b8913a', idealFor: t('Profils confirmés et cadres. Colonne bleu nuit, filets dorés, frise chronologique.') },
  { id: 'horizon', name: t('Horizon'), category: 'creatif', accent: '#0e7490', idealFor: t('Moderne et dynamique. Bandeau en biais, photo mise en avant, niveaux de langue.') },
  { id: 'atelier', name: t('Atelier'), category: 'creatif', accent: '#c2410c', idealFor: t('Métiers créatifs, communication, commerce. Rubriques numérotées et monogramme.') },
  { id: 'signature', name: t('Signature'), category: 'classique', accent: '#7f1d3f', idealFor: t('Sobre et haut de gamme. Nom en capitales, doubles filets, deux colonnes.') },
  {
    id: 'finance',
    name: t('Finance'),
    category: 'classique',
    accent: '#1e3a5f',
    idealFor: t('Banque, finance, audit, juridique. Sérieux et rigoureux.'),
    style: style('#1e3a5f', { font: 'serif', headingStyle: 'underline', skillsStyle: 'inline', density: 'compact', photoShape: 'square' }),
  },
  {
    id: 'ingenieur',
    name: t('Ingénieur'),
    category: 'polyvalent',
    accent: '#0e7490',
    idealFor: t('Ingénierie, informatique, BTP, technique.'),
    style: style('#0e7490', { layout: 'sidebar-right', sidebarTone: 'light', headingStyle: 'bar', skillsStyle: 'tags' }),
  },
  {
    id: 'creatif',
    name: t('Créatif'),
    category: 'creatif',
    accent: '#e11d48',
    idealFor: t('Communication, marketing, design, événementiel.'),
    style: style('#e11d48', { layout: 'banner', headingStyle: 'pill', skillsStyle: 'tags' }),
  },
  {
    id: 'canada',
    name: t('Canada / USA'),
    category: 'international',
    accent: '#334155',
    idealFor: t('Amérique du Nord : une page, sans photo ni date de naissance.'),
    style: style('#334155', { headingStyle: 'caps', skillsStyle: 'inline', density: 'compact' }),
    settings: { showPhoto: false, showBirthDate: false, showNationality: false, showSignature: false },
    settingsNote: t('Photo, date de naissance, nationalité et signature masquées : au Canada et aux États-Unis, elles sont à éviter.'),
  },
  {
    id: 'europass',
    name: t('Europe'),
    category: 'international',
    accent: '#1d4ed8',
    idealFor: t('Candidatures en Europe, programmes et bourses (inspiré d’Europass).'),
    style: style('#1d4ed8', { layout: 'labels', headingStyle: 'plain', skillsStyle: 'inline', photoShape: 'square' }),
  },
  {
    id: 'concours',
    name: t('Concours'),
    category: 'classique',
    accent: '#14532d',
    idealFor: t('Fonction publique, concours, administrations, ONG.'),
    style: style('#14532d', { font: 'serif', headerAlign: 'center', headingStyle: 'caps', skillsStyle: 'inline', photoShape: 'square' }),
    settings: { showBirthDate: true, showNationality: true },
    settingsNote: t('Date de naissance et nationalité affichées : elles sont souvent demandées pour les concours.'),
  },
  {
    id: 'etudiant',
    name: t('Premier emploi'),
    category: 'polyvalent',
    accent: '#7c3aed',
    idealFor: t('Étudiants et jeunes diplômés : la formation passe en premier.'),
    style: style('#7c3aed', { layout: 'sidebar-left', sidebarTone: 'light', headingStyle: 'bar', skillsStyle: 'tags', educationFirst: true }),
  },
  {
    id: 'executif',
    name: t('Cadre dirigeant'),
    category: 'classique',
    accent: '#1f2a44',
    idealFor: t('Managers, directeurs, profils expérimentés.'),
    style: style('#1f2a44', { layout: 'banner', font: 'mixed', headingStyle: 'caps', skillsStyle: 'inline', density: 'compact' }),
  },
  {
    id: 'sante',
    name: t('Santé & social'),
    category: 'polyvalent',
    accent: '#0f766e',
    idealFor: t('Santé, pharmacie, social, éducation.'),
    style: style('#0f766e', { layout: 'sidebar-left', sidebarTone: 'accent', headingStyle: 'pill' }),
  },
  {
    id: 'minimal',
    name: t('Minimaliste'),
    category: 'creatif',
    accent: '#111827',
    idealFor: t('Un rendu épuré et très aéré, pour tous les métiers.'),
    style: style('#111827', { headerAlign: 'center', headingStyle: 'plain', skillsStyle: 'inline', density: 'normal', font: 'mixed' }),
  },
];

/** Modèles utilisables gratuitement ; les autres (et « Mon style ») demandent la version Pro. */
export const FREE_TEMPLATES: readonly string[] = ['moderne', 'classique', 'elegant'];
export const isProTemplate = (id: string) => !FREE_TEMPLATES.includes(id);

export const catalogEntry = (id: string) => CATALOG.find((t) => t.id === id);

/** Réglages appliqués en choisissant un modèle : sa couleur, sa forme de photo, et ses réglages propres. */
export function settingsForTemplate(entry: CatalogEntry): Partial<CvSettings> {
  return { template: entry.id, accent: entry.accent, ...(entry.style ? { photoShape: entry.style.photoShape } : {}), ...entry.settings };
}

/** Fiche de style effective d'un CV : modèle du catalogue ou style personnel, avec la couleur et la photo choisies. */
export function resolveStyle(settings: CvSettings): TemplateStyle | null {
  const preset = settings.template === 'perso' ? settings.customStyle : catalogEntry(settings.template)?.style;
  if (!preset) return null;
  return { ...preset, accent: settings.accent, photoShape: settings.photoShape };
}
