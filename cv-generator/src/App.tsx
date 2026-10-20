import { useEffect, useState } from 'react';
import { FileDown, FileUser, Mail, Target } from 'lucide-react';
import { useActiveCv } from './store.ts';
import { CvSwitcher } from './components/CvSwitcher.tsx';
import { Preview } from './components/Preview.tsx';
import { cx } from './components/ui.tsx';
import { EditorPage } from './pages/EditorPage.tsx';
import { JobPage } from './pages/JobPage.tsx';
import { LetterPage } from './pages/LetterPage.tsx';
import { ExportButtons, PreviewPage } from './pages/PreviewPage.tsx';

export type Tab = 'infos' | 'apercu' | 'offre' | 'lettre';

const TABS: { id: Tab; label: string; short: string; icon: typeof FileUser }[] = [
  { id: 'infos', label: 'Mes infos', short: 'Infos', icon: FileUser },
  { id: 'apercu', label: 'Aperçu & export', short: 'Aperçu', icon: FileDown },
  { id: 'offre', label: 'Adapter à une offre', short: 'Offre', icon: Target },
  { id: 'lettre', label: 'Lettre de motivation', short: 'Lettre', icon: Mail },
];

const isTab = (v: string): v is Tab => TABS.some((t) => t.id === v);

function Logo() {
  return (
    <div className="flex items-center gap-2">
      <img src="/icons/icon.svg" alt="" className="size-8" />
      <span className="text-lg font-bold tracking-tight text-slate-900">
        CV <span className="text-brand-600">Studio</span>
      </span>
    </div>
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
  const [tab, setTabState] = useState<Tab>(() => {
    const h = window.location.hash.slice(1);
    return isTab(h) ? h : 'infos';
  });

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
          <Logo />
          <nav className="hidden gap-1 md:flex">
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
          <CvSwitcher />
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 pt-4 pb-28 md:pb-10">
        {tab === 'infos' && <InfosLayout />}
        {tab === 'apercu' && <PreviewPage />}
        {tab === 'offre' && <JobPage onNavigate={setTab} />}
        {tab === 'lettre' && <LetterPage onNavigate={setTab} />}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-4 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden">
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
