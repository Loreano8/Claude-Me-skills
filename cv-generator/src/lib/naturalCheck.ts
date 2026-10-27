import type { CoverLetter, CvDocument } from '../types.ts';
import { achievementsList } from './cv.ts';

// « Relecture naturelle » : repère les formules toutes faites qui font sonner un CV ou une lettre
// comme un texte écrit à la chaîne. Gratuit, sans IA : la personne reformule elle-même.

interface Cliche {
  pattern: RegExp;
  /** Ce qu'on montre à la personne. */
  label: string;
  tip: string;
}

/** Mot entier, accents compris (\b ne connaît pas les lettres accentuées). */
const w = (src: string) => new RegExp(`(?<!\\p{L})(?:${src})(?!\\p{L})`, 'iu');

const PROVE = 'Remplacez-le par un fait qui le montre (un chiffre, un exemple).';

const CLICHES: Cliche[] = [
  { pattern: w(String.raw`passionn[ée]e?s?`), label: 'passionné', tip: 'Dites plutôt ce que vous avez fait par intérêt pour ce métier.' },
  { pattern: w(String.raw`dynamiques?`), label: 'dynamique', tip: PROVE },
  { pattern: w(String.raw`motiv[ée]e?s?`), label: 'motivé', tip: 'La lettre elle-même montre votre motivation : citez plutôt une raison précise.' },
  { pattern: w(String.raw`rigoureu(x|se|ses)`), label: 'rigoureux', tip: PROVE },
  { pattern: w(String.raw`force de proposition`), label: 'force de proposition', tip: 'Citez une idée que vous avez proposée et ce qu’elle a donné.' },
  { pattern: w(String.raw`fort[e]?s? d[e’']\s?(une|un|mon|ma|mes|\d|plus)`), label: 'fort de…', tip: 'Commencez directement par l’expérience : « 5 ans en comptabilité… ».' },
  { pattern: w(String.raw`dot[ée]e?s? d[e’']`), label: 'doté de…', tip: 'Formule lourde : dites simplement ce que vous savez faire.' },
  { pattern: w(String.raw`(en|une?) (constante|perpétuelle) évolution`), label: 'en constante évolution', tip: 'Formule vague : supprimez-la ou soyez précis.' },
  { pattern: w(String.raw`relever (de nouveaux|des|un nouveau) d[ée]fis?`), label: 'relever de nouveaux défis', tip: 'Dites quel défi précis vous attire dans ce poste.' },
  { pattern: w(String.raw`mettre à profit`), label: 'mettre à profit', tip: 'Dites directement ce que vous ferez pour l’entreprise.' },
  { pattern: w(String.raw`valeur ajoutée`), label: 'valeur ajoutée', tip: 'Dites concrètement ce que vous apportez.' },
  { pattern: w(String.raw`c['’]est avec (un grand |beaucoup d['’]|un vif )?(intérêt|enthousiasme|plaisir)`), label: 'c’est avec un grand intérêt…', tip: 'Ouverture vue partout : commencez par le poste et ce qui vous y relie.' },
  { pattern: w(String.raw`je me permets`), label: 'je me permets', tip: 'Inutile : allez droit au but.' },
  { pattern: w(String.raw`prestigieu(x|se)`), label: 'prestigieuse entreprise', tip: 'Flatterie vague : citez plutôt un fait réel sur l’entreprise.' },
  { pattern: w(String.raw`synergies?`), label: 'synergie', tip: 'Jargon : dites avec qui vous avez travaillé et pour quoi faire.' },
  { pattern: w(String.raw`incontournables?`), label: 'incontournable', tip: 'Superlatif vague : supprimez-le ou citez un fait.' },
  { pattern: w(String.raw`esprit d['’]équipe`), label: 'esprit d’équipe', tip: 'Dites plutôt avec quelle équipe et sur quel projet.' },
  { pattern: w(String.raw`passionate`), label: 'passionate', tip: 'Show it with something you did instead.' },
  { pattern: w(String.raw`results?[- ]driven`), label: 'results-driven', tip: 'Give the result itself (a number, an outcome).' },
  { pattern: w(String.raw`detail[- ]oriented`), label: 'detail-oriented', tip: 'Give an example that shows it.' },
  { pattern: w(String.raw`team player`), label: 'team player', tip: 'Say which team and what you achieved together.' },
  { pattern: w(String.raw`proven track record`), label: 'proven track record', tip: 'Cite the record itself.' },
  { pattern: w(String.raw`fast[- ]paced`), label: 'fast-paced environment', tip: 'Cliché: describe the actual context.' },
  { pattern: w(String.raw`leverag(e|ed|ing)`), label: 'leverage', tip: 'Use a plain verb: used, applied.' },
  { pattern: w(String.raw`spearhead(ed)?`), label: 'spearheaded', tip: 'Use a plain verb: led, started.' },
  { pattern: w(String.raw`synerg(y|ies)`), label: 'synergy', tip: 'Jargon: say who you worked with and why.' },
  { pattern: w(String.raw`I am writing to express my interest`), label: 'I am writing to express my interest', tip: 'Overused opening: start with the role and why you fit.' },
  { pattern: w(String.raw`—`), label: 'tiret long (—)', tip: 'Typique des textes générés : remplacez-le par une virgule ou un point.' },
];

export interface ClicheHit {
  label: string;
  tip: string;
  /** Où la formule apparaît (accroche, poste, paragraphe…). */
  where: string[];
}

/** Formules toutes faites trouvées dans une liste de textes étiquetés. */
export function findCliches(texts: { where: string; text: string }[]): ClicheHit[] {
  const hits = new Map<string, ClicheHit>();
  for (const { where, text } of texts) {
    for (const c of CLICHES) {
      if (!c.pattern.test(text)) continue;
      const hit = hits.get(c.label) ?? { label: c.label, tip: c.tip, where: [] };
      if (!hit.where.includes(where)) hit.where.push(where);
      hits.set(c.label, hit);
    }
  }
  return [...hits.values()];
}

export function cvCliches(cv: CvDocument): ClicheHit[] {
  return findCliches([
    { where: 'titre', text: cv.personal.title },
    { where: 'accroche', text: cv.summary },
    ...cv.experiences.map((e) => ({ where: e.position || e.company || 'une expérience', text: achievementsList(e.achievements).join('\n') })),
    { where: 'qualités', text: cv.softSkills.join(', ') },
  ]);
}

export function letterCliches(letter: CoverLetter): ClicheHit[] {
  const paragraphs = letter.body.split(/\n\s*\n/).filter((t) => t.trim());
  return findCliches([{ where: 'objet', text: letter.subject }, ...paragraphs.map((text, i) => ({ where: `paragraphe ${i + 1}`, text }))]);
}
