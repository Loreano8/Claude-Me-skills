import type { AdaptResult, CoverLetterResult, TranslateResult } from '../shared/schema.ts';
import type { CvDocument } from '../src/types.ts';
import { defaultSettings } from '../src/lib/cv.ts';

export function sampleCv(): CvDocument {
  return {
    id: 'cv-sample',
    label: 'Mon CV',
    updatedAt: 0,
    personal: {
      firstName: 'Awa',
      lastName: 'Diallo',
      title: 'Comptable confirmée',
      email: 'awa.diallo@email.com',
      phone: '+221 77 000 00 00',
      address: '12 rue des Écoles',
      city: 'Dakar',
      country: 'Sénégal',
      birthDate: '14/03/1996',
      nationality: 'Sénégalaise',
      drivingLicense: 'Permis B',
      linkedin: 'https://www.linkedin.com/in/awa-diallo',
      website: '',
    },
    photo: null,
    signature: null,
    summary:
      'Comptable avec 5 ans d’expérience en entreprise de transport, spécialisée en fiscalité et en paie. Rigoureuse et autonome, je fiabilise les clôtures mensuelles et réduis les délais de paiement.',
    experiences: [
      {
        id: 'e1',
        position: 'Comptable',
        company: 'Société de transport urbain',
        location: 'Dakar',
        startDate: '01/2021',
        endDate: '',
        current: true,
        achievements:
          'Gérer la paie mensuelle de 120 salariés\nPréparer les déclarations fiscales (TVA, IS) sans aucune pénalité depuis 2021\nRéduire de 30 % les retards de paiement fournisseurs grâce à un nouveau circuit de validation',
      },
      {
        id: 'e2',
        position: 'Assistante auditrice (stage)',
        company: 'Cabinet d’audit et de conseil',
        location: 'Dakar',
        startDate: '02/2020',
        endDate: '07/2020',
        current: false,
        achievements: 'Participer à 6 missions d’audit légal\nContrôler les rapprochements bancaires de 3 clients',
      },
    ],
    education: [
      { id: 'd1', degree: 'Master Comptabilité, Contrôle, Audit', school: 'Université Cheikh Anta Diop', location: 'Dakar', startDate: '2018', endDate: '2020', details: 'Mention bien' },
      { id: 'd2', degree: 'Licence en gestion', school: 'Université Gaston Berger', location: 'Saint-Louis', startDate: '2015', endDate: '2018', details: '' },
    ],
    skills: ['Comptabilité générale', 'Fiscalité', 'Paie', 'Sage 100', 'Excel avancé', 'SYSCOHADA'],
    softSkills: ['Rigueur', 'Autonomie', 'Esprit d’équipe'],
    languages: [
      { id: 'l1', name: 'Français', level: 'Courant (C1)' },
      { id: 'l2', name: 'Wolof', level: 'Langue maternelle' },
      { id: 'l3', name: 'Anglais', level: 'Intermédiaire (B1)' },
    ],
    certifications: [{ id: 'c1', name: 'Certificat Sage Comptabilité', issuer: 'Sage', date: '2022' }],
    interests: ['Basket (club amateur)', 'Bénévolat associatif', 'Lecture'],
    settings: defaultSettings(),
  };
}

export const sampleAdapt: AdaptResult = {
  language: 'fr',
  job: {
    title: 'Responsable comptable',
    company: 'Groupe Logistique Ouest',
    location: 'Dakar',
    contractType: 'CDI',
    reference: 'RC-2026-14',
    keyRequirements: ['5 ans d’expérience', 'SYSCOHADA', 'Fiscalité', 'Management d’équipe', 'ERP'],
  },
  cv: {
    personal: { ...sampleCv().personal, title: 'Responsable comptable' },
    summary:
      'Comptable confirmée avec 5 ans d’expérience dans le transport, experte SYSCOHADA, fiscalité et paie. Habituée aux clôtures mensuelles et à l’amélioration des processus, prête à encadrer une équipe comptable.',
    experiences: [
      {
        position: 'Comptable',
        company: 'Société de transport urbain',
        location: 'Dakar',
        startDate: '01/2021',
        endDate: '',
        current: true,
        achievements: [
          'Préparer les déclarations fiscales (TVA, IS) sans aucune pénalité depuis 2021',
          'Réduire de 30 % les retards de paiement fournisseurs grâce à un nouveau circuit de validation',
          'Gérer la paie mensuelle de 120 salariés',
        ],
      },
      {
        position: 'Assistante auditrice (stage)',
        company: 'Cabinet d’audit et de conseil',
        location: 'Dakar',
        startDate: '02/2020',
        endDate: '07/2020',
        current: false,
        achievements: ['Participer à 6 missions d’audit légal'],
      },
    ],
    education: [
      { degree: 'Master Comptabilité, Contrôle, Audit', school: 'Université Cheikh Anta Diop', location: 'Dakar', startDate: '2018', endDate: '2020', details: 'Mention bien' },
      { degree: 'Licence en gestion', school: 'Université Gaston Berger', location: 'Saint-Louis', startDate: '2015', endDate: '2018', details: '' },
    ],
    skills: ['SYSCOHADA', 'Fiscalité', 'Comptabilité générale', 'Paie', 'Sage 100', 'Excel avancé'],
    softSkills: ['Rigueur', 'Autonomie', 'Esprit d’équipe'],
    languages: [
      { name: 'Français', level: 'Courant (C1)' },
      { name: 'Wolof', level: 'Langue maternelle' },
      { name: 'Anglais', level: 'Intermédiaire (B1)' },
    ],
    certifications: [{ name: 'Certificat Sage Comptabilité', issuer: 'Sage', date: '2022' }],
    interests: ['Basket (club amateur)', 'Bénévolat associatif'],
  },
  analysis: {
    matchScore: 72,
    matchedKeywords: ['SYSCOHADA', 'Fiscalité', '5 ans d’expérience', 'Paie'],
    missingKeywords: ['Management d’équipe', 'ERP'],
    changes: ['Titre aligné sur l’intitulé du poste', 'Accroche réécrite pour un poste de responsable', 'Réalisations fiscales mises en premier'],
    advice: ['Préparez un exemple concret de coordination d’équipe', 'Citez le nom de l’ERP si vous en avez utilisé un'],
  },
};

export const sampleLetter: CoverLetterResult = {
  language: 'fr',
  recipientName: 'Service des ressources humaines',
  recipientCompany: 'Groupe Logistique Ouest',
  recipientAddress: 'Zone industrielle\nDakar',
  subject: 'Candidature au poste de Responsable comptable (réf. RC-2026-14)',
  salutation: 'Madame, Monsieur,',
  paragraphs: [
    'Votre groupe structure aujourd’hui sa fonction finance pour accompagner sa croissance régionale : c’est précisément le défi que je souhaite relever en tant que Responsable comptable.',
    'Depuis 2021, je tiens la comptabilité d’une société de transport de 120 salariés : déclarations fiscales sans aucune pénalité, paie mensuelle fiabilisée et retards de paiement fournisseurs réduits de 30 % grâce à un nouveau circuit de validation.',
    'Votre exigence de rigueur et votre ancrage dans la logistique font écho à mon parcours. Je serais ravie de vous présenter, lors d’un entretien, la manière dont je pourrais contribuer à vos clôtures et à l’encadrement de l’équipe.',
  ],
  closing: 'Je vous prie d’agréer, Madame, Monsieur, l’expression de mes salutations distinguées.',
};


export const sampleTranslation: TranslateResult = {
  cv: {
    ...sampleAdapt.cv,
    personal: { ...sampleCv().personal, title: 'Senior Accountant', country: 'Senegal' },
    summary: 'Accountant with 5 years of experience in transport, specialising in tax and payroll.',
    skills: ['General accounting', 'Tax', 'Payroll', 'Sage 100', 'Advanced Excel', 'SYSCOHADA'],
    languages: [
      { name: 'French', level: 'Fluent (C1)' },
      { name: 'Wolof', level: 'Native' },
      { name: 'English', level: 'Intermediate (B1)' },
    ],
  },
  notes: ['Dates au format anglais', 'Diplômes accompagnés de leur équivalent'],
};
