import { useEffect, useState } from 'react';
import { ClipboardList, FileDown, FileUser, Mail, Target } from 'lucide-react';
import { useActiveCv, useStore } from './store.ts';
import { CvSwitcher } from './components/CvSwitcher.tsx';
import { AccountButton, AccountDialogs } from './components/AccountDialogs.tsx';
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

export type Tab = 'accueil' | 'infos' | 'apercu' | 'offre' | 'lettre' | 'suivi';

const TABS: { id: Tab; label: string; short: string; icon: typeof FileUser }[] = [
  { id: 'infos', label: 'Mes infos', short: 'Infos', icon: FileUser },
  { id: 'apercu', label: 'Aperçu & export', short: 'Aperçu', icon: FileDown },
  { id: 'offre', label: 'Adapter à une offre', short: 'Offre', icon: Target },
  { id: 'lettre', label: 'Lettre de motivation', short: 'Lettre', icon: Mail },
  { id: 'suivi', label: 'Mes candidatures', short: 'Suivi', icon: ClipboardList },
];

const isTab = (v: string): v is Tab => v === 'accueil' || TABS.some((t) => t.id === v);

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
    <button type="button" onClick={onClick} className="flex items-center gap-2" aria-label="CV Studio, accueil">
      <img src={`${import.meta.env.BASE_URL}icons/icon.svg`} alt="" className="size-8" />
      <span className="text-lg font-bold tracking-tight text-slate-900">
        CV <span className="text-brand-600">Studio</span>
      </span>
    </button>
  );
}

function InfosLayout() {
  const cv = useActiveCv();
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_420px] xl:grid-cols-[minmax(0,1fr)_480px]">
      <EditorPage />
      <aside className="hidden space-y-3 lg:sticky lg:top-20 lg:block lg:self-start">
        <ExportButtons cv={cv} />
        <Preview source={{ kind: 'cv', cv }} />
      </aside>
    </div>
  );
}

export default function App() {
  const [tab, setTabState] = useState<Tab>(initialTab);

  useEffect(() => {
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

  const setTab = (t: Tab) => {
    if (t !== tab) window.location.hash = t;
    setTabState(t);
    window.scrollTo({ top: 0 });
  };

  return (
    <div className="min-h-dvh bg-slate-100/70">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2.5">
          <Logo onClick={() => setTab('accueil')} />
          <nav className="hidden gap-1 lg:flex">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={cx(
                  'flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors',
                  tab === t.id ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100',
                )}
              >
                <t.icon className="size-4" /> {t.label}
              </button>
            ))}
          </nav>
          <div className="flex min-w-0 items-center gap-2">
            <CvSwitcher />
            <AccountButton />
          </div>
        </div>
      </header>
      <AccountDialogs />

      <main className="mx-auto max-w-7xl px-4 pt-4 pb-28 lg:pb-10">
        {tab === 'accueil' && <LandingPage onNavigate={setTab} />}
        {tab === 'infos' && <InfosLayout />}
        {tab === 'apercu' && <PreviewPage />}
        {tab === 'offre' && <JobPage onNavigate={setTab} />}
        {tab === 'lettre' && <LetterPage onNavigate={setTab} />}
        {tab === 'suivi' && <ApplicationsPage onNavigate={setTab} />}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] lg:hidden">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cx('flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium', tab === t.id ? 'text-brand-700' : 'text-slate-500')}
          >
            <t.icon className={cx('size-5', tab === t.id && 'stroke-[2.4]')} />
            {t.short}
          </button>
        ))}
      </nav>
    </div>
  );
}
