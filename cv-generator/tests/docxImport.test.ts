import { describe, expect, it } from 'vitest';
import { Document, Header, Packer, Paragraph, Table, TableCell, TableRow, TextRun } from 'docx';
import { beforeAll } from 'vitest';
import { docxToText, fileToAttachment } from '../src/lib/files.ts';

async function word() {
  const doc = new Document({
    sections: [
      {
        headers: { default: new Header({ children: [new Paragraph('Prénom Nom · prenom.nom@email.com · +229 01 00 00 00 00')] }) },
        children: [
          new Paragraph({ children: [new TextRun('Comptable & contrôleur')] }),
          new Paragraph('Expérience : Société de transport, 2021 à aujourd’hui'),
          new Table({ rows: [new TableRow({ children: [new TableCell({ children: [new Paragraph('Excel')] }), new TableCell({ children: [new Paragraph('Sage 100')] })] })] }),
        ],
      },
    ],
  });
  return new Blob([new Uint8Array(await Packer.toBuffer(doc))]);
}

beforeAll(() => {
  // Node n'a pas FileReader : version minimale pour readAsDataUrl.
  (globalThis as any).FileReader ??= class {
    result: string | null = null;
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    readAsDataURL(b: Blob) {
      b.arrayBuffer().then((buf) => {
        this.result = `data:${b.type};base64,${Buffer.from(buf).toString('base64')}`;
        this.onload?.();
      }, () => this.onerror?.());
    }
  };
});

describe('import d’un CV Word', () => {
  it('lit le texte, l’en-tête avec les coordonnées et les tableaux', async () => {
    const text = await docxToText(await word());
    expect(text).toContain('prenom.nom@email.com');
    expect(text).toContain('Comptable & contrôleur');
    expect(text).toContain('Société de transport, 2021 à aujourd’hui');
    expect(text).toMatch(/Excel[\s|]+Sage 100/);
  });

  it('envoie le Word comme du texte, même quand le téléphone ne donne aucun type de fichier', async () => {
    const file = new File([await word()], 'CV Aurelle.docx', { type: '' });
    const att = await fileToAttachment(file);
    expect(att).toMatchObject({ name: 'CV Aurelle.docx', mediaType: 'text/plain' });
    expect(Buffer.from(att.data, 'base64').toString('utf8')).toContain('prenom.nom@email.com');
  });

  it('refuse proprement un ancien .doc, un format inconnu et un faux .docx', async () => {
    await expect(fileToAttachment(new File(['x'], 'ancien.doc', { type: 'application/msword' }))).rejects.toThrow(/\.doc/);
    await expect(fileToAttachment(new File(['x'], 'cv.xyz', { type: '' }))).rejects.toThrow(/Format non pris en charge/);
    await expect(fileToAttachment(new File(['pas un zip'], 'faux.docx', { type: '' }))).rejects.toThrow();
  });

  it('reconnaît un PDF au nom quand le type est vide ou générique', async () => {
    const att = await fileToAttachment(new File(['%PDF-1.4 test'], 'cv.pdf', { type: 'application/octet-stream' }));
    expect(att.mediaType).toBe('application/pdf');
  });
});
