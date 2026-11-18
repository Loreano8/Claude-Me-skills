import { lazy, Suspense, useState } from 'react';
import { ArrowRight, ExternalLink, Globe, Lock, Sparkles } from 'lucide-react';
import { ANIMATED_THEMES, FREE_PORTFOLIO_THEME, type PortfolioTheme } from '../../shared/portfolio.ts';
import { SAMPLE_DESIGNER, SAMPLE_NURSE } from '../portfolio/samples.ts';
import { Button, cx } from './ui.tsx';
import { LANG, t } from '../i18n.ts';
import { Capacitor } from '@capacitor/core';
import { PUBLIC_SITE } from '../lib/referral.ts';

// Chargé à part : la page d'accueil reste légère, l'aperçu arrive quand on y descend.
const PortfolioView = lazy(() => import('../portfolio/PortfolioView.tsx').then((m) => ({ default: m.PortfolioView })));

const NAMES: Record<PortfolioTheme, string> = {
  pastel: t('Pastel'),
  soleil: t('Soleil'),
  onde: t('Onde'),
  defile: t('Défilé'), classique: t('Classique'), epure: t('Épuré'), creatif: t('Créatif'), colonne: t('Colonne'), bento: 'Bento', magazine: t('Magazine'), aurore: t('Aurore') };
/** Sur l'accueil : quelques designs simples (dont des clairs et gais), puis les animés. */
const SHOWN: PortfolioTheme[] = ['classique', 'pastel', 'bento', 'magazine', ...ANIMATED_THEMES];
const SITE = Capacitor.isNativePlatform() ? PUBLIC_SITE : '';

/** Accueil : « Votre portfolio en ligne », avec les 4 vrais designs remplis d'un exemple (aucune vraie personne). */
export function PortfolioShowcase({ onStart }: { onStart: () => void }) {
  const [theme, setTheme] = useState<PortfolioTheme>(LANG === 'en' ? 'soleil' : 'pastel');
  // Exemples : une infirmière en français, un designer avec ses projets en anglais.
  const sample = LANG === 'en' ? SAMPLE_DESIGNER : SAMPLE_NURSE;
  const exampleSlug = LANG === 'en' ? 'exemple-designer' : 'exemple';
  return (
    <section className="bg-white px-4 py-14" aria-labelledby="portfolio-titre">
      <div className="mx-auto grid max-w-6xl items-center gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="text-center lg:text-left">
          <p className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-800 ring-1 ring-brand-100">
            <Globe className="size-3.5" aria-hidden="true" /> {t('Nouveau')}
          </p>
          <h2 id="portfolio-titre" className="mt-3 font-display text-[1.75rem] leading-tight font-bold tracking-tight text-ink sm:text-4xl">
            {t('Votre portfolio en ligne, à partir de votre CV')}
          </h2>
          <p className="mt-3 text-base text-slate-600">
            {t('Une page web à votre nom, que les recruteurs ouvrent d’un clic : parcours, diplômes, réalisations chiffrées et vos projets en images. Infirmiers, designers, ingénieurs, commerciaux : tout le monde y gagne.')}
          </p>
          <ul className="mt-4 space-y-1.5 text-left text-sm text-slate-700 sm:mx-auto sm:max-w-md lg:mx-0">
            {[t('Déjà rempli : rien à retaper'), t('Un lien et un QR code à mettre partout'), t('Le design Classique est offert')].map((x) => (
              <li key={x} className="flex items-center gap-2">
                <span className="size-1.5 shrink-0 rounded-full bg-brand-600" aria-hidden="true" /> {x}
              </li>
            ))}
          </ul>
          <div className="mt-6 flex flex-col items-stretch gap-2.5 sm:flex-row sm:justify-center lg:justify-start">
            <Button size="lg" icon={<ArrowRight className="size-5" />} onClick={onStart}>
              {t('Créer mon portfolio')}
            </Button>
            <a
              href={`${SITE}/p/#${exampleSlug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50"
            >
              <ExternalLink className="size-4" aria-hidden="true" /> {t('Voir un exemple en grand')}
            </a>
          </div>
        </div>

        <div>
          <div className="mb-3 flex flex-wrap items-center justify-center gap-1.5" role="tablist" aria-label={t('Designs du portfolio')}>
            {SHOWN.map((th) => (
              <span key={th} className="contents">
              {th === ANIMATED_THEMES[0] && (
                <span className="ml-1 inline-flex items-center gap-1 text-xs font-semibold text-sun-800" aria-hidden="true">
                  <Sparkles className="size-3.5" /> {t('Animés')}
                </span>
              )}
              <button
                key={th}
                type="button"
                role="tab"
                aria-selected={theme === th}
                onClick={() => setTheme(th)}
                className={cx(
                  'inline-flex min-h-10 items-center gap-1 rounded-full px-3.5 text-sm font-semibold transition-colors',
                  theme === th ? 'bg-ink text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200',
                )}
              >
                {NAMES[th]}
                {th !== FREE_PORTFOLIO_THEME && <Lock className="size-3 opacity-60" aria-label="Pro" />}
              </button>
              </span>
            ))}
          </div>
          {/* Fenêtre de navigateur : l'aperçu est la vraie page, coupée en bas. */}
          <div className="overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-slate-200">
            <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2" aria-hidden="true">
              <span className="flex gap-1">
                <span className="size-2.5 rounded-full bg-slate-300" />
                <span className="size-2.5 rounded-full bg-slate-300" />
                <span className="size-2.5 rounded-full bg-slate-300" />
              </span>
              <span className="min-w-0 flex-1 truncate rounded-md bg-white px-2 py-0.5 text-center text-xs text-slate-500 ring-1 ring-slate-200">cvcasa.com/p/#{LANG === 'en' ? 'first-last' : 'prenom-nom'}</span>
            </div>
            <div className="pointer-events-none relative h-[440px] overflow-hidden sm:h-[520px]" inert>
              <Suspense fallback={<div className="h-full animate-pulse bg-slate-100" />}>
                <PortfolioView data={sample} theme={theme} pro={theme !== FREE_PORTFOLIO_THEME} home="#" />
              </Suspense>
              <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-white to-transparent" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
