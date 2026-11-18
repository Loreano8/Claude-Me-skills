import type { ReactNode } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { t } from '../i18n.ts';

/** « Masquer l'aperçu » : un seul réglage, retenu sur l'appareil, pour tous les aperçus (CV, lettre, portfolio). */
export const usePreviewHidden = create<{ hidden: boolean; toggle: () => void }>()(
  persist((set) => ({ hidden: false, toggle: () => set((s) => ({ hidden: !s.hidden })) }), { name: 'cvcasa-apercu-masque' }),
);

export function HideablePreview({ label, children }: { label?: string; children: ReactNode }) {
  const { hidden, toggle } = usePreviewHidden();
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="flex min-w-0 items-center gap-1.5 truncate text-sm font-semibold text-slate-600">
          <Eye className="size-4 shrink-0" aria-hidden="true" /> {label ?? t('Aperçu')}
        </p>
        <button
          type="button"
          onClick={toggle}
          aria-expanded={!hidden}
          className="hit inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-semibold text-brand-700 hover:bg-brand-50"
        >
          {hidden ? <Eye className="size-4" aria-hidden="true" /> : <EyeOff className="size-4" aria-hidden="true" />}
          {hidden ? t('Afficher l’aperçu') : t('Masquer l’aperçu')}
        </button>
      </div>
      {!hidden && children}
    </div>
  );
}
