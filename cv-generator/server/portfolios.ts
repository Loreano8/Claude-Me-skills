import { randomBytes } from 'node:crypto';
import type { Db } from './db.ts';
import { AccountError, type Accounts } from './accounts.ts';
import { FREE_PORTFOLIO_THEME, PORTFOLIO_PRO_COST, slugify, type PortfolioSaveRequest, type PortfolioState, type PublicPortfolio } from '../shared/portfolio.ts';

// Portfolio en ligne : une page publique par personne (cvcasa.com/p/#lien), remplie à partir de son CV.
// Le design « Classique » est offert ; les autres designs et la page sans mention CVCasa = Portfolio Pro (2 crédits, une fois).

export const PORTFOLIO_SCHEMA = `
create table if not exists portfolios (
  user_id bigint primary key references users(id) on delete cascade,
  slug text not null unique,
  theme text not null default 'classique',
  data jsonb not null,
  pro boolean not null default false,
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
)
`;

/** Adresses réservées : elles ressembleraient à une page officielle. */
const RESERVED = new Set(['admin', 'api', 'app', 'cvcasa', 'exemple', 'exemple-designer', 'example', 'support', 'aide', 'help', 'login', 'compte', 'portfolio']);

export class PortfolioError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 402 | 404 | 409,
    readonly code = '',
  ) {
    super(message);
  }
}

interface Row {
  slug: string;
  theme: PortfolioState['theme'];
  data: PortfolioState['data'];
  pro: boolean;
  updated_at: string;
}

const toState = (r: Row): PortfolioState => ({ slug: r.slug, theme: r.theme, pro: r.pro, data: r.data, updatedAt: new Date(r.updated_at).toISOString() });

export function createPortfolios(db: Db, accounts: Accounts) {
  async function freeSlug(tx: Db, base: string, userId: number): Promise<string> {
    const root = (slugify(base) || 'portfolio').slice(0, 34).replace(/-+$/, '');
    const start = root.length >= 3 && !RESERVED.has(root) ? root : `portfolio-${root}`.replace(/-+$/, '');
    for (let i = 0; i < 8; i++) {
      const candidate = i === 0 ? start : `${start}-${i < 4 ? i + 1 : randomBytes(2).toString('hex')}`;
      const [taken] = await tx.query<{ user_id: number }>('select user_id from portfolios where slug = $1', [candidate]);
      if (!taken || Number(taken.user_id) === userId) return candidate;
    }
    return `${start}-${randomBytes(3).toString('hex')}`;
  }

  return {
    async get(userId: number): Promise<(PortfolioState & { published: boolean }) | null> {
      const [row] = await db.query<Row & { published: boolean }>('select slug, theme, data, pro, published, updated_at from portfolios where user_id = $1', [userId]);
      return row ? { ...toState(row), published: row.published } : null;
    },

    /**
     * Publie ou met à jour la page. Un design Pro demande le Portfolio Pro : sans lui, erreur 402 (code « pro »),
     * sauf si `unlock` est demandé, auquel cas les 2 crédits sont pris dans la même opération.
     */
    async save(userId: number, req: PortfolioSaveRequest, unlock = false): Promise<PortfolioState> {
      return db.transaction(async (tx) => {
        const [current] = await tx.query<Row>('select slug, theme, data, pro, updated_at from portfolios where user_id = $1 for update', [userId]);
        let pro = current?.pro ?? false;
        if (req.theme !== FREE_PORTFOLIO_THEME && !pro) {
          if (!unlock) throw new PortfolioError('Ce design fait partie du Portfolio Pro.', 402, 'pro');
          try {
            await accounts.spendIn(tx, userId, PORTFOLIO_PRO_COST, 'portfolio-pro');
          } catch (error) {
            if (error instanceof AccountError) throw new PortfolioError('Crédits insuffisants.', 402, 'credits');
            throw error;
          }
          pro = true;
        }

        let slug = current?.slug ?? '';
        if (req.slug && req.slug !== slug) {
          if (RESERVED.has(req.slug)) throw new PortfolioError('Cette adresse est déjà prise. Essayez-en une autre.', 409, 'slug');
          const [taken] = await tx.query<{ user_id: number }>('select user_id from portfolios where slug = $1', [req.slug]);
          if (taken && Number(taken.user_id) !== userId) throw new PortfolioError('Cette adresse est déjà prise. Essayez-en une autre.', 409, 'slug');
          slug = req.slug;
        }
        if (!slug) slug = await freeSlug(tx, req.data.name, userId);

        const [row] = await tx.query<Row>(
          `insert into portfolios (user_id, slug, theme, data, pro) values ($1, $2, $3, $4::jsonb, $5)
           on conflict (user_id) do update set slug = excluded.slug, theme = excluded.theme, data = excluded.data, pro = excluded.pro, published = true, updated_at = now()
           returning slug, theme, data, pro, updated_at`,
          [userId, slug, req.theme, JSON.stringify(req.data), pro],
        );
        return toState(row);
      });
    },

    /** Retire la page : le lien ne marche plus. Le contenu et le Portfolio Pro restent acquis pour une prochaine publication. */
    async remove(userId: number): Promise<void> {
      await db.query('update portfolios set published = false where user_id = $1', [userId]);
    },

    async open(slug: string): Promise<PublicPortfolio | null> {
      if (!/^[a-z0-9-]{3,40}$/.test(slug)) return null;
      const [row] = await db.query<Row>('select slug, theme, data, pro, updated_at from portfolios where slug = $1 and published', [slug]);
      if (!row) return null;
      // Un design Pro sans Portfolio Pro ne peut pas exister ; par sécurité, on retombe sur le design offert.
      return { theme: row.pro ? row.theme : FREE_PORTFOLIO_THEME, pro: row.pro, data: row.data };
    },
  };
}

export type Portfolios = ReturnType<typeof createPortfolios>;
