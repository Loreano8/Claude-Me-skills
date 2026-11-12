import { Settings } from 'lucide-react';
import { t } from '../i18n.ts';
import { LangPicker } from '../components/LangSwitch.tsx';
import { AppUpdateCard } from '../components/AppUpdateCard.tsx';

/** Réglages : langue de l'appli, version et mises à jour. */
export function SettingsPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="px-1">
        <h1 className="flex items-center gap-2 font-display text-2xl font-bold text-ink sm:text-3xl">
          <Settings className="size-6 text-brand-600" aria-hidden="true" /> {t('Réglages')}
        </h1>
      </div>
      <LangPicker />
      <AppUpdateCard />
    </div>
  );
}
