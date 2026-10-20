import type { CoverLetter, CvDocument } from '../types.ts';
import { cvFileName } from '../lib/cv.ts';
import { saveFile } from './save.ts';

// Les bibliothèques PDF et Word sont lourdes : on ne les charge qu'au moment de l'export.

export async function exportCvPdf(cv: CvDocument): Promise<void> {
  const { renderCvPdf } = await import('../pdf/render.tsx');
  await saveFile(await renderCvPdf(cv), cvFileName(cv, 'pdf'));
}

export async function exportCvDocx(cv: CvDocument): Promise<void> {
  const { buildCvDocx, docxBlob } = await import('./docx.ts');
  await saveFile(await docxBlob(buildCvDocx(cv)), cvFileName(cv, 'docx'));
}

export async function exportLetterPdf(letter: CoverLetter, cv: CvDocument): Promise<void> {
  const { renderLetterPdf } = await import('../pdf/render.tsx');
  await saveFile(await renderLetterPdf(letter, cv), cvFileName(cv, 'pdf', 'Lettre_motivation'));
}

export async function exportLetterDocx(letter: CoverLetter, cv: CvDocument): Promise<void> {
  const { buildLetterDocx, docxBlob } = await import('./docx.ts');
  await saveFile(await docxBlob(buildLetterDocx(letter, cv)), cvFileName(cv, 'docx', 'Lettre_motivation'));
}
