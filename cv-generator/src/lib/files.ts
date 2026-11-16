import type { Attachment } from '../../shared/schema.ts';

import { t } from '../i18n.ts';
const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
/** Ce que propose le sélecteur de fichiers : PDF, images, texte et Word (.docx). */
export const ACCEPTED_DOCS = `application/pdf,image/png,image/jpeg,image/webp,text/plain,${DOCX},.docx,.pdf,.txt`;
/** Types que le serveur sait lire (le Word est converti en texte avant l'envoi). */
const SERVER_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'text/plain'];
const BY_EXTENSION: Record<string, string> = { pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', txt: 'text/plain', docx: DOCX };
export const MAX_FILE_BYTES = 10 * 1024 * 1024;

export function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/** Côté le plus long d'une image envoyée à l'IA : assez pour lire une écriture manuscrite, sans alourdir l'envoi. */
const MAX_IMAGE_SIDE = 2000;

/**
 * Réduit une photo prise au téléphone (souvent 4 000 px et 5 à 15 Mo) en JPEG léger.
 * Renvoie le fichier d'origine si l'image est déjà petite ou si le navigateur ne sait pas la réduire.
 */
export async function shrinkImage(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || typeof createImageBitmap !== 'function') return file;
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size <= 1.5 * 1024 * 1024) {
      bitmap.close();
      return file;
    }
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
    if (!blob) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
  } catch {
    return file;
  }
}

const decodeXml = (s: string) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n))).replace(/&amp;/g, '&');

/** Texte d'un fichier Word (.docx) : corps, en-têtes et pieds de page (les coordonnées s'y trouvent souvent). */
export async function docxToText(file: Blob): Promise<string> {
  const { default: JSZip } = await import('jszip');
  const zip = await JSZip.loadAsync(file);
  const parts = Object.keys(zip.files)
    .filter((n) => /^word\/(header\d*|footer\d*)\.xml$/.test(n))
    .sort()
    .concat(zip.file('word/document.xml') ? ['word/document.xml'] : []);
  if (!parts.includes('word/document.xml')) throw new Error(t('Ce fichier Word est illisible. Enregistrez-le en PDF et réessayez.'));
  const out: string[] = [];
  for (const name of parts) {
    const xml = await zip.file(name)!.async('string');
    const text = decodeXml(
      xml
        .replace(/<w:tab\/>/g, '\t')
        .replace(/<w:(br|cr)\b[^>]*\/>/g, '\n')
        .replace(/<\/w:tc>/g, ' | ')
        .replace(/<\/w:p>/g, '\n')
        .replace(/<[^>]+>/g, ''),
    )
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    if (text) out.push(text);
  }
  return out.join('\n\n').slice(0, 60_000);
}

const textToBase64 = (text: string) => {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
};

/** Lit un fichier choisi par l'utilisateur et le prépare pour l'envoi à l'IA. */
export async function fileToAttachment(original: File): Promise<Attachment & { size: number }> {
  const ext = original.name.toLowerCase().split('.').pop() ?? '';
  // Sur Android, le type d'un fichier est souvent vide ou « application/octet-stream » : on se fie aussi à son nom.
  const kind = original.type && original.type !== 'application/octet-stream' ? original.type : (BY_EXTENSION[ext] ?? '');
  if (ext === 'doc' || kind === 'application/msword') throw new Error(t('Les anciens fichiers Word (.doc) ne sont pas lisibles. Ouvrez-le dans Word et enregistrez-le en PDF ou en .docx, puis réessayez.'));
  if (kind === DOCX) {
    if (original.size > MAX_FILE_BYTES) throw new Error(t('Fichier trop lourd (10 Mo maximum).'));
    const text = await docxToText(original);
    if (text.length < 20) throw new Error(t('Ce fichier Word ne contient pas de texte lisible. Enregistrez-le en PDF et réessayez.'));
    return { name: original.name, mediaType: 'text/plain', data: textToBase64(text), size: original.size };
  }
  const file = await shrinkImage(original);
  if (file.size > MAX_FILE_BYTES) {
    throw new Error(t('Fichier trop lourd (10 Mo maximum).'));
  }
  const mediaType = (file.type && file.type !== 'application/octet-stream' ? file.type : kind) as Attachment['mediaType'];
  if (!SERVER_TYPES.includes(mediaType)) {
    throw new Error(t('Format non pris en charge. Utilisez un PDF, un fichier Word (.docx), une image (JPG, PNG) ou un fichier texte.'));
  }
  const dataUrl = await readAsDataUrl(file);
  return { name: file.name, mediaType, data: dataUrl.slice(dataUrl.indexOf(',') + 1), size: file.size };
}

export function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export function dataUrlMime(dataUrl: string): string {
  return dataUrl.slice(5, dataUrl.indexOf(';'));
}
