import { useRef, useState } from 'react';
import { FileUp, Paperclip, X } from 'lucide-react';
import { useStore } from '../store.ts';
import { ACCEPTED_DOCS, fileToAttachment } from '../lib/files.ts';
import { Button, Card, Notice, TextArea } from './ui.tsx';

export function JobInputCard() {
  const job = useStore((s) => s.job);
  const setJob = useStore((s) => s.setJob);
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    try {
      setJob({ ...job, file: await fileToAttachment(file) });
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <Card title="L’offre d’emploi" subtitle="Collez le texte de l’annonce, ou importez-la en PDF ou en capture d’écran.">
      <TextArea
        value={job.text}
        onChange={(text) => setJob({ ...job, text })}
        rows={8}
        placeholder="Collez ici le texte de l’annonce : intitulé du poste, missions, profil recherché…"
      />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input ref={input} type="file" accept={ACCEPTED_DOCS} className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
        {job.file ? (
          <span className="inline-flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm ring-1 ring-slate-200">
            <Paperclip className="size-4 text-slate-500" /> {job.file.name}
            <button type="button" aria-label="Retirer le fichier" onClick={() => setJob({ ...job, file: null })} className="text-slate-400 hover:text-slate-700">
              <X className="size-4" />
            </button>
          </span>
        ) : (
          <Button variant="secondary" size="sm" icon={<FileUp className="size-4" />} onClick={() => input.current?.click()}>
            Importer l’annonce (PDF, photo)
          </Button>
        )}
        {(job.text || job.file) && (
          <Button variant="ghost" size="sm" onClick={() => setJob({ text: '', file: null })}>
            Effacer l’offre
          </Button>
        )}
      </div>
      {error && (
        <div className="mt-3">
          <Notice tone="error">{error}</Notice>
        </div>
      )}
    </Card>
  );
}
