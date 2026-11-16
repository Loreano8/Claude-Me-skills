import { CheckCircle2, Download } from 'lucide-react';

/** « C'est prêt » : dit clairement où télécharger le résultat, avec un bouton qui y mène. */
export function DownloadHint({ title, text, action, onClick }: { title: string; text: string; action: string; onClick: () => void }) {
  return (
    <div role="status" className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-3.5 sm:items-center">
      <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-700 sm:mt-0" aria-hidden="true" />
      <div className="min-w-0 flex-1 sm:flex sm:items-center sm:gap-4">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-slate-900">{title}</p>
          <p className="text-sm text-slate-700">{text}</p>
        </div>
        <button type="button" onClick={onClick} className="mt-2.5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-700 px-4 text-sm font-semibold text-white hover:bg-emerald-800 sm:mt-0">
          <Download className="size-4" aria-hidden="true" /> {action}
        </button>
      </div>
    </div>
  );
}
