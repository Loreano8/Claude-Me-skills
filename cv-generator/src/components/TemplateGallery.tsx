import { useRef, useState } from 'react';
import { CheckCircle2, ImageUp, Palette, XCircle } from 'lucide-react';
import type { TemplateAnalysis, TemplateStyle } from '../../shared/schema.ts';
import type { CvDocument, CvSettings } from '../types.ts';
import { api } from '../lib/api.ts';
import { fileToAttachment } from '../lib/files.ts';
import { CATALOG, CATEGORY_LABELS, catalogEntry, isProTemplate, settingsForTemplate, type CatalogEntry, type TemplateCategory } from '../pdf/catalog.ts';
import { tint } from '../pdf/theme.ts';
import { Button, cx, Notice } from './ui.tsx';

const bar = 'h-1 rounded bg-slate-300';

/** Vignettes des 3 modèles dessinés à la main. */
function LegacyThumb({ id, accent }: { id: string; accent: string }) {
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
        {[0, 1].map((i) => (
          <div key={i} className="flex gap-1">
            <div className="h-1 w-3 rounded" style={{ backgroundColor: accent }} />
            <div className={cx(bar, 'flex-1')} />
          </div>
        ))}
      </div>
    </div>
  );
}

function ThumbHeading({ st, onColor }: { st: TemplateStyle; onColor?: boolean }) {
  const c = onColor ? '#ffffff' : st.accent;
  switch (st.headingStyle) {
    case 'pill':
      return <div className="h-1.5 w-6 rounded-sm" style={{ backgroundColor: onColor ? 'rgba(255,255,255,.8)' : c }} />;
    case 'bar':
      return (
        <div className="flex items-center gap-0.5">
          <div className="h-1.5 w-0.5" style={{ backgroundColor: c }} />
          <div className="h-1 w-5 rounded bg-slate-500" />
        </div>
      );
    case 'underline':
      return <div className="h-0.5 w-full" style={{ backgroundColor: c }} />;
    default:
      return <div className="h-1 w-6 rounded" style={{ backgroundColor: onColor ? c : st.headingStyle === 'plain' ? '#475569' : c }} />;
  }
}

function ThumbBody({ st, lines = 2 }: { st: TemplateStyle; lines?: number }) {
  return (
    <div className="space-y-1">
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className="space-y-0.5">
          <ThumbHeading st={st} />
          <div className={bar} />
          <div className={cx(bar, 'w-3/4')} />
        </div>
      ))}
    </div>
  );
}

/** Vignette dessinée à partir d'une fiche de style (catalogue ou modèle importé). */
export function StyleThumb({ st }: { st: TemplateStyle }) {
  const center = st.headerAlign === 'center';
  const name = <div className={cx('h-1.5 w-1/2 rounded', center && 'mx-auto')} style={{ backgroundColor: st.accent }} />;
  if (st.layout === 'sidebar-left' || st.layout === 'sidebar-right') {
    const bg = st.sidebarTone === 'light' ? tint(st.accent, 0.85) : st.sidebarTone === 'dark' ? '#1f2937' : st.accent;
    const side = (
      <div className="w-1/3 space-y-1 p-1.5" style={{ backgroundColor: bg }}>
        <div className={cx('mx-auto size-4 bg-white/70', st.photoShape === 'round' ? 'rounded-full' : 'rounded-sm')} />
        <ThumbHeading st={st} onColor={st.sidebarTone !== 'light'} />
        <div className={cx('h-0.5 rounded', st.sidebarTone === 'light' ? 'bg-slate-400' : 'bg-white/60')} />
      </div>
    );
    return (
      <div className={cx('flex h-full', st.layout === 'sidebar-right' && 'flex-row-reverse')}>
        {side}
        <div className="flex-1 space-y-1 p-1.5">
          {name}
          <ThumbBody st={st} />
        </div>
      </div>
    );
  }
  if (st.layout === 'banner') {
    return (
      <div>
        <div className={cx('flex items-center p-1.5', center ? 'justify-center' : 'justify-between')} style={{ backgroundColor: st.accent }}>
          <div className="h-1.5 w-1/2 rounded bg-white/80" />
          {!center && <div className={cx('size-3.5 bg-white/70', st.photoShape === 'round' ? 'rounded-full' : 'rounded-sm')} />}
        </div>
        <div className="p-1.5">
          <ThumbBody st={st} />
        </div>
      </div>
    );
  }
  if (st.layout === 'labels') {
    return (
      <div className="space-y-1.5 p-1.5">
        {name}
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex gap-1">
            <div className="h-1 w-3 rounded" style={{ backgroundColor: st.accent }} />
            <div className="flex-1 space-y-0.5 border-l border-slate-200 pl-1">
              <div className={bar} />
              <div className={cx(bar, 'w-2/3')} />
            </div>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="space-y-1 p-1.5">
      {center && <div className={cx('mx-auto size-3.5 bg-slate-300', st.photoShape === 'round' ? 'rounded-full' : 'rounded-sm')} />}
      {name}
      <div className={cx('h-0.5 w-2/3 rounded bg-slate-200', center && 'mx-auto')} />
      <ThumbBody st={st} />
    </div>
  );
}

function Thumb({ entry, accent }: { entry: CatalogEntry; accent: string }) {
  return entry.style ? <StyleThumb st={{ ...entry.style, accent }} /> : <LegacyThumb id={entry.id} accent={accent} />;
}

const VERDICT = {
  recommande: { label: 'Modèle recommandé', tone: 'bg-emerald-100 text-emerald-800' },
  acceptable: { label: 'Modèle correct', tone: 'bg-amber-100 text-amber-800' },
  deconseille: { label: 'Modèle déconseillé', tone: 'bg-rose-100 text-rose-800' },
} as const;

/** « Je veux un CV dans ce style-là » : l'IA juge le modèle importé et en reprend le style. */
function TemplateImport({ onApply, onClose }: { onApply: (patch: Partial<CvSettings>) => void; onClose: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TemplateAnalysis | null>(null);

  async function onFile(f: File | undefined) {
    if (!f) return;
    setError(null);
    setResult(null);
    setBusy(true);
    try {
      const { size: _size, ...file } = await fileToAttachment(f);
      if (file.mediaType === 'text/plain') throw new Error('Importez une photo ou un PDF du CV modèle.');
      setResult(await api.analyzeTemplate({ file }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  }

  const applyCustom = (r: TemplateAnalysis) => {
    const { style, ...analysis } = r;
    onApply({ template: 'perso', customStyle: style, customAnalysis: analysis, accent: style.accent, photoShape: style.photoShape });
    onClose();
  };
  const closest = result ? catalogEntry(result.closestTemplate) : undefined;

  return (
    <div className="mt-3 rounded-xl border border-brand-200 bg-brand-50/60 p-4">
      <p className="flex items-center gap-2 font-semibold text-slate-900">
        <Palette className="size-4 text-brand-600" /> Un CV dans le style que vous aimez
      </p>
      <p className="mt-1 text-sm text-slate-600">
        Importez la photo ou le PDF d’un CV dont le style vous plaît. CVCasa vérifie qu’il est vraiment professionnel, puis reproduit sa mise en page avec
        vos informations, en corrigeant ses défauts. Seul le style est repris, jamais le contenu. 1 crédit.
      </p>
      <input ref={input} type="file" accept="application/pdf,image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="ai" size="sm" icon={<ImageUp className="size-4" />} loading={busy} onClick={() => input.current?.click()}>
          {result ? 'Essayer un autre modèle' : 'Importer le CV modèle'}
        </Button>
        <Button variant="ghost" size="sm" onClick={onClose}>
          Fermer
        </Button>
      </div>
      {busy && <p className="mt-3 text-sm text-brand-700">Analyse du modèle…</p>}
      {error && (
        <div className="mt-3">
          <Notice tone="error">{error}</Notice>
        </div>
      )}

      {result && !result.isCv && (
        <div className="mt-3">
          <Notice tone="warn">Ce document ne ressemble pas à un CV. Importez la photo ou le PDF d’un CV dont vous aimez la présentation.</Notice>
        </div>
      )}

      {result?.isCv && (
        <div className="mt-4 space-y-3 rounded-xl bg-white p-4 ring-1 ring-brand-100">
          <div className="flex flex-wrap items-center gap-3">
            <div className="h-28 w-[5.5rem] shrink-0 overflow-hidden rounded-md bg-white ring-1 ring-slate-200">
              <StyleThumb st={result.style} />
            </div>
            <div className="min-w-0 flex-1">
              <span className={cx('inline-block rounded-full px-2.5 py-1 text-xs font-semibold', VERDICT[result.verdict].tone)}>
                {VERDICT[result.verdict].label} · {Math.round(result.score)}/100
              </span>
              <p className="mt-2 text-sm text-slate-700">{result.summary}</p>
              {!result.atsFriendly && <p className="mt-1 text-xs text-slate-500">L’original serait mal lu par les logiciels de tri des recruteurs ; notre version, si.</p>}
            </div>
          </div>
          {result.strengths.length > 0 && (
            <ul className="space-y-1 text-sm text-slate-700">
              {result.strengths.map((x, i) => (
                <li key={i} className="flex gap-2">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" /> {x}
                </li>
              ))}
            </ul>
          )}
          {result.issues.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-slate-800">Corrigé dans votre version :</p>
              <ul className="mt-1 space-y-1 text-sm text-slate-700">
                {result.issues.map((x, i) => (
                  <li key={i} className="flex gap-2">
                    <XCircle className="mt-0.5 size-4 shrink-0 text-rose-500" /> {x}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {result.verdict === 'deconseille' && closest ? (
              <>
                <Button size="sm" onClick={() => {
                    onApply(settingsForTemplate(closest));
                    onClose();
                  }}>
                  Prendre le modèle « {closest.name} » à la place
                </Button>
                <Button variant="secondary" size="sm" onClick={() => applyCustom(result)}>
                  Utiliser quand même ce style (version corrigée)
                </Button>
              </>
            ) : (
              <>
                <Button size="sm" onClick={() => applyCustom(result)}>
                  Utiliser ce style pour mon CV
                </Button>
                {closest && (
                  <Button variant="secondary" size="sm" onClick={() => {
                    onApply(settingsForTemplate(closest));
                    onClose();
                  }}>
                    Voir le modèle proche « {closest.name} »
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function TemplateGallery({ cv, set }: { cv: CvDocument; set: (patch: Partial<CvSettings>) => void }) {
  const st = cv.settings;
  const [category, setCategory] = useState<TemplateCategory | 'all'>('all');
  const [importing, setImporting] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const shown = category === 'all' ? CATALOG : CATALOG.filter((t) => t.category === category);
  const current = st.template === 'perso' ? null : catalogEntry(st.template);

  const tile = (selected: boolean) =>
    cx('rounded-xl border-2 p-1.5 text-left transition', selected ? 'border-brand-600 bg-brand-50' : 'border-slate-200 hover:border-slate-300');

  return (
    <div>
      <div className="-mx-1 mb-3 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {(['all', ...Object.keys(CATEGORY_LABELS)] as (TemplateCategory | 'all')[]).map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCategory(c)}
            className={cx('shrink-0 rounded-full px-3 py-1 text-xs font-medium', category === c ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700')}
          >
            {c === 'all' ? 'Tous' : CATEGORY_LABELS[c]}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-3">
        {st.customStyle && (
          <button type="button" onClick={() => set({ template: 'perso', accent: st.customStyle!.accent })} className={tile(st.template === 'perso')}>
            <div className="aspect-[1/1.25] overflow-hidden rounded-md bg-white ring-1 ring-slate-200">
              <StyleThumb st={{ ...st.customStyle, accent: st.template === 'perso' ? st.accent : st.customStyle.accent }} />
            </div>
            <p className="mt-1.5 flex items-center gap-1 text-xs font-semibold text-slate-800 sm:text-sm">
              <span className="truncate">Mon style</span>
              {!cv.unlocked && <span className="shrink-0 rounded bg-amber-100 px-1 text-[10px] font-bold text-amber-800">PRO</span>}
            </p>
          </button>
        )}
        {shown.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              set(settingsForTemplate(t));
              setNote(t.settingsNote ?? null);
            }}
            className={tile(st.template === t.id)}
          >
            <div className="aspect-[1/1.25] overflow-hidden rounded-md bg-white ring-1 ring-slate-200">
              <Thumb entry={t} accent={st.template === t.id ? st.accent : t.accent} />
            </div>
            <p className="mt-1.5 flex items-center gap-1 text-xs font-semibold text-slate-800 sm:text-sm">
              <span className="truncate">{t.name}</span>
              {isProTemplate(t.id) && !cv.unlocked && <span className="shrink-0 rounded bg-amber-100 px-1 text-[10px] font-bold text-amber-800">PRO</span>}
            </p>
          </button>
        ))}
        <button type="button" onClick={() => setImporting(true)} className="flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-brand-300 p-2 text-center text-brand-700 hover:bg-brand-50">
          <ImageUp className="size-6" />
          <span className="text-xs font-semibold">Importer un modèle que j’aime</span>
        </button>
      </div>

      <p className="mt-2 text-xs text-slate-500">
        {st.template === 'perso'
          ? `Mon style${st.customAnalysis ? ` : ${st.customAnalysis.summary}` : ''}`
          : current
            ? `${current.name} : ${current.idealFor}`
            : null}
      </p>
      {note && (
        <div className="mt-2">
          <Notice tone="info">{note}</Notice>
        </div>
      )}
      {importing && <TemplateImport onApply={set} onClose={() => setImporting(false)} />}
    </div>
  );
}
