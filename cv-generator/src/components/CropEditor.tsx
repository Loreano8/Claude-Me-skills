import { useRef, useState } from 'react';
import { Check, RotateCcw, X } from 'lucide-react';
import { FULL_QUAD, type Quad } from '../lib/dossier.ts';
import { Button } from './ui.tsx';

/**
 * Recadrage : la personne place les 4 coins de la feuille sur la photo (au doigt ou à la souris),
 * puis la page est redressée comme vue de face.
 */
export function CropEditor({ src, quad, onDone, onCancel }: { src: string; quad: Quad; onDone: (q: Quad) => void; onCancel: () => void }) {
  // Point de départ : les coins déjà placés, sinon un cadre légèrement en retrait des bords.
  const [points, setPoints] = useState<Quad>(() =>
    quad.every((p, i) => p.x === FULL_QUAD[i].x && p.y === FULL_QUAD[i].y)
      ? [
          { x: 0.06, y: 0.05 },
          { x: 0.94, y: 0.05 },
          { x: 0.94, y: 0.95 },
          { x: 0.06, y: 0.95 },
        ]
      : quad,
  );
  const [active, setActive] = useState<number | null>(null);
  const img = useRef<HTMLImageElement>(null);

  function moveTo(i: number, clientX: number, clientY: number) {
    const r = img.current?.getBoundingClientRect();
    if (!r) return;
    const x = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
    const y = Math.max(0, Math.min(1, (clientY - r.top) / r.height));
    setPoints((p) => p.map((pt, j) => (j === i ? { x, y } : pt)) as Quad);
  }

  const poly = points.map((p) => `${p.x * 100},${p.y * 100}`).join(' ');

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950/95 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]" role="dialog" aria-label="Recadrer la page">
      <p className="px-4 py-3 text-center text-sm text-white">Placez les 4 points sur les coins de la feuille.</p>
      <div className="flex min-h-0 flex-1 items-center justify-center px-6">
        <div className="relative max-h-full max-w-full touch-none select-none">
          <img ref={img} src={src} alt="Page à recadrer" className="block max-h-[calc(100dvh-170px)] max-w-full" draggable={false} />
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 size-full">
            <polygon points={poly} fill="rgba(37,73,235,0.18)" stroke="#60a5fa" strokeWidth={2} vectorEffect="non-scaling-stroke" />
          </svg>
          {points.map((p, i) => (
            <button
              key={i}
              type="button"
              aria-label={['Coin haut gauche', 'Coin haut droit', 'Coin bas droit', 'Coin bas gauche'][i]}
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                setActive(i);
              }}
              onPointerMove={(e) => active === i && moveTo(i, e.clientX, e.clientY)}
              onPointerUp={() => setActive(null)}
              className="absolute size-11 -translate-x-1/2 -translate-y-1/2 touch-none rounded-full"
              style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }}
            >
              <span className={`absolute inset-2.5 rounded-full border-2 border-white ${active === i ? 'bg-brand-500' : 'bg-brand-600/80'} shadow-lg`} />
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap justify-center gap-2 px-4 py-3">
        <Button variant="secondary" icon={<X className="size-4" />} onClick={onCancel}>
          Annuler
        </Button>
        <Button variant="secondary" icon={<RotateCcw className="size-4" />} onClick={() => onDone(FULL_QUAD)}>
          Photo entière
        </Button>
        <Button icon={<Check className="size-4" />} onClick={() => onDone(points)}>
          Valider
        </Button>
      </div>
    </div>
  );
}
