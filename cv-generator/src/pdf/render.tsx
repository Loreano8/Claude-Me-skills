import { pdf } from '@react-pdf/renderer';
import type { CoverLetter, CvDocument } from '../types.ts';
import { CvPdf } from './CvPdf.tsx';
import { LetterPdf } from './LetterPdf.tsx';
import { registerFonts } from './fonts.ts';
import { TranscriptPdf } from './TranscriptPdf.tsx';

/** Resserrages essayés, du plus léger au plus fort, quand le CV déborde un peu sur une 2e page. */
const FITS = [0.95, 0.9, 0.85];

/** Nombre de pages d'un PDF produit par react-pdf (les objets « page » ne sont pas compressés). */
export async function pdfPageCount(blob: Blob): Promise<number> {
  const text = new TextDecoder('latin1').decode(await blob.arrayBuffer());
  return (text.match(/\/Type\s*\/Page(?![s\w])/g) ?? []).length;
}

/**
 * Le CV en PDF. S'il fait 2 pages mais tiendrait sur une seule en resserrant un peu les textes et les espaces,
 * on prend la version sur une page : un CV d'une page est la norme attendue par les recruteurs.
 */
export async function renderCvPdf(cv: CvDocument): Promise<Blob> {
  return (await renderCvPdfFitted(cv)).blob;
}

/** Comme renderCvPdf, en disant aussi le resserrage appliqué (1 = aucun) et le nombre de pages. */
export async function renderCvPdfFitted(cv: CvDocument): Promise<{ blob: Blob; fit: number; pages: number }> {
  registerFonts();
  const blob = await pdf(<CvPdf cv={cv} />).toBlob();
  const pages = await pdfPageCount(blob);
  if (pages !== 2) return { blob, fit: 1, pages };
  for (const fit of FITS) {
    const tight = await pdf(<CvPdf cv={cv} fit={fit} />).toBlob();
    if ((await pdfPageCount(tight)) === 1) return { blob: tight, fit, pages: 1 };
  }
  return { blob, fit: 1, pages };
}

export async function renderLetterPdf(letter: CoverLetter, cv: CvDocument): Promise<Blob> {
  registerFonts();
  return pdf(<LetterPdf letter={letter} cv={cv} />).toBlob();
}

export async function renderTranscriptPdf(title: string, text: string): Promise<Blob> {
  registerFonts();
  return pdf(<TranscriptPdf title={title} text={text} />).toBlob();
}
