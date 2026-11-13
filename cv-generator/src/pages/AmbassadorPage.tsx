import { useCallback, useEffect, useState } from 'react';
import { Check, Clock, Copy, HandCoins, Share2, ShieldCheck, Wallet } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { LOCALE, t } from '../i18n.ts';
import { useAccount } from '../lib/account.ts';
import { api, ApiError, type AmbassadorInfo } from '../lib/api.ts';
import { referralLink } from '../lib/referral.ts';
import { Button, Card, cx, Field, Notice, TextArea } from '../components/ui.tsx';

// Programme Ambassadeur : on recommande CVCasa et on gagne de l'argent (FCFA, par Mobile Money)
// quand les personnes invitées créent leur CV puis achètent. Les demandes sont validées par l'équipe.

const fcfa = (n: number) => `${n.toLocaleString(LOCALE)} FCFA`;
const day = (iso: string) => new Date(iso).toLocaleDateString(LOCALE, { day: 'numeric', month: 'short', year: 'numeric' });

function Rules({ r }: { r: AmbassadorInfo['rules'] }) {
  const items = [
    { amount: fcfa(r.signupReward), text: t('par ami qui s’inscrit et crée son premier CV (vos {0} premiers amis)', [r.signupRewardLimit]) },
    { amount: fcfa(r.firstPurchaseReward), text: t('quand un ami fait son premier achat') },
    { amount: `${r.commissionPercent} %`, text: t('de chaque achat de vos amis, pendant {0} mois', [r.commissionMonths]) },
  ];
  return (
    <ul className="grid gap-2 sm:grid-cols-3">
      {items.map((x) => (
        <li key={x.text} className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
          <span className="block font-display text-2xl font-bold text-brand-700">{x.amount}</span>
          <span className="mt-1 block text-sm text-slate-600">{x.text}</span>
        </li>
      ))}
    </ul>
  );
}

function Fine({ r }: { r: AmbassadorInfo['rules'] }) {
  return (
    <ul className="space-y-1 text-xs text-slate-500">
      <li>{t('Les gains deviennent disponibles {0} jours après l’inscription ou l’achat.', [r.holdDays])}</li>
      <li>{t('Retrait par Mobile Money à partir de {0} disponibles, envoyé par l’équipe sous quelques jours. Les frais d’envoi Mobile Money ({1} %) sont déduits du montant envoyé.', [fcfa(r.minPayout), r.payoutFeePercent])}</li>
      <li>{t('Rien n’est versé pour un compte créé sur votre propre téléphone ou votre connexion : invitez de vraies personnes.')}</li>
      <li>{t('Plafond de {0} de gains par mois. Les comptes qui trichent sont suspendus et leurs gains non versés annulés.', [fcfa(r.monthlyCap)])}</li>
      <li>{t('CVCasa peut faire évoluer ou arrêter le programme. Les gains déjà disponibles restent dus.')}</li>
    </ul>
  );
}

export function AmbassadorPage() {
  const { enabled, user, open } = useAccount();
  const [info, setInfo] = useState<AmbassadorInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ momoNumber: '', momoName: '', motivation: '' });
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await api.ambassador();
      setInfo(r);
      setForm((f) => ({ ...f, momoNumber: f.momoNumber || r.momoNumber, momoName: f.momoName || r.momoName }));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t('Une erreur est survenue. Réessayez.'));
    }
  }, []);
  useEffect(() => {
    if (user) void load();
  }, [user, load]);

  const run = async (fn: () => Promise<AmbassadorInfo>) => {
    setBusy(true);
    setError(null);
    try {
      setInfo(await fn());
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t('Une erreur est survenue. Réessayez.'));
    } finally {
      setBusy(false);
    }
  };

  const header = (
    <div className="px-1">
      <h1 className="flex items-center gap-2 font-display text-2xl font-bold text-ink sm:text-3xl">
        <HandCoins className="size-7 text-brand-600" aria-hidden="true" /> {t('Ambassadeur CVCasa')}
      </h1>
      <p className="mt-1 text-slate-600">{t('Recommandez CVCasa autour de vous et gagnez de l’argent, versé par Mobile Money.')}</p>
    </div>
  );

  if (!enabled || !user) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        {header}
        <Card title={t('Connectez-vous pour commencer')}>
          <p className="text-sm text-slate-600">{t('Le programme Ambassadeur est lié à votre compte : c’est lui qui reçoit vos gains.')}</p>
          <Button className="mt-3" onClick={() => open('account', t('Connectez-vous pour devenir ambassadeur.'))}>
            {t('Se connecter ou créer un compte')}</Button>
        </Card>
      </div>
    );
  }

  if (!info) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        {header}
        {error ? <Notice tone="error">{error}</Notice> : <p className="px-1 text-sm text-slate-500">{t('Chargement…')}</p>}
      </div>
    );
  }

  const r = info.rules;
  const link = referralLink(info.code);
  const message = t('J’ai fait mon CV avec CVCasa : il s’adapte à chaque offre d’emploi, et la veille emploi m’envoie les offres chaque matin. Essaie gratuitement : {0}', [link]);
  const share = async () => {
    if (Capacitor.isNativePlatform()) {
      const { Share } = await import('@capacitor/share');
      await Share.share({ title: 'CVCasa', text: message });
    } else if (navigator.share) {
      await navigator.share({ title: 'CVCasa', text: message }).catch(() => {});
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
    }
  };

  // Pas encore ambassadeur : explication et demande.
  if (!info.status || info.status === 'refused') {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        {header}
        <section className="rounded-3xl bg-brand-50/70 p-4 ring-1 ring-brand-100 sm:p-6">
          <h2 className="mb-3 font-display text-lg font-semibold text-ink">{t('Ce que vous gagnez')}</h2>
          <Rules r={r} />
          <p className="mt-3 text-sm text-slate-700">
            {t('Exemple : 10 amis qui achètent chacun un pack à {0} vous rapportent {1}.', [fcfa(500), fcfa(10 * (r.firstPurchaseReward + Math.floor((500 * r.commissionPercent) / 100)))])}</p>
        </section>
        {info.status === 'refused' && <Notice tone="warn">{t('Votre précédente demande n’a pas été retenue. Vous pouvez en refaire une.')}</Notice>}
        <Card tour="ambassador-apply" title={t('Devenir ambassadeur')} subtitle={t('Votre demande est vérifiée par l’équipe, en général sous 48 heures.')}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t('Numéro Mobile Money')} value={form.momoNumber} onChange={(v) => setForm({ ...form, momoNumber: v.slice(0, 20) })} placeholder="+229 01 00 00 00 00" autoComplete="tel" />
            <Field label={t('Nom du titulaire du compte')} value={form.momoName} onChange={(v) => setForm({ ...form, momoName: v.slice(0, 80) })} autoComplete="name" />
          </div>
          <TextArea
            className="mt-3"
            label={t('Comment allez-vous en parler ? (facultatif)')}
            value={form.motivation}
            onChange={(v) => setForm({ ...form, motivation: v.slice(0, 500) })}
            rows={2}
            placeholder={t('Ex. groupes WhatsApp d’étudiants, mon école, mon cybercafé…')}
          />
          {error && <div className="mt-3"><Notice tone="error">{error}</Notice></div>}
          <Button className="mt-3" loading={busy} disabled={!form.momoNumber.trim() || !form.momoName.trim()} onClick={() => void run(() => api.ambassadorApply(form))}>
            {t('Envoyer ma demande')}</Button>
          <div className="mt-4">
            <Fine r={r} />
          </div>
        </Card>
      </div>
    );
  }

  if (info.status === 'pending' || info.status === 'suspended') {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        {header}
        <Card title={info.status === 'pending' ? t('Demande envoyée') : t('Compte ambassadeur suspendu')}>
          <p className="flex items-start gap-2 text-sm text-slate-700">
            <Clock className="mt-0.5 size-4 shrink-0 text-brand-600" aria-hidden="true" />
            {info.status === 'pending'
              ? t('Merci ! L’équipe vérifie votre demande, en général sous 48 heures. Vos gains commencent dès la validation : nous vous conseillons d’attendre ce moment pour partager votre lien.')
              : t('Vos gains sont en pause. Écrivez-nous depuis « Nous contacter » pour en savoir plus.')}
          </p>
        </Card>
        <Rules r={r} />
      </div>
    );
  }

  // Ambassadeur actif.
  const e = info.earnings;
  const canWithdraw = e.available >= r.minPayout && !e.requested;
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      {header}
      <Card tour="ambassador-link" title={t('Votre lien')} subtitle={t('Chaque ami qui s’inscrit par ce lien est rattaché à vous.')}>
        <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-200">
          <span className="min-w-0 flex-1 truncate text-sm text-slate-700">{link}</span>
          <button
            type="button"
            onClick={() => void navigator.clipboard?.writeText(link).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800); })}
            className="flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm font-semibold text-brand-700"
          >
            {copied ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />} {copied ? t('Copié') : t('Copier')}
          </button>
        </div>
        <Button className="mt-3" icon={<Share2 className="size-4" />} onClick={() => void share()}>
          {t('Partager mon lien')}</Button>
      </Card>

      <section data-tour="ambassador-earnings" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { label: t('Disponible'), value: e.available, strong: true },
          { label: t('En attente ({0} jours)', [r.holdDays]), value: e.pending },
          { label: t('Retrait en cours'), value: e.requested },
          { label: t('Déjà reçu'), value: e.paid },
        ].map((x) => (
          <div key={x.label} className={cx('rounded-2xl p-3 ring-1', x.strong ? 'bg-emerald-50 ring-emerald-200' : 'bg-white ring-slate-200')}>
            <span className="block text-xs text-slate-600">{x.label}</span>
            <span className={cx('block font-display text-lg font-bold', x.strong ? 'text-emerald-800' : 'text-ink')}>{fcfa(x.value)}</span>
          </div>
        ))}
      </section>

      <Card title={t('Vos amis')}>
        <p className="text-sm text-slate-700">
          {t('{0} inscrit(s) par votre lien · {1} premier(s) CV récompensé(s) · {2} acheteur(s)', [info.stats.invited, info.stats.signupsRewarded, info.stats.buyers])}</p>
        <div className="mt-3">
          <Rules r={r} />
        </div>
      </Card>

      <Card tour="ambassador-payout" title={t('Retirer mes gains')} subtitle={t('Vers {0} ({1}).', [info.momoNumber, info.momoName])}>
        {error && <div className="mb-3"><Notice tone="error">{error}</Notice></div>}
        <Button icon={<Wallet className="size-4" />} loading={busy} disabled={!canWithdraw} onClick={() => void run(() => api.ambassadorPayout())}>
          {t('Demander mon retrait')}</Button>
        <p className="mt-2 text-sm text-slate-600">
          {e.requested
            ? t('Votre retrait de {0} est en cours : vous le recevez sous quelques jours.', [fcfa(e.requested)])
            : e.available >= r.minPayout
              ? t('{0} disponibles : vous recevrez {1} après les frais d’envoi Mobile Money.', [fcfa(e.available), fcfa(e.available - Math.ceil((e.available * r.payoutFeePercent) / 100))])
              : t('Encore {0} à gagner avant le premier retrait.', [fcfa(r.minPayout - e.available)])}
        </p>
        {info.payouts.length > 0 && (
          <ul className="mt-3 divide-y divide-slate-100 text-sm">
            {info.payouts.map((p) => (
              <li key={p.id} className="flex items-center justify-between py-2">
                <span>{day(p.requestedAt)}</span>
                <span className="font-semibold">{fcfa(p.net)}</span>
                <span className={cx('rounded-full px-2 py-0.5 text-xs font-semibold', p.status === 'paid' ? 'bg-emerald-100 text-emerald-900' : p.status === 'refused' ? 'bg-red-50 text-red-800' : 'bg-sun-100 text-sun-900')}>
                  {p.status === 'paid' ? t('Reçu') : p.status === 'refused' ? t('Refusé') : t('En cours')}
                </span>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4 flex items-start gap-2">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-slate-400" aria-hidden="true" />
          <Fine r={r} />
        </div>
      </Card>
    </div>
  );
}
