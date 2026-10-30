import { useState } from 'react';
import { FileDown, FileText, Lock, Mail, MessageCircleQuestion, PenLine } from 'lucide-react';
import { DossierLink } from './DossierPage.tsx';
import { useActiveCv, useStore } from '../store.ts';
import type { CoverLetterRequest, LetterQuestionsResult } from '../../shared/schema.ts';
import { api } from '../lib/api.ts';
import { isCvEmpty, toAiContent } from '../lib/cv.ts';
import { exportLetterDocx, exportLetterPdf } from '../export/exporters.ts';
import { Preview } from '../components/Preview.tsx';
import { WriteLikeMe } from '../components/WriteLikeMe.tsx';
import { NaturalReview } from '../components/NaturalReview.tsx';
import { letterCliches } from '../lib/naturalCheck.ts';
import { appendSpoken, MicButton } from '../components/MicButton.tsx';
import { ProOffer } from '../components/ProUnlock.tsx';
import { Button, Card, Field, Notice, Select, TextArea, Toggle } from '../components/ui.tsx';
import type { Tab } from '../App.tsx';

function GenerateCard({ onNavigate }: { onNavigate: (t: Tab) => void }) {
  const cv = useActiveCv();
  const job = useStore((s) => s.job);
  const applyLetter = useStore((s) => s.applyLetter);
  const [tone, setTone] = useState<CoverLetterRequest['tone']>('formel');
  const [length, setLength] = useState<CoverLetterRequest['length']>('standard');
  const [lang, setLang] = useState<'auto' | 'fr' | 'en'>('auto');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasJob = !!job.text.trim() || !!job.file;

  /** Questions posées avant d'écrire (motivation, exemple vécu) et réponses de la personne. */
  const [questions, setQuestions] = useState<LetterQuestionsResult['questions'] | null>(null);
  const [answers, setAnswers] = useState<string[]>([]);
  const [asking, setAsking] = useState(false);

  const jobInput = () => ({ text: job.text, file: job.file ? { name: job.file.name, mediaType: job.file.mediaType, data: job.file.data } : null, answers: '' });

  /** Avant la première lettre : 1 ou 2 questions gratuites pour la rendre personnelle. */
  async function start() {
    setAsking(true);
    setError(null);
    try {
      const res = await api.letterQuestions({ cv: toAiContent(cv), job: jobInput(), notes });
      if (res.questions.length) {
        setQuestions(res.questions);
        setAnswers(res.questions.map(() => ''));
        return;
      }
    } catch {
      // Questions indisponibles : on écrit directement la lettre.
    } finally {
      setAsking(false);
    }
    await generate([]);
  }

  async function generate(withAnswers: string[]) {
    setBusy(true);
    setError(null);
    const personal = (questions ?? [])
      .map((q, i) => (withAnswers[i]?.trim() ? `${q.question}\n${withAnswers[i].trim()}` : ''))
      .filter(Boolean)
      .join('\n\n');
    try {
      const res = await api.coverLetter({
        cv: toAiContent(cv),
        job: jobInput(),
        notes: [notes.trim(), personal].filter(Boolean).join('\n\n'),
        tone,
        length,
        // « Automatique » : la langue de l'offre, sinon celle du CV.
        lang: lang === 'auto' ? (hasJob ? null : cv.settings.headingLang) : lang,
      });
      applyLetter(res, cv);
      setQuestions(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card
      className="border-brand-100"
      tour="letter-generate"
      title={
        <span className="flex items-center gap-2">
          <Mail className="size-5 text-brand-600" /> Rédiger ma lettre
        </span>
      }
      subtitle={
        hasJob ? (
          'La lettre sera personnalisée pour l’offre saisie dans l’onglet « Offre ».'
        ) : (
          <>
            Aucune offre saisie : ce sera une candidature spontanée.{' '}
            <button type="button" className="hit font-medium text-brand-700 underline" onClick={() => onNavigate('offre')}>
              Ajouter une offre
            </button>
          </>
        )
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Select
          label="Ton"
          value={tone}
          onChange={setTone}
          options={[
            { value: 'formel', label: 'Formel' },
            { value: 'dynamique', label: 'Dynamique' },
            { value: 'chaleureux', label: 'Chaleureux' },
          ]}
        />
        <Select
          label="Longueur"
          value={length}
          onChange={setLength}
          options={[
            { value: 'standard', label: 'Standard (≈ 300 mots)' },
            { value: 'courte', label: 'Courte (≈ 200 mots)' },
          ]}
        />
        <Select
          className="sm:col-span-2"
          label="Langue"
          value={lang}
          onChange={setLang}
          options={[
            { value: 'auto', label: hasJob ? 'Automatique (langue de l’offre)' : 'Automatique (langue du CV)' },
            { value: 'fr', label: 'Français' },
            { value: 'en', label: 'Anglais' },
          ]}
        />
        <TextArea
          className="sm:col-span-2"
          label="Ce que vous voulez ajouter (facultatif)"
          value={notes}
          onChange={setNotes}
          rows={3}
          placeholder={hasJob ? 'Ex. Je connais bien leurs produits, je suis disponible immédiatement…' : 'Ex. Entreprise visée, poste souhaité, pourquoi elle vous intéresse…'}
        />
      </div>
      {isCvEmpty(cv) && (
        <div className="mt-3">
          <Notice tone="warn">Remplissez d’abord votre CV : la lettre s’appuie sur vos expériences.</Notice>
        </div>
      )}
      {questions ? (
        <div className="mt-4 space-y-3 rounded-xl bg-white p-3.5 ring-1 ring-brand-100">
          <p className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <MessageCircleQuestion className="size-4 text-brand-600" /> Pour une lettre qui vous ressemble (facultatif, gratuit)
          </p>
          {questions.map((q, i) => (
            <div key={i}>
              <TextArea
                label={q.question}
                value={answers[i] ?? ''}
                onChange={(v) => setAnswers((cur) => cur.map((a, j) => (j === i ? v : a)))}
                rows={3}
                placeholder={q.hint}
              />
              <div className="mt-1.5">
                <MicButton onText={(t) => setAnswers((cur) => cur.map((a, j) => (j === i ? appendSpoken(a, t) : a)))} lang={cv.settings.headingLang} label="Répondre en parlant" />
              </div>
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            <Button variant="ai" icon={<PenLine className="size-4" />} loading={busy} onClick={() => void generate(answers)}>
              Générer la lettre
            </Button>
            <Button variant="ghost" disabled={busy} onClick={() => void generate([])}>
              Passer
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-3">
          <Button variant="ai" icon={<PenLine className="size-4" />} loading={busy || asking} disabled={isCvEmpty(cv) || (!hasJob && !notes.trim())} onClick={() => void start()}>
            Générer la lettre
          </Button>
          {!hasJob && !notes.trim() && <p className="mt-1.5 text-xs text-slate-500">Pour une candidature spontanée, indiquez au moins l’entreprise ou le poste visé.</p>}
        </div>
      )}
      {asking && <p className="mt-3 text-sm text-brand-700">Préparation de vos questions…</p>}
      {busy && <p className="mt-3 text-sm text-brand-700">Rédaction en cours…</p>}
      {error && (
        <div className="mt-3">
          <Notice tone="error">{error}</Notice>
        </div>
      )}
    </Card>
  );
}

export function LetterPage({ onNavigate }: { onNavigate: (t: Tab) => void }) {
  const cv = useActiveCv();
  const letter = useStore((s) => s.letter);
  const update = useStore((s) => s.updateLetter);
  const [busy, setBusy] = useState<'pdf' | 'docx' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needPro, setNeedPro] = useState(false);
  const pro = Boolean(cv.unlocked);

  async function exportAs(kind: 'pdf' | 'docx', unlockedNow = false) {
    // La lettre suit la version du CV : gratuite avec mention, ou Pro (sans mention, et en Word).
    if (kind === 'docx' && !pro && !unlockedNow) return setNeedPro(true);
    setNeedPro(false);
    setBusy(kind);
    setError(null);
    try {
      const doc = unlockedNow ? { ...cv, unlocked: { at: Date.now() } } : cv;
      await (kind === 'pdf' ? exportLetterPdf(letter, doc) : exportLetterDocx(letter, doc));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="space-y-4">
        <WriteLikeMe compact />
        <GenerateCard onNavigate={onNavigate} />

        <Card
          tour="letter-body"
          title={
            <span className="flex items-center gap-2">
              <Mail className="size-5 text-brand-600" /> Ma lettre
            </span>
          }
          subtitle="Relisez et personnalisez : une lettre sincère fait la différence."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Destinataire" value={letter.recipientName} onChange={(recipientName) => update({ recipientName })} placeholder="Ex. Service des ressources humaines" />
            <Field label="Entreprise" value={letter.recipientCompany} onChange={(recipientCompany) => update({ recipientCompany })} />
            <TextArea className="sm:col-span-2" label="Adresse de l’entreprise" value={letter.recipientAddress} onChange={(recipientAddress) => update({ recipientAddress })} rows={2} />
            <Field label="Lieu" value={letter.place} onChange={(place) => update({ place })} placeholder={cv.personal.city || 'Ville'} />
            <Field label="Date" value={letter.date} onChange={(date) => update({ date })} />
            <Field className="sm:col-span-2" label="Objet" value={letter.subject} onChange={(subject) => update({ subject })} placeholder="Candidature au poste de …" />
            <Field className="sm:col-span-2" label="Formule d’appel" value={letter.salutation} onChange={(salutation) => update({ salutation })} />
            <TextArea
              className="sm:col-span-2"
              label="Corps de la lettre"
              value={letter.body}
              onChange={(body) => update({ body })}
              rows={14}
              hint="Laissez une ligne vide entre deux paragraphes."
            />
            <TextArea className="sm:col-span-2" label="Formule de politesse" value={letter.closing} onChange={(closing) => update({ closing })} rows={2} />
          </div>
          <div className="mt-2">
            <Toggle
              label="Signer la lettre"
              checked={letter.showSignature}
              onChange={(showSignature) => update({ showSignature })}
              hint={cv.signature ? undefined : 'Dessinez votre signature dans « Mes infos » > Signature.'}
            />
          </div>
        </Card>
        {letter.body.trim() && <NaturalReview hits={letterCliches(letter)} edit="Corrigez directement dans « Corps de la lettre » ci-dessus." />}
      </div>

      <div className="space-y-3 lg:sticky lg:top-20 lg:self-start">
        <div data-tour="letter-export" className="grid grid-cols-2 gap-2">
          <Button size="lg" icon={<FileDown className="size-5" />} loading={busy === 'pdf'} onClick={() => exportAs('pdf')}>
            {pro ? 'PDF' : 'PDF gratuit'}
          </Button>
          <Button size="lg" variant="secondary" icon={pro ? <FileText className="size-5" /> : <Lock className="size-5" />} loading={busy === 'docx'} onClick={() => exportAs('docx')}>
            Word
          </Button>
        </div>
        <ProOffer cv={cv} reason={needPro ? 'L’export Word fait partie de la version Pro.' : null} onUnlocked={() => needPro && void exportAs('docx', true)} />
        <div className="mt-3">
          <DossierLink />
        </div>
        {error && <Notice tone="error">{error}</Notice>}
        <div className="mx-auto max-w-[700px]">
          <Preview source={{ kind: 'letter', letter, cv }} />
        </div>
      </div>
    </div>
  );
}
