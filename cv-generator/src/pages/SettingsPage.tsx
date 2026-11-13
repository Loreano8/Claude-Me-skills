import { useState } from 'react';
import { ChevronRight, LogOut, Settings, ShieldCheck, UserRound } from 'lucide-react';
import type { Tab } from '../App.tsx';
import { t } from '../i18n.ts';
import { useAccount } from '../lib/account.ts';
import { api, ApiError } from '../lib/api.ts';
import { LangPicker } from '../components/LangSwitch.tsx';
import { AppUpdateCard } from '../components/AppUpdateCard.tsx';
import { AccountSecurity } from '../components/AccountDialogs.tsx';
import { Button, Field, Notice } from '../components/ui.tsx';

/** Le compte : identifiant, prénom, mot de passe et phrase secrète, déconnexion. */
function AccountSection() {
  const { enabled, user, token, setSession, logout, open } = useAccount();
  const [name, setName] = useState(user?.name ?? '');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  if (!enabled) return null;

  if (!user) {
    return (
      <section data-tour="settings-account" className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="flex items-center gap-2 font-semibold text-slate-900">
          <UserRound className="size-5 text-brand-600" aria-hidden="true" /> {t('Mon compte')}
        </h2>
        <p className="mt-1 text-sm text-slate-600">{t('Connectez-vous pour gérer votre prénom, votre mot de passe et vos crédits.')}</p>
        <Button className="mt-3" icon={<UserRound className="size-4" />} onClick={() => open('account')}>
          {t('Se connecter')}
        </Button>
      </section>
    );
  }

  async function saveName() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await api.setName(name);
      if (token) setSession(token, res.user);
      setMessage({ tone: 'success', text: t('Prénom enregistré.') });
    } catch (e) {
      setMessage({ tone: 'error', text: e instanceof ApiError ? e.message : t('Une erreur est survenue. Réessayez.') });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section data-tour="settings-account" className="rounded-2xl border border-slate-200 bg-white p-4">
      <h2 className="flex items-center gap-2 font-semibold text-slate-900">
        <UserRound className="size-5 text-brand-600" aria-hidden="true" /> {t('Mon compte')}
      </h2>
      <p className="mt-1 text-sm text-slate-600">{t('Connecté avec : {0}', [user.identifier])}</p>
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <Field className="min-w-0 flex-1" label={t('Prénom')} value={name} onChange={(v) => setName(v.slice(0, 60))} autoComplete="given-name" />
        <Button variant="secondary" loading={busy} disabled={!name.trim() || name.trim() === user.name} onClick={() => void saveName()}>
          {t('Enregistrer')}
        </Button>
      </div>
      {message && (
        <div className="mt-2">
          <Notice tone={message.tone}>{message.text}</Notice>
        </div>
      )}
      <AccountSecurity />
      <button type="button" onClick={() => logout()} className="mt-4 flex min-h-11 items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-slate-900">
        <LogOut className="size-4" aria-hidden="true" /> {t('Se déconnecter')}
      </button>
    </section>
  );
}

/** Réglages : compte, langue, confidentialité, et (dans l'appli) version et mises à jour. */
export function SettingsPage({ onNavigate }: { onNavigate: (t: Tab) => void }) {
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="px-1">
        <h1 className="flex items-center gap-2 font-display text-2xl font-bold text-ink sm:text-3xl">
          <Settings className="size-6 text-brand-600" aria-hidden="true" /> {t('Réglages')}
        </h1>
      </div>
      <AccountSection />
      <div data-tour="settings-lang">
        <LangPicker />
      </div>
      <button
        type="button"
        onClick={() => onNavigate('confidentialite')}
        className="flex min-h-16 w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left hover:bg-slate-50"
      >
        <ShieldCheck className="size-5 shrink-0 text-brand-600" aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className="block font-semibold text-slate-900">{t('Confidentialité')}</span>
          <span className="block text-sm text-slate-600">{t('Ce que deviennent vos données.')}</span>
        </span>
        <ChevronRight className="size-5 shrink-0 text-slate-400" aria-hidden="true" />
      </button>
      <div data-tour="settings-update">
        <AppUpdateCard />
      </div>
    </div>
  );
}
