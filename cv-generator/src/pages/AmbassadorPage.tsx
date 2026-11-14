import { useCallback, useEffect, useState } from 'react';
import { Check, Clock, Copy, FileSignature, FileUp, HandCoins, Share2, ShieldCheck, Wallet, X } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { LANG, LOCALE, t } from '../i18n.ts';
import { AMBASSADOR_CONTRACT_VERSION, ambassadorContract, sameName } from '../../shared/ambassadorContract.ts';
import { fileToAttachment } from '../lib/files.ts';
import { SignaturePad } from '../components/SignaturePad.tsx';
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
    {
      amount: `${fcfa(r.firstPurchaseTiers[0].reward)} – ${fcfa(r.firstPurchaseTiers[r.firstPurchaseTiers.length - 1].reward)}`,
      text: t('au premier achat d’un ami, selon le pack : {0}', [r.firstPurchaseTiers.map((x) => fcfa(x.reward)).join(' · ')]),
    },
    { amount: `${r.commissionPercent} %`, text: t('de chacun de ses achats suivants, pendant {0} mois', [r.commissionMonths]) },
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

/** Le contrat, à lire dans une zone qui défile. */
function Contract({ r }: { r: AmbassadorInfo['rules'] }) {
  return (
    <div className="max-h-72 space-y-3 overflow-y-auto rounded-xl bg-slate-50 p-4 text-sm leading-relaxed text-slate-700 ring-1 ring-slate-200" tabIndex={0} aria-label={t('Contrat Ambassadeur')}>
      <p className="font-semibold text-ink">{t('Contrat Ambassadeur CVCasa (version {0})', [AMBASSADOR_CONTRACT_VERSION])}</p>
      {ambassadorContract(LANG === 'en' ? 'en' : 'fr', r).map((sec) => (
        <section key={sec.title}>
          <h3 className="font-semibold text-slate-900">{sec.title}</h3>
          {sec.text.map((p) => (
            <p key={p} className="mt-1">
              {p}
            </p>
          ))}
        </section>
      ))}
    </div>
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
  const [form, setForm] = useState({ firstName: '', lastName: '', momoNumber: '', motivation: '', accept: false, signature: '', signatureImage: '' });
  const [showContract, setShowContract] = useState(false);
  const [signature, setSignature] = useState<string | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [change, setChange] = useState<{ open: boolean; number: string; docs: { name: string; mediaType: string; data: string }[] }>({ open: false, number: '', docs: [] });
  const [copied, setCopied] = useState(false);
  const [codeEdit, setCodeEdit] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await api.ambassador();
      setInfo(r);
      setForm((f) => ({ ...f, momoNumber: f.momoNumber || r.momoNumber, firstName: f.firstName || r.legalFirstName, lastName: f.lastName || r.legalLastName }));
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
      return true;
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t('Une erreur est survenue. Réessayez.'));
      return false;
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

  // Contrat arrêté pour triche : pas de nouvelle demande.
  if (info.status === 'ended' && info.endedReason === 'fraud') {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        {header}
        <Notice tone="warn">{t('Votre contrat Ambassadeur a été arrêté pour non-respect des règles.')}</Notice>
      </div>
    );
  }

  // Programme arrêté par CVCasa : le solde reste dû, même petit.
  if (info.status === 'ended' && info.endedReason === 'company') {
    const left = info.earnings.available + info.earnings.pending;
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        {header}
        <Card title={t('Le programme a pris fin')} subtitle={t('Merci pour votre aide. Votre solde vous reste dû, même sous le seuil habituel.')}>
          {error && <div className="mb-3"><Notice tone="error">{error}</Notice></div>}
          <p className="text-sm text-slate-700">
            {info.earnings.requested ? t('Votre retrait de {0} est en cours : vous le recevez sous quelques jours.', [fcfa(info.earnings.requested)]) : t('Solde : {0}.', [fcfa(left)])}
          </p>
          {!info.earnings.requested && left > 0 && (
            <Button className="mt-3" icon={<Wallet className="size-4" />} loading={busy} onClick={() => void run(() => api.ambassadorPayout())}>
              {t('Demander mon retrait')}</Button>
          )}
        </Card>
      </div>
    );
  }

  // Pas encore ambassadeur (ou ancien ambassadeur) : explication et demande.
  if (!info.status || info.status === 'refused' || info.status === 'ended') {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        {header}
        <section className="rounded-3xl bg-brand-50/70 p-4 ring-1 ring-brand-100 sm:p-6">
          <h2 className="mb-3 font-display text-lg font-semibold text-ink">{t('Ce que vous gagnez')}</h2>
          <Rules r={r} />
          <p className="mt-3 text-sm text-slate-700">
            {t('Prime au premier achat : {0} pour le pack à {1}, {2} pour le pack à {3}, {4} pour le pack à {5}.', [fcfa(r.firstPurchaseTiers[0].reward), fcfa(500), fcfa(r.firstPurchaseTiers[1]?.reward ?? 0), fcfa(1500), fcfa(r.firstPurchaseTiers[2]?.reward ?? 0), fcfa(3000)])}{' '}
            {t('Exemple : 10 amis qui achètent chacun un pack à {0} vous rapportent {1}, puis {2} % de tous leurs achats suivants pendant {3} mois.', [fcfa(500), fcfa(10 * r.firstPurchaseTiers[0].reward), r.commissionPercent, r.commissionMonths])}</p>
        </section>
        {info.status === 'refused' && <Notice tone="warn">{t('Votre précédente demande n’a pas été retenue. Vous pouvez en refaire une.')}</Notice>}
        {info.status === 'ended' && (
          <Notice>
            {info.endedReason === 'inactive'
              ? t('Votre précédent contrat a pris fin faute d’activité. Vous pouvez faire une nouvelle demande.')
              : t('Vous avez quitté le programme. Vous pouvez faire une nouvelle demande quand vous voulez.')}
          </Notice>
        )}
        <Card tour="ambassador-apply" title={t('Devenir ambassadeur')} subtitle={t('Votre demande est vérifiée par l’équipe, en général sous 48 heures.')}>
          <p className="mb-3 text-sm text-slate-600">{t('Écrivez vos prénoms et votre nom exactement comme sur votre pièce d’identité : vos gains ne seront envoyés qu’à un numéro Mobile Money enregistré à ce nom.')}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t('Prénom(s)')} value={form.firstName} onChange={(v) => setForm({ ...form, firstName: v.slice(0, 80) })} autoComplete="given-name" />
            <Field label={t('Nom de famille')} value={form.lastName} onChange={(v) => setForm({ ...form, lastName: v.slice(0, 80) })} autoComplete="family-name" />
          </div>
          <Field
            className="mt-3"
            label={t('Numéro Mobile Money à votre nom')}
            value={form.momoNumber}
            onChange={(v) => setForm({ ...form, momoNumber: v.slice(0, 20) })}
            placeholder="+229 01 00 00 00 00"
            autoComplete="tel"
            hint={t('Le numéro doit être enregistré au nom indiqué ci-dessus. Il ne pourra ensuite être changé que sur justificatifs.')}
          />
          <TextArea
            className="mt-3"
            label={t('Comment allez-vous en parler ? (facultatif)')}
            value={form.motivation}
            onChange={(v) => setForm({ ...form, motivation: v.slice(0, 500) })}
            rows={2}
            placeholder={t('Ex. groupes WhatsApp d’étudiants, mon école, mon cybercafé…')}
          />
          <div className="mt-4">
            <p className="mb-2 flex items-center gap-2 font-semibold text-ink">
              <FileSignature className="size-4 text-brand-600" aria-hidden="true" /> {t('Le contrat')}
            </p>
            <Contract r={r} />
            <label className="mt-3 flex min-h-11 items-start gap-2.5 text-sm text-slate-800">
              <input type="checkbox" className="mt-1 size-4 accent-brand-600" checked={form.accept} onChange={(ev) => setForm({ ...form, accept: ev.target.checked })} />
              <span>{t('J’ai lu le contrat Ambassadeur et je l’accepte.')}</span>
            </label>
            <Field
              className="mt-2"
              label={t('Signature : tapez vos prénoms et votre nom')}
              value={form.signature}
              onChange={(v) => setForm({ ...form, signature: v.slice(0, 120) })}
              placeholder={[form.firstName, form.lastName].filter(Boolean).join(' ') || t('Prénom Nom')}
            />
            <p className="mt-3 mb-1 text-sm font-medium text-slate-700">{t('Signez dans le cadre, au doigt ou à la souris')}</p>
            <SignaturePad value={form.signatureImage || null} onChange={(v) => setForm((f) => ({ ...f, signatureImage: v ?? '' }))} />
            <p className="mt-1 text-xs text-slate-500">{t('Signé en ligne le {0}. Une copie reste consultable dans votre espace.', [day(new Date().toISOString())])}</p>
          </div>
          {error && <div className="mt-3"><Notice tone="error">{error}</Notice></div>}
          <Button
            className="mt-3"
            icon={<FileSignature className="size-4" />}
            loading={busy}
            disabled={!form.firstName.trim() || !form.lastName.trim() || !form.momoNumber.trim() || !form.accept || !form.signatureImage || !(sameName(form.signature, `${form.firstName} ${form.lastName}`) || sameName(form.signature, `${form.lastName} ${form.firstName}`))}
            onClick={() => void run(() => api.ambassadorApply({ ...form, contractVersion: AMBASSADOR_CONTRACT_VERSION }))}
          >
            {t('Signer et envoyer ma demande')}</Button>
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
  const changing = info.numberChange?.status === 'requested';
  const canWithdraw = e.available >= r.minPayout && !e.requested && !changing;
  const addDocs = async (files: FileList | null) => {
    setError(null);
    try {
      const list = [...(files ?? [])];
      if (list.some((f) => !/^image\/|application\/pdf/.test(f.type))) throw new Error(t('Ajoutez des photos ou des PDF uniquement.'));
      const docs = await Promise.all(list.map((f) => fileToAttachment(f)));
      if (docs.some((d) => d.size > 3 * 1024 * 1024)) throw new Error(t('Chaque fichier doit faire moins de 3 Mo.'));
      setChange((c) => ({ ...c, docs: [...c.docs, ...docs.map(({ name, mediaType, data }) => ({ name, mediaType, data }))].slice(0, 4) }));
    } catch (err) {
      setError((err as Error).message);
    }
  };
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      {header}
      {info.inactivityWarning && (
        <Notice tone="warn">
          {t('Aucun nouveau filleul ni gain depuis 11 mois : sans activité d’ici le {0}, votre contrat prendra fin et les gains non retirés seront perdus. Un ami qui s’inscrit par votre lien suffit.', [day(info.inactivityWarning)])}
        </Notice>
      )}
      {info.contract && !info.contract.current && (
        <Card title={t('Nouvelle version du contrat à signer')} subtitle={t('Le contrat Ambassadeur a changé. Lisez-le et signez-le pour continuer à gagner.')}>
          <Contract r={r} />
          <label className="mt-3 flex min-h-11 items-start gap-2.5 text-sm text-slate-800">
            <input type="checkbox" className="mt-1 size-4 accent-brand-600" checked={form.accept} onChange={(ev) => setForm({ ...form, accept: ev.target.checked })} />
            <span>{t('J’ai lu le contrat Ambassadeur et je l’accepte.')}</span>
          </label>
          <Field className="mt-2" label={t('Signature : tapez vos prénoms et votre nom')} value={form.signature} onChange={(v) => setForm({ ...form, signature: v.slice(0, 120) })} placeholder={info.momoName} />
          <p className="mt-3 mb-1 text-sm font-medium text-slate-700">{t('Signez dans le cadre, au doigt ou à la souris')}</p>
          <SignaturePad value={form.signatureImage || null} onChange={(v) => setForm((f) => ({ ...f, signatureImage: v ?? '' }))} />
          {error && <div className="mt-3"><Notice tone="error">{error}</Notice></div>}
          <Button
            className="mt-3"
            icon={<FileSignature className="size-4" />}
            loading={busy}
            disabled={!form.accept || !form.signatureImage || !sameName(form.signature, info.momoName)}
            onClick={() =>
              void run(() =>
                api.ambassadorApply({
                  firstName: info.legalFirstName,
                  lastName: info.legalLastName,
                  momoNumber: info.momoNumber,
                  motivation: '',
                  accept: form.accept,
                  signature: form.signature,
                  signatureImage: form.signatureImage,
                  contractVersion: AMBASSADOR_CONTRACT_VERSION,
                }),
              )
            }
          >
            {t('Signer la nouvelle version')}</Button>
        </Card>
      )}
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
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
          <Button icon={<Share2 className="size-4" />} onClick={() => void share()}>
            {t('Partager mon lien')}</Button>
          {codeEdit === null && (
            <button type="button" onClick={() => setCodeEdit(info.code)} className="min-h-11 text-sm font-semibold text-brand-700">
              {t('Personnaliser mon code')}</button>
          )}
        </div>
        <p className="mt-2 text-sm text-slate-600">{t('Votre code : {0}. Vos amis peuvent aussi le taper à l’inscription.', [info.code])}</p>
        {codeEdit !== null && (
          <div className="mt-3 space-y-2 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
            <Field
              label={t('Votre code personnalisé')}
              value={codeEdit}
              onChange={(v) => setCodeEdit(v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12))}
              placeholder="AWA229"
              hint={t('4 à 12 lettres ou chiffres. Vos anciens liens continuent de marcher. 3 changements au plus.')}
            />
            {codeError && <Notice tone="error">{codeError}</Notice>}
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                loading={busy}
                disabled={codeEdit.length < 4 || codeEdit === info.code}
                onClick={() => {
                  setCodeError(null);
                  setBusy(true);
                  void api
                    .ambassadorCode(codeEdit)
                    .then((r2) => {
                      setInfo(r2);
                      setCodeEdit(null);
                    })
                    .catch((e) => setCodeError(e instanceof ApiError ? e.message : t('Une erreur est survenue. Réessayez.')))
                    .finally(() => setBusy(false));
                }}
              >
                {t('Enregistrer')}</Button>
              <Button size="sm" variant="ghost" onClick={() => { setCodeEdit(null); setCodeError(null); }}>
                {t('Annuler')}</Button>
            </div>
          </div>
        )}
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

      <Card tour="ambassador-payout" title={t('Retirer mes gains')} subtitle={t('Vers {0}, au nom de {1}.', [info.momoNumber, info.momoName])}>
        {error && <div className="mb-3"><Notice tone="error">{error}</Notice></div>}
        <Button icon={<Wallet className="size-4" />} loading={busy} disabled={!canWithdraw} onClick={() => void run(() => api.ambassadorPayout())}>
          {t('Demander mon retrait')}</Button>
        <p className="mt-2 text-sm text-slate-600">
          {e.requested
            ? t('Votre retrait de {0} est en cours : vous le recevez sous quelques jours.', [fcfa(e.requested)])
            : e.available >= r.minPayout
              ? t('{0} disponibles : vous recevrez {1} après les frais d’envoi Mobile Money.', [fcfa(e.available), fcfa(e.available - Math.ceil((e.available * r.payoutFeePercent) / 100))])
              : t('Encore {0} à gagner avant le prochain retrait.', [fcfa(r.minPayout - e.available)])}
        </p>
        {info.payouts.length > 0 && (
          <ul className="mt-3 divide-y divide-slate-100 text-sm">
            {info.payouts.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-x-2 py-2">
                <span>{day(p.requestedAt)}</span>
                <span className="font-semibold">{fcfa(p.net)}</span>
                <span className={cx('rounded-full px-2 py-0.5 text-xs font-semibold', p.status === 'paid' ? 'bg-emerald-100 text-emerald-900' : p.status === 'refused' ? 'bg-red-50 text-red-800' : 'bg-sun-100 text-sun-900')}>
                  {p.status === 'paid' ? t('Reçu') : p.status === 'refused' ? t('Refusé') : t('En cours')}
                </span>
                {p.status === 'refused' && p.note && <span className="basis-full text-xs text-slate-500">{p.note}</span>}
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4 border-t border-slate-100 pt-3">
          {changing ? (
            <Notice>{t('Changement de numéro vers {0} en cours d’examen. Les retraits reprendront ensuite.', [info.numberChange!.newNumber])}</Notice>
          ) : !change.open ? (
            <button type="button" onClick={() => setChange({ open: true, number: '', docs: [] })} className="min-h-11 text-sm font-semibold text-brand-700">
              {t('Changer de numéro Mobile Money')}</button>
          ) : (
            <div className="space-y-3">
              {info.numberChange?.status === 'refused' && (
                <Notice tone="warn">
                  {t('Votre dernière demande de changement a été refusée. Vérifiez vos justificatifs.')}
                  {info.numberChange.note && ` (${info.numberChange.note})`}
                </Notice>
              )}
              <p className="text-sm text-slate-600">{t('Pour votre sécurité, le nouveau numéro doit être à votre nom ({0}). Joignez une photo de votre pièce d’identité et une capture montrant le nom du titulaire du compte Mobile Money.', [info.momoName])}</p>
              <Field label={t('Nouveau numéro Mobile Money')} value={change.number} onChange={(v) => setChange({ ...change, number: v.slice(0, 20) })} autoComplete="tel" />
              <label className="flex min-h-11 w-fit cursor-pointer items-center gap-2 rounded-xl bg-slate-100 px-3 text-sm font-semibold text-slate-800 hover:bg-slate-200">
                <FileUp className="size-4" aria-hidden="true" /> {t('Ajouter les justificatifs')}
                <input type="file" accept="image/*,application/pdf" multiple className="sr-only" onChange={(ev) => void addDocs(ev.target.files)} />
              </label>
              {change.docs.length > 0 && (
                <ul className="space-y-1 text-sm">
                  {change.docs.map((d, i) => (
                    <li key={i} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-1.5">
                      <span className="truncate">{d.name}</span>
                      <button type="button" aria-label={t('Retirer {0}', [d.name])} className="flex size-9 items-center justify-center" onClick={() => setChange({ ...change, docs: change.docs.filter((_, j) => j !== i) })}>
                        <X className="size-4" aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex flex-wrap gap-2">
                <Button loading={busy} disabled={change.number.replace(/\D/g, '').length < 8 || change.docs.length < 2} onClick={() => void run(() => api.ambassadorNumber(change.number, change.docs)).then((ok) => ok && setChange({ open: false, number: '', docs: [] }))}>
                  {t('Envoyer la demande')}</Button>
                <Button variant="ghost" onClick={() => setChange({ open: false, number: '', docs: [] })}>
                  {t('Annuler')}</Button>
              </div>
            </div>
          )}
        </div>
        <div className="mt-4 flex items-start gap-2">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-slate-400" aria-hidden="true" />
          <Fine r={r} />
        </div>
      </Card>
      {info.contract && (
        <Card title={t('Votre contrat')} subtitle={t('Signé le {0} par {1} (version {2}).', [day(info.contract.signedAt), info.momoName, info.contract.version])}>
          <button
            type="button"
            onClick={() => {
              setShowContract(!showContract);
              if (!signature) void api.ambassadorContract().then((c) => setSignature(c.signatureImage)).catch(() => {});
            }}
            className="min-h-11 text-sm font-semibold text-brand-700"
          >
            {showContract ? t('Masquer le contrat') : t('Lire le contrat')}</button>
          {showContract && (
            <>
              <Contract r={r} />
              {signature && (
                <div className="mt-3 flex items-end gap-3 text-sm text-slate-600">
                  <span>{t('Signature :')}</span>
                  <img src={signature} alt={t('Votre signature')} className="h-14 rounded bg-white px-2 ring-1 ring-slate-200" />
                </div>
              )}
            </>
          )}
        </Card>
      )}
      <div className="px-1 pb-2">
        <button
          type="button"
          className="min-h-11 text-sm font-semibold text-slate-500 hover:text-red-700"
          onClick={() => {
            const lost = info.earnings.available + info.earnings.pending;
            const msg =
              info.earnings.available >= r.minPayout
                ? t('Demandez d’abord le retrait de vos {0} disponibles.', [fcfa(info.earnings.available)])
                : t('Quitter le programme ? Votre lien ne rapportera plus rien et vos gains non retirés ({0}) seront perdus. Vous pourrez refaire une demande plus tard.', [fcfa(lost)]);
            if (info.earnings.available >= r.minPayout) {
              window.alert(msg);
              return;
            }
            if (window.confirm(msg)) void run(() => api.ambassadorLeave());
          }}
        >
          {t('Quitter le programme')}</button>
      </div>
    </div>
  );
}
