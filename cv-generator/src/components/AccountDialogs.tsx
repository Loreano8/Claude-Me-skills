import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Capacitor } from '@capacitor/core';
import { Check, Copy, Gift, LogOut, Share2, Sparkles, UserRound, X, Zap } from 'lucide-react';
import { useAccount, type Pack } from '../lib/account.ts';
import { api, refreshAccount } from '../lib/api.ts';
import { clearReferral, pendingReferral, referralLink } from '../lib/referral.ts';
import { Button, cx, Field, Notice } from './ui.tsx';

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
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

/** Mot de passe oublié : code reçu à l'e-mail du compte, puis nouveau mot de passe. */
function ForgotPassword({ initial, onBack }: { initial: string; onBack: () => void }) {
  const { close, setSession } = useAccount();
  const [identifier, setIdentifier] = useState(initial);
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    setBusy(true);
    setError(null);
    try {
      await api.forgotPassword(identifier);
      setSent(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    setBusy(true);
    setError(null);
    try {
      const session = await api.resetPassword(identifier, code, password);
      setSession(session.token, session.user);
      close();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      {!sent ? (
        <>
          <p className="text-sm text-slate-600">Indiquez l’e-mail de votre compte : nous vous envoyons un code pour choisir un nouveau mot de passe.</p>
          <Field label="E-mail du compte" value={identifier} onChange={setIdentifier} autoComplete="username" />
          <Button className="w-full" loading={busy} disabled={busy || !identifier.includes('@')} onClick={() => void send()}>
            M’envoyer un code
          </Button>
        </>
      ) : (
        <>
          <Notice tone="info">Si un compte existe avec cette adresse, un code vient d’y être envoyé (pensez aux spams).</Notice>
          <Field label="Code reçu (6 chiffres)" value={code} onChange={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))} />
          <Field label="Nouveau mot de passe" type="password" value={password} onChange={setPassword} autoComplete="new-password" hint="6 caractères minimum." />
          <Button className="w-full" loading={busy} disabled={busy || code.length !== 6 || password.length < 6} onClick={() => void reset()}>
            Changer mon mot de passe
          </Button>
        </>
      )}
      {error && <Notice tone="error">{error}</Notice>}
      <button type="button" className="w-full text-center text-sm font-semibold text-brand-700" onClick={onBack}>
        Retour à la connexion
      </button>
    </div>
  );
}

function AccountDialog() {
  const { dialogReason, close, setSession } = useAccount();
  const [mode, setMode] = useState<'register' | 'login' | 'forgot'>('register');
  const [emailOn, setEmailOn] = useState(false);
  useEffect(() => {
    void api.health().then((h) => setEmailOn(!!h.email), () => {});
  }, []);
  const [name, setName] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const invitedBy = pendingReferral();

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const session = mode === 'register' ? await api.register(identifier, password, name, invitedBy) : await api.login(identifier, password);
      if (mode === 'register') clearReferral();
      setSession(session.token, session.user);
      close();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (mode === 'forgot') {
    return (
      <Modal title="Mot de passe oublié" onClose={close}>
        <ForgotPassword initial={identifier} onBack={() => setMode('login')} />
      </Modal>
    );
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
      {mode === 'register' && invitedBy && (
        <div className="mb-4 flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2.5 text-sm text-emerald-900">
          <Gift className="size-4 shrink-0" /> Invité par un ami : 1 crédit en plus à votre premier achat.
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
        {mode === 'login' && emailOn && (
          <button type="button" className="text-sm font-medium text-brand-700" onClick={() => (setMode('forgot'), setError(null))}>
            Mot de passe oublié ?
          </button>
        )}
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

/** « Invite tes amis » : lien personnel, partage WhatsApp, et résultats. */
function ReferralCard() {
  const [info, setInfo] = useState<{ code: string; invited: number; rewarded: number; bonus: number } | null>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    api.referral().then(setInfo, () => setInfo(null));
  }, []);
  if (!info) return null;
  const link = referralLink(info.code);
  const message = `J’ai fait mon CV avec CV Studio : il s’adapte à chaque offre d’emploi. Essaie gratuitement : ${link}`;

  async function share() {
    if (Capacitor.isNativePlatform()) {
      const { Share } = await import('@capacitor/share');
      await Share.share({ title: 'CV Studio', text: message });
    } else if (navigator.share) {
      await navigator.share({ title: 'CV Studio', text: message }).catch(() => {});
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
    }
  }

  return (
    <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
      <p className="flex items-center gap-2 font-semibold text-emerald-900">
        <Gift className="size-5" /> Invite tes amis, gagne des crédits
      </p>
      <p className="mt-1 text-sm text-emerald-900">
        Quand un ami inscrit avec ton lien achète son premier pack, vous recevez chacun {info.bonus} crédit offert.
      </p>
      <div className="mt-3 flex items-center gap-2 rounded-xl bg-white px-3 py-2 ring-1 ring-emerald-200">
        <span className="min-w-0 flex-1 truncate text-sm text-slate-700">{link}</span>
        <button
          type="button"
          aria-label="Copier le lien"
          className="shrink-0 rounded-lg p-1.5 text-emerald-700 hover:bg-emerald-50"
          onClick={() => {
            void navigator.clipboard?.writeText(link).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            });
          }}
        >
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
        </button>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button size="sm" icon={<Share2 className="size-4" />} onClick={() => void share()}>
          Partager (WhatsApp…)
        </Button>
        <span className="text-xs text-emerald-900">
          Code <strong className="tracking-wider">{info.code}</strong> · {info.invited} ami{info.invited > 1 ? 's' : ''} inscrit{info.invited > 1 ? 's' : ''} ·{' '}
          {info.rewarded} récompense{info.rewarded > 1 ? 's' : ''}
        </span>
      </div>
    </div>
  );
}

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
        1 crédit = 1 action de l’IA (générer ou corriger le CV, l’adapter à une offre, lettre, fiche entretien, traduction). 2 crédits = 1 CV en version Pro, acquise pour toujours sur ce CV (sans mention « Créé avec CV Studio », 13 modèles, export Word). Scanner : 1 crédit le PDF au-delà de 3 pages, 1 crédit par page manuscrite tapée. Remplir le CV et le télécharger en PDF reste gratuit.
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
      {user && <ReferralCard />}
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
