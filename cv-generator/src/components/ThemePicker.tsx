import { Moon, Smartphone, Sun } from 'lucide-react';
import { useTheme, type ThemePref } from '../lib/theme.ts';
import { t } from '../i18n.ts';
import { cx } from './ui.tsx';

/** Réglages > Apparence : automatique (suit le téléphone), clair ou sombre. */
export function ThemePicker() {
  const { pref, setPref } = useTheme();
  const options: { id: ThemePref; label: string; icon: typeof Sun }[] = [
    { id: 'auto', label: t('Automatique'), icon: Smartphone },
    { id: 'light', label: t('Clair'), icon: Sun },
    { id: 'dark', label: t('Sombre'), icon: Moon },
  ];
  return (
    <section aria-labelledby="theme-title" className="rounded-2xl border border-slate-200 bg-white p-4">
      <h2 id="theme-title" className="flex items-center gap-2 font-semibold text-slate-900">
        <Moon className="size-5 text-brand-600" aria-hidden="true" /> {t('Apparence')}
      </h2>
      <div role="radiogroup" aria-labelledby="theme-title" className="mt-3 grid grid-cols-3 gap-2">
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={pref === o.id}
            onClick={() => setPref(o.id)}
            className={cx(
              'flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-2 text-sm font-semibold ring-1 transition',
              pref === o.id ? 'bg-brand-600 text-white ring-brand-600' : 'bg-white text-slate-800 ring-slate-300 hover:ring-slate-400',
            )}
          >
            <o.icon className="size-4" aria-hidden="true" />
            {o.label}
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-slate-500">{t('Automatique : l’appli suit le réglage de votre téléphone (clair le jour, sombre le soir, si vous l’avez réglé ainsi).')}</p>
    </section>
  );
}
