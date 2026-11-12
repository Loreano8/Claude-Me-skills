import { useState } from 'react';
import { Sparkles, Undo2 } from 'lucide-react';
import { BACKGROUNDS } from '../lib/background.ts';
import { Button, Cost, cx, Notice } from './ui.tsx';

/** « Fond uni » : la photo garde le visage, le fond devient une couleur unie, comme chez le photographe. */
export function ProPhoto({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [original, setOriginal] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function apply(color: string) {
    setBusy(color);
    setError(null);
    try {
      const { plainBackground } = await import('../lib/background.ts');
      const source = original ?? value;
      onChange(await plainBackground(source, color));
      setOriginal(source);
    } catch (e) {
      setError((e as Error).message || 'Le fond n’a pas pu être changé sur cet appareil.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mt-3 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
      <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
        <Sparkles className="size-4 text-brand-600" aria-hidden="true" /> Fond uni, comme chez le photographe <Cost free />
      </p>
      <p className="mt-0.5 text-xs text-slate-600">Choisissez une couleur : le fond derrière vous est remplacé, votre visage ne change pas.</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {BACKGROUNDS.map((b) => (
          <button
            key={b.id}
            type="button"
            disabled={busy !== null}
            onClick={() => void apply(b.color)}
            className={cx('flex min-h-10 items-center gap-2 rounded-full bg-white px-3 text-sm font-medium text-slate-800 ring-1 ring-slate-300 hover:ring-brand-400 disabled:opacity-60')}
          >
            <span className="size-4 rounded-full ring-1 ring-slate-300" style={{ backgroundColor: b.color }} aria-hidden="true" />
            {busy === b.color ? 'Un instant…' : b.label}
          </button>
        ))}
        {original && (
          <Button
            variant="ghost"
            size="sm"
            icon={<Undo2 className="size-4" />}
            onClick={() => {
              onChange(original);
              setOriginal(null);
            }}
          >
            Photo d’origine
          </Button>
        )}
      </div>
      {busy && <p className="mt-2 text-xs text-slate-500">La première fois, l’outil se charge (quelques secondes).</p>}
      {error && (
        <div className="mt-2">
          <Notice tone="error">{error}</Notice>
        </div>
      )}
    </div>
  );
}
