import { useState } from 'react';
import { BellRing, ChevronRight } from 'lucide-react';
import { daysSince, followUpEmail, needsFollowUp } from '../lib/emails.ts';
import { useStore } from '../store.ts';
import type { Tab } from '../App.tsx';
import type { Application } from '../types.ts';
import { EmailCard } from './EmailCard.tsx';
import { Card, Cost } from './ui.tsx';

/** Les candidatures envoyées depuis une semaine sans réponse, chacune avec son message de relance prêt. */
export function FollowUps() {
  // On lit la liste telle quelle puis on filtre : un filtre dans le sélecteur créerait un nouveau tableau à chaque lecture.
  const all = useStore((s) => s.applications);
  const apps = all.filter((a) => needsFollowUp(a));
  if (apps.length === 0) return null;
  return (
    <Card
      className="border-sun-400"
      title={
        <span className="flex items-center gap-2">
          <BellRing className="size-5 text-sun-900" aria-hidden="true" /> À relancer <Cost free />
        </span>
      }
      subtitle="Sans réponse depuis une semaine : une relance polie montre votre intérêt. Le message est prêt."
    >
      <div className="space-y-3">
        {apps.map((a) => (
          <FollowUp key={a.id} app={a} />
        ))}
      </div>
    </Card>
  );
}

function FollowUp({ app }: { app: Application }) {
  const cv = useStore((s) => s.cvs.find((c) => c.id === app.cvId) ?? s.cvs.find((c) => c.id === s.activeId) ?? s.cvs[0]);
  const updateApplication = useStore((s) => s.updateApplication);
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-slate-200 p-3">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex min-h-11 w-full items-center gap-3 text-left">
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold text-slate-900">{[app.title, app.company].filter(Boolean).join(' · ')}</span>
          <span className="block text-sm text-slate-600">Envoyée il y a {daysSince(app.sentAt!)} jours</span>
        </span>
        <span className="shrink-0 text-sm font-semibold text-brand-700">{open ? 'Fermer' : 'Relancer'}</span>
      </button>
      {open && (
        <div className="mt-3">
          <EmailCard
            draft={followUpEmail(cv, { position: app.title, company: app.company, sentAt: app.sentAt, to: app.contactEmail })}
            hint="Joignez à nouveau votre CV en PDF. Une seule relance suffit."
            onUsed={(to) => updateApplication(app.id, { followedUpAt: Date.now(), contactEmail: to || app.contactEmail })}
          />
        </div>
      )}
    </div>
  );
}

/** Rappel discret en haut des pages principales : il y a des candidatures à relancer. */
export function FollowUpNudge({ onNavigate }: { onNavigate: (t: Tab) => void }) {
  const n = useStore((s) => s.applications.filter((a) => needsFollowUp(a)).length);
  if (n === 0) return null;
  return (
    <button
      type="button"
      onClick={() => onNavigate('suivi')}
      className="mb-3 flex min-h-12 w-full items-center gap-3 rounded-2xl bg-sun-100 px-4 py-2 text-left text-sm text-sun-900 ring-1 ring-sun-400/60"
    >
      <BellRing className="size-5 shrink-0" aria-hidden="true" />
      <span className="flex-1">
        <strong>{n === 1 ? '1 candidature à relancer' : `${n} candidatures à relancer`}</strong> : le message est prêt.
      </span>
      <ChevronRight className="size-5 shrink-0" aria-hidden="true" />
    </button>
  );
}
