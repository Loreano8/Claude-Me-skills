import { useState } from 'react';
import { Check, RotateCcw } from 'lucide-react';
import { coverage } from '../lib/keywords.ts';
import { choose, listChanges } from '../lib/review.ts';
import { useStore } from '../store.ts';
import type { Keyword } from '../../shared/schema.ts';
import type { CvDocument } from '../types.ts';
import { Card, cx } from './ui.tsx';

import { t } from '../i18n.ts';
/**
 * Après l'adaptation : chaque partie modifiée s'affiche avant / après, et la personne garde ou annule chaque changement.
 * Le nombre de mots-clés de l'offre présents dans le CV suit ses choix en direct.
 */
export function ChangeReview({ base, adapted, keywords }: { base: CvDocument; adapted: CvDocument; keywords: Keyword[] | null }) {
  const current = useStore((s) => s.cvs.find((c) => c.id === adapted.id));
  const updateCv = useStore((s) => s.updateCv);
  const activeId = useStore((s) => s.activeId);
  const [kept, setKept] = useState<Record<string, boolean>>({});
  const changes = listChanges(base, adapted);
  if (!current || activeId !== adapted.id || changes.length === 0) return null;

  const set = (key: string, keep: boolean) => {
    setKept((k) => ({ ...k, [key]: keep }));
    updateCv((cv) => choose(cv, base, adapted, key, keep));
  };
  const before = keywords?.length ? coverage(base, keywords) : null;
  const now = keywords?.length ? coverage(current, keywords) : null;

  return (
    <Card title={t('Vérifiez les modifications')} subtitle={t('Gardez ce qui vous ressemble, annulez le reste. Votre CV d’origine ne change pas.')}>
      {before && now && keywords && (
        <p className="mb-4 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700" aria-live="polite">
          {t('Mots-clés de l’offre dans votre CV :')}{' '}<strong>{before.present.length}</strong> avant, <strong className="text-emerald-800">{now.present.length}</strong> maintenant, sur{' '}
          {keywords.length}.
        </p>
      )}
      <ul className="space-y-3">
        {changes.map((c) => {
          const keep = kept[c.key] ?? true;
          return (
            <li key={c.key} className="rounded-xl border border-slate-200 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold text-slate-900">{c.label}</p>
                <div className="flex gap-1 rounded-xl bg-slate-100 p-1" role="group" aria-label={`Changement : ${c.label}`}>
                  <button
                    type="button"
                    aria-pressed={keep}
                    onClick={() => set(c.key, true)}
                    className={cx('flex min-h-9 items-center gap-1 rounded-lg px-3 text-sm font-semibold', keep ? 'bg-white text-emerald-800 shadow-sm' : 'text-slate-600')}
                  >
                    <Check className="size-4" aria-hidden="true" /> {' '}{t('Garder')}</button>
                  <button
                    type="button"
                    aria-pressed={!keep}
                    onClick={() => set(c.key, false)}
                    className={cx('flex min-h-9 items-center gap-1 rounded-lg px-3 text-sm font-semibold', !keep ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600')}
                  >
                    <RotateCcw className="size-4" aria-hidden="true" /> {' '}{t('Original')}</button>
                </div>
              </div>
              <div className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
                <div className={cx('rounded-lg p-2', keep ? 'bg-slate-50 text-slate-500' : 'bg-white text-slate-800 ring-1 ring-slate-300')}>
                  <p className="mb-1 text-xs font-semibold text-slate-500">{t('Avant')}</p>
                  {c.before.filter(Boolean).map((l, i) => (
                    <p key={i}>{l}</p>
                  ))}
                </div>
                <div className={cx('rounded-lg p-2', keep ? 'bg-emerald-50 text-slate-900 ring-1 ring-emerald-200' : 'bg-slate-50 text-slate-500')}>
                  <p className="mb-1 text-xs font-semibold text-emerald-800">{t('Adapté')}</p>
                  {c.after.filter(Boolean).map((l, i) => (
                    <p key={i}>{l}</p>
                  ))}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
