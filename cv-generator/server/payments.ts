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

/** Offre de retour : 4 crédits au prix du pack de 3, une seule fois, pour qui revient après une absence. */
export const RETURN_PACK: Pack = { id: 'retour', name: 'Offre de retour', credits: 4, price: 500 };
/** Absence minimale (aucun mouvement de crédits) et pas d'achat récent pour ouvrir l'offre. */
export const RETURN_AFTER_DAYS = 10;
export const RETURN_NO_PURCHASE_DAYS = 30;
export const RETURN_OFFER_HOURS = 72;

export interface ReturnOffer {
  /** Offre ouverte en ce moment (sinon null). */
  active: { pack: Pack; expiresAt: string } | null;
  /** L'offre peut encore être proposée à cette personne un jour (sert au texte de la notification). */
  possible: boolean;
  /** Achat récent : l'offre ne pourra pas s'ouvrir avant cette date. */
  notBefore: string | null;
}

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
  /**
   * Offre de retour : ouverte (72 h) au moment où la personne revient après au moins 10 jours
   * sans mouvement de crédits, si elle n'a rien acheté depuis 30 jours. Une seule fois par compte.
   */
  async function returnOffer(user: User, now = new Date()): Promise<ReturnOffer> {
    const [row] = await db.query<{ until: Date | string | null; used: boolean; last_purchase: Date | string | null; last_activity: Date | string | null }>(
      `select u.return_offer_until as until,
         exists (select 1 from payments p where p.user_id = u.id and p.pack_id = $2 and p.status = 'approved') as used,
         (select max(p.created_at) from payments p where p.user_id = u.id and p.status = 'approved') as last_purchase,
         (select max(l.created_at) from credit_ledger l where l.user_id = u.id) as last_activity
       from users u where u.id = $1`,
      [user.id, RETURN_PACK.id],
    );
    const none = { active: null, possible: false, notBefore: null };
    if (!row || row.used) return none;
    const until = row.until ? new Date(row.until) : null;
    if (until && until > now) return { active: { pack: RETURN_PACK, expiresAt: until.toISOString() }, possible: true, notBefore: null };
    if (until) return none;
    const purchaseEnd = row.last_purchase ? new Date(new Date(row.last_purchase).getTime() + RETURN_NO_PURCHASE_DAYS * 86_400_000) : null;
    if (purchaseEnd && purchaseEnd > now) return { active: null, possible: true, notBefore: purchaseEnd.toISOString() };
    const last = row.last_activity ? new Date(row.last_activity) : null;
    if (last && now.getTime() - last.getTime() < RETURN_AFTER_DAYS * 86_400_000) return { active: null, possible: true, notBefore: null };
    const expiresAt = new Date(now.getTime() + RETURN_OFFER_HOURS * 3_600_000);
    await db.query('update users set return_offer_until = $2 where id = $1 and return_offer_until is null', [user.id, expiresAt.toISOString()]);
    return { active: { pack: RETURN_PACK, expiresAt: expiresAt.toISOString() }, possible: true, notBefore: null };
  }

  return {
    packs: PACKS,
    returnOffer,

    async checkout(user: User, packId: string, returnUrl: string): Promise<string> {
      if (!provider) throw new PaymentError('Le paiement en ligne n’est pas encore activé.', 503);
      let pack = PACKS.find((p) => p.id === packId);
      if (!pack && packId === RETURN_PACK.id) {
        const { active } = await returnOffer(user);
        if (!active) throw new PaymentError('Cette offre n’est plus disponible.', 410);
        pack = RETURN_PACK;
      }
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
