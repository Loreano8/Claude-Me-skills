import { pdf } from '@react-pdf/renderer';
import type { CoverLetter, CvDocument } from '../types.ts';
import { CvPdf } from './CvPdf.tsx';
import { LetterPdf } from './LetterPdf.tsx';
import { registerFonts } from './fonts.ts';
import { TranscriptPdf } from './TranscriptPdf.tsx';

export async function renderCvPdf(cv: CvDocument): Promise<Blob> {
  registerFonts();
  return pdf(<CvPdf cv={cv} />).toBlob();
}

export async function renderLetterPdf(letter: CoverLetter, cv: CvDocument): Promise<Blob> {
  registerFonts();
  return pdf(<LetterPdf letter={letter} cv={cv} />).toBlob();
}

export async function renderTranscriptPdf(title: string, text: string): Promise<Blob> {
  registerFonts();
  return pdf(<TranscriptPdf title={title} text={text} />).toBlob();
}
