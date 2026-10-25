import { useState } from 'react';
import { AlertTriangle, CheckCircle2, FileDown, FileText, Languages, Lightbulb } from 'lucide-react';
import type { Market } from '../../shared/schema.ts';
import { MARKET_LABELS, useActiveCv, useStore } from '../store.ts';
import type { CvDocument, CvSettings } from '../types.ts';
import { ACCENTS, isCvEmpty, toAiContent } from '../lib/cv.ts';
import { api } from '../lib/api.ts';
import { checkCv } from '../lib/checks.ts';
import { exportCvDocx, exportCvPdf } from '../export/exporters.ts';
import { Preview } from '../components/Preview.tsx';
import { TemplateGallery } from '../components/TemplateGallery.tsx';
import { ReviseCard } from '../components/ReviseCard.tsx';
import { Button, Card, cx, Notice, Select, Toggle } from '../components/ui.tsx';

export function DesignPanel({ cv }: { cv: CvDocument }) {
  const updateCv = useStore((s) => s.updateCv);
  const set = (patch: Partial<CvSettings>) => updateCv((c) => ({ ...c, settings: { ...c.settings, ...patch } }));
  const st = cv.settings;

  return (
    <div className="space-y-4">
      <Card title="Modèle" subtitle="13 modèles pensés pour chaque métier et chaque pays, ou le style d’un CV que vous aimez.">
        <TemplateGallery cv={cv} set={set} />
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

const MARKETS: { value: Market; lang: 'fr' | 'en'; hint: string }[] = [
  { value: 'international', lang: 'en', hint: 'Multinationales, ONG, organisations internationales.' },
  { value: 'uk', lang: 'en', hint: 'Royaume-Uni : orthographe britannique, « CV ».' },
  { value: 'us', lang: 'en', hint: 'États-Unis et Canada anglophone : « resume » très concis.' },
  { value: 'france', lang: 'fr', hint: 'France : diplômes étrangers avec leur équivalent français.' },
  { value: 'afrique', lang: 'fr', hint: 'Afrique francophone.' },
];

function TranslateCard({ cv }: { cv: CvDocument }) {
  const addTranslatedCv = useStore((s) => s.addTranslatedCv);
  const [market, setMarket] = useState<Market>(cv.settings.headingLang === 'en' ? 'france' : 'international');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const target = MARKETS.find((m) => m.value === market)!;

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const res = await api.translate({ cv: toAiContent(cv), targetLang: target.lang, market });
      addTranslatedCv(cv, res, target.lang, market);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          <Languages className="size-5 text-violet-600" /> Mon CV dans une autre langue
        </span>
      }
      subtitle="L’IA traduit tout votre CV (postes, diplômes, compétences…) et l’adapte aux usages du pays visé. Votre CV d’origine est conservé."
    >
      {cv.translation && (
        <div className="mb-3">
          <Notice tone="info">
            Ce CV est la version « {MARKET_LABELS[cv.translation.market]} ».
            {cv.translation.lang === 'en' && ' Photo, date de naissance, nationalité et signature sont masquées, comme le veut l’usage anglophone (vous pouvez les réactiver ci-dessous).'}
            {cv.translation.notes.length > 0 && (
              <ul className="mt-1.5 list-disc pl-5">
                {cv.translation.notes.map((n, i) => (
                  <li key={i}>{n}</li>
                ))}
              </ul>
            )}
          </Notice>
        </div>
      )}
      <Select
        label="Version à créer"
        value={market}
        onChange={setMarket}
        options={MARKETS.map((m) => ({ value: m.value, label: MARKET_LABELS[m.value] }))}
      />
      <p className="mt-1 text-xs text-slate-500">{target.hint}</p>
      <Button className="mt-3" variant="ai" icon={<Languages className="size-4" />} loading={busy} disabled={isCvEmpty(cv)} onClick={run}>
        Créer cette version
      </Button>
      {busy && <p className="mt-2 text-sm text-violet-700">Traduction en cours… (jusqu’à une minute)</p>}
      {error && (
        <div className="mt-3">
          <Notice tone="error">{error}</Notice>
        </div>
      )}
    </Card>
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
    <div className="grid gap-4 lg:grid-cols-[360px_1fr] lg:grid-rows-[auto_auto_auto_auto_1fr]">
      <Card title="Télécharger mon CV" className="lg:col-start-1">
        <ExportButtons cv={cv} />
      </Card>
      <div className="lg:sticky lg:top-20 lg:col-start-2 lg:row-span-5 lg:row-start-1 lg:self-start">
        <div className="mx-auto max-w-[700px]">
          <Preview source={{ kind: 'cv', cv }} />
        </div>
      </div>
      {!isCvEmpty(cv) && (
        <div className="lg:col-start-1">
          <ReviseCard />
        </div>
      )}
      <div className="lg:col-start-1">
        <DesignPanel cv={cv} />
      </div>
      <div className="lg:col-start-1">
        <TranslateCard cv={cv} />
      </div>
      <div className="lg:col-start-1">
        <ChecksCard cv={cv} />
      </div>
    </div>
  );
}
