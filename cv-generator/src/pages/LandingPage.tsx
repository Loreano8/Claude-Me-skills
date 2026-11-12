import { useEffect, useRef, useState } from 'react';
import { ArrowRight, BadgeCheck, ChevronLeft, ChevronRight, FileUp, BellRing, Briefcase, Check, ClipboardList, FileDown, FileStack, Globe2, GraduationCap, Languages, Link2, Mail, MessagesSquare, PenLine, PlayCircle, Send, ShieldCheck, Target, UserRound } from 'lucide-react';
import { PACKS } from '../../server/payments.ts';
import { HeroScene } from '../components/HeroScene.tsx';
import type { Tab } from '../App.tsx';
import { Button, cx } from '../components/ui.tsx';
import { useActiveCv, useStore } from '../store.ts';
import { isCvEmpty } from '../lib/cv.ts';
import { api, type PublicTestimonial } from '../lib/api.ts';
import { FAQ } from '../lib/faq.ts';
import { GUIDES, KIND_LABEL, type GuideKind } from '../../seo/guides.ts';
import { Capacitor } from '@capacitor/core';
import { PUBLIC_SITE } from '../lib/referral.ts';

import { LANG, t } from '../i18n.ts';
import { CATALOG, isProTemplate, settingsForTemplate } from '../pdf/catalog.ts';
// Dans l'application Android, les guides s'ouvrent sur le site.
const GUIDE_BASE = Capacitor.isNativePlatform() ? PUBLIC_SITE.replace(/\/$/, '') : '';
const GUIDE_GROUPS: { kind: GuideKind; icon: typeof Target }[] = [
  { kind: 'metier', icon: Briefcase },
  { kind: 'pays', icon: Globe2 },
  { kind: 'situation', icon: GraduationCap },
  { kind: 'lettre', icon: Mail },
];

const fcfa = (n: number) => `${n.toLocaleString('fr-FR')} FCFA`;

const STEPS = [
  { icon: PenLine, title: t('Partez de ce que vous avez'), text: t('Importez votre ancien CV (PDF ou photo), ou écrivez votre parcours en vrac, au clavier ou au micro. CVCasa range tout et le met en forme proprement, avec vos vraies expériences.') },
  { icon: Target, title: t('Collez l’offre'), text: t('Lien de l’annonce, texte copié, PDF ou capture d’écran : vous obtenez un CV adapté au poste et un score de compatibilité.') },
  { icon: FileDown, title: t('Téléchargez et postulez'), text: t('PDF prêt pour les logiciels de tri des recruteurs (gratuit), ou version Pro sans mention avec le Word. Avec la lettre de motivation qui va avec.') },
];

const FEATURES: { icon: typeof Target; title: string; text: string }[] = [
  { icon: Target, title: t('CV adapté à chaque offre'), text: t('Mots-clés du poste, points forts mis en avant, exigences manquantes signalées. Score avant → après pour voir le gain.') },
  { icon: Mail, title: t('Lettre de motivation'), text: t('Courte, personnalisée, au ton choisi. Candidature spontanée possible.') },
  { icon: MessagesSquare, title: t('Fiche entretien'), text: t('Les questions probables pour ce poste, des réponses construites à partir de votre parcours, et comment parler de vos points faibles.') },
  { icon: FileStack, title: t('Scanner et dossier PDF'), text: t('Scannez vos papiers avec le téléphone : la page est redressée et nettoyée, gratuit jusqu’à 2 pages. Un document écrit à la main devient du texte tapé (PDF ou Word). Ou réunissez CV, lettre et pièces en un seul fichier.') },
  { icon: Languages, title: t('CV en anglais'), text: t('Traduit et mis aux normes du pays visé, pour postuler dans une entreprise internationale ou à l’étranger.') },
  { icon: ClipboardList, title: t('Suivi des candidatures'), text: t('Envoyée, entretien, réponse : toutes vos offres au même endroit, avec le bon CV pour chacune.') },
  { icon: Globe2, title: t('Aux normes de chaque pays'), text: t('Photo, date de naissance ou nationalité seulement quand elles sont attendues, CV en français ou en anglais. Paiement simple par Mobile Money.') },
  { icon: BellRing, title: t('Veille emploi'), text: t('Cochez votre métier, vos contrats et vos zones : les nouvelles offres arrivent chaque matin par e-mail, avec un bouton pour y adapter votre CV. Première recherche offerte.') },
  { icon: Send, title: t('Envoyer et relancer'), text: t('L’e-mail de candidature prêt à copier, et un message de relance proposé au bout d’une semaine sans réponse. Gratuit.') },
  { icon: Link2, title: t('Votre CV en lien et QR code'), text: t('Un lien à envoyer à un recruteur, ou un QR code à imprimer pour les salons et forums emploi. Gratuit.') },
  { icon: UserRound, title: t('Photo sur fond uni'), text: t('Le fond de votre photo devient blanc, gris ou bleu clair, comme chez le photographe. Fait sur votre téléphone, gratuit.') },
];

const JOBS = [
  t('Comptable'), t('Infirmier·e'), t('Commercial·e'), t('Développeur·se'), t('Enseignant·e'), t('Assistant·e de direction'), t('Agent de banque'),
  t('Logisticien·ne'), t('Juriste'), t('Chargé·e de communication'), t('Technicien·ne de maintenance'), t('Ingénieur·e BTP'), t('Caissier·e'),
  t('Community manager'), t('Pharmacien·ne'), t('Chauffeur-livreur'), t('Responsable RH'), t('Agent de saisie'),
];
const PLACES = [
  t('Cotonou'), t('Lomé'), t('Dakar'), t('Abidjan'), t('Douala'), t('Ouagadougou'), t('Bamako'), t('Niamey'), t('Libreville'), t('Kinshasa'),
  t('Paris'), t('Bruxelles'), t('Londres'), t('New York'), t('Genève'),
];

function Marquee({ items, reverse = false, duration }: { items: string[]; reverse?: boolean; duration: string }) {
  return (
    <div className="marquee flex overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]">
      <ul className={reverse ? 'marquee-track reverse flex shrink-0 gap-3 pr-3' : 'marquee-track flex shrink-0 gap-3 pr-3'} style={{ ['--marquee-duration' as string]: duration }}>
        {[...items, ...items].map((x, i) => (
          <li key={i} aria-hidden={i >= items.length} className="shrink-0 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium whitespace-nowrap text-slate-700 shadow-sm">
            {x}
          </li>
        ))}
      </ul>
    </div>
  );
}


/** Titre où le passage entre *astérisques* est mis en couleur (« Des modèles de CV *professionnels* »). */
function Accented({ text, accent = 'text-brand-600' }: { text: string; accent?: string }) {
  return (
    <>
      {text.split('*').map((part, i) =>
        i % 2 ? (
          <span key={i} className={accent}>
            {part}
          </span>
        ) : (
          part
        ),
      )}
    </>
  );
}

function SectionTitle({ title, subtitle, dark = false }: { title: string; subtitle?: string; dark?: boolean }) {
  return (
    <div className="mx-auto mb-8 max-w-2xl text-center">
      <h2 className={cx('font-display text-[1.75rem] leading-tight font-bold tracking-tight sm:text-4xl', dark ? 'text-white' : 'text-ink')}>
        <Accented text={title} accent={dark ? 'text-sun-400' : 'text-brand-600'} />
      </h2>
      {subtitle && <p className={cx('mt-2 text-base', dark ? 'text-slate-300' : 'text-slate-600')}>{subtitle}</p>}
    </div>
  );
}

/** Nos vrais modèles, en images (remplis avec un exemple, sans nom réel ni photo) : on choisit, on commence. */
function TemplatesShowcase({ onNavigate }: { onNavigate: (t: Tab) => void }) {
  const updateCv = useStore((s) => s.updateCv);
  const cv = useActiveCv();
  const strip = useRef<HTMLDivElement>(null);
  const scroll = (dir: 1 | -1) => strip.current?.scrollBy({ left: dir * strip.current.clientWidth * 0.8, behavior: 'smooth' });
  const choose = (entry: (typeof CATALOG)[number]) => {
    updateCv((c) => ({ ...c, settings: { ...c.settings, ...settingsForTemplate(entry) } }));
    onNavigate(isCvEmpty(cv) ? 'infos' : 'apercu');
  };
  return (
    <section className="bg-brand-50/70 py-14" aria-labelledby="modeles-titre">
      <div className="px-4">
        <div id="modeles-titre">
          <SectionTitle title={t('Des modèles de CV *professionnels*')} subtitle={t('Pensés pour chaque métier et chaque pays. Changez de modèle quand vous voulez : votre contenu ne bouge pas.')} />
        </div>
      </div>
      <div className="relative mx-auto max-w-6xl">
        <div ref={strip} className="flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth px-4 pb-4 [scrollbar-width:none] sm:gap-5 [&::-webkit-scrollbar]:hidden">
          {CATALOG.map((e) => (
            <article key={e.id} className="w-[68%] max-w-[250px] shrink-0 snap-center sm:w-[240px]">
              <button type="button" onClick={() => choose(e)} className="group block w-full text-left" aria-label={t('Utiliser le modèle {0}', [e.name])}>
                <img
                  src={`${import.meta.env.BASE_URL}modeles/${LANG === 'en' ? 'en/' : ''}${e.id}.webp`}
                  alt=""
                  loading="lazy"
                  width={560}
                  height={792}
                  className="aspect-[560/792] w-full rounded-xl bg-white shadow-[0_18px_40px_-18px_rgba(16,26,74,0.45)] ring-1 ring-slate-200 transition group-hover:-translate-y-1"
                />
              </button>
              <div className="mt-3 flex items-center gap-2">
                <h3 className="font-semibold text-ink">{e.name}</h3>
                <span className={cx('rounded-full px-2 py-0.5 text-xs font-semibold', isProTemplate(e.id) ? 'bg-sun-100 text-sun-900' : 'bg-emerald-100 text-emerald-900')}>
                  {isProTemplate(e.id) ? 'Pro' : t('Gratuit')}
                </span>
              </div>
              <p className="mt-0.5 text-sm text-slate-600">{e.idealFor}</p>
              <Button size="sm" variant="secondary" className="mt-2" onClick={() => choose(e)}>
                {t('Utiliser ce modèle')}
              </Button>
            </article>
          ))}
        </div>
        <div className="mt-2 hidden justify-center gap-2 lg:flex">
          <button type="button" onClick={() => scroll(-1)} aria-label={t('Modèles précédents')} className="flex size-11 items-center justify-center rounded-full bg-white text-ink shadow ring-1 ring-slate-200 hover:bg-slate-50">
            <ChevronLeft className="size-5" />
          </button>
          <button type="button" onClick={() => scroll(1)} aria-label={t('Modèles suivants')} className="flex size-11 items-center justify-center rounded-full bg-white text-ink shadow ring-1 ring-slate-200 hover:bg-slate-50">
            <ChevronRight className="size-5" />
          </button>
        </div>
      </div>
    </section>
  );
}

/** Témoignages réels (validés à la main) : la section n'apparaît que s'il y en a. */
function Testimonials() {
  const [items, setItems] = useState<PublicTestimonial[]>([]);
  useEffect(() => {
    api.testimonials().then((r) => setItems(r.testimonials), () => {});
  }, []);
  if (items.length === 0) return null;

  const hires = items.map((h) => t('{0} · {1} chez {2}', [h.firstName, h.jobTitle, h.company]));
  const quotes = items.filter((h) => h.message).slice(0, 6);
  return (
    <section className="mx-auto max-w-5xl px-4 pt-12">
      <SectionTitle title={t('Ils ont trouvé un poste')} />
      {hires.length >= 3 ? (
        <Marquee items={hires} duration={`${Math.max(30, hires.length * 6)}s`} />
      ) : (
        <ul className="flex flex-wrap justify-center gap-3">
          {hires.map((h) => (
            <li key={h} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm">
              {h}
            </li>
          ))}
        </ul>
      )}
      {quotes.length > 0 && (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {quotes.map((q, i) => (
            <figure key={i} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <blockquote className="text-sm leading-relaxed text-slate-700">« {q.message} »</blockquote>
              <figcaption className="mt-3 flex items-center gap-2 text-sm">
                <BadgeCheck className="size-4 shrink-0 text-emerald-600" />
                <span>
                  <strong className="text-slate-900">{q.firstName}</strong>
                  <span className="text-slate-500">
                    {' '}
                    {t('· {0} chez {1}', [q.jobTitle, q.company])}
                    {q.city && `, ${q.city}`}
                  </span>
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      )}
      <p className="mt-3 text-center text-xs text-slate-500">{t('Témoignages envoyés par nos utilisateurs, publiés avec leur accord.')}</p>
    </section>
  );
}

export function LandingPage({ onNavigate }: { onNavigate: (t: Tab) => void }) {
  const start = () => onNavigate('infos');

  return (
    <div className="-mx-4 -mt-4">
      <section className="bg-white px-4 pt-8 pb-12 sm:pt-14 lg:pb-16">
        {/* Téléphone : titre, texte et boutons, puis scène. Ordinateur : titre et texte à gauche, scène à droite. */}
        <div className="mx-auto grid max-w-6xl items-center gap-x-14 gap-y-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:grid-rows-[auto_auto]">
          <h1 className="text-center text-[2.4rem] leading-[1.02] font-bold text-ink sm:text-6xl lg:self-end lg:text-left lg:text-[4.4rem]"><Accented text={t('Votre CV *prêt* en quelques minutes.')} /></h1>
          <div className="relative overflow-hidden rounded-[28px] bg-ink px-4 pt-6 pb-5 sm:px-8 sm:pt-9 order-3 lg:order-none lg:col-start-2 lg:row-span-2 lg:row-start-1">
            {/* Trame de points discrète : la scène se détache sans dégradé décoratif. */}
            <div className="pointer-events-none absolute inset-0 opacity-[0.12] [background-image:radial-gradient(#fff_1px,transparent_1px)] [background-size:18px_18px]" />
            <div className="relative">
              <HeroScene />
            </div>
          </div>
          <div className="order-2 text-center lg:order-none lg:self-start lg:text-left">
            <p className="mx-auto max-w-xl text-base text-slate-600 sm:text-lg lg:mx-0">
              {t('Importez votre ancien CV, écrivez quelques lignes ou dictez si vous préférez : votre parcours est rangé, reformulé et mis en page, puis adapté à chaque offre. Créer et télécharger son CV est gratuit.')}</p>
            <div className="mt-7 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center lg:justify-start">
              <Button size="lg" onClick={start} icon={<ArrowRight className="size-5" />}>
                {t('Créer mon CV gratuitement')}</Button>
              <Button size="lg" variant="secondary" onClick={start} icon={<FileUp className="size-5" />}>
                {t('Importer mon ancien CV')}</Button>
            </div>
            <ul className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-1.5 text-sm font-medium text-slate-700 lg:justify-start">
              {[t('Gratuit'), t('Sans compte'), t('Lu par les logiciels des recruteurs')].map((x) => (
                <li key={x} className="flex items-center gap-1.5">
                  <Check className="size-4 text-emerald-600" aria-hidden="true" /> {x}
                </li>
              ))}
            </ul>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-x-5 lg:justify-start">
            <button type="button" onClick={() => onNavigate('offre')} className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-brand-700 hover:text-brand-800">
              {t('J’ai déjà une offre d’emploi')} <ArrowRight className="size-4" aria-hidden="true" />
            </button>
            <a href="#tutoriel" onClick={(e) => { e.preventDefault(); document.getElementById('tutoriel')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }} className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900">
              <PlayCircle className="size-5" /> {' '}{t('Voir le tutoriel en vidéo (2 min)')}</a>
            </div>
          </div>
        </div>
      </section>

      <TemplatesShowcase onNavigate={onNavigate} />

      <section className="space-y-3 border-b border-slate-200 bg-white py-6" aria-label={t('Métiers et villes')}>
        <p className="px-4 text-center text-sm font-semibold text-slate-600">{t('Un CV adapté à votre métier, pour postuler où vous voulez')}</p>
        <Marquee items={JOBS} duration="55s" />
        <Marquee items={PLACES} reverse duration="45s" />
      </section>

      <Testimonials />

      <section className="bg-ink px-4 py-14">
       <div className="mx-auto max-w-5xl">
        <SectionTitle dark title={t('Votre CV en *3 étapes simples*')} />
        <ol className="grid gap-4 sm:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s.title} className="rounded-2xl bg-white/[0.06] p-5 ring-1 ring-white/10">
              <div className="flex items-center gap-3">
                <span className="font-display text-4xl leading-none font-bold text-sun-400">{i + 1}</span>
                <s.icon className="size-5 text-white/80" aria-hidden="true" />
              </div>
              <h3 className="mt-3 text-lg font-semibold text-white">{s.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-slate-300">{s.text}</p>
            </li>
          ))}
        </ol>
        <figure id="tutoriel" className="mt-8 scroll-mt-24">
          <video
            controls
            playsInline
            preload="none"
            poster={`${import.meta.env.BASE_URL}tutoriel/poster.jpg`}
            src={`${import.meta.env.BASE_URL}tutoriel/tutoriel.mp4`}
            className="aspect-video w-full rounded-2xl bg-slate-900 shadow-lg ring-1 ring-white/15"
          >
            {t('Votre navigateur ne lit pas cette vidéo.')}</video>
          <figcaption className="mt-2 text-center text-sm text-slate-400">{t('Le tutoriel complet : CV, modèle, offre, lettre, scanner et documents, pas à pas.')}</figcaption>
        </figure>
       </div>
      </section>

      <section className="bg-white px-4 py-12">
        <div className="mx-auto max-w-5xl">
          <SectionTitle title={t('Tout pour *décrocher le poste*')} subtitle={t('Du CV à l’entretien, au même endroit.')} />
          <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-3 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-3 [&::-webkit-scrollbar]:hidden">
            {FEATURES.map((f) => (
              <div key={f.title} className="w-[78%] shrink-0 snap-center rounded-2xl border border-slate-100 bg-slate-50/60 p-5 sm:w-auto">
                <span className="flex size-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                  <f.icon className="size-5" />
                </span>
                <h3 className="mt-3 font-semibold text-slate-900">{f.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">{f.text}</p>
              </div>
            ))}
          </div>
          <p className="mt-5 text-center text-sm text-slate-600">
            <span className="mr-1.5 rounded-full bg-sun-100 px-2 py-0.5 text-xs font-semibold text-sun-900">{t('Bientôt')}</span>
            {t('L’entraînement à l’entretien à l’oral, et le paiement par carte bancaire ou en crypto.')}</p>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-12">
        <SectionTitle title={t('Tarifs')} subtitle={t('Le CV est gratuit. Le reste se paie à l’usage, sans abonnement.')} />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="font-semibold text-slate-900">{t('Gratuit')}</h3>
            <p className="mt-1 text-2xl font-bold text-slate-900">{t('0 FCFA')}</p>
            <ul className="mt-3 space-y-1.5 text-sm text-slate-600">
              {[t('CV complet, 3 modèles'), t('Export PDF (avec mention CVCasa)'), t('Photo et signature'), '1re adaptation offerte'].map((x) => (
                <li key={x} className="flex gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" /> {x}
                </li>
              ))}
            </ul>
          </div>
          {PACKS.map((p, i) => (
            <div key={p.id} className={i === 1 ? 'rounded-2xl border-2 border-brand-500 bg-white p-5 shadow-md' : 'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm'}>
              <h3 className="font-semibold text-slate-900">{p.name}</h3>
              <p className="mt-1 text-2xl font-bold text-slate-900">{fcfa(p.price)}</p>
              <p className="mt-1 text-sm text-slate-600">
                {t('{0} crédits · {1} l’action', [p.credits, fcfa(Math.round(p.price / p.credits))])}</p>
              <p className="mt-3 text-xs text-slate-500">{t('1 crédit = 1 CV adapté, 1 lettre, 1 fiche entretien, 1 traduction, 1 page manuscrite tapée, ou 1 PDF scanné de plus de 2 pages. 2 crédits = 1 CV en version Pro.')}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-center text-sm text-slate-500">{t('Sans abonnement · MTN MoMo ou Moov Money · Crédit rendu en cas d’échec')}</p>
      </section>

      {/* Les guides sont écrits en français : on ne les met pas en avant dans la version anglaise. */}
      {LANG === 'fr' && (
      <section className="px-4 py-12">
        <div className="mx-auto max-w-5xl">
          <SectionTitle title={t('Conseils et exemples')} subtitle={t('Des guides concrets, métier par métier, pays par pays.')} />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {GUIDE_GROUPS.map(({ kind, icon: Icon }) => {
              const list = GUIDES.filter((g) => g.kind === kind);
              return (
                <div key={kind} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center gap-2.5">
                    <span className="flex size-9 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                      <Icon className="size-5" />
                    </span>
                    <h3 className="font-semibold text-slate-900">{KIND_LABEL[kind]}</h3>
                  </div>
                  <ul className="mt-3 space-y-0.5">
                    {list.slice(0, 6).map((g) => (
                      <li key={g.slug}>
                        <a href={`${GUIDE_BASE}/${g.slug}/`} className="group flex min-h-11 items-center justify-between gap-2 rounded-lg px-2 py-2 text-sm text-slate-700 hover:bg-brand-50 hover:text-brand-800">
                          {g.label}
                          <ArrowRight className="size-3.5 shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-brand-600" />
                        </a>
                      </li>
                    ))}
                  </ul>
                  {list.length > 6 && (
                    <a href={`${GUIDE_BASE}/guides/`} className="mt-auto inline-flex min-h-11 items-center pl-2 text-sm font-semibold text-brand-700 hover:text-brand-800">
                      {t('+ {0} autres', [list.length - 6])}</a>
                  )}
                </div>
              );
            })}
          </div>
          <p className="mt-5 text-center">
            <a href={`${GUIDE_BASE}/guides/`} className="inline-flex min-h-11 items-center gap-1.5 px-2 text-sm font-semibold text-brand-700 hover:text-brand-800">
              {t('Tous les guides')}{' '}<ArrowRight className="size-4" />
            </a>
          </p>
        </div>
      </section>
      )}

      <section className="bg-white px-4 py-12">
        <div className="mx-auto max-w-3xl">
          <SectionTitle title={t('Questions fréquentes')} />
          <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200">
            {FAQ.map((f) => (
              <details key={f.q} className="group px-5">
                <summary className="cursor-pointer list-none py-4 font-medium text-slate-900 marker:hidden">
                  <span className="flex items-center justify-between gap-3">
                    {f.q}
                    <span className="text-brand-600 transition-transform group-open:rotate-45">+</span>
                  </span>
                </summary>
                <p className="pb-4 text-sm leading-relaxed text-slate-600">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <p className="px-4 pt-8 text-center text-sm text-slate-600">
        {t('Une autre question ?')}{' '}
        <button type="button" className="hit font-semibold text-brand-700 underline" onClick={() => onNavigate('contact')}>
          {t('Écrivez-nous')}
        </button>
        {t(', nous répondons dans l’appli.')}</p>

      <section className="px-4 py-14 text-center">
        <ShieldCheck className="mx-auto size-8 text-brand-600" />
        <h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-900">{t('Prêt à postuler ?')}</h2>
        <p className="mx-auto mt-2 max-w-xl text-slate-600">{t('Votre CV reste sur votre appareil. Commencez maintenant, sans compte.')}</p>
        <Button size="lg" className="mt-6" onClick={start} icon={<ArrowRight className="size-5" />}>
          {t('Créer mon CV gratuitement')}</Button>
      </section>

      <footer className="px-4 pb-8 text-center text-xs text-slate-500">
        <button type="button" className="min-h-11 px-2 underline" onClick={() => onNavigate('confidentialite')}>
          {t('Confidentialité')}</button>
      </footer>
    </div>
  );
}
