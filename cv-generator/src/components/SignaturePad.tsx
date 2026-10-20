import { useEffect, useRef, useState } from 'react';
import { Eraser, PenLine, Trash2, Upload } from 'lucide-react';
import { prepareSignatureImage, trimCanvas } from '../lib/image.ts';
import { Button, Notice } from './ui.tsx';

/** Zone de signature au doigt ou à la souris, ou import d'une signature scannée. */
export function SignaturePad({ value, onChange }: { value: string | null; onChange: (v: string | null) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const upload = useRef<HTMLInputElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [editing, setEditing] = useState(!value);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!editing) return;
    const c = canvas.current!;
    const ratio = window.devicePixelRatio || 1;
    const rect = c.getBoundingClientRect();
    c.width = rect.width * ratio;
    c.height = rect.height * ratio;
    const ctx = c.getContext('2d')!;
    ctx.scale(ratio, ratio);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#0b1f4a';
    ctx.lineWidth = 2.4;
  }, [editing]);

  function point(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function start(e: React.PointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    last.current = point(e);
  }

  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current || !last.current) return;
    const ctx = e.currentTarget.getContext('2d')!;
    const p = point(e);
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
    setDirty(true);
  }

  function end() {
    drawing.current = false;
    last.current = null;
  }

  function clear() {
    const c = canvas.current!;
    c.getContext('2d')!.clearRect(0, 0, c.width, c.height);
    setDirty(false);
  }

  function save() {
    const data = trimCanvas(canvas.current!);
    if (data) {
      onChange(data);
      setEditing(false);
      setDirty(false);
    }
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    try {
      onChange(await prepareSignatureImage(file));
      setEditing(false);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const uploadInput = (
    <input ref={upload} type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
  );

  if (!editing && value) {
    return (
      <div className="space-y-3">
        <div className="flex h-28 items-center justify-center rounded-xl border border-slate-200 bg-white">
          <img src={value} alt="Signature" className="max-h-24 max-w-[80%] object-contain" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" icon={<PenLine className="size-4" />} onClick={() => setEditing(true)}>
            Refaire la signature
          </Button>
          <Button variant="danger" size="sm" icon={<Trash2 className="size-4" />} onClick={() => onChange(null)}>
            Supprimer
          </Button>
        </div>
        {uploadInput}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <canvas
          ref={canvas}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerLeave={end}
          className="h-40 w-full touch-none rounded-xl border-2 border-dashed border-slate-300 bg-white"
        />
        {!dirty && (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-slate-400">
            Signez ici avec le doigt ou la souris
          </span>
        )}
        <div className="pointer-events-none absolute right-6 bottom-8 left-6 border-b border-slate-200" />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" icon={<PenLine className="size-4" />} onClick={save} disabled={!dirty}>
          Valider la signature
        </Button>
        <Button variant="secondary" size="sm" icon={<Eraser className="size-4" />} onClick={clear} disabled={!dirty}>
          Effacer
        </Button>
        <Button variant="ghost" size="sm" icon={<Upload className="size-4" />} onClick={() => upload.current?.click()}>
          Importer une image
        </Button>
        {value && (
          <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
            Annuler
          </Button>
        )}
      </div>
      {uploadInput}
      {error && <Notice tone="error">{error}</Notice>}
    </div>
  );
}
