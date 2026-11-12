import type { CvDocument } from '../types.ts';
import { achievementsList, fullName } from './cv.ts';

import { t } from '../i18n.ts';
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

  if (!fullName(p)) warn(t('Ajoutez votre prénom et votre nom.'));
  if (!p.email || !p.phone) warn(t('Indiquez un e-mail et un numéro de téléphone pour être joignable.'));
  if (p.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(p.email)) warn(t('L’adresse e-mail semble incorrecte.'));
  if (!p.title) tip(t('Ajoutez un titre clair sous votre nom (le poste visé) : c’est la première chose lue.'));

  const summary = cv.summary.trim();
  if (!summary) tip(t('Rédigez une accroche de 2 à 4 phrases : votre métier, votre expérience, ce que vous apportez.'));
  else if (summary.length > 650) tip(t('Votre accroche est longue : visez 3 à 4 lignes maximum.'));

  if (cv.experiences.length === 0 && cv.education.length === 0) warn(t('Ajoutez au moins une expérience ou une formation.'));
  const empty = cv.experiences.filter((e) => achievementsList(e.achievements).length === 0);
  if (empty.length) tip(t('Décrivez vos réalisations pour : {0}.', [empty.map((e) => e.position || e.company || t('une expérience')).join(', ')]));
  const withNumbers = cv.experiences.some((e) => /\d/.test(e.achievements));
  if (cv.experiences.length && !withNumbers) tip(t('Chiffrez vos résultats (%, montants, nombre de clients, taille d’équipe) : c’est ce qui convainc.'));
  if (cv.experiences.some((e) => !e.startDate)) tip(t('Indiquez les dates de chaque expérience (MM/AAAA).'));

  // Formulation des réalisations (conseils des guides France Travail, Choisir le service public, ADEM, Toledo, UPenn).
  const lines = cv.experiences.flatMap((e) => achievementsList(e.achievements).map((text) => ({ text, where: e.position || e.company || t('une expérience') })));
  const weak = lines.filter((l) => WEAK_START.test(l.text));
  if (weak.length) {
    tip(t('Commencez par un verbe d’action plutôt que « {0} » ({1}) : écrivez ce que vous avez fait, par exemple « Gérer », « Organiser », « Former ».', [weak[0].text.match(WEAK_START)![0].trim(), weak[0].where]));
  }
  if (lines.some((l) => PRONOUN.test(l.text))) tip(t('Retirez « je », « j’ai » et « nous » des réalisations : la ligne commence directement par le verbe (« Gérer la paie », pas « J’ai géré la paie »).'));
  const long = lines.find((l) => l.text.length > LONG_LINE);
  if (long) tip(t('Une réalisation dépasse deux lignes ({0}) : gardez une idée par ligne, la plus parlante.', [long.where]));
  const crowded = cv.experiences.find((e) => achievementsList(e.achievements).length > 5);
  if (crowded) tip(t('{0} lignes pour « {1} » : 3 ou 4 suffisent, en commençant par les plus utiles pour le poste.', [achievementsList(crowded.achievements).length, crowded.position || crowded.company || t('une expérience')]));
  if ([cv.summary, ...cv.interests, ...cv.experiences.map((e) => e.achievements)].some((t) => REFERENCES.test(t))) {
    tip(t('Retirez « Références disponibles sur demande » : c’est sous-entendu, et la place sert mieux à autre chose.'));
  }
  if (cv.softSkills.length > 0 && cv.softSkills.length >= cv.skills.length) {
    tip(t('Les qualités (rigueur, autonomie…) convainquent mieux quand une réalisation les montre : gardez-en 3 ou 4 et prouvez-les dans vos expériences.'));
  }

  if (cv.skills.length === 0) tip(t('Listez vos compétences clés : les logiciels de tri (ATS) les recherchent.'));
  if (cv.skills.length > 15) tip(t('Plus de 15 compétences : gardez les plus pertinentes pour le poste.'));
  if (cv.languages.length === 0) tip(t('Précisez les langues que vous parlez, avec un niveau (A1 à C2).'));

  if ((cv.settings.template === 'classique' || cv.settings.template === 'canada') && cv.settings.showPhoto && cv.photo) {
    tip(t('Pour une candidature en France, au Canada ou dans un pays anglophone, la photo est facultative, voire déconseillée.'));
  }
  if (cv.settings.showBirthDate && cv.settings.template !== 'concours') tip(t('La date de naissance n’est plus attendue dans beaucoup de pays : affichez-la seulement si l’offre la demande.'));

  if (out.length === 0) out.push({ level: 'ok', text: t('Votre CV respecte les bonnes pratiques principales. Pensez à l’adapter à chaque offre.') });
  return out;
}
