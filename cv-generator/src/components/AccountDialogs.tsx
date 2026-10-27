import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Capacitor } from '@capacitor/core';
import { Check, Copy, Gift, LogOut, Share2, ShieldCheck, Sparkles, UserRound, X, Zap } from 'lucide-react';
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

/**
 * Mot de passe oublié, sans e-mail : la personne répond à quelques questions (prénom, phrase secrète, dernier achat).
 * Les réponses sont vérifiées automatiquement sur le serveur ; l'administrateur valide et la réponse arrive dans « Nous contacter ».
 */
function RecoveryForm({ initial, onBack }: { initial: string; onBack: () => void }) {
  const { close } = useAccount();
  const [identifier, setIdentifier] = useState(initial);
  const [name, setName] = useState('');
  const [phrase, setPhrase] = useState('');
  const [lastPurchase, setLastPurchase] = useState('unknown');
  const [credits, setCredits] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Si le compte a une question secrète, on l'affiche à la place de « phrase secrète ».
  const [question, setQuestion] = useState<string | null>(null);
  useEffect(() => {
    const id = identifier.trim();
    if (id.length < 6) return setQuestion(null);
    const timer = setTimeout(() => void api.recoveryQuestion(id).then((r) => setQuestion(r.question), () => setQuestion(null)), 600);
    return () => clearTimeout(timer);
  }, [identifier]);

  async function send() {
    setBusy(true);
    setError(null);
    try {
      await api.recoveryRequest({ identifier, name, phrase, lastPurchase, credits: credits.trim() ? Number(credits) : null, note });
      setDone(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="space-y-3">
        <Notice tone="success">
          Votre demande est bien prise en compte. Nous vérifions vos réponses et vous envoyons un mot de passe provisoire dans « Nous contacter », en général dans la journée.
        </Notice>
        <Button
          className="w-full"
          onClick={() => {
            close();
            window.location.hash = 'contact';
          }}
        >
          Voir ma demande
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">Répondez à ces questions : elles nous permettent de vérifier que le compte est bien le vôtre.</p>
      <Field label="E-mail ou téléphone du compte" value={identifier} onChange={setIdentifier} autoComplete="username" />
      <Field label="Prénom indiqué sur le compte" value={name} onChange={setName} autoComplete="given-name" />
      <Field
        label={question ? `Votre question secrète : ${question}` : 'Votre phrase secrète'}
        value={phrase}
        onChange={setPhrase}
        hint={question ? 'Majuscules et accents ne comptent pas.' : 'Si vous en avez défini une dans « Mes crédits ». Majuscules et accents ne comptent pas.'}
      />
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-slate-700">Votre dernier achat de crédits</span>
        <select value={lastPurchase} onChange={(e) => setLastPurchase(e.target.value)} className="w-full rounded-xl bg-white px-3 py-2.5 text-sm ring-1 ring-slate-300">
          <option value="unknown">Je ne sais plus</option>
          <option value="none">Je n’ai jamais acheté</option>
          <option value="500">500 FCFA</option>
          <option value="1500">1 500 FCFA</option>
          <option value="3000">3 000 FCFA</option>
        </select>
      </label>
      <Field label="Crédits qu’il vous restait (environ, facultatif)" type="number" value={credits} onChange={setCredits} />
      <Field label="Autre précision (facultatif)" value={note} onChange={setNote} />
      {error && <Notice tone="error">{error}</Notice>}
      <Button className="w-full" loading={busy} disabled={busy || identifier.trim().length < 3} onClick={() => void send()}>
        Envoyer ma demande
      </Button>
      <button type="button" className="w-full text-center text-sm font-semibold text-brand-700" onClick={onBack}>
        Retour à la connexion
      </button>
    </div>
  );
}

/** Mot de passe oublié : code reçu à l'e-mail du compte, puis nouveau mot de passe. */
function ForgotPassword({ initial, emailOn, onBack }: { initial: string; emailOn: boolean; onBack: () => void }) {
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

  const [form, setForm] = useState(!emailOn);
  if (form) return <RecoveryForm initial={identifier} onBack={onBack} />;

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
      <button type="button" className="w-full text-center text-sm text-slate-600" onClick={() => setForm(true)}>
        Plus accès à cet e-mail, ou compte avec un numéro de téléphone ? <span className="font-semibold text-brand-700">Faire une demande</span>
      </button>
      <button type="button" className="w-full text-center text-sm font-semibold text-brand-700" onClick={onBack}>
        Retour à la connexion
      </button>
    </div>
  );
}

const QUESTIONS = [
  'Quel est le prénom de votre grand-mère ?',
  'Quel était le nom de votre premier animal ?',
  'Dans quelle ville est né votre père ?',
  'Quel est le nom de votre école primaire ?',
  'Quel était votre plat préféré quand vous étiez enfant ?',
  'Quel est le surnom que vous donnait votre famille ?',
];

/** « Mes crédits » : phrase ou question secrète (récupération du compte) et changement de mot de passe. */
function AccountSecurity({ onboarding = false, onSaved }: { onboarding?: boolean; onSaved?: () => void } = {}) {
  const [secretSet, setSecretSet] = useState<boolean | null>(null);
  const [savedQuestion, setSavedQuestion] = useState<string | null>(null);
  const [kind, setKind] = useState<'phrase' | 'question'>('phrase');
  const [choice, setChoice] = useState(QUESTIONS[0]);
  const [custom, setCustom] = useState('');
  const [open, setOpen] = useState<'phrase' | 'password' | null>(onboarding ? 'phrase' : null);
  const [phrase, setPhrase] = useState('');
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    api.secretStatus().then(
      (r) => {
        setSecretSet(r.set);
        setSavedQuestion(r.question);
      },
      () => setSecretSet(null),
    );
  }, []);

  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true);
    setMessage(null);
    try {
      await action();
      if (onSaved) return onSaved();
      setMessage({ tone: 'success', text: success });
      setOpen(null);
      setPhrase('');
      setCurrent('');
      setNext('');
    } catch (e) {
      setMessage({ tone: 'error', text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={onboarding ? '' : 'mt-5 rounded-2xl border border-slate-200 p-4'}>
      {!onboarding && (
        <p className="flex items-center gap-2 font-semibold text-slate-900">
          <ShieldCheck className="size-5 text-emerald-600" /> Sécurité du compte
        </p>
      )}
      {secretSet === false && !onboarding && (
        <p className="mt-1 text-sm text-amber-800">
          Définissez une phrase ou une question secrète : elle vous permettra de récupérer votre compte si vous oubliez votre mot de passe.
        </p>
      )}
      {secretSet && (
        <p className="mt-1 text-sm text-emerald-800">
          {savedQuestion ? `Question secrète définie : « ${savedQuestion} ».` : 'Phrase secrète définie.'} Gardez la réponse en mémoire, ne la donnez à personne.
        </p>
      )}
      <div className={cx('mt-3 flex flex-wrap gap-2', onboarding && 'hidden')}>
        <Button size="sm" variant={secretSet ? 'secondary' : 'primary'} onClick={() => setOpen(open === 'phrase' ? null : 'phrase')}>
          {secretSet ? 'Changer ma phrase ou question secrète' : 'Définir ma phrase ou question secrète'}
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setOpen(open === 'password' ? null : 'password')}>
          Changer mon mot de passe
        </Button>
      </div>
      {open === 'phrase' && (
        <div className="mt-3 space-y-2">
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
            {(
              [
                ['phrase', 'Phrase secrète'],
                ['question', 'Question secrète'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setKind(id)}
                className={cx('rounded-lg py-1.5 text-sm font-medium', kind === id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600')}
              >
                {label}
              </button>
            ))}
          </div>
          {kind === 'question' && (
            <>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">Question</span>
                <select value={choice} onChange={(e) => setChoice(e.target.value)} className="w-full rounded-xl bg-white px-3 py-2.5 text-sm ring-1 ring-slate-300">
                  {QUESTIONS.map((q) => (
                    <option key={q} value={q}>
                      {q}
                    </option>
                  ))}
                  <option value="">Écrire ma propre question…</option>
                </select>
              </label>
              {choice === '' && <Field label="Ma question" value={custom} onChange={setCustom} hint="Une question dont vous seul connaissez la réponse." />}
            </>
          )}
          <Field
            label={kind === 'question' ? 'Réponse' : 'Phrase secrète'}
            value={phrase}
            onChange={setPhrase}
            hint={
              kind === 'question'
                ? 'Majuscules et accents ne comptent pas.'
                : 'Un mot ou quelques mots faciles à retenir pour vous, difficiles à deviner pour les autres. Plus c’est long, plus c’est sûr.'
            }
          />
          <Button
            size="sm"
            loading={busy}
            disabled={busy || phrase.trim().length < 2 || (kind === 'question' && !(choice || custom.trim()))}
            onClick={() => {
              const q = kind === 'question' ? choice || custom.trim() : null;
              void run(
                () =>
                  api.setSecret(phrase, q).then(() => {
                    setSecretSet(true);
                    setSavedQuestion(q);
                  }),
                q ? 'Question secrète enregistrée.' : 'Phrase secrète enregistrée.',
              );
            }}
          >
            Enregistrer
          </Button>
        </div>
      )}
      {open === 'password' && (
        <div className="mt-3 space-y-2">
          <Field label="Mot de passe actuel (ou provisoire)" type="password" value={current} onChange={setCurrent} autoComplete="current-password" />
          <Field label="Nouveau mot de passe" type="password" value={next} onChange={setNext} autoComplete="new-password" hint="6 caractères minimum." />
          <Button size="sm" loading={busy} disabled={busy || !current || next.length < 6} onClick={() => void run(() => api.changePassword(current, next), 'Mot de passe changé.')}>
            Changer
          </Button>
        </div>
      )}
      {message && (
        <div className="mt-3">
          <Notice tone={message.tone}>{message.text}</Notice>
        </div>
      )}
    </div>
  );
}

function AccountDialog() {
  const { dialogReason, close, setSession } = useAccount();
  const [mode, setMode] = useState<'register' | 'login' | 'forgot' | 'secure'>('register');
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
      setSession(session.token, session.user);
      if (mode === 'register') {
        clearReferral();
        // Étape suivante : phrase ou question secrète, pour pouvoir récupérer le compte un jour.
        setMode('secure');
        return;
      }
      close();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (mode === 'secure') {
    return (
      <Modal title="Sécurisez votre compte" onClose={close}>
        <div className="mb-3">
          <Notice tone="success">Compte créé ! Dernière étape, 10 secondes :</Notice>
        </div>
        <p className="mb-3 text-sm text-slate-600">
          Choisissez une phrase ou une question secrète. Si un jour vous oubliez votre mot de passe, elle nous permettra de vérifier que le compte est bien le vôtre.
        </p>
        <AccountSecurity onboarding onSaved={close} />
        <button type="button" onClick={close} className="mt-4 w-full text-center text-sm text-slate-500">
          Plus tard (dans « Mes crédits »)
        </button>
      </Modal>
    );
  }

  if (mode === 'forgot') {
    return (
      <Modal title="Mot de passe oublié" onClose={close}>
        <ForgotPassword initial={identifier} emailOn={emailOn} onBack={() => setMode('login')} />
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
        {mode === 'login' && (
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

/** « jeudi 30 octobre à 14 h » */
export function offerEnd(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })} à ${d.getHours()} h`;
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
  const offer = useAccount((s) => s.offer?.active ?? null);
  const offerOpen = offer && new Date(offer.expiresAt).getTime() > Date.now() ? offer : null;

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
        1 crédit = 1 action de l’IA (générer ou corriger le CV, l’adapter à une offre, lettre, fiche entretien, traduction). 2 crédits = 1 CV en version Pro, acquise pour toujours sur ce CV (sans mention « Créé avec CV Studio », 13 modèles, export Word). Scanner : 1 crédit le PDF au-delà de 2 pages, 1 crédit par page manuscrite tapée. Remplir le CV et le télécharger en PDF reste gratuit.
      </p>
      <div className="space-y-2">
        {offerOpen && (
          <div className="flex items-center gap-3 rounded-2xl border-2 border-amber-400 bg-amber-50 p-3">
            <div className="flex-1">
              <p className="font-semibold text-slate-900">
                {offerOpen.pack.credits} crédits <span className="ml-1 rounded-full bg-amber-200 px-2 py-0.5 text-xs font-semibold text-amber-900">Offre de retour</span>
              </p>
              <p className="text-sm text-slate-600">1 crédit offert en plus, jusqu’au {offerEnd(offerOpen.expiresAt)}. Une seule fois.</p>
            </div>
            <Button size="sm" loading={busy === offerOpen.pack.id} disabled={!paymentsOn || busy !== null} onClick={() => buy(offerOpen.pack)}>
              {fcfa(offerOpen.pack.price)}
            </Button>
          </div>
        )}
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
      {user && <AccountSecurity />}
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
