import { ChevronRight, ClipboardList, FileStack, FolderOpen, MessageCircle, PlayCircle, ScanLine, ShieldCheck, BookOpen } from 'lucide-react';
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
    entries: [{ icon: ClipboardList, title: 'Suivi des candidatures', text: 'Où vous avez postulé, et où vous en êtes.', tab: 'suivi' }],
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
    </div>
  );
}
