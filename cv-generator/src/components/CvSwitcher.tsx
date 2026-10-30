import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Copy, FilePlus2, PencilLine, Trash2 } from 'lucide-react';
import { useStore } from '../store.ts';
import { cx } from './ui.tsx';

/** Choix du CV en cours (CV principal, versions adaptées à des offres…). */
export function CvSwitcher() {
  const cvs = useStore((s) => s.cvs);
  const activeId = useStore((s) => s.activeId);
  const { setActive, newCv, duplicateCv, deleteCv, renameCv } = useStore.getState();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const active = cvs.find((c) => c.id === activeId) ?? cvs[0];

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const item = 'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-100';

  return (
    <div ref={box} className="relative min-w-0">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="hit flex max-w-[42vw] items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 sm:max-w-xs"
      >
        <span className="truncate">{active.label}</span>
        <ChevronDown className="size-4 shrink-0 text-slate-400" />
      </button>
      {/* Téléphone : menu calé sur la largeur de l'écran (il débordait à gauche) ; ordinateur : sous le bouton. */}
      {open && (
        <div className="fixed inset-x-3 top-[calc(env(safe-area-inset-top)+3.75rem)] z-30 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl sm:absolute sm:inset-x-auto sm:top-auto sm:right-0 sm:mt-2 sm:w-72">
          <p className="px-3 pt-1 pb-1.5 text-xs font-semibold tracking-wide text-slate-500 uppercase">Mes CV</p>
          <div className="max-h-64 overflow-y-auto">
            {cvs.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  setActive(c.id);
                  setOpen(false);
                }}
                className={cx(item, c.id === activeId && 'bg-brand-50 font-semibold text-brand-800')}
              >
                <span className="truncate">{c.label}</span>
              </button>
            ))}
          </div>
          <div className="mt-1 border-t border-slate-100 pt-1">
            <button type="button" className={item} onClick={() => (newCv(), setOpen(false))}>
              <FilePlus2 className="size-4" /> Nouveau CV vierge
            </button>
            <button type="button" className={item} onClick={() => (duplicateCv(active.id), setOpen(false))}>
              <Copy className="size-4" /> Dupliquer ce CV
            </button>
            <button
              type="button"
              className={item}
              onClick={() => {
                const label = window.prompt('Nom de ce CV', active.label);
                if (label?.trim()) renameCv(active.id, label.trim());
                setOpen(false);
              }}
            >
              <PencilLine className="size-4" /> Renommer
            </button>
            <button
              type="button"
              className={cx(item, 'text-red-600 hover:bg-red-50')}
              onClick={() => {
                if (window.confirm(`Supprimer « ${active.label} » ? Cette action est définitive.`)) deleteCv(active.id);
                setOpen(false);
              }}
            >
              <Trash2 className="size-4" /> Supprimer ce CV
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
