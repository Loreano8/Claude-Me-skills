import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Capacitor } from '@capacitor/core';
import { Check, Copy, Gift, Settings, Share2, ShieldCheck, UserRound, X, Zap } from 'lucide-react';
import { useAccount, type Pack } from '../lib/account.ts';
import { api, refreshAccount } from '../lib/api.ts';
import { clearReferral, pendingReferral, referralLink } from '../lib/referral.ts';
import { Button, cx, Field, Notice } from './ui.tsx';
import { Captcha } from './Captcha.tsx';

import { LOCALE, t } from '../i18n.ts';
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
          <button type="button" onClick={onClose} aria-label={t('Fermer')} className="hit rounded-full p-2 text-slate-500 hover:bg-slate-100">
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
          {t('Votre demande est bien prise en compte. Nous vérifions vos réponses et vous envoyons un mot de passe provisoire dans « Nous contacter », en général dans la journée.')}</Notice>
        <Button
          className="w-full"
          onClick={() => {
            close();
            window.location.hash = 'contact';
          }}
        >
          {t('Voir ma demande')}</Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">{t('Répondez à ces questions : elles nous permettent de vérifier que le compte est bien le vôtre.')}</p>
      <Field label={t('E-mail ou téléphone du compte')} value={identifier} onChange={setIdentifier} autoComplete="username" />
      <Field label={t('Prénom indiqué sur le compte')} value={name} onChange={setName} autoComplete="given-name" />
      <Field
        label={question ? t('Votre question secrète : {0}', [question]) : t('Votre phrase secrète')}
        value={phrase}
        onChange={setPhrase}
        hint={question ? t('Majuscules et accents ne comptent pas.') : t('Si vous en avez défini une dans « Mes crédits ». Majuscules et accents ne comptent pas.')}
      />
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-slate-700">{t('Votre dernier achat de crédits')}</span>
        <select value={lastPurchase} onChange={(e) => setLastPurchase(e.target.value)} className="w-full rounded-xl bg-white px-3 py-2.5 text-sm ring-1 ring-slate-300">
          <option value="unknown">{t('Je ne sais plus')}</option>
          <option value="none">{t('Je n’ai jamais acheté')}</option>
          <option value="500">{t('500 FCFA')}</option>
          <option value="1500">{t('1 500 FCFA')}</option>
          <option value="3000">{t('3 000 FCFA')}</option>
        </select>
      </label>
      <Field label={t('Crédits qu’il vous restait (environ, facultatif)')} type="number" value={credits} onChange={setCredits} />
      <Field label={t('Autre précision (facultatif)')} value={note} onChange={setNote} />
      {error && <Notice tone="error">{error}</Notice>}
      <Button className="w-full" loading={busy} disabled={busy || identifier.trim().length < 3} onClick={() => void send()}>
        {t('Envoyer ma demande')}</Button>
      <button type="button" className="w-full text-center text-sm font-semibold text-brand-700" onClick={onBack}>
        {t('Retour à la connexion')}</button>
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
          <p className="text-sm text-slate-600">{t('Indiquez l’e-mail de votre compte : nous vous envoyons un code pour choisir un nouveau mot de passe.')}</p>
          <Field label={t('E-mail du compte')} value={identifier} onChange={setIdentifier} autoComplete="username" />
          <Button className="w-full" loading={busy} disabled={busy || !identifier.includes('@')} onClick={() => void send()}>
            {t('M’envoyer un code')}</Button>
        </>
      ) : (
        <>
          <Notice tone="info">{t('Si un compte existe avec cette adresse, un code vient d’y être envoyé (pensez aux spams).')}</Notice>
          <Field label={t('Code reçu (6 chiffres)')} value={code} onChange={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))} />
          <Field label={t('Nouveau mot de passe')} type="password" value={password} onChange={setPassword} autoComplete="new-password" hint={t('8 caractères minimum.')} />
          <Button className="w-full" loading={busy} disabled={busy || code.length !== 6 || password.length < 8} onClick={() => void reset()}>
            {t('Changer mon mot de passe')}</Button>
        </>
      )}
      {error && <Notice tone="error">{error}</Notice>}
      <button type="button" className="w-full text-center text-sm text-slate-600" onClick={() => setForm(true)}>
        {t('Plus accès à cet e-mail, ou compte avec un numéro de téléphone ?')}{' '}<span className="font-semibold text-brand-700">{t('Faire une demande')}</span>
      </button>
      <button type="button" className="w-full text-center text-sm font-semibold text-brand-700" onClick={onBack}>
        {t('Retour à la connexion')}</button>
    </div>
  );
}

const QUESTIONS = [
  t('Quel est le prénom de votre grand-mère ?'),
  t('Quel était le nom de votre premier animal ?'),
  t('Dans quelle ville est né votre père ?'),
  t('Quel est le nom de votre école primaire ?'),
  t('Quel était votre plat préféré quand vous étiez enfant ?'),
  t('Quel est le surnom que vous donnait votre famille ?'),
];

/** Ce que coûte chaque action, en une ligne chacune. */
const PRICES: [string, string][] = [
  [t('Remplir son CV à la main et le télécharger en PDF'), t('Gratuit')],
  [t('Une action : générer ou corriger le CV, l’adapter à une offre, la lettre, la fiche entretien, la traduction'), t('1 crédit')],
  [t('Version Pro d’un CV, pour toujours : sans mention, 13 modèles, Word'), t('2 crédits')],
  [t('Scanner ou dossier PDF : gratuit jusqu’à 2 pages ou 2 pièces, puis'), t('1 crédit')],
  [t('Texte écrit à la main tapé au propre, par page'), t('1 crédit')],
];

/** « Mes crédits » : phrase ou question secrète (récupération du compte) et changement de mot de passe. */
export function AccountSecurity({ onboarding = false, onSaved }: { onboarding?: boolean; onSaved?: () => void } = {}) {
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
          <ShieldCheck className="size-5 text-emerald-600" /> {' '}{t('Sécurité du compte')}</p>
      )}
      {secretSet === false && !onboarding && (
        <p className="mt-1 text-sm text-amber-800">
          {t('Définissez une phrase ou une question secrète : elle vous permettra de récupérer votre compte si vous oubliez votre mot de passe.')}</p>
      )}
      {secretSet && (
        <p className="mt-1 text-sm text-emerald-800">
          {t('{0} Gardez la réponse en mémoire, ne la donnez à personne.', [savedQuestion ? t('Question secrète définie : « {0} ».', [savedQuestion]) : t('Phrase secrète définie.')])}</p>
      )}
      <div className={cx('mt-3 flex flex-wrap gap-2', onboarding && 'hidden')}>
        <Button size="sm" variant={secretSet ? 'secondary' : 'primary'} onClick={() => setOpen(open === 'phrase' ? null : 'phrase')}>
          {secretSet ? t('Changer ma phrase ou question secrète') : t('Définir ma phrase ou question secrète')}
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setOpen(open === 'password' ? null : 'password')}>
          {t('Changer mon mot de passe')}</Button>
      </div>
      {open === 'phrase' && (
        <div className="mt-3 space-y-2">
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
            {(
              [
                ['phrase', t('Phrase secrète')],
                ['question', t('Question secrète')],
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
                <span className="mb-1 block text-sm font-medium text-slate-700">{t('Question')}</span>
                <select value={choice} onChange={(e) => setChoice(e.target.value)} className="w-full rounded-xl bg-white px-3 py-2.5 text-sm ring-1 ring-slate-300">
                  {QUESTIONS.map((q) => (
                    <option key={q} value={q}>
                      {q}
                    </option>
                  ))}
                  <option value="">{t('Écrire ma propre question…')}</option>
                </select>
              </label>
              {choice === '' && <Field label={t('Ma question')} value={custom} onChange={setCustom} hint={t('Une question dont vous seul connaissez la réponse.')} />}
            </>
          )}
          <Field
            label={kind === 'question' ? t('Réponse') : t('Phrase secrète')}
            value={phrase}
            onChange={setPhrase}
            hint={
              kind === 'question'
                ? t('Majuscules et accents ne comptent pas.')
                : t('Un mot ou quelques mots faciles à retenir pour vous, difficiles à deviner pour les autres. Plus c’est long, plus c’est sûr.')
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
                q ? t('Question secrète enregistrée.') : t('Phrase secrète enregistrée.'),
              );
            }}
          >
            {t('Enregistrer')}</Button>
        </div>
      )}
      {open === 'password' && (
        <div className="mt-3 space-y-2">
          <Field label={t('Mot de passe actuel (ou provisoire)')} type="password" value={current} onChange={setCurrent} autoComplete="current-password" />
          <Field label={t('Nouveau mot de passe')} type="password" value={next} onChange={setNext} autoComplete="new-password" hint={t('8 caractères minimum.')} />
          <Button size="sm" loading={busy} disabled={busy || !current || next.length < 8} onClick={() => void run(() => api.changePassword(current, next), t('Mot de passe changé.'))}>
            {t('Changer')}</Button>
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
  // Clé publique de la vérification anti-robot (null : pas de vérification sur ce serveur).
  const [captchaKey, setCaptchaKey] = useState<string | null>(null);
  const [captcha, setCaptcha] = useState('');
  const [captchaRound, setCaptchaRound] = useState(0);
  useEffect(() => {
    void api.health().then(
      (h) => {
        setEmailOn(!!h.email);
        setCaptchaKey(h.captcha ?? null);
      },
      () => {},
    );
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
      const session = mode === 'register' ? await api.register(identifier, password, name, invitedBy, captcha) : await api.login(identifier, password);
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
      // Un jeton anti-robot ne sert qu'une fois : nouveau jeton pour le prochain essai.
      if (mode === 'register') setCaptchaRound((n) => n + 1);
    } finally {
      setBusy(false);
    }
  }

  if (mode === 'secure') {
    return (
      <Modal title={t('Sécurisez votre compte')} onClose={close}>
        <div className="mb-3">
          <Notice tone="success">{t('Compte créé ! Dernière étape, 10 secondes :')}</Notice>
        </div>
        <p className="mb-3 text-sm text-slate-600">
          {t('Choisissez une phrase ou une question secrète. Si un jour vous oubliez votre mot de passe, elle nous permettra de vérifier que le compte est bien le vôtre.')}</p>
        <AccountSecurity onboarding onSaved={close} />
        <button type="button" onClick={close} className="mt-4 w-full text-center text-sm text-slate-500">
          {t('Plus tard (dans « Mes crédits »)')}</button>
      </Modal>
    );
  }

  if (mode === 'forgot') {
    return (
      <Modal title={t('Mot de passe oublié')} onClose={close}>
        <ForgotPassword initial={identifier} emailOn={emailOn} onBack={() => setMode('login')} />
      </Modal>
    );
  }

  return (
    <Modal title={mode === 'register' ? t('Créer mon compte') : t('Me connecter')} onClose={close}>
      {dialogReason && (
        <div className="mb-3">
          <Notice tone="info">{dialogReason}</Notice>
        </div>
      )}
      {mode === 'register' && (
        <div className="mb-4 flex items-center gap-2 rounded-xl bg-brand-50 px-3 py-2.5 text-sm text-brand-900">
          <Gift className="size-4 shrink-0" /> {' '}{t('Gratuit : votre premier crédit est offert.')}</div>
      )}
      {mode === 'register' && invitedBy && (
        <div className="mb-4 flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2.5 text-sm text-emerald-900">
          <Gift className="size-4 shrink-0" /> {' '}{t('Invité par un ami : 1 crédit en plus à votre premier achat.')}</div>
      )}
      <form onSubmit={submit} className="space-y-3">
        {mode === 'register' && <Field label={t('Prénom')} value={name} onChange={setName} autoComplete="given-name" />}
        <Field label={t('E-mail ou numéro de téléphone')} value={identifier} onChange={setIdentifier} autoComplete="username" />
        <Field
          label={t('Mot de passe')}
          type="password"
          value={password}
          onChange={setPassword}
          autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
          hint={mode === 'register' ? t('8 caractères minimum.') : undefined}
        />
        {mode === 'login' && (
          <button type="button" className="hit min-h-8 text-sm font-medium text-brand-700" onClick={() => (setMode('forgot'), setError(null))}>
            {t('Mot de passe oublié ?')}</button>
        )}
        {error && <Notice tone="error">{error}</Notice>}
        {mode === 'register' && captchaKey && <Captcha siteKey={captchaKey} onToken={setCaptcha} resetKey={captchaRound} />}
        <Button type="submit" size="lg" className="w-full" loading={busy} disabled={!identifier.trim() || !password || (mode === 'register' && Boolean(captchaKey) && !captcha)}>
          {mode === 'register' ? t('Créer mon compte') : t('Me connecter')}
        </Button>
      </form>
      <p className="mt-4 text-center text-sm text-slate-600">
        {mode === 'register' ? t('Déjà un compte ?') : t('Pas encore de compte ?')}{' '}
        <button type="button" className="hit min-h-8 font-semibold text-brand-700" onClick={() => (setMode(mode === 'register' ? 'login' : 'register'), setError(null))}>
          {mode === 'register' ? t('Se connecter') : t('Créer un compte')}
        </button>
      </p>
      <p className="mt-3 text-center text-xs text-slate-500">{t('Vos CV restent sur votre appareil. Le compte sert uniquement à gérer vos crédits.')}</p>
    </Modal>
  );
}

const fcfa = (n: number) => `${n.toLocaleString(LOCALE)} FCFA`;

/** « Invite tes amis » : lien personnel, partage WhatsApp, et résultats. */
function ReferralCard() {
  const [info, setInfo] = useState<{ code: string; invited: number; rewarded: number; bonus: number } | null>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    api.referral().then(setInfo, () => setInfo(null));
  }, []);
  if (!info) return null;
  const link = referralLink(info.code);
  const message = t('J’ai fait mon CV avec CVCasa : il s’adapte à chaque offre d’emploi. Essaie gratuitement : {0}', [link]);

  async function share() {
    if (Capacitor.isNativePlatform()) {
      const { Share } = await import('@capacitor/share');
      await Share.share({ title: 'CVCasa', text: message });
    } else if (navigator.share) {
      await navigator.share({ title: 'CVCasa', text: message }).catch(() => {});
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
    }
  }

  return (
    <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
      <p className="flex items-center gap-2 font-semibold text-emerald-900">
        <Gift className="size-5" /> {' '}{t('Invite tes amis, gagne des crédits')}</p>
      <p className="mt-1 text-sm text-emerald-900">
        {t('Quand un ami inscrit avec ton lien achète son premier pack, vous recevez chacun {0} crédit offert.', [info.bonus])}</p>
      <div className="mt-3 flex items-center gap-2 rounded-xl bg-white px-3 py-2 ring-1 ring-emerald-200">
        <span className="min-w-0 flex-1 truncate text-sm text-slate-700">{link}</span>
        <button
          type="button"
          aria-label={t('Copier le lien')}
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
          {t('Partager (WhatsApp…)')}</Button>
        <span className="text-xs text-emerald-900">
          {t('Code')}{' '}<strong className="tracking-wider">{info.code}</strong> {' '}{t('· {0} ami{1} inscrit{2} ·', [info.invited, info.invited > 1 ? 's' : '', info.invited > 1 ? 's' : ''])}{' '}
          {t('{0} récompense{1}', [info.rewarded, info.rewarded > 1 ? 's' : ''])}
        </span>
      </div>
    </div>
  );
}

/** « jeudi 30 octobre à 14 h » */
export function offerEnd(iso: string): string {
  const d = new Date(iso);
  return t('{0} à {1} h', [d.toLocaleDateString(LOCALE, { weekday: 'long', day: 'numeric', month: 'long' }), d.getHours()]);
}

function CreditsDialog() {
  const { user, dialogReason, close } = useAccount();
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
    <Modal title={t('Mes crédits')} onClose={close}>
      {user && (
        <div className="mb-4 flex items-center gap-3 rounded-2xl bg-brand-50 p-3">
          <span className="flex size-11 items-center justify-center rounded-full bg-brand-600 text-white">
            <Zap className="size-5" />
          </span>
          <div className="flex-1">
            <p className="text-2xl font-bold text-slate-900">
              {user.credits} <span className="text-sm font-medium text-slate-600">{t('crédit{0}', [user.credits > 1 ? 's' : ''])}</span>
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
      <table className="mb-3 w-full text-sm">
        <caption className="sr-only">{t('Ce que coûte chaque action')}</caption>
        <tbody className="divide-y divide-slate-100">
          {PRICES.map(([what, price]) => (
            <tr key={what}>
              <th scope="row" className="py-1.5 pr-3 text-left font-normal text-slate-700">
                {what}
              </th>
              <td className="py-1.5 text-right font-semibold whitespace-nowrap text-slate-900">{price}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="space-y-2">
        {offerOpen && (
          <div className="flex items-center gap-3 rounded-2xl border-2 border-amber-400 bg-amber-50 p-3">
            <div className="flex-1">
              <p className="font-semibold text-slate-900">
                {t('{0} crédits', [offerOpen.pack.credits])}{' '}<span className="ml-1 rounded-full bg-amber-200 px-2 py-0.5 text-xs font-semibold text-amber-900">{t('Offre de retour')}</span>
              </p>
              <p className="text-sm text-slate-600">{t('1 crédit offert en plus, jusqu’au {0}. Une seule fois.', [offerEnd(offerOpen.expiresAt)])}</p>
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
                {t('{0} crédits', [p.credits])}{' '}
                {p.id === best && <span className="ml-1 rounded-full bg-brand-100 px-2 py-0.5 text-xs font-semibold text-brand-800">{t('Le plus choisi')}</span>}
              </p>
              <p className="text-sm text-slate-500">
                {t('{0} · {1} le crédit', [p.name, fcfa(Math.round(p.price / p.credits))])}</p>
            </div>
            <Button size="sm" loading={busy === p.id} disabled={!paymentsOn || busy !== null} onClick={() => buy(p)}>
              {fcfa(p.price)}
            </Button>
          </div>
        ))}
        {!packs && !error && <div className="h-40 animate-pulse rounded-2xl bg-slate-100" />}
      </div>
      <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
        <Check className="size-3.5" /> {' '}{t('Paiement sécurisé par FedaPay : MTN MoMo ou Moov Money.')}</p>
      {!paymentsOn && (
        <div className="mt-3">
          <Notice tone="info">{t('Le paiement en ligne sera ouvert très bientôt.')}</Notice>
        </div>
      )}
      {error && (
        <div className="mt-3">
          <Notice tone="error">{error}</Notice>
        </div>
      )}
      {user && <ReferralCard />}
      {/* Compte (prénom, mot de passe, phrase secrète, déconnexion) : dans Réglages. */}
      {user && (
        <button
          type="button"
          onClick={() => {
            close();
            window.location.hash = 'reglages';
          }}
          className="mt-5 flex min-h-11 items-center gap-1.5 text-sm font-semibold text-brand-700 hover:text-brand-800"
        >
          <Settings className="size-4" aria-hidden="true" /> {t('Mon compte et sécurité')}
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
      <button type="button" aria-label={t('Se connecter')} onClick={() => open('account')} className="hit flex items-center gap-1.5 rounded-xl bg-brand-600 px-3 py-2 text-sm font-medium whitespace-nowrap text-white hover:bg-brand-700">
        <UserRound className="size-4" /> <span className="hidden sm:inline">{t('Se connecter')}</span>
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={() => open('credits')}
      title={t('Mes crédits')}
      className={cx('hit flex items-center gap-1 rounded-xl px-2.5 py-2 text-sm font-semibold', user.credits > 0 ? 'bg-brand-50 text-brand-800' : 'bg-amber-100 text-amber-900')}
    >
      <Zap className="size-4" /> {user.credits}
    </button>
  );
}
