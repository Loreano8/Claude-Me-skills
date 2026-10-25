import { describe, expect, it, beforeAll } from 'vitest';
import { createRequire } from 'node:module';
import { Font, renderToBuffer } from '@react-pdf/renderer';
import { Packer } from 'docx';
import { CvPdf } from '../src/pdf/CvPdf.tsx';
import { LetterPdf } from '../src/pdf/LetterPdf.tsx';
import { FONT, SERIF } from '../src/pdf/theme.ts';
import { CATALOG, settingsForTemplate } from '../src/pdf/catalog.ts';
import { buildCvDocx, buildLetterDocx, imageSize } from '../src/export/docx.ts';
import type { TemplateId } from '../src/types.ts';
import { sampleCv, sampleLetter, sampleTemplateAnalysis } from './fixtures.ts';
import { emptyLetter } from '../src/lib/cv.ts';

const PNG_1x1 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
const JPEG_1x1 =
  'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';

beforeAll(() => {
  const require = createRequire(import.meta.url);
  const file = (w: string, style = 'normal') => require.resolve(`@fontsource/inter/files/inter-latin-${w}-${style}.woff`);
  Font.register({
    family: FONT,
    fonts: [
      { src: file('400'), fontWeight: 400 },
      { src: file('400', 'italic'), fontWeight: 400, fontStyle: 'italic' },
      { src: file('500'), fontWeight: 500 },
      { src: file('600'), fontWeight: 600 },
      { src: file('700'), fontWeight: 700 },
    ],
  });
  const serif = (w: string) => require.resolve(`@fontsource/source-serif-4/files/source-serif-4-latin-${w}-normal.woff`);
  Font.register({
    family: SERIF,
    fonts: [
      { src: serif('400'), fontWeight: 400 },
      { src: serif('600'), fontWeight: 500 },
      { src: serif('600'), fontWeight: 600 },
      { src: serif('700'), fontWeight: 700 },
    ],
  });
});

function fullCv(template: TemplateId) {
  const cv = sampleCv();
  cv.photo = JPEG_1x1;
  cv.signature = PNG_1x1;
  cv.settings = { ...cv.settings, template, showSignature: true, showBirthDate: true, signatureDate: '20/10/2026' };
  return cv;
}

describe('export PDF', () => {
  for (const entry of CATALOG) {
    it(`génère le modèle ${entry.id}`, async () => {
      const cv = fullCv(entry.id);
      cv.settings = { ...cv.settings, ...settingsForTemplate(entry) };
      const buf = await renderToBuffer(<CvPdf cv={cv} />);
      expect(buf.subarray(0, 5).toString()).toBe('%PDF-');
      expect(buf.length).toBeGreaterThan(5000);
    });
  }

  it('génère un modèle « perso » à partir d’un style importé, en corrigeant une couleur invalide', async () => {
    const cv = fullCv('perso');
    cv.settings.customStyle = { ...sampleTemplateAnalysis.style, layout: 'labels', accent: 'violet' };
    cv.settings.accent = 'pas une couleur';
    const buf = await renderToBuffer(<CvPdf cv={cv} />);
    expect(buf.subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('passe sur plusieurs pages quand le CV est long', async () => {
    const cv = fullCv('moderne');
    cv.experiences = Array.from({ length: 12 }, (_, i) => ({ ...cv.experiences[0], id: `x${i}` }));
    const buf = await renderToBuffer(<CvPdf cv={cv} />);
    const pages = buf.toString('latin1').match(/\/Type \/Page\b/g) ?? [];
    expect(pages.length).toBeGreaterThan(1);
  });

  it('génère la version gratuite (avec mention) et la version Pro', async () => {
    const free = fullCv('moderne');
    const pro = { ...fullCv('moderne'), unlocked: { at: 1 } };
    const [a, b] = await Promise.all([renderToBuffer(<CvPdf cv={free} />), renderToBuffer(<CvPdf cv={pro} />)]);
    expect(a.subarray(0, 5).toString()).toBe('%PDF-');
    expect(b.subarray(0, 5).toString()).toBe('%PDF-');
    expect(a.length).toBeGreaterThan(b.length); // la mention ajoute du contenu sur la page
  });

  it('génère la lettre', async () => {
    const letter = { ...emptyLetter(), ...sampleLetter, body: sampleLetter.paragraphs.join('\n\n') };
    const buf = await renderToBuffer(<LetterPdf letter={letter} cv={fullCv('moderne')} />);
    expect(buf.subarray(0, 5).toString()).toBe('%PDF-');
  });
});

describe('export Word', () => {
  it('lit la taille des images PNG et JPEG', () => {
    const bytes = (url: string) => new Uint8Array(Buffer.from(url.split(',')[1], 'base64'));
    expect(imageSize(bytes(PNG_1x1))).toEqual({ width: 1, height: 1 });
    expect(imageSize(bytes(JPEG_1x1))).toEqual({ width: 1, height: 1 });
  });

  it('génère le CV et la lettre au format .docx', async () => {
    const cv = fullCv('classique');
    const cvBuf = await Packer.toBuffer(buildCvDocx(cv));
    expect(cvBuf.subarray(0, 2).toString()).toBe('PK');
    const letter = { ...emptyLetter(), ...sampleLetter, body: sampleLetter.paragraphs.join('\n\n') };
    const letterBuf = await Packer.toBuffer(buildLetterDocx(letter, cv));
    expect(letterBuf.subarray(0, 2).toString()).toBe('PK');
  });
});
