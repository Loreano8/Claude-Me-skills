import { useState } from 'react';
import { CloudOff, MonitorSmartphone, RefreshCw } from 'lucide-react';
import { useAccount } from '../lib/account.ts';
import { startSync, stopSync, syncNow, useSync } from '../lib/sync.ts';
import { Button, Toggle } from './ui.tsx';
import { LOCALE, t } from '../i18n.ts';

const when = (ms: number) => new Date(ms).toLocaleString(LOCALE, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/** Réglages : « Retrouver mon travail sur tous mes appareils », avec ce que ça veut dire, en clair. */
export function SyncCard() {
  const token = useAccount((s) => s.token);
  const { enabled, lastSync, status } = useSync();
  const [confirm, setConfirm] = useState(false);
  return (
    <section aria-labelledby="sync-title" className="rounded-2xl border border-slate-200 bg-white p-4">
      <h2 id="sync-title" className="flex items-center gap-2 font-semibold text-slate-900">
        <MonitorSmartphone className="size-5 text-brand-600" aria-hidden="true" /> {t('Mon travail sur tous mes appareils')}
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        {t('Vos CV, lettres, l’offre en cours et le suivi de vos candidatures sont gardés sur votre compte : vous les retrouvez sur votre téléphone et sur cvcasa.com. Les papiers du coffre-fort restent seulement sur ce téléphone.')}
      </p>
      {!token ? (
        <p className="mt-3 text-sm font-medium text-slate-700">{t('Connectez-vous à votre compte pour retrouver votre travail sur tous vos appareils.')}</p>
      ) : (
        <div className="mt-2">
          <Toggle
            label={enabled ? t('Activé') : t('Désactivé : votre travail reste seulement sur cet appareil')}
            checked={enabled}
            onChange={(v) => (v ? startSync() : setConfirm(true))}
          />
          {enabled && (
            <p className="flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
              {status === 'syncing' ? t('Synchronisation…') : status === 'error' ? t('Pas de connexion : ce sera fait au prochain passage en ligne.') : lastSync ? t('Dernière synchronisation : {0}', [when(lastSync)]) : ''}
              <button type="button" className="hit inline-flex items-center gap-1 font-semibold text-brand-700" onClick={() => void syncNow()}>
                <RefreshCw className="size-3.5" aria-hidden="true" /> {t('Synchroniser maintenant')}
              </button>
            </p>
          )}
          {confirm && (
            <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-slate-800">
              <p className="font-semibold text-ink">{t('Arrêter la synchronisation ?')}</p>
              <p className="mt-1">{t('La copie gardée sur votre compte sera effacée. Votre travail restera sur cet appareil, mais vous ne le verrez plus sur vos autres appareils.')}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button
                  variant="danger"
                  size="sm"
                  icon={<CloudOff className="size-4" />}
                  onClick={() => {
                    void stopSync();
                    setConfirm(false);
                  }}
                >
                  {t('Oui, arrêter')}
                </Button>
                <Button variant="secondary" size="sm" onClick={() => setConfirm(false)}>
                  {t('Garder')}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

/** Message affiché une fois, à la première synchronisation : la personne sait ce qui se passe et peut dire non. */
export function SyncAnnouncement({ onSettings }: { onSettings: () => void }) {
  const token = useAccount((s) => s.token);
  const { enabled, announced, lastSync } = useSync();
  if (!token || !enabled || announced || !lastSync) return null;
  const done = () => useSync.getState().set({ announced: true });
  return (
    <section role="status" className="mb-4 rounded-2xl border border-brand-200 bg-brand-50 p-4">
      <p className="flex items-center gap-2 font-semibold text-ink">
        <MonitorSmartphone className="size-5 text-brand-600" aria-hidden="true" /> {t('Votre travail vous suit sur tous vos appareils')}
      </p>
      <p className="mt-1 text-sm text-slate-700">
        {t('Vos CV, lettres et candidatures sont maintenant gardés sur votre compte : connectez-vous sur votre téléphone ou sur cvcasa.com, vous retrouvez tout. Vous pouvez l’arrêter quand vous voulez dans Réglages.')}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" onClick={done}>
          {t('D’accord')}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            done();
            onSettings();
          }}
        >
          {t('Voir le réglage')}
        </Button>
      </div>
    </section>
  );
}
