import { StrictMode, useState } from 'react';
import { useEffect } from '../lib/safeEffects.ts';
import { createRoot } from 'react-dom/client';
import { PORTFOLIO_THEMES, type PortfolioTheme, type PublicPortfolio } from '../../shared/portfolio.ts';
import { PortfolioView } from './PortfolioView.tsx';
import { SAMPLE_DESIGNER, SAMPLE_NURSE } from './samples.ts';

// Page publique d'un portfolio : cvcasa.com/p/#lien. Exemples : #exemple (infirmière) et #exemple-designer.
// « ?theme=… » montre un exemple dans un autre design (aperçus de l'accueil).

const API = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '';

function demo(slug: string, theme: string | null): PublicPortfolio | null {
  const t = (PORTFOLIO_THEMES as readonly string[]).includes(theme ?? '') ? (theme as PortfolioTheme) : null;
  if (slug === 'exemple') return { theme: t ?? 'classique', pro: false, data: SAMPLE_NURSE };
  if (slug === 'exemple-designer') return { theme: t ?? 'creatif', pro: false, data: SAMPLE_DESIGNER };
  return null;
}

function Page() {
  const [state, setState] = useState<{ kind: 'wait' } | { kind: 'ok'; p: PublicPortfolio } | { kind: 'ko' }>({ kind: 'wait' });
  useEffect(() => {
    const slug = decodeURIComponent(location.hash.slice(1)).toLowerCase();
    const sample = demo(slug, new URLSearchParams(location.search).get('theme'));
    if (sample) return setState({ kind: 'ok', p: sample });
    if (!/^[a-z0-9-]{3,40}$/.test(slug)) return setState({ kind: 'ko' });
    fetch(`${API}/api/portfolio/public/${slug}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((p: PublicPortfolio) => setState({ kind: 'ok', p }))
      .catch(() => setState({ kind: 'ko' }));
  }, []);
  useEffect(() => {
    if (state.kind !== 'ok') return;
    const d = state.p.data;
    document.title = [d.name, d.title].filter(Boolean).join(' · ');
    document.documentElement.lang = d.lang;
    if (state.p.theme === 'creatif') document.body.style.background = '#0b0e17';
  }, [state]);

  if (state.kind === 'wait') return null;
  if (state.kind === 'ko')
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, fontFamily: 'system-ui, sans-serif', textAlign: 'center', color: '#334155' }}>
        <div>
          <h1 style={{ color: '#101a4a', fontSize: 24, margin: '0 0 8px' }}>Portfolio introuvable</h1>
          <p style={{ margin: '0 0 16px' }}>Ce lien n’existe pas ou n’est plus publié.</p>
          <a href="/?src=portfolio" style={{ color: '#2549eb', fontWeight: 700 }}>CVCasa : créez le vôtre</a>
        </div>
      </div>
    );
  return <PortfolioView data={state.p.data} theme={state.p.theme} pro={state.p.pro} />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Page />
  </StrictMode>,
);
