import { BellRing, BookOpen, ChevronRight, ClipboardList, CreditCard, FileStack, FolderOpen, Link2, Mail, MessageCircle, Mic, PlayCircle, ScanLine, ShieldCheck, Bitcoin } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import type { Tab } from '../App.tsx';
import { PUBLIC_SITE } from '../lib/referral.ts';
import { useSupportBadge } from '../lib/supportBadge.ts';

// Les guides sont des pages du site : depuis l'application Android, ils s'ouvrent sur cvcasa.com.
const SITE = Capacitor.isNativePlatform() ? PUBLIC_SITE : '';

type Entry = { icon: typeof ScanLine; title: string; text: string; tab?: Tab; href?: string };

const GROUPS: { title: string; entries: Entry[] }[] = [
  {
    title: 'Vos papiers',
    entries: [
      { icon: ScanLine, title: 'Scanner un document', text: 'Une photo devient un PDF propre. Gratuit jusqu’à 2 pages.', tab: 'scanner' },
      { icon: FileStack, title: 'Dossier en un seul PDF', text: 'CV, lettre, diplômes et pièces réunis dans un fichier.', tab: 'dossier' },
      { icon: FolderOpen, title: 'Mes documents', text: 'Tous vos CV et lettres, et le coffre-fort de vos papiers.', tab: 'documents' },
    ],
  },
  {
    title: 'Votre recherche',
    entries: [
      { icon: BellRing, title: 'Veille emploi', text: 'Les offres qui vous correspondent, envoyées chaque matin. La première recherche est offerte.', tab: 'veille' },
      { icon: ClipboardList, title: 'Suivi et relances', text: 'Où vous avez postulé, et un message prêt pour relancer au bout d’une semaine.', tab: 'suivi' },
      { icon: Link2, title: 'Partager mon CV', text: 'Un lien et un QR code à donner à un recruteur.', tab: 'apercu' },
      { icon: Mail, title: 'E-mail de candidature', text: 'Le message à envoyer avec votre CV et votre lettre, prêt à copier.', tab: 'lettre' },
    ],
  },
  {
    title: 'Aide',
    entries: [
      { icon: PlayCircle, title: 'Tutoriel en vidéo', text: 'Tout CVCasa expliqué en 2 minutes.', href: `${SITE}/tutoriel/tutoriel.mp4` },
      { icon: BookOpen, title: 'Guides et exemples', text: 'Conseils de CV par métier, par pays, et pour la lettre.', href: `${SITE}/guides/` },
      { icon: MessageCircle, title: 'Nous contacter', text: 'Une question, un souci : nous répondons ici.', tab: 'contact' },
      { icon: ShieldCheck, title: 'Confidentialité', text: 'Ce que deviennent vos données.', tab: 'confidentialite' },
    ],
  },
];

/** Ce qui arrive bientôt : annoncé, pas encore cliquable. */
const SOON: { icon: typeof Mic; title: string; text: string }[] = [
  { icon: Mic, title: 'Entraînement à l’entretien, à l’oral', text: 'L’appli vous pose les questions du recruteur, vous répondez au micro, elle vous conseille.' },
  { icon: CreditCard, title: 'Paiement par carte bancaire', text: 'En plus du Mobile Money, pour payer depuis l’étranger.' },
  { icon: Bitcoin, title: 'Paiement en crypto', text: 'Pour payer depuis n’importe quel pays.' },
];

/** « Plus » : tout ce qui ne fait pas partie du parcours CV → offre → lettre, rangé au même endroit. */
export function MorePage({ onNavigate }: { onNavigate: (t: Tab) => void }) {
  const unread = useSupportBadge((s) => s.unread);
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {GROUPS.map((g) => (
        <section key={g.title}>
          <h2 className="mb-2 px-1 font-display text-lg font-semibold text-ink">{g.title}</h2>
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
            {g.entries.map((e) => {
              const body = (
                <>
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                    <e.icon className="size-5" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 font-semibold text-slate-900">
                      {e.title}
                      {e.tab === 'contact' && unread > 0 && (
                        <span className="rounded-full bg-red-600 px-1.5 py-0.5 text-xs font-bold text-white">
                          {unread} <span className="sr-only">réponse{unread > 1 ? 's' : ''} non lue{unread > 1 ? 's' : ''}</span>
                        </span>
                      )}
                    </span>
                    <span className="block text-sm text-slate-600">{e.text}</span>
                  </span>
                  <ChevronRight className="size-5 shrink-0 text-slate-400" aria-hidden="true" />
                </>
              );
              const cls = 'flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50';
              return (
                <li key={e.title}>
                  {e.tab ? (
                    <button type="button" className={cls} onClick={() => onNavigate(e.tab!)}>
                      {body}
                    </button>
                  ) : (
                    <a className={cls} href={e.href}>
                      {body}
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      <section>
        <h2 className="mb-2 px-1 font-display text-lg font-semibold text-ink">Bientôt</h2>
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-dashed border-slate-300 bg-white/60">
          {SOON.map((e) => (
            <li key={e.title} className="flex min-h-16 items-center gap-3 px-4 py-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                <e.icon className="size-5" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 font-semibold text-slate-700">
                  {e.title}
                  <span className="rounded-full bg-sun-100 px-2 py-0.5 text-xs font-semibold text-sun-900">Bientôt</span>
                </span>
                <span className="block text-sm text-slate-600">{e.text}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
