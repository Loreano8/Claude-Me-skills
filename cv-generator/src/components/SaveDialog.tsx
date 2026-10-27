import { useState } from 'react';
import { FileDown, Share2 } from 'lucide-react';
import { saveToDevice, shareFile, useSaveDialog } from '../export/save.ts';
import { formatSize } from '../lib/dossier.ts';
import { Modal } from './AccountDialogs.tsx';
import { Button, Notice } from './ui.tsx';

/** Appli Android : « Enregistrer sur le téléphone » (dossier au choix) ou « Envoyer » (WhatsApp, e-mail…). */
export function SaveDialog() {
  const pending = useSaveDialog((s) => s.pending);
  const [busy, setBusy] = useState<'save' | 'share' | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!pending) return null;

  const close = () => {
    pending.done();
    useSaveDialog.getState().set(null);
    setSaved(false);
    setError(null);
  };

  async function run(kind: 'save' | 'share') {
    setBusy(kind);
    setError(null);
    try {
      if (kind === 'save') {
        if (await saveToDevice(pending!.blob, pending!.fileName)) setSaved(true);
      } else {
        await shareFile(pending!.blob, pending!.fileName);
      }
    } catch (e) {
      // Partage annulé par la personne : rien à signaler.
      if (!/cancel/i.test((e as Error).message)) setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <Modal title="Votre fichier est prêt" onClose={close}>
      <p className="mb-4 truncate text-sm text-slate-600">
        {pending.fileName} · {formatSize(pending.blob.size)}
      </p>
      <div className="grid gap-2">
        <Button size="lg" icon={<FileDown className="size-5" />} loading={busy === 'save'} disabled={busy !== null} onClick={() => void run('save')}>
          Enregistrer sur le téléphone
        </Button>
        <Button size="lg" variant="secondary" icon={<Share2 className="size-5" />} loading={busy === 'share'} disabled={busy !== null} onClick={() => void run('share')}>
          Envoyer (WhatsApp, e-mail…)
        </Button>
      </div>
      <p className="mt-2 text-xs text-slate-500">« Enregistrer » vous laisse choisir le dossier : Téléchargements, Documents, carte SD, Drive…</p>
      {saved && (
        <div className="mt-3">
          <Notice tone="success">Fichier enregistré. Vous le retrouverez dans l’appli « Fichiers » de votre téléphone.</Notice>
        </div>
      )}
      {error && (
        <div className="mt-3">
          <Notice tone="error">{error}</Notice>
        </div>
      )}
      <Button className="mt-3 w-full" variant="ghost" onClick={close}>
        {saved ? 'Terminé' : 'Fermer'}
      </Button>
    </Modal>
  );
}
