import { useEffect, useState } from 'react';
import { useSharedOffer } from './lib/shareInbox.ts';
import { ClipboardList, FileDown, FileUser, FolderOpen, Mail, MessageCircle, Target } from 'lucide-react';
import { useActiveCv, useStore } from './store.ts';
import { CvSwitcher } from './components/CvSwitcher.tsx';
import { AccountButton, AccountDialogs } from './components/AccountDialogs.tsx';
import { SaveDialog } from './components/SaveDialog.tsx';
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
import { DossierPage, ScannerButton } from './pages/DossierPage.tsx';
import { DocumentsPage } from './pages/DocumentsPage.tsx';
import { PrivacyPage } from './pages/PrivacyPage.tsx';
import { refreshSupportBadge, useSupportBadge } from './lib/supportBadge.ts';

export type Tab = 'accueil' | 'infos' | 'apercu' | 'offre' | 'lettre' | 'suivi' | 'documents' | 'dossier' | 'scanner' | 'confidentialite' | 'contact' | 'admin';

const TABS: { id: Tab; label: string; short: string; icon: typeof FileUser }[] = [
  { id: 'infos', label: 'Mes infos', short: 'Infos', icon: FileUser },
  { id: 'apercu', label: 'Aperçu & export', short: 'Aperçu', icon: FileDown },
  { id: 'offre', label: 'Adapter à une offre', short: 'Offre', icon: Target },
  { id: 'lettre', label: 'Lettre de motivation', short: 'Lettre', icon: Mail },
  { id: 'suivi', label: 'Mes candidatures', short: 'Suivi', icon: ClipboardList },
  { id: 'documents', label: 'Mes documents', short: 'Docs', icon: FolderOpen },
];

// Pages hors de la barre d'onglets : accueil, dossier en un PDF, scanner, « Nous contacter » et l'espace administrateur.
const EXTRA_PAGES: Tab[] = ['accueil', 'dossier', 'scanner', 'confidentialite', 'contact', 'admin'];
const isTab = (v: string): v is Tab => EXTRA_PAGES.includes(v as Tab) || TABS.some((t) => t.id === v);

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
      <span className="text-lg font-bold tracking-tight whitespace-nowrap text-slate-900 max-[419px]:hidden">
        CV <span className="text-brand-600">Studio</span>
      </span>
    </button>
  );
}

function ContactButton({ active, onClick }: { active: boolean; onClick: () => void }) {
  const unread = useSupportBadge((s) => s.unread);
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={unread ? `Nous contacter (${unread} réponse${unread > 1 ? 's' : ''} non lue${unread > 1 ? 's' : ''})` : 'Nous contacter'}
      title="Nous contacter"
      className={cx('relative rounded-xl p-2 transition-colors', active ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100')}
    >
      <MessageCircle className="size-5" />
      {unread > 0 && (
        <span className="absolute -top-0.5 -right-0.5 flex size-4.5 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white">{unread}</span>
      )}
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
            <ScannerButton active={tab === 'scanner'} onClick={() => setTab('scanner')} />
            <ContactButton active={tab === 'contact'} onClick={() => setTab('contact')} />
            <AccountButton />
          </div>
        </div>
      </header>
      <AccountDialogs />
      <SaveDialog />

      <main className="mx-auto max-w-7xl px-4 pt-4 pb-28 lg:pb-10">
        {tab === 'accueil' && <LandingPage onNavigate={setTab} />}
        {tab === 'infos' && <InfosLayout />}
        {tab === 'apercu' && <PreviewPage />}
        {tab === 'offre' && <JobPage onNavigate={setTab} />}
        {tab === 'lettre' && <LetterPage onNavigate={setTab} />}
        {tab === 'suivi' && <ApplicationsPage onNavigate={setTab} />}
        {tab === 'documents' && <DocumentsPage onNavigate={setTab} />}
        {tab === 'dossier' && <DossierPage key="dossier" onNavigate={setTab} />}
        {tab === 'scanner' && <DossierPage key="scanner" mode="scanner" onNavigate={setTab} />}
        {tab === 'confidentialite' && <PrivacyPage />}
        {tab === 'contact' && <ContactPage />}
        {tab === 'admin' && <AdminPage />}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-6 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] lg:hidden">
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
