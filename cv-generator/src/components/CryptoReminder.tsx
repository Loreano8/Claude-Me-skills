import { useEffect, useState } from 'react';
import { Coins } from 'lucide-react';
import { useAccount } from '../lib/account.ts';
import { api } from '../lib/api.ts';
import { t } from '../i18n.ts';
import { Banner } from './ReturnBanner.tsx';

/** Fermé pour toute la visite (la commande reste visible dans « Mes crédits »). */
let dismissed = false;

/**
 * Rappel à l'ouverture de l'appli : une commande en crypto est ouverte mais le paiement n'a pas été confirmé.
 * Sans cette confirmation, le serveur ne peut pas savoir que le client a payé.
 */
export function CryptoReminder() {
  const userId = useAccount((s) => s.user?.identifier ?? null);
  const dialog = useAccount((s) => s.dialog);
  const openCredits = useAccount((s) => s.open);
  const [pending, setPending] = useState(false);
  const [hidden, setHidden] = useState(dismissed);

  // Relu à la connexion et à chaque fermeture de « Mes crédits » (le paiement vient peut-être d'être confirmé).
  useEffect(() => {
    if (userId === null || dialog) return;
    let alive = true;
    api.crypto().then(
      (r) => alive && setPending(r.enabled && r.order?.status === 'open'),
      () => {},
    );
    return () => {
      alive = false;
    };
  }, [userId, dialog]);

  if (userId === null || !pending || hidden) return null;
  const close = () => {
    dismissed = true;
    setHidden(true);
  };
  return (
    <Banner
      tone="amber"
      icon={<Coins className="size-5" aria-hidden />}
      title={t('Paiement en crypto à confirmer')}
      text={t('Vous avez commencé un paiement en crypto. Si vous avez envoyé le montant, confirmez-le pour recevoir vos crédits : ils ne sont pas ajoutés tant que le paiement n’est pas confirmé.')}
      action={t('Confirmer mon paiement')}
      onAction={() => openCredits('credits')}
      onClose={close}
    />
  );
}
