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

/** Lit un fichier choisi par l'utilisateur et le prépare pour l'envoi à l'IA. */
export async function fileToAttachment(file: File): Promise<Attachment & { size: number }> {
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
