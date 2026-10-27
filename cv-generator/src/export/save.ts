import { Capacitor, registerPlugin } from '@capacitor/core';
import { create } from 'zustand';

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const url = reader.result as string;
      resolve(url.slice(url.indexOf(',') + 1));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

interface FileSaverPlugin {
  saveAs(opts: { fileName: string; mimeType: string; data: string }): Promise<{ saved: boolean }>;
}
const FileSaver = registerPlugin<FileSaverPlugin>('FileSaver');

/** Fichier prêt, en attente du choix de la personne (fenêtre « Enregistrer ou envoyer », SaveDialog). */
export interface PendingSave {
  blob: Blob;
  fileName: string;
  done: () => void;
}
export const useSaveDialog = create<{ pending: PendingSave | null; set: (p: PendingSave | null) => void }>((set) => ({
  pending: null,
  set: (pending) => set({ pending }),
}));

/** Appli : écrit le fichier à l'endroit choisi dans le sélecteur de dossier d'Android. Renvoie false si annulé. */
export async function saveToDevice(blob: Blob, fileName: string): Promise<boolean> {
  const { saved } = await FileSaver.saveAs({ fileName, mimeType: blob.type || 'application/octet-stream', data: await blobToBase64(blob) });
  return saved;
}

/** Appli : ouvre le menu de partage (WhatsApp, e-mail, Drive…). */
export async function shareFile(blob: Blob, fileName: string): Promise<void> {
  const [{ Filesystem, Directory }, { Share }] = await Promise.all([import('@capacitor/filesystem'), import('@capacitor/share')]);
  const written = await Filesystem.writeFile({ path: fileName, data: await blobToBase64(blob), directory: Directory.Cache });
  await Share.share({ title: fileName, url: written.uri, dialogTitle: 'Envoyer' });
}

/**
 * Enregistre un fichier généré.
 * - Navigateur : téléchargement classique (dossier Téléchargements, ou « Fichiers » sur iPhone).
 * - Application Android : la personne choisit « Enregistrer sur le téléphone » (dossier au choix)
 *   ou « Envoyer » (menu de partage). La promesse se résout une fois la fenêtre fermée.
 */
export async function saveFile(blob: Blob, fileName: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    return new Promise((resolve) => useSaveDialog.getState().set({ blob, fileName, done: resolve }));
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
