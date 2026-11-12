import { Component, type ReactNode } from 'react';
import { t } from '../i18n.ts';

/**
 * Filet de sécurité : si une page plante, on affiche un message et un bouton pour recharger, au lieu d'un écran blanc.
 * Le détail technique reste visible (petit) pour pouvoir nous l'envoyer. Les CV restent enregistrés sur l'appareil.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error('Écran en erreur', error);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-6 text-center">
        <h1 className="font-display text-2xl font-bold text-ink">{t('Un souci est survenu')}</h1>
        <p className="text-slate-600">{t('Vos CV et lettres sont bien enregistrés sur cet appareil. Rechargez pour reprendre là où vous en étiez.')}</p>
        <button
          type="button"
          onClick={() => {
            window.location.hash = 'accueil';
            window.location.reload();
          }}
          className="mx-auto min-h-12 rounded-xl bg-brand-600 px-6 font-semibold text-white hover:bg-brand-700"
        >
          {t('Recharger')}
        </button>
        <p className="text-xs break-words text-slate-400">{String(error.message).slice(0, 200)}</p>
      </div>
    );
  }
}
