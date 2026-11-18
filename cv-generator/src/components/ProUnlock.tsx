import { useState } from 'react';
import { BadgeCheck, Crown } from 'lucide-react';
import { useStore } from '../store.ts';
import type { CvDocument } from '../types.ts';
import { api } from '../lib/api.ts';
import { useAccount } from '../lib/account.ts';
import { Button, Cost, Notice } from './ui.tsx';

import { t } from '../i18n.ts';
/** Prix de la version Pro, en crédits (doit suivre UNLOCK_COST dans server/accounts.ts). */
export const UNLOCK_COST = 2;

/** Passage d'un CV en version Pro : débite les crédits sur le serveur, puis marque le CV. */
export function useUnlock(cv: CvDocument) {
  const unlockCv = useStore((s) => s.unlockCv);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function unlock(): Promise<boolean> {
    setBusy(true);
    setError(null);
    try {
      await api.unlock();
      const s = useAccount.getState();
      if (s.user) useAccount.setState({ user: { ...s.user, pro: true } });
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
  compact = false,
}: {
  cv: CvDocument;
  /** Une seule ligne (page de téléchargement), tant que la personne n'a rien demandé de Pro. */
  compact?: boolean;
  /** Pourquoi on le propose maintenant (Word demandé, modèle Pro choisi…). */
  reason?: string | null;
  onUnlocked?: () => void;
}) {
  const { pro, unlock, busy, error } = useUnlock(cv);
  if (pro) {
    return (
      <p className="flex items-center gap-1.5 text-sm font-medium text-emerald-700">
        <BadgeCheck className="size-4" /> {' '}{t('Version Pro : sans mention, tous les modèles, Word.')}</p>
    );
  }
  if (compact && !reason) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2">
        <Crown className="size-4 shrink-0 text-amber-800" aria-hidden="true" />
        <p className="min-w-0 flex-1 text-xs text-amber-900">{t('Sans la mention, tous les modèles, Word : version Pro.')}</p>
        <Button
          size="sm"
          variant="secondary"
          loading={busy}
          onClick={async () => {
            if (await unlock()) onUnlocked?.();
          }}
        >
          {t('Pro')}{' '}<Cost n={UNLOCK_COST} />
        </Button>
        {error && <span className="sr-only">{error}</span>}
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3">
      {reason && <p className="mb-1.5 text-sm font-semibold text-amber-900">{reason}</p>}
      <p className="flex items-start gap-2 text-sm text-amber-900">
        <Crown className="mt-0.5 size-4 shrink-0" />
        <span>
          <strong>{t('Version Pro, {0} crédits', [UNLOCK_COST])}</strong> {' '}{t(': sans la mention « Créé avec CVCasa », tous les modèles, l’export Word et les lettres. Payée une seule fois pour tout votre compte : tous vos CV, sur le téléphone comme sur le site.')}</span>
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
        {t('Passer en Pro')}{' '}<Cost n={UNLOCK_COST} />
      </Button>
      {error && (
        <div className="mt-2">
          <Notice tone="error">{error}</Notice>
        </div>
      )}
    </div>
  );
}
