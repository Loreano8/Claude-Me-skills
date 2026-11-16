import { CURRENCIES, type Currency } from '../../shared/currency.ts';
import { t } from '../i18n.ts';
import { useMoney } from '../lib/currency.ts';
import { cx } from './ui.tsx';

const NAMES: Record<Currency, () => string> = {
  XOF: () => t('FCFA (Afrique de l’Ouest)'),
  USD: () => t('Dollar américain ($)'),
  EUR: () => t('Euro (€)'),
  GBP: () => t('Livre sterling (£)'),
  CAD: () => t('Dollar canadien'),
  CHF: () => t('Franc suisse'),
  XAF: () => t('FCFA (Afrique centrale)'),
  NGN: () => t('Naira nigérian'),
  GHS: () => t('Cedi ghanéen'),
  MAD: () => t('Dirham marocain'),
  KES: () => t('Shilling kényan'),
  ZAR: () => t('Rand sud-africain'),
};

/** Choix de la devise d'affichage des prix (devinée d'après la zone du visiteur, modifiable ici). */
export function CurrencyPicker({ className }: { className?: string }) {
  const { currency, setCurrency } = useMoney();
  return (
    <label className={cx('inline-flex items-center gap-2 text-sm text-slate-600', className)}>
      <span>{t('Devise')}</span>
      <select
        value={currency}
        onChange={(e) => setCurrency(e.target.value as Currency)}
        className="min-h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-medium text-slate-900"
      >
        {CURRENCIES.map((c) => (
          <option key={c} value={c}>
            {NAMES[c]()}
          </option>
        ))}
      </select>
    </label>
  );
}
