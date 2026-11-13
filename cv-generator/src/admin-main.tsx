import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import './index.css';
import { AdminPage } from './pages/AdminPage.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';

// Espace administrateur : page à part (cvcasa.com/admin/), absente du site public et de l'appli.
// L'accès à la page est filtré par Cloudflare Access ; chaque action reste vérifiée par le serveur (jeton secret).
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <main className="mx-auto min-h-dvh max-w-7xl bg-slate-50 px-4 py-6">
        <AdminPage />
      </main>
    </ErrorBoundary>
  </StrictMode>,
);
