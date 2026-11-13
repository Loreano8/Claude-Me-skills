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
  /** Sans nouveau filleul ni gain pendant ce nombre de mois, le contrat prend fin (avertissement un mois avant). */
  inactivityMonths: 12,
} as const;

/** Frais d'envoi d'un retrait et montant réellement envoyé. */
export function payoutSplit(amount: number) {
  const fee = Math.ceil((amount * AMBASSADOR_RULES.payoutFeePercent) / 100);
  return { fee, net: amount - fee };
}

export type AmbassadorStatus = 'pending' | 'active' | 'refused' | 'suspended' | 'ended';
/** Fin du contrat : départ volontaire, inactivité, triche, ou arrêt décidé par CVCasa (sans faute de l'ambassadeur). */
export type EndReason = 'left' | 'inactive' | 'fraud' | 'company';
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
-- Date de la première validation : seuls les filleuls inscrits après rapportent quelque chose.
alter table ambassadors add column if not exists activated_at timestamptz;
-- Fin du contrat et avertissement d'inactivité.
alter table ambassadors add column if not exists ended_reason text not null default '';
alter table ambassadors add column if not exists ended_at timestamptz;
alter table ambassadors add column if not exists inactivity_warned_at timestamptz;

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
  endedReason: EndReason | null;
  /** Date de fin prévue si rien ne se passe (inactivité), sinon null. */
  inactivityWarning: string | null;
  contract: { version: string; signedAt: string; current: boolean } | null;
  numberChange: { newNumber: string; status: string; requestedAt: string; note: string } | null;
  rules: typeof AMBASSADOR_RULES;
  stats: { invited: number; signupsRewarded: number; buyers: number };
  earnings: { pending: number; available: number; requested: number; paid: number };
  payouts: { id: number; amount: number; fee: number; net: number; status: string; note: string; requestedAt: string; decidedAt: string | null }[];
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
       where f.id = $1 and a.status = 'active' and a.activated_at is not null and f.created_at >= a.activated_at
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

  async function availableNow(tx: Db, userId: number) {
    const [{ total }] = await tx.query<{ total: number }>(
      `select coalesce(sum(amount), 0)::int as total from ambassador_earnings where ambassador_id = $1 and status = 'pending' and available_at <= $2`,
      [userId, now().toISOString()],
    );
    return total;
  }

  /**
   * Fin du contrat. Départ volontaire, inactivité ou triche : les gains non versés sont perdus.
   * Arrêt par CVCasa : tous les gains deviennent disponibles tout de suite et restent dus, même sous le seuil.
   */
  async function endContract(tx: Db, userId: number, reason: EndReason) {
    await refuseOpenPayouts(tx, userId, reason === 'company' ? 'Programme arrêté : refaites votre demande de retrait.' : 'Contrat terminé.');
    if (reason === 'company') {
      await tx.query(`update ambassador_earnings set available_at = least(available_at, $2) where ambassador_id = $1 and status = 'pending'`, [userId, now().toISOString()]);
    } else {
      await tx.query(`update ambassador_earnings set status = 'cancelled' where ambassador_id = $1 and status = 'pending'`, [userId]);
    }
    // Demande de changement de numéro en cours : refusée, justificatifs effacés.
    await tx.query(`update ambassador_number_changes set status = 'refused', note = 'Contrat terminé.', documents = null, decided_at = now() where ambassador_id = $1 and status = 'requested'`, [userId]);
    await tx.query(`update ambassadors set status = 'ended', ended_reason = $2, ended_at = now(), decided_at = now() where user_id = $1`, [userId, reason]);
  }

  async function refuseOpenPayouts(tx: Db, userId: number, note: string) {
    const open = await tx.query<{ id: number }>(
      `update ambassador_payouts set status = 'refused', note = $2, decided_at = now() where ambassador_id = $1 and status = 'requested' returning id`,
      [userId, note],
    );
    for (const p of open) await tx.query(`update ambassador_earnings set status = 'pending', payout_id = null where payout_id = $1 and status = 'requested'`, [p.id]);
  }

  return {
    /** Le filleul a créé son premier CV : prime d'inscription, pour les 3 premiers filleuls seulement. */
    async onFirstCv(filleulId: number): Promise<number> {
      return db.transaction(async (tx) => {
        const sponsor = await sponsorOf(tx, filleulId, true);
        if (!sponsor) return 0;
        // Vraiment le premier CV de ce compte (une seule création enregistrée).
        const [{ cvs }] = await tx.query<{ cvs: number }>(`select count(*)::int as cvs from credit_ledger where user_id = $1 and reason = 'structure'`, [filleulId]);
        if (cvs > 1) return 0;
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
      // Verrou sur l'ambassadeur : deux achats en même temps ne dépassent pas le plafond mensuel.
      await tx.query('select 1 from ambassadors where user_id = $1 for update', [sponsor.ambassador_id]);
      const ageMonths = (now().getTime() - new Date(sponsor.filleul_created).getTime()) / (30.44 * 86_400_000);
      let total = 0;
      // Premier achat : aucun autre paiement réussi pour ce compte, et aucune prime déjà versée.
      const [{ bought }] = await tx.query<{ bought: number }>(
        `select (select count(*)::int from payments where user_id = $1 and id <> $2 and status in ('approved', 'transferred'))
              + (select count(*)::int from ambassador_earnings where filleul_id = $1 and kind = 'first_purchase') as bought`,
        [filleulId, paymentId],
      );
      if (!bought) total += await earn(tx, sponsor.ambassador_id, filleulId, 'first_purchase', R.firstPurchaseReward, paymentId);
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
      const [current] = await db.query<{ status: string; contract_version: string; legal_first_name: string; legal_last_name: string; ended_reason: string; decided_at: string | null }>(
        'select status, contract_version, legal_first_name, legal_last_name, ended_reason, decided_at from ambassadors where user_id = $1',
        [userId],
      );
      if (current?.status === 'refused' && current.decided_at && new Date(current.decided_at).getTime() > now().getTime() - 7 * 86_400_000) {
        throw new AmbassadorError('Votre demande a été refusée récemment. Vous pourrez en refaire une dans quelques jours.', 429);
      }
      if (current?.status === 'ended' && current.ended_reason === 'fraud') throw new AmbassadorError('Votre contrat a été arrêté pour non-respect des règles : une nouvelle demande n’est pas possible.', 403);
      if (current && current.status !== 'pending' && current.status !== 'refused' && current.status !== 'ended') {
        // Compte validé : seule une nouvelle version du contrat peut être signée, au même nom légal.
        if (current.contract_version === AMBASSADOR_CONTRACT_VERSION || !sameName(`${firstName} ${lastName}`, `${current.legal_first_name} ${current.legal_last_name}`)) {
          throw new AmbassadorError('Votre compte ambassadeur est déjà validé. Pour changer de numéro, envoyez une demande avec justificatifs.', 409);
        }
        await db.query(
          `update ambassadors set contract_version = $2, contract_signature = $3, contract_signed_at = $4, contract_ip = $5, signature_image = $6 where user_id = $1`,
          [userId, AMBASSADOR_CONTRACT_VERSION, input.signature.trim().slice(0, 120), now().toISOString(), (input.ip ?? '').slice(0, 60), image],
        );
        return this.summary(userId);
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
      const docs = (input.documents ?? []).filter(
        (d) => d && typeof d.data === 'string' && DOC_TYPES.includes(d.mediaType) && d.data.length >= 1000 && /^[A-Za-z0-9+/=]+$/.test(d.data),
      );
      if (docs.length < 2) throw new AmbassadorError('Joignez votre pièce d’identité et une preuve que le numéro est à votre nom (capture du compte Mobile Money).');
      if (docs.length > 4 || docs.reduce((n, d) => n + d.data.length, 0) > 10_000_000) throw new AmbassadorError('Fichiers trop lourds : 7 Mo au total au plus.', 413);
      return db.transaction(async (tx) => {
        const [a] = await tx.query<{ status: string; momo_number: string }>('select status, momo_number from ambassadors where user_id = $1 for update', [userId]);
        if (!a || (a.status !== 'active' && a.status !== 'suspended')) throw new AmbassadorError('Votre compte ambassadeur n’est pas actif.', 403);
        if (cleanPhone(a.momo_number) === momoNumber) throw new AmbassadorError('C’est déjà votre numéro de paiement.');
        const [open] = await tx.query(`select 1 from ambassador_number_changes where ambassador_id = $1 and status = 'requested'`, [userId]);
        if (open) throw new AmbassadorError('Une demande de changement de numéro est déjà en cours d’examen.', 409);
        const [paying] = await tx.query(`select 1 from ambassador_payouts where ambassador_id = $1 and status = 'requested'`, [userId]);
        if (paying) throw new AmbassadorError('Un retrait est en cours vers votre numéro actuel. Attendez qu’il soit traité pour changer de numéro.', 409);
        const [row] = await tx.query<{ id: number }>(
          'insert into ambassador_number_changes (ambassador_id, old_number, new_number, documents) values ($1, $2, $3, $4) returning id',
          [userId, a.momo_number, momoNumber, JSON.stringify(docs.map((d) => ({ name: String(d.name).slice(0, 120), mediaType: d.mediaType, data: d.data })))],
        );
        return { id: row.id, oldNumber: a.momo_number, newNumber: momoNumber };
      });
    },

    async summary(userId: number): Promise<AmbassadorSummary> {
      const [a] = await db.query<{ status: AmbassadorStatus; momo_number: string; momo_name: string; legal_first_name: string; legal_last_name: string; contract_version: string; contract_signed_at: string | null; signature_image: string; ended_reason: string; inactivity_warned_at: string | null }>(
        'select status, momo_number, momo_name, legal_first_name, legal_last_name, contract_version, contract_signed_at, signature_image, ended_reason, inactivity_warned_at from ambassadors where user_id = $1',
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
      const payouts = await db.query<{ id: number; amount: number; fee: number; status: string; note: string; requested_at: string; decided_at: string | null }>(
        'select id, amount, fee, status, note, requested_at, decided_at from ambassador_payouts where ambassador_id = $1 order by id desc limit 20',
        [userId],
      );
      return {
        status: a?.status ?? null,
        momoNumber: a?.momo_number ?? '',
        momoName: a?.momo_name ?? '',
        legalFirstName: a?.legal_first_name ?? '',
        legalLastName: a?.legal_last_name ?? '',
        endedReason: (a?.ended_reason || null) as EndReason | null,
        inactivityWarning: a?.status === 'active' && a.inactivity_warned_at ? new Date(new Date(a.inactivity_warned_at).getTime() + 30 * 86_400_000).toISOString() : null,
        contract: a?.contract_signed_at ? { version: a.contract_version, signedAt: new Date(a.contract_signed_at).toISOString(), current: a.contract_version === AMBASSADOR_CONTRACT_VERSION } : null,
        numberChange: change ? { newNumber: change.new_number, status: change.status, requestedAt: new Date(change.created_at).toISOString(), note: change.note } : null,
        rules: R,
        stats: { invited: stats.invited, signupsRewarded: stats.signups, buyers: stats.buyers },
        earnings: { pending: get('pending'), available: get('available'), requested: get('requested'), paid: get('paid') },
        payouts: payouts.map((p) => ({ id: p.id, amount: p.amount, fee: p.fee, net: p.amount - p.fee, status: p.status, note: p.note, requestedAt: new Date(p.requested_at).toISOString(), decidedAt: p.decided_at ? new Date(p.decided_at).toISOString() : null })),
      };
    },

    /** Demande de retrait de tous les gains disponibles (au moins le seuil). */
    async requestPayout(userId: number) {
      return db.transaction(async (tx) => {
        const [a] = await tx.query<{ status: string; momo_number: string; momo_name: string; ended_reason: string }>(
          'select status, momo_number, momo_name, ended_reason from ambassadors where user_id = $1 for update',
          [userId],
        );
        // Programme arrêté par CVCasa : le solde reste versé, même sous le seuil habituel.
        const closedByUs = a?.status === 'ended' && a.ended_reason === 'company';
        if (!a || (a.status !== 'active' && !closedByUs)) throw new AmbassadorError('Votre compte ambassadeur n’est pas actif.', 403);
        const [open] = await tx.query(`select 1 from ambassador_payouts where ambassador_id = $1 and status = 'requested'`, [userId]);
        if (open) throw new AmbassadorError('Un retrait est déjà en cours de traitement.', 409);
        const [changing] = await tx.query(`select 1 from ambassador_number_changes where ambassador_id = $1 and status = 'requested'`, [userId]);
        if (changing) throw new AmbassadorError('Votre changement de numéro est en cours d’examen : le retrait sera possible ensuite.', 409);
        const at = now().toISOString();
        const [{ total }] = await tx.query<{ total: number }>(
          `select coalesce(sum(amount), 0)::int as total from ambassador_earnings
           where ambassador_id = $1 and status = 'pending' and available_at <= $2`,
          [userId, at],
        );
        if (total < (closedByUs ? 1 : R.minPayout)) throw new AmbassadorError(`Le retrait est possible à partir de ${R.minPayout} FCFA disponibles.`, 400);
        const { fee, net } = payoutSplit(total);
        const [p] = await tx.query<{ id: number }>(
          'insert into ambassador_payouts (ambassador_id, amount, fee, momo_number, momo_name) values ($1, $2, $3, $4, $5) returning id',
          [userId, total, fee, a.momo_number, a.momo_name],
        );
        await tx.query(
          `update ambassador_earnings set status = 'requested', payout_id = $2
           where ambassador_id = $1 and status = 'pending' and available_at <= $3`,
          [userId, p.id, at],
        );
        return { id: p.id, amount: total, fee, net };
      });
    },

    /** L'ambassadeur quitte le programme. Ses gains disponibles doivent d'abord être retirés s'ils atteignent le seuil. */
    async leave(userId: number) {
      await db.transaction(async (tx) => {
        const [a] = await tx.query<{ status: string }>('select status from ambassadors where user_id = $1 for update', [userId]);
        if (!a || a.status !== 'active') throw new AmbassadorError('Votre compte ambassadeur n’est pas actif.', 403);
        const [open] = await tx.query(`select 1 from ambassador_payouts where ambassador_id = $1 and status = 'requested'`, [userId]);
        if (open) throw new AmbassadorError('Un retrait est en cours : attendez qu’il soit traité avant de quitter le programme.', 409);
        const available = await availableNow(tx, userId);
        if (available >= R.minPayout) throw new AmbassadorError(`Demandez d’abord le retrait de vos ${available} FCFA disponibles, puis quittez le programme.`, 409);
        await endContract(tx, userId, 'left');
      });
      return this.summary(userId);
    },

    /**
     * Tâche quotidienne : avertit les ambassadeurs sans activité depuis 11 mois, met fin au contrat à 12 mois
     * (sauf s'ils ont encore de quoi retirer). Renvoie les personnes à prévenir par e-mail.
     */
    async inactivityRun() {
      const at = now();
      const months = (n: number) => new Date(at.getTime() - n * 30.44 * 86_400_000).toISOString();
      const lastActivity = `greatest(a.activated_at, (select max(e.created_at) from ambassador_earnings e where e.ambassador_id = a.user_id),
                                  (select max(f.created_at) from users f where f.referred_by = a.user_id))`;
      const toWarn = await db.query<{ user_id: number; identifier: string; name: string }>(
        `update ambassadors a set inactivity_warned_at = $2 from users u
         where u.id = a.user_id and a.status = 'active' and a.inactivity_warned_at is null and ${lastActivity} < $1
         returning a.user_id, u.identifier, u.name`,
        [months(R.inactivityMonths - 1), at.toISOString()],
      );
      // Nouvelle activité depuis l'avertissement : on l'efface.
      await db.query(`update ambassadors a set inactivity_warned_at = null where a.status = 'active' and a.inactivity_warned_at is not null and ${lastActivity} > a.inactivity_warned_at`);
      const due = await db.query<{ user_id: number }>(
        `select a.user_id from ambassadors a where a.status = 'active' and a.inactivity_warned_at is not null
           and a.inactivity_warned_at < $1 and ${lastActivity} < $2`,
        [new Date(at.getTime() - 30 * 86_400_000).toISOString(), months(R.inactivityMonths)],
      );
      let ended = 0;
      for (const { user_id } of due) {
        ended += await db.transaction(async (tx) => {
          if ((await availableNow(tx, user_id)) >= R.minPayout) return 0;
          const [open] = await tx.query(`select 1 from ambassador_payouts where ambassador_id = $1 and status = 'requested'`, [user_id]);
          if (open) return 0;
          await endContract(tx, user_id, 'inactive');
          return 1;
        });
      }
      return { warned: toWarn.map((w) => ({ identifier: w.identifier, name: w.name })), ended };
    },

    // ——— Administration ———

    /** Fin du contrat décidée par l'administrateur : triche (rien n'est versé) ou arrêt sans faute (le solde reste dû). */
    async endByAdmin(userId: number, reason: 'fraud' | 'company') {
      if (!Number.isInteger(userId)) throw new AmbassadorError('Ambassadeur introuvable.', 404);
      return db.transaction(async (tx) => {
        const [a] = await tx.query('select 1 from ambassadors where user_id = $1 for update', [userId]);
        if (!a) throw new AmbassadorError('Ambassadeur introuvable.', 404);
        await endContract(tx, userId, reason);
      });
    },


    async adminList() {
      const rows = await db.query<{
        user_id: number; identifier: string; name: string; status: string; momo_number: string; momo_name: string; motivation: string;
        created_at: string; invited: number; same_network: number; buyers: number; earned: number; paid: number; contract_version: string; contract_signed_at: string | null; ended_reason: string;
      }>(
        `select a.user_id, u.identifier, u.name, a.status, a.momo_number, a.momo_name, a.motivation, a.created_at, a.contract_version, a.contract_signed_at, a.ended_reason,
                (select count(*)::int from users f where f.referred_by = a.user_id) as invited,
                (select count(*)::int from users f join users s on s.id = a.user_id where f.referred_by = a.user_id
                   and (f.signup_ip = s.signup_ip or f.signup_ip = a.contract_ip or f.signup_device = s.signup_device)) as same_network,
                (select count(*)::int from ambassador_earnings e where e.ambassador_id = a.user_id and e.kind = 'first_purchase' and e.status <> 'cancelled') as buyers,
                (select coalesce(sum(amount), 0)::int from ambassador_earnings e where e.ambassador_id = a.user_id and e.status <> 'cancelled') as earned,
                (select coalesce(sum(amount), 0)::int from ambassador_earnings e where e.ambassador_id = a.user_id and e.status = 'paid') as paid
         from ambassadors a join users u on u.id = a.user_id
         order by (a.status = 'pending') desc, a.created_at desc limit 200`,
      );
      const payouts = await db.query<{ id: number; ambassador_id: number; identifier: string; amount: number; fee: number; momo_number: string; momo_name: string; status: string; requested_at: string; ambassador_status: string }>(
        `select p.id, p.ambassador_id, u.identifier, p.amount, p.fee, p.momo_number, p.momo_name, p.status, p.requested_at, a.status as ambassador_status
         from ambassador_payouts p join users u on u.id = p.ambassador_id join ambassadors a on a.user_id = p.ambassador_id
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
        ambassadors: rows.map((r) => ({ userId: r.user_id, identifier: r.identifier, name: r.name, status: r.status, momoNumber: r.momo_number, momoName: r.momo_name, contractVersion: r.contract_version, contractSignedAt: r.contract_signed_at ? new Date(r.contract_signed_at).toISOString() : null, motivation: r.motivation, createdAt: new Date(r.created_at).toISOString(), invited: r.invited, sameNetwork: r.same_network, endedReason: r.ended_reason, buyers: r.buyers, earned: r.earned, paid: r.paid })),
        payouts: payouts.map((p) => ({ id: p.id, userId: p.ambassador_id, identifier: p.identifier, amount: p.amount, fee: p.fee, net: p.amount - p.fee, momoNumber: p.momo_number, momoName: p.momo_name, status: p.status, ambassadorStatus: p.ambassador_status, requestedAt: new Date(p.requested_at).toISOString() })),
      };
    },

    async setStatus(userId: number, status: AmbassadorStatus, expectedSignedAt?: string) {
      if (!['pending', 'active', 'refused', 'suspended'].includes(status)) throw new AmbassadorError('Statut inconnu.');
      if (!Number.isInteger(userId)) throw new AmbassadorError('Ambassadeur introuvable.', 404);
      return db.transaction(async (tx) => {
        // Validation : l'administrateur valide la demande qu'il a vue. Si elle a été renvoyée entre-temps, on refuse.
        if (expectedSignedAt) {
          const [cur] = await tx.query<{ contract_signed_at: string | null }>('select contract_signed_at from ambassadors where user_id = $1 for update', [userId]);
          if (cur && (!cur.contract_signed_at || new Date(cur.contract_signed_at).toISOString() !== expectedSignedAt)) {
            throw new AmbassadorError('La demande a changé depuis votre affichage : rechargez la liste avant de valider.', 409);
          }
        }
        const rows = await tx.query(
          `update ambassadors set status = $2, decided_at = now(),
             activated_at = case when $2 = 'active' then coalesce(activated_at, now()) else activated_at end
           where user_id = $1 returning user_id`,
          [userId, status],
        );
        if (!rows.length) throw new AmbassadorError('Ambassadeur introuvable.', 404);
        // Suspendu ou refusé : le retrait en attente est refusé, ses gains redeviennent « non versés ».
        if (status !== 'active') await refuseOpenPayouts(tx, userId, 'Compte ambassadeur suspendu.');
      });
    },

    /** Contrat signé : signature dessinée et preuves (pour l'ambassadeur lui-même et pour l'administrateur). */
    async contractDetail(userId: number) {
      if (!Number.isInteger(userId)) throw new AmbassadorError('Ambassadeur introuvable.', 404);
      const [a] = await db.query<{ contract_version: string; contract_signature: string; contract_signed_at: string | null; contract_ip: string; signature_image: string; momo_name: string }>(
        'select contract_version, contract_signature, contract_signed_at, contract_ip, signature_image, momo_name from ambassadors where user_id = $1',
        [userId],
      );
      if (!a || !a.contract_signed_at) throw new AmbassadorError('Aucun contrat signé.', 404);
      return { version: a.contract_version, typedSignature: a.contract_signature, signedAt: new Date(a.contract_signed_at).toISOString(), ip: a.contract_ip, signatureImage: a.signature_image, legalName: a.momo_name };
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
      return db.transaction(async (tx) => {
        await refuseOpenPayouts(tx, userId, 'Gains annulés (fraude).');
        const rows = await tx.query(`update ambassador_earnings set status = 'cancelled' where ambassador_id = $1 and status = 'pending' returning id`, [userId]);
        return rows.length;
      });
    },

    /** Achat remboursé ou annulé après coup : les gains liés à ce paiement, pas encore versés, sont annulés. */
    async onPaymentReversedInTx(tx: Db, paymentId: number) {
      const rows = await tx.query(
        `update ambassador_earnings set status = 'cancelled' where payment_id = $1 and status in ('pending', 'requested') returning payout_id`,
        [paymentId],
      );
      return rows.length;
    },

    /** Retrait envoyé par Mobile Money (paid) ou refusé (refused : les gains redeviennent disponibles). */
    async decidePayout(payoutId: number, decision: 'paid' | 'refused', note = '') {
      if (!Number.isInteger(payoutId)) throw new AmbassadorError('Retrait introuvable.', 404);
      return db.transaction(async (tx) => {
        const [p] = await tx.query<{ status: string; ambassador_status: string }>(
          `select p.status, case when a.status = 'ended' and a.ended_reason = 'company' then 'active' else a.status end as ambassador_status
           from ambassador_payouts p join ambassadors a on a.user_id = p.ambassador_id where p.id = $1 for update of p`,
          [payoutId],
        );
        if (!p) throw new AmbassadorError('Retrait introuvable.', 404);
        if (p.status !== 'requested') throw new AmbassadorError('Ce retrait a déjà été traité.', 409);
        if (decision === 'paid' && p.ambassador_status !== 'active') throw new AmbassadorError('Cet ambassadeur n’est plus actif : ne payez pas ce retrait.', 409);
        await tx.query('update ambassador_payouts set status = $2, note = $3, decided_at = now() where id = $1', [payoutId, decision, note.slice(0, 300)]);
        if (decision === 'paid') await tx.query(`update ambassador_earnings set status = 'paid' where payout_id = $1 and status = 'requested'`, [payoutId]);
        else await tx.query(`update ambassador_earnings set status = 'pending', payout_id = null where payout_id = $1 and status = 'requested'`, [payoutId]);
      });
    },
  };
}

export type Ambassadors = ReturnType<typeof createAmbassadors>;
