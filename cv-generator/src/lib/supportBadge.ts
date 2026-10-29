import { create } from 'zustand';
import { api } from './api.ts';

/** Nombre de réponses non lues de l'équipe CVCasa (pastille sur le bouton « Nous contacter »). */
export const useSupportBadge = create<{ unread: number; setUnread: (n: number) => void }>((set) => ({
  unread: 0,
  setUnread: (unread) => set({ unread }),
}));

export async function refreshSupportBadge(): Promise<void> {
  try {
    const { unread } = await api.supportUnread();
    useSupportBadge.getState().setUnread(unread);
  } catch {
    // Hors ligne ou serveur sans messagerie : pas de pastille.
  }
}
