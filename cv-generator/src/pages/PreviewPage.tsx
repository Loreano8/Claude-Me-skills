import { useState } from 'react';
import { AlertTriangle, CheckCircle2, FileDown, FileText, Lightbulb } from 'lucide-react';
import { useActiveCv, useStore } from '../store.ts';
import type { CvDocument, CvSettings } from '../types.ts';
import { ACCENTS } from '../lib/cv.ts';
import { checkCv } from '../lib/checks.ts';
import { exportCvDocx, exportCvPdf } from '../export/exporters.ts';
import { Preview } from '../components/Preview.tsx';
import { Button, Card, cx, Notice, Toggle } from '../components/ui.tsx';

const TEMPLATES: { id: CvSettings['template']; name: string; description: string }[] = [
  { id: 'moderne', name: 'Moderne', description: 'Colonne colorée avec photo. Convient à la plupart des métiers.' },
  { id: 'classique', name: 'Classique (ATS)', description: 'Une colonne, sobre : le mieux lu par les logiciels de recrutement.' },
  { id: 'elegant', name: 'Élégant', description: 'Bandeau de couleur et frise des dates, pour se démarquer.' },
];

function TemplateThumb({ id, accent }: { id: CvSettings['template']; accent: string }) {
  const bar = 'h-1 rounded bg-slate-300';
  if (id === 'moderne') {
    return (
      <div className="flex h-full">
        <div className="w-1/3 space-y-1 p-1.5" style={{ backgroundColor: accent }}>
          <div className="mx-auto size-4 rounded-full bg-white/70" />
          <div className="h-0.5 rounded bg-white/60" />
          <div className="h-0.5 rounded bg-white/60" />
        </div>
        <div className="flex-1 space-y-1 p-1.5">
          <div className="h-1.5 w-3/4 rounded" style={{ backgroundColor: accent }} />
          <div className={bar} />
          <div className={bar} />
          <div className={cx(bar, 'w-2/3')} />
        </div>
      </div>
    );
  }
  if (id === 'classique') {
    return (
      <div className="space-y-1 p-2">
        <div className="h-1.5 w-1/2 rounded" style={{ backgroundColor: accent }} />
        <div className="h-0.5" style={{ backgroundColor: accent }} />
        <div className={bar} />
        <div className={bar} />
        <div className="h-0.5" style={{ backgroundColor: accent }} />
        <div className={cx(bar, 'w-3/4')} />
      </div>
    );
  }
  return (
    <div>
      <div className="flex items-center justify-between p-1.5" style={{ backgroundColor: accent }}>
        <div className="h-1.5 w-1/2 rounded bg-white/80" />
        <div className="size-3.5 rounded-full bg-white/70" />
      </div>
      <div className="space-y-1 p-1.5">
        <div className="flex gap-1">
          <div className="h-1 w-3 rounded" style={{ backgroundColor: accent }} />
          <div className={cx(bar, 'flex-1')} />
        </div>
        <div className="flex gap-1">
          <div className="h-1 w-3 rounded" style={{ backgroundColor: accent }} />
          <div className={cx(bar, 'flex-1')} />
        </div>
      </div>
    </div>
  );
}

export function DesignPanel({ cv }: { cv: CvDocument }) {
  const updateCv = useStore((s) => s.updateCv);
  const set = (patch: Partial<CvSettings>) => updateCv((c) => ({ ...c, settings: { ...c.settings, ...patch } }));
  const st = cv.settings;

  return (
    <div className="space-y-4">
      <Card title="Modèle">
        <div className="grid grid-cols-3 gap-2">
          {TEMPLATES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => set({ template: t.id })}
              className={cx('rounded-xl border-2 p-1.5 text-left transition', st.template === t.id ? 'border-brand-600 bg-brand-50' : 'border-slate-200 hover:border-slate-300')}
            >
              <div className="aspect-[1/1.2] overflow-hidden rounded-md bg-white ring-1 ring-slate-200">
                <TemplateThumb id={t.id} accent={st.accent} />
              </div>
              <p className="mt-1.5 text-xs font-semibold text-slate-800 sm:text-sm">{t.name}</p>
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-slate-500">{TEMPLATES.find((t) => t.id === st.template)?.description}</p>
      </Card>

      <Card title="Couleur">
        <div className="flex flex-wrap items-center gap-2">
          {ACCENTS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`Couleur ${c}`}
              onClick={() => set({ accent: c })}
              className={cx('size-8 rounded-full ring-offset-2 transition', st.accent === c && 'ring-2 ring-slate-900')}
              style={{ backgroundColor: c }}
            />
          ))}
          <label className="relative size-8 cursor-pointer overflow-hidden rounded-full bg-[conic-gradient(red,yellow,lime,aqua,blue,magenta,red)]" title="Autre couleur">
            <input type="color" value={st.accent} onChange={(e) => set({ accent: e.target.value })} className="absolute inset-0 opacity-0" />
          </label>
        </div>
      </Card>

      <Card title="Options d’affichage">
        <Toggle label="Photo" checked={st.showPhoto} onChange={(showPhoto) => set({ showPhoto })} hint={cv.photo ? undefined : 'Ajoutez une photo dans « Mes infos ».'} />
        <Toggle label="Date de naissance" checked={st.showBirthDate} onChange={(showBirthDate) => set({ showBirthDate })} />
        <Toggle label="Nationalité" checked={st.showNationality} onChange={(showNationality) => set({ showNationality })} />
        <Toggle label="Signature" checked={st.showSignature} onChange={(showSignature) => set({ showSignature })} hint={cv.signature ? undefined : 'Dessinez votre signature dans « Mes infos ».'} />
        <div className="mt-2 flex items-center gap-2 text-sm">
          <span className="font-medium text-slate-700">Titres des sections :</span>
          {(['fr', 'en'] as const).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => set({ headingLang: l })}
              className={cx('rounded-lg px-2.5 py-1 font-medium', st.headingLang === l ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-700')}
            >
              {l === 'fr' ? 'Français' : 'English'}
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
}

export function ExportButtons({ cv }: { cv: CvDocument }) {
  const [busy, setBusy] = useState<'pdf' | 'docx' | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(kind: 'pdf' | 'docx') {
    setBusy(kind);
    setError(null);
    try {
      await (kind === 'pdf' ? exportCvPdf(cv) : exportCvDocx(cv));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <Button size="lg" icon={<FileDown className="size-5" />} loading={busy === 'pdf'} onClick={() => run('pdf')}>
          PDF
        </Button>
        <Button size="lg" variant="secondary" icon={<FileText className="size-5" />} loading={busy === 'docx'} onClick={() => run('docx')}>
          Word
        </Button>
      </div>
      <p className="text-xs text-slate-500">Le PDF garde exactement la mise en page. Le fichier Word, plus simple, se modifie facilement.</p>
      {error && <Notice tone="error">{error}</Notice>}
    </div>
  );
}

function ChecksCard({ cv }: { cv: CvDocument }) {
  const checks = checkCv(cv);
  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          <Lightbulb className="size-5 text-amber-500" /> Conseils pour un CV actuel
        </span>
      }
    >
      <ul className="space-y-2">
        {checks.map((c, i) => (
          <li key={i} className="flex gap-2 text-sm text-slate-700">
            {c.level === 'ok' ? (
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
            ) : c.level === 'warn' ? (
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
            ) : (
              <Lightbulb className="mt-0.5 size-4 shrink-0 text-sky-600" />
            )}
            {c.text}
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function PreviewPage() {
  const cv = useActiveCv();
  return (
    // Sur téléphone : export, puis aperçu, puis réglages. Sur grand écran : réglages à gauche, aperçu à droite.
    <div className="grid gap-4 lg:grid-cols-[360px_1fr] lg:grid-rows-[auto_auto_1fr]">
      <Card title="Télécharger mon CV" className="lg:col-start-1">
        <ExportButtons cv={cv} />
      </Card>
      <div className="lg:sticky lg:top-20 lg:col-start-2 lg:row-span-3 lg:row-start-1 lg:self-start">
        <div className="mx-auto max-w-[700px]">
          <Preview source={{ kind: 'cv', cv }} />
        </div>
      </div>
      <div className="lg:col-start-1">
        <DesignPanel cv={cv} />
      </div>
      <div className="lg:col-start-1">
        <ChecksCard cv={cv} />
      </div>
    </div>
  );
}
