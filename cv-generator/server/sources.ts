import type { Db } from './db.ts';

// Provenance des visiteurs : chaque pub a son lien (?src=facebook-video1), et l'espace admin
// compte visites, inscriptions, acheteurs et chiffre d'affaires par provenance.
// Aucune donnée personnelle : un simple compteur par jour et par provenance.

/** « Facebook Vidéo 1 » → « facebook-video1 » ; vide = visite directe. */
export function normalizeSource(raw: unknown): string {
  const s = String(raw ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return s || 'direct';
}

export interface SourceStats {
  source: string;
  visits: number;
  signups: number;
  buyers: number;
  revenue: number;
}

export function createSources(db: Db) {
  return {
    async visit(source: string): Promise<void> {
      await db.query(
        `insert into visits (day, source, count) values (current_date, $1, 1)
         on conflict (day, source) do update set count = visits.count + 1`,
        [normalizeSource(source)],
      );
    },

    /** Les N derniers jours, provenance par provenance (les plus rentables d'abord). */
    async stats(days: number): Promise<SourceStats[]> {
      const rows = await db.query<{ source: string; visits: number; signups: number; buyers: number; revenue: number }>(
        `with since as (select current_date - ($1::int - 1) as d),
         v as (select source, sum(count)::int as visits from visits, since where day >= since.d group by source),
         u as (select coalesce(nullif(signup_source, ''), 'direct') as source, id from users, since where created_at::date >= since.d),
         p as (select u.source, count(distinct pay.user_id)::int as buyers, coalesce(sum(pay.amount), 0)::int as revenue
               from u join payments pay on pay.user_id = u.id and pay.status = 'approved' group by u.source)
         select coalesce(v.source, s.source) as source, coalesce(v.visits, 0) as visits, coalesce(s.signups, 0) as signups,
                coalesce(p.buyers, 0) as buyers, coalesce(p.revenue, 0) as revenue
         from v full join (select source, count(*)::int as signups from u group by source) s on s.source = v.source
         left join p on p.source = coalesce(v.source, s.source)
         order by revenue desc, signups desc, visits desc`,
        [days],
      );
      return rows.map((r) => ({ ...r, visits: Number(r.visits), signups: Number(r.signups), buyers: Number(r.buyers), revenue: Number(r.revenue) }));
    },
  };
}

export type Sources = ReturnType<typeof createSources>;
