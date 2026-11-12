import { loadImage } from './image.ts';

import { t } from '../i18n.ts';
// Photo pro : le fond de la photo est remplacé par une couleur unie, directement sur l'appareil.
// Le modèle de détourage de portrait (MediaPipe, licence Apache 2.0) n'est chargé qu'au premier usage.

export const BACKGROUNDS = [
  { id: 'blanc', label: t('Blanc'), color: '#ffffff' },
  { id: 'gris', label: t('Gris clair'), color: '#e9edf2' },
  { id: 'bleu', label: t('Bleu clair'), color: '#dbe6f5' },
] as const;

type Segmenter = import('@mediapipe/tasks-vision').ImageSegmenter;
let segmenter: Promise<Segmenter> | null = null;

function load(): Promise<Segmenter> {
  segmenter ??= (async () => {
    const { ImageSegmenter } = await import('@mediapipe/tasks-vision');
    const base = import.meta.env.BASE_URL;
    return ImageSegmenter.createFromOptions(
      // Seule la version « SIMD » est fournie : elle tourne sur les navigateurs et téléphones actuels.
      { wasmLoaderPath: `${base}mediapipe/vision_wasm_internal.js`, wasmBinaryPath: `${base}mediapipe/vision_wasm_internal.wasm` },
      {
        baseOptions: { modelAssetPath: `${base}models/selfie_segmenter.tflite`, delegate: 'CPU' },
        runningMode: 'IMAGE',
        outputConfidenceMasks: true,
        outputCategoryMask: false,
      },
    );
  })().catch((error) => {
    segmenter = null;
    throw error;
  });
  return segmenter;
}

/** Remplace le fond d'une photo (data URL) par une couleur unie ; renvoie une nouvelle photo JPEG. */
export async function plainBackground(photo: string, color: string): Promise<string> {
  const [seg, img] = await Promise.all([load(), loadImage(photo)]);
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const result = seg.segment(img);
  const mask = result.confidenceMasks?.[0];
  if (!mask) throw new Error(t('Impossible de détourer cette photo. Essayez une photo de face, bien éclairée.'));
  const values = mask.getAsFloat32Array();
  const mw = mask.width;
  const mh = mask.height;
  result.close();

  // Masque de la personne (opacité = confiance), adouci pour des bords naturels.
  const maskCanvas = document.createElement('canvas');
  maskCanvas.width = mw;
  maskCanvas.height = mh;
  const mctx = maskCanvas.getContext('2d')!;
  const data = mctx.createImageData(mw, mh);
  let person = 0;
  for (let i = 0; i < values.length; i++) {
    const a = Math.min(1, Math.max(0, (values[i] - 0.15) / 0.7));
    if (a > 0.5) person++;
    data.data[i * 4 + 3] = Math.round(a * 255);
  }
  if (person < values.length * 0.05) throw new Error(t('Aucun visage n’a été trouvé sur cette photo. Essayez une photo de face, bien éclairée.'));
  mctx.putImageData(data, 0, 0);

  const personCanvas = document.createElement('canvas');
  personCanvas.width = w;
  personCanvas.height = h;
  const pctx = personCanvas.getContext('2d')!;
  pctx.drawImage(img, 0, 0);
  pctx.globalCompositeOperation = 'destination-in';
  pctx.filter = `blur(${Math.max(1, Math.round(w / 300))}px)`;
  pctx.drawImage(maskCanvas, 0, 0, w, h);

  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const octx = out.getContext('2d')!;
  octx.fillStyle = color;
  octx.fillRect(0, 0, w, h);
  octx.drawImage(personCanvas, 0, 0);
  return out.toDataURL('image/jpeg', 0.9);
}
