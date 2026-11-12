import { Capacitor } from '@capacitor/core';

/** Réglages propres à l'application Android. */
export async function setupNative(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  // Mises à jour sans nouvelle APK (et retour automatique à la version précédente si celle-ci ne démarre pas).
  const { setupAppUpdates } = await import('./lib/appUpdate.ts');
  void setupAppUpdates();
  const { App } = await import('@capacitor/app');
  // Bouton « retour » d'Android : revient à l'onglet précédent, ou quitte l'application.
  // Retour dans l'application (par exemple après un paiement) : on met à jour le solde de crédits.
  const { refreshAccount } = await import('./lib/api.ts');
  await App.addListener('resume', () => void refreshAccount());
  // Rappel « Une nouvelle offre ? » : reprogrammé à chaque sortie de l'appli, à partir de ce moment-là.
  const { scheduleReturnReminder, listenReminderTap } = await import('./lib/reminder.ts');
  await listenReminderTap();
  void scheduleReturnReminder();
  await App.addListener('pause', () => void scheduleReturnReminder());
  // Relances : une notification le jour où une candidature envoyée mérite d'être relancée.
  const { watchFollowUps } = await import('./lib/followUpNotify.ts');
  watchFollowUps();
  // L'appli décide (page précédente, menu Plus) ; quand il n'y a plus rien derrière, on sort.
  await App.addListener('backButton', () => {
    window.dispatchEvent(new CustomEvent('cvcasa:back', { detail: { exit: () => void App.exitApp() } }));
  });
}
