import { useRef, useState } from 'react';
import { Camera, Trash2 } from 'lucide-react';
import { preparePhoto } from '../lib/image.ts';
import { Button, Notice } from './ui.tsx';

export function PhotoInput({ value, onChange, round }: { value: string | null; onChange: (v: string | null) => void; round: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    try {
      onChange(await preparePhoto(file));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="flex items-center gap-4">
      <div
        className={`flex size-24 shrink-0 items-center justify-center overflow-hidden border-2 border-dashed border-slate-300 bg-slate-50 ${round ? 'rounded-full' : 'rounded-xl'}`}
      >
        {value ? <img src={value} alt="Photo du CV" className="size-full object-cover" /> : <Camera className="size-8 text-slate-400" />}
      </div>
      <div className="space-y-2">
        <input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" icon={<Camera className="size-4" />} onClick={() => input.current?.click()}>
            {value ? 'Changer la photo' : 'Ajouter une photo'}
          </Button>
          {value && (
            <Button variant="danger" size="sm" icon={<Trash2 className="size-4" />} onClick={() => onChange(null)}>
              Retirer
            </Button>
          )}
        </div>
        <p className="text-xs text-slate-500">Photo récente, fond neutre, de face. Elle est recadrée automatiquement.</p>
        {error && <Notice tone="error">{error}</Notice>}
      </div>
    </div>
  );
}
