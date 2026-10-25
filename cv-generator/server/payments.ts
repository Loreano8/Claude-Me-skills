import type { Db } from './db.ts';
import type { Accounts, User } from './accounts.ts';

export interface Pack {
  id: string;
  name: string;
  credits: number;
  /** Prix en FCFA (XOF). */
  price: number;
}

// 1 crédit = 1 action de l'IA (générer, améliorer, adapter à une offre, lettre, traduction).
export const PACKS: Pack[] = [
  { id: 'essentiel', name: 'Essentiel', credits: 3, price: 500 },
  { id: 'candidature', name: 'Candidatures', credits: 10, price: 1500 },
  { id: 'pro', name: 'Recherche intensive', credits: 25, price: 3000 },
];

export type PaymentStatus = 'pending' | 'approved' | 'declined' | 'canceled' | 'refunded' | 'transferred';

/** Prestataire de paiement (FedaPay aujourd'hui ; Google Play Billing s'ajoutera pour l'appli du Play Store). */
export interface PaymentProvider {
  name: string;
  createCheckout(input: { user: User; pack: Pack; returnUrl: string }): Promise<{ ref: string; url: string }>;
  fetchStatus(ref: string): Promise<PaymentStatus>;
}

export class PaymentError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/** FedaPay : MTN MoMo, Moov Money, cartes… en FCFA. https://docs.fedapay.com */
export function fedapay(secretKey: string, env: 'sandbox' | 'live', fetchImpl: typeof fetch = fetch): PaymentProvider {
  const base = env === 'live' ? 'https://api.fedapay.com/v1' : 'https://sandbox-api.fedapay.com/v1';
  async function call(method: string, path: string, body?: unknown) {
    const res = await fetchImpl(`${base}${path}`, {
      method,
      headers: { Authorization: `Bearer ${secretKey}`, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = (await res.json().catch(() => null)) as Record<string, any> | null;
    if (!res.ok || !data) {
      console.error('FedaPay', method, path, res.status, data);
      throw new PaymentError('Le service de paiement est indisponible. Réessayez dans un instant.', 502);
    }
    return data;
  }
  // Les objets FedaPay sont renvoyés sous la clé "v1/transaction".
  const transaction = (data: Record<string, any>) => data['v1/transaction'] ?? data.transaction ?? data;

  return {
    name: 'fedapay',
    async createCheckout({ user, pack, returnUrl }) {
      const customer: Record<string, unknown> = { firstname: user.name || 'Client', lastname: 'CV Studio' };
      if (user.identifier.includes('@')) customer.email = user.identifier;
      const created = transaction(
        await call('POST', '/transactions', {
          description: `CV Studio – ${pack.credits} crédits`,
          amount: pack.price,
          currency: { iso: 'XOF' },
          callback_url: returnUrl,
          customer,
        }),
      );
      const token = await call('POST', `/transactions/${created.id}/token`);
      if (!created.id || !token.url) throw new PaymentError('Réponse inattendue du service de paiement.', 502);
      return { ref: String(created.id), url: String(token.url) };
    },
    async fetchStatus(ref) {
      return transaction(await call('GET', `/transactions/${encodeURIComponent(ref)}`)).status as PaymentStatus;
    },
  };
}

export function createPayments(db: Db, accounts: Accounts, provider: PaymentProvider | null) {
  return {
    packs: PACKS,

    async checkout(user: User, packId: string, returnUrl: string): Promise<string> {
      if (!provider) throw new PaymentError('Le paiement en ligne n’est pas encore activé.', 503);
      const pack = PACKS.find((p) => p.id === packId);
      if (!pack) throw new PaymentError('Pack inconnu.', 400);
      const { ref, url } = await provider.createCheckout({ user, pack, returnUrl });
      await db.query(
        'insert into payments (user_id, provider, provider_ref, pack_id, credits, amount, currency) values ($1, $2, $3, $4, $5, $6, $7)',
        [user.id, provider.name, ref, pack.id, pack.credits, pack.price, 'XOF'],
      );
      return url;
    },

    /**
     * Vérifie le statut auprès du prestataire (on ne fait jamais confiance au navigateur)
     * et ajoute les crédits une seule fois, même si la confirmation arrive plusieurs fois.
     */
    async confirm(ref: string): Promise<{ status: PaymentStatus; credits?: number; userId?: number }> {
      if (!provider) throw new PaymentError('Le paiement en ligne n’est pas encore activé.', 503);
      // Paiement qui n'a pas été créé par CV Studio (autre projet sur le même compte FedaPay…) : on l'ignore.
      const [known] = await db.query('select 1 from payments where provider = $1 and provider_ref = $2', [provider.name, ref]);
      if (!known) throw new PaymentError('Paiement introuvable.', 404);
      const status = await provider.fetchStatus(ref);
      return db.transaction(async (tx) => {
        const [payment] = await tx.query<{ id: number; user_id: number; credits: number; status: string }>(
          'select id, user_id, credits, status from payments where provider = $1 and provider_ref = $2 for update',
          [provider.name, ref],
        );
        if (!payment) throw new PaymentError('Paiement introuvable.', 404);
        if (payment.status === 'approved' || status === payment.status) {
          return { status: payment.status as PaymentStatus, userId: payment.user_id };
        }
        await tx.query('update payments set status = $2, updated_at = now() where id = $1', [payment.id, status]);
        if (status !== 'approved') return { status, userId: payment.user_id };
        await accounts.addCreditsInTx(tx, payment.user_id, payment.credits, 'purchase', `${provider.name}:${ref}`);
        await accounts.rewardReferralInTx(tx, payment.user_id);
        const [{ credits }] = await tx.query<{ credits: number }>('select credits from users where id = $1', [payment.user_id]);
        return { status, credits, userId: payment.user_id };
      });
    },
  };
}

export type Payments = ReturnType<typeof createPayments>;
