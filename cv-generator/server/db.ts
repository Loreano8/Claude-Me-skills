import pg from 'pg';

/** Accès minimal à Postgres : une requête paramétrée ($1, $2…) qui renvoie des lignes. */
export interface Db {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  /** Exécute plusieurs requêtes dans une même transaction. */
  transaction<R>(fn: (tx: Db) => Promise<R>): Promise<R>;
}

export const SCHEMA = `
create table if not exists users (
  id serial primary key,
  identifier text not null unique,
  name text not null default '',
  password_hash text not null,
  credits integer not null default 0 check (credits >= 0),
  signup_ip text not null default '',
  created_at timestamptz not null default now()
);

-- Identifiant de l'appareil (téléphone ou navigateur) utilisé à l'inscription : sert à n'offrir le crédit gratuit qu'une fois par appareil.
alter table users add column if not exists signup_device text not null default '';

-- Parrainage : code personnel, parrain éventuel, et récompense déjà versée (une seule fois, au premier achat du filleul).
alter table users add column if not exists referral_code text unique;
alter table users add column if not exists referred_by integer references users(id);
alter table users add column if not exists referral_rewarded boolean not null default false;

-- Historique de chaque mouvement de crédits (offerts, achetés, dépensés, remboursés).
create table if not exists credit_ledger (
  id serial primary key,
  user_id integer not null references users(id) on delete cascade,
  delta integer not null,
  reason text not null,
  ref text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists payments (
  id serial primary key,
  user_id integer not null references users(id) on delete cascade,
  provider text not null,
  provider_ref text not null,
  pack_id text not null,
  credits integer not null,
  amount integer not null,
  currency text not null,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_ref)
);

-- Témoignages (« J'ai décroché le poste ! »), publiés seulement après validation (status = 'approved').
create table if not exists testimonials (
  id serial primary key,
  first_name text not null,
  job_title text not null,
  company text not null,
  city text not null default '',
  message text not null default '',
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  secret_hash text not null,
  device text not null default '',
  created_at timestamptz not null default now()
);

-- « Nous contacter » : une conversation par client (retrouvée par son compte ou par un secret gardé sur l'appareil).
create table if not exists support_threads (
  id serial primary key,
  user_id integer references users(id) on delete set null,
  secret_hash text not null unique,
  name text not null default '',
  contact text not null default '',
  unread_admin integer not null default 0,
  unread_user integer not null default 0,
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);

create table if not exists support_messages (
  id serial primary key,
  thread_id integer not null references support_threads(id) on delete cascade,
  author text not null check (author in ('user', 'admin')),
  body text not null,
  created_at timestamptz not null default now()
);
`;

/**
 * @param ssl true pour une base hébergée hors de Render (ex. Supabase) : connexion chiffrée.
 */
export function createPgDb(connectionString: string, ssl = false, options?: string): Db {
  const pool = new pg.Pool({ connectionString, max: 5, ssl: ssl ? { rejectUnauthorized: false } : undefined, options });
  const wrap = (client: pg.Pool | pg.PoolClient): Db['query'] =>
    async (sql, params = []) => (await client.query(sql, params)).rows;
  return {
    query: wrap(pool),
    async transaction(fn) {
      const client = await pool.connect();
      try {
        await client.query('begin');
        const tx: Db = { query: wrap(client), transaction: (inner) => inner(tx) };
        const result = await fn(tx);
        await client.query('commit');
        return result;
      } catch (error) {
        await client.query('rollback');
        throw error;
      } finally {
        client.release();
      }
    },
  };
}

export async function migrate(db: Db): Promise<void> {
  for (const statement of SCHEMA.split(';').map((s) => s.trim()).filter(Boolean)) {
    await db.query(statement);
  }
}
