import type { CvDocument } from '../types.ts';
import type { Labels } from './labels.ts';

export const FONT = 'Inter';

/** Mélange une couleur avec du blanc (amount = 0 → couleur, 1 → blanc). */
export function tint(hex: string, amount: number): string {
  const n = parseInt(hex.replace('#', ''), 16);
  const mix = (c: number) => Math.round(c + (255 - c) * amount);
  const r = mix((n >> 16) & 255), g = mix((n >> 8) & 255), b = mix(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

export function dateRange(start: string, end: string, current: boolean, L: Labels): string {
  const to = current ? L.present : end;
  if (start && to) return `${start} – ${to}`;
  return start || to || '';
}

export interface ContactItem {
  kind: 'email' | 'phone' | 'address' | 'linkedin' | 'website' | 'birth' | 'nationality' | 'license';
  value: string;
}

export function contactItems(cv: CvDocument, L: Labels): ContactItem[] {
  const p = cv.personal;
  const s = cv.settings;
  const address = [p.address, p.city, p.country].map((x) => x.trim()).filter(Boolean).join(', ');
  const items: (ContactItem | false)[] = [
    !!p.phone && { kind: 'phone', value: p.phone },
    !!p.email && { kind: 'email', value: p.email },
    !!address && { kind: 'address', value: address },
    !!p.linkedin && { kind: 'linkedin', value: p.linkedin.replace(/^https?:\/\/(www\.)?/, '') },
    !!p.website && { kind: 'website', value: p.website.replace(/^https?:\/\/(www\.)?/, '') },
    s.showBirthDate && !!p.birthDate && { kind: 'birth', value: `${L.born} ${p.birthDate}` },
    s.showNationality && !!p.nationality && { kind: 'nationality', value: `${L.nationality} : ${p.nationality}` },
    !!p.drivingLicense && { kind: 'license', value: p.drivingLicense },
  ];
  return items.filter((x): x is ContactItem => Boolean(x));
}

export function signatureLine(cv: CvDocument, L: Labels): string {
  const place = cv.settings.signaturePlace || cv.personal.city;
  const date = cv.settings.signatureDate;
  return [place && `${L.doneAt} ${place}`, date && `${L.on} ${date}`].filter(Boolean).join(', ');
}
