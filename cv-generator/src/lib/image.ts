import { readAsDataUrl } from './files.ts';

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Image illisible.'));
    img.src = src;
  });
}

/** Recadre la photo au centre en carré et la compresse (JPEG) pour le CV. */
export async function preparePhoto(file: File, size = 600): Promise<string> {
  const img = await loadImage(await readAsDataUrl(file));
  const side = Math.min(img.naturalWidth, img.naturalHeight);
  // On garde un peu plus de haut que de bas : le visage est en général dans le tiers supérieur.
  const sx = (img.naturalWidth - side) / 2;
  const sy = Math.max(0, (img.naturalHeight - side) / 3);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, size, size);
  ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
  return canvas.toDataURL('image/jpeg', 0.86);
}

/** Recadre une signature (PNG transparent) au plus près du tracé. */
export function trimCanvas(source: HTMLCanvasElement, padding = 8): string | null {
  const ctx = source.getContext('2d')!;
  const { width, height } = source;
  const { data } = ctx.getImageData(0, 0, width, height);
  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 10) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;
  minX = Math.max(0, minX - padding);
  minY = Math.max(0, minY - padding);
  maxX = Math.min(width - 1, maxX + padding);
  maxY = Math.min(height - 1, maxY + padding);
  const out = document.createElement('canvas');
  out.width = maxX - minX + 1;
  out.height = maxY - minY + 1;
  out.getContext('2d')!.drawImage(source, minX, minY, out.width, out.height, 0, 0, out.width, out.height);
  return out.toDataURL('image/png');
}

/** Prépare une signature importée (photo ou scan) : réduite et en PNG. */
export async function prepareSignatureImage(file: File, maxWidth = 800): Promise<string> {
  const img = await loadImage(await readAsDataUrl(file));
  const scale = Math.min(1, maxWidth / img.naturalWidth);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.naturalWidth * scale);
  canvas.height = Math.round(img.naturalHeight * scale);
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  // Rend le fond clair transparent pour que la signature se pose proprement sur le document.
  const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = frame.data;
  for (let i = 0; i < d.length; i += 4) {
    const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    if (lum > 200) d[i + 3] = 0;
  }
  ctx.putImageData(frame, 0, 0);
  return trimCanvas(canvas, 4) ?? canvas.toDataURL('image/png');
}
