import { useState } from 'react';
import { ClipboardList, Eye, MessagesSquare, PartyPopper, Plus, Trash2 } from 'lucide-react';
import { useActiveCv, useStore } from '../store.ts';
import { api, ApiError } from '../lib/api.ts';
import type { Application, ApplicationStatus } from '../types.ts';
import { InterviewSheet } from '../components/InterviewSheet.tsx';
import { Button, Card, cx, Field, Notice, TextArea, Toggle } from '../components/ui.tsx';
import type { Tab } from '../App.tsx';

export const STATUSES: { id: ApplicationStatus; label: string; tone: string }[] = [
  { id: 'preparation', label: 'En préparation', tone: 'bg-slate-100 text-slate-700' },
  { id: 'envoyee', label: 'Envoyée', tone: 'bg-sky-100 text-sky-800' },
  { id: 'entretien', label: 'Entretien', tone: 'bg-violet-100 text-violet-800' },
  { id: 'offre', label: 'Acceptée', tone: 'bg-emerald-100 text-emerald-800' },
  { id: 'refus', label: 'Refusée', tone: 'bg-rose-100 text-rose-800' },
];

/** Candidature acceptée : on félicite, et on propose (sans insister) de témoigner sur le site. */
function HiredPanel({ app }: { app: Application }) {
  const { updateApplication } = useStore.getState();
  const cv = useActiveCv();
  const linkedCv = useStore((s) => s.cvs.find((c) => c.id === app.cvId));
  const [form, setForm] = useState({
    firstName: (linkedCv ?? cv).personal.firstName,
    jobTitle: app.title === 'Nouvelle candidature' ? '' : app.title,
    company: app.company,
    city: app.location,
    message: '',
  });
  const [consent, setConsent] = useState(false);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof form) => (v: string) => setForm({ ...form, [k]: v });

  if (app.testimonial === 'declined') return null;

  if (app.testimonial) {
    const { id, secret } = app.testimonial;
    return (
      <div className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">
        Merci pour votre témoignage ! Il apparaîtra sur le site après vérification.{' '}
        <button
          type="button"
          className="font-semibold underline"
          disabled={busy}
          onClick={async () => {
            if (!window.confirm('Retirer votre témoignage du site ?')) return;
            setBusy(true);
            try {
              await api.withdrawTestimonial(id, secret);
            } catch (e) {
              // Déjà retiré ou refusé : il n'est de toute façon pas en ligne.
              if (!(e instanceof ApiError && /introuvable/.test(e.message))) {
                window.alert(e instanceof Error ? e.message : 'Erreur inattendue.');
                setBusy(false);
                return;
              }
            }
            updateApplication(app.id, { testimonial: 'declined' });
          }}
        >
          Le retirer
        </button>
      </div>
    );
  }

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      const res = await api.submitTestimonial({ ...form, consent: true });
      updateApplication(app.id, { testimonial: res });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur inattendue.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
      <p className="flex items-center gap-2 font-semibold text-emerald-900">
        <PartyPopper className="size-5" /> Félicitations pour ce poste !
      </p>
      {!open ? (
        <>
          <p className="mt-1 text-sm text-emerald-900">Votre réussite peut motiver d’autres candidats. Acceptez-vous de la partager sur le site CVCasa ?</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" onClick={() => setOpen(true)}>
              Oui, je témoigne
            </Button>
            <Button size="sm" variant="ghost" onClick={() => updateApplication(app.id, { testimonial: 'declined' })}>
              Non merci
            </Button>
          </div>
        </>
      ) : (
        <div className="mt-3 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Prénom" value={form.firstName} onChange={set('firstName')} />
            <Field label="Poste obtenu" value={form.jobTitle} onChange={set('jobTitle')} />
            <Field label="Entreprise" value={form.company} onChange={set('company')} />
            <Field label="Ville" value={form.city} onChange={set('city')} />
          </div>
          <TextArea label="Un mot sur votre expérience (facultatif)" value={form.message} onChange={set('message')} rows={2} placeholder="Ex. Le CV adapté m’a permis d’obtenir l’entretien en une semaine." />
          <Toggle
            label="J’accepte que mon prénom, mon poste, l’entreprise, la ville et mon message apparaissent sur le site CVCasa."
            hint="Seul votre prénom est affiché, jamais votre nom ni vos coordonnées. Vous pourrez retirer votre témoignage à tout moment depuis cette page."
            checked={consent}
            onChange={setConsent}
          />
          {error && <Notice tone="error">{error}</Notice>}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" loading={busy} disabled={!consent || !form.firstName.trim() || !form.jobTitle.trim() || !form.company.trim()} onClick={submit}>
              Envoyer mon témoignage
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
              Annuler
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function ApplicationCard({ app, onNavigate }: { app: Application; onNavigate: (t: Tab) => void }) {
  const { updateApplication, deleteApplication, setActive } = useStore.getState();
  const cvExists = useStore((s) => s.cvs.some((c) => c.id === app.cvId));
  const [open, setOpen] = useState(false);
  const [showInterview, setShowInterview] = useState(false);
  const status = STATUSES.find((s) => s.id === app.status) ?? STATUSES[0];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-slate-900">{app.title}</p>
          <p className="truncate text-sm text-slate-500">{[app.company, app.location].filter(Boolean).join(' · ') || 'Entreprise non précisée'}</p>
        </div>
        <span className={cx('shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold', status.tone)}>{status.label}</span>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {STATUSES.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => updateApplication(app.id, { status: s.id })}
            className={cx(
              'rounded-full border px-2.5 py-1 text-xs font-medium transition',
              app.status === s.id ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-200 text-slate-600 hover:bg-slate-50',
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      {app.status === 'offre' && <HiredPanel app={app} />}

      {app.score && (
        <p className="mt-3 text-sm text-slate-600">
          Compatibilité : <strong>{Math.round(app.score.before)}</strong> → <strong className="text-emerald-700">{Math.round(app.score.after)}</strong> / 100
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {app.cvId && cvExists && (
          <Button
            variant="secondary"
            size="sm"
            icon={<Eye className="size-4" />}
            onClick={() => {
              setActive(app.cvId!);
              onNavigate('apercu');
            }}
          >
            CV adapté
          </Button>
        )}
        {app.interview && (
          <Button variant="secondary" size="sm" icon={<MessagesSquare className="size-4" />} onClick={() => setShowInterview(!showInterview)}>
            {showInterview ? 'Masquer la fiche entretien' : 'Fiche entretien'}
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={() => setOpen(!open)}>
          {open ? 'Fermer' : 'Notes et date'}
        </Button>
      </div>

      {showInterview && app.interview && (
        <div className="mt-4 border-t border-slate-100 pt-4">
          <InterviewSheet sheet={app.interview} title={app.title} />
        </div>
      )}

      {open && (
        <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Poste" value={app.title} onChange={(title) => updateApplication(app.id, { title })} />
            <Field label="Entreprise" value={app.company} onChange={(company) => updateApplication(app.id, { company })} />
            <Field
              label="Date (envoi, entretien…)"
              value={app.date}
              onChange={(date) => updateApplication(app.id, { date })}
              placeholder="Ex. Entretien le 12/11 à 10 h"
            />
            <Field label="Lieu" value={app.location} onChange={(location) => updateApplication(app.id, { location })} />
          </div>
          <TextArea
            label="Notes"
            value={app.notes}
            onChange={(notes) => updateApplication(app.id, { notes })}
            rows={3}
            placeholder="Nom du recruteur, documents envoyés, relance prévue…"
          />
          <Button
            variant="danger"
            size="sm"
            icon={<Trash2 className="size-4" />}
            onClick={() => {
              if (window.confirm(`Supprimer la candidature « ${app.title} » ?`)) deleteApplication(app.id);
            }}
          >
            Supprimer
          </Button>
        </div>
      )}
      {!open && app.date && <p className="mt-2 text-xs text-slate-500">{app.date}</p>}
    </div>
  );
}

export function ApplicationsPage({ onNavigate }: { onNavigate: (t: Tab) => void }) {
  const applications = useStore((s) => s.applications);
  const addApplication = useStore((s) => s.addApplication);
  const [filter, setFilter] = useState<ApplicationStatus | 'all'>('all');
  const shown = filter === 'all' ? applications : applications.filter((a) => a.status === filter);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Card
        tour="applications"
        title={
          <span className="flex items-center gap-2">
            <ClipboardList className="size-5 text-brand-600" /> Mes candidatures
          </span>
        }
        subtitle="Suivez chaque offre : CV adapté, fiche entretien, réponse. Tout reste sur votre appareil."
        actions={
          <Button size="sm" icon={<Plus className="size-4" />} onClick={() => addApplication({ title: 'Nouvelle candidature' })}>
            Ajouter
          </Button>
        }
      >
        <div className="grid grid-cols-3 gap-2 text-center sm:grid-cols-5">
          {STATUSES.map((s) => {
            const n = applications.filter((a) => a.status === s.id).length;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setFilter(filter === s.id ? 'all' : s.id)}
                className={cx('rounded-xl border p-2 transition', filter === s.id ? 'border-brand-500 bg-brand-50' : 'border-slate-200 hover:bg-slate-50')}
              >
                <p className="text-xl font-bold text-slate-900 tabular-nums">{n}</p>
                <p className="text-xs text-slate-500">{s.label}</p>
              </button>
            );
          })}
        </div>
      </Card>

      {applications.length === 0 && (
        <Notice tone="info">
          Aucune candidature pour l’instant. Elles s’ajoutent toutes seules quand vous adaptez votre CV à une offre ou préparez un entretien.{' '}
          <button type="button" className="hit font-semibold underline" onClick={() => onNavigate('offre')}>
            Ajouter une offre
          </button>
        </Notice>
      )}

      <div className="space-y-3">
        {shown.map((a) => (
          <ApplicationCard key={a.id} app={a} onNavigate={onNavigate} />
        ))}
      </div>
    </div>
  );
}
