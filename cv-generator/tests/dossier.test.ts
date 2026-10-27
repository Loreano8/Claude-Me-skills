import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { buildDossier, formatSize } from '../src/lib/dossier.ts';

const PNG_1x1 = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='), (c) => c.charCodeAt(0));

async function pdfWith(pages: number): Promise<ArrayBuffer> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i++) doc.addPage([595, 842]);
  const bytes = await doc.save();
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

describe('dossier en un seul PDF', () => {
  it('assemble les PDF et les images dans l’ordre donné', async () => {
    const blob = await buildDossier([
      { kind: 'pdf', name: 'CV', bytes: await pdfWith(2) },
      { kind: 'image', name: 'Pièce d’identité', blob: new Blob([PNG_1x1], { type: 'image/png' }) },
      { kind: 'pdf', name: 'Diplôme', bytes: await pdfWith(1) },
    ]);
    const out = await PDFDocument.load(await blob.arrayBuffer());
    expect(out.getPageCount()).toBe(4);
    expect(out.getCreator()).toBe('CV Studio');
  });

  it('explique quand un PDF est illisible, et refuse un dossier vide', async () => {
    await expect(buildDossier([{ kind: 'pdf', name: 'abime.pdf', bytes: new TextEncoder().encode('pas un pdf').buffer as ArrayBuffer }])).rejects.toThrow(/abime\.pdf/);
    await expect(buildDossier([])).rejects.toThrow(/au moins un document/);
  });

  it('affiche la taille lisiblement', () => {
    expect(formatSize(300 * 1024)).toBe('300 Ko');
    expect(formatSize(2.5 * 1024 * 1024)).toBe('2,5 Mo');
  });
});
