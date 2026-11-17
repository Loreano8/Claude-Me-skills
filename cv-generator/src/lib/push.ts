import { Capacitor } from '@capacitor/core';
import { api } from './api.ts';
import { t } from '../i18n.ts';

// Notifications envoyées par le serveur (nouvelles offres de la veille emploi), via Firebase.
// Prudence : une ancienne appli (sans le module) reçoit aussi ce code par la mise à jour automatique.
// On vérifie donc que le module existe vraiment dans l'appli avant de l'appeler.

let listening = false;

/** Inscrit ce téléphone (appli Android, notifications autorisées, compte connecté). Sans effet ailleurs. */
export async function registerPush(): Promise<void> {
  if (!Capacitor.isNativePlatform() || !Capacitor.isPluginAvailable('PushNotifications')) return;
  try {
    const { useAccount } = await import('./account.ts');
    if (!useAccount.getState().token) return;
    const { PushNotifications } = await import('@capacitor/push-notifications');
    const { receive } = await PushNotifications.checkPermissions();
    if (receive !== 'granted') return;
    if (!listening) {
      listening = true;
      await PushNotifications.createChannel({ id: 'offres', name: t('Nouvelles offres d’emploi'), description: t('Les offres trouvées par votre veille emploi'), importance: 4 }).catch(() => {});
      await PushNotifications.addListener('registration', (tk) => void api.pushRegister(tk.value).catch(() => {}));
      await PushNotifications.addListener('registrationError', (e) => console.warn('Notifications : inscription impossible', e));
      // Toucher la notification ouvre la page indiquée (les offres de la veille).
      await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
        const tab = (action.notification.data as { tab?: string } | undefined)?.tab;
        if (tab) window.location.hash = tab;
      });
    }
    await PushNotifications.register();
  } catch (e) {
    console.warn('Notifications : module indisponible', e);
  }
}
