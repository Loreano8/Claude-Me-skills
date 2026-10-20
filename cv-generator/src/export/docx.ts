import {
  AlignmentType,
  BorderStyle,
  Document,
  ImageRun,
  LineRuleType,
  Packer,
  Paragraph,
  Tab,
  Table,
  TableCell,
  TableRow,
  TabStopType,
  TextRun,
  VerticalAlign,
  WidthType,
  type ISectionOptions,
} from 'docx';
import type { CoverLetter, CvDocument } from '../types.ts';
import { achievementsList, fullName } from '../lib/cv.ts';
import { LABELS } from '../pdf/labels.ts';
import { letterParagraphs } from '../pdf/letterText.ts';
import { contactItems, dateRange, signatureLine } from '../pdf/theme.ts';

const FONT = 'Calibri';
const MARGIN = 1134; // 2 cm
const TEXT_WIDTH = 11906 - 2 * MARGIN; // largeur utile d'une page A4, en twips

const color = (hex: string) => hex.replace('#', '').toUpperCase();

function base64ToBytes(dataUrl: string): Uint8Array {
  const b64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  if (typeof Buffer !== 'undefined') return new Uint8Array(Buffer.from(b64, 'base64'));
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Lit la taille d'une image PNG ou JPEG à partir de ses octets. */
export function imageSize(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes[0] === 0x89 && bytes[1] === 0x50) {
    const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    return { width: v.getUint32(16), height: v.getUint32(20) };
  }
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    let i = 2;
    while (i < bytes.length) {
      if (bytes[i] !== 0xff) return null;
      const marker = bytes[i + 1];
      const len = (bytes[i + 2] << 8) | bytes[i + 3];
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return { height: (bytes[i + 5] << 8) | bytes[i + 6], width: (bytes[i + 7] << 8) | bytes[i + 8] };
      }
      i += 2 + len;
    }
  }
  return null;
}

function image(dataUrl: string, maxWidth: number, maxHeight: number): ImageRun {
  const data = base64ToBytes(dataUrl);
  const size = imageSize(data) ?? { width: maxWidth, height: maxHeight };
  const scale = Math.min(maxWidth / size.width, maxHeight / size.height);
  return new ImageRun({
    type: dataUrl.startsWith('data:image/png') ? 'png' : 'jpg',
    data,
    transformation: { width: Math.round(size.width * scale), height: Math.round(size.height * scale) },
  });
}

const noBorders = {
  top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  insideHorizontal: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  insideVertical: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
};

function sectionHeading(text: string, accent: string): Paragraph {
  return new Paragraph({
    spacing: { before: 260, after: 100 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: color(accent), space: 2 } },
    keepNext: true,
    children: [new TextRun({ text: text.toUpperCase(), bold: true, color: color(accent), size: 22, characterSpacing: 10 })],
  });
}

function titleWithDates(title: string, dates: string): Paragraph {
  return new Paragraph({
    tabStops: [{ type: TabStopType.RIGHT, position: TEXT_WIDTH }],
    spacing: { before: 120 },
    keepNext: true,
    children: [
      new TextRun({ text: title, bold: true, size: 21 }),
      new TextRun({ children: [new Tab(), dates], size: 19, color: '4B5563' }),
    ],
  });
}

function bullet(text: string): Paragraph {
  return new Paragraph({ bullet: { level: 0 }, spacing: { after: 30 }, children: [new TextRun({ text })] });
}

function labelled(label: string, value: string): Paragraph {
  return new Paragraph({
    spacing: { after: 60 },
    children: [new TextRun({ text: `${label} : `, bold: true }), new TextRun({ text: value })],
  });
}

const docStyles = {
  default: { document: { run: { font: FONT, size: 20 }, paragraph: { spacing: { line: 264, lineRule: LineRuleType.AUTO } } } },
};

const pageProps: ISectionOptions['properties'] = {
  page: { margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN } },
};

export function buildCvDocx(cv: CvDocument): Document {
  const L = LABELS[cv.settings.headingLang];
  const accent = cv.settings.accent;
  const contacts = contactItems(cv, L);

  const headerText: Paragraph[] = [
    new Paragraph({ children: [new TextRun({ text: fullName(cv.personal), bold: true, size: 44, color: color(accent) })] }),
  ];
  if (cv.personal.title) {
    headerText.push(new Paragraph({ spacing: { before: 40 }, children: [new TextRun({ text: cv.personal.title, size: 24, color: '374151' })] }));
  }
  if (contacts.length) {
    headerText.push(
      new Paragraph({
        spacing: { before: 100 },
        children: [new TextRun({ text: contacts.map((c) => c.value).join('  |  '), size: 18, color: '374151' })],
      }),
    );
  }

  const children: (Paragraph | Table)[] = [];
  if (cv.settings.showPhoto && cv.photo) {
    children.push(
      new Table({
        width: { size: TEXT_WIDTH, type: WidthType.DXA },
        columnWidths: [TEXT_WIDTH - 1900, 1900],
        borders: noBorders,
        rows: [
          new TableRow({
            children: [
              new TableCell({ children: headerText, verticalAlign: VerticalAlign.CENTER, borders: noBorders }),
              new TableCell({
                verticalAlign: VerticalAlign.CENTER,
                borders: noBorders,
                children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [image(cv.photo, 105, 105)] })],
              }),
            ],
          }),
        ],
      }),
    );
  } else {
    children.push(...headerText);
  }

  if (cv.summary) {
    children.push(sectionHeading(L.profile, accent), new Paragraph({ alignment: AlignmentType.JUSTIFIED, text: cv.summary }));
  }

  if (cv.experiences.length) {
    children.push(sectionHeading(L.experience, accent));
    for (const e of cv.experiences) {
      children.push(
        titleWithDates(e.position, dateRange(e.startDate, e.endDate, e.current, L)),
        new Paragraph({
          spacing: { after: 40 },
          children: [new TextRun({ text: [e.company, e.location].filter(Boolean).join(', '), italics: true, color: color(accent) })],
        }),
        ...achievementsList(e.achievements).map(bullet),
      );
    }
  }

  if (cv.education.length) {
    children.push(sectionHeading(L.education, accent));
    for (const e of cv.education) {
      children.push(
        titleWithDates(e.degree, dateRange(e.startDate, e.endDate, false, L)),
        new Paragraph({ children: [new TextRun({ text: [e.school, e.location].filter(Boolean).join(', '), italics: true, color: color(accent) })] }),
      );
      if (e.details) children.push(new Paragraph({ text: e.details }));
    }
  }

  if (cv.skills.length || cv.softSkills.length || cv.languages.length) {
    children.push(sectionHeading(L.skills, accent));
    if (cv.skills.length) children.push(labelled(L.skills, cv.skills.join(', ')));
    if (cv.softSkills.length) children.push(labelled(L.softSkills, cv.softSkills.join(', ')));
    if (cv.languages.length) {
      children.push(labelled(L.languages, cv.languages.map((l) => (l.level ? `${l.name} (${l.level})` : l.name)).join(', ')));
    }
  }

  if (cv.certifications.length) {
    children.push(sectionHeading(L.certifications, accent));
    for (const c of cv.certifications) {
      children.push(
        new Paragraph({
          spacing: { after: 40 },
          children: [
            new TextRun({ text: c.name, bold: true }),
            new TextRun({ text: [c.issuer, c.date].filter(Boolean).length ? `, ${[c.issuer, c.date].filter(Boolean).join(', ')}` : '' }),
          ],
        }),
      );
    }
  }

  if (cv.interests.length) {
    children.push(sectionHeading(L.interests, accent), new Paragraph({ text: cv.interests.join(', ') }));
  }

  if (cv.settings.showSignature && cv.signature) {
    const line = signatureLine(cv, L);
    children.push(
      new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { before: 360 }, keepNext: true, children: [new TextRun({ text: line, size: 18, color: '4B5563' })] }),
      new Paragraph({ alignment: AlignmentType.RIGHT, keepNext: true, children: [image(cv.signature, 160, 48)] }),
      new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: fullName(cv.personal), bold: true, size: 18 })] }),
    );
  }

  return new Document({
    creator: 'CV Studio',
    title: `CV – ${fullName(cv.personal)}`,
    styles: docStyles,
    sections: [{ properties: pageProps, children }],
  });
}

export function buildLetterDocx(letter: CoverLetter, cv: CvDocument): Document {
  const p = cv.personal;
  const name = fullName(p);
  const indent = { left: 5200 };
  const children: Paragraph[] = [];

  children.push(new Paragraph({ children: [new TextRun({ text: name, bold: true, size: 24, color: color(letter.accent) })] }));
  for (const line of [p.title, [p.address, p.city, p.country].filter((x) => x.trim()).join(', '), p.phone, p.email]) {
    if (line) children.push(new Paragraph({ children: [new TextRun({ text: line, size: 19 })] }));
  }

  const recipient = [letter.recipientName, letter.recipientCompany, ...letter.recipientAddress.split('\n')].filter((x) => x.trim());
  recipient.forEach((line, i) =>
    children.push(new Paragraph({ indent, spacing: { before: i === 0 ? 360 : 0 }, children: [new TextRun({ text: line, bold: i === 0 && !!letter.recipientName })] })),
  );

  const dateLine = [letter.place || p.city, letter.date].filter(Boolean).join(', ');
  if (dateLine) children.push(new Paragraph({ indent, spacing: { before: 300 }, text: dateLine }));

  if (letter.subject) {
    children.push(
      new Paragraph({
        spacing: { before: 420, after: 300 },
        children: [new TextRun({ text: 'Objet : ', bold: true }), new TextRun({ text: letter.subject.replace(/^objet\s*:\s*/i, '') })],
      }),
    );
  }

  if (letter.salutation) children.push(new Paragraph({ spacing: { after: 200 }, text: letter.salutation }));
  for (const para of letterParagraphs(letter.body)) {
    children.push(new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { after: 180 }, text: para }));
  }
  if (letter.closing) children.push(new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { after: 240 }, text: letter.closing }));

  if (letter.showSignature && cv.signature) {
    children.push(new Paragraph({ alignment: AlignmentType.RIGHT, keepNext: true, children: [image(cv.signature, 170, 52)] }));
  }
  children.push(new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: name, bold: true })] }));

  return new Document({
    creator: 'CV Studio',
    title: `Lettre de motivation – ${name}`,
    styles: { default: { document: { run: { font: FONT, size: 21 }, paragraph: { spacing: { line: 276, lineRule: LineRuleType.AUTO } } } } },
    sections: [{ properties: { page: { margin: { top: 1300, bottom: 1300, left: 1300, right: 1300 } } }, children }],
  });
}

export const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export async function docxBlob(doc: Document): Promise<Blob> {
  return Packer.toBlob(doc);
}
