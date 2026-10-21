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
`;

export function createPgDb(connectionString: string): Db {
  const pool = new pg.Pool({ connectionString, max: 5 });
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
