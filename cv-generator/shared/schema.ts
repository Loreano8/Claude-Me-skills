// Schémas partagés entre le client et le serveur.
// Ils décrivent le contenu d'un CV tel que l'IA le lit et le renvoie
// (sans photo, signature ni réglages de mise en page, qui restent côté client).
import { z } from 'zod';

export const Lang = z.enum(['fr', 'en']);
export type Lang = z.infer<typeof Lang>;

export const AiPersonal = z.object({
  firstName: z.string(),
  lastName: z.string(),
  title: z.string().describe('Intitulé du poste visé ou du métier, ex. « Comptable confirmé »'),
  email: z.string(),
  phone: z.string(),
  address: z.string(),
  city: z.string(),
  country: z.string(),
  birthDate: z.string().describe('Format JJ/MM/AAAA, vide si inconnue'),
  nationality: z.string(),
  drivingLicense: z.string().describe('Ex. « Permis B », vide si inconnu'),
  linkedin: z.string(),
  website: z.string(),
});

export const AiExperience = z.object({
  position: z.string(),
  company: z.string(),
  location: z.string(),
  startDate: z.string().describe('Format MM/AAAA, ou AAAA si le mois est inconnu'),
  endDate: z.string().describe('Format MM/AAAA ou AAAA ; vide si poste actuel'),
  current: z.boolean(),
  achievements: z.array(z.string()).describe('Réalisations, une par élément, chacune commençant par un verbe d’action'),
});

export const AiEducation = z.object({
  degree: z.string(),
  school: z.string(),
  location: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  details: z.string().describe('Mention, spécialité ou projet notable ; vide sinon'),
});

export const AiLanguage = z.object({
  name: z.string(),
  level: z.string().describe('Ex. « Langue maternelle », « Courant (C1) », « Intermédiaire (B1) »'),
});

export const AiCertification = z.object({
  name: z.string(),
  issuer: z.string(),
  date: z.string(),
});

export const AiCvContent = z.object({
  personal: AiPersonal,
  summary: z.string().describe('Accroche de 2 à 4 phrases'),
  experiences: z.array(AiExperience),
  education: z.array(AiEducation),
  skills: z.array(z.string()).describe('Compétences techniques / métier'),
  softSkills: z.array(z.string()).describe('Qualités personnelles'),
  languages: z.array(AiLanguage),
  certifications: z.array(AiCertification),
  interests: z.array(z.string()),
});
export type AiCvContent = z.infer<typeof AiCvContent>;

// ---- Réponses de l'IA -------------------------------------------------------

export const StructureResult = z.object({
  cv: AiCvContent,
  suggestions: z.array(z.string()).describe('3 à 6 conseils concrets pour améliorer le CV'),
});
export type StructureResult = z.infer<typeof StructureResult>;

export const JobSummary = z.object({
  title: z.string(),
  company: z.string(),
  location: z.string(),
  contractType: z.string(),
  reference: z.string().describe('Référence de l’offre si elle est indiquée, sinon vide'),
  keyRequirements: z.array(z.string()),
});
export type JobSummary = z.infer<typeof JobSummary>;

export const AdaptResult = z.object({
  language: Lang.describe('Langue dans laquelle le CV adapté est rédigé'),
  job: JobSummary,
  cv: AiCvContent,
  analysis: z.object({
    matchScore: z.number().describe('Adéquation du CV d’origine à l’offre, de 0 à 100'),
    matchScoreAfter: z.number().describe('Adéquation du CV adapté à l’offre, de 0 à 100'),
    matchedKeywords: z.array(z.string()),
    missingKeywords: z.array(z.string()),
    changes: z.array(z.string()),
    advice: z.array(z.string()),
  }),
});
export type AdaptResult = z.infer<typeof AdaptResult>;

export const CoverLetterResult = z.object({
  language: Lang.describe('Langue dans laquelle la lettre est rédigée'),
  recipientName: z.string().describe('Nom ou fonction du destinataire si connu, sinon « Service des ressources humaines »'),
  recipientCompany: z.string(),
  recipientAddress: z.string(),
  subject: z.string(),
  salutation: z.string(),
  paragraphs: z.array(z.string()),
  closing: z.string().describe('Formule de politesse finale'),
});
export type CoverLetterResult = z.infer<typeof CoverLetterResult>;

export const InterviewResult = z.object({
  language: Lang.describe('Langue de la fiche'),
  questions: z
    .array(
      z.object({
        question: z.string(),
        why: z.string().describe('Pourquoi le recruteur la posera (élément de l’offre)'),
        answer: z.string().describe('Comment y répondre avec les expériences réelles du CV, 2 à 4 phrases'),
      }),
    )
    .describe('6 à 8 questions probables'),
  weakPoints: z
    .array(z.object({ gap: z.string(), howToAddress: z.string() }))
    .describe('1 à 3 écarts entre le profil et l’offre, et comment les présenter'),
  questionsToAsk: z.array(z.string()).describe('2 à 3 questions pertinentes à poser au recruteur'),
  tips: z.array(z.string()).describe('2 à 4 conseils pratiques pour cet entretien'),
});
export type InterviewResult = z.infer<typeof InterviewResult>;

export const TranslateResult = z.object({
  cv: AiCvContent,
  notes: z.array(z.string()).describe('Adaptations faites pour le pays visé, en français, 2 à 5 éléments courts'),
});
export type TranslateResult = z.infer<typeof TranslateResult>;

/** Marché visé par une version traduite (conventions, orthographe). */
export const Market = z.enum(['international', 'uk', 'us', 'france', 'afrique']);
export type Market = z.infer<typeof Market>;

// ---- Requêtes envoyées au serveur ------------------------------------------

export const Attachment = z.object({
  name: z.string().max(200),
  mediaType: z.enum(['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'image/gif', 'text/plain']),
  // Contenu encodé en base64 (sans préfixe data:).
  data: z.string().max(14_000_000),
});
export type Attachment = z.infer<typeof Attachment>;

export const JobInput = z.object({
  text: z.string().max(60_000).default(''),
  file: Attachment.nullable().default(null),
});
export type JobInput = z.infer<typeof JobInput>;

export const StructureRequest = z.object({
  text: z.string().max(60_000).default(''),
  file: Attachment.nullable().default(null),
  current: AiCvContent.nullable().default(null),
  lang: Lang.default('fr'),
});
export type StructureRequest = z.output<typeof StructureRequest>;

export const AdaptRequest = z.object({
  cv: AiCvContent,
  job: JobInput,
  lang: Lang.nullable().default(null),
});
export type AdaptRequest = z.output<typeof AdaptRequest>;

export const CoverLetterRequest = z.object({
  cv: AiCvContent,
  job: JobInput,
  notes: z.string().max(5_000).default(''),
  tone: z.enum(['formel', 'dynamique', 'chaleureux']).default('formel'),
  length: z.enum(['courte', 'standard']).default('standard'),
  lang: Lang.nullable().default(null),
});
export type CoverLetterRequest = z.output<typeof CoverLetterRequest>;

export const InterviewRequest = z.object({
  cv: AiCvContent,
  job: JobInput,
  lang: Lang.nullable().default(null),
});
export type InterviewRequest = z.output<typeof InterviewRequest>;

export const TranslateRequest = z.object({
  cv: AiCvContent,
  targetLang: Lang,
  market: Market.default('international'),
});
export type TranslateRequest = z.output<typeof TranslateRequest>;
