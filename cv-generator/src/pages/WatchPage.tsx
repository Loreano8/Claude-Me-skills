import { useEffect, useMemo, useState } from 'react';
import { BellRing, CalendarClock, ExternalLink, Plus, Search, Target, X } from 'lucide-react';
import type { Tab } from '../App.tsx';
import { useActiveCv, useStore } from '../store.ts';
import { useAccount } from '../lib/account.ts';
import { api, ApiError } from '../lib/api.ts';
import type { CvDocument } from '../types.ts';
import { WATCH_PRICE, type WatchCriteria, type WatchFrequency, type WatchOffer, type WatchRun, type WatchState } from '../../shared/schema.ts';
import { Button, Card, Cost, cx, Field, Notice } from '../components/ui.tsx';

import { LANG, LOCALE, t } from '../i18n.ts';
// Veille emploi : on coche, on remplit deux ou trois cases, et les offres arrivent toutes seules.

const CONTRACTS: { id: WatchCriteria['contracts'][number]; label: string }[] = [
  { id: 'cdi', label: 'CDI' },
  { id: 'cdd', label: 'CDD' },
  { id: 'stage', label: t('Stage') },
  { id: 'freelance', label: t('Freelance, mission') },
  { id: 'teletravail', label: t('Télétravail') },
  { id: 'programme', label: t('Programmes jeunes, bourses') },
];
const ZONES: { id: WatchCriteria['zones'][number]; label: string }[] = [
  { id: 'benin', label: t('Bénin') },
  { id: 'afrique-ouest', label: t('Afrique de l’Ouest') },
  { id: 'afrique', label: t('Reste de l’Afrique') },
  { id: 'international', label: t('Télétravail international') },
];
const LEVELS: { id: WatchCriteria['level']; label: string }[] = [
  { id: 'debutant', label: t('Débutant') },
  { id: 'confirme', label: t('Confirmé') },
  { id: 'tous', label: t('Peu importe') },
];
const SALARIES = [0, 50_000, 100_000, 200_000, 300_000, 500_000];

const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

/** Ce que le serveur garde du CV : de quoi dire « vous avez déjà ces compétences », rien de plus. */
export function cvProfile(cv: CvDocument): string {
  return [
    cv.personal.title,
    cv.experiences.map((e) => e.position).filter(Boolean).join(', '),
    cv.skills.join(', '),
    cv.softSkills.join(', '),
    cv.languages.map((l) => l.name).join(', '),
    cv.certifications.map((c) => c.name).join(', '),
  ]
    .filter((s) => s.trim())
    .join('. ')
    .slice(0, 2_000);
}

function defaultCriteria(cv: CvDocument, email: string): WatchCriteria {
  const jobs = [...new Set([cv.personal.title, ...cv.experiences.map((e) => e.position)].map((s) => s.trim()).filter((s) => s.length >= 2))].slice(0, 3);
  return { jobs, contracts: ['cdi', 'cdd'], zones: ['benin'], level: 'tous', minSalary: 0, keywords: '', email };
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cx(
        'inline-flex min-h-11 items-center gap-1.5 rounded-full px-4 text-sm font-semibold ring-1 transition',
        on ? 'bg-brand-600 text-white ring-brand-600' : 'bg-white text-slate-700 ring-slate-300 hover:ring-slate-400',
      )}
    >
      {children}
    </button>
  );
}

function Group({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <fieldset className="min-w-0 space-y-2">
      <legend className="text-sm font-semibold text-slate-900">{title}</legend>
      {hint && <p className="-mt-1 text-xs text-slate-500">{hint}</p>}
      <div className="flex flex-wrap gap-2">{children}</div>
    </fieldset>
  );
}

const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
const day = (iso: string) => new Date(iso).toLocaleDateString(LOCALE, { weekday: 'long', day: 'numeric', month: 'long' });

function OfferCard({ offer, onAdapt }: { offer: WatchOffer; onAdapt: () => void }) {
  const facts = [offer.location, offer.contract, offer.salary, offer.experience].filter(Boolean);
  return (
    <li className="rounded-2xl border border-slate-200 bg-white p-4">
      <h3 className="font-semibold text-slate-900">{offer.title}</h3>
      {offer.company && <p className="text-sm text-slate-600">{offer.company}</p>}
      {facts.length > 0 && <p className="mt-1 text-sm text-slate-600">{facts.join(' · ')}</p>}
      <div className="mt-2 flex flex-wrap gap-1.5 text-xs font-semibold">
        {offer.deadline && <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">{t('Date limite : {0}', [offer.deadline])}</span>}
        {offer.beninEligible === 'oui' && <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-emerald-900">{t('Ouvert depuis le Bénin')}</span>}
        {offer.beninEligible === 'à vérifier' && <span className="rounded-full bg-sun-100 px-2.5 py-1 text-sun-900">{t('Depuis le Bénin : à vérifier')}</span>}
        {offer.beninEligible === 'non' && <span className="rounded-full bg-red-50 px-2.5 py-1 text-red-800">{t('Pas ouvert depuis le Bénin')}</span>}
      </div>
      {offer.summary && <p className="mt-2 text-sm leading-relaxed text-slate-700">{offer.summary}</p>}
      {offer.matched.length > 0 && (
        <p className="mt-2 text-sm text-emerald-800">
          <span className="font-semibold">{t('Vous avez déjà :')}</span> {offer.matched.join(', ')}
        </p>
      )}
      {offer.missing.length > 0 && (
        <p className="mt-1 text-sm text-amber-800">
          <span className="font-semibold">{t('À mettre en avant ou à renforcer :')}</span> {offer.missing.join(', ')}
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <a
          href={offer.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-white px-4 text-sm font-medium text-slate-800 ring-1 ring-slate-300 hover:bg-slate-50"
        >
          <ExternalLink className="size-4" aria-hidden="true" /> {' '}{t('Voir l’offre')}</a>
        <Button icon={<Target className="size-4" />} onClick={onAdapt}>
          {t('Adapter mon CV à cette offre')}</Button>
      </div>
    </li>
  );
}

function RunList({ run, onAdapt }: { run: WatchRun; onAdapt: (o: WatchOffer) => void }) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">
        <span className="font-semibold text-slate-800">{t('Le {0}', [day(run.createdAt)])}</span>
        {run.note ? ` · ${run.note}` : ''}
      </p>
      {run.offers.length ? (
        <ul className="space-y-3">
          {run.offers.map((o) => (
            <OfferCard key={o.url} offer={o} onAdapt={() => onAdapt(o)} />
          ))}
        </ul>
      ) : (
        <Notice>{t('Rien de nouveau pour le moment. La veille garde vos critères et vous prévient dès qu’une offre sort.')}</Notice>
      )}
    </div>
  );
}

export function WatchPage({ onNavigate }: { onNavigate: (t: Tab) => void }) {
  const cv = useActiveCv();
  const setJob = useStore((s) => s.setJob);
  const user = useAccount((s) => s.user);
  const openAccount = useAccount((s) => s.open);
  const [loaded, setLoaded] = useState(false);
  const [available, setAvailable] = useState(true);
  const [watch, setWatch] = useState<WatchState | null>(null);
  const [runs, setRuns] = useState<WatchRun[]>([]);
  const [criteria, setCriteria] = useState<WatchCriteria>(() => defaultCriteria(cv, ''));
  const [frequency, setFrequency] = useState<WatchFrequency>('daily');
  const [newJob, setNewJob] = useState('');
  const [busy, setBusy] = useState<'run' | 'start' | 'stop' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    api
      .watchGet()
      .then((r) => {
        if (!alive) return;
        setAvailable(r.available);
        setWatch(r.watch);
        setRuns(r.runs);
        if (r.watch) {
          setCriteria(r.watch.criteria);
          setFrequency(r.watch.frequency);
        } else if (user && isEmail(user.identifier)) {
          setCriteria((c) => ({ ...c, email: c.email || user.identifier }));
        }
      })
      .catch(() => alive && setAvailable(false))
      .finally(() => alive && setLoaded(true));
    return () => {
      alive = false;
    };
  }, [user]);

  const set = <K extends keyof WatchCriteria>(k: K, v: WatchCriteria[K]) => setCriteria((c) => ({ ...c, [k]: v }));
  const missing = !criteria.jobs.length ? t('Ajoutez au moins un métier.') : !criteria.contracts.length ? t('Cochez au moins un type de contrat.') : !criteria.zones.length ? t('Cochez au moins une zone.') : null;
  const freeRun = !watch?.freeRunUsed;
  const latest = runs[0] ?? null;
  const older = useMemo(() => runs.slice(1, 6), [runs]);

  function addJob() {
    const v = newJob.trim();
    if (v.length < 2 || criteria.jobs.length >= 5 || criteria.jobs.some((j) => j.toLowerCase() === v.toLowerCase())) return;
    set('jobs', [...criteria.jobs, v.slice(0, 60)]);
    setNewJob('');
  }

  async function save() {
    const { watch: saved } = await api.watchSave({ criteria: { ...criteria, email: criteria.email.trim(), lang: LANG }, profile: cvProfile(cv), frequency });
    setWatch(saved);
    return saved;
  }

  async function act(kind: 'run' | 'start' | 'stop') {
    if (!user) {
      openAccount('account', t('Créez un compte gratuit pour lancer votre veille emploi : les offres vous attendront ici et dans vos e-mails.'));
      return;
    }
    setBusy(kind);
    setError(null);
    setMessage(null);
    try {
      if (kind === 'stop') {
        await api.watchStop();
        setWatch((w) => (w ? { ...w, active: false, nextRunAt: null } : w));
        setMessage(t('Veille arrêtée. Vos critères restent enregistrés.'));
        return;
      }
      await save();
      if (kind === 'run') {
        const { run } = await api.watchRun();
        setRuns((r) => [run, ...r]);
        setWatch((w) => (w ? { ...w, freeRunUsed: true } : w));
        setTimeout(() => document.getElementById('veille-resultats')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
      } else {
        const { watch: started } = await api.watchStart();
        setWatch(started);
        setMessage(t('C’est parti : prochain envoi {0}, vers 7 h 30.', [started.nextRunAt ? day(started.nextRunAt) : t('bientôt')]));
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t('Une erreur est survenue. Réessayez.'));
    } finally {
      setBusy(null);
    }
  }

  function adapt(o: WatchOffer) {
    setJob({ text: [`${o.title}${o.company ? ` – ${o.company}` : ''}`, [o.location, o.contract, o.salary].filter(Boolean).join(' · '), o.summary, o.skills.length ? t('Compétences demandées : {0}', [o.skills.join(', ')]) : ''].filter(Boolean).join('\n'), file: null });
    onNavigate('offre');
  }

  if (loaded && !available) {
    return (
      <div className="mx-auto max-w-2xl">
        <Notice>{t('La veille emploi n’est pas encore disponible ici. Réessayez un peu plus tard.')}</Notice>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="px-1">
        <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl">{t('Veille emploi')}</h1>
        <p className="mt-1 text-slate-600">{t('Cochez ce que vous cherchez. CVCasa cherche les offres sur internet et vous les envoie, chaque matin ou chaque semaine.')}</p>
      </div>

      {watch?.active && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-emerald-50 p-4 ring-1 ring-emerald-200">
          <BellRing className="size-5 shrink-0 text-emerald-700" aria-hidden="true" />
          <p className="min-w-0 flex-1 text-sm text-emerald-900">
            <span className="font-semibold">{t('Votre veille est active')}</span> ({watch.frequency === 'daily' ? t('chaque matin') : t('chaque semaine')}).
            {watch.nextRunAt && t(' Prochain envoi : {0}, vers 7 h 30.', [day(watch.nextRunAt)])}
          </p>
          <Button variant="ghost" size="sm" loading={busy === 'stop'} onClick={() => act('stop')}>
            {t('Arrêter')}</Button>
        </div>
      )}

      <Card tour="watch-criteria" title={t('Ce que vous cherchez')}>
        <div className="space-y-5">
          <Group title={t('Métiers ou domaines')} hint={t('Repris de votre CV. Ajoutez-en ou retirez-en (5 au plus).')}>
            {criteria.jobs.map((j) => (
              <span key={j} className="inline-flex min-h-11 items-center gap-1 rounded-full bg-brand-50 pr-1 pl-4 text-sm font-semibold text-brand-800 ring-1 ring-brand-200">
                {j}
                <button type="button" aria-label={`Retirer ${j}`} onClick={() => set('jobs', criteria.jobs.filter((x) => x !== j))} className="flex size-9 items-center justify-center rounded-full hover:bg-brand-100">
                  <X className="size-4" />
                </button>
              </span>
            ))}
            {criteria.jobs.length < 5 && (
              <form
                className="flex w-full gap-2 sm:w-auto"
                onSubmit={(e) => {
                  e.preventDefault();
                  addJob();
                }}
              >
                <input
                  value={newJob}
                  onChange={(e) => setNewJob(e.target.value)}
                  placeholder={t('Ex. Comptable, Chauffeur, Développeur web')}
                  aria-label={t('Ajouter un métier')}
                  className="min-h-11 min-w-0 flex-1 rounded-xl border border-slate-300 px-3 text-sm sm:w-64"
                />
                <Button type="submit" variant="secondary" className="shrink-0" icon={<Plus className="size-4" />} disabled={newJob.trim().length < 2}>
                  {t('Ajouter')}</Button>
              </form>
            )}
          </Group>

          <Group title={t('Types de contrat')}>
            {CONTRACTS.map((c) => (
              <Chip key={c.id} on={criteria.contracts.includes(c.id)} onClick={() => set('contracts', toggle(criteria.contracts, c.id))}>
                {c.label}
              </Chip>
            ))}
          </Group>

          <Group title={t('Où ?')}>
            {ZONES.map((z) => (
              <Chip key={z.id} on={criteria.zones.includes(z.id)} onClick={() => set('zones', toggle(criteria.zones, z.id))}>
                {z.label}
              </Chip>
            ))}
          </Group>

          <Group title={t('Votre niveau')}>
            {LEVELS.map((l) => (
              <Chip key={l.id} on={criteria.level === l.id} onClick={() => set('level', l.id)}>
                {l.label}
              </Chip>
            ))}
          </Group>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="watch-salary" className="mb-1 block text-sm font-semibold text-slate-900">
                {t('Salaire minimum par mois')}</label>
              <select
                id="watch-salary"
                value={criteria.minSalary}
                onChange={(e) => set('minSalary', Number(e.target.value))}
                className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm"
              >
                {SALARIES.map((s) => (
                  <option key={s} value={s}>
                    {s ? `${s.toLocaleString(LOCALE)} FCFA` : t('Peu importe')}
                  </option>
                ))}
              </select>
            </div>
            <Field label={t('Mots-clés en plus (facultatif)')} value={criteria.keywords} onChange={(v) => set('keywords', v.slice(0, 200))} placeholder={t('Ex. ONG, banque, Excel')} />
          </div>
          <Field
            label={t('E-mail pour recevoir les offres')}
            type="email"
            value={criteria.email}
            onChange={(v) => set('email', v.slice(0, 120))}
            placeholder="prenom.nom@email.com"
            hint={t('Facultatif si vous regardez les offres ici. Rien d’autre ne sera envoyé à cette adresse.')}
          />
        </div>
      </Card>

      <Card tour="watch-run" title={t('Voir les offres')}>
        <p className="text-sm text-slate-600">{t('La recherche prend environ une minute. {0}', [freeRun ? t('La première est offerte.') : ''])}</p>
        <div className="mt-3">
          <Button size="lg" icon={<Search className="size-5" />} loading={busy === 'run'} disabled={busy !== null || Boolean(missing)} onClick={() => act('run')}>
            {t('Chercher maintenant')}{' '}<Cost free={freeRun} />
          </Button>
        </div>
        {busy === 'run' && <p className="mt-3 text-sm text-brand-700">{t('Recherche des offres sur internet… gardez la page ouverte.')}</p>}
      </Card>

      {latest && (
        <section id="veille-resultats" className="scroll-mt-24 space-y-3">
          <h2 className="px-1 font-display text-xl font-semibold text-ink">{t('Vos offres')}</h2>
          <RunList run={latest} onAdapt={adapt} />
          <p className="px-1 text-xs text-slate-500">{t('Vérifiez toujours l’offre sur le site de l’employeur avant de postuler. Aucun recruteur sérieux ne demande d’argent.')}</p>
        </section>
      )}

      <Card tour="watch-auto" title={t('Recevoir les offres automatiquement')}>
        <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label={t('Fréquence')}>
          {(['daily', 'weekly'] as const).map((f) => (
            <button
              key={f}
              type="button"
              role="radio"
              aria-checked={frequency === f}
              onClick={() => setFrequency(f)}
              className={cx('flex min-h-16 items-start gap-3 rounded-xl p-3 text-left ring-1 transition', frequency === f ? 'bg-brand-50 ring-2 ring-brand-600' : 'bg-white ring-slate-300 hover:ring-slate-400')}
            >
              <CalendarClock className={cx('mt-0.5 size-5 shrink-0', frequency === f ? 'text-brand-700' : 'text-slate-500')} aria-hidden="true" />
              <span>
                <span className="block font-semibold text-slate-900">{f === 'daily' ? t('Chaque matin, vers 7 h 30') : t('Une fois par semaine')}</span>
                <span className="block text-sm text-slate-600">
                  {t('{0} crédit{1} pour 7 jours', [WATCH_PRICE[f], WATCH_PRICE[f] > 1 ? 's' : ''])}</span>
              </span>
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-slate-500">{t('Les offres arrivent ici et par e-mail. Seules les nouvelles offres sont envoyées. Arrêt possible à tout moment.')}</p>
        <div className="mt-3">
          <Button
            icon={<BellRing className="size-4" />}
            loading={busy === 'start'}
            disabled={busy !== null || Boolean(missing) || (watch?.active && watch.frequency === frequency)}
            onClick={() => act('start')}
          >
            {watch?.active ? (watch.frequency === frequency ? t('Veille active') : t('Changer la fréquence')) : t('Activer ma veille')}
            {!(watch?.active && watch.frequency === frequency) && <Cost n={WATCH_PRICE[frequency]} />}
          </Button>
        </div>
      </Card>

      {missing && <Notice tone="warn">{missing}</Notice>}
      {error && <Notice tone="error">{error}</Notice>}
      {message && <Notice tone="success">{message}</Notice>}

      {older.length > 0 && (
        <details className="rounded-2xl border border-slate-200 bg-white p-4">
          <summary className="min-h-11 cursor-pointer content-center font-semibold text-slate-800">{t('Envois précédents')}</summary>
          <div className="mt-3 space-y-6">
            {older.map((r) => (
              <RunList key={r.id} run={r} onAdapt={adapt} />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
