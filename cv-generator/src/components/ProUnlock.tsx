import { useState } from 'react';
import { BadgeCheck, Crown } from 'lucide-react';
import { useStore } from '../store.ts';
import type { CvDocument } from '../types.ts';
import { api } from '../lib/api.ts';
import { Button, Notice } from './ui.tsx';

/** Passage d'un CV en version Pro : débite 1 crédit sur le serveur, puis marque le CV. */
export function useUnlock(cv: CvDocument) {
  const unlockCv = useStore((s) => s.unlockCv);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function unlock(): Promise<boolean> {
    setBusy(true);
    setError(null);
    try {
      await api.unlock();
      unlockCv(cv.id);
      return true;
    } catch (e) {
      // Compte à créer ou crédits épuisés : la bonne fenêtre s'ouvre déjà (voir lib/api.ts).
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }

  return { pro: Boolean(cv.unlocked), unlock, busy, error };
}

/** Encadré « Version Pro » sous les boutons de téléchargement. */
export function ProOffer({
  cv,
  reason,
  onUnlocked,
}: {
  cv: CvDocument;
  /** Pourquoi on le propose maintenant (Word demandé, modèle Pro choisi…). */
  reason?: string | null;
  onUnlocked?: () => void;
}) {
  const { pro, unlock, busy, error } = useUnlock(cv);
  if (pro) {
    return (
      <p className="flex items-center gap-1.5 text-sm font-medium text-emerald-700">
        <BadgeCheck className="size-4" /> Version Pro : sans mention, tous les modèles, Word.
      </p>
    );
  }
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3">
      {reason && <p className="mb-1.5 text-sm font-semibold text-amber-900">{reason}</p>}
      <p className="flex items-start gap-2 text-sm text-amber-900">
        <Crown className="mt-0.5 size-4 shrink-0" />
        <span>
          <strong>Version Pro, 1 crédit</strong> : sans la mention « Créé avec CV Studio », les 13 modèles, l’export Word, et la lettre de ce CV.
          Définitif pour ce CV.
        </span>
      </p>
      <Button
        size="sm"
        className="mt-2"
        icon={<Crown className="size-4" />}
        loading={busy}
        onClick={async () => {
          if (await unlock()) onUnlocked?.();
        }}
      >
        Passer en Pro (1 crédit)
      </Button>
      {error && (
        <div className="mt-2">
          <Notice tone="error">{error}</Notice>
        </div>
      )}
    </div>
  );
}
