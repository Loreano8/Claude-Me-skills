import { Capacitor } from '@capacitor/core';

export type NotifState = 'granted' | 'denied' | 'prompt' | 'unsupported';

/** Les notifications sont-elles autorisées sur ce téléphone ? (« unsupported » sur le site) */
export async function notifState(): Promise<NotifState> {
  if (!Capacitor.isNativePlatform()) return 'unsupported';
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    const { display } = await LocalNotifications.checkPermissions();
    return display === 'granted' ? 'granted' : display === 'denied' ? 'denied' : 'prompt';
  } catch {
    return 'unsupported';
  }
}

/** Demande l'autorisation (appli ouverte), puis programme tout de suite les rappels. */
export async function askNotifications(): Promise<NotifState> {
  if (!Capacitor.isNativePlatform()) return 'unsupported';
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    const { display } = await LocalNotifications.requestPermissions();
    if (display === 'granted') {
      const { scheduleReturnReminder } = await import('./reminder.ts');
      const { syncFollowUpNotifications } = await import('./followUpNotify.ts');
      await scheduleReturnReminder();
      await syncFollowUpNotifications();
    }
    return display === 'granted' ? 'granted' : display === 'denied' ? 'denied' : 'prompt';
  } catch {
    return 'unsupported';
  }
}
