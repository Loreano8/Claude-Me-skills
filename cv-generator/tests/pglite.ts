import { PGlite } from '@electric-sql/pglite';
import { migrate, type Db } from '../server/db.ts';

/** Base Postgres en mémoire pour les tests (même SQL qu'en production). */
export async function testDb(): Promise<Db> {
  const pg = new PGlite();
  const wrap = (q: { query: PGlite['query'] }): Db['query'] => async (sql, params = []) => (await q.query(sql, params)).rows as never[];
  const db: Db = {
    query: wrap(pg),
    transaction: (fn) =>
      pg.transaction(async (t) => {
        const tx: Db = { query: wrap(t as never), transaction: (inner) => inner(tx) };
        return fn(tx);
      }),
  };
  await migrate(db);
  return db;
}
