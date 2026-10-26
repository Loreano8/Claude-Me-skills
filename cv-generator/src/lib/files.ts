import type { Attachment } from '../../shared/schema.ts';

export const ACCEPTED_DOCS = 'application/pdf,image/png,image/jpeg,image/webp,text/plain';
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

/** Lit un fichier choisi par l'utilisateur et le prépare pour l'envoi à l'IA. */
export async function fileToAttachment(original: File): Promise<Attachment & { size: number }> {
  const file = await shrinkImage(original);
  if (file.size > MAX_FILE_BYTES) {
    throw new Error('Fichier trop lourd (10 Mo maximum).');
  }
  const mediaType = (file.type || (file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : '')) as Attachment['mediaType'];
  if (!ACCEPTED_DOCS.split(',').includes(mediaType)) {
    throw new Error('Format non pris en charge. Utilisez un PDF, une image (JPG, PNG) ou un fichier texte.');
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
