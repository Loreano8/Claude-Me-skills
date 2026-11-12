import type { ReactNode } from 'react';
import { educationFirst } from '../lib/cv.ts';
import type { CvDocument } from '../types.ts';

/** Expériences et formation dans l'ordre qui convient au profil (formation d'abord pour un jeune diplômé). */
export function orderMain(cv: CvDocument, experiences: ReactNode, education: ReactNode): ReactNode[] {
  return educationFirst(cv) ? [education, experiences] : [experiences, education];
}
