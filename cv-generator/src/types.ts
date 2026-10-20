import type { AdaptResult, Attachment, Lang } from '../shared/schema.ts';

export type TemplateId = 'moderne' | 'classique' | 'elegant';

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
}

export interface JobPostingDraft {
  text: string;
  file: (Attachment & { size: number }) | null;
}
