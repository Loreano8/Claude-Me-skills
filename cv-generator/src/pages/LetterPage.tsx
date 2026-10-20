import { useState } from 'react';
import { FileDown, FileText, Mail, Wand2 } from 'lucide-react';
import { useActiveCv, useStore } from '../store.ts';
import type { CoverLetterRequest } from '../../shared/schema.ts';
import { api } from '../lib/api.ts';
import { isCvEmpty, toAiContent } from '../lib/cv.ts';
import { exportLetterDocx, exportLetterPdf } from '../export/exporters.ts';
import { Preview } from '../components/Preview.tsx';
import { Button, Card, Field, Notice, Select, TextArea, Toggle } from '../components/ui.tsx';
import type { Tab } from '../App.tsx';

function GenerateCard({ onNavigate }: { onNavigate: (t: Tab) => void }) {
  const cv = useActiveCv();
  const job = useStore((s) => s.job);
  const applyLetter = useStore((s) => s.applyLetter);
  const [tone, setTone] = useState<CoverLetterRequest['tone']>('formel');
  const [length, setLength] = useState<CoverLetterRequest['length']>('standard');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasJob = !!job.text.trim() || !!job.file;

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const res = await api.coverLetter({
        cv: toAiContent(cv),
        job: { text: job.text, file: job.file ? { name: job.file.name, mediaType: job.file.mediaType, data: job.file.data } : null },
        notes,
        tone,
        length,
        lang: null,
      });
      applyLetter(res, cv);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card
      className="border-violet-200 bg-gradient-to-br from-violet-50 to-white"
      title={
        <span className="flex items-center gap-2">
          <Wand2 className="size-5 text-violet-600" /> Rédiger avec l’IA
        </span>
      }
      subtitle={
        hasJob ? (
          'La lettre sera personnalisée pour l’offre saisie dans l’onglet « Offre ».'
        ) : (
          <>
            Aucune offre saisie : ce sera une candidature spontanée.{' '}
            <button type="button" className="font-medium text-brand-700 underline" onClick={() => onNavigate('offre')}>
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
      <div className="mt-3">
        <Button variant="ai" icon={<Wand2 className="size-4" />} loading={busy} disabled={isCvEmpty(cv) || (!hasJob && !notes.trim())} onClick={generate}>
          Générer la lettre
        </Button>
        {!hasJob && !notes.trim() && <p className="mt-1.5 text-xs text-slate-500">Pour une candidature spontanée, indiquez au moins l’entreprise ou le poste visé.</p>}
      </div>
      {busy && <p className="mt-3 text-sm text-violet-700">Rédaction en cours…</p>}
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

  async function exportAs(kind: 'pdf' | 'docx') {
    setBusy(kind);
    setError(null);
    try {
      await (kind === 'pdf' ? exportLetterPdf(letter, cv) : exportLetterDocx(letter, cv));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="space-y-4">
        <GenerateCard onNavigate={onNavigate} />

        <Card
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
      </div>

      <div className="space-y-3 lg:sticky lg:top-20 lg:self-start">
        <div className="grid grid-cols-2 gap-2">
          <Button size="lg" icon={<FileDown className="size-5" />} loading={busy === 'pdf'} onClick={() => exportAs('pdf')}>
            PDF
          </Button>
          <Button size="lg" variant="secondary" icon={<FileText className="size-5" />} loading={busy === 'docx'} onClick={() => exportAs('docx')}>
            Word
          </Button>
        </div>
        {error && <Notice tone="error">{error}</Notice>}
        <div className="mx-auto max-w-[700px]">
          <Preview source={{ kind: 'letter', letter, cv }} />
        </div>
      </div>
    </div>
  );
}
