import type { Db } from './db.ts';
import { AMBASSADOR_CONTRACT_VERSION, sameName } from '../shared/ambassadorContract.ts';

// Programme Ambassadeur : des personnes validées par l'administrateur gagnent de l'argent (FCFA, versé par Mobile Money)
// quand des filleuls arrivent par leur lien. Tout est calculé pour que chaque filleul reste rentable :
// - inscription d'un filleul qui crée son premier CV : petite prime, seulement pour les 3 premiers filleuls ;
// - premier achat d'un filleul : prime fixe ;
// - puis un pourcentage de chaque achat du filleul pendant 12 mois.
// Garde-fous : rien si le filleul a le même appareil ou la même connexion que l'ambassadeur, gains bloqués 14 jours,
// retrait à partir d'un seuil, plafond mensuel, et chaque versement est validé à la main par l'administrateur.

export const AMBASSADOR_RULES = {
  /** Prime quand un filleul s'inscrit et crée son premier CV (FCFA). */
  signupReward: 50,
  /** Nombre de filleuls inscrits qui rapportent cette prime, par ambassadeur. */
  signupRewardLimit: 3,
  /** Prime au premier achat d'un filleul (FCFA). */
  firstPurchaseReward: 100,
  /** Pourcentage de chaque achat du filleul. */
  commissionPercent: 10,
  /** Durée pendant laquelle les achats du filleul rapportent un pourcentage. */
  commissionMonths: 12,
  /** Délai avant qu'un gain puisse être retiré (paiement annulé, fraude). */
  holdDays: 14,
  /** Retrait possible à partir de ce montant (FCFA). */
  minPayout: 2000,
  /** Plafond de gains par mois et par ambassadeur (FCFA). */
  monthlyCap: 25000,
  /** Frais d'envoi Mobile Money, déduits du retrait (pourcentage, arrondi au franc supérieur). */
  payoutFeePercent: 1,
} as const;

/** Frais d'envoi d'un retrait et montant réellement envoyé. */
export function payoutSplit(amount: number) {
  const fee = Math.ceil((amount * AMBASSADOR_RULES.payoutFeePercent) / 100);
  return { fee, net: amount - fee };
}

export type AmbassadorStatus = 'pending' | 'active' | 'refused' | 'suspended';
export type EarningKind = 'signup' | 'first_purchase' | 'commission';

export class AmbassadorError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

export const AMBASSADOR_SCHEMA = `
create table if not exists ambassadors (
  user_id integer primary key references users(id) on delete cascade,
  status text not null default 'pending',
  momo_number text not null default '',
  momo_name text not null default '',
  motivation text not null default '',
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
-- Contrat signé en ligne : nom légal exact, version acceptée, signature tapée, date et adresse internet.
alter table ambassadors add column if not exists legal_first_name text not null default '';
alter table ambassadors add column if not exists legal_last_name text not null default '';
alter table ambassadors add column if not exists contract_version text not null default '';
alter table ambassadors add column if not exists contract_signature text not null default '';
alter table ambassadors add column if not exists contract_signed_at timestamptz;
alter table ambassadors add column if not exists contract_ip text not null default '';
-- Signature dessinée à l'écran (image PNG), en plus du nom tapé.
alter table ambassadors add column if not exists signature_image text not null default '';

-- Changement du numéro de paiement d'un ambassadeur validé : seulement sur justificatifs, vérifiés par l'administrateur.
-- Les justificatifs sont effacés dès que la demande est traitée.
create table if not exists ambassador_number_changes (
  id serial primary key,
  ambassador_id integer not null references users(id) on delete cascade,
  old_number text not null,
  new_number text not null,
  documents text,
  status text not null default 'requested',
  note text not null default '',
  created_at timestamptz not null default now(),
  decided_at timestamptz
);

create table if not exists ambassador_payouts (
  id serial primary key,
  ambassador_id integer not null references users(id) on delete cascade,
  amount integer not null,
  momo_number text not null,
  momo_name text not null default '',
  status text not null default 'requested',
  fee integer not null default 0,
  note text not null default '',
  requested_at timestamptz not null default now(),
  decided_at timestamptz
);

create table if not exists ambassador_earnings (
  id serial primary key,
  ambassador_id integer not null references users(id) on delete cascade,
  -- Si le filleul supprime son compte, l'historique des gains (déjà payés ou non) est gardé.
  filleul_id integer references users(id) on delete set null,
  kind text not null,
  payment_id integer references payments(id) on delete set null,
  amount integer not null,
  status text not null default 'pending',
  available_at timestamptz not null,
  payout_id integer references ambassador_payouts(id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index if not exists ambassador_earnings_once on ambassador_earnings (filleul_id, kind) where kind in ('signup', 'first_purchase');
create unique index if not exists ambassador_earnings_payment on ambassador_earnings (payment_id, kind) where payment_id is not null;
create index if not exists ambassador_earnings_owner on ambassador_earnings (ambassador_id);
`;

export interface AmbassadorSummary {
  status: AmbassadorStatus | null;
  momoNumber: string;
  momoName: string;
  legalFirstName: string;
  legalLastName: string;
  contract: { version: string; signedAt: string; current: boolean; signatureImage: string } | null;
  numberChange: { newNumber: string; status: string; requestedAt: string; note: string } | null;
  rules: typeof AMBASSADOR_RULES;
  stats: { invited: number; signupsRewarded: number; buyers: number };
  earnings: { pending: number; available: number; requested: number; paid: number };
  payouts: { id: number; amount: number; fee: number; net: number; status: string; requestedAt: string; decidedAt: string | null }[];
}

const cleanPhone = (v: string) => v.replace(/[^\d+]/g, '').slice(0, 20);
const cleanName = (v: string) => (v ?? '').replace(/\s+/g, ' ').trim().slice(0, 80);
const DOC_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

export type ChangeDocument = { name: string; mediaType: string; data: string };
export type ApplyInput = {
  firstName: string;
  lastName: string;
  momoNumber: string;
  motivation?: string;
  contractVersion: string;
  accept: boolean;
  signature: string;
  /** Signature dessinée au doigt ou à la souris (data:image/png;base64,…). */
  signatureImage: string;
  ip?: string;
};

export function createAmbassadors(db: Db, now: () => Date = () => new Date()) {
  const R = AMBASSADOR_RULES;
  const availableAt = () => new Date(now().getTime() + R.holdDays * 86_400_000);

  /**
   * Ambassadeur actif d'un filleul, si le filleul n'utilise pas le même appareil (pas de gain sur soi-même).
   * Pour la prime d'inscription, on exige aussi une connexion différente. Pour les achats, non : beaucoup de
   * personnes partagent la même adresse internet (données mobiles, wifi d'école ou de cybercafé), et acheter
   * pour soi via un faux filleul coûte plus que ce que ça rapporte.
   */
  async function sponsorOf(tx: Db, filleulId: number, strict = false) {
    const [row] = await tx.query<{ ambassador_id: number; filleul_created: string }>(
      `select a.user_id as ambassador_id, f.created_at as filleul_created
       from users f join users s on s.id = f.referred_by join ambassadors a on a.user_id = s.id
       where f.id = $1 and a.status = 'active'
         and length(f.signup_device) >= 8 and f.signup_device <> s.signup_device
         and (not $2 or f.signup_ip = '' or f.signup_ip <> s.signup_ip)`,
      [filleulId, strict],
    );
    return row ?? null;
  }

  /** Montant encore possible ce mois-ci (plafond mensuel). */
  async function roomThisMonth(tx: Db, ambassadorId: number, amount: number) {
    const [{ total }] = await tx.query<{ total: number }>(
      `select coalesce(sum(amount), 0)::int as total from ambassador_earnings
       where ambassador_id = $1 and status <> 'cancelled' and created_at >= date_trunc('month', $2::timestamptz)`,
      [ambassadorId, now().toISOString()],
    );
    return Math.max(0, Math.min(amount, R.monthlyCap - total));
  }

  async function earn(tx: Db, ambassadorId: number, filleulId: number, kind: EarningKind, amount: number, paymentId: number | null) {
    const value = await roomThisMonth(tx, ambassadorId, amount);
    if (value <= 0) return 0;
    const rows = await tx.query(
      `insert into ambassador_earnings (ambassador_id, filleul_id, kind, payment_id, amount, available_at)
       values ($1, $2, $3, $4, $5, $6) on conflict do nothing returning id`,
      [ambassadorId, filleulId, kind, paymentId, value, availableAt().toISOString()],
    );
    return rows.length ? value : 0;
  }

  return {
    /** Le filleul a créé son premier CV : prime d'inscription, pour les 3 premiers filleuls seulement. */
    async onFirstCv(filleulId: number): Promise<number> {
      return db.transaction(async (tx) => {
        const sponsor = await sponsorOf(tx, filleulId, true);
        if (!sponsor) return 0;
        // Verrou sur l'ambassadeur : deux filleuls en même temps ne dépassent pas la limite.
        await tx.query('select 1 from ambassadors where user_id = $1 for update', [sponsor.ambassador_id]);
        const [{ n }] = await tx.query<{ n: number }>(
          `select count(*)::int as n from ambassador_earnings where ambassador_id = $1 and kind = 'signup'`,
          [sponsor.ambassador_id],
        );
        if (n >= R.signupRewardLimit) return 0;
        return earn(tx, sponsor.ambassador_id, filleulId, 'signup', R.signupReward, null);
      });
    },

    /** Achat confirmé d'un filleul (dans la transaction du paiement) : prime du premier achat et pourcentage. */
    async onPurchaseInTx(tx: Db, filleulId: number, paymentId: number, amount: number): Promise<number> {
      const sponsor = await sponsorOf(tx, filleulId);
      if (!sponsor) return 0;
      const ageMonths = (now().getTime() - new Date(sponsor.filleul_created).getTime()) / (30.44 * 86_400_000);
      let total = 0;
      const [{ bought }] = await tx.query<{ bought: number }>(
        `select count(*)::int as bought from ambassador_earnings where filleul_id = $1 and kind = 'first_purchase'`,
        [filleulId],
      );
      if (!bought) total += await earn(tx, sponsor.ambassador_id, filleulId, 'first_purchase', R.firstPurchaseReward, null);
      if (ageMonths <= R.commissionMonths) {
        const commission = Math.floor((amount * R.commissionPercent) / 100);
        if (commission > 0) total += await earn(tx, sponsor.ambassador_id, filleulId, 'commission', commission, paymentId);
      }
      return total;
    },

    /**
     * Demande pour devenir ambassadeur, avec signature du contrat : nom et prénoms légaux exacts (ceux de la pièce
     * d'identité), numéro Mobile Money enregistré à ce nom, et signature tapée identique au nom complet.
     * Une fois validé, le nom et le numéro ne se changent plus ici (changement de numéro sur justificatifs).
     */
    async apply(userId: number, input: ApplyInput) {
      const firstName = cleanName(input.firstName);
      const lastName = cleanName(input.lastName);
      const momoNumber = cleanPhone(input.momoNumber);
      if (firstName.length < 2 || lastName.length < 2) throw new AmbassadorError('Indiquez vos nom et prénoms exacts, comme sur votre pièce d’identité.');
      if (momoNumber.replace(/\D/g, '').length < 8) throw new AmbassadorError('Indiquez un numéro Mobile Money valide.');
      if (input.contractVersion !== AMBASSADOR_CONTRACT_VERSION || !input.accept) throw new AmbassadorError('Lisez et acceptez le contrat Ambassadeur pour continuer.');
      if (!sameName(input.signature, `${firstName} ${lastName}`) && !sameName(input.signature, `${lastName} ${firstName}`)) {
        throw new AmbassadorError('Pour signer, tapez exactement vos prénoms et votre nom.');
      }
      const image = String(input.signatureImage ?? '');
      if (!/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(image) || image.length < 200) throw new AmbassadorError('Signez le contrat dans le cadre prévu.');
      if (image.length > 500_000) throw new AmbassadorError('Signature trop lourde : signez à nouveau dans le cadre.', 413);
      const [current] = await db.query<{ status: string }>('select status from ambassadors where user_id = $1', [userId]);
      if (current && current.status !== 'pending' && current.status !== 'refused') {
        throw new AmbassadorError('Votre compte ambassadeur est déjà validé. Pour changer de numéro, envoyez une demande avec justificatifs.', 409);
      }
      await db.query(
        `insert into ambassadors (user_id, momo_number, momo_name, motivation, legal_first_name, legal_last_name, contract_version, contract_signature, contract_signed_at, contract_ip, signature_image)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         on conflict (user_id) do update set momo_number = excluded.momo_number, momo_name = excluded.momo_name,
           motivation = case when excluded.motivation = '' then ambassadors.motivation else excluded.motivation end,
           legal_first_name = excluded.legal_first_name, legal_last_name = excluded.legal_last_name,
           contract_version = excluded.contract_version, contract_signature = excluded.contract_signature,
           contract_signed_at = excluded.contract_signed_at, contract_ip = excluded.contract_ip, signature_image = excluded.signature_image,
           status = 'pending'`,
        [userId, momoNumber, `${firstName} ${lastName}`, (input.motivation ?? '').trim().slice(0, 500), firstName, lastName, AMBASSADOR_CONTRACT_VERSION, input.signature.trim().slice(0, 120), now().toISOString(), (input.ip ?? '').slice(0, 60), image],
      );
      return this.summary(userId);
    },

    /** Ambassadeur validé : demande de nouveau numéro, avec pièce d'identité et preuve que le numéro est à son nom. */
    async requestNumberChange(userId: number, input: { momoNumber: string; documents: ChangeDocument[] }) {
      const momoNumber = cleanPhone(input.momoNumber);
      if (momoNumber.replace(/\D/g, '').length < 8) throw new AmbassadorError('Indiquez un numéro Mobile Money valide.');
      const docs = (input.documents ?? []).filter((d) => d && typeof d.data === 'string' && DOC_TYPES.includes(d.mediaType));
      if (docs.length < 2) throw new AmbassadorError('Joignez votre pièce d’identité et une preuve que le numéro est à votre nom (capture du compte Mobile Money).');
      if (docs.length > 4 || docs.some((d) => d.data.length > 4_000_000)) throw new AmbassadorError('Fichiers trop lourds : 4 fichiers de 3 Mo au plus.', 413);
      return db.transaction(async (tx) => {
        const [a] = await tx.query<{ status: string; momo_number: string }>('select status, momo_number from ambassadors where user_id = $1 for update', [userId]);
        if (!a || (a.status !== 'active' && a.status !== 'suspended')) throw new AmbassadorError('Votre compte ambassadeur n’est pas actif.', 403);
        if (cleanPhone(a.momo_number) === momoNumber) throw new AmbassadorError('C’est déjà votre numéro de paiement.');
        const [open] = await tx.query(`select 1 from ambassador_number_changes where ambassador_id = $1 and status = 'requested'`, [userId]);
        if (open) throw new AmbassadorError('Une demande de changement de numéro est déjà en cours d’examen.', 409);
        const [row] = await tx.query<{ id: number }>(
          'insert into ambassador_number_changes (ambassador_id, old_number, new_number, documents) values ($1, $2, $3, $4) returning id',
          [userId, a.momo_number, momoNumber, JSON.stringify(docs.map((d) => ({ name: String(d.name).slice(0, 120), mediaType: d.mediaType, data: d.data })))],
        );
        return { id: row.id, oldNumber: a.momo_number, newNumber: momoNumber };
      });
    },

    async summary(userId: number): Promise<AmbassadorSummary> {
      const [a] = await db.query<{ status: AmbassadorStatus; momo_number: string; momo_name: string; legal_first_name: string; legal_last_name: string; contract_version: string; contract_signed_at: string | null; signature_image: string }>(
        'select status, momo_number, momo_name, legal_first_name, legal_last_name, contract_version, contract_signed_at, signature_image from ambassadors where user_id = $1',
        [userId],
      );
      const [change] = await db.query<{ new_number: string; status: string; created_at: string; note: string }>(
        `select new_number, status, created_at, note from ambassador_number_changes where ambassador_id = $1 order by id desc limit 1`,
        [userId],
      );
      const [stats] = await db.query<{ invited: number; signups: number; buyers: number }>(
        `select (select count(*)::int from users where referred_by = $1) as invited,
                (select count(*)::int from ambassador_earnings where ambassador_id = $1 and kind = 'signup' and status <> 'cancelled') as signups,
                (select count(*)::int from ambassador_earnings where ambassador_id = $1 and kind = 'first_purchase' and status <> 'cancelled') as buyers`,
        [userId],
      );
      const sums = await db.query<{ bucket: string; total: number }>(
        `select case when status = 'pending' and available_at > $2 then 'pending'
                     when status = 'pending' then 'available'
                     else status end as bucket, coalesce(sum(amount), 0)::int as total
         from ambassador_earnings where ambassador_id = $1 and status <> 'cancelled' group by 1`,
        [userId, now().toISOString()],
      );
      const get = (b: string) => sums.find((s) => s.bucket === b)?.total ?? 0;
      const payouts = await db.query<{ id: number; amount: number; fee: number; status: string; requested_at: string; decided_at: string | null }>(
        'select id, amount, fee, status, requested_at, decided_at from ambassador_payouts where ambassador_id = $1 order by id desc limit 20',
        [userId],
      );
      return {
        status: a?.status ?? null,
        momoNumber: a?.momo_number ?? '',
        momoName: a?.momo_name ?? '',
        legalFirstName: a?.legal_first_name ?? '',
        legalLastName: a?.legal_last_name ?? '',
        contract: a?.contract_signed_at ? { version: a.contract_version, signedAt: new Date(a.contract_signed_at).toISOString(), current: a.contract_version === AMBASSADOR_CONTRACT_VERSION, signatureImage: a.signature_image } : null,
        numberChange: change ? { newNumber: change.new_number, status: change.status, requestedAt: new Date(change.created_at).toISOString(), note: change.note } : null,
        rules: R,
        stats: { invited: stats.invited, signupsRewarded: stats.signups, buyers: stats.buyers },
        earnings: { pending: get('pending'), available: get('available'), requested: get('requested'), paid: get('paid') },
        payouts: payouts.map((p) => ({ id: p.id, amount: p.amount, fee: p.fee, net: p.amount - p.fee, status: p.status, requestedAt: new Date(p.requested_at).toISOString(), decidedAt: p.decided_at ? new Date(p.decided_at).toISOString() : null })),
      };
    },

    /** Demande de retrait de tous les gains disponibles (au moins le seuil). */
    async requestPayout(userId: number) {
      return db.transaction(async (tx) => {
        const [a] = await tx.query<{ status: string; momo_number: string; momo_name: string }>(
          'select status, momo_number, momo_name from ambassadors where user_id = $1 for update',
          [userId],
        );
        if (!a || a.status !== 'active') throw new AmbassadorError('Votre compte ambassadeur n’est pas actif.', 403);
        const [open] = await tx.query(`select 1 from ambassador_payouts where ambassador_id = $1 and status = 'requested'`, [userId]);
        if (open) throw new AmbassadorError('Un retrait est déjà en cours de traitement.', 409);
        const [changing] = await tx.query(`select 1 from ambassador_number_changes where ambassador_id = $1 and status = 'requested'`, [userId]);
        if (changing) throw new AmbassadorError('Votre changement de numéro est en cours d’examen : le retrait sera possible ensuite.', 409);
        const [{ total }] = await tx.query<{ total: number }>(
          `select coalesce(sum(amount), 0)::int as total from ambassador_earnings
           where ambassador_id = $1 and status = 'pending' and available_at <= $2`,
          [userId, now().toISOString()],
        );
        if (total < R.minPayout) throw new AmbassadorError(`Le retrait est possible à partir de ${R.minPayout} FCFA disponibles.`, 400);
        const { fee, net } = payoutSplit(total);
        const [p] = await tx.query<{ id: number }>(
          'insert into ambassador_payouts (ambassador_id, amount, fee, momo_number, momo_name) values ($1, $2, $3, $4, $5) returning id',
          [userId, total, fee, a.momo_number, a.momo_name],
        );
        await tx.query(
          `update ambassador_earnings set status = 'requested', payout_id = $2
           where ambassador_id = $1 and status = 'pending' and available_at <= $3`,
          [userId, p.id, now().toISOString()],
        );
        return { id: p.id, amount: total, fee, net };
      });
    },

    // ——— Administration ———

    async adminList() {
      const rows = await db.query<{
        user_id: number; identifier: string; name: string; status: string; momo_number: string; momo_name: string; motivation: string;
        created_at: string; invited: number; buyers: number; earned: number; paid: number; contract_version: string; contract_signed_at: string | null;
      }>(
        `select a.user_id, u.identifier, u.name, a.status, a.momo_number, a.momo_name, a.motivation, a.created_at, a.contract_version, a.contract_signed_at,
                (select count(*)::int from users f where f.referred_by = a.user_id) as invited,
                (select count(*)::int from ambassador_earnings e where e.ambassador_id = a.user_id and e.kind = 'first_purchase' and e.status <> 'cancelled') as buyers,
                (select coalesce(sum(amount), 0)::int from ambassador_earnings e where e.ambassador_id = a.user_id and e.status <> 'cancelled') as earned,
                (select coalesce(sum(amount), 0)::int from ambassador_earnings e where e.ambassador_id = a.user_id and e.status = 'paid') as paid
         from ambassadors a join users u on u.id = a.user_id
         order by (a.status = 'pending') desc, a.created_at desc limit 200`,
      );
      const payouts = await db.query<{ id: number; ambassador_id: number; identifier: string; amount: number; fee: number; momo_number: string; momo_name: string; status: string; requested_at: string }>(
        `select p.id, p.ambassador_id, u.identifier, p.amount, p.fee, p.momo_number, p.momo_name, p.status, p.requested_at
         from ambassador_payouts p join users u on u.id = p.ambassador_id
         order by (p.status = 'requested') desc, p.id desc limit 100`,
      );
      const changes = await db.query<{ id: number; ambassador_id: number; identifier: string; momo_name: string; old_number: string; new_number: string; status: string; created_at: string; docs: number }>(
        `select c.id, c.ambassador_id, u.identifier, a.momo_name, c.old_number, c.new_number, c.status, c.created_at,
                coalesce(json_array_length(c.documents::json), 0) as docs
         from ambassador_number_changes c join users u on u.id = c.ambassador_id join ambassadors a on a.user_id = c.ambassador_id
         order by (c.status = 'requested') desc, c.id desc limit 50`,
      );
      return {
        numberChanges: changes.map((c) => ({ id: c.id, userId: c.ambassador_id, identifier: c.identifier, legalName: c.momo_name, oldNumber: c.old_number, newNumber: c.new_number, status: c.status, requestedAt: new Date(c.created_at).toISOString(), documents: Number(c.docs) })),
        ambassadors: rows.map((r) => ({ userId: r.user_id, identifier: r.identifier, name: r.name, status: r.status, momoNumber: r.momo_number, momoName: r.momo_name, contractVersion: r.contract_version, contractSignedAt: r.contract_signed_at ? new Date(r.contract_signed_at).toISOString() : null, motivation: r.motivation, createdAt: new Date(r.created_at).toISOString(), invited: r.invited, buyers: r.buyers, earned: r.earned, paid: r.paid })),
        payouts: payouts.map((p) => ({ id: p.id, userId: p.ambassador_id, identifier: p.identifier, amount: p.amount, fee: p.fee, net: p.amount - p.fee, momoNumber: p.momo_number, momoName: p.momo_name, status: p.status, requestedAt: new Date(p.requested_at).toISOString() })),
      };
    },

    async setStatus(userId: number, status: AmbassadorStatus) {
      if (!['pending', 'active', 'refused', 'suspended'].includes(status)) throw new AmbassadorError('Statut inconnu.');
      if (!Number.isInteger(userId)) throw new AmbassadorError('Ambassadeur introuvable.', 404);
      const rows = await db.query('update ambassadors set status = $2, decided_at = now() where user_id = $1 returning user_id', [userId, status]);
      if (!rows.length) throw new AmbassadorError('Ambassadeur introuvable.', 404);
    },

    /** Justificatifs d'une demande de changement de numéro (pour l'administrateur). */
    async numberChangeDocuments(id: number): Promise<ChangeDocument[]> {
      if (!Number.isInteger(id)) throw new AmbassadorError('Demande introuvable.', 404);
      const [row] = await db.query<{ documents: string | null }>('select documents from ambassador_number_changes where id = $1', [id]);
      if (!row) throw new AmbassadorError('Demande introuvable.', 404);
      return row.documents ? (JSON.parse(row.documents) as ChangeDocument[]) : [];
    },

    /** Changement de numéro accepté (le numéro est mis à jour) ou refusé ; les justificatifs sont effacés dans les deux cas. */
    async decideNumberChange(id: number, approve: boolean, note = '') {
      if (!Number.isInteger(id)) throw new AmbassadorError('Demande introuvable.', 404);
      return db.transaction(async (tx) => {
        const [c] = await tx.query<{ ambassador_id: number; new_number: string; status: string }>('select ambassador_id, new_number, status from ambassador_number_changes where id = $1 for update', [id]);
        if (!c) throw new AmbassadorError('Demande introuvable.', 404);
        if (c.status !== 'requested') throw new AmbassadorError('Cette demande a déjà été traitée.', 409);
        await tx.query(`update ambassador_number_changes set status = $2, note = $3, documents = null, decided_at = now() where id = $1`, [id, approve ? 'approved' : 'refused', note.slice(0, 300)]);
        if (approve) await tx.query('update ambassadors set momo_number = $2 where user_id = $1', [c.ambassador_id, c.new_number]);
      });
    },

    /** Fraude constatée : annule les gains pas encore payés (ni demandés) de l'ambassadeur. */
    async cancelUnpaid(userId: number) {
      if (!Number.isInteger(userId)) throw new AmbassadorError('Ambassadeur introuvable.', 404);
      const rows = await db.query(`update ambassador_earnings set status = 'cancelled' where ambassador_id = $1 and status = 'pending' returning id`, [userId]);
      return rows.length;
    },

    /** Retrait envoyé par Mobile Money (paid) ou refusé (refused : les gains redeviennent disponibles). */
    async decidePayout(payoutId: number, decision: 'paid' | 'refused', note = '') {
      if (!Number.isInteger(payoutId)) throw new AmbassadorError('Retrait introuvable.', 404);
      return db.transaction(async (tx) => {
        const [p] = await tx.query<{ status: string }>('select status from ambassador_payouts where id = $1 for update', [payoutId]);
        if (!p) throw new AmbassadorError('Retrait introuvable.', 404);
        if (p.status !== 'requested') throw new AmbassadorError('Ce retrait a déjà été traité.', 409);
        await tx.query('update ambassador_payouts set status = $2, note = $3, decided_at = now() where id = $1', [payoutId, decision, note.slice(0, 300)]);
        if (decision === 'paid') await tx.query(`update ambassador_earnings set status = 'paid' where payout_id = $1`, [payoutId]);
        else await tx.query(`update ambassador_earnings set status = 'pending', payout_id = null where payout_id = $1`, [payoutId]);
      });
    },
  };
}

export type Ambassadors = ReturnType<typeof createAmbassadors>;
