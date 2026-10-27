import { Target, X } from 'lucide-react';
import { REMINDER_TEXT, REMINDER_TITLE, useReturnReminder } from '../lib/reminder.ts';

/** Au retour dans l'appli : propose d'adapter le CV à une nouvelle offre. */
export function ReturnBanner({ onAdapt }: { onAdapt: () => void }) {
  const { show, dismiss } = useReturnReminder();
  if (!show) return null;
  return (
    <div className="mb-4 flex items-start gap-3 rounded-2xl border border-brand-200 bg-brand-50 p-3.5 sm:items-center">
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white text-brand-700">
        <Target className="size-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1 sm:flex sm:items-center sm:gap-4">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-slate-900">{REMINDER_TITLE}</p>
          <p className="text-sm text-slate-600">{REMINDER_TEXT}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            dismiss();
            onAdapt();
          }}
          className="mt-2.5 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 sm:mt-0"
        >
          Adapter mon CV
        </button>
      </div>
      <button type="button" onClick={dismiss} aria-label="Plus tard" className="rounded-lg p-1 text-slate-500 hover:bg-white">
        <X className="size-4" />
      </button>
    </div>
  );
}
