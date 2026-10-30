import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { HelpCircle, X } from 'lucide-react';
import type { Tab } from '../App.tsx';
import { Button, cx } from './ui.tsx';

/**
 * Guide de première visite : à la première ouverture d'une page, des bulles montrent
 * pas à pas les éléments utiles (« Suivant », « Passer »). On peut le relancer avec le bouton « Guide ».
 * Chaque étape vise un élément `data-tour="…"` ; une étape dont l'élément n'est pas affiché est sautée.
 */

type Step = { target: string; title: string; text: string };

export const TOURS: Partial<Record<Tab, Step[]>> = {
  infos: [
    { target: 'quickfill', title: 'Commencez ici', text: 'Pas besoin de remplir les cases une par une. Racontez votre parcours, écrivez-le en vrac ou importez votre ancien CV.' },
    { target: 'mic', title: 'Parlez, c’est noté', text: 'Appuyez sur le micro et racontez : vos études, vos postes, ce que vous savez faire. Le texte s’écrit tout seul.' },
    { target: 'import', title: 'Votre ancien CV', text: 'Un CV en PDF, ou une photo d’un CV papier : tout est repris.' },
    { target: 'generate', title: 'Générer mon CV', text: 'CVCasa range chaque information dans la bonne rubrique et soigne la rédaction. Rien n’est inventé.' },
    { target: 'style', title: 'Écrire comme moi', text: 'Montrez un texte que vous avez écrit vous-même : vos CV et lettres garderont votre façon d’écrire.' },
    { target: 'sections', title: 'Vérifiez et complétez', text: 'Toutes les rubriques restent modifiables à la main. Ouvrez-en une pour la corriger.' },
    { target: 'live', title: 'Le résultat en direct', text: 'Votre CV se met à jour à chaque modification. Téléchargez-le en PDF quand il vous plaît.' },
  ],
  apercu: [
    { target: 'export', title: 'Télécharger', text: 'Votre CV en PDF, prêt à envoyer ou à imprimer.' },
    { target: 'preview', title: 'L’aperçu', text: 'Voici exactement ce que recevra le recruteur.' },
    { target: 'templates', title: 'Changer de modèle', text: 'Un modèle par métier et par pays. Le contenu reste le même, seule la présentation change.' },
    { target: 'options', title: 'Réglages conseillés', text: 'Pas sûr de mettre la photo ou l’âge ? « Recommandé » règle tout selon l’usage.' },
    { target: 'translate', title: 'Dans une autre langue', text: 'Votre CV traduit, gardé à côté de l’original.' },
    { target: 'checks', title: 'Les conseils', text: 'Ce qu’il reste à améliorer pour un CV complet et actuel.' },
  ],
  offre: [
    { target: 'job-link', title: 'Le lien de l’annonce', text: 'Collez le lien de l’offre : CVCasa lit la page pour vous.' },
    { target: 'job-text', title: 'Ou son texte', text: 'Le lien ne marche pas ? Copiez-collez simplement le texte de l’annonce ici.' },
    { target: 'job-import', title: 'Ou une capture', text: 'Une annonce en PDF ou une capture d’écran fonctionne aussi.' },
    { target: 'apply', title: 'Postuler', text: 'Un CV adapté à cette offre, la lettre, ou la préparation de l’entretien. Votre CV d’origine ne change pas.' },
  ],
  lettre: [
    { target: 'letter-generate', title: 'Rédiger la lettre', text: 'Quelques questions rapides d’abord, puis une lettre écrite pour l’offre choisie.' },
    { target: 'style', title: 'Avec vos mots', text: 'Activez « Écrire comme moi » pour une lettre qui sonne comme vous.' },
    { target: 'letter-body', title: 'Relisez', text: 'Tout est modifiable : destinataire, objet, chaque paragraphe.' },
    { target: 'letter-export', title: 'Télécharger', text: 'La lettre en PDF, assortie à votre CV.' },
  ],
  suivi: [{ target: 'applications', title: 'Vos candidatures', text: 'Notez où vous avez postulé et où vous en êtes, pour ne relancer personne deux fois.' }],
  documents: [
    { target: 'doc-tabs', title: 'Vos documents', text: 'Vos créations d’un côté, le coffre-fort de vos papiers de l’autre.' },
    { target: 'creations', title: 'Tout est ici', text: 'Chaque CV, version adaptée ou traduite, et chaque lettre. Rouvrez-les quand vous voulez.' },
  ],
  scanner: [
    { target: 'scan', title: 'Scanner', text: 'Prenez une page en photo : elle devient un PDF propre, comme passé au scanner.' },
    { target: 'add-files', title: 'Depuis vos fichiers', text: 'Des photos déjà prises ou des PDF ? Ajoutez-les ici, puis créez le PDF.' },
  ],
  dossier: [
    { target: 'dossier', title: 'Un seul PDF', text: 'CV, lettre, diplômes, pièce d’identité : tout dans un fichier, dans l’ordre voulu.' },
    { target: 'scan', title: 'Ajouter un papier', text: 'Prenez-le en photo ou ajoutez un fichier, puis créez le dossier.' },
  ],
};

const KEY = 'cvcasa-tours';

function seenTours(): string[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as string[];
  } catch {
    return [];
  }
}

function markSeen(tab: Tab) {
  try {
    localStorage.setItem(KEY, JSON.stringify([...new Set([...seenTours(), tab])]));
  } catch {
    // Stockage indisponible : le guide pourra réapparaître, sans gravité.
  }
}

/** Premier élément affiché pour cette cible (certains n'existent qu'en grand écran). */
function findTarget(name: string): HTMLElement | null {
  for (const el of document.querySelectorAll<HTMLElement>(`[data-tour="${name}"]`)) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return el;
  }
  return null;
}

const PAD = 6;
const HEADER = 64;

type Box = { top: number; left: number; width: number; height: number };

export function Tour({ tab }: { tab: Tab }) {
  const steps = TOURS[tab];
  const [active, setActive] = useState(false);
  const [index, setIndex] = useState(0);
  const [box, setBox] = useState<Box | null>(null);
  const [pop, setPop] = useState<{ top: number; left: number } | null>(null);
  const popRef = useRef<HTMLDivElement>(null);

  // Étapes réellement visibles à l'écran (calculées au lancement).
  const [visible, setVisible] = useState<Step[]>([]);

  const start = useCallback(() => {
    if (!steps) return;
    const list = steps.filter((s) => findTarget(s.target));
    if (!list.length) return;
    setVisible(list);
    setIndex(0);
    setActive(true);
  }, [steps]);

  const close = useCallback(() => {
    setActive(false);
    setBox(null);
    setPop(null);
    markSeen(tab);
  }, [tab]);

  // Lancement automatique à la première visite de la page, une fois la page affichée.
  useEffect(() => {
    setActive(false);
    if (!steps || seenTours().includes(tab)) return;
    let tries = 0;
    const id = window.setInterval(() => {
      tries++;
      // On attend qu'aucune fenêtre (connexion, paiement…) ne soit ouverte.
      if (document.querySelector('[role="dialog"]') && tries < 40) return;
      window.clearInterval(id);
      start();
    }, 700);
    return () => window.clearInterval(id);
  }, [tab, steps, start]);

  const step = active ? visible[index] : undefined;

  // Amène l'élément à l'écran, puis suit sa position (défilement, redimensionnement).
  useEffect(() => {
    if (!step) return;
    const el = findTarget(step.target);
    if (!el) {
      if (index < visible.length - 1) setIndex(index + 1);
      else close();
      return;
    }
    const r = el.getBoundingClientRect();
    const room = window.innerHeight - HEADER;
    const y = r.height < room * 0.55 ? window.scrollY + r.top - HEADER - (room - r.height) / 2 : window.scrollY + r.top - HEADER - 12;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: Math.max(0, y), behavior: reduce ? 'auto' : 'smooth' });

    let raf = 0;
    const measure = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const b = el.getBoundingClientRect();
        setBox({ top: b.top - PAD, left: b.left - PAD, width: b.width + PAD * 2, height: b.height + PAD * 2 });
      });
    };
    measure();
    window.addEventListener('scroll', measure, { passive: true });
    window.addEventListener('resize', measure);
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', measure);
      window.removeEventListener('resize', measure);
      ro.disconnect();
    };
  }, [step, index, visible.length, close]);

  // Place la bulle sous l'élément, sinon au-dessus, sinon en bas de l'écran.
  useLayoutEffect(() => {
    if (!box || !popRef.current) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const bottomBar = vw < 1024 ? 64 : 0;
    const p = popRef.current.getBoundingClientRect();
    const left = Math.min(Math.max(12, box.left + box.width / 2 - p.width / 2), vw - p.width - 12);
    let top: number;
    if (box.top + box.height + 12 + p.height < vh - bottomBar - 8) top = box.top + box.height + 12;
    else if (box.top - 12 - p.height > HEADER) top = box.top - 12 - p.height;
    else top = vh - bottomBar - p.height - 12;
    setPop({ top, left });
  }, [box, index]);

  useEffect(() => {
    if (!active) return;
    popRef.current?.querySelector<HTMLButtonElement>('[data-next]')?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowRight') setIndex((i) => Math.min(i + 1, visible.length - 1));
      if (e.key === 'ArrowLeft') setIndex((i) => Math.max(i - 1, 0));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, index, visible.length, close]);

  if (!steps) return null;

  const last = index === visible.length - 1;

  return (
    <>
      {!active && (
        <button
          type="button"
          onClick={start}
          className="fixed right-3 bottom-[calc(env(safe-area-inset-bottom)+4.75rem)] z-10 flex items-center gap-1.5 rounded-full border border-slate-200 bg-white/95 px-3.5 py-3 text-sm font-medium text-slate-700 shadow-md backdrop-blur hover:bg-slate-50 lg:right-5 lg:bottom-5"
          aria-label="Revoir le guide de cette page"
        >
          <HelpCircle className="size-4 text-brand-600" /> Guide
        </button>
      )}

      {step && (
        <div className="fixed inset-0 z-40" aria-hidden={false}>
          {/* Le clic à côté ne fait rien : on garde la main sur le guide. */}
          <div className="absolute inset-0" onClick={(e) => e.stopPropagation()} />
          {box && (
            <div
              className="pointer-events-none absolute rounded-2xl ring-2 ring-brand-400 transition-all duration-300 motion-reduce:transition-none"
              style={{ ...box, boxShadow: '0 0 0 9999px rgba(15, 23, 42, 0.62)' }}
            />
          )}
          <div
            ref={popRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="tour-title"
            aria-describedby="tour-text"
            className={cx(
              'absolute w-[min(22rem,calc(100vw-1.5rem))] rounded-2xl bg-white p-4 shadow-2xl ring-1 ring-slate-200 transition-[top,left,opacity] duration-300 motion-reduce:transition-none',
              pop ? 'opacity-100' : 'opacity-0',
            )}
            style={pop ?? { top: 0, left: 0 }}
          >
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-brand-700">
                  Étape {index + 1} sur {visible.length}
                </p>
                <h2 id="tour-title" className="mt-0.5 text-base font-semibold text-slate-900">
                  {step.title}
                </h2>
              </div>
              <button type="button" onClick={close} aria-label="Fermer le guide" className="-mt-2 -mr-2 rounded-lg p-2.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700">
                <X className="size-4" />
              </button>
            </div>
            <p id="tour-text" className="mt-1.5 text-sm leading-relaxed text-slate-600">
              {step.text}
            </p>
            <div className="mt-3 flex gap-1" aria-hidden="true">
              {visible.map((s, i) => (
                <span key={s.target} className={cx('h-1 flex-1 rounded-full', i <= index ? 'bg-brand-600' : 'bg-slate-200')} />
              ))}
            </div>
            <div className="mt-3 flex items-center gap-2">
              {!last && (
                <button type="button" onClick={close} className="min-h-9 px-1 text-sm font-medium text-slate-600 hover:text-slate-900">
                  Passer
                </button>
              )}
              <div className="ml-auto flex gap-2">
                {index > 0 && (
                  <Button variant="secondary" size="sm" onClick={() => setIndex(index - 1)}>
                    Précédent
                  </Button>
                )}
                <Button data-next size="sm" onClick={() => (last ? close() : setIndex(index + 1))}>
                  {last ? 'Terminer' : 'Suivant'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
