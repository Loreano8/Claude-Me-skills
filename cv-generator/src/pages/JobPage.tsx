import { useEffect, useRef, useState } from 'react';
import { ArrowRight, CheckCircle2, ClipboardList, Eye, HelpCircle, Mail, MessagesSquare, PencilLine, Target, Wand2 } from 'lucide-react';
import type { AdaptResult, ClarifyResult, InterviewResult } from '../../shared/schema.ts';
import { useActiveCv, useStore } from '../store.ts';
import { api } from '../lib/api.ts';
import { useAccount } from '../lib/account.ts';
import { isCvEmpty, toAiContent } from '../lib/cv.ts';
import { JobInputCard } from '../components/JobInputCard.tsx';
import { InterviewSheet } from '../components/InterviewSheet.tsx';
import { Button, Card, Chip, Notice } from '../components/ui.tsx';
import type { Tab } from '../App.tsx';

function ScoreRing({ score, label }: { score: number; label?: string }) {
  const value = Math.max(0, Math.min(100, Math.round(score)));
  const color = value >= 70 ? '#059669' : value >= 45 ? '#d97706' : '#dc2626';
  return (
    <div
      className="flex size-20 shrink-0 items-center justify-center rounded-full"
      style={{ background: `conic-gradient(${color} ${value * 3.6}deg, #e2e8f0 0deg)` }}
    >
      <div className="flex size-16 flex-col items-center justify-center rounded-full bg-white">
        <span className="text-xl font-bold text-slate-900">{value}</span>
        <span className="-mt-1 text-[10px] text-slate-500">{label ?? '/ 100'}</span>
      </div>
    </div>
  );
}

export function AnalysisCard({ result, onNavigate }: { result: Pick<AdaptResult, 'job' | 'analysis'>; onNavigate: (t: Tab) => void }) {
  const { job, analysis } = result;
  return (
    <Card title="Analyse de l’offre" subtitle={[job.title, job.company, job.location].filter(Boolean).join(' · ')}>
      {typeof analysis.matchScoreAfter === 'number' ? (
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <ScoreRing score={analysis.matchScore} label="avant" />
            <ArrowRight className="size-5 text-slate-400" />
            <ScoreRing score={analysis.matchScoreAfter} label="après" />
          </div>
          <p className="min-w-0 flex-1 text-sm text-slate-600">
            Compatibilité de votre CV avec l’offre, avant et après adaptation. Votre CV d’origine est conservé ; la version adaptée est enregistrée à part.
          </p>
        </div>
      ) : (
        <div className="flex items-center gap-4">
          <ScoreRing score={analysis.matchScore} />
          <p className="text-sm text-slate-600">
            Adéquation estimée entre votre profil et l’offre. Une version de votre CV adaptée à ce poste a été créée : votre CV d’origine est conservé.
          </p>
        </div>
      )}

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

type Question = ClarifyResult['questions'][number];

/** Questions de l'IA avant l'adaptation : poste à choisir, exigence absente du CV… */
function ClarifyCard({ questions, busy, onDone, onSkip }: { questions: Question[]; busy: boolean; onDone: (answers: string) => void; onSkip: () => void }) {
  const [picked, setPicked] = useState<string[]>(() => questions.map(() => ''));
  const [notes, setNotes] = useState<string[]>(() => questions.map(() => ''));
  const box = useRef<HTMLDivElement>(null);
  // Les questions apparaissent sous le bouton : on les amène à l'écran.
  useEffect(() => box.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), []);
  const set = (list: string[], i: number, v: string) => list.map((x, j) => (j === i ? v : x));
  const answers = questions
    .map((q, i) => {
      const a = [picked[i], notes[i].trim()].filter(Boolean).join('. ');
      return a ? `Question : ${q.question}\nRéponse : ${a}` : '';
    })
    .filter(Boolean)
    .join('\n\n');

  return (
    <div ref={box} className="scroll-mt-20">
      <Card
        className="border-violet-200"
        title={
          <span className="flex items-center gap-2">
            <HelpCircle className="size-5 text-violet-600" /> Avant d’adapter votre CV
          </span>
        }
        subtitle="Quelques précisions pour viser juste. Répondez à ce que vous savez, le reste est facultatif."
      >
        <div className="space-y-4">
          {questions.map((q, i) => (
            <div key={i}>
              <p className="text-sm font-semibold text-slate-900">{q.question}</p>
              {q.options.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {q.options.map((o) => (
                    <button
                      key={o}
                      type="button"
                      aria-pressed={picked[i] === o}
                      onClick={() => setPicked((p) => set(p, i, p[i] === o ? '' : o))}
                      className={
                        picked[i] === o
                          ? 'rounded-full bg-violet-600 px-3 py-1.5 text-sm font-medium text-white'
                          : 'rounded-full bg-white px-3 py-1.5 text-sm font-medium text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50'
                      }
                    >
                      {o}
                    </button>
                  ))}
                </div>
              )}
              <input
                value={notes[i]}
                onChange={(e) => setNotes((n) => set(n, i, e.target.value))}
                placeholder={q.options.length ? 'Précisez si besoin (facultatif)' : 'Votre réponse'}
                aria-label={`Réponse : ${q.question}`}
                className="mt-2 w-full rounded-xl px-3 py-2 text-sm ring-1 ring-slate-300 outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="ai" icon={<Wand2 className="size-4" />} loading={busy} disabled={busy} onClick={() => onDone(answers)}>
            Adapter mon CV (1 crédit)
          </Button>
          <Button variant="ghost" disabled={busy} onClick={onSkip}>
            Passer les questions
          </Button>
        </div>
      </Card>
    </div>
  );
}

export function JobPage({ onNavigate }: { onNavigate: (t: Tab) => void }) {
  const cv = useActiveCv();
  const job = useStore((s) => s.job);
  const addAdaptedCv = useStore((s) => s.addAdaptedCv);
  const applyLetter = useStore((s) => s.applyLetter);
  const saveInterview = useStore((s) => s.saveInterview);
  const linkedApplication = useStore((s) => s.applications.find((a) => a.cvId === cv.id) ?? null);
  const [interview, setInterview] = useState<InterviewResult | null>(null);
  const [busy, setBusy] = useState<'adapt' | 'letter' | 'interview' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AdaptResult | null>(null);

  // Questions posées sur l'offre et réponses du candidat, valables tant que l'offre ne change pas.
  const jobKey = `${job.text.length}:${job.text.slice(0, 200)}:${job.file?.name ?? ''}:${job.file?.data.length ?? 0}`;
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [questionsFor, setQuestionsFor] = useState('');
  const [clarified, setClarified] = useState<{ key: string; answers: string } | null>(null);
  const answers = clarified?.key === jobKey ? clarified.answers : '';

  const hasJob = !!job.text.trim() || !!job.file;
  const empty = isCvEmpty(cv);
  const jobBody = { text: job.text, file: job.file ? { name: job.file.name, mediaType: job.file.mediaType, data: job.file.data } : null, answers };

  async function runAdapt(withAnswers: string) {
    setBusy('adapt');
    setError(null);
    try {
      const res = await api.adapt({ cv: toAiContent(cv), job: { ...jobBody, answers: withAnswers }, lang: null });
      setClarified({ key: jobKey, answers: withAnswers });
      setQuestions(null);
      addAdaptedCv(cv, res);
      setResult(res);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function adapt() {
    if (clarified?.key === jobKey) return runAdapt(clarified.answers);
    setBusy('adapt');
    setError(null);
    let asked: Question[] = [];
    try {
      // Gratuit : l'IA vérifie s'il faut d'abord poser des questions.
      asked = (await api.clarify({ cv: toAiContent(cv), job: { ...jobBody, answers: '' } })).questions.slice(0, 3);
    } catch {
      // Pas connecté : la fenêtre de connexion vient de s'ouvrir, on s'arrête là.
      if (useAccount.getState().dialog === 'account') {
        setBusy(null);
        return;
      }
      // Questions indisponibles : on adapte directement, comme avant.
    }
    if (asked.length) {
      setQuestions(asked);
      setQuestionsFor(jobKey);
      setBusy(null);
      return;
    }
    await runAdapt('');
  }

  const jobTitle =
    result?.job.title || cv.adaptation?.job.title || job.text.trim().split('\n')[0]?.slice(0, 60) || 'Offre sans titre';

  async function prepareInterview() {
    setBusy('interview');
    setError(null);
    try {
      const res = await api.interview({ cv: toAiContent(cv), job: jobBody, lang: null });
      saveInterview(linkedApplication?.id ?? null, jobTitle, res);
      setInterview(res);
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
          <Button variant="secondary" size="lg" icon={<MessagesSquare className="size-5" />} loading={busy === 'interview'} disabled={!hasJob || empty || busy !== null} onClick={prepareInterview}>
            Préparer l’entretien
          </Button>
        </div>
        <p className="mt-2 text-xs text-slate-500">Chaque action utilise 1 crédit. Les questions éventuelles sur l’offre sont gratuites.</p>
        {busy && <p className="mt-3 text-sm text-violet-700">L’IA lit l’offre et prépare votre candidature… (jusqu’à une minute)</p>}
        {questions && questionsFor === jobKey && !busy && <p className="mt-3 text-sm text-violet-700">Quelques questions avant d’adapter votre CV : voir ci-dessous.</p>}
        {error && (
          <div className="mt-3">
            <Notice tone="error">{error}</Notice>
          </div>
        )}
        <p className="mt-3 text-xs text-slate-500">
          L’IA met en avant ce que vous avez réellement fait et reprend les mots-clés de l’offre. Elle n’invente ni diplôme, ni expérience, ni compétence.
        </p>
      </Card>

      {questions && questionsFor === jobKey && (
        <ClarifyCard key={jobKey} questions={questions} busy={busy === 'adapt'} onDone={(a) => void runAdapt(a)} onSkip={() => void runAdapt('')} />
      )}

      {shown && <AnalysisCard result={shown} onNavigate={onNavigate} />}

      {(interview ?? linkedApplication?.interview) && (
        <Card
          title={
            <span className="flex items-center gap-2">
              <MessagesSquare className="size-5 text-brand-600" /> Fiche entretien
            </span>
          }
          subtitle={jobTitle}
          actions={
            <Button variant="ghost" size="sm" icon={<ClipboardList className="size-4" />} onClick={() => onNavigate('suivi')}>
              Mes candidatures
            </Button>
          }
        >
          <InterviewSheet sheet={(interview ?? linkedApplication?.interview)!} title={jobTitle} />
        </Card>
      )}
    </div>
  );
}
