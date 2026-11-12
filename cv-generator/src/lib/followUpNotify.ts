import { Capacitor } from '@capacitor/core';
import { useStore } from '../store.ts';
import { FOLLOW_UP_DAYS } from './emails.ts';
import type { Application } from '../types.ts';

import { t } from '../i18n.ts';
/** Identifiant de notification stable pour une candidature (plage réservée 5000-104999). */
function notifyId(appId: string): number {
  let h = 0;
  for (const ch of appId) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return 5000 + (h % 100_000);
}

/** Jour de la relance, à 10 h : une semaine après l'envoi. */
export function followUpDate(sentAt: number): Date {
  const d = new Date(sentAt + FOLLOW_UP_DAYS * 86_400_000);
  d.setHours(10, 0, 0, 0);
  return d;
}

const pending = (a: Application) => a.status === 'envoyee' && a.sentAt && !a.followedUpAt;

/**
 * Sur Android : une notification « Pensez à relancer » le jour où la relance devient utile.
 * Recalculée à chaque changement du suivi ; rien n'est demandé tant qu'aucune candidature n'est envoyée.
 */
export async function syncFollowUpNotifications(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    const apps = useStore.getState().applications;
    const { notifications } = await LocalNotifications.getPending();
    const ours = notifications.filter((n) => n.id >= 5000 && n.id < 105_000);
    if (ours.length) await LocalNotifications.cancel({ notifications: ours.map((n) => ({ id: n.id })) });
    const due = apps.filter(pending).filter((a) => followUpDate(a.sentAt!).getTime() > Date.now());
    if (!due.length) return;
    let { display } = await LocalNotifications.checkPermissions();
    if (display === 'prompt') ({ display } = await LocalNotifications.requestPermissions());
    if (display !== 'granted') return;
    await LocalNotifications.schedule({
      notifications: due.map((a) => ({
        id: notifyId(a.id),
        title: t('Pensez à relancer'),
        body: t('{0} : sans réponse depuis une semaine. Le message de relance est prêt.', [[a.title, a.company].filter(Boolean).join(' – ')]),
        schedule: { at: followUpDate(a.sentAt!), allowWhileIdle: true },
        smallIcon: 'ic_stat_cvstudio',
        iconColor: '#2549eb',
        extra: { tab: 'suivi' },
      })),
    });
  } catch {
    // Notifications indisponibles : le rappel reste visible dans l'appli.
  }
}

/** Suit les changements du suivi des candidatures pour tenir les notifications à jour. */
export function watchFollowUps(): void {
  let last = '';
  const run = () => {
    const key = useStore
      .getState()
      .applications.filter(pending)
      .map((a) => `${a.id}:${a.sentAt}`)
      .join('|');
    if (key === last) return;
    last = key;
    void syncFollowUpNotifications();
  };
  run();
  useStore.subscribe(run);
}
