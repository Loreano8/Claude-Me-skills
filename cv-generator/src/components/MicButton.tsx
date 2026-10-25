import { Mic, Square } from 'lucide-react';
import type { Lang } from '../../shared/schema.ts';
import { useDictation } from '../lib/dictation.ts';
import { cx } from './ui.tsx';

/** Ajoute le texte dicté à la fin d'un texte existant. */
export function appendSpoken(current: string, spoken: string): string {
  if (!spoken) return current;
  const base = current.replace(/\s+$/, '');
  const newSentence = !base || /[.!?]$/.test(base);
  const text = newSentence ? spoken.charAt(0).toUpperCase() + spoken.slice(1) : spoken;
  return base ? `${base} ${text}` : text;
}

/**
 * Gros bouton micro : la personne parle, le texte s'ajoute au champ au fur et à mesure.
 * Sans dictée disponible (vieux navigateur), on explique comment utiliser le micro du clavier.
 */
export function MicButton({ onText, lang = 'fr', label = 'Parler', hint }: { onText: (text: string) => void; lang?: Lang; label?: string; hint?: string }) {
  const { supported, listening, interim, error, start, stop } = useDictation(onText, lang);

  if (!supported) {
    return <p className="text-xs text-slate-500">Pour parler au lieu d’écrire, touchez l’icône micro de votre clavier.</p>;
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={listening ? stop : start}
          aria-pressed={listening}
          className={cx(
            'relative inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold shadow-sm transition',
            listening ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-white text-violet-700 ring-1 ring-violet-200 hover:bg-violet-50',
          )}
        >
          {listening && <span className="absolute inset-0 animate-ping rounded-full bg-red-400 opacity-30 motion-reduce:hidden" />}
          {listening ? <Square className="relative size-4 fill-current" /> : <Mic className="relative size-5" />}
          <span className="relative">{listening ? 'Arrêter' : label}</span>
        </button>
        <span className="text-xs text-slate-500">{listening ? 'Je vous écoute… parlez naturellement, vous pouvez faire des pauses.' : hint}</span>
      </div>
      {interim && <p className="rounded-lg bg-white/70 px-3 py-2 text-sm text-slate-400 italic ring-1 ring-slate-100">{interim}…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
