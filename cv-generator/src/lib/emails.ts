import type { CvDocument } from '../types.ts';
import { fullName } from './cv.ts';

/** Un e-mail prêt à envoyer : objet et texte. */
export interface EmailDraft {
  to: string;
  subject: string;
  body: string;
}

/** Délai conseillé avant de relancer une candidature restée sans réponse. */
export const FOLLOW_UP_DAYS = 7;
const DAY = 86_400_000;

/** Adresse de contact trouvée dans le texte de l'offre (la première), sinon vide. */
export function findEmail(text: string): string {
  return text.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/)?.[0] ?? '';
}

/** « au poste de Comptable chez Groupe X », selon ce qui est connu. */
function about(position: string, company: string): string {
  const p = position.trim();
  const c = company.trim();
  if (p && c) return `au poste de ${p} chez ${c}`;
  if (p) return `au poste de ${p}`;
  if (c) return `chez ${c}`;
  return '';
}

function signature(cv: CvDocument): string {
  return [fullName(cv.personal), cv.personal.phone, cv.personal.email].filter((s) => s.trim()).join('\n');
}

/** Le message qui accompagne le CV (et la lettre) : court, poli, sans formule creuse. */
export function applicationEmail(cv: CvDocument, o: { position: string; company: string; to?: string; withLetter: boolean }): EmailDraft {
  const name = fullName(cv.personal);
  const target = about(o.position, o.company);
  const subject = [o.position.trim() ? `Candidature au poste de ${o.position.trim()}` : 'Candidature', name].filter(Boolean).join(' : ');
  const body = [
    'Madame, Monsieur,',
    '',
    `Je vous adresse ma candidature${target ? ` ${target}` : ''}. Vous trouverez en pièce${o.withLetter ? 's' : ''} jointe${o.withLetter ? 's' : ''} mon CV${o.withLetter ? ' et ma lettre de motivation' : ''}.`,
    '',
    'Je reste disponible pour un entretien, à la date qui vous conviendra.',
    '',
    'Cordialement,',
    '',
    signature(cv),
  ].join('\n');
  return { to: o.to ?? '', subject, body };
}

/** La relance, une semaine après l'envoi resté sans réponse. */
export function followUpEmail(cv: CvDocument, o: { position: string; company: string; sentAt?: number; to?: string }): EmailDraft {
  const target = about(o.position, o.company);
  const when = o.sentAt ? `Le ${new Date(o.sentAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}, je vous ai adressé` : 'Je vous ai adressé récemment';
  const subject = `Relance : candidature${o.position.trim() ? ` au poste de ${o.position.trim()}` : ''}`;
  const body = [
    'Madame, Monsieur,',
    '',
    `${when} ma candidature${target ? ` ${target}` : ''}. Je reviens vers vous pour savoir où en est le recrutement.`,
    '',
    'Ce poste m’intéresse toujours, et je reste disponible pour un entretien. Vous trouverez à nouveau mon CV en pièce jointe.',
    '',
    'Cordialement,',
    '',
    signature(cv),
  ].join('\n');
  return { to: o.to ?? '', subject, body };
}

/** Lien qui ouvre la messagerie avec l'e-mail déjà rempli (les pièces jointes s'ajoutent à la main). */
export function mailto(d: EmailDraft): string {
  return `mailto:${encodeURIComponent(d.to)}?subject=${encodeURIComponent(d.subject)}&body=${encodeURIComponent(d.body)}`;
}

/** Jours écoulés depuis l'envoi. */
export function daysSince(at: number, now = Date.now()): number {
  return Math.floor((now - at) / DAY);
}

/** Une candidature envoyée, sans réponse depuis au moins une semaine, est à relancer (une seule fois). */
export function needsFollowUp(a: { status: string; sentAt?: number; followedUpAt?: number }, now = Date.now()): boolean {
  return a.status === 'envoyee' && Boolean(a.sentAt) && !a.followedUpAt && daysSince(a.sentAt!, now) >= FOLLOW_UP_DAYS;
}
