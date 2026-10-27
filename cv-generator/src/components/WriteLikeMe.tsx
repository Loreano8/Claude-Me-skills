import { useRef, useState } from 'react';
import { Paperclip, PenLine, Trash2, X } from 'lucide-react';
import type { Attachment } from '../../shared/schema.ts';
import { api } from '../lib/api.ts';
import { fileToAttachment } from '../lib/files.ts';
import { useWritingStyle } from '../lib/writingStyle.ts';
import { Button, Card, Notice, TextArea, Toggle } from './ui.tsx';

const MAX_FILES = 4;
const ACCEPTED = 'application/pdf,image/png,image/jpeg,image/webp,text/plain';

/** Analyse le style à partir de documents écrits par la personne ; renvoie un message d'erreur ou null. */
export async function learnStyle(files: Attachment[], text: string): Promise<string | null> {
  const res = await api.writingStyle({ files, text });
  if (!res.enough) return res.message;
  const source = files.length ? files.map((f) => (f.mediaType.startsWith('image/') ? 'photo' : f.name)).join(', ') : 'texte collé';
  useWritingStyle.getState().setStyle(res, source);
  return null;
}

/**
 * « Écrire comme moi » : CV Studio retient la façon d'écrire de la personne (jamais le contenu)
 * et l'applique à ses CV et lettres. Version compacte (une ligne) sur la page Lettre.
 */
export function WriteLikeMe({ compact = false }: { compact?: boolean }) {
  const { style, enabled, setEnabled, clear } = useWritingStyle();
  const fileInput = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(!compact);
  const [editing, setEditing] = useState(false);
  const [files, setFiles] = useState<Attachment[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFiles(list: FileList | null) {
    if (!list?.length) return;
    setError(null);
    try {
      const added: Attachment[] = [];
      for (const f of Array.from(list)) {
        const { size: _size, ...att } = await fileToAttachment(f);
        added.push(att);
      }
      setFiles((cur) => [...cur, ...added].slice(0, MAX_FILES));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function analyze() {
    setBusy(true);
    setError(null);
    try {
      const problem = await learnStyle(files, text);
      if (problem) setError(problem);
      else {
        setFiles([]);
        setText('');
        setEditing(false);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (compact && !open) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm">
        <div className="flex items-center gap-2">
          <PenLine className="size-4 shrink-0 text-brand-600" />
          <span className="font-semibold text-slate-800">Écrire comme moi</span>
          <button type="button" className="ml-auto font-medium text-brand-700 underline" onClick={() => setOpen(true)}>
            {style ? 'Modifier' : 'Configurer'}
          </button>
        </div>
        <p className="mt-0.5 pl-6 text-slate-600">
          {style ? (enabled ? `Activé : ${style.traits.slice(0, 3).join(' · ')}` : 'Désactivé') : 'Vos CV et lettres écrits avec vos mots à vous.'}
        </p>
      </div>
    );
  }

  const form = (
    <div className="space-y-3">
      <input
        ref={fileInput}
        type="file"
        multiple
        accept={ACCEPTED}
        className="hidden"
        onChange={(e) => {
          void onFiles(e.target.files);
          e.target.value = '';
        }}
      />
      <div className="flex flex-wrap items-center gap-2">
        {files.map((f, i) => (
          <span key={i} className="inline-flex max-w-full items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm ring-1 ring-slate-200">
            <Paperclip className="size-4 shrink-0 text-slate-500" />
            <span className="truncate">{f.mediaType.startsWith('image/') ? `Photo ${i + 1}` : f.name}</span>
            <button type="button" onClick={() => setFiles((cur) => cur.filter((_, j) => j !== i))} aria-label="Retirer ce document" className="text-slate-400 hover:text-slate-700">
              <X className="size-4" />
            </button>
          </span>
        ))}
        {files.length < MAX_FILES && (
          <Button variant="secondary" size="sm" icon={<Paperclip className="size-4" />} onClick={() => fileInput.current?.click()}>
            Importer un document que j’ai écrit
          </Button>
        )}
      </div>
      <TextArea value={text} onChange={setText} rows={3} placeholder="Ou collez ici un texte que vous avez écrit vous-même : une ancienne lettre, un message, un rapport…" />
      <div className="flex flex-wrap gap-2">
        <Button icon={<PenLine className="size-4" />} loading={busy} disabled={!files.length && !text.trim()} onClick={analyze}>
          Retenir ma façon d’écrire
        </Button>
        {style && (
          <Button variant="ghost" onClick={() => setEditing(false)}>
            Annuler
          </Button>
        )}
      </div>
      {busy && <p className="text-sm text-brand-700">Lecture de votre façon d’écrire…</p>}
    </div>
  );

  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          <PenLine className="size-5 text-brand-600" /> Écrire comme moi
        </span>
      }
      subtitle="Montrez un CV ou une lettre que vous avez écrit vous-même : vos prochains CV et lettres reprendront votre ton et vos tournures, pas le contenu. Gratuit."
      actions={
        compact ? (
          <button type="button" onClick={() => setOpen(false)} aria-label="Réduire" className="rounded-lg p-1 text-slate-500 hover:bg-slate-100">
            <X className="size-4" />
          </button>
        ) : undefined
      }
    >
      {style && !editing ? (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {style.traits.map((t) => (
              <span key={t} className="rounded-full bg-brand-50 px-3 py-1 text-sm font-medium text-brand-700">
                {t}
              </span>
            ))}
          </div>
          {style.examples.length > 0 && <p className="text-sm text-slate-600">Vos tournures : {style.examples.map((e) => `« ${e} »`).join(', ')}</p>}
          <Toggle label="Utiliser ma façon d’écrire" hint="Pour vos CV, vos lettres et vos préparations d’entretien." checked={enabled} onChange={setEnabled} />
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" icon={<Paperclip className="size-4" />} onClick={() => setEditing(true)}>
              Utiliser un autre document
            </Button>
            <Button variant="ghost" size="sm" icon={<Trash2 className="size-4" />} onClick={clear}>
              Oublier mon style
            </Button>
          </div>
        </div>
      ) : (
        form
      )}
      {error && (
        <div className="mt-3">
          <Notice tone="warn">{error}</Notice>
        </div>
      )}
    </Card>
  );
}
