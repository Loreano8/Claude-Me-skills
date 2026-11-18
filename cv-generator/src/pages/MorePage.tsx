import { Disclosure } from '../components/ui.tsx';
import { BellRing, BookOpen, Settings, ChevronRight, ClipboardList, CreditCard, Globe, Video, FileStack, FolderOpen, Link2, Mail, MessageCircle, Mic, PlayCircle, ScanLine, HandCoins } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import type { Tab } from '../App.tsx';
import { PUBLIC_SITE } from '../lib/referral.ts';
import { useSupportBadge } from '../lib/supportBadge.ts';

import { t } from '../i18n.ts';
import { REGION } from '../lib/currency.ts';
// Les guides sont des pages du site : depuis l'application Android, ils s'ouvrent sur cvcasa.com.
const SITE = Capacitor.isNativePlatform() ? PUBLIC_SITE : '';

type Entry = { icon: typeof ScanLine; title: string; text: string; tab?: Tab; href?: string };

const MAIN: Entry[] = [
  { icon: Globe, title: t('Mon portfolio en ligne'), text: t('Une page web à votre nom, faite à partir du CV.'), tab: 'portfolio' },
  { icon: ClipboardList, title: t('Suivi et relances'), text: t('Où vous avez postulé, et quand relancer.'), tab: 'suivi' },
  { icon: FolderOpen, title: t('Mes documents'), text: t('Vos CV, lettres et papiers.'), tab: 'documents' },
  { icon: ScanLine, title: t('Scanner un document'), text: t('Une photo devient un PDF propre.'), tab: 'scanner' },
];

const OTHERS: Entry[] = [
  { icon: FileStack, title: t('Dossier en un seul PDF'), text: t('CV, lettre et pièces en un seul fichier.'), tab: 'dossier' },
  { icon: Link2, title: t('Partager mon CV'), text: t('Un lien et un QR code pour un recruteur.'), tab: 'apercu' },
  { icon: Mail, title: t('E-mail de candidature'), text: t('Le message à joindre à votre CV.'), tab: 'lettre' },
  { icon: HandCoins, title: t('Devenir ambassadeur'), text: t('Gagnez de l’argent en recommandant CVCasa.'), tab: 'ambassadeur' },
];

const HELP: Entry[] = [
  { icon: PlayCircle, title: t('Tutoriel en vidéo'), text: '', href: `${SITE}/tutoriel/tutoriel.mp4` },
  { icon: BookOpen, title: t('Guides et exemples'), text: '', href: `${SITE}/guides/` },
  { icon: MessageCircle, title: t('Nous contacter'), text: '', tab: 'contact' },
  { icon: Settings, title: t('Réglages'), text: '', tab: 'reglages' },
];

/** Ce qui arrive bientôt : annoncé, pas encore cliquable. */
const SOON: { icon: typeof Mic; title: string; text: string }[] = [
  { icon: Mic, title: t('Entraînement à l’entretien, à l’oral'), text: t('L’appli vous pose les questions du recruteur, vous répondez au micro, elle vous conseille.') },
  { icon: Video, title: t('Portfolio vidéo'), text: t('Une courte vidéo animée de votre parcours, faite à partir de votre CV, prête à partager.') },
  { icon: CreditCard, title: t('Paiement par carte bancaire'), text: t('En plus du Mobile Money, pour payer depuis l’étranger.') },
];

/** « Plus » : la veille emploi en vedette, les trois outils les plus utiles, l'aide ; le reste est rangé. */
export function MorePage({ onNavigate }: { onNavigate: (t: Tab) => void }) {
  const unread = useSupportBadge((s) => s.unread);
  const badge = (e: Entry) =>
    e.tab === 'contact' && unread > 0 ? (
      <span className="rounded-full bg-red-600 px-1.5 py-0.5 text-xs font-bold text-white">
        {unread} <span className="sr-only">{unread > 1 ? t('réponses non lues') : t('réponse non lue')}</span>
      </span>
    ) : null;
  const go = (e: Entry) => (e.tab ? { onClick: () => onNavigate(e.tab!) } : {});
  const row = (e: Entry) => {
    const body = (
      <>
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
          <e.icon className="size-5" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2 font-semibold text-slate-900">{e.title}</span>
          <span className="block text-sm text-slate-600">{e.text}</span>
        </span>
        <ChevronRight className="size-5 shrink-0 text-slate-400" aria-hidden="true" />
      </>
    );
    const cls = 'flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50';
    return (
      <li key={e.title}>
        {e.tab ? (
          <button type="button" className={cls} {...go(e)}>
            {body}
          </button>
        ) : (
          <a className={cls} href={e.href}>
            {body}
          </a>
        )}
      </li>
    );
  };
  const list = (entries: Entry[]) => (
    <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">{entries.map(row)}</ul>
  );

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      {/* La veille emploi en vedette : les offres viennent à la personne, sans chercher. */}
      <section data-tour="more-search" className="rounded-2xl bg-ink p-5 text-white">
        <p className="flex items-center gap-2 text-sm font-semibold text-sun-400">
          <BellRing className="size-4" aria-hidden="true" /> {t('Veille emploi')}
        </p>
        <h2 className="mt-1 font-display text-2xl font-bold text-white">{t('Les offres viennent à vous')}</h2>
        <p className="mt-1 text-sm text-slate-300">{t('Chaque matin, les offres qui correspondent à votre profil, par e-mail. La première recherche est offerte.')}</p>
        <button type="button" onClick={() => onNavigate('veille')} className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-sun-400 px-5 font-semibold text-ink hover:bg-sun-400/90 sm:w-auto">
          <BellRing className="size-4" aria-hidden="true" /> {t('Activer ma veille')}
        </button>
      </section>

      <section data-tour="more-papers">
        <h2 className="mb-2 px-1 font-display text-lg font-semibold text-ink">{t('Le plus utile')}</h2>
        {list(MAIN)}
      </section>

      <section data-tour="more-help">
        <h2 className="mb-2 px-1 font-display text-lg font-semibold text-ink">{t('Aide')}</h2>
        <div className="grid grid-cols-2 gap-2">
          {HELP.map((e) => {
            const inner = (
              <>
                <e.icon className="size-5 text-brand-600" aria-hidden="true" />
                <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                  {e.title} {badge(e)}
                </span>
              </>
            );
            const cls = 'flex min-h-20 flex-col items-start justify-center gap-1.5 rounded-2xl border border-slate-200 bg-white p-3 text-left hover:bg-slate-50';
            return e.tab ? (
              <button key={e.title} type="button" className={cls} {...go(e)}>
                {inner}
              </button>
            ) : (
              <a key={e.title} className={cls} href={e.href}>
                {inner}
              </a>
            );
          })}
        </div>
      </section>

      <Disclosure title={t('Autres outils')} hint={t('Dossier PDF, partage du CV, e-mail de candidature, ambassadeur')}>
        {list(OTHERS.filter((e) => e.tab !== 'ambassadeur' || REGION === 'afrique'))}
      </Disclosure>

      <Disclosure title={t('Bientôt')} hint={t('Ce qui arrive dans les prochaines versions')}>
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-dashed border-slate-300 bg-white/60">
          {SOON.map((e) => (
            <li key={e.title} className="flex min-h-16 items-center gap-3 px-4 py-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                <e.icon className="size-5" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="font-semibold text-slate-700">{e.title}</span>
                <span className="block text-sm text-slate-600">{e.text}</span>
              </span>
            </li>
          ))}
        </ul>
      </Disclosure>
    </div>
  );
}
