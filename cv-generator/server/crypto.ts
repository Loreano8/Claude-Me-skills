import type { Db } from './db.ts';
import type { User } from './accounts.ts';
import { RETURN_PACK, PACKS, type Payments } from './payments.ts';

// Paiement en crypto (USDT sur le réseau BEP20), sans prestataire : le client envoie le montant du pack à l'adresse
// de CVCasa, puis donne l'identifiant de la transaction et une capture de l'envoi. Le serveur lit lui-même la
// transaction sur la blockchain (publique) et ne crédite automatiquement que les cas sans aucun doute :
// - le transfert vient du contrat officiel du jeton (un faux « USDT » a une autre adresse de contrat) ;
// - il arrive à l'adresse de CVCasa, pour au moins le prix du pack ;
// - il a été fait pendant la validité de la commande, et aucune autre commande du même montant n'était ouverte
//   à ce moment-là (sinon on ne peut pas savoir à qui appartient le paiement) ;
// - l'identifiant n'a jamais servi.
// Tout le reste part en vérification manuelle dans l'espace administrateur, avec la capture.

/** Contrats officiels sur BNB Smart Chain (BEP20), 18 décimales. */
export const BEP20_TOKENS: Record<string, string> = {
  USDT: '0x55d398326f99059ff775485246999027b3197955',
  USDC: '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
};

/** Prix ronds en dollars, par pack. */
export const CRYPTO_PRICES: Record<string, number> = { essentiel: 1, [RETURN_PACK.id]: 1, candidature: 3, pro: 5 };

export const CRYPTO_ORDER_MINUTES = 30;
const MIN_CONFIRMATIONS = 12;
const MAX_ATTEMPTS = 8;
const SUBMIT_HOURS = 24;

export const CRYPTO_SCHEMA = `
create table if not exists crypto_orders (
  id serial primary key,
  user_id integer not null references users(id) on delete cascade,
  pack_id text not null,
  credits integer not null,
  price integer not null,
  amount_usd integer not null,
  token text not null default 'USDT',
  status text not null default 'open',
  tx_hash text,
  proof text,
  chain text not null default '',
  reason text not null default '',
  note text not null default '',
  attempts integer not null default 0,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  submitted_at timestamptz,
  decided_at timestamptz,
  payment_id integer references payments(id) on delete set null
);
create unique index if not exists crypto_orders_paid_hash on crypto_orders (lower(tx_hash)) where status = 'paid';
create index if not exists crypto_orders_user on crypto_orders (user_id, id desc);
create table if not exists app_flags (
  key text primary key,
  value text not null
)`;

export class CryptoError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

export interface ChainTransfer {
  /** Adresse du contrat du jeton (minuscules). */
  token: string;
  from: string;
  to: string;
  amount: number;
}
export interface ChainTx {
  success: boolean;
  confirmations: number;
  time: Date;
  transfers: ChainTransfer[];
}
/** Lecture d'une transaction sur la blockchain ; null si elle est inconnue ou pas encore incluse dans un bloc. */
export interface Chain {
  fetch(hash: string): Promise<ChainTx | null>;
}

const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const DEFAULT_RPCS = ['https://bsc-dataseed.binance.org', 'https://bsc-rpc.publicnode.com', 'https://bsc-dataseed1.defibit.io'];

/** BNB Smart Chain, par ses points d'accès publics (aucune clé nécessaire). */
export function bscChain(fetchImpl: typeof fetch = fetch, rpcs: string[] = DEFAULT_RPCS): Chain {
  async function rpc(method: string, params: unknown[]): Promise<any> {
    let last: unknown;
    for (const url of rpcs) {
      try {
        const res = await fetchImpl(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) });
        const data = (await res.json()) as { result?: unknown; error?: unknown };
        if (res.ok && !data.error) return data.result;
        last = data.error ?? res.status;
      } catch (error) {
        last = error;
      }
    }
    console.error('BSC', method, last);
    throw new CryptoError('La vérification sur la blockchain est indisponible pour le moment. Réessayez dans une minute.', 502);
  }
  const address = (topic: string) => '0x' + topic.slice(-40).toLowerCase();
  return {
    async fetch(hash) {
      const receipt = await rpc('eth_getTransactionReceipt', [hash]);
      if (!receipt?.blockNumber) return null;
      const [block, head] = await Promise.all([rpc('eth_getBlockByNumber', [receipt.blockNumber, false]), rpc('eth_blockNumber', [])]);
      if (!block?.timestamp) return null;
      const transfers: ChainTransfer[] = [];
      for (const log of (receipt.logs ?? []) as { address: string; topics: string[]; data: string }[]) {
        if (log.topics?.[0] !== TRANSFER_TOPIC || log.topics.length < 3) continue;
        // 18 décimales : on garde 6 décimales, largement assez pour des montants en dollars.
        const amount = Number(BigInt(log.data && log.data !== '0x' ? log.data : '0x0') / 10n ** 12n) / 1e6;
        transfers.push({ token: log.address.toLowerCase(), from: address(log.topics[1]), to: address(log.topics[2]), amount });
      }
      return {
        success: receipt.status === '0x1',
        confirmations: Number(BigInt(head) - BigInt(receipt.blockNumber)) + 1,
        time: new Date(Number(BigInt(block.timestamp)) * 1000),
        transfers,
      };
    },
  };
}

export interface CryptoConfig {
  /** Adresse de réception (publique). */
  address: string;
  /** Jetons acceptés, parmi BEP20_TOKENS. */
  tokens: string[];
  /** Crédit automatique des cas sans doute (réglable ensuite dans l'espace administrateur). */
  auto: boolean;
}

type OrderRow = {
  id: number;
  user_id: number;
  pack_id: string;
  credits: number;
  price: number;
  amount_usd: number;
  token: string;
  status: string;
  tx_hash: string | null;
  reason: string;
  note: string;
  attempts: number;
  created_at: string | Date;
  expires_at: string | Date;
  submitted_at: string | Date | null;
  decided_at: string | Date | null;
};

const iso = (d: string | Date | null) => (d ? new Date(d).toISOString() : null);
const COLS = 'id, user_id, pack_id, credits, price, amount_usd, token, status, tx_hash, reason, note, attempts, created_at, expires_at, submitted_at, decided_at';

export function createCrypto(db: Db, payments: Payments, chain: Chain, cfg: CryptoConfig, now: () => Date = () => new Date()) {
  const address = cfg.address.trim().toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(address)) throw new Error('CRYPTO_BEP20_ADDRESS : adresse BEP20 invalide.');
  const tokens = cfg.tokens.filter((t) => BEP20_TOKENS[t]);
  if (!tokens.length) throw new Error('Aucun jeton crypto accepté.');

  const view = (o: OrderRow) => ({
    id: o.id,
    packId: o.pack_id,
    credits: o.credits,
    amount: o.amount_usd,
    token: o.token,
    status: o.status as 'open' | 'review' | 'paid' | 'refused',
    address: cfg.address.trim(),
    network: 'BEP20',
    createdAt: iso(o.created_at)!,
    expiresAt: iso(o.expires_at)!,
    note: o.note,
  });

  async function autoOn(): Promise<boolean> {
    const [flag] = await db.query<{ value: string }>(`select value from app_flags where key = 'crypto_auto'`);
    return flag ? flag.value === 'on' : cfg.auto;
  }

  /** Crédite la commande : une seule fois par identifiant de transaction (index unique). */
  /**
   * Montant reçu inférieur au pack : crédits au prorata, au tarif du plus petit pack du moment, arrondis au crédit
   * inférieur et jamais plus que le pack commandé. 0 si le montant ne vaut même pas un crédit.
   */
  function prorata(o: OrderRow, received: number): number {
    const small = payments.currentPacks().packs[0];
    const perUnit = small.credits / CRYPTO_PRICES[small.id];
    return Math.max(0, Math.min(o.credits, Math.floor(received * perUnit + 1e-9)));
  }
  const received = (chain: string) => (chain ? Number((JSON.parse(chain) as { amount?: number }).amount ?? 0) : 0);

  async function pay(orderId: number, hash: string, partial?: { credits: number; price: number }): Promise<number> {
    return db.transaction(async (tx) => {
      const [o] = await tx.query<OrderRow>(`select ${COLS} from crypto_orders where id = $1 for update`, [orderId]);
      if (!o || o.status === 'paid') throw new CryptoError('Cette commande a déjà été traitée.', 409);
      const [used] = await tx.query(`select 1 from crypto_orders where lower(tx_hash) = $1 and status = 'paid'`, [hash]);
      if (used) throw new CryptoError('Cette transaction a déjà été utilisée.', 409);
      const pack = { id: o.pack_id, name: o.pack_id, credits: partial?.credits ?? o.credits, price: partial?.price ?? o.price };
      const { paymentId, credits } = await payments.recordPaidInTx(tx, o.user_id, pack, 'crypto', hash);
      await tx.query(`update crypto_orders set status = 'paid', tx_hash = $2, decided_at = $3, payment_id = $4, credits = $5, price = $6, note = $7 where id = $1`, [orderId, hash, now().toISOString(), paymentId, pack.credits, pack.price, partial ? 'crédité au prorata du montant reçu' : o.note]);
      return credits;
    });
  }

  return {
    config: () => ({ address: cfg.address.trim(), network: 'BEP20', tokens, prices: CRYPTO_PRICES, minutes: CRYPTO_ORDER_MINUTES }),

    /** Ouvre une commande (30 minutes). Une seule commande ouverte par compte : la précédente est abandonnée. */
    async open(user: User, packId: string, token = tokens[0]) {
      if (!tokens.includes(token)) throw new CryptoError('Cette monnaie n’est pas acceptée.');
      const pack = await payments.packFor(user, packId);
      const amount = CRYPTO_PRICES[pack.id];
      if (!amount) throw new CryptoError('Ce pack ne peut pas être payé en crypto.');
      const [waiting] = await db.query(`select 1 from crypto_orders where user_id = $1 and status = 'review'`, [user.id]);
      if (waiting) throw new CryptoError('Un paiement est déjà en cours de vérification. Attendez la réponse avant d’en commencer un autre.', 409);
      const t = now();
      await db.query(`update crypto_orders set status = 'refused', reason = 'abandonnée', decided_at = $2 where user_id = $1 and status = 'open'`, [user.id, t.toISOString()]);
      const [o] = await db.query<OrderRow>(
        `insert into crypto_orders (user_id, pack_id, credits, price, amount_usd, token, created_at, expires_at) values ($1, $2, $3, $4, $5, $6, $7, $8) returning ${COLS}`,
        [user.id, pack.id, pack.credits, pack.price, amount, token, t.toISOString(), new Date(t.getTime() + CRYPTO_ORDER_MINUTES * 60_000).toISOString()],
      );
      return view(o);
    },

    /** Dernière commande du compte (pour reprendre un paiement ou afficher « en cours de vérification »). */
    async current(userId: number) {
      const [o] = await db.query<OrderRow>(`select ${COLS} from crypto_orders where user_id = $1 and reason <> 'abandonnée' order by id desc limit 1`, [userId]);
      if (!o) return null;
      if (o.status === 'open' && now().getTime() - new Date(o.created_at).getTime() > SUBMIT_HOURS * 3_600_000) return null;
      return view(o);
    },

    /**
     * Le client déclare son paiement : identifiant de transaction + capture de l'envoi.
     * Renvoie « paid » (crédits ajoutés) ou « review » (vérification manuelle) ; une erreur si le client peut corriger.
     */
    async submit(userId: number, orderId: number, rawHash: string, proof: string): Promise<{ status: 'paid' | 'review'; credits?: number }> {
      const hash = String(rawHash ?? '').trim().toLowerCase();
      if (!/^0x[0-9a-f]{64}$/.test(hash)) throw new CryptoError('Identifiant de transaction invalide : il commence par 0x et compte 66 caractères.');
      if (!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(proof) || proof.length < 1000) throw new CryptoError('Ajoutez la capture d’écran de votre envoi.');
      if (proof.length > 2_800_000) throw new CryptoError('Capture trop lourde : 2 Mo au maximum.', 413);
      const t = now();
      const [o] = await db.query<OrderRow>(`select ${COLS} from crypto_orders where id = $1 and user_id = $2`, [orderId, userId]);
      if (!o || o.status !== 'open' || t.getTime() - new Date(o.created_at).getTime() > SUBMIT_HOURS * 3_600_000) {
        throw new CryptoError('Cette commande n’est plus ouverte. Recommencez le paiement depuis « Mes crédits ».', 410);
      }
      // Nombre d'essais limité : on ne laisse pas tester des identifiants au hasard.
      const fail = async (message: string, status = 400): Promise<never> => {
        const [{ attempts }] = await db.query<{ attempts: number }>('update crypto_orders set attempts = attempts + 1 where id = $1 returning attempts', [orderId]);
        if (attempts >= MAX_ATTEMPTS) await db.query(`update crypto_orders set status = 'refused', reason = 'trop d’essais', decided_at = $2 where id = $1`, [orderId, t.toISOString()]);
        throw new CryptoError(message, status);
      };
      const [used] = await db.query(`select 1 from crypto_orders where lower(tx_hash) = $1 and status = 'paid'`, [hash]);
      if (used) return fail('Cette transaction a déjà été utilisée.', 409);

      const txn = await chain.fetch(hash);
      if (!txn) return fail('Transaction introuvable pour le moment. Vérifiez l’identifiant, ou réessayez dans une minute.', 404);
      if (!txn.success) return fail('Cette transaction a échoué sur la blockchain : aucun montant n’a été envoyé.');
      if (txn.confirmations < MIN_CONFIRMATIONS) return fail('Transaction pas encore confirmée. Réessayez dans une minute.', 425);
      const toUs = txn.transfers.filter((x) => x.to === address);
      if (!toUs.length) return fail('Cette transaction n’a pas été envoyée à l’adresse de CVCasa.');
      const contract = BEP20_TOKENS[o.token];
      const good = toUs.filter((x) => x.token === contract);
      if (!good.length) return fail('Cette transaction n’est pas dans la monnaie officielle demandée sur le réseau BEP20. Un jeton qui porte seulement le même nom est refusé.');
      const received = good.reduce((sum, x) => sum + x.amount, 0);

      // À partir d'ici la transaction est réelle : soit on crédite, soit un administrateur tranche.
      const facts = { amount: received, from: good[0].from, time: txn.time.toISOString(), confirmations: txn.confirmations };
      const created = new Date(o.created_at).getTime();
      const expires = new Date(o.expires_at).getTime();
      const at = txn.time.getTime();
      let reason = '';
      if (received < o.amount_usd - 0.0001) reason = `montant reçu insuffisant (${received} au lieu de ${o.amount_usd})`;
      else if (at < created - 120_000 || at > expires + 600_000) reason = 'paiement fait en dehors de la validité de la commande';
      else {
        const [{ n: others }] = await db.query<{ n: number }>(
          `select count(*)::int as n from crypto_orders
           where user_id <> $1 and amount_usd = $2 and token = $3 and created_at <= $4 and expires_at >= $4
             and reason <> 'abandonnée' and not (status = 'paid' and lower(tx_hash) <> $5)`,
          [userId, o.amount_usd, o.token, txn.time.toISOString(), hash],
        );
        const [claimed] = await db.query(`select 1 from crypto_orders where lower(tx_hash) = $1 and id <> $2 and status = 'review'`, [hash, orderId]);
        if (claimed) reason = 'le même identifiant est déclaré par un autre compte';
        else if (others > 0) reason = 'une autre commande du même montant était ouverte au moment du paiement';
        else if (!(await autoOn())) reason = 'validation manuelle activée';
      }
      await db.query('update crypto_orders set tx_hash = $2, proof = $3, chain = $4, reason = $5, submitted_at = $6 where id = $1', [orderId, hash, proof, JSON.stringify(facts), reason, t.toISOString()]);
      if (reason) {
        await db.query(`update crypto_orders set status = 'review' where id = $1`, [orderId]);
        return { status: 'review' };
      }
      return { status: 'paid', credits: await pay(orderId, hash) };
    },

    /** Espace administrateur : paiements à vérifier (avec la capture), derniers paiements, et réglage automatique. */
    async adminList() {
      const rows = await db.query<OrderRow & { identifier: string; proof: string | null; chain: string }>(
        `select o.id, o.user_id, o.pack_id, o.credits, o.price, o.amount_usd, o.token, o.status, o.tx_hash, o.reason, o.note, o.attempts, o.created_at, o.expires_at, o.submitted_at, o.decided_at,
                u.identifier, case when o.status = 'review' then o.proof end as proof, o.chain
         from crypto_orders o join users u on u.id = o.user_id
         where o.status = 'review' or (o.tx_hash is not null and o.status in ('paid', 'refused'))
         order by (o.status = 'review') desc, o.id desc limit 60`,
      );
      return {
        auto: await autoOn(),
        address: cfg.address.trim(),
        orders: rows.map((o) => ({
          ...view(o),
          identifier: o.identifier,
          txHash: o.tx_hash,
          reason: o.reason,
          submittedAt: iso(o.submitted_at),
          decidedAt: iso(o.decided_at),
          proof: o.proof,
          chain: o.chain ? (JSON.parse(o.chain) as { amount: number; from: string; time: string; confirmations: number }) : null,
          /** Crédits que donnerait un crédit au prorata (montant reçu inférieur au pack). */
          prorata: o.status === 'review' && received(o.chain) < o.amount_usd - 0.0001 ? prorata(o, received(o.chain)) : null,
        })),
      };
    },

    async setAuto(on: boolean) {
      await db.query(`insert into app_flags (key, value) values ('crypto_auto', $1) on conflict (key) do update set value = excluded.value`, [on ? 'on' : 'off']);
      return { auto: on };
    },

    /** Décision de l'administrateur sur un paiement à vérifier. */
    async decide(orderId: number, action: 'approve' | 'refuse' | 'prorata', note = ''): Promise<{ status: 'paid' | 'refused'; userId: number; credits?: number }> {
      const [o] = await db.query<OrderRow & { chain: string }>(`select ${COLS}, chain from crypto_orders where id = $1`, [orderId]);
      if (!o || o.status !== 'review' || !o.tx_hash) throw new CryptoError('Ce paiement n’est plus en attente.', 409);
      if (action === 'approve') return { status: 'paid', userId: o.user_id, credits: await pay(orderId, o.tx_hash.toLowerCase()) };
      if (action === 'prorata') {
        const got = received(o.chain);
        const credits = prorata(o, got);
        if (credits < 1) throw new CryptoError('Montant reçu trop faible : il ne vaut pas un crédit.', 400);
        // Le prix retenu (pour les gains d'ambassadeur) suit le montant réellement reçu.
        const price = Math.min(o.price, Math.round((o.price * got) / o.amount_usd));
        return { status: 'paid', userId: o.user_id, credits: await pay(orderId, o.tx_hash.toLowerCase(), { credits, price }) };
      }
      await db.query(`update crypto_orders set status = 'refused', note = $2, decided_at = $3 where id = $1 and status = 'review'`, [orderId, note.slice(0, 300), now().toISOString()]);
      return { status: 'refused', userId: o.user_id };
    },

    /** Les captures sont supprimées 30 jours après la décision. */
    async cleanup() {
      await db.query(`update crypto_orders set proof = null where proof is not null and decided_at < $1`, [new Date(now().getTime() - 30 * 86_400_000).toISOString()]);
    },
  };
}

export type Crypto = ReturnType<typeof createCrypto>;
export const CRYPTO_PACK_IDS = [...PACKS.map((p) => p.id), RETURN_PACK.id];
