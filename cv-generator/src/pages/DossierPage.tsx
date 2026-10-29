import { useEffect, useRef, useState } from 'react';
import { create } from 'zustand';
import { ArrowDown, ArrowUp, Camera, Crop, FileStack, FileText, FileUser, Mail, Paperclip, PenLine, RotateCw, ScanLine, Trash2 } from 'lucide-react';
import type { TranscribeResult } from '../../shared/schema.ts';
import { api } from '../lib/api.ts';
import { readAsDataUrl } from '../lib/files.ts';
import { CropEditor } from '../components/CropEditor.tsx';
import { useActiveCv, useStore } from '../store.ts';
import { cvFileName, isCvEmpty } from '../lib/cv.ts';
import { buildDossier, formatSize, FULL_QUAD, orientedPhoto, pdfPageCount, processPhoto, type DossierPart, type Quad, type ScanMode } from '../lib/dossier.ts';
import { isProTemplate } from '../pdf/catalog.ts';
import { saveFile } from '../export/save.ts';
import { Button, Card, cx, Field, Notice, TextArea } from '../components/ui.tsx';
import type { Tab } from '../App.tsx';

type Item =
  | { id: string; kind: 'cv' }
  | { id: string; kind: 'letter' }
  | { id: string; kind: 'pdf'; name: string; bytes: ArrayBuffer; pages: number | null }
  | { id: string; kind: 'photo'; name: string; original: Blob; mode: ScanMode; rotation: 0 | 90 | 180 | 270; quad: Quad; processed: Blob | null; url: string | null };
type Photo = Extract<Item, { kind: 'photo' }>;

const MAX_FILE = 25 * 1024 * 1024;
/** Gratuit : 2 pages scannées par PDF, ou 2 pièces en plus du CV et de la lettre. Au-delà : 1 crédit le PDF. */
const FREE_SCAN_PAGES = 2;
const FREE_DOSSIER_PIECES = 2;
const MAX_TRANSCRIBE_PAGES = 8;
let seq = 0;
const newId = () => `p${Date.now().toString(36)}${++seq}`;

/** Documents envoyés depuis le coffre-fort, ajoutés au dossier à son ouverture. */
export const useDossierInbox = create<{ pending: File[]; add: (f: File) => void; take: () => File[] }>((set, get) => ({
  pending: [],
  add: (f) => set((s) => ({ pending: [...s.pending, f] })),
  take: () => {
    const files = get().pending;
    set({ pending: [] });
    return files;
  },
}));

/** Raccourci vers le dossier depuis les pages d'export. */
export function DossierLink() {
  return (
    <button
      type="button"
      onClick={() => (window.location.hash = 'dossier')}
      className="flex w-full items-center gap-2 rounded-xl border border-dashed border-slate-300 px-3 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50"
    >
      <FileStack className="size-4 shrink-0 text-brand-600" />
      <span>
        <strong>Dossier complet en un seul PDF</strong> : CV, lettre, pièce d’identité, diplômes (scannés avec le téléphone).
      </span>
    </button>
  );
}

/** Bouton d'en-tête : scanner des papiers en PDF, accessible de partout. */
export function ScannerButton({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Scanner un document en PDF"
      title="Scanner un document en PDF"
      className={cx(
        'flex items-center gap-1.5 rounded-xl border px-2 py-1.5 text-sm font-semibold whitespace-nowrap transition-colors sm:px-2.5',
        active ? 'border-brand-600 bg-brand-600 text-white' : 'border-brand-200 bg-brand-50 text-brand-700 hover:bg-brand-100',
      )}
    >
      <ScanLine className="size-4.5" /> Scanner
    </button>
  );
}

/**
 * « Mon dossier en 1 PDF » : CV, lettre, pièces d'identité, diplômes… réunis et scannés sur le téléphone.
 * En mode « scanner », la même page sert simplement à transformer des papiers photographiés en PDF.
 */
export function DossierPage({ onNavigate, mode = 'dossier' }: { onNavigate: (t: Tab) => void; mode?: 'dossier' | 'scanner' }) {
  const scanner = mode === 'scanner';
  const cv = useActiveCv();
  const letter = useStore((s) => s.letter);
  const hasLetter = !!letter.body.trim();
  const cvBlocked = isProTemplate(cv.settings.template) && !cv.unlocked;
  const [items, setItems] = useState<Item[]>(() =>
    scanner
      ? []
      : [
          ...(isCvEmpty(cv) || cvBlocked ? [] : [{ id: 'cv', kind: 'cv' as const }]),
          ...(hasLetter ? [{ id: 'letter', kind: 'letter' as const }] : []),
        ],
  );
  const [fileName, setFileName] = useState(() => (scanner ? 'Document_scanne' : cvFileName(cv, 'pdf', 'Dossier').replace(/\.pdf$/, '')));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const camera = useRef<HTMLInputElement>(null);
  const files = useRef<HTMLInputElement>(null);

  // Libère les aperçus des photos en quittant la page.
  const urls = useRef<string[]>([]);
  useEffect(() => () => urls.current.forEach((u) => URL.revokeObjectURL(u)), []);

  // Pièces envoyées depuis le coffre-fort (« Ajouter au dossier »).
  useEffect(() => {
    const files = useDossierInbox.getState().take();
    if (!files.length) return;
    const list = new DataTransfer();
    files.forEach((f) => list.items.add(f));
    void addFiles(list.files, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [paid, setPaid] = useState(false);
  const [cropping, setCropping] = useState<{ item: Photo; src: string } | null>(null);
  const [transcript, setTranscript] = useState<TranscribeResult | null>(null);
  const [transcribing, setTranscribing] = useState(false);
  const [exporting, setExporting] = useState<'pdf' | 'docx' | null>(null);

  async function render(item: Photo): Promise<Item> {
    const processed = await processPhoto(item.original, item.mode, item.rotation, item.quad);
    const url = URL.createObjectURL(processed);
    urls.current.push(url);
    return { ...item, processed, url };
  }

  const replace = (id: string, next: Item) => setItems((list) => list.map((x) => (x.id === id ? next : x)));

  async function addFiles(list: FileList | null, fromCamera: boolean) {
    if (!list?.length) return;
    setError(null);
    setDone(null);
    for (const f of Array.from(list)) {
      if (f.size > MAX_FILE) {
        setError(`« ${f.name} » est trop lourd (25 Mo maximum).`);
        continue;
      }
      try {
        if (f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')) {
          const bytes = await f.arrayBuffer();
          const id = newId();
          setItems((l) => [...l, { id, kind: 'pdf', name: f.name, bytes, pages: null }]);
          void pdfPageCount(bytes).then((pages) => setItems((l) => l.map((x) => (x.id === id && x.kind === 'pdf' ? { ...x, pages } : x))));
        } else if (f.type.startsWith('image/')) {
          // Photo prise avec l'appareil : rendu « scan » par défaut ; image de la galerie : couleur.
          const base = { id: newId(), kind: 'photo' as const, name: fromCamera ? 'Page scannée' : f.name, original: f as Blob, mode: (fromCamera ? 'scan' : 'couleur') as ScanMode, rotation: 0 as const, quad: FULL_QUAD, processed: null, url: null };
          setItems((l) => [...l, base]);
          const ready = await render(base);
          replace(base.id, ready);
        } else {
          setError(`« ${f.name} » : format non pris en charge (PDF ou image seulement).`);
        }
      } catch (e) {
        setError((e as Error).message || `« ${f.name} » n’a pas pu être ajouté.`);
      }
    }
  }

  async function update(item: Photo, patch: Partial<Pick<Photo, 'mode' | 'rotation' | 'quad'>>) {
    // Les coins sont placés sur la photo tournée : un nouveau quart de tour les remet à zéro.
    const next = { ...item, ...patch, ...(patch.rotation !== undefined ? { quad: FULL_QUAD } : {}), processed: null };
    replace(item.id, { ...next, url: item.url });
    try {
      replace(item.id, await render(next));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const move = (i: number, d: -1 | 1) =>
    setItems((l) => {
      const j = i + d;
      if (j < 0 || j >= l.length) return l;
      const copy = [...l];
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });

  async function openCrop(item: Photo) {
    try {
      const src = URL.createObjectURL(await orientedPhoto(item.original, item.rotation));
      urls.current.push(src);
      setCropping({ item, src });
    } catch (e) {
      setError((e as Error).message);
    }
  }

  // Limite gratuite : pages scannées (scanner) ou pièces ajoutées au CV et à la lettre (dossier).
  const scanPages = items.reduce((n, it) => n + (it.kind === 'photo' ? 1 : it.kind === 'pdf' ? (it.pages ?? 1) : 0), 0);
  const pieces = items.filter((it) => it.kind === 'photo' || it.kind === 'pdf').length;
  const needsCredit = scanner ? scanPages > FREE_SCAN_PAGES : pieces > FREE_DOSSIER_PIECES;

  const photos = items.filter((it): it is Photo => it.kind === 'photo');

  async function transcribe() {
    setTranscribing(true);
    setError(null);
    try {
      const pages = photos.slice(0, MAX_TRANSCRIBE_PAGES);
      if (pages.some((p) => !p.processed)) throw new Error('Une photo est encore en préparation, patientez une seconde.');
      const files = await Promise.all(
        pages.map(async (p, i) => {
          const url = await readAsDataUrl(p.processed!);
          return { name: `page-${i + 1}.jpg`, mediaType: 'image/jpeg' as const, data: url.slice(url.indexOf(',') + 1) };
        }),
      );
      setTranscript(await api.transcribe({ files }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setTranscribing(false);
    }
  }

  async function exportTranscript(kind: 'pdf' | 'docx') {
    if (!transcript) return;
    setExporting(kind);
    setError(null);
    try {
      const base = (fileName.trim() || 'Document').replace(/[\\/:*?"<>|]+/g, '_') + '_texte';
      if (kind === 'pdf') {
        const { renderTranscriptPdf } = await import('../pdf/render.tsx');
        await saveFile(await renderTranscriptPdf(transcript.title, transcript.text), `${base}.pdf`);
      } else {
        const { buildTranscriptDocx, docxBlob } = await import('../export/docx.ts');
        await saveFile(await docxBlob(buildTranscriptDocx(transcript.title, transcript.text)), `${base}.docx`);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setExporting(null);
    }
  }

  async function create() {
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      if (needsCredit && !paid) {
        await api.dossierUnlock();
        setPaid(true);
      }
      const { renderCvPdf, renderLetterPdf } = await import('../pdf/render.tsx');
      const parts: DossierPart[] = [];
      for (const it of items) {
        if (it.kind === 'cv') parts.push({ kind: 'pdf', name: 'CV', bytes: await (await renderCvPdf(cv)).arrayBuffer() });
        else if (it.kind === 'letter') parts.push({ kind: 'pdf', name: 'Lettre', bytes: await (await renderLetterPdf(letter, cv)).arrayBuffer() });
        else if (it.kind === 'pdf') parts.push({ kind: 'pdf', name: it.name, bytes: it.bytes });
        else if (it.processed) parts.push({ kind: 'image', name: it.name, blob: it.processed });
        else throw new Error('Une photo est encore en préparation, patientez une seconde.');
      }
      const blob = await buildDossier(parts);
      const name = `${(fileName.trim() || 'Dossier').replace(/[\\/:*?"<>|]+/g, '_')}.pdf`;
      await saveFile(blob, name);
      setDone(`${name} : ${formatSize(blob.size)}.${blob.size > 5 * 1024 * 1024 ? ' Attention : certains sites limitent les envois à 2 ou 5 Mo.' : ''}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const has = (k: 'cv' | 'letter') => items.some((x) => x.kind === k);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Card
        title={
          <span className="flex items-center gap-2">
            {scanner ? <ScanLine className="size-5 text-brand-600" /> : <FileStack className="size-5 text-brand-600" />}
            {scanner ? 'Scanner en PDF' : 'Mon dossier en un seul PDF'}
          </span>
        }
        subtitle={
          scanner
            ? 'Prenez vos papiers en photo (document écrit à la main, attestation, pièce d’identité…) : ils deviennent un PDF propre, comme passé au scanner. Une photo par page.'
            : 'CV, lettre, pièce d’identité, diplômes, attestations… réunis dans un seul fichier, dans l’ordre voulu. Les documents restent sur votre appareil.'
        }
      >
        <div className="flex flex-wrap gap-2">
          <Button icon={<Camera className="size-4" />} onClick={() => camera.current?.click()}>
            Scanner un document
          </Button>
          <Button variant="secondary" icon={<Paperclip className="size-4" />} onClick={() => files.current?.click()}>
            Ajouter des fichiers (PDF, photos)
          </Button>
          {!scanner && !has('cv') && !isCvEmpty(cv) && !cvBlocked && (
            <Button variant="secondary" icon={<FileUser className="size-4" />} onClick={() => setItems((l) => [{ id: 'cv', kind: 'cv' }, ...l])}>
              Ajouter mon CV
            </Button>
          )}
          {!scanner && !has('letter') && hasLetter && (
            <Button variant="secondary" icon={<Mail className="size-4" />} onClick={() => setItems((l) => [...l.filter((x) => x.kind === 'cv'), { id: 'letter', kind: 'letter' }, ...l.filter((x) => x.kind !== 'cv')])}>
              Ajouter ma lettre
            </Button>
          )}
        </div>
        <input ref={camera} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { void addFiles(e.target.files, true); e.target.value = ''; }} />
        <input ref={files} type="file" multiple accept="application/pdf,image/*" className="hidden" onChange={(e) => { void addFiles(e.target.files, false); e.target.value = ''; }} />
        <p className="mt-2 text-xs text-slate-500">
          Pour scanner : posez la feuille à plat sur une surface sombre, bien éclairée. Une photo par page, puis ajustez les coins avec <Crop className="inline size-3.5" /> si besoin.
        </p>
        <p className="mt-1.5">
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">Recadrage automatique · bientôt</span>
        </p>
        {!scanner && cvBlocked && (
          <div className="mt-3">
            <Notice tone="warn">
              Votre CV utilise un modèle Pro : passez-le en Pro ou choisissez un modèle gratuit dans{' '}
              <button type="button" className="font-semibold underline" onClick={() => onNavigate('apercu')}>
                Aperçu
              </button>{' '}
              pour l’ajouter au dossier.
            </Notice>
          </div>
        )}
      </Card>

      {items.length > 0 && (
        <Card
          title={scanner ? 'Pages scannées' : 'Contenu du dossier'}
          subtitle={scanner ? 'Dans l’ordre du PDF. Utilisez les flèches pour changer l’ordre.' : 'Dans l’ordre où il sera assemblé. Utilisez les flèches pour changer l’ordre.'}
        >
          <ol className="space-y-2">
            {items.map((it, i) => (
              <li key={it.id} className="flex items-center gap-3 rounded-xl border border-slate-200 p-2">
                <span className="w-5 shrink-0 text-center text-sm font-semibold text-slate-400">{i + 1}</span>
                <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-100">
                  {it.kind === 'photo' ? (
                    it.url ? <img src={it.url} alt="" className={cx('size-full object-cover', !it.processed && 'opacity-40')} /> : <span className="size-5 animate-spin rounded-full border-2 border-slate-300 border-t-brand-600" />
                  ) : it.kind === 'cv' ? (
                    <FileUser className="size-6 text-brand-600" />
                  ) : it.kind === 'letter' ? (
                    <Mail className="size-6 text-brand-600" />
                  ) : (
                    <FileText className="size-6 text-red-600" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">
                    {it.kind === 'cv' ? `CV : ${cv.label}` : it.kind === 'letter' ? 'Lettre de motivation' : it.name}
                  </p>
                  {it.kind === 'pdf' && <p className="text-xs text-slate-500">{it.pages ? `${it.pages} page${it.pages > 1 ? 's' : ''}` : 'PDF'}</p>}
                  {(it.kind === 'cv' || it.kind === 'letter') && !cv.unlocked && <p className="text-xs text-slate-500">Version gratuite (avec la mention CVCasa)</p>}
                  {it.kind === 'photo' && (
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <div role="group" aria-label="Rendu" className="inline-flex rounded-full bg-slate-100 p-0.5 text-xs font-medium">
                        {(['scan', 'couleur'] as const).map((m) => (
                          <button
                            key={m}
                            type="button"
                            aria-pressed={it.mode === m}
                            onClick={() => it.mode !== m && void update(it, { mode: m })}
                            className={cx('rounded-full px-2.5 py-1 whitespace-nowrap', it.mode === m ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600')}
                          >
                            {m === 'scan' ? 'Scan N&B' : 'Couleur'}
                          </button>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={() => void update(it, { rotation: (((it.rotation + 90) % 360) as 0 | 90 | 180 | 270) })}
                        className="rounded-full p-1.5 text-slate-600 hover:bg-slate-100"
                        aria-label="Tourner d’un quart de tour"
                        title="Tourner"
                      >
                        <RotateCw className="size-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void openCrop(it)}
                        className={cx('rounded-full p-1.5 hover:bg-slate-100', it.quad !== FULL_QUAD ? 'text-brand-600' : 'text-slate-600')}
                        aria-label="Recadrer la page"
                        title="Recadrer"
                      >
                        <Crop className="size-4" />
                      </button>
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 flex-col">
                  <button type="button" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Monter" className="rounded p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-30">
                    <ArrowUp className="size-4" />
                  </button>
                  <button type="button" disabled={i === items.length - 1} onClick={() => move(i, 1)} aria-label="Descendre" className="rounded p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-30">
                    <ArrowDown className="size-4" />
                  </button>
                </div>
                <button type="button" onClick={() => setItems((l) => l.filter((x) => x.id !== it.id))} aria-label="Retirer" className="shrink-0 rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600">
                  <Trash2 className="size-4" />
                </button>
              </li>
            ))}
          </ol>

          <div className="mt-4">
            <Field label="Nom du fichier" value={fileName} onChange={setFileName} hint="Exemple : Dossier_Awa_Diallo_Comptable" />
          </div>
          <p className={cx('mt-3 text-xs', needsCredit && !paid ? 'text-amber-800' : 'text-slate-500')}>
            {scanner
              ? `Gratuit jusqu’à ${FREE_SCAN_PAGES} pages. Au-delà : 1 crédit pour ce PDF, pages illimitées.`
              : `Gratuit avec le CV, la lettre et ${FREE_DOSSIER_PIECES} pièces. Au-delà : 1 crédit pour ce dossier, pièces illimitées.`}
            {paid && ' Réglé : vous pouvez le recréer autant de fois que nécessaire.'}
          </p>
          <Button className="mt-2" size="lg" icon={<FileStack className="size-5" />} loading={busy} disabled={busy} onClick={() => void create()}>
            Créer le PDF{needsCredit && !paid ? ' (1 crédit)' : ` (${items.length} document${items.length > 1 ? 's' : ''})`}
          </Button>
          {done && (
            <div className="mt-3">
              <Notice tone="success">Dossier créé : {done}</Notice>
            </div>
          )}
        </Card>
      )}

      {scanner && photos.length > 0 && (
        <Card
          title={
            <span className="flex items-center gap-2">
              <PenLine className="size-5 text-brand-600" /> Texte tapé
            </span>
          }
          subtitle="Document écrit à la main ou difficile à lire ? CVCasa le retranscrit en texte tapé propre, modifiable, en PDF ou en Word."
        >
          {!transcript ? (
            <>
              <Button variant="ai" icon={<PenLine className="size-4" />} loading={transcribing} disabled={transcribing} onClick={() => void transcribe()}>
                Transformer en texte tapé ({Math.min(photos.length, MAX_TRANSCRIBE_PAGES)} crédit{Math.min(photos.length, MAX_TRANSCRIBE_PAGES) > 1 ? 's' : ''})
              </Button>
              <p className="mt-2 text-xs text-slate-500">
                1 crédit par page{photos.length > MAX_TRANSCRIBE_PAGES ? ` (les ${MAX_TRANSCRIBE_PAGES} premières pages)` : ''}. Les photos sont envoyées uniquement le temps de la lecture.
              </p>
              {transcribing && <p className="mt-2 text-sm text-brand-700">Lecture de votre document… (jusqu’à une minute)</p>}
            </>
          ) : (
            <div className="space-y-3">
              {/\[illisible\]/.test(transcript.text) && <Notice tone="warn">Certains passages sont marqués [illisible] : complétez-les avant d’enregistrer.</Notice>}
              <Field label="Titre" value={transcript.title} onChange={(title) => setTranscript({ ...transcript, title })} />
              <TextArea value={transcript.text} onChange={(text) => setTranscript({ ...transcript, text })} rows={14} />
              <div className="flex flex-wrap gap-2">
                <Button icon={<FileText className="size-4" />} loading={exporting === 'pdf'} disabled={exporting !== null} onClick={() => void exportTranscript('pdf')}>
                  Enregistrer en PDF
                </Button>
                <Button variant="secondary" icon={<FileText className="size-4" />} loading={exporting === 'docx'} disabled={exporting !== null} onClick={() => void exportTranscript('docx')}>
                  Enregistrer en Word
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {error && <Notice tone="error">{error}</Notice>}

      {cropping && (
        <CropEditor
          src={cropping.src}
          quad={cropping.item.quad}
          onCancel={() => setCropping(null)}
          onDone={(quad) => {
            const item = items.find((x): x is Photo => x.id === cropping.item.id && x.kind === 'photo');
            setCropping(null);
            if (item) void update(item, { quad });
          }}
        />
      )}
    </div>
  );
}
