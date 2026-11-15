import { useState } from 'react';
import { ChevronDown, History } from 'lucide-react';
import { api, type CreditMove } from '../lib/api.ts';
import { LOCALE, t } from '../i18n.ts';
import { cx, Notice } from './ui.tsx';

/** Ce que veut dire chaque mouvement, en clair. */
function label(m: CreditMove): string {
  const reason = m.reason.startsWith('refund:') ? 'refund' : m.reason;
  switch (reason) {
    case 'welcome':
      return t('Crédit de bienvenue');
    case 'purchase':
      return m.provider === 'crypto' ? t('Achat de crédits (crypto)') : t('Achat de crédits (Mobile Money)');
    case 'purchase-reversed':
      return t('Achat remboursé');
    case 'referral':
      return t('Bonus de parrainage : un ami a acheté');
    case 'referral-welcome':
      return t('Bonus de parrainage');
    case 'admin':
      return m.delta >= 0 ? t('Crédits offerts par l’équipe') : t('Crédits retirés par l’équipe');
    case 'refund':
      return t('Crédit rendu : l’action n’a pas abouti');
    case 'structure':
      return t('CV généré ou complété');
    case 'revise':
      return t('CV corrigé');
    case 'adapt':
      return t('CV adapté à une offre');
    case 'cover-letter':
      return t('Lettre de motivation');
    case 'interview':
      return t('Fiche entretien');
    case 'translate':
      return t('Traduction du CV');
    case 'translate-letter':
      return t('Traduction de la lettre');
    case 'unlock':
      return t('Version Pro d’un CV');
    case 'dossier':
      return t('Dossier ou scan PDF');
    case 'transcribe':
      return t('Page manuscrite tapée au propre');
    case 'veille':
      return t('Veille emploi');
    case 'style':
      return t('Profil d’écriture');
    default:
      return t('Autre mouvement');
  }
}

const when = (iso: string) => new Date(iso).toLocaleString(LOCALE, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/** « Mes crédits » : l'historique complet (achats, crédits offerts, actions), avec le solde après chaque ligne. */
export function CreditHistory() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<CreditMove[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next) {
      setError(null);
      api.creditHistory().then(
        (r) => setItems(r.items),
        (e) => setError((e as Error).message),
      );
    }
  };

  return (
    <section className="mt-3 rounded-2xl border border-slate-200">
      <button type="button" onClick={toggle} aria-expanded={open} className="flex min-h-12 w-full items-center gap-2 px-3 text-left text-sm font-semibold text-slate-800">
        <History className="size-4 text-brand-600" aria-hidden="true" />
        <span className="flex-1">{t('Historique de mes crédits')}</span>
        <ChevronDown className={cx('size-4 text-slate-500 transition', open && 'rotate-180')} aria-hidden="true" />
      </button>
      {open && (
        <div className="border-t border-slate-100 p-3">
          {error && <Notice tone="error">{error}</Notice>}
          {!items && !error && <div className="h-24 animate-pulse rounded-xl bg-slate-100" />}
          {items && items.length === 0 && <p className="text-sm text-slate-500">{t('Aucun mouvement pour l’instant.')}</p>}
          {items && items.length > 0 && (
            <ul className="max-h-80 divide-y divide-slate-100 overflow-y-auto" tabIndex={0} aria-label={t('Historique de mes crédits')}>
              {items.map((m) => (
                <li key={m.id} className="flex items-center gap-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-900">
                      {label(m)}
                      {m.reason === 'purchase' && m.amount && m.provider !== 'crypto' ? <span className="font-normal text-slate-500">{` · ${m.amount.toLocaleString(LOCALE)} FCFA`}</span> : null}
                    </p>
                    <p className="text-xs text-slate-500">{when(m.at)}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className={cx('text-sm font-bold tabular-nums', m.delta >= 0 ? 'text-emerald-700' : 'text-slate-900')}>
                      {m.delta > 0 ? '+' : ''}
                      {m.delta}
                    </p>
                    <p className="text-xs text-slate-500">{t('Solde : {0}', [m.balance])}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {items && items.length >= 100 && <p className="mt-2 text-xs text-slate-500">{t('Les 100 derniers mouvements sont affichés.')}</p>}
        </div>
      )}
    </section>
  );
}
