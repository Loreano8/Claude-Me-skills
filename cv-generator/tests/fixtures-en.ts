import type { AdaptResult, ClarifyResult, CoverLetterResult, KeywordsResult } from '../shared/schema.ts';
import { sampleAdapt } from './fixtures.ts';

// Réponses de démonstration en anglais (DEMO_LANG=en) : tutoriel et captures de la version anglaise, sans nom réel.

export const sampleAdaptEn: AdaptResult = {
  language: 'en',
  job: {
    title: 'Chief Accountant',
    company: 'West Logistics Group',
    location: 'Cotonou',
    contractType: 'Permanent',
    reference: 'CA-2026-14',
    keyRequirements: ['5 years of experience', 'SYSCOHADA', 'Tax', 'Team management', 'ERP'],
  },
  cv: {
    personal: { ...sampleAdapt.cv.personal, firstName: 'First', lastName: 'Last', title: 'Senior Accountant', email: 'first.last@email.com', phone: '+229 01 00 00 00 00', address: '', city: 'Cotonou', country: 'Benin', nationality: '', birthDate: '', drivingLicense: '', linkedin: '' },
    summary:
      'Accountant with 5 years of experience in transport, specialising in SYSCOHADA, tax and payroll. Used to monthly closings and to improving processes, ready to lead an accounting team.',
    experiences: [
      {
        position: 'Accountant',
        company: 'Urban transport company',
        location: 'Cotonou',
        startDate: '01/2021',
        endDate: '',
        current: true,
        achievements: [
          'File tax returns (VAT, corporate tax) with zero penalties since 2021',
          'Cut late supplier payments by 30% with a new approval process',
          'Run the monthly payroll for 120 employees',
        ],
      },
      {
        position: 'Audit assistant (internship)',
        company: 'Audit and advisory firm',
        location: 'Cotonou',
        startDate: '02/2020',
        endDate: '07/2020',
        current: false,
        achievements: ['Take part in 6 statutory audit engagements'],
      },
    ],
    education: [
      { degree: 'Master’s in Accounting, Control and Audit', school: 'University of Abomey-Calavi', location: 'Cotonou', startDate: '2018', endDate: '2020', details: 'With honours' },
      { degree: 'Bachelor’s in Management', school: 'University of Parakou', location: 'Parakou', startDate: '2015', endDate: '2018', details: '' },
    ],
    skills: ['SYSCOHADA', 'Tax', 'General accounting', 'Payroll', 'Sage 100', 'Advanced Excel'],
    softSkills: ['Rigour', 'Autonomy', 'Team spirit'],
    languages: [
      { name: 'French', level: 'Fluent (C1)' },
      { name: 'English', level: 'Fluent (C1)' },
    ],
    certifications: [{ name: 'Sage Accounting Certificate', issuer: 'Sage', date: '2022' }],
    interests: ['Basketball (amateur club)', 'Volunteering'],
  },
  analysis: {
    matchScore: 72,
    matchScoreAfter: 86,
    matchedKeywords: ['SYSCOHADA', 'Tax', '5 years of experience', 'Payroll'],
    missingKeywords: ['Team management', 'ERP'],
    changes: ['Title matched to the job title', 'Summary rewritten for a lead role', 'Tax achievements moved to the top'],
    advice: ['Prepare a concrete example of leading a team', 'Name the ERP if you have used one'],
  },
};

/** CV obtenu à l'import (avant adaptation). */
export const sampleStructureEn = { ...sampleAdaptEn.cv, personal: { ...sampleAdaptEn.cv.personal, title: 'Accountant' } };

export const sampleLetterEn: CoverLetterResult = {
  language: 'en',
  recipientName: 'Human Resources',
  recipientCompany: 'West Logistics Group',
  recipientAddress: 'Industrial zone\nCotonou',
  subject: 'Application for the position of Chief Accountant (ref. CA-2026-14)',
  salutation: 'Dear Hiring Manager,',
  paragraphs: [
    'Your group is building up its finance team to support its regional growth: this is exactly the challenge I want to take on as Chief Accountant.',
    'Since 2021, I have kept the books of a transport company with 120 employees: tax returns with zero penalties, a reliable monthly payroll, and late supplier payments cut by 30% thanks to a new approval process.',
    'I already work with carriers and know your clients well. I would be glad to discuss in an interview how I could help with your closings and lead the team.',
  ],
  closing: 'Yours sincerely,',
};

export const sampleClarifyEn: ClarifyResult = {
  job: { title: '', company: 'West Logistics Group' },
  questions: [{ question: 'The post lists two jobs: which one are you interested in?', options: ['Accountant', 'Management controller'] }],
};

export const sampleKeywordsEn: KeywordsResult = {
  job: { title: 'Chief Accountant', company: 'West Logistics Group' },
  keywords: [
    { term: 'Chief Accountant', variants: ['accountant', 'head of accounting'] },
    { term: 'SYSCOHADA', variants: ['OHADA'] },
    { term: 'Tax returns', variants: ['tax', 'VAT'] },
    { term: 'Monthly closings', variants: ['monthly closing', 'month-end close'] },
    { term: 'Team management', variants: ['management', 'lead a team'] },
    { term: 'ERP', variants: ['SAP', 'Odoo'] },
  ],
};

export const sampleLetterQuestionsEn = {
  questions: [
    { question: 'What attracts you to this company?', hint: 'For example: a product you use, its reputation in your city.' },
    { question: 'Tell us about a time you saved your employer time or money.', hint: 'What you did, and the result.' },
  ],
};
