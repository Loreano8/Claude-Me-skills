import { useMemo, useRef, useState } from 'react';
import { useEffect } from '../lib/safeEffects.ts';
import { Capacitor } from '@capacitor/core';
import { Check, Copy, Eye, ImagePlus, Lock, Palette, Plus, QrCode, Share2, Sparkles, Trash2, Wand2, X } from 'lucide-react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Tab } from '../App.tsx';
import { useActiveCv } from '../store.ts';
import { useAccount } from '../lib/account.ts';
import { api, type MyPortfolio } from '../lib/api.ts';
import { fullName, isCvEmpty } from '../lib/cv.ts';
import { portfolioFromCv } from '../lib/portfolio.ts';
import { saveFile } from '../export/save.ts';
import { fileToAttachment } from '../lib/files.ts';
import { ANIMATED_THEMES, FREE_PORTFOLIO_THEME, PORTFOLIO_PRO_COST, PORTFOLIO_THEMES, slugify, type PortfolioProject, type PortfolioTheme } from '../../shared/portfolio.ts';
import { PortfolioView } from '../portfolio/PortfolioView.tsx';
import { NeedCv } from '../components/NeedCv.tsx';
import { Button, Card, Cost, cx, Disclosure, Field, Notice, TextArea, Toggle } from '../components/ui.tsx';
import { LANG, t } from '../i18n.ts';

// Portfolio en ligne : la page se remplit à partir du CV. La personne choisit un design, ajoute des projets si elle veut,
// et publie. Un lien et un QR code à mettre dans sa candidature, sa signature d'e-mail ou son profil.

export const THEME_INFO: Record<PortfolioTheme, { name: string; hint: string; swatch: [string, string] }> = {
  classique: { name: t('Classique'), hint: t('Sobre et rassurant, pour tous les métiers'), swatch: ['#101a4a', '#ffc933'] },
  epure: { name: t('Épuré'), hint: t('Noir et blanc, très lisible'), swatch: ['#ffffff', '#111827'] },
  creatif: { name: t('Créatif'), hint: t('Fond sombre, projets en premier'), swatch: ['#0b0e17', '#ffc933'] },
  colonne: { name: t('Colonne'), hint: t('Profil à gauche, parcours à droite'), swatch: ['#101a4a', '#f6f8fb'] },
  pastel: { name: t('Pastel'), hint: t('Clair et joyeux, couleurs douces'), swatch: ['#fdf8f1', '#f2545b'] },
  onde: { name: t('Onde'), hint: t('Blanc et net, dégradé qui ondule'), swatch: ['#e0f2fe', '#0e7490'] },
  defile: { name: t('Défilé'), hint: t('Noir et blanc, compétences qui défilent'), swatch: ['#ffffff', '#0a0a0a'] },
  soleil: { name: t('Soleil'), hint: t('Clair, lumières chaudes qui bougent'), swatch: ['#fff3e0', '#f97316'] },
  bento: { name: 'Bento', hint: t('Des tuiles, très tendance, idéal avec des projets'), swatch: ['#eef1f6', '#2549eb'] },
  magazine: { name: t('Magazine'), hint: t('Grande typographie, papier crème, chic'), swatch: ['#f3eee4', '#b4532a'] },
  aurore: { name: t('Aurore'), hint: t('Sombre, lumières animées, effet waouh'), swatch: ['#070b14', '#2dd4bf'] },
};

/** Réglages gardés sur l'appareil entre deux visites (avant comme après publication). */
interface Draft {
  theme: PortfolioTheme;
  projects: PortfolioProject[];
  showPhoto: boolean;
  showPhone: boolean;
  withCv: boolean;
  slug: string;
  video: string;
  accent: string;
}
const usePortfolioDraft = create<Draft & { set: (p: Partial<Draft>) => void }>()(
  persist((set) => ({ theme: FREE_PORTFOLIO_THEME, projects: [], showPhoto: true, showPhone: false, withCv: true, slug: '', video: '', accent: '', set: (p) => set(p) }), { name: 'cvcasa-portfolio' }),
);

/** Image de projet : réduite en JPEG léger (moins de 300 Ko) pour que la page s'ouvre vite. */
async function projectImage(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  let side = 1400;
  for (let i = 0; i < 6; i++) {
    const scale = Math.min(1, side / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) break;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const url = canvas.toDataURL('image/jpeg', i < 2 ? 0.82 : 0.7);
    if (url.length < 380_000) {
      bitmap.close();
      return url;
    }
    side = Math.round(side * 0.75);
  }
  bitmap.close();
  throw new Error(t('Cette image est trop lourde. Essayez une capture d’écran.'));
}

const toBase64 = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '');
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });

export function PortfolioPage({ onNavigate }: { onNavigate: (tab: Tab) => void }) {
  const cv = useActiveCv();
  const token = useAccount((s) => s.token);
  const draft = usePortfolioDraft();
  const [mine, setMine] = useState<MyPortfolio | null>(null);
  const [busy, setBusy] = useState<'publish' | 'stop' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [qr, setQr] = useState('');
  const [copied, setCopied] = useState(false);
  const [adding, setAdding] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMine(null);
    if (!token) return;
    api
      .portfolioGet()
      .then((r) => {
        setMine(r.portfolio);
        // Déjà publié depuis un autre appareil : on reprend son design, son adresse et ses projets.
        if (r.portfolio && !usePortfolioDraft.getState().slug) {
          usePortfolioDraft.getState().set({ theme: r.portfolio.theme, slug: r.portfolio.slug, projects: r.portfolio.data.projects });
        }
      })
      .catch(() => {});
  }, [token]);

  const live = mine?.published ? mine : null;
  useEffect(() => {
    if (!live) return setQr('');
    void import('qrcode').then((QR) => QR.toDataURL(live.url, { margin: 1, width: 480, color: { dark: '#101a4a', light: '#ffffff' } }).then(setQr));
  }, [live?.url]);

  const data = useMemo(
    () => portfolioFromCv(cv, { projects: draft.projects, showPhoto: draft.showPhoto, showPhone: draft.showPhone, cvUrl: draft.withCv ? 'https://cvcasa.com/' : '', video: draft.video, accent: draft.accent }),
    [cv, draft.projects, draft.showPhoto, draft.showPhone, draft.withCv, draft.video, draft.accent],
  );
  const pro = mine?.pro ?? false;
  const needsPro = draft.theme !== FREE_PORTFOLIO_THEME && !pro;

  if (isCvEmpty(cv)) return <NeedCv what="portfolio" />;

  async function cvLink(): Promise<string> {
    if (!draft.withCv) return '';
    const { renderCvPdf } = await import('../pdf/render.tsx');
    // Le lien du CV est remis à jour à chaque publication : le PDF suit le CV et le lien ne périme pas.
    const pdf = await toBase64(await renderCvPdf(cv));
    const share = await api.shareCv(cv.id, fullName(cv.personal) || cv.label || 'CV', pdf);
    return share.url;
  }

  async function publish() {
    if (!token) return useAccount.getState().open('account', t('Créez un compte gratuit ou connectez-vous pour publier votre portfolio.'));
    setBusy('publish');
    setError(null);
    try {
      const cvUrl = await cvLink();
      const slug = slugify(draft.slug);
      const res = await api.portfolioSave({ theme: draft.theme, slug: slug.length >= 3 ? slug : undefined, data: { ...data, cvUrl }, unlock: needsPro });
      setMine(res.portfolio);
      useAccount.getState().setCredits(res.credits);
      usePortfolioDraft.getState().set({ slug: res.portfolio.slug });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      const d = useAccount.getState().dialog;
      if (d !== 'account' && d !== 'credits') setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function stop() {
    setBusy('stop');
    try {
      await api.portfolioStop();
      setMine((m) => (m ? { ...m, published: false } : m));
    } finally {
      setBusy(null);
    }
  }

  async function copy() {
    if (!live) return;
    await navigator.clipboard.writeText(live.url).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  async function send() {
    if (!live) return;
    const text = t('Mon portfolio : {0}', [live.url]);
    if (Capacitor.isNativePlatform()) {
      const { Share } = await import('@capacitor/share');
      await Share.share({ title: t('Mon portfolio'), text, url: live.url, dialogTitle: t('Envoyer mon portfolio') }).catch(() => {});
    } else if (navigator.share) {
      await navigator.share({ title: t('Mon portfolio'), url: live.url }).catch(() => {});
    } else {
      await copy();
    }
  }

  async function saveQr() {
    if (!qr) return;
    const blob = await (await fetch(qr)).blob();
    await saveFile(blob, `QR_portfolio_${(fullName(cv.personal) || 'CV').replace(/\s+/g, '_')}.png`);
  }

  const setProjects = (projects: PortfolioProject[]) => draft.set({ projects });

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <header>
        <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl">{t('Mon portfolio en ligne')}</h1>
        <p className="mt-1 max-w-2xl text-[15px] text-slate-600">
          {t('Une page web à votre nom, déjà remplie à partir de votre CV : parcours, diplômes, réalisations. Choisissez un design, publiez, et donnez le lien aux recruteurs.')}
        </p>
      </header>

      {live && (
        <Card
          title={
            <span className="flex items-center gap-2">
              <Check className="size-5 text-emerald-600" aria-hidden="true" /> {t('Votre portfolio est en ligne')}
            </span>
          }
        >
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
            {qr && <img src={qr} alt={t('QR code vers votre portfolio')} className="size-32 shrink-0 rounded-xl ring-1 ring-slate-200" />}
            <div className="w-full min-w-0 space-y-2">
              <a href={live.url} target="_blank" rel="noopener noreferrer" className="block truncate rounded-xl bg-slate-50 px-3 py-2 text-sm font-medium text-brand-700 ring-1 ring-slate-200 hover:underline">
                {live.url.replace(/^https?:\/\//, '')}
              </a>
              <div className="flex flex-wrap gap-2">
                <Button icon={<Share2 className="size-4" />} onClick={() => void send()}>
                  {t('Envoyer le lien')}
                </Button>
                <Button variant="secondary" icon={copied ? <Check className="size-4" /> : <Copy className="size-4" />} onClick={() => void copy()}>
                  {copied ? t('Copié') : t('Copier')}
                </Button>
                <Button variant="secondary" icon={<QrCode className="size-4" />} onClick={() => void saveQr()}>
                  {t('Enregistrer le QR code')}
                </Button>
              </div>
              <p className="text-xs text-slate-500">{t('Vous avez changé votre CV, vos projets ou le design ? Touchez « Mettre à jour ma page » plus bas : le lien reste le même.')}</p>
            </div>
          </div>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] lg:items-start">
        <div className="space-y-4">
          <Card title={t('1. Choisissez un design')}>
            {[
              { title: t('Simples'), animated: false, hint: t('Sobres et efficaces, pour tous les métiers.'), themes: PORTFOLIO_THEMES.filter((x) => !ANIMATED_THEMES.includes(x)) },
              { title: t('Animés'), animated: true, hint: t('Des lumières qui bougent doucement : pour marquer les esprits.'), themes: [...ANIMATED_THEMES] },
            ].map((group) => (
            <div key={group.title} className="mb-4 last:mb-0">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
              {group.animated && <Sparkles className="size-4 text-sun-700" aria-hidden="true" />}
              {group.title}
            </p>
            <p className="mb-2 text-xs text-slate-500">{group.hint}</p>
            <div className="grid grid-cols-2 gap-2.5" role="radiogroup" aria-label={group.title}>
              {group.themes.map((th) => {
                const info = THEME_INFO[th];
                const selected = draft.theme === th;
                const locked = th !== FREE_PORTFOLIO_THEME && !pro;
                return (
                  <button
                    key={th}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => {
                      draft.set({ theme: th });
                      previewRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className={cx(
                      'rounded-xl border p-2.5 text-left transition-colors',
                      selected ? 'border-brand-600 bg-brand-50 ring-2 ring-brand-600' : 'border-slate-200 bg-white hover:border-slate-300',
                    )}
                  >
                    <span className="mb-2 flex h-12 overflow-hidden rounded-lg ring-1 ring-slate-200" aria-hidden="true">
                      <span className="w-2/3" style={{ background: info.swatch[0] }} />
                      <span className="w-1/3" style={{ background: info.swatch[1] }} />
                    </span>
                    <span className="flex items-center justify-between gap-1">
                      <span className="text-sm font-semibold text-ink">{info.name}</span>
                      {locked ? (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-sun-100 px-1.5 py-0.5 text-[11px] font-semibold text-sun-900">
                          <Lock className="size-3" aria-hidden="true" /> Pro
                        </span>
                      ) : (
                        th === FREE_PORTFOLIO_THEME && !pro && <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-900">{t('Offert')}</span>
                      )}
                    </span>
                    <span className="mt-0.5 block text-xs leading-snug text-slate-500">{info.hint}</span>
                  </button>
                );
              })}
            </div>
            </div>
            ))}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 text-sm font-medium text-slate-800 hover:bg-slate-50">
                <Palette className="size-4 text-brand-600" aria-hidden="true" /> {t('Couleur')}
                <input
                  type="color"
                  value={draft.accent || '#2549eb'}
                  onChange={(e) => draft.set({ accent: e.target.value })}
                  className="size-6 cursor-pointer rounded border-0 bg-transparent p-0"
                  aria-label={t('Couleur principale du portfolio')}
                />
              </label>
              {draft.accent && (
                <button type="button" className="hit text-sm font-medium text-brand-700 underline-offset-2 hover:underline" onClick={() => draft.set({ accent: '' })}>
                  {t('Couleur du design')}
                </button>
              )}
            </div>
            <Inspire onPick={(theme, accent) => draft.set({ theme, accent })} />
          </Card>

          <Card title={t('2. Ajoutez vos projets')} subtitle={t('Facultatif. Une photo, un titre, deux lignes : un chantier, une campagne, une appli, un dossier de soins anonymisé…')}>
            {draft.projects.length > 0 && (
              <ul className="mb-3 space-y-2">
                {draft.projects.map((p, i) => (
                  <li key={i} className="flex items-center gap-3 rounded-xl border border-slate-200 p-2">
                    {p.image ? <img src={p.image} alt="" className="size-12 shrink-0 rounded-lg object-cover" /> : <span className="size-12 shrink-0 rounded-lg bg-slate-100" />}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-ink">{p.title}</span>
                      {p.text && <span className="block truncate text-xs text-slate-500">{p.text}</span>}
                    </span>
                    <button type="button" className="hit rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-red-700" aria-label={t('Retirer ce projet')} onClick={() => setProjects(draft.projects.filter((_, j) => j !== i))}>
                      <Trash2 className="size-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="mb-3">
              <Field
                label={t('Vidéo de présentation (facultatif)')}
                hint={t('Un lien YouTube, Vimeo ou Loom : une minute pour vous présenter, face caméra ou en montrant votre travail.')}
                placeholder="https://youtu.be/…"
                value={draft.video}
                onChange={(v) => draft.set({ video: v.trim().slice(0, 300) })}
              />
              <div className="mt-2">
                <Disclosure title={t('Comment faire ma vidéo en 5 minutes')} hint={t('Avec votre téléphone, sans matériel')}>
                  <ol className="list-decimal space-y-1.5 pl-5 pt-1 text-sm text-slate-700">
                    <li>{t('Placez-vous face à une fenêtre (lumière de face), fond simple, téléphone posé à hauteur des yeux, à l’horizontale.')}</li>
                    <li>{t('Parlez 60 à 90 secondes : qui vous êtes et votre métier, une réussite avec un chiffre, puis le poste que vous cherchez.')}</li>
                    <li>{t('Souriez, regardez l’objectif, parlez lentement. Refaites-la deux ou trois fois et gardez la meilleure.')}</li>
                    <li>{t('Mettez-la sur YouTube en « Non répertoriée » (seules les personnes qui ont le lien la voient), copiez le lien et collez-le ci-dessus.')}</li>
                  </ol>
                  <p className="mt-2 rounded-xl bg-sun-50 px-3 py-2 text-xs text-slate-700 ring-1 ring-sun-200">
                    <span className="mr-1 rounded-full bg-sun-100 px-2 py-0.5 font-semibold text-sun-900">{t('Bientôt')}</span>
                    {t('CVCasa montera pour vous un portfolio vidéo animé à partir de votre CV, prêt à partager.')}
                  </p>
                </Disclosure>
              </div>
            </div>
            {adding ? (
              <ProjectForm
                onCancel={() => setAdding(false)}
                onAdd={(p) => {
                  setProjects([...draft.projects, p]);
                  setAdding(false);
                }}
              />
            ) : (
              draft.projects.length < 6 && (
                <Button variant="secondary" icon={<Plus className="size-4" />} onClick={() => setAdding(true)}>
                  {t('Ajouter un projet')}
                </Button>
              )
            )}
          </Card>

          <Card title={t('3. Publiez')}>
            <Disclosure title={t('Ce qui s’affiche')} hint={t('Photo, téléphone, bouton CV, adresse de la page')}>
              <div className="space-y-1 pt-1">
                {cv.photo && <Toggle label={t('Montrer ma photo')} checked={draft.showPhoto} onChange={(v) => draft.set({ showPhoto: v })} />}
                <Toggle label={t('Montrer mon numéro de téléphone')} hint={t('Visible par toute personne qui a le lien.')} checked={draft.showPhone} onChange={(v) => draft.set({ showPhone: v })} />
                <Toggle label={t('Bouton « Télécharger mon CV »')} hint={t('Votre CV en PDF, mis à jour à chaque publication.')} checked={draft.withCv} onChange={(v) => draft.set({ withCv: v })} />
                <div className="pt-2">
                  <Field
                    label={t('Adresse de la page')}
                    hint={t('Laissez vide : elle sera faite à partir de votre nom.')}
                    value={draft.slug}
                    placeholder={slugify(fullName(cv.personal)) || 'prenom-nom'}
                    onChange={(v) => draft.set({ slug: v.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 40) })}
                  />
                  <p className="mt-1 text-xs text-slate-500">cvcasa.com/p/#{slugify(draft.slug) || slugify(fullName(cv.personal)) || 'prenom-nom'}</p>
                </div>
              </div>
            </Disclosure>

            {needsPro && (
              <div className="mt-3 rounded-xl border border-sun-300 bg-sun-50 p-3 text-sm text-slate-800">
                <p className="flex items-center gap-1.5 font-semibold text-ink">
                  <Sparkles className="size-4 text-sun-700" aria-hidden="true" /> {t('Portfolio Pro')}
                </p>
                <p className="mt-1">{t('Tous les designs (7, dont un animé), à changer quand vous voulez, et une page sans la mention CVCasa en bas. Payé une seule fois.')}</p>
              </div>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button size="lg" className="w-full sm:w-auto" loading={busy === 'publish'} icon={needsPro ? <Lock className="size-4" /> : undefined} onClick={() => void publish()}>
                {needsPro ? t('Débloquer et publier') : live ? t('Mettre à jour ma page') : t('Publier mon portfolio')}
                {needsPro ? <Cost n={PORTFOLIO_PRO_COST} /> : !live && <Cost free />}
              </Button>
              {needsPro && (
                <button type="button" className="hit text-sm font-medium text-brand-700 underline-offset-2 hover:underline" onClick={() => draft.set({ theme: FREE_PORTFOLIO_THEME })}>
                  {t('Garder le design offert')}
                </button>
              )}
            </div>
            {error && (
              <div className="mt-3">
                <Notice tone="error">{error}</Notice>
              </div>
            )}
            {live && (
              <Button variant="danger" size="sm" className="mt-3" loading={busy === 'stop'} onClick={() => void stop()}>
                {t('Retirer ma page')}
              </Button>
            )}
            <p className="mt-3 text-xs text-slate-500">
              {t('Le contenu vient de votre CV.')}{' '}
              <button type="button" className="font-medium text-brand-700 underline-offset-2 hover:underline" onClick={() => onNavigate('infos')}>
                {t('Modifier mon CV')}
              </button>
            </p>
          </Card>
        </div>

        <section aria-label={t('Aperçu du portfolio')} className="lg:sticky lg:top-20">
          <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-600">
            <Eye className="size-4" aria-hidden="true" /> {t('Aperçu : ce que verra le recruteur')}
          </p>
          <div ref={previewRef} className="max-h-[70vh] overflow-y-auto rounded-2xl shadow-lg ring-1 ring-slate-200 lg:max-h-[calc(100dvh-8rem)]">
            <PortfolioView data={data} theme={draft.theme} pro={pro || draft.theme !== FREE_PORTFOLIO_THEME} home="#" />
          </div>
        </section>
      </div>
    </div>
  );
}

/**
 * « S'inspirer d'un portfolio que j'aime » : une capture d'écran d'une page qui plaît ; on garde son style
 * (design le plus proche et couleur), jamais son contenu. 1 crédit.
 */
function Inspire({ onPick }: { onPick: (theme: PortfolioTheme, accent: string) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ tone: 'success' | 'warn' | 'error'; text: string } | null>(null);

  async function pick(f: File | undefined) {
    if (!f) return;
    setBusy(true);
    setNote(null);
    try {
      const { size: _size, ...file } = await fileToAttachment(f);
      if (file.mediaType === 'text/plain') throw new Error(t('Importez une capture d’écran du portfolio qui vous plaît.'));
      const r = await api.portfolioStyle({ file });
      if (!r.isPortfolio) {
        setNote({ tone: 'warn', text: t('Cette image ne ressemble pas à une page de portfolio. Essayez une capture d’écran du site qui vous plaît.') });
        return;
      }
      const accent = /^#[0-9a-fA-F]{6}$/.test(r.accent) ? r.accent : '';
      onPick(r.theme, accent);
      setNote({ tone: 'success', text: t('Design « {0} » choisi, avec la couleur de votre modèle. {1} Votre contenu reste le vôtre : rien n’est copié.', [THEME_INFO[r.theme].name, LANG === 'fr' ? r.summary : '']) });
    } catch (e) {
      const d = useAccount.getState().dialog;
      if (d !== 'account' && d !== 'credits') setNote({ tone: 'error', text: (e as Error).message });
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  }

  return (
    <div className="mt-3 rounded-xl border border-dashed border-brand-300 bg-brand-50/60 p-3">
      <input ref={input} type="file" accept="image/*,application/pdf" className="sr-only" onChange={(e) => void pick(e.target.files?.[0])} />
      <p className="text-sm font-semibold text-ink">{t('Vous avez vu un portfolio qui vous plaît ?')}</p>
      <p className="mt-0.5 text-xs text-slate-600">{t('Envoyez une capture d’écran : on reprend son style (disposition et couleur) avec vos informations à vous.')}</p>
      <Button variant="secondary" size="sm" className="mt-2" loading={busy} icon={<Wand2 className="size-4" />} onClick={() => input.current?.click()}>
        {t('M’inspirer de ce portfolio')} <Cost n={1} />
      </Button>
      {note && (
        <div className="mt-2">
          <Notice tone={note.tone}>{note.text}</Notice>
        </div>
      )}
    </div>
  );
}

function ProjectForm({ onAdd, onCancel }: { onAdd: (p: PortfolioProject) => void; onCancel: () => void }) {
  const [p, setP] = useState<PortfolioProject>({ title: '', text: '', link: '', image: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  async function pick(file: File | undefined) {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      setP((x) => ({ ...x, image: '' }));
      const image = await projectImage(file);
      setP((x) => ({ ...x, image }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
      <input ref={input} type="file" accept="image/*" className="sr-only" onChange={(e) => void pick(e.target.files?.[0])} />
      {p.image ? (
        <div className="relative">
          <img src={p.image} alt="" className="aspect-[16/10] w-full rounded-lg object-cover" />
          <button type="button" className="absolute top-2 right-2 rounded-full bg-white/90 p-1.5 text-slate-700 shadow" aria-label={t('Retirer l’image')} onClick={() => setP({ ...p, image: '' })}>
            <X className="size-4" />
          </button>
        </div>
      ) : (
        <Button variant="secondary" className="w-full" loading={loading} icon={<ImagePlus className="size-4" />} onClick={() => input.current?.click()}>
          {t('Ajouter une image')}
        </Button>
      )}
      {error && <Notice tone="error">{error}</Notice>}
      <Field label={t('Titre du projet')} value={p.title} onChange={(v) => setP({ ...p, title: v.slice(0, 80) })} />
      <TextArea label={t('En deux lignes')} hint={t('Ce que vous avez fait, et le résultat.')} rows={2} value={p.text} onChange={(v) => setP({ ...p, text: v.slice(0, 400) })} />
      <Field label={t('Lien (facultatif)')} value={p.link} placeholder="behance.net/…" onChange={(v) => setP({ ...p, link: v.trim().slice(0, 300) })} />
      <div className="flex gap-2">
        <Button disabled={!p.title.trim() || loading} onClick={() => onAdd({ ...p, title: p.title.trim(), text: p.text.trim() })}>
          {t('Ajouter')}
        </Button>
        <Button variant="secondary" onClick={onCancel}>
          {t('Annuler')}
        </Button>
      </div>
    </div>
  );
}
