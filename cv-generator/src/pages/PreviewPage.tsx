import { useState } from 'react';
import { AlertTriangle, Check, CheckCircle2, FileDown, FileText, Languages, Lightbulb, Lock } from 'lucide-react';
import type { Market } from '../../shared/schema.ts';
import { MARKET_LABELS, useActiveCv, useStore } from '../store.ts';
import type { CvDocument, CvSettings } from '../types.ts';
import { ACCENTS, isCvEmpty, toAiContent } from '../lib/cv.ts';
import { api } from '../lib/api.ts';
import { checkCv } from '../lib/checks.ts';
import { cvCliches } from '../lib/naturalCheck.ts';
import { NaturalReview } from '../components/NaturalReview.tsx';
import { isRecommended, recommendedDisplay } from '../lib/recommended.ts';
import { exportCvDocx, exportCvPdf } from '../export/exporters.ts';
import { Preview } from '../components/Preview.tsx';
import { TemplateGallery } from '../components/TemplateGallery.tsx';
import { ProOffer } from '../components/ProUnlock.tsx';
import { isProTemplate } from '../pdf/catalog.ts';
import { ReviseCard } from '../components/ReviseCard.tsx';
import { DossierLink } from './DossierPage.tsx';
import { Button, Card, cx, Notice, Select, Toggle } from '../components/ui.tsx';

export function DesignPanel({ cv }: { cv: CvDocument }) {
  const updateCv = useStore((s) => s.updateCv);
  const set = (patch: Partial<CvSettings>) => updateCv((c) => ({ ...c, settings: { ...c.settings, ...patch } }));
  const st = cv.settings;

  const advice = recommendedDisplay(cv);
  const recommended = isRecommended(cv);

  return (
    <div className="space-y-4">
      <Card tour="templates" title="Modèle" subtitle="13 modèles pensés pour chaque métier et chaque pays, ou le style d’un CV que vous aimez.">
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
              className={cx('hit size-9 rounded-full ring-offset-2 transition', st.accent === c && 'ring-2 ring-slate-900')}
              style={{ backgroundColor: c }}
            />
          ))}
          <label className="relative size-9 cursor-pointer overflow-hidden rounded-full bg-[conic-gradient(red,yellow,lime,aqua,blue,magenta,red)]" title="Autre couleur">
            <input type="color" value={st.accent} onChange={(e) => set({ accent: e.target.value })} className="absolute inset-0 opacity-0" />
          </label>
        </div>
      </Card>

      <Card
        tour="options"
        title="Options d’affichage"
        actions={
          recommended ? (
            <span className="flex items-center gap-1 text-xs font-medium text-emerald-700">
              <CheckCircle2 className="size-4" /> Recommandé
            </span>
          ) : (
            <Button size="sm" variant="secondary" icon={<Check className="size-4" />} onClick={() => set(advice.settings)}>
              Recommandé
            </Button>
          )
        }
      >
        <p className="mb-2 text-xs text-slate-500">{recommended ? advice.reason : `Pas sûr de quoi afficher ? « Recommandé » règle tout selon l’usage. ${advice.reason}`}</p>
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
              className={cx('hit min-h-8 rounded-lg px-3 py-1.5 font-medium', st.headingLang === l ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-700')}
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
  // Ce qu'il fallait débloquer quand la personne a cliqué (Word, ou PDF d'un modèle Pro).
  const [needPro, setNeedPro] = useState<{ kind: 'pdf' | 'docx'; reason: string } | null>(null);
  const pro = Boolean(cv.unlocked);

  async function run(kind: 'pdf' | 'docx', unlockedNow = false) {
    if (!pro && !unlockedNow) {
      if (kind === 'docx') return setNeedPro({ kind, reason: 'L’export Word fait partie de la version Pro.' });
      if (isProTemplate(cv.settings.template)) return setNeedPro({ kind, reason: 'Ce modèle fait partie de la version Pro.' });
    }
    setNeedPro(null);
    setBusy(kind);
    setError(null);
    try {
      // Juste après le paiement, le CV en mémoire n'est pas encore marqué : on le marque pour l'export.
      const doc = unlockedNow ? { ...cv, unlocked: { at: Date.now() } } : cv;
      await (kind === 'pdf' ? exportCvPdf(doc) : exportCvDocx(doc));
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
          {pro ? 'PDF' : 'PDF gratuit'}
        </Button>
        <Button size="lg" variant="secondary" icon={pro ? <FileText className="size-5" /> : <Lock className="size-5" />} loading={busy === 'docx'} onClick={() => run('docx')}>
          Word
        </Button>
      </div>
      <p className="text-xs text-slate-500">
        {pro
          ? 'Le PDF garde exactement la mise en page. Le fichier Word se modifie facilement.'
          : 'Le PDF gratuit porte une petite mention « Créé avec CVCasa » en bas de page.'}
      </p>
      <ProOffer cv={cv} reason={needPro?.reason} onUnlocked={() => needPro && void run(needPro.kind, true)} />
      {error && <Notice tone="error">{error}</Notice>}
      <DossierLink />
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
      tour="translate"
      title={
        <span className="flex items-center gap-2">
          <Languages className="size-5 text-brand-600" /> Mon CV dans une autre langue
        </span>
      }
      subtitle="CVCasa traduit tout votre CV (postes, diplômes, compétences…) et l’adapte aux usages du pays visé. Votre CV d’origine est conservé."
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
      {busy && <p className="mt-2 text-sm text-brand-700">Traduction en cours… (jusqu’à une minute)</p>}
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
      tour="checks"
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
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[360px_minmax(0,1fr)] lg:grid-rows-[auto_auto_auto_auto_1fr]">
      <Card tour="export" title="Télécharger mon CV" className="lg:col-start-1">
        <ExportButtons cv={cv} />
      </Card>
      <div data-tour="preview" className="lg:sticky lg:top-20 lg:col-start-2 lg:row-span-5 lg:row-start-1 lg:self-start">
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
      <div className="space-y-4 lg:col-start-1">
        <ChecksCard cv={cv} />
        {!isCvEmpty(cv) && <NaturalReview hits={cvCliches(cv)} edit="Corrigez directement dans « Mes infos », ou dites-la dans « Corriger mon CV en parlant »." />}
      </div>
    </div>
  );
}
