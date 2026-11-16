import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Attachment } from '../../shared/schema.ts';
import type { CvDocument } from '../types.ts';

/**
 * Brouillon de la « Saisie rapide » : gardé quand on change de page (et le texte aussi quand l'appli se ferme).
 * Les fichiers importés restent en mémoire seulement : ils sont trop lourds pour le stockage de l'appareil.
 */
type Draft = {
  text: string;
  files: Attachment[];
  suggestions: string[];
  undo: CvDocument | null;
  /** Dernier CV rédigé par la saisie rapide : sert à indiquer où le télécharger. */
  done: boolean;
  set: (patch: Partial<Omit<Draft, 'set'>>) => void;
};

export const useQuickDraft = create<Draft>()(
  persist(
    (set) => ({ text: '', files: [], suggestions: [], undo: null, done: false, set: (patch) => set(patch) }),
    { name: 'cvcasa-saisie', partialize: (s) => ({ text: s.text }) },
  ),
);
