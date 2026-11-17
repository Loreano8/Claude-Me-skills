import { useState } from 'react';
import { Bell, BellOff, CheckCircle2 } from 'lucide-react';
import { useEffect } from '../lib/safeEffects.ts';
import { askNotifications, notifState, type NotifState } from '../lib/notifications.ts';
import { Button } from './ui.tsx';
import { t } from '../i18n.ts';

/** Réglages (appli Android) : état des notifications et bouton pour les activer. */
export function NotificationsCard() {
  const [state, setState] = useState<NotifState | null>(null);
  useEffect(() => {
    void notifState().then(setState);
  }, []);
  if (state === null || state === 'unsupported') return null;
  return (
    <section aria-labelledby="notif-title" className="rounded-2xl border border-slate-200 bg-white p-4">
      <h2 id="notif-title" className="flex items-center gap-2 font-semibold text-slate-900">
        <Bell className="size-5 text-brand-600" aria-hidden="true" /> {t('Notifications')}
      </h2>
      <p className="mt-1 text-sm text-slate-600">{t('Un rappel le jour où une candidature mérite une relance, et quand de nouvelles offres peuvent vous intéresser.')}</p>
      {state === 'granted' && (
        <p className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-emerald-800">
          <CheckCircle2 className="size-4" aria-hidden="true" /> {t('Activées sur ce téléphone.')}
        </p>
      )}
      {state === 'prompt' && (
        <Button className="mt-3" icon={<Bell className="size-4" />} onClick={() => void askNotifications().then(setState)}>
          {t('Activer les notifications')}
        </Button>
      )}
      {state === 'denied' && (
        <p className="mt-3 flex items-start gap-2 text-sm text-slate-700">
          <BellOff className="mt-0.5 size-4 shrink-0 text-slate-500" aria-hidden="true" />
          {t('Elles sont bloquées. Pour les activer : Paramètres du téléphone, Applications, CVCasa, Notifications.')}
        </p>
      )}
    </section>
  );
}

/** Juste après le premier CV (appli Android) : une ligne pour activer les rappels, si ce n'est pas déjà fait. */
export function NotificationsNudge() {
  const [state, setState] = useState<NotifState | null>(null);
  useEffect(() => {
    void notifState().then(setState);
  }, []);
  if (state !== 'prompt') return null;
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5">
      <Bell className="size-5 shrink-0 text-brand-600" aria-hidden="true" />
      <p className="min-w-0 flex-1 text-sm text-slate-700">{t('Recevoir un rappel pour relancer vos candidatures ?')}</p>
      <Button size="sm" variant="secondary" onClick={() => void askNotifications().then(setState)}>
        {t('Activer')}
      </Button>
    </div>
  );
}
