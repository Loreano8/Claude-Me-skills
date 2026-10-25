import { useState } from 'react';
import { ClipboardList, Eye, MessagesSquare, Plus, Trash2 } from 'lucide-react';
import { useStore } from '../store.ts';
import type { Application, ApplicationStatus } from '../types.ts';
import { InterviewSheet } from '../components/InterviewSheet.tsx';
import { Button, Card, cx, Field, Notice, TextArea } from '../components/ui.tsx';
import type { Tab } from '../App.tsx';

export const STATUSES: { id: ApplicationStatus; label: string; tone: string }[] = [
  { id: 'preparation', label: 'En préparation', tone: 'bg-slate-100 text-slate-700' },
  { id: 'envoyee', label: 'Envoyée', tone: 'bg-sky-100 text-sky-800' },
  { id: 'entretien', label: 'Entretien', tone: 'bg-violet-100 text-violet-800' },
  { id: 'offre', label: 'Acceptée', tone: 'bg-emerald-100 text-emerald-800' },
  { id: 'refus', label: 'Refusée', tone: 'bg-rose-100 text-rose-800' },
];

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
          <button type="button" className="font-semibold underline" onClick={() => onNavigate('offre')}>
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
