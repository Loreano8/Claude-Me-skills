import { useEffect, useState } from 'react';
import { Check, Copy, Link2, QrCode, Share2 } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { api, type SharedCv } from '../lib/api.ts';
import { useAccount } from '../lib/account.ts';
import { fullName } from '../lib/cv.ts';
import { saveFile } from '../export/save.ts';
import type { CvDocument } from '../types.ts';
import { Button, Card, Cost, Notice } from './ui.tsx';

const toBase64 = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '');
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });

/**
 * « Partager mon CV » : un lien et un QR code vers le PDF du CV, à envoyer à un recruteur ou à imprimer.
 * Le lien reste le même quand on met le CV à jour ; on peut l'arrêter à tout moment.
 */
export function ShareCv({ cv }: { cv: CvDocument }) {
  const token = useAccount((s) => s.token);
  const [share, setShare] = useState<SharedCv | null>(null);
  const [qr, setQr] = useState('');
  const [busy, setBusy] = useState<'publish' | 'stop' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Partage déjà en cours pour ce CV ?
  useEffect(() => {
    setShare(null);
    if (!token) return;
    api.shareStatus(cv.id).then((r) => setShare(r.share)).catch(() => {});
  }, [cv.id, token]);

  useEffect(() => {
    if (!share) return setQr('');
    void import('qrcode').then((QR) => QR.toDataURL(share.url, { margin: 1, width: 480, color: { dark: '#101a4a', light: '#ffffff' } }).then(setQr));
  }, [share]);

  async function publish() {
    setBusy('publish');
    setError(null);
    try {
      const { renderCvPdf } = await import('../pdf/render.tsx');
      const pdf = await toBase64(await renderCvPdf(cv));
      setShare(await api.shareCv(cv.id, fullName(cv.personal) || cv.label || 'CV', pdf));
    } catch (e) {
      if (useAccount.getState().dialog !== 'account') setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function stop() {
    setBusy('stop');
    try {
      await api.shareStop(cv.id);
      setShare(null);
    } finally {
      setBusy(null);
    }
  }

  async function copy() {
    if (!share) return;
    await navigator.clipboard.writeText(share.url).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  async function send() {
    if (!share) return;
    const text = `Mon CV : ${share.url}`;
    if (Capacitor.isNativePlatform()) {
      const { Share } = await import('@capacitor/share');
      await Share.share({ title: 'Mon CV', text, url: share.url, dialogTitle: 'Envoyer mon CV' }).catch(() => {});
    } else if (navigator.share) {
      await navigator.share({ title: 'Mon CV', text: 'Mon CV', url: share.url }).catch(() => {});
    } else {
      await copy();
    }
  }

  async function saveQr() {
    if (!qr) return;
    const blob = await (await fetch(qr)).blob();
    await saveFile(blob, `QR_${(fullName(cv.personal) || 'CV').replace(/\s+/g, '_')}.png`);
  }

  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          <Link2 className="size-5 text-brand-600" aria-hidden="true" /> Partager mon CV par lien <Cost free />
        </span>
      }
      subtitle="Un lien et un QR code à donner à un recruteur, à envoyer par message ou à imprimer."
    >
      {!share ? (
        <>
          <Button icon={<QrCode className="size-4" />} loading={busy === 'publish'} onClick={() => void publish()}>
            Créer mon lien et mon QR code
          </Button>
          <p className="mt-2 text-xs text-slate-500">Seules les personnes qui ont le lien peuvent voir votre CV. Il marche 90 jours et vous pouvez l’arrêter quand vous voulez.</p>
        </>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
            {qr && <img src={qr} alt="QR code vers votre CV" className="size-36 shrink-0 rounded-xl ring-1 ring-slate-200" />}
            <div className="w-full min-w-0 space-y-2">
              <p className="truncate rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700 ring-1 ring-slate-200">{share.url}</p>
              <div className="flex flex-wrap gap-2">
                <Button icon={<Share2 className="size-4" />} onClick={() => void send()}>
                  Envoyer le lien
                </Button>
                <Button variant="secondary" icon={copied ? <Check className="size-4" /> : <Copy className="size-4" />} onClick={() => void copy()}>
                  {copied ? 'Copié' : 'Copier'}
                </Button>
                <Button variant="secondary" icon={<QrCode className="size-4" />} onClick={() => void saveQr()}>
                  Enregistrer le QR code
                </Button>
              </div>
            </div>
          </div>
          <p className="text-xs text-slate-500">
            Vous avez modifié votre CV ? Mettez le lien à jour : il reste le même. Valable jusqu’au {new Date(share.expiresAt).toLocaleDateString('fr-FR')}.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" loading={busy === 'publish'} onClick={() => void publish()}>
              Mettre à jour le lien
            </Button>
            <Button variant="danger" size="sm" loading={busy === 'stop'} onClick={() => void stop()}>
              Arrêter le partage
            </Button>
          </div>
        </div>
      )}
      {error && (
        <div className="mt-3">
          <Notice tone="error">{error}</Notice>
        </div>
      )}
    </Card>
  );
}
