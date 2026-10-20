import { useState } from 'react';
import { CheckCircle2, Eye, Mail, PencilLine, Target, Wand2 } from 'lucide-react';
import type { AdaptResult } from '../../shared/schema.ts';
import { useActiveCv, useStore } from '../store.ts';
import { api } from '../lib/api.ts';
import { isCvEmpty, toAiContent } from '../lib/cv.ts';
import { JobInputCard } from '../components/JobInputCard.tsx';
import { Button, Card, Chip, Notice } from '../components/ui.tsx';
import type { Tab } from '../App.tsx';

function ScoreRing({ score }: { score: number }) {
  const value = Math.max(0, Math.min(100, Math.round(score)));
  const color = value >= 70 ? '#059669' : value >= 45 ? '#d97706' : '#dc2626';
  return (
    <div
      className="flex size-20 shrink-0 items-center justify-center rounded-full"
      style={{ background: `conic-gradient(${color} ${value * 3.6}deg, #e2e8f0 0deg)` }}
    >
      <div className="flex size-16 flex-col items-center justify-center rounded-full bg-white">
        <span className="text-xl font-bold text-slate-900">{value}</span>
        <span className="-mt-1 text-[10px] text-slate-500">/ 100</span>
      </div>
    </div>
  );
}

export function AnalysisCard({ result, onNavigate }: { result: Pick<AdaptResult, 'job' | 'analysis'>; onNavigate: (t: Tab) => void }) {
  const { job, analysis } = result;
  return (
    <Card title="Analyse de l’offre" subtitle={[job.title, job.company, job.location].filter(Boolean).join(' · ')}>
      <div className="flex items-center gap-4">
        <ScoreRing score={analysis.matchScore} />
        <p className="text-sm text-slate-600">
          Adéquation estimée entre votre profil et l’offre. Une version de votre CV adaptée à ce poste a été créée : votre CV d’origine est conservé.
        </p>
      </div>

      {analysis.matchedKeywords.length > 0 && (
        <div className="mt-4">
          <p className="mb-1.5 text-sm font-semibold text-slate-800">Vos points forts pour ce poste</p>
          <div className="flex flex-wrap gap-1.5">
            {analysis.matchedKeywords.map((k) => (
              <Chip key={k} tone="green">
                {k}
              </Chip>
            ))}
          </div>
        </div>
      )}

      {analysis.missingKeywords.length > 0 && (
        <div className="mt-4">
          <p className="mb-1.5 text-sm font-semibold text-slate-800">Demandé par l’offre, absent de votre CV</p>
          <div className="flex flex-wrap gap-1.5">
            {analysis.missingKeywords.map((k) => (
              <Chip key={k} tone="amber">
                {k}
              </Chip>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-slate-500">Ajoutez-les seulement si vous les maîtrisez vraiment : un recruteur vérifiera en entretien.</p>
        </div>
      )}

      {analysis.changes.length > 0 && (
        <div className="mt-4">
          <p className="mb-1.5 text-sm font-semibold text-slate-800">Ce qui a été adapté</p>
          <ul className="space-y-1 text-sm text-slate-700">
            {analysis.changes.map((c, i) => (
              <li key={i} className="flex gap-2">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-brand-600" /> {c}
              </li>
            ))}
          </ul>
        </div>
      )}

      {analysis.advice.length > 0 && (
        <div className="mt-4 rounded-xl bg-sky-50 p-3">
          <p className="mb-1 text-sm font-semibold text-sky-900">Conseils pour cette candidature</p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-sky-900">
            {analysis.advice.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <Button icon={<Eye className="size-4" />} onClick={() => onNavigate('apercu')}>
          Voir le CV adapté
        </Button>
        <Button variant="secondary" icon={<PencilLine className="size-4" />} onClick={() => onNavigate('infos')}>
          Le modifier
        </Button>
      </div>
    </Card>
  );
}

export function JobPage({ onNavigate }: { onNavigate: (t: Tab) => void }) {
  const cv = useActiveCv();
  const job = useStore((s) => s.job);
  const addAdaptedCv = useStore((s) => s.addAdaptedCv);
  const applyLetter = useStore((s) => s.applyLetter);
  const [busy, setBusy] = useState<'adapt' | 'letter' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AdaptResult | null>(null);

  const hasJob = !!job.text.trim() || !!job.file;
  const empty = isCvEmpty(cv);
  const jobBody = { text: job.text, file: job.file ? { name: job.file.name, mediaType: job.file.mediaType, data: job.file.data } : null };

  async function adapt() {
    setBusy('adapt');
    setError(null);
    try {
      const res = await api.adapt({ cv: toAiContent(cv), job: jobBody, lang: null });
      addAdaptedCv(cv, res);
      setResult(res);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function letter() {
    setBusy('letter');
    setError(null);
    try {
      const res = await api.coverLetter({ cv: toAiContent(cv), job: jobBody, notes: '', tone: 'formel', length: 'standard', lang: null });
      applyLetter(res, cv);
      onNavigate('lettre');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const shown = result ?? (cv.adaptation ? { job: cv.adaptation.job, analysis: cv.adaptation.analysis } : null);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <JobInputCard />

      <Card
        title={
          <span className="flex items-center gap-2">
            <Target className="size-5 text-brand-600" /> Postuler à cette offre
          </span>
        }
        subtitle={<>À partir du CV : <strong>{cv.label}</strong></>}
      >
        {empty && <Notice tone="warn">Remplissez d’abord votre CV dans « Mes infos » (la saisie rapide avec l’IA suffit).</Notice>}
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="ai" size="lg" icon={<Wand2 className="size-5" />} loading={busy === 'adapt'} disabled={!hasJob || empty || busy !== null} onClick={adapt}>
            Adapter mon CV à l’offre
          </Button>
          <Button variant="secondary" size="lg" icon={<Mail className="size-5" />} loading={busy === 'letter'} disabled={!hasJob || empty || busy !== null} onClick={letter}>
            Rédiger la lettre de motivation
          </Button>
        </div>
        {busy && <p className="mt-3 text-sm text-violet-700">L’IA lit l’offre et prépare votre candidature… (jusqu’à une minute)</p>}
        {error && (
          <div className="mt-3">
            <Notice tone="error">{error}</Notice>
          </div>
        )}
        <p className="mt-3 text-xs text-slate-500">
          L’IA met en avant ce que vous avez réellement fait et reprend les mots-clés de l’offre. Elle n’invente ni diplôme, ni expérience, ni compétence.
        </p>
      </Card>

      {shown && <AnalysisCard result={shown} onNavigate={onNavigate} />}
    </div>
  );
}
