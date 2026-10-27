import { useEffect, useState, type ReactNode } from 'react';
import { ArrowRight, BadgeCheck, Check, ClipboardList, FileDown, FileStack, Globe2, Languages, MessagesSquare, PenLine, ShieldCheck, Sparkles, Target } from 'lucide-react';
import { PACKS } from '../../server/payments.ts';
import type { Tab } from '../App.tsx';
import { Button } from '../components/ui.tsx';
import { api, type PublicTestimonial } from '../lib/api.ts';

const fcfa = (n: number) => `${n.toLocaleString('fr-FR')} FCFA`;

const STEPS = [
  { icon: PenLine, title: 'Écrivez comme vous parlez', text: 'Tapez ou dictez votre parcours en vrac, ou importez votre ancien CV (PDF ou photo). L’IA range et rédige tout proprement.' },
  { icon: Target, title: 'Collez l’offre', text: 'Lien de l’annonce, texte copié, PDF ou capture d’écran : vous obtenez un CV adapté au poste et un score de compatibilité.' },
  { icon: FileDown, title: 'Téléchargez et postulez', text: 'PDF prêt pour les logiciels de tri des recruteurs (gratuit), ou version Pro sans mention avec le Word. Avec la lettre de motivation qui va avec.' },
];

const FEATURES: { icon: typeof Target; title: string; text: string }[] = [
  { icon: Target, title: 'CV adapté à chaque offre', text: 'Mots-clés du poste, points forts mis en avant, exigences manquantes signalées. Score avant → après pour voir le gain.' },
  { icon: Sparkles, title: 'Lettre de motivation', text: 'Courte, personnalisée, au ton choisi. Candidature spontanée possible.' },
  { icon: MessagesSquare, title: 'Fiche entretien', text: 'Les questions probables pour ce poste, des réponses construites à partir de votre parcours, et comment parler de vos points faibles.' },
  { icon: FileStack, title: 'Scanner et dossier PDF', text: 'Scannez vos papiers avec le téléphone : la page est redressée et nettoyée, gratuit jusqu’à 3 pages. Un document écrit à la main devient du texte tapé (PDF ou Word). Ou réunissez CV, lettre et pièces en un seul fichier.' },
  { icon: Languages, title: 'CV en anglais', text: 'Traduit et mis aux normes du pays visé : Canada, États-Unis, Royaume-Uni ou international.' },
  { icon: ClipboardList, title: 'Suivi des candidatures', text: 'Envoyée, entretien, réponse : toutes vos offres au même endroit, avec le bon CV pour chacune.' },
  { icon: Globe2, title: 'Pensé pour l’Afrique francophone', text: 'Normes locales (photo, date de naissance si attendues), paiement mobile money, prix en FCFA.' },
];

const JOBS = [
  'Comptable', 'Infirmier·e', 'Commercial·e', 'Développeur·se', 'Enseignant·e', 'Assistant·e de direction', 'Agent de banque',
  'Logisticien·ne', 'Juriste', 'Chargé·e de communication', 'Technicien·ne de maintenance', 'Ingénieur·e BTP', 'Caissier·e',
  'Community manager', 'Pharmacien·ne', 'Chauffeur-livreur', 'Responsable RH', 'Agent de saisie',
];
const PLACES = [
  'Cotonou', 'Lomé', 'Dakar', 'Abidjan', 'Douala', 'Ouagadougou', 'Bamako', 'Niamey', 'Libreville', 'Kinshasa',
  'Paris', 'Montréal', 'Bruxelles', 'Londres', 'New York', 'Genève',
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

const FAQ: { q: string; a: ReactNode }[] = [
  { q: 'Est-ce vraiment gratuit ?', a: 'Oui : créer son CV avec les 3 modèles de base et le télécharger en PDF est gratuit et sans compte (avec une petite mention « Créé avec CV Studio » en bas de page). Les fonctions IA coûtent 1 crédit chacune (la première est offerte) ; la version Pro d’un CV (sans mention, 13 modèles, export Word) coûte 2 crédits et reste acquise pour toujours sur ce CV.' },
  { q: 'Le scanner est-il gratuit ?', a: 'Oui jusqu’à 3 pages par PDF (et pour un dossier : CV, lettre et 2 pièces). Au-delà, 1 crédit pour le PDF, pages illimitées. Transformer un document écrit à la main en texte tapé coûte 1 crédit par page. Vos papiers restent sur votre téléphone, sauf pour la retranscription, le temps de la lecture.' },
  { q: 'Faut-il un abonnement ?', a: 'Non. Vous achetez un pack de crédits une fois, quand vous en avez besoin. Rien n’est prélevé automatiquement ensuite.' },
  { q: 'Comment payer ?', a: 'Par Mobile Money (MTN MoMo, Moov Money), via FedaPay. Les crédits arrivent sur votre compte dès que le paiement est confirmé.' },
  { q: 'L’IA peut-elle inventer des diplômes ou des expériences ?', a: 'Non. Elle a pour consigne stricte de ne rien inventer : elle reformule et met en valeur ce que vous avez réellement fait.' },
  { q: 'Où sont mes données ?', a: 'Votre CV reste sur votre téléphone ou votre ordinateur. Seul le texte nécessaire à une demande IA passe par notre serveur, le temps de la traiter.' },
  { q: 'Ça marche sur iPhone ?', a: 'Oui, depuis Safari. Touchez « Partager » puis « Sur l’écran d’accueil » pour l’utiliser comme une application. Sur Android, l’application est aussi disponible.' },
];

function SectionTitle({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="mb-6 text-center">
      <p className="text-xs font-semibold tracking-widest text-brand-600 uppercase">{eyebrow}</p>
      <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{title}</h2>
    </div>
  );
}

/** Témoignages réels (validés à la main) : la section n'apparaît que s'il y en a. */
function Testimonials() {
  const [items, setItems] = useState<PublicTestimonial[]>([]);
  useEffect(() => {
    api.testimonials().then((r) => setItems(r.testimonials), () => {});
  }, []);
  if (items.length === 0) return null;

  const hires = items.map((t) => `${t.firstName} · ${t.jobTitle} chez ${t.company}`);
  const quotes = items.filter((t) => t.message).slice(0, 6);
  return (
    <section className="mx-auto max-w-5xl px-4 pt-12">
      <SectionTitle eyebrow="Ils ont décroché un poste" title="Nos utilisateurs embauchés" />
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
          {quotes.map((t, i) => (
            <figure key={i} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <blockquote className="text-sm leading-relaxed text-slate-700">« {t.message} »</blockquote>
              <figcaption className="mt-3 flex items-center gap-2 text-sm">
                <BadgeCheck className="size-4 shrink-0 text-emerald-600" />
                <span>
                  <strong className="text-slate-900">{t.firstName}</strong>
                  <span className="text-slate-500">
                    {' '}
                    · {t.jobTitle} chez {t.company}
                    {t.city && `, ${t.city}`}
                  </span>
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      )}
      <p className="mt-3 text-center text-xs text-slate-400">Témoignages envoyés par nos utilisateurs, publiés avec leur accord.</p>
    </section>
  );
}

export function LandingPage({ onNavigate }: { onNavigate: (t: Tab) => void }) {
  const start = () => onNavigate('infos');

  return (
    <div className="-mx-4 -mt-4">
      <section className="bg-gradient-to-b from-brand-50 to-white px-4 pt-12 pb-14 text-center sm:pt-20">
        <p className="mx-auto inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-semibold text-brand-700 shadow-sm ring-1 ring-brand-100">
          <Sparkles className="size-3.5" /> CV, lettre et entretien, avec l’IA
        </p>
        <h1 className="mx-auto mt-5 max-w-3xl text-3xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
          Un CV qui correspond <span className="text-brand-600">à chaque offre</span>, en quelques minutes
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-base text-slate-600 sm:text-lg">
          Écrivez votre parcours en vrac, collez l’annonce : CV Studio rédige un CV aux normes actuelles, adapté au poste, avec la lettre de
          motivation et la préparation de l’entretien.
        </p>
        <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button size="lg" onClick={start} icon={<ArrowRight className="size-5" />}>
            Créer mon CV gratuitement
          </Button>
          <Button size="lg" variant="secondary" onClick={() => onNavigate('offre')}>
            J’ai déjà une offre
          </Button>
        </div>
        <p className="mt-3 text-sm text-slate-500">Sans compte pour créer et télécharger son CV · 1re action IA offerte</p>
      </section>

      <section className="space-y-3 border-y border-slate-200 bg-slate-50 py-6" aria-label="Métiers et villes">
        <p className="px-4 text-center text-sm font-semibold text-slate-600">Un CV adapté à votre métier, pour postuler où vous voulez</p>
        <Marquee items={JOBS} duration="55s" />
        <Marquee items={PLACES} reverse duration="45s" />
      </section>

      <Testimonials />

      <section className="mx-auto max-w-5xl px-4 py-12">
        <SectionTitle eyebrow="Comment ça marche" title="Trois étapes, c’est tout" />
        <ol className="grid gap-4 sm:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s.title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white">{i + 1}</span>
                <s.icon className="size-5 text-brand-600" />
              </div>
              <h3 className="mt-3 font-semibold text-slate-900">{s.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="bg-white px-4 py-12">
        <div className="mx-auto max-w-5xl">
          <SectionTitle eyebrow="Fonctionnalités" title="Tout pour décrocher l’entretien" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="rounded-2xl border border-slate-100 bg-slate-50/60 p-5">
                <span className="flex size-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                  <f.icon className="size-5" />
                </span>
                <h3 className="mt-3 font-semibold text-slate-900">{f.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-12">
        <SectionTitle eyebrow="Tarifs" title="Payez seulement ce que vous utilisez" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="font-semibold text-slate-900">Gratuit</h3>
            <p className="mt-1 text-2xl font-bold text-slate-900">0 FCFA</p>
            <ul className="mt-3 space-y-1.5 text-sm text-slate-600">
              {['CV complet, 3 modèles', 'Export PDF (avec mention CV Studio)', 'Photo et signature', '1 action IA offerte'].map((x) => (
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
                {p.credits} crédits · {fcfa(Math.round(p.price / p.credits))} l’action
              </p>
              <p className="mt-3 text-xs text-slate-500">1 crédit = 1 CV adapté, 1 lettre, 1 fiche entretien, 1 traduction, 1 page manuscrite tapée, ou 1 PDF scanné de plus de 3 pages. 2 crédits = 1 CV en version Pro.</p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-center text-sm text-slate-500">Sans abonnement · MTN MoMo ou Moov Money · Crédit rendu si l’IA échoue</p>
      </section>

      <section className="bg-white px-4 py-12">
        <div className="mx-auto max-w-3xl">
          <SectionTitle eyebrow="Questions fréquentes" title="Vous vous demandez peut-être…" />
          <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200">
            {FAQ.map((f) => (
              <details key={f.q} className="group px-5 py-4">
                <summary className="cursor-pointer list-none font-medium text-slate-900 marker:hidden">
                  <span className="flex items-center justify-between gap-3">
                    {f.q}
                    <span className="text-brand-600 transition-transform group-open:rotate-45">+</span>
                  </span>
                </summary>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <p className="px-4 pt-8 text-center text-sm text-slate-600">
        Une autre question ?{' '}
        <button type="button" className="font-semibold text-brand-700 underline" onClick={() => onNavigate('contact')}>
          Écrivez-nous
        </button>
        , nous répondons dans l’appli.
      </p>

      <section className="px-4 py-14 text-center">
        <ShieldCheck className="mx-auto size-8 text-brand-600" />
        <h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-900">Prêt à postuler ?</h2>
        <p className="mx-auto mt-2 max-w-xl text-slate-600">Votre CV reste sur votre appareil. Commencez maintenant, sans compte.</p>
        <Button size="lg" className="mt-6" onClick={start} icon={<ArrowRight className="size-5" />}>
          Créer mon CV gratuitement
        </Button>
      </section>
    </div>
  );
}
