import { Capacitor } from '@capacitor/core';

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

/**
 * Enregistre un fichier généré.
 * - Navigateur : téléchargement classique.
 * - Application Android : écrit le fichier puis ouvre le menu de partage
 *   (Drive, WhatsApp, e-mail, « Enregistrer dans Téléchargements »…).
 */
export async function saveFile(blob: Blob, fileName: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    const [{ Filesystem, Directory }, { Share }] = await Promise.all([
      import('@capacitor/filesystem'),
      import('@capacitor/share'),
    ]);
    const written = await Filesystem.writeFile({
      path: fileName,
      data: await blobToBase64(blob),
      directory: Directory.Cache,
    });
    await Share.share({ title: fileName, url: written.uri, dialogTitle: 'Enregistrer ou envoyer' });
    return;
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
