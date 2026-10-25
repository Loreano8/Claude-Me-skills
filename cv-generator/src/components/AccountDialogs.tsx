import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Capacitor } from '@capacitor/core';
import { Check, LogOut, Sparkles, UserRound, X, Zap } from 'lucide-react';
import { useAccount, type Pack } from '../lib/account.ts';
import { api, refreshAccount } from '../lib/api.ts';
import { Button, cx, Field, Notice } from './ui.tsx';

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={title} className="max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl sm:max-w-md sm:rounded-3xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Fermer" className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100">
            <X className="size-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function AccountDialog() {
  const { dialogReason, close, setSession } = useAccount();
  const [mode, setMode] = useState<'register' | 'login'>('register');
  const [name, setName] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const session = mode === 'register' ? await api.register(identifier, password, name) : await api.login(identifier, password);
      setSession(session.token, session.user);
      close();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={mode === 'register' ? 'Créer mon compte' : 'Me connecter'} onClose={close}>
      {dialogReason && (
        <div className="mb-3">
          <Notice tone="info">{dialogReason}</Notice>
        </div>
      )}
      {mode === 'register' && (
        <div className="mb-4 flex items-center gap-2 rounded-xl bg-violet-50 px-3 py-2.5 text-sm text-violet-900">
          <Sparkles className="size-4 shrink-0" /> Gratuit : votre première génération par l’IA est offerte.
        </div>
      )}
      <form onSubmit={submit} className="space-y-3">
        {mode === 'register' && <Field label="Prénom" value={name} onChange={setName} autoComplete="given-name" />}
        <Field label="E-mail ou numéro de téléphone" value={identifier} onChange={setIdentifier} autoComplete="username" />
        <Field
          label="Mot de passe"
          type="password"
          value={password}
          onChange={setPassword}
          autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
          hint={mode === 'register' ? '6 caractères minimum.' : undefined}
        />
        {error && <Notice tone="error">{error}</Notice>}
        <Button type="submit" size="lg" className="w-full" loading={busy} disabled={!identifier.trim() || !password}>
          {mode === 'register' ? 'Créer mon compte' : 'Me connecter'}
        </Button>
      </form>
      <p className="mt-4 text-center text-sm text-slate-600">
        {mode === 'register' ? 'Déjà un compte ?' : 'Pas encore de compte ?'}{' '}
        <button type="button" className="font-semibold text-brand-700" onClick={() => (setMode(mode === 'register' ? 'login' : 'register'), setError(null))}>
          {mode === 'register' ? 'Se connecter' : 'Créer un compte'}
        </button>
      </p>
      <p className="mt-3 text-center text-xs text-slate-500">Vos CV restent sur votre appareil. Le compte sert uniquement à gérer vos crédits.</p>
    </Modal>
  );
}

const fcfa = (n: number) => `${n.toLocaleString('fr-FR')} FCFA`;

function CreditsDialog() {
  const { user, dialogReason, close, logout } = useAccount();
  const [packs, setPacks] = useState<Pack[] | null>(null);
  const [paymentsOn, setPaymentsOn] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .packs()
      .then((r) => {
        setPacks(r.packs);
        setPaymentsOn(r.payments);
      })
      .catch((e) => setError((e as Error).message));
  }, []);

  async function buy(pack: Pack) {
    setBusy(pack.id);
    setError(null);
    try {
      const { url } = await api.checkout(pack.id);
      if (Capacitor.isNativePlatform()) {
        const { Browser } = await import('@capacitor/browser');
        const handle = await Browser.addListener('browserFinished', () => {
          void handle.remove();
          void refreshAccount();
        });
        await Browser.open({ url });
      } else {
        window.location.href = url;
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const best = packs?.[1]?.id;

  return (
    <Modal title="Mes crédits" onClose={close}>
      {user && (
        <div className="mb-4 flex items-center gap-3 rounded-2xl bg-brand-50 p-3">
          <span className="flex size-11 items-center justify-center rounded-full bg-brand-600 text-white">
            <Zap className="size-5" />
          </span>
          <div className="flex-1">
            <p className="text-2xl font-bold text-slate-900">
              {user.credits} <span className="text-sm font-medium text-slate-600">crédit{user.credits > 1 ? 's' : ''}</span>
            </p>
            <p className="truncate text-xs text-slate-500">{user.identifier}</p>
          </div>
        </div>
      )}
      {dialogReason && (
        <div className="mb-3">
          <Notice tone="warn">{dialogReason}</Notice>
        </div>
      )}
      <p className="mb-3 text-sm text-slate-600">
        1 crédit = 1 action de l’IA : générer ou améliorer le CV, l’adapter à une offre, rédiger une lettre ou traduire. Remplir le CV et le télécharger en PDF ou Word reste gratuit.
      </p>
      <div className="space-y-2">
        {packs?.map((p) => (
          <div key={p.id} className={cx('flex items-center gap-3 rounded-2xl border-2 p-3', p.id === best ? 'border-brand-500' : 'border-slate-200')}>
            <div className="flex-1">
              <p className="font-semibold text-slate-900">
                {p.credits} crédits{' '}
                {p.id === best && <span className="ml-1 rounded-full bg-brand-100 px-2 py-0.5 text-xs font-semibold text-brand-800">Le plus choisi</span>}
              </p>
              <p className="text-sm text-slate-500">
                {p.name} · {fcfa(Math.round(p.price / p.credits))} le crédit
              </p>
            </div>
            <Button size="sm" loading={busy === p.id} disabled={!paymentsOn || busy !== null} onClick={() => buy(p)}>
              {fcfa(p.price)}
            </Button>
          </div>
        ))}
        {!packs && !error && <div className="h-40 animate-pulse rounded-2xl bg-slate-100" />}
      </div>
      <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
        <Check className="size-3.5" /> Paiement sécurisé par FedaPay : MTN MoMo ou Moov Money.
      </p>
      {!paymentsOn && (
        <div className="mt-3">
          <Notice tone="info">Le paiement en ligne sera ouvert très bientôt.</Notice>
        </div>
      )}
      {error && (
        <div className="mt-3">
          <Notice tone="error">{error}</Notice>
        </div>
      )}
      {user && (
        <button
          type="button"
          onClick={() => {
            logout();
            close();
          }}
          className="mt-5 flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800"
        >
          <LogOut className="size-4" /> Se déconnecter
        </button>
      )}
    </Modal>
  );
}

export function AccountDialogs() {
  const dialog = useAccount((s) => s.dialog);
  if (dialog === 'account') return <AccountDialog />;
  if (dialog === 'credits') return <CreditsDialog />;
  return null;
}

/** Bouton d'en-tête : solde de crédits, ou connexion. */
export function AccountButton() {
  const { enabled, user, open } = useAccount();
  if (!enabled) return null;
  if (!user) {
    return (
      <button type="button" aria-label="Se connecter" onClick={() => open('account')} className="flex items-center gap-1.5 rounded-xl bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700">
        <UserRound className="size-4" /> <span className="hidden sm:inline">Se connecter</span>
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={() => open('credits')}
      title="Mes crédits"
      className={cx('flex items-center gap-1 rounded-xl px-2.5 py-2 text-sm font-semibold', user.credits > 0 ? 'bg-brand-50 text-brand-800' : 'bg-amber-100 text-amber-900')}
    >
      <Zap className="size-4" /> {user.credits}
    </button>
  );
}
