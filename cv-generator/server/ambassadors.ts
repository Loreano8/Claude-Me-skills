import type { Db } from './db.ts';

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
} as const;

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

create table if not exists ambassador_payouts (
  id serial primary key,
  ambassador_id integer not null references users(id) on delete cascade,
  amount integer not null,
  momo_number text not null,
  momo_name text not null default '',
  status text not null default 'requested',
  note text not null default '',
  requested_at timestamptz not null default now(),
  decided_at timestamptz
);

create table if not exists ambassador_earnings (
  id serial primary key,
  ambassador_id integer not null references users(id) on delete cascade,
  filleul_id integer not null references users(id) on delete cascade,
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
  rules: typeof AMBASSADOR_RULES;
  stats: { invited: number; signupsRewarded: number; buyers: number };
  earnings: { pending: number; available: number; requested: number; paid: number };
  payouts: { id: number; amount: number; status: string; requestedAt: string; decidedAt: string | null }[];
}

const cleanPhone = (v: string) => v.replace(/[^\d+]/g, '').slice(0, 20);

export function createAmbassadors(db: Db, now: () => Date = () => new Date()) {
  const R = AMBASSADOR_RULES;
  const availableAt = () => new Date(now().getTime() + R.holdDays * 86_400_000);

  /** Ambassadeur actif d'un filleul, si le filleul n'a ni son appareil ni sa connexion (pas de gain sur soi-même). */
  async function sponsorOf(tx: Db, filleulId: number) {
    const [row] = await tx.query<{ ambassador_id: number; filleul_created: string }>(
      `select a.user_id as ambassador_id, f.created_at as filleul_created
       from users f join users s on s.id = f.referred_by join ambassadors a on a.user_id = s.id
       where f.id = $1 and a.status = 'active'
         and (f.signup_device = '' or f.signup_device <> s.signup_device)
         and (f.signup_ip = '' or f.signup_ip <> s.signup_ip)`,
      [filleulId],
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
        const sponsor = await sponsorOf(tx, filleulId);
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

    /** Demande pour devenir ambassadeur (ou mise à jour du numéro Mobile Money). */
    async apply(userId: number, input: { momoNumber: string; momoName: string; motivation?: string }) {
      const momoNumber = cleanPhone(input.momoNumber);
      const momoName = input.momoName.replace(/\s+/g, ' ').trim().slice(0, 80);
      if (momoNumber.replace(/\D/g, '').length < 8) throw new AmbassadorError('Indiquez un numéro Mobile Money valide.');
      if (momoName.length < 2) throw new AmbassadorError('Indiquez le nom du titulaire du compte Mobile Money.');
      await db.query(
        `insert into ambassadors (user_id, momo_number, momo_name, motivation) values ($1, $2, $3, $4)
         on conflict (user_id) do update set momo_number = excluded.momo_number, momo_name = excluded.momo_name,
           motivation = case when ambassadors.motivation = '' then excluded.motivation else ambassadors.motivation end`,
        [userId, momoNumber, momoName, (input.motivation ?? '').trim().slice(0, 500)],
      );
      return this.summary(userId);
    },

    async summary(userId: number): Promise<AmbassadorSummary> {
      const [a] = await db.query<{ status: AmbassadorStatus; momo_number: string; momo_name: string }>(
        'select status, momo_number, momo_name from ambassadors where user_id = $1',
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
      const payouts = await db.query<{ id: number; amount: number; status: string; requested_at: string; decided_at: string | null }>(
        'select id, amount, status, requested_at, decided_at from ambassador_payouts where ambassador_id = $1 order by id desc limit 20',
        [userId],
      );
      return {
        status: a?.status ?? null,
        momoNumber: a?.momo_number ?? '',
        momoName: a?.momo_name ?? '',
        rules: R,
        stats: { invited: stats.invited, signupsRewarded: stats.signups, buyers: stats.buyers },
        earnings: { pending: get('pending'), available: get('available'), requested: get('requested'), paid: get('paid') },
        payouts: payouts.map((p) => ({ id: p.id, amount: p.amount, status: p.status, requestedAt: new Date(p.requested_at).toISOString(), decidedAt: p.decided_at ? new Date(p.decided_at).toISOString() : null })),
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
        const [{ total }] = await tx.query<{ total: number }>(
          `select coalesce(sum(amount), 0)::int as total from ambassador_earnings
           where ambassador_id = $1 and status = 'pending' and available_at <= $2`,
          [userId, now().toISOString()],
        );
        if (total < R.minPayout) throw new AmbassadorError(`Le retrait est possible à partir de ${R.minPayout} FCFA disponibles.`, 400);
        const [p] = await tx.query<{ id: number }>(
          'insert into ambassador_payouts (ambassador_id, amount, momo_number, momo_name) values ($1, $2, $3, $4) returning id',
          [userId, total, a.momo_number, a.momo_name],
        );
        await tx.query(
          `update ambassador_earnings set status = 'requested', payout_id = $2
           where ambassador_id = $1 and status = 'pending' and available_at <= $3`,
          [userId, p.id, now().toISOString()],
        );
        return { id: p.id, amount: total };
      });
    },

    // ——— Administration ———

    async adminList() {
      const rows = await db.query<{
        user_id: number; identifier: string; name: string; status: string; momo_number: string; momo_name: string; motivation: string;
        created_at: string; invited: number; buyers: number; earned: number; paid: number;
      }>(
        `select a.user_id, u.identifier, u.name, a.status, a.momo_number, a.momo_name, a.motivation, a.created_at,
                (select count(*)::int from users f where f.referred_by = a.user_id) as invited,
                (select count(*)::int from ambassador_earnings e where e.ambassador_id = a.user_id and e.kind = 'first_purchase' and e.status <> 'cancelled') as buyers,
                (select coalesce(sum(amount), 0)::int from ambassador_earnings e where e.ambassador_id = a.user_id and e.status <> 'cancelled') as earned,
                (select coalesce(sum(amount), 0)::int from ambassador_earnings e where e.ambassador_id = a.user_id and e.status = 'paid') as paid
         from ambassadors a join users u on u.id = a.user_id
         order by (a.status = 'pending') desc, a.created_at desc limit 200`,
      );
      const payouts = await db.query<{ id: number; ambassador_id: number; identifier: string; amount: number; momo_number: string; momo_name: string; status: string; requested_at: string }>(
        `select p.id, p.ambassador_id, u.identifier, p.amount, p.momo_number, p.momo_name, p.status, p.requested_at
         from ambassador_payouts p join users u on u.id = p.ambassador_id
         order by (p.status = 'requested') desc, p.id desc limit 100`,
      );
      return {
        ambassadors: rows.map((r) => ({ userId: r.user_id, identifier: r.identifier, name: r.name, status: r.status, momoNumber: r.momo_number, momoName: r.momo_name, motivation: r.motivation, createdAt: new Date(r.created_at).toISOString(), invited: r.invited, buyers: r.buyers, earned: r.earned, paid: r.paid })),
        payouts: payouts.map((p) => ({ id: p.id, userId: p.ambassador_id, identifier: p.identifier, amount: p.amount, momoNumber: p.momo_number, momoName: p.momo_name, status: p.status, requestedAt: new Date(p.requested_at).toISOString() })),
      };
    },

    async setStatus(userId: number, status: AmbassadorStatus) {
      if (!['pending', 'active', 'refused', 'suspended'].includes(status)) throw new AmbassadorError('Statut inconnu.');
      if (!Number.isInteger(userId)) throw new AmbassadorError('Ambassadeur introuvable.', 404);
      const rows = await db.query('update ambassadors set status = $2, decided_at = now() where user_id = $1 returning user_id', [userId, status]);
      if (!rows.length) throw new AmbassadorError('Ambassadeur introuvable.', 404);
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
