import type { CatalogTemplateId, TemplateStyle } from '../../shared/schema.ts';
import type { CvSettings } from '../types.ts';

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
  polyvalent: 'Polyvalents',
  classique: 'Sobres et classiques',
  creatif: 'Créatifs',
  international: 'International',
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
  { id: 'moderne', name: 'Moderne', category: 'polyvalent', accent: '#1d4ed8', idealFor: 'La plupart des métiers. Colonne colorée avec photo.' },
  { id: 'classique', name: 'Classique ATS', category: 'classique', accent: '#1f2937', idealFor: 'Grandes entreprises : le mieux lu par les logiciels de tri.' },
  { id: 'elegant', name: 'Élégant', category: 'polyvalent', accent: '#0f766e', idealFor: 'Se démarquer avec sobriété. Bandeau et frise des dates.' },
  {
    id: 'finance',
    name: 'Finance',
    category: 'classique',
    accent: '#1e3a5f',
    idealFor: 'Banque, finance, audit, juridique. Sérieux et rigoureux.',
    style: style('#1e3a5f', { font: 'serif', headingStyle: 'underline', skillsStyle: 'inline', density: 'compact', photoShape: 'square' }),
  },
  {
    id: 'ingenieur',
    name: 'Ingénieur',
    category: 'polyvalent',
    accent: '#0e7490',
    idealFor: 'Ingénierie, informatique, BTP, technique.',
    style: style('#0e7490', { layout: 'sidebar-right', sidebarTone: 'light', headingStyle: 'bar', skillsStyle: 'tags' }),
  },
  {
    id: 'creatif',
    name: 'Créatif',
    category: 'creatif',
    accent: '#e11d48',
    idealFor: 'Communication, marketing, design, événementiel.',
    style: style('#e11d48', { layout: 'banner', headingStyle: 'pill', skillsStyle: 'tags' }),
  },
  {
    id: 'canada',
    name: 'Canada / USA',
    category: 'international',
    accent: '#334155',
    idealFor: 'Amérique du Nord : une page, sans photo ni date de naissance.',
    style: style('#334155', { headingStyle: 'caps', skillsStyle: 'inline', density: 'compact' }),
    settings: { showPhoto: false, showBirthDate: false, showNationality: false, showSignature: false },
    settingsNote: 'Photo, date de naissance, nationalité et signature masquées : au Canada et aux États-Unis, elles sont à éviter.',
  },
  {
    id: 'europass',
    name: 'Europe',
    category: 'international',
    accent: '#1d4ed8',
    idealFor: 'Candidatures en Europe, programmes et bourses (inspiré d’Europass).',
    style: style('#1d4ed8', { layout: 'labels', headingStyle: 'plain', skillsStyle: 'inline', photoShape: 'square' }),
  },
  {
    id: 'concours',
    name: 'Concours',
    category: 'classique',
    accent: '#14532d',
    idealFor: 'Fonction publique, concours, administrations, ONG.',
    style: style('#14532d', { font: 'serif', headerAlign: 'center', headingStyle: 'caps', skillsStyle: 'inline', photoShape: 'square' }),
    settings: { showBirthDate: true, showNationality: true },
    settingsNote: 'Date de naissance et nationalité affichées : elles sont souvent demandées pour les concours.',
  },
  {
    id: 'etudiant',
    name: 'Premier emploi',
    category: 'polyvalent',
    accent: '#7c3aed',
    idealFor: 'Étudiants et jeunes diplômés : la formation passe en premier.',
    style: style('#7c3aed', { layout: 'sidebar-left', sidebarTone: 'light', headingStyle: 'bar', skillsStyle: 'tags', educationFirst: true }),
  },
  {
    id: 'executif',
    name: 'Cadre dirigeant',
    category: 'classique',
    accent: '#1f2a44',
    idealFor: 'Managers, directeurs, profils expérimentés.',
    style: style('#1f2a44', { layout: 'banner', font: 'mixed', headingStyle: 'caps', skillsStyle: 'inline', density: 'compact' }),
  },
  {
    id: 'sante',
    name: 'Santé & social',
    category: 'polyvalent',
    accent: '#0f766e',
    idealFor: 'Santé, pharmacie, social, éducation.',
    style: style('#0f766e', { layout: 'sidebar-left', sidebarTone: 'accent', headingStyle: 'pill' }),
  },
  {
    id: 'minimal',
    name: 'Minimaliste',
    category: 'creatif',
    accent: '#111827',
    idealFor: 'Un rendu épuré et très aéré, pour tous les métiers.',
    style: style('#111827', { headerAlign: 'center', headingStyle: 'plain', skillsStyle: 'inline', density: 'normal', font: 'mixed' }),
  },
];

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
