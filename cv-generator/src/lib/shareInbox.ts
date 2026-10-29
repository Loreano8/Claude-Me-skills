import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import { create } from 'zustand';

// « Partager → CVCasa » depuis LinkedIn, WhatsApp, le navigateur… : le texte ou le lien partagé
// arrive ici, puis la page « Offre » le lit.
// - Android (appli) : ShareInboxPlugin.java reçoit le partage ;
// - site installé sur Android : « share_target » du manifeste, qui ouvre ?share-text=… .

interface ShareInboxPlugin {
  take(): Promise<{ text?: string | null }>;
  addListener(event: 'shared', cb: () => void): Promise<PluginListenerHandle>;
}

const ShareInbox = registerPlugin<ShareInboxPlugin>('ShareInbox');

/** Dernier partage reçu, en attente d'être lu par la page « Offre ». */
export const useSharedOffer = create<{ pending: string | null; set: (t: string | null) => void }>((set) => ({
  pending: null,
  set: (pending) => set({ pending }),
}));

function receive(text: string | null | undefined) {
  const t = text?.trim();
  if (t) useSharedOffer.getState().set(t);
}

/** À appeler une fois au démarrage. */
export function setupShareInbox(): void {
  // Site installé (PWA) : le partage arrive dans l'adresse.
  const params = new URLSearchParams(window.location.search);
  const shared = [params.get('share-title'), params.get('share-text'), params.get('share-url')].filter(Boolean).join('\n');
  if (shared) {
    receive(shared);
    window.history.replaceState(null, '', `${window.location.pathname}#offre`);
  }

  if (Capacitor.getPlatform() !== 'android') return;
  const take = () =>
    ShareInbox.take().then(
      (r) => receive(r.text),
      () => {},
    );
  void take();
  void ShareInbox.addListener('shared', () => void take()).catch(() => {});
}
