import { FileText, UserRound } from 'lucide-react';
import { useQuickDraft } from '../lib/quickDraft.ts';
import { t } from '../i18n.ts';

/**
 * Étape 2 ou 3 ouverte alors que le CV est encore vide : on explique pourquoi, et on ramène à l'étape 1.
 * Si un document a été importé mais pas encore lu (le CV n'est rédigé qu'au clic sur « Générer mon CV »),
 * un bouton lance la rédaction tout de suite.
 */
export function NeedCv({ what }: { what: 'offre' | 'lettre' }) {
  const pending = useQuickDraft((s) => s.files.length > 0 || s.text.trim().length > 0);
  const go = (run: boolean) => {
    useQuickDraft.getState().set({ run });
    window.location.hash = 'infos';
  };
  return (
    <section role="status" className="rounded-2xl border border-amber-300 bg-amber-50 p-4">
      <h2 className="font-display text-xl font-bold text-ink">{t('Commencez par votre CV')}</h2>
      <p className="mt-1 text-[15px] text-slate-700">
        {pending
          ? t('Vous avez ajouté un document, mais votre CV n’est pas encore rédigé : CVCasa n’a rien à utiliser pour l’instant.')
          : what === 'offre'
            ? t('Pour adapter votre CV à une offre, il faut d’abord un CV : importez l’ancien ou écrivez votre parcours.')
            : t('La lettre s’appuie sur votre CV : importez l’ancien ou écrivez votre parcours d’abord.')}
      </p>
      <button
        type="button"
        onClick={() => go(pending)}
        className="mt-3 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 font-semibold text-white hover:bg-brand-700 sm:w-auto"
      >
        {pending ? <FileText className="size-4" aria-hidden="true" /> : <UserRound className="size-4" aria-hidden="true" />}
        {pending ? t('Rédiger mon CV maintenant') : t('Aller à « Mon CV »')}
      </button>
    </section>
  );
}
