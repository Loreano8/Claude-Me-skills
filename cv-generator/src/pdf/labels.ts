import type { Lang } from '../../shared/schema.ts';

export const LABELS = {
  fr: {
    profile: 'Profil',
    experience: 'Expérience professionnelle',
    education: 'Formation',
    skills: 'Compétences',
    softSkills: 'Qualités',
    languages: 'Langues',
    certifications: 'Certifications',
    interests: "Centres d'intérêt",
    contact: 'Contact',
    present: "aujourd'hui",
    born: 'Né(e) le',
    nationality: 'Nationalité',
    doneAt: 'Fait à',
    on: 'le',
  },
  en: {
    profile: 'Profile',
    experience: 'Work experience',
    education: 'Education',
    skills: 'Skills',
    softSkills: 'Soft skills',
    languages: 'Languages',
    certifications: 'Certifications',
    interests: 'Interests',
    contact: 'Contact',
    present: 'present',
    born: 'Born',
    nationality: 'Nationality',
    doneAt: 'Signed in',
    on: 'on',
  },
} satisfies Record<Lang, Record<string, string>>;

export type Labels = (typeof LABELS)['fr'];
