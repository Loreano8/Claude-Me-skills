import type { Db } from './db.ts';

// Synchronisation : une copie du travail (CV, lettres, offre en cours, suivi des candidatures) rattachée au compte,
// pour le retrouver sur le téléphone et sur le site. Activée par défaut, annoncée clairement, et la personne peut
// l'arrêter à tout moment : la copie du serveur est alors effacée. Les papiers du coffre-fort n'y passent jamais.

export const SYNC_SCHEMA = `
create table if not exists user_data (
  user_id bigint primary key references users(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
)
`;

/** Taille maximale de la copie (photos de CV comprises). */
export const MAX_SYNC_BYTES = 8 * 1024 * 1024;

export class SyncError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 413,
  ) {
    super(message);
  }
}

export interface SyncSnapshot {
  cvs: unknown[];
  letters: unknown[];
  applications: unknown[];
  job: { text: string };
  /** Éléments supprimés (id → date), pour qu'ils ne reviennent pas depuis un autre appareil. */
  deleted: Record<string, number>;
}

function valid(data: unknown): data is SyncSnapshot {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  return (
    Array.isArray(d.cvs) &&
    Array.isArray(d.letters) &&
    Array.isArray(d.applications) &&
    !!d.job &&
    typeof (d.job as { text?: unknown }).text === 'string' &&
    !!d.deleted &&
    typeof d.deleted === 'object' &&
    !Array.isArray(d.deleted)
  );
}

export function createSync(db: Db) {
  return {
    async get(userId: number): Promise<{ data: SyncSnapshot; updatedAt: string } | null> {
      const [row] = await db.query<{ data: SyncSnapshot; updated_at: string }>('select data, updated_at from user_data where user_id = $1', [userId]);
      return row ? { data: row.data, updatedAt: new Date(row.updated_at).toISOString() } : null;
    },

    async save(userId: number, data: unknown): Promise<string> {
      if (!valid(data)) throw new SyncError('Données invalides.', 400);
      const json = JSON.stringify(data);
      if (json.length > MAX_SYNC_BYTES) throw new SyncError('Vos documents sont trop lourds pour être synchronisés (photos trop grandes).', 413);
      const [row] = await db.query<{ updated_at: string }>(
        `insert into user_data (user_id, data) values ($1, $2::jsonb)
         on conflict (user_id) do update set data = excluded.data, updated_at = now() returning updated_at`,
        [userId, json],
      );
      return new Date(row.updated_at).toISOString();
    },

    /** La personne arrête la synchronisation : la copie du serveur est effacée. */
    async erase(userId: number): Promise<void> {
      await db.query('delete from user_data where user_id = $1', [userId]);
    },
  };
}

export type Sync = ReturnType<typeof createSync>;
