import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { t } from '../i18n.ts';
import type { LatestBundle } from '../lib/appUpdate.ts';
import { Button } from './ui.tsx';

type State = { kind: 'idle' } | { kind: 'checking' } | { kind: 'ok' } | { kind: 'available'; latest: LatestBundle } | { kind: 'installing' } | { kind: 'error' };

/**
 * Bas de la page Plus : le numéro de version et, dans l'application, un bouton pour vérifier soi-même les mises à jour.
 * Sans rien toucher, l'appli se met de toute façon à jour toute seule (src/lib/appUpdate.ts).
 */
export function AppUpdateCard() {
  const native = Capacitor.isNativePlatform();
  const [state, setState] = useState<State>({ kind: 'idle' });
  // Sur le site, rien à faire : chaque visite charge déjà la dernière version.
  if (!native) return null;

  async function check() {
    setState({ kind: 'checking' });
    try {
      const { findUpdate } = await import('../lib/appUpdate.ts');
      const latest = await findUpdate();
      setState(latest ? { kind: 'available', latest } : { kind: 'ok' });
    } catch {
      setState({ kind: 'error' });
    }
  }

  async function install(latest: LatestBundle) {
    setState({ kind: 'installing' });
    try {
      const { installUpdate } = await import('../lib/appUpdate.ts');
      await installUpdate(latest, true); // l'appli redémarre sur la nouvelle version
    } catch {
      setState({ kind: 'error' });
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4" aria-live="polite" aria-labelledby="update-title">
      <h2 id="update-title" className="flex items-center gap-2 font-semibold text-slate-900">
        <RefreshCw className="size-5 text-brand-600" aria-hidden="true" /> {t('Version et mises à jour')}
      </h2>
  <p className="mt-1 text-sm text-slate-600">{t('Version {0}', [__BUILD_ID__.slice(0, 7)])}</p>
      <p className="mt-1 text-xs text-slate-500">{t('L’appli se met à jour toute seule. Vous pouvez aussi vérifier vous-même.')}</p>
      {state.kind === 'available' ? (
        <div className="mt-3 space-y-2">
          <p className="text-sm font-semibold text-emerald-800">{t('Une nouvelle version est disponible.')}</p>
          <Button icon={<RefreshCw className="size-4" />} onClick={() => void install(state.latest)}>
            {t('Installer maintenant')}
          </Button>
          <p className="text-xs text-slate-500">{t('Sinon, elle s’installera toute seule au prochain lancement.')}</p>
        </div>
      ) : (
        <div className="mt-3">
          <Button variant="secondary" icon={<RefreshCw className="size-4" />} loading={state.kind === 'checking' || state.kind === 'installing'} onClick={() => void check()}>
            {state.kind === 'installing' ? t('Installation…') : t('Vérifier les mises à jour')}
          </Button>
          {state.kind === 'ok' && <p className="mt-2 text-sm font-semibold text-emerald-800">{t('Votre appli est à jour.')}</p>}
          {state.kind === 'error' && <p className="mt-2 text-sm text-red-700">{t('Vérification impossible pour le moment. Vérifiez votre connexion internet.')}</p>}
        </div>
      )}
    </section>
  );
}
