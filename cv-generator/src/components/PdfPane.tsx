import { useEffect, useRef, useState } from 'react';
// Version « legacy » : inclut les compléments nécessaires aux WebView Android un peu anciennes.
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
import { Loader2 } from 'lucide-react';
import type { CoverLetter, CvDocument } from '../types.ts';
import { renderCvPdf, renderLetterPdf } from '../pdf/render.tsx';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export type PdfSource = { kind: 'cv'; cv: CvDocument } | { kind: 'letter'; letter: CoverLetter; cv: CvDocument };

/**
 * Aperçu fidèle : on génère le vrai PDF puis on le dessine avec pdf.js
 * (les navigateurs Android n'affichent pas les PDF dans une page web).
 */
export default function PdfPane({ source }: { source: PdfSource }) {
  const host = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [busy, setBusy] = useState(true);
  const [pages, setPages] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const el = host.current!;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // L'objet `source` est recréé à chaque rendu du parent : on ne dépend que de son contenu.
  const cv = source.cv;
  const letter = source.kind === 'letter' ? source.letter : null;

  useEffect(() => {
    if (!width) return;
    let cancelled = false;
    setBusy(true);
    const timer = setTimeout(async () => {
      try {
        const blob = letter ? await renderLetterPdf(letter, cv) : await renderCvPdf(cv);
        if (cancelled) return;
        const doc = await pdfjs.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise;
        const ratio = window.devicePixelRatio || 1;
        const canvases: HTMLCanvasElement[] = [];
        for (let n = 1; n <= doc.numPages; n++) {
          const page = await doc.getPage(n);
          const base = page.getViewport({ scale: 1 });
          const viewport = page.getViewport({ scale: (width / base.width) * ratio });
          const canvas = document.createElement('canvas');
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          canvas.style.width = '100%';
          canvas.className = 'block rounded-sm bg-white shadow-md ring-1 ring-slate-200';
          await page.render({ canvas, viewport }).promise;
          canvases.push(canvas);
        }
        await doc.destroy();
        if (cancelled) return;
        const el = host.current!;
        el.replaceChildren(...canvases);
        setPages(canvases.length);
        setError(null);
      } catch (e) {
        if (!cancelled) setError((e as Error).message || 'Aperçu indisponible');
      } finally {
        if (!cancelled) setBusy(false);
      }
    }, 450);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [cv, letter, width]);

  return (
    <div className="relative">
      {pages === 0 && !error && <div className="aspect-[1/1.414] w-full animate-pulse rounded-sm bg-white shadow-md ring-1 ring-slate-200" />}
      <div ref={host} className="flex flex-col gap-4" />
      {busy && (
        <div className="absolute top-3 right-3 flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1 text-xs text-slate-600 shadow">
          <Loader2 className="size-3.5 animate-spin" /> Mise à jour…
        </div>
      )}
      {!busy && pages > 1 && <p className="mt-2 text-center text-xs text-slate-500">{pages} pages</p>}
      {error && <p className="mt-2 text-sm text-red-600">Erreur d’aperçu : {error}</p>}
    </div>
  );
}
