import type { CvDocument } from '../types.ts';
import { achievementsList, fullName } from './cv.ts';

export interface Check {
  level: 'ok' | 'tip' | 'warn';
  text: string;
}

/** Vérifications rapides du CV par rapport aux usages actuels du recrutement. */
export function checkCv(cv: CvDocument): Check[] {
  const p = cv.personal;
  const out: Check[] = [];
  const warn = (text: string) => out.push({ level: 'warn', text });
  const tip = (text: string) => out.push({ level: 'tip', text });

  if (!fullName(p)) warn('Ajoutez votre prénom et votre nom.');
  if (!p.email || !p.phone) warn('Indiquez un e-mail et un numéro de téléphone pour être joignable.');
  if (p.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(p.email)) warn('L’adresse e-mail semble incorrecte.');
  if (!p.title) tip('Ajoutez un titre clair sous votre nom (le poste visé) : c’est la première chose lue.');

  const summary = cv.summary.trim();
  if (!summary) tip('Rédigez une accroche de 2 à 4 phrases : votre métier, votre expérience, ce que vous apportez.');
  else if (summary.length > 650) tip('Votre accroche est longue : visez 3 à 4 lignes maximum.');

  if (cv.experiences.length === 0 && cv.education.length === 0) warn('Ajoutez au moins une expérience ou une formation.');
  const empty = cv.experiences.filter((e) => achievementsList(e.achievements).length === 0);
  if (empty.length) tip(`Décrivez vos réalisations pour : ${empty.map((e) => e.position || e.company || 'une expérience').join(', ')}.`);
  const withNumbers = cv.experiences.some((e) => /\d/.test(e.achievements));
  if (cv.experiences.length && !withNumbers) tip('Chiffrez vos résultats (%, montants, nombre de clients, taille d’équipe) : c’est ce qui convainc.');
  if (cv.experiences.some((e) => !e.startDate)) tip('Indiquez les dates de chaque expérience (MM/AAAA).');

  if (cv.skills.length === 0) tip('Listez vos compétences clés : les logiciels de tri (ATS) les recherchent.');
  if (cv.skills.length > 15) tip('Plus de 15 compétences : gardez les plus pertinentes pour le poste.');
  if (cv.languages.length === 0) tip('Précisez les langues que vous parlez, avec un niveau (A1 à C2).');

  if (cv.settings.template === 'classique' && cv.settings.showPhoto && cv.photo) {
    tip('Pour une candidature en France, au Canada ou dans un pays anglophone, la photo est facultative, voire déconseillée.');
  }
  if (cv.settings.showBirthDate) tip('La date de naissance n’est plus attendue dans beaucoup de pays : affichez-la seulement si l’offre la demande.');

  if (out.length === 0) out.push({ level: 'ok', text: 'Votre CV respecte les bonnes pratiques principales. Pensez à l’adapter à chaque offre.' });
  return out;
}
