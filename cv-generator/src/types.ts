import type { AdaptResult, Attachment, CatalogTemplateId, InterviewResult, Lang, Market, TemplateAnalysis, TemplateStyle } from '../shared/schema.ts';

/** Modèle du catalogue, ou « perso » : style repris d'un CV importé. */
export type TemplateId = CatalogTemplateId | 'perso';

export interface Personal {
  firstName: string;
  lastName: string;
  title: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  country: string;
  birthDate: string;
  nationality: string;
  drivingLicense: string;
  linkedin: string;
  website: string;
}

export interface Experience {
  id: string;
  position: string;
  company: string;
  location: string;
  startDate: string;
  endDate: string;
  current: boolean;
  /** Une réalisation par ligne. */
  achievements: string;
}

export interface Education {
  id: string;
  degree: string;
  school: string;
  location: string;
  startDate: string;
  endDate: string;
  details: string;
}

export interface LanguageSkill {
  id: string;
  name: string;
  level: string;
}

export interface Certification {
  id: string;
  name: string;
  issuer: string;
  date: string;
}

export interface CvSettings {
  template: TemplateId;
  accent: string;
  headingLang: Lang;
  showPhoto: boolean;
  photoShape: 'round' | 'square';
  showBirthDate: boolean;
  showNationality: boolean;
  showSignature: boolean;
  signaturePlace: string;
  signatureDate: string;
  /** Style repris d'un CV modèle importé (modèle « perso »). */
  customStyle?: TemplateStyle;
  /** Avis de l'IA sur ce CV modèle. */
  customAnalysis?: Omit<TemplateAnalysis, 'style'>;
}

export interface CvDocument {
  id: string;
  label: string;
  updatedAt: number;
  personal: Personal;
  photo: string | null;
  signature: string | null;
  summary: string;
  experiences: Experience[];
  education: Education[];
  skills: string[];
  softSkills: string[];
  languages: LanguageSkill[];
  certifications: Certification[];
  interests: string[];
  settings: CvSettings;
  /** Présent quand ce CV a été adapté à une offre. */
  adaptation?: { job: AdaptResult['job']; analysis: AdaptResult['analysis']; createdAt: number };
  /** Version Pro (2 crédits, définitive pour ce CV) : PDF sans la mention « Créé avec CV Studio », tous les modèles, export Word. */
  unlocked?: { at: number };
  /** Présent quand ce CV est une version traduite. */
  translation?: { lang: Lang; market: Market; notes: string[]; createdAt: number };
}

/** Lettre conservée dans « Mes documents » (chaque lettre générée est gardée). */
export interface SavedLetter {
  id: string;
  /** CV à partir duquel la lettre a été écrite. */
  cvId: string;
  createdAt: number;
  updatedAt: number;
  letter: CoverLetter;
}

export interface CoverLetter {
  recipientName: string;
  recipientCompany: string;
  recipientAddress: string;
  place: string;
  date: string;
  subject: string;
  salutation: string;
  /** Paragraphes séparés par une ligne vide. */
  body: string;
  closing: string;
  showSignature: boolean;
  accent: string;
  /** Langue de la lettre (absente dans les lettres enregistrées avant l'ajout de l'anglais : français). */
  lang?: Lang;
}

export interface JobPostingDraft {
  text: string;
  file: (Attachment & { size: number }) | null;
}

export type ApplicationStatus = 'preparation' | 'envoyee' | 'entretien' | 'offre' | 'refus';

/** Une candidature suivie dans « Mes candidatures ». */
export interface Application {
  id: string;
  title: string;
  company: string;
  location: string;
  status: ApplicationStatus;
  createdAt: number;
  updatedAt: number;
  /** Date d'envoi, d'entretien… saisie librement (ex. 12/11). */
  date: string;
  notes: string;
  /** CV adapté à cette offre, s'il existe. */
  cvId?: string;
  score?: { before: number; after: number };
  interview?: InterviewResult;
  /** Témoignage « J'ai décroché le poste ! » : envoyé (avec de quoi le retirer) ou refusé. */
  testimonial?: { id: number; secret: string } | 'declined';
}
