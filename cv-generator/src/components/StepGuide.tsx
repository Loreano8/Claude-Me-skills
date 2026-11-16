import { useState, type ReactNode } from 'react';
import { ArrowRight } from 'lucide-react';
import { t } from '../i18n.ts';

const key = (id: string) => `cvcasa-guide-${id}`;
function uses(id: string): number {
  try {
    return Number(localStorage.getItem(key(id))) || 0;
  } catch {
    return 0;
  }
}

/**
 * « Et maintenant ? » : dit en une phrase par étape ce qu'il faut faire ensuite, avec un gros bouton.
 * Il s'affiche les premières fois ; une fois le bouton utilisé `max` fois, la personne se débrouille seule
 * (sauf si `force` : juste après une action importante, comme un import).
 */
export function StepGuide({ id, title, steps, action, onAction, extra, force = false, max = 3 }: {
  id: string;
  title: string;
  steps: string[];
  action: string;
  onAction: () => void;
  extra?: ReactNode;
  force?: boolean;
  max?: number;
}) {
  const [used, setUsed] = useState(() => uses(id));
  if (used >= max && !force) return null;
  const go = () => {
    const n = used + 1;
    setUsed(n);
    try {
      localStorage.setItem(key(id), String(n));
    } catch {
      /* stockage indisponible : le guide restera affiché */
    }
    onAction();
  };
  return (
    <section aria-label={t('Et maintenant ?')} className="rounded-2xl border border-brand-200 bg-brand-50 p-4">
      <p className="text-xs font-semibold tracking-wide text-brand-700 uppercase">{t('Et maintenant ?')}</p>
      <h2 className="mt-0.5 font-display text-xl font-bold text-ink">{title}</h2>
      <ol className="mt-2 space-y-1.5">
        {steps.map((s, i) => (
          <li key={i} className="flex gap-2.5 text-[15px] text-slate-700">
            <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-brand-600 text-xs font-bold text-white">{i + 1}</span>
            <span>{s}</span>
          </li>
        ))}
      </ol>
      {extra}
      <button type="button" onClick={go} className="mt-3 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 font-semibold text-white hover:bg-brand-700 sm:w-auto">
        {action} <ArrowRight className="size-4" aria-hidden="true" />
      </button>
    </section>
  );
}
