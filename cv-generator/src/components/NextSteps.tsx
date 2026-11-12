import { useState } from 'react';
import { ArrowRight, X } from 'lucide-react';
import type { Tab } from '../App.tsx';

// « Et ensuite ? » : à la fin d'une étape, deux ou trois idées pour continuer. Rien d'obligatoire :
// la personne peut ignorer, ou masquer le bloc (retenu sur cet appareil).

export type NextStep = { icon: typeof ArrowRight; label: string; text: string; tab: Tab };

const KEY = 'cvcasa-next-hidden';

function hidden(): string[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as string[];
  } catch {
    return [];
  }
}

export function NextSteps({ id, steps, onNavigate }: { id: string; steps: NextStep[]; onNavigate?: (t: Tab) => void }) {
  const [gone, setGone] = useState(() => hidden().includes(id));
  if (gone || !steps.length) return null;

  const go = (t: Tab) => (onNavigate ? onNavigate(t) : (window.location.hash = t));
  const hide = () => {
    setGone(true);
    try {
      localStorage.setItem(KEY, JSON.stringify([...new Set([...hidden(), id])]));
    } catch {
      /* stockage indisponible : masqué pour cette visite seulement */
    }
  };

  return (
    <section aria-label="Et ensuite ?" className="rounded-2xl bg-brand-50/70 p-3 ring-1 ring-brand-100 sm:p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-slate-900">
          Et ensuite ? <span className="font-normal text-slate-500">Si vous voulez :</span>
        </p>
        <button type="button" onClick={hide} aria-label="Masquer ces suggestions" className="flex size-11 items-center justify-center rounded-full text-slate-400 hover:bg-white hover:text-slate-700">
          <X className="size-4" />
        </button>
      </div>
      <ul className="grid gap-2 sm:grid-cols-3">
        {steps.map((s) => (
          <li key={s.label}>
            <button
              type="button"
              onClick={() => go(s.tab)}
              className="flex h-full min-h-14 w-full items-start gap-2.5 rounded-xl bg-white p-3 text-left ring-1 ring-slate-200 transition hover:ring-brand-300"
            >
              <s.icon className="mt-0.5 size-4.5 shrink-0 text-brand-600" aria-hidden="true" />
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-slate-900">{s.label}</span>
                <span className="block text-xs text-slate-600">{s.text}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
