import { useState, type ReactNode } from 'react';
import { Gift, Target, X } from 'lucide-react';
import { OFFER_TITLE, REMINDER_TEXT, REMINDER_TITLE, useReturnReminder } from '../lib/reminder.ts';
import { useAccount } from '../lib/account.ts';
import { offerEnd } from './AccountDialogs.tsx';

/** Fermée pour toute la visite (elle reste visible dans « Mes crédits »). */
let offerDismissed = false;

/** Au retour dans l'appli : l'offre de retour si elle est ouverte, sinon propose d'adapter le CV à une nouvelle offre. */
export function ReturnBanner({ onAdapt }: { onAdapt: () => void }) {
  const { show, dismiss } = useReturnReminder();
  const offer = useAccount((s) => s.offer?.active ?? null);
  const openCredits = useAccount((s) => s.open);
  const [hideOffer, setHideOffer] = useState(offerDismissed);

  if (offer && !hideOffer && new Date(offer.expiresAt).getTime() > Date.now()) {
    const close = () => {
      offerDismissed = true;
      setHideOffer(true);
    };
    return (
      <Banner
        tone="amber"
        icon={<Gift className="size-5" aria-hidden />}
        title={OFFER_TITLE}
        text={`${offer.pack.credits} crédits pour ${offer.pack.price} F au lieu de 3, jusqu’au ${offerEnd(offer.expiresAt)}. Une seule fois.`}
        action="En profiter"
        onAction={() => {
          close();
          openCredits('credits');
        }}
        onClose={close}
      />
    );
  }
  if (!show) return null;
  return (
    <Banner
      tone="brand"
      icon={<Target className="size-5" aria-hidden />}
      title={REMINDER_TITLE}
      text={REMINDER_TEXT}
      action="Adapter mon CV"
      onAction={() => {
        dismiss();
        onAdapt();
      }}
      onClose={dismiss}
    />
  );
}

function Banner(props: { tone: 'brand' | 'amber'; icon: ReactNode; title: string; text: string; action: string; onAction: () => void; onClose: () => void }) {
  const amber = props.tone === 'amber';
  return (
    <div className={`mb-4 flex items-start gap-3 rounded-2xl border p-3.5 sm:items-center ${amber ? 'border-amber-300 bg-amber-50' : 'border-brand-200 bg-brand-50'}`}>
      <span className={`grid size-9 shrink-0 place-items-center rounded-full bg-white ${amber ? 'text-amber-700' : 'text-brand-700'}`}>{props.icon}</span>
      <div className="min-w-0 flex-1 sm:flex sm:items-center sm:gap-4">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-slate-900">{props.title}</p>
          <p className="text-sm text-slate-600">{props.text}</p>
        </div>
        <button type="button" onClick={props.onAction} className="mt-2.5 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 sm:mt-0">
          {props.action}
        </button>
      </div>
      <button type="button" onClick={props.onClose} aria-label="Plus tard" className="rounded-lg p-1 text-slate-500 hover:bg-white">
        <X className="size-4" />
      </button>
    </div>
  );
}
