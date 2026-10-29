import { useEffect, useRef, useState } from 'react';
import { FileUp, Link2, Paperclip, X } from 'lucide-react';
import { useStore } from '../store.ts';
import { api } from '../lib/api.ts';
import { ACCEPTED_DOCS, fileToAttachment } from '../lib/files.ts';
import { useSharedOffer } from '../lib/shareInbox.ts';
import { Button, Card, Notice, TextArea } from './ui.tsx';

const URL_RE = /https?:\/\/[^\s<>"']+/i;

/** Premier lien d'un texte (« Regardez cette offre : https://… »). */
function firstUrl(text: string): string | null {
  const m = text.match(URL_RE);
  return m ? m[0].replace(/[).,;!?»]+$/, '') : null;
}

export function JobInputCard() {
  const job = useStore((s) => s.job);
  const setJob = useStore((s) => s.setJob);
  const shared = useSharedOffer((s) => s.pending);
  const input = useRef<HTMLInputElement>(null);
  const [link, setLink] = useState('');
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    try {
      setJob({ ...job, file: await fileToAttachment(file) });
    } catch (e) {
      setError((e as Error).message);
    }
  }

  /** Lit la page du lien ; en cas d'échec, garde ce qui a été partagé et explique quoi faire. */
  async function readLink(url: string, sharedText = '') {
    setReading(true);
    setError(null);
    setInfo(null);
    try {
      const page = await api.fetchJob(url);
      setJob({ text: `Lien de l’offre : ${page.url}\n\n${page.text}`, file: null });
      setInfo(`Offre lue${page.title ? ` : « ${page.title} »` : ''}. Vérifiez le texte ci-dessous, puis adaptez votre CV.`);
      setLink('');
    } catch (e) {
      // Une publication partagée contient souvent déjà le texte de l'offre : on le garde.
      if (sharedText.replace(URL_RE, '').trim().length > 80) setJob({ text: sharedText, file: null });
      setError((e as Error).message);
    } finally {
      setReading(false);
    }
  }

  // Partage reçu depuis une autre appli (LinkedIn, WhatsApp…).
  useEffect(() => {
    if (!shared) return;
    useSharedOffer.getState().set(null);
    const url = firstUrl(shared);
    // Nouvelle offre partagée : l'ancienne ne doit pas rester affichée si la lecture échoue.
    setJob({ text: '', file: null });
    // Un message partagé qui contient déjà l'offre (texte long) se suffit à lui-même.
    if (url && shared.replace(URL_RE, '').trim().length < 200) {
      setLink(url);
      void readLink(url, shared);
    } else {
      setJob({ text: shared, file: null });
      setInfo('Texte partagé reçu. Vérifiez-le, puis adaptez votre CV.');
    }
    // readLink et setJob ne changent pas d'un rendu à l'autre pour ce qui nous intéresse.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shared]);

  const pastedLink = !link && job.text.trim().length < 400 ? firstUrl(job.text) : null;

  return (
    <Card title="L’offre d’emploi" subtitle="Collez le lien de l’annonce, son texte, ou importez-la en PDF ou en capture d’écran.">
      <div className="flex flex-col gap-2 sm:flex-row">
        <label className="flex min-w-0 flex-1 items-center gap-2 rounded-xl bg-white px-3 ring-1 ring-slate-300 focus-within:ring-2 focus-within:ring-brand-500">
          <Link2 className="size-4 shrink-0 text-slate-400" />
          <span className="sr-only">Lien de l’offre</span>
          <input
            type="url"
            inputMode="url"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && link.trim() && void readLink(link.trim())}
            placeholder="https://… lien de l’offre"
            className="min-w-0 flex-1 bg-transparent py-2.5 text-sm outline-none"
          />
        </label>
        <Button variant="secondary" loading={reading} disabled={!link.trim() || reading} onClick={() => void readLink(link.trim())}>
          Lire l’offre
        </Button>
      </div>
      {info && (
        <div className="mt-2">
          <Notice tone="success">{info}</Notice>
        </div>
      )}
      {pastedLink && !reading && (
        <div className="mt-2 flex flex-wrap items-center gap-2 rounded-xl bg-brand-50 px-3 py-2 text-sm text-brand-900">
          Vous avez collé un lien.
          <Button size="sm" onClick={() => void readLink(pastedLink, job.text)}>
            Lire la page de ce lien
          </Button>
        </div>
      )}

      <div className="mt-3">
        <TextArea
          value={job.text}
          onChange={(text) => setJob({ ...job, text })}
          rows={8}
          placeholder="Ou collez ici le texte de l’annonce : intitulé du poste, missions, profil recherché…"
        />
      </div>
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
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setJob({ text: '', file: null });
              setInfo(null);
              setError(null);
            }}
          >
            Effacer l’offre
          </Button>
        )}
      </div>
      <p className="mt-2 text-xs text-slate-500">Astuce : depuis la page d’une offre, touchez « Partager » puis choisissez CVCasa.</p>
      {error && (
        <div className="mt-3">
          <Notice tone="error">{error}</Notice>
        </div>
      )}
    </Card>
  );
}
