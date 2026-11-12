import type { CvDocument } from '../types.ts';
import { achievementsList, fullName } from './cv.ts';

export interface Check {
  level: 'ok' | 'tip' | 'warn';
  text: string;
}

/** Débuts de ligne qui décrivent une fonction au lieu d'une action. */
const WEAK_START = /^\s*(responsable d(e|u|es)|chargée? d(e|u|es)|en charge d(e|u|es)|participation (à|a|aux)|aide (à|a|aux)|tâches? :|missions? :|duties|responsible for|in charge of)\b/i;
/** Pronoms personnels en tête ou dans la ligne d'une réalisation. */
const PRONOUN = /(^|[\s«(])((je|nous|i|we)(?=\s)|j['’])/i;
const REFERENCES = /r[ée]f[ée]rences?\s+(disponibles?|sur demande|available)/i;
/** Au-delà, une réalisation fait plus de deux lignes dans un CV d'une page. */
const LONG_LINE = 180;

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

  // Formulation des réalisations (conseils des guides France Travail, Choisir le service public, ADEM, Toledo, UPenn).
  const lines = cv.experiences.flatMap((e) => achievementsList(e.achievements).map((text) => ({ text, where: e.position || e.company || 'une expérience' })));
  const weak = lines.filter((l) => WEAK_START.test(l.text));
  if (weak.length) {
    tip(`Commencez par un verbe d’action plutôt que « ${weak[0].text.match(WEAK_START)![0].trim()} » (${weak[0].where}) : écrivez ce que vous avez fait, par exemple « Gérer », « Organiser », « Former ».`);
  }
  if (lines.some((l) => PRONOUN.test(l.text))) tip('Retirez « je », « j’ai » et « nous » des réalisations : la ligne commence directement par le verbe (« Gérer la paie », pas « J’ai géré la paie »).');
  const long = lines.find((l) => l.text.length > LONG_LINE);
  if (long) tip(`Une réalisation dépasse deux lignes (${long.where}) : gardez une idée par ligne, la plus parlante.`);
  const crowded = cv.experiences.find((e) => achievementsList(e.achievements).length > 5);
  if (crowded) tip(`${achievementsList(crowded.achievements).length} lignes pour « ${crowded.position || crowded.company || 'une expérience'} » : 3 ou 4 suffisent, en commençant par les plus utiles pour le poste.`);
  if ([cv.summary, ...cv.interests, ...cv.experiences.map((e) => e.achievements)].some((t) => REFERENCES.test(t))) {
    tip('Retirez « Références disponibles sur demande » : c’est sous-entendu, et la place sert mieux à autre chose.');
  }
  if (cv.softSkills.length > 0 && cv.softSkills.length >= cv.skills.length) {
    tip('Les qualités (rigueur, autonomie…) convainquent mieux quand une réalisation les montre : gardez-en 3 ou 4 et prouvez-les dans vos expériences.');
  }

  if (cv.skills.length === 0) tip('Listez vos compétences clés : les logiciels de tri (ATS) les recherchent.');
  if (cv.skills.length > 15) tip('Plus de 15 compétences : gardez les plus pertinentes pour le poste.');
  if (cv.languages.length === 0) tip('Précisez les langues que vous parlez, avec un niveau (A1 à C2).');

  if ((cv.settings.template === 'classique' || cv.settings.template === 'canada') && cv.settings.showPhoto && cv.photo) {
    tip('Pour une candidature en France, au Canada ou dans un pays anglophone, la photo est facultative, voire déconseillée.');
  }
  if (cv.settings.showBirthDate && cv.settings.template !== 'concours') tip('La date de naissance n’est plus attendue dans beaucoup de pays : affichez-la seulement si l’offre la demande.');

  if (out.length === 0) out.push({ level: 'ok', text: 'Votre CV respecte les bonnes pratiques principales. Pensez à l’adapter à chaque offre.' });
  return out;
}
