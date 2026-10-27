import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { StyleResult } from '../../shared/schema.ts';

/** « Écrire comme moi » : le style d'écriture de la personne, gardé sur ce téléphone. */
export interface WritingStyle {
  profile: string;
  traits: string[];
  examples: string[];
  /** Nom des documents analysés, pour rappel. */
  source: string;
  createdAt: number;
}

interface StyleState {
  style: WritingStyle | null;
  /** La personne peut garder son style mais le désactiver un moment. */
  enabled: boolean;
  setStyle: (result: StyleResult, source: string) => void;
  setEnabled: (enabled: boolean) => void;
  clear: () => void;
}

export const useWritingStyle = create<StyleState>()(
  persist(
    (set) => ({
      style: null,
      enabled: true,
      setStyle: (result, source) =>
        set({ style: { profile: result.profile, traits: result.traits, examples: result.examples, source, createdAt: Date.now() }, enabled: true }),
      setEnabled: (enabled) => set({ enabled }),
      clear: () => set({ style: null }),
    }),
    { name: 'cv-studio-style' },
  ),
);

/** Texte envoyé à l'IA avec chaque demande de rédaction ; vide si pas de style ou désactivé. */
export function styleForAi(): string {
  const { style, enabled } = useWritingStyle.getState();
  if (!style || !enabled) return '';
  const examples = style.examples.length ? `\nTournures typiques : ${style.examples.map((e) => `« ${e} »`).join(' ; ')}` : '';
  return `${style.profile}${examples}`.slice(0, 2_000);
}
