// Dossier de candidature : réunit CV, lettre, pièces (PDF, photos, documents scannés) en un seul PDF.
// Tout se passe sur l'appareil : les pièces d'identité et diplômes ne sont jamais envoyés au serveur.

/** Rendu d'une photo : « scan » (noir et blanc net, fond blanc) ou couleur (carte d'identité, photo). */
export type ScanMode = 'scan' | 'couleur';

const MAX_SIDE = 1800;
const A4 = { w: 595.28, h: 841.89 };
const MARGIN = 24;

function loadBitmap(file: Blob): Promise<ImageBitmap> {
  return createImageBitmap(file, { imageOrientation: 'from-image' });
}

/**
 * Prépare une photo de document : redressée d'un quart de tour si demandé, réduite,
 * puis « scannée » (ombres et fond gris éclaircis, texte foncé et net) ou simplement éclaircie en couleur.
 */
export async function processPhoto(file: Blob, mode: ScanMode, rotation: 0 | 90 | 180 | 270): Promise<Blob> {
  const bitmap = await loadBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const turned = rotation === 90 || rotation === 270;

  const canvas = document.createElement('canvas');
  canvas.width = turned ? h : w;
  canvas.height = turned ? w : h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.drawImage(bitmap, -w / 2, -h / 2, w, h);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  bitmap.close();

  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  if (mode === 'scan') whiten(img, canvas);
  else brighten(img);
  ctx.putImageData(img, 0, 0);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', mode === 'scan' ? 0.82 : 0.86));
  if (!blob) throw new Error('Impossible de traiter cette photo.');
  return blob;
}

/**
 * Effet scanner : on estime l'éclairage de la feuille (image très floutée) et on divise par lui,
 * ce qui efface ombres et fond gris ; puis on renforce le contraste du texte.
 */
function whiten(img: ImageData, source: HTMLCanvasElement) {
  const { width, height, data } = img;
  // Fond estimé : image réduite à ~1/24 puis agrandie (le lissage fait office de flou), sans ctx.filter
  // (absent de certains navigateurs mobiles).
  const small = document.createElement('canvas');
  small.width = Math.max(1, Math.round(width / 24));
  small.height = Math.max(1, Math.round(height / 24));
  const sctx = small.getContext('2d')!;
  sctx.imageSmoothingQuality = 'high';
  sctx.drawImage(source, 0, 0, small.width, small.height);
  const big = document.createElement('canvas');
  big.width = width;
  big.height = height;
  const bctx = big.getContext('2d', { willReadFrequently: true })!;
  bctx.imageSmoothingQuality = 'high';
  bctx.drawImage(small, 0, 0, width, height);
  const bg = bctx.getImageData(0, 0, width, height).data;

  for (let i = 0; i < data.length; i += 4) {
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    const light = Math.max(1, 0.299 * bg[i] + 0.587 * bg[i + 1] + 0.114 * bg[i + 2]);
    // 1 = blanc du papier ; le texte est nettement en dessous.
    let v = Math.min(1, gray / light);
    v = v > 0.88 ? 1 : Math.pow(Math.max(0, (v - 0.25) / 0.63), 1.6);
    const out = Math.round(v * 255);
    data[i] = data[i + 1] = data[i + 2] = out;
  }
}

/** Couleur : étirement léger des niveaux (photo souvent terne ou sombre). */
function brighten(img: ImageData) {
  const { data } = img;
  const hist = new Uint32Array(256);
  for (let i = 0; i < data.length; i += 4) hist[Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2])]++;
  const total = data.length / 4;
  let lo = 0;
  let hi = 255;
  for (let acc = 0; lo < 255 && (acc += hist[lo]) < total * 0.01; lo++);
  for (let acc = 0; hi > 0 && (acc += hist[hi]) < total * 0.02; hi--);
  if (hi - lo < 40) return;
  const k = 255 / (hi - lo);
  for (let i = 0; i < data.length; i += 4) {
    for (let c = 0; c < 3; c++) data[i + c] = Math.max(0, Math.min(255, (data[i + c] - lo) * k));
  }
}

export type DossierPart =
  | { kind: 'pdf'; name: string; bytes: ArrayBuffer }
  | { kind: 'image'; name: string; blob: Blob };

/** Assemble les pièces dans l'ordre : les PDF gardent leurs pages, chaque image devient une page A4. */
export async function buildDossier(parts: DossierPart[]): Promise<Blob> {
  const { PDFDocument } = await import('pdf-lib');
  const out = await PDFDocument.create();
  for (const part of parts) {
    if (part.kind === 'pdf') {
      let src;
      try {
        src = await PDFDocument.load(part.bytes, { ignoreEncryption: true });
      } catch {
        throw new Error(`« ${part.name} » n’a pas pu être lu (PDF protégé ou abîmé). Enregistrez-le à nouveau ou prenez-le en photo.`);
      }
      const pages = await out.copyPages(src, src.getPageIndices());
      pages.forEach((p) => out.addPage(p));
    } else {
      const bytes = new Uint8Array(await part.blob.arrayBuffer());
      const image = part.blob.type === 'image/png' ? await out.embedPng(bytes) : await out.embedJpg(bytes);
      // Page A4 dans le sens de l'image ; l'image tient dans les marges, sans être agrandie au-delà de sa taille.
      const landscape = image.width > image.height;
      const page = out.addPage(landscape ? [A4.h, A4.w] : [A4.w, A4.h]);
      const { width: pw, height: ph } = page.getSize();
      const scale = Math.min((pw - 2 * MARGIN) / image.width, (ph - 2 * MARGIN) / image.height, 2);
      const w = image.width * scale;
      const h = image.height * scale;
      page.drawImage(image, { x: (pw - w) / 2, y: (ph - h) / 2, width: w, height: h });
    }
  }
  if (out.getPageCount() === 0) throw new Error('Ajoutez au moins un document.');
  out.setCreator('CV Studio');
  out.setProducer('CV Studio');
  const bytes = await out.save();
  return new Blob([bytes as BlobPart], { type: 'application/pdf' });
}

/** Nombre de pages d'un PDF importé (affiché dans la liste). */
export async function pdfPageCount(bytes: ArrayBuffer): Promise<number | null> {
  try {
    const { PDFDocument } = await import('pdf-lib');
    return (await PDFDocument.load(bytes, { ignoreEncryption: true })).getPageCount();
  } catch {
    return null;
  }
}

export function formatSize(bytes: number): string {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} Ko` : `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} Mo`;
}
