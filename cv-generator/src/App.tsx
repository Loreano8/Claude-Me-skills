import { useEffect, useState } from 'react';
import { useSharedOffer } from './lib/shareInbox.ts';
import { ArrowLeft, Check, LayoutGrid } from 'lucide-react';
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
import { AdminPage } from './pages/AdminPage.tsx';
import { DossierPage } from './pages/DossierPage.tsx';
import { WatchPage } from './pages/WatchPage.tsx';
import { MorePage } from './pages/MorePage.tsx';
import { FollowUpNudge } from './components/FollowUps.tsx';
import { isCvEmpty } from './lib/cv.ts';
import { DocumentsPage } from './pages/DocumentsPage.tsx';
import { PrivacyPage } from './pages/PrivacyPage.tsx';
import { refreshSupportBadge, useSupportBadge } from './lib/supportBadge.ts';

export type Tab = 'accueil' | 'infos' | 'apercu' | 'offre' | 'lettre' | 'plus' | 'suivi' | 'veille' | 'documents' | 'dossier' | 'scanner' | 'confidentialite' | 'contact' | 'admin';

// La navigation suit le parcours : 1. le CV, 2. l'offre, 3. la lettre. Tout le reste est rangé dans « Plus ».
type Section = 'cv' | 'offre' | 'lettre' | 'plus';
const NAV: { id: Section; tab: Tab; label: string; short: string; step?: number; tabs: Tab[] }[] = [
  { id: 'cv', tab: 'infos', label: 'Mon CV', short: 'Mon CV', step: 1, tabs: ['infos', 'apercu'] },
  { id: 'offre', tab: 'offre', label: 'Adapter à une offre', short: 'Offre', step: 2, tabs: ['offre'] },
  { id: 'lettre', tab: 'lettre', label: 'Lettre de motivation', short: 'Lettre', step: 3, tabs: ['lettre'] },
  { id: 'plus', tab: 'plus', label: 'Scanner, documents, suivi, aide', short: 'Plus', tabs: ['plus', 'suivi', 'veille', 'documents', 'dossier', 'scanner', 'contact', 'confidentialite'] },
];
/** Pages ouvertes depuis « Plus » : elles affichent un retour vers ce menu. */
const MORE_PAGES: Tab[] = ['suivi', 'veille', 'documents', 'dossier', 'scanner', 'contact', 'confidentialite'];
const ALL_TABS: Tab[] = ['accueil', 'admin', ...NAV.flatMap((n) => n.tabs)];

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
    <button type="button" onClick={onClick} className="hit flex shrink-0 items-center gap-2 rounded-xl" aria-label="CVCasa, accueil">
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
function StepMark({ step, done, active, unread, big = false }: { step?: number; done: boolean; active: boolean; unread: number; big?: boolean }) {
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
        done ? 'bg-emerald-600 text-white' : active ? 'bg-brand-600 text-white' : 'bg-slate-200 text-slate-700',
      )}
    >
      {done ? <Check className={cx(big ? 'size-4' : 'size-3.5', 'stroke-[3]')} aria-hidden="true" /> : step}
    </span>
  );
}

/** Dans « Mon CV » : remplir, ou voir et télécharger. */
function CvTabs({ tab, onNavigate }: { tab: Tab; onNavigate: (t: Tab) => void }) {
  return (
    <div className="mx-auto mb-4 grid max-w-md grid-cols-2 gap-1 rounded-2xl bg-white p-1 ring-1 ring-slate-200" role="tablist" aria-label="Mon CV">
      {(
        [
          ['infos', 'Remplir'],
          ['apercu', 'Modèle et téléchargement'],
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

const navLabel = (n: (typeof NAV)[number], done: boolean) => `${n.step ? `Étape ${n.step} : ` : ''}${n.label}${done ? ' (fait)' : ''}`;

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
        approved: 'Paiement reçu : vos crédits ont été ajoutés. Merci !',
        pending: 'Paiement en cours de confirmation : vos crédits seront ajoutés automatiquement dans quelques instants.',
        failed: 'Le paiement a été annulé ou refusé. Aucun montant n’a été prélevé.',
      };
      useAccount.getState().open('credits', messages[h.slice(9)] ?? 'Impossible de vérifier le paiement pour le moment. S’il a abouti, vos crédits seront ajoutés automatiquement.');
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

  return (
    <div className="min-h-dvh bg-slate-50">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-3 py-2.5 sm:gap-3 sm:px-4 lg:py-3">
          <Logo onClick={() => setTab('accueil')} />
          <nav className="hidden min-w-0 gap-1.5 lg:flex" aria-label="Navigation principale">
            {NAV.map((n) => (
              <button
                key={n.id}
                type="button"
                aria-label={navLabel(n, done[n.id])}
                aria-current={section === n.id ? 'page' : undefined}
                onClick={() => setTab(n.tab)}
                className={cx(
                  'flex min-h-12 items-center gap-2.5 rounded-2xl px-4 text-base font-semibold whitespace-nowrap transition-colors',
                  section === n.id ? 'bg-brand-50 text-brand-800' : 'text-slate-700 hover:bg-slate-100',
                )}
              >
                <StepMark step={n.step} done={done[n.id]} active={section === n.id} unread={unread} big />
                {n.short}
              </button>
            ))}
          </nav>
          <div className="flex min-w-0 shrink-0 items-center gap-1.5 sm:gap-2">
            <span id="tour-slot" className="contents" />
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
            <ArrowLeft className="size-4" aria-hidden="true" /> Plus
          </button>
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
        {tab === 'documents' && <DocumentsPage onNavigate={setTab} />}
        {tab === 'dossier' && <DossierPage key="dossier" onNavigate={setTab} />}
        {tab === 'scanner' && <DossierPage key="scanner" mode="scanner" onNavigate={setTab} />}
        {tab === 'confidentialite' && <PrivacyPage />}
        {tab === 'contact' && <ContactPage />}
        {tab === 'admin' && <AdminPage />}
      </main>
      <Tour key={tab} tab={tab} />

      <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-4 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] lg:hidden" aria-label="Navigation principale">
        {NAV.map((n) => (
          <button
            key={n.id}
            type="button"
            aria-label={navLabel(n, done[n.id])}
            aria-current={section === n.id ? 'page' : undefined}
            onClick={() => setTab(n.tab)}
            className={cx('flex min-h-15 flex-col items-center justify-center gap-1 py-2 text-xs font-semibold', section === n.id ? 'text-brand-800' : 'text-slate-600')}
          >
            <StepMark step={n.step} done={done[n.id]} active={section === n.id} unread={unread} />
            {n.short}
          </button>
        ))}
      </nav>
    </div>
  );
}
