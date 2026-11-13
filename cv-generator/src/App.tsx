import { useEffect, useRef, useState } from 'react';
import { useSharedOffer } from './lib/shareInbox.ts';
import { ArrowLeft, LayoutGrid } from 'lucide-react';
import { useActiveCv, useStore } from './store.ts';
import { CvSwitcher } from './components/CvSwitcher.tsx';
import { AccountButton, AccountDialogs } from './components/AccountDialogs.tsx';
import { SaveDialog } from './components/SaveDialog.tsx';
import { ReturnBanner } from './components/ReturnBanner.tsx';
import { Tour } from './components/Tour.tsx';
import { decideBanner as decideReturnBanner } from './lib/reminder.ts';
import { refreshAccount } from './lib/api.ts';
import { useAccount } from './lib/account.ts';
import { Preview } from './components/Preview.tsx';
import { cx } from './components/ui.tsx';
import { EditorPage } from './pages/EditorPage.tsx';
import { JobPage } from './pages/JobPage.tsx';
import { LetterPage } from './pages/LetterPage.tsx';
import { ExportButtons, PreviewPage } from './pages/PreviewPage.tsx';
import { ApplicationsPage } from './pages/ApplicationsPage.tsx';
import { LandingPage } from './pages/LandingPage.tsx';
import { ContactPage } from './pages/ContactPage.tsx';
import { DossierPage } from './pages/DossierPage.tsx';
import { WatchPage } from './pages/WatchPage.tsx';
import { SettingsPage } from './pages/SettingsPage.tsx';
import { LangButton } from './components/LangSwitch.tsx';
import { MorePage } from './pages/MorePage.tsx';
import { FollowUpNudge } from './components/FollowUps.tsx';
import { isCvEmpty } from './lib/cv.ts';
import { DocumentsPage } from './pages/DocumentsPage.tsx';
import { PrivacyPage } from './pages/PrivacyPage.tsx';
import { refreshSupportBadge, useSupportBadge } from './lib/supportBadge.ts';

import { t } from './i18n.ts';
export type Tab = 'accueil' | 'infos' | 'apercu' | 'offre' | 'lettre' | 'plus' | 'suivi' | 'veille' | 'reglages' | 'documents' | 'dossier' | 'scanner' | 'confidentialite' | 'contact';

// La navigation suit le parcours : 1. le CV, 2. l'offre, 3. la lettre. Tout le reste est rangé dans « Plus ».
type Section = 'cv' | 'offre' | 'lettre' | 'plus';
const NAV: { id: Section; tab: Tab; label: string; short: string; step?: number; tabs: Tab[] }[] = [
  { id: 'cv', tab: 'infos', label: t('Mon CV'), short: t('Mon CV'), step: 1, tabs: ['infos', 'apercu'] },
  { id: 'offre', tab: 'offre', label: t('Adapter à une offre'), short: t('Offre'), step: 2, tabs: ['offre'] },
  { id: 'lettre', tab: 'lettre', label: t('Lettre de motivation'), short: t('Lettre'), step: 3, tabs: ['lettre'] },
  { id: 'plus', tab: 'plus', label: t('Scanner, documents, suivi, aide'), short: t('Plus'), tabs: ['plus', 'suivi', 'veille', 'reglages', 'documents', 'dossier', 'scanner', 'contact', 'confidentialite'] },
];
/** Pages ouvertes depuis « Plus » : elles affichent un retour vers ce menu. */
const MORE_PAGES: Tab[] = ['suivi', 'veille', 'reglages', 'documents', 'dossier', 'scanner', 'contact', 'confidentialite'];
const ALL_TABS: Tab[] = ['accueil', ...NAV.flatMap((n) => n.tabs)];

const isTab = (v: string): v is Tab => ALL_TABS.includes(v as Tab);

// Première visite (CV encore vide, pas d'onglet demandé) : on présente le produit.
function initialTab(): Tab {
  const h = window.location.hash.slice(1);
  if (isTab(h)) return h;
  if (h.startsWith('paiement-')) return 'infos';
  const { cvs } = useStore.getState();
  const untouched = cvs.length <= 1 && cvs.every((c) => !c.personal.firstName && !c.personal.lastName && c.experiences.length === 0);
  return untouched ? 'accueil' : 'infos';
}

function Logo({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="hit flex shrink-0 items-center gap-2 rounded-xl" aria-label={t('CVCasa, accueil')}>
      <img src={`${import.meta.env.BASE_URL}icons/icon.svg`} alt="" className="size-8 lg:size-10" />
      <span className="font-display text-lg font-bold tracking-tight whitespace-nowrap text-ink max-[419px]:hidden lg:text-[1.4rem]">
        CV<span className="text-brand-600">Casa</span>
      </span>
    </button>
  );
}

/** Étapes déjà faites : elles portent une coche dans la navigation. */
function useDoneSteps(): Record<Section, boolean> {
  const cv = useActiveCv();
  const job = useStore((s) => s.job);
  const letter = useStore((s) => s.letter);
  return {
    cv: !isCvEmpty(cv),
    offre: Boolean(cv.adaptation || job.text.trim() || job.file),
    lettre: Boolean(letter.body.trim()),
    plus: false,
  };
}

/** Pastille d'une entrée de navigation : numéro de l'étape, coche si elle est faite, ou icône de « Plus ». */
function StepMark({ step, active, unread, big = false }: { step?: number; active: boolean; unread: number; big?: boolean }) {
  if (!step) {
    return (
      <span className={cx('relative flex items-center justify-center', big ? 'size-7' : 'size-6')}>
        <LayoutGrid className={cx(big ? 'size-6' : 'size-5', active && 'stroke-[2.4]')} aria-hidden="true" />
        {unread > 0 && <span className="absolute -top-0.5 -right-1 size-2.5 rounded-full bg-red-600 ring-2 ring-white" />}
      </span>
    );
  }
  return (
    <span
      className={cx(
        'flex items-center justify-center rounded-full font-bold',
        big ? 'size-7 text-sm' : 'size-6 text-xs',
        // Toujours le numéro : une étape « faite » peut être reprise, une coche donnait l'impression qu'elle était fermée.
        active ? 'bg-brand-600 text-white' : 'bg-slate-200 text-slate-700',
      )}
    >
      {step}
    </span>
  );
}

type NavProps = { section: Section | undefined; done: Record<string, boolean>; unread: number; onGo: (t: Tab) => void };

/**
 * Ordinateur : le parcours 1 → 2 → 3 sous forme de rail. Une pastille de couleur glisse sous l'étape ouverte,
 * et le trait entre deux étapes se remplit quand la précédente a du contenu (sans coche : on peut toujours y revenir).
 */
function DesktopNav({ section, done, unread, onGo }: NavProps) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [pill, setPill] = useState<{ left: number; width: number } | null>(null);
  useEffect(() => {
    const place = () => {
      const el = section ? refs.current[section] : null;
      setPill(el ? { left: el.offsetLeft, width: el.offsetWidth } : null);
    };
    place();
    window.addEventListener('resize', place);
    document.fonts?.ready.then(place).catch(() => {});
    return () => window.removeEventListener('resize', place);
  }, [section]);

  return (
    <nav className="relative hidden min-w-0 items-center rounded-full bg-slate-100/80 p-1 ring-1 ring-slate-200/70 lg:flex" aria-label={t('Navigation principale')}>
      <span
        aria-hidden="true"
        className={cx(
          'absolute top-1 bottom-1 rounded-full bg-brand-600 shadow-[0_8px_20px_-8px_rgba(37,70,235,0.7)] motion-safe:transition-[left,width,opacity] motion-safe:duration-300 motion-safe:ease-[cubic-bezier(.3,1.4,.5,1)]',
          pill ? 'opacity-100' : 'opacity-0',
        )}
        style={pill ? { left: pill.left, width: pill.width } : undefined}
      />
      {NAV.map((n, i) => {
        const active = section === n.id;
        const next = NAV[i + 1];
        return (
          <div key={n.id} className="flex items-center">
            <button
              ref={(el) => {
                refs.current[n.id] = el;
              }}
              type="button"
              aria-label={navLabel(n, done[n.id])}
              aria-current={active ? 'page' : undefined}
              onClick={() => onGo(n.tab)}
              className={cx(
                'group relative z-10 flex min-h-11 items-center gap-2 rounded-full py-1.5 pr-4 pl-1.5 text-[0.95rem] font-semibold whitespace-nowrap transition-colors duration-200',
                !n.step && 'pl-3',
                active ? 'text-white' : 'text-slate-700 hover:text-ink',
              )}
            >
              {n.step ? (
                <span
                  className={cx(
                    'flex size-8 items-center justify-center rounded-full font-display text-sm font-bold transition-all duration-300 group-hover:scale-110',
                    active ? 'bg-white text-brand-700' : done[n.id] ? 'bg-brand-100 text-brand-700' : 'bg-white text-slate-600 ring-1 ring-slate-200',
                  )}
                >
                  {n.step}
                </span>
              ) : (
                <span className="relative flex size-6 items-center justify-center transition-transform duration-300 group-hover:rotate-90">
                  <LayoutGrid className={cx('size-5', active && 'stroke-[2.4]')} aria-hidden="true" />
                  {unread > 0 && <span className="absolute -top-0.5 -right-1 size-2.5 rounded-full bg-red-600 ring-2 ring-white" />}
                </span>
              )}
              {n.short}
            </button>
            {next && (
              // Trait entre deux étapes : plein quand l'étape d'avant a du contenu.
              <span aria-hidden="true" className={cx('mx-0.5 h-0.5 w-5 overflow-hidden rounded-full', next.step ? 'bg-slate-300' : 'w-px h-5 bg-slate-300')}>
                {next.step && <span className={cx('block h-full bg-brand-500 motion-safe:transition-[width] motion-safe:duration-500', done[n.id] ? 'w-full' : 'w-0')} />}
              </span>
            )}
          </div>
        );
      })}
    </nav>
  );
}

/** Téléphone : barre du bas avec une pastille colorée derrière l'icône de l'étape ouverte. */
function MobileNav({ section, done, unread, onGo }: NavProps) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-4 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden" aria-label={t('Navigation principale')}>
      {NAV.map((n) => {
        const active = section === n.id;
        return (
          <button
            key={n.id}
            type="button"
            aria-label={navLabel(n, done[n.id])}
            aria-current={active ? 'page' : undefined}
            onClick={() => onGo(n.tab)}
            className={cx('relative flex min-h-15 flex-col items-center justify-center gap-1 py-2 text-xs font-semibold transition-colors', active ? 'text-brand-800' : 'text-slate-600')}
          >
            <span aria-hidden="true" className={cx('absolute top-0 h-[3px] rounded-b-full bg-brand-600 motion-safe:transition-all motion-safe:duration-300', active ? 'w-10 opacity-100' : 'w-0 opacity-0')} />
            <span className={cx('flex h-8 w-14 items-center justify-center rounded-full motion-safe:transition-all motion-safe:duration-300', active ? 'bg-brand-100 scale-100' : 'scale-90')}>
              <StepMark step={n.step} active={active} unread={unread} />
            </span>
            {n.short}
          </button>
        );
      })}
    </nav>
  );
}

/** Dans « Mon CV » : remplir, ou voir et télécharger. */
function CvTabs({ tab, onNavigate }: { tab: Tab; onNavigate: (t: Tab) => void }) {
  return (
    <div className="mx-auto mb-4 grid max-w-md grid-cols-2 gap-1 rounded-2xl bg-white p-1 ring-1 ring-slate-200" role="tablist" aria-label={t('Mon CV')}>
      {(
        [
          ['infos', t('Remplir')],
          ['apercu', t('Modèle et téléchargement')],
        ] as const
      ).map(([id, label]) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={tab === id}
          onClick={() => onNavigate(id)}
          className={cx('min-h-11 rounded-xl px-2 text-sm font-semibold', tab === id ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-50')}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function InfosLayout() {
  const cv = useActiveCv();
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_420px] xl:grid-cols-[minmax(0,1fr)_480px]">
      <EditorPage />
      <aside data-tour="live" className="hidden space-y-3 lg:sticky lg:top-20 lg:block lg:self-start">
        <ExportButtons cv={cv} />
        <Preview source={{ kind: 'cv', cv }} />
      </aside>
    </div>
  );
}

/** Pages où le rappel « Une nouvelle offre ? » peut apparaître au retour. */
const BANNER_TABS: Tab[] = ['accueil', 'infos', 'apercu', 'lettre', 'suivi', 'documents'];

const navLabel = (n: (typeof NAV)[number], done: boolean) => `${n.step ? t('Étape {0} : ', [n.step]) : ''}${n.label}${done ? ` ${t('(fait)')}` : ''}`;

export default function App() {
  const [tab, setTabState] = useState<Tab>(initialTab);
  const done = useDoneSteps();
  const unread = useSupportBadge((s) => s.unread);
  const section = NAV.find((n) => n.tabs.includes(tab))?.id;

  useEffect(() => {
    void refreshSupportBadge();
    const timer = setInterval(() => void refreshSupportBadge(), 120_000);
    // Retour sur l'appli (autre onglet, autre appli, téléphone déverrouillé) : on revérifie tout de suite.
    const onVisible = () => document.visibilityState === 'visible' && void refreshSupportBadge();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  useEffect(() => {
    // Enregistre la visite (et décide du rappel) même si l'appli s'ouvre sur une autre page.
    decideReturnBanner();
    void refreshAccount();
    // Retour d'une page de paiement : #paiement-approved, #paiement-pending, #paiement-failed…
    const h = window.location.hash.slice(1);
    if (h.startsWith('paiement-')) {
      const messages: Record<string, string> = {
        approved: t('Paiement reçu : vos crédits ont été ajoutés. Merci !'),
        pending: t('Paiement en cours de confirmation : vos crédits seront ajoutés automatiquement dans quelques instants.'),
        failed: t('Le paiement a été annulé ou refusé. Aucun montant n’a été prélevé.'),
      };
      useAccount.getState().open('credits', messages[h.slice(9)] ?? t('Impossible de vérifier le paiement pour le moment. S’il a abouti, vos crédits seront ajoutés automatiquement.'));
      window.history.replaceState(null, '', `${window.location.pathname}#infos`);
    }
  }, []);

  useEffect(() => {
    const onHash = () => {
      const h = window.location.hash.slice(1);
      if (isTab(h)) setTabState(h);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // Offre partagée depuis une autre appli : direction la page « Offre », qui la lit.
  const sharedOffer = useSharedOffer((s) => s.pending);
  useEffect(() => {
    if (!sharedOffer) return;
    if (window.location.hash !== '#offre') window.location.hash = 'offre';
    setTabState('offre');
  }, [sharedOffer]);

  const setTab = (t: Tab) => {
    if (t !== tab) window.location.hash = t;
    setTabState(t);
    window.scrollTo({ top: 0 });
  };

  // Bouton « retour » d'Android : géré par l'appli (pages visitées), sans passer par l'historique du navigateur.
  // Revenir dans l'historique du navigateur peut tomber sur une page d'avant un rechargement (changement de langue)
  // et laisser un écran blanc.
  const visited = useRef<Tab[]>([]);
  useEffect(() => {
    const v = visited.current;
    if (v[v.length - 1] !== tab) v.push(tab);
    if (v.length > 30) v.splice(0, v.length - 30);
  }, [tab]);
  useEffect(() => {
    const onBack = (e: Event) => {
      const v = visited.current;
      v.pop(); // la page actuelle
      // Pages du menu Plus : retour au menu ; sinon, la page vue juste avant (elle sera remise dans la liste en l'ouvrant).
      const target = MORE_PAGES.includes(tab) ? 'plus' : v.pop();
      if (target && target !== tab) setTab(target);
      else (e as CustomEvent<{ exit: () => void }>).detail.exit();
    };
    window.addEventListener('cvcasa:back', onBack);
    return () => window.removeEventListener('cvcasa:back', onBack);
  });

  return (
    <div className="min-h-dvh bg-slate-50">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-3 py-2.5 sm:gap-3 sm:px-4 lg:py-3">
          <Logo onClick={() => setTab('accueil')} />
          <DesktopNav section={section} done={done} unread={unread} onGo={setTab} />
          <div className="flex min-w-0 shrink-0 items-center gap-1.5 sm:gap-2">
            <span id="tour-slot" className="contents" />
            <LangButton />
            <CvSwitcher />
            <AccountButton />
          </div>
        </div>
      </header>
      <AccountDialogs />
      <SaveDialog />

      <main className="mx-auto max-w-7xl px-4 pt-4 pb-28 lg:pb-10">
        {BANNER_TABS.includes(tab) && <ReturnBanner onAdapt={() => setTab('offre')} />}
        {['infos', 'apercu', 'offre', 'lettre', 'plus'].includes(tab) && <FollowUpNudge onNavigate={setTab} />}
        {MORE_PAGES.includes(tab) && (
          <button type="button" onClick={() => setTab('plus')} className="mb-3 inline-flex min-h-11 items-center gap-1.5 rounded-xl pr-3 text-sm font-semibold text-slate-600 hover:text-slate-900">
            <ArrowLeft className="size-4" aria-hidden="true" /> {' '}{t('Plus')}</button>
        )}
        {(tab === 'infos' || tab === 'apercu') && <CvTabs tab={tab} onNavigate={setTab} />}
        {tab === 'plus' && <MorePage onNavigate={setTab} />}
        {tab === 'accueil' && <LandingPage onNavigate={setTab} />}
        {tab === 'infos' && <InfosLayout />}
        {tab === 'apercu' && <PreviewPage />}
        {tab === 'offre' && <JobPage onNavigate={setTab} />}
        {tab === 'lettre' && <LetterPage onNavigate={setTab} />}
        {tab === 'suivi' && <ApplicationsPage onNavigate={setTab} />}
        {tab === 'veille' && <WatchPage onNavigate={setTab} />}
        {tab === 'reglages' && <SettingsPage onNavigate={setTab} />}
        {tab === 'documents' && <DocumentsPage onNavigate={setTab} />}
        {tab === 'dossier' && <DossierPage key="dossier" onNavigate={setTab} />}
        {tab === 'scanner' && <DossierPage key="scanner" mode="scanner" onNavigate={setTab} />}
        {tab === 'confidentialite' && <PrivacyPage />}
        {tab === 'contact' && <ContactPage />}
      </main>
      <Tour key={tab} tab={tab} />

      <MobileNav section={section} done={done} unread={unread} onGo={setTab} />
    </div>
  );
}
