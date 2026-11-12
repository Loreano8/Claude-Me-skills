import { Globe } from 'lucide-react';
import { LANG, setLang, t } from '../i18n.ts';
import { cx } from './ui.tsx';

// Choix de la langue de l'interface. Les documents (CV, lettre, e-mails au recruteur) gardent leur propre langue.

const NAMES = { fr: 'Français', en: 'English' } as const;

/** Bouton compact de l'en-tête : propose l'autre langue, écrite dans cette langue (« English », « Français »). */
export function LangButton() {
  const other = LANG === 'fr' ? 'en' : 'fr';
  return (
    <button
      type="button"
      onClick={() => setLang(other)}
      lang={other}
      aria-label={other === 'en' ? 'Switch to English' : 'Passer en français'}
      title={NAMES[other]}
      className="hit flex items-center gap-1 rounded-xl px-2 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
    >
      <Globe className="size-4" aria-hidden="true" />
      {other.toUpperCase()}
    </button>
  );
}

/** Choix complet (page Plus) : les deux langues côte à côte, et ce que la langue change. */
export function LangPicker() {
  return (
    <section aria-labelledby="lang-title" className="rounded-2xl border border-slate-200 bg-white p-4">
      <h2 id="lang-title" className="flex items-center gap-2 font-semibold text-slate-900">
        <Globe className="size-5 text-brand-600" aria-hidden="true" /> {t('Langue de l’application')}
      </h2>
      <div role="radiogroup" aria-labelledby="lang-title" className="mt-3 grid grid-cols-2 gap-2">
        {(['fr', 'en'] as const).map((l) => (
          <button
            key={l}
            type="button"
            role="radio"
            aria-checked={LANG === l}
            lang={l}
            onClick={() => setLang(l)}
            className={cx('min-h-12 rounded-xl px-3 text-sm font-semibold ring-1 transition', LANG === l ? 'bg-brand-600 text-white ring-brand-600' : 'bg-white text-slate-800 ring-slate-300 hover:ring-slate-400')}
          >
            {NAMES[l]}
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-slate-500">{t('Vos CV et lettres gardent leur propre langue : vous pouvez les traduire à tout moment.')}</p>
    </section>
  );
}
