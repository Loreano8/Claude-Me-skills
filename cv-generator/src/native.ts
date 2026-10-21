import { Capacitor } from '@capacitor/core';

/** Réglages propres à l'application Android. */
export async function setupNative(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  const { App } = await import('@capacitor/app');
  // Bouton « retour » d'Android : revient à l'onglet précédent, ou quitte l'application.
  // Retour dans l'application (par exemple après un paiement) : on met à jour le solde de crédits.
  const { refreshAccount } = await import('./lib/api.ts');
  await App.addListener('resume', () => void refreshAccount());
  await App.addListener('backButton', ({ canGoBack }) => {
    if (canGoBack) window.history.back();
    else void App.exitApp();
  });
}
