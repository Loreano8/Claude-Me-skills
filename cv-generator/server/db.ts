import pg from 'pg';
import { AMBASSADOR_SCHEMA } from './ambassadors.ts';

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

-- Changement de mot de passe : les sessions ouvertes avant cette date sont refusées.
alter table users add column if not exists password_changed_at timestamptz;

-- Anciens codes de parrainage (après personnalisation) : les liens déjà partagés continuent de marcher.
create table if not exists referral_aliases (
  code text primary key,
  user_id integer not null references users(id) on delete cascade,
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

-- Phrase secrète (empreinte seulement) : sert à prouver son identité quand on a oublié son mot de passe.
alter table users add column if not exists secret_phrase_hash text;
-- Question secrète choisie par la personne (la réponse est l'empreinte ci-dessus), vide pour une simple phrase secrète.
alter table users add column if not exists secret_question text;

-- Provenance des visiteurs (lien de pub ?src=…) : retenue à l'inscription, et visites comptées par jour.
alter table users add column if not exists signup_source text not null default '';
create table if not exists visits (
  day date not null,
  source text not null,
  count integer not null default 0,
  primary key (day, source)
);

-- CV partagés par lien ou QR code : PDF publié volontairement, lien aléatoire, 90 jours au plus.
create table if not exists shared_cvs (
  token text primary key,
  user_id integer not null references users(id) on delete cascade,
  cv_key text not null,
  name text not null default '',
  pdf bytea not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create unique index if not exists shared_cvs_owner on shared_cvs (user_id, cv_key);

-- Tentatives de connexion et de codes, par adresse (empreinte, jamais l'adresse elle-même) : la limite survit aux redémarrages.
create table if not exists rate_hits (
  bucket text not null,
  key text not null,
  at timestamptz not null default now()
);
create index if not exists rate_hits_lookup on rate_hits (bucket, key, at);

-- Veille emploi : critères cochés par la personne (une veille par compte), envois, et recherches du jour partagées
-- entre personnes aux critères identiques (moins de recherches payantes).
create table if not exists job_watches (
  user_id integer primary key references users(id) on delete cascade,
  criteria jsonb not null,
  profile text not null default '',
  frequency text not null check (frequency in ('daily', 'weekly')),
  active boolean not null default false,
  paid_until timestamptz,
  next_run_at timestamptz,
  running_since timestamptz,
  free_run_used boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists job_watches_due on job_watches (next_run_at) where active;
create table if not exists job_watch_runs (
  id serial primary key,
  user_id integer not null references users(id) on delete cascade,
  offers jsonb not null,
  note text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists job_watch_runs_user on job_watch_runs (user_id, id desc);
create table if not exists job_search_cache (
  key text primary key,
  offers jsonb not null,
  note text not null default '',
  created_at timestamptz not null default now()
);

-- Offre de retour (4 crédits pour le prix de 3) : ouverte pour 72 heures quand la personne revient après une absence, une seule fois.
alter table users add column if not exists return_offer_until timestamptz;

-- Coffre-fort : double de la clé qui chiffre les documents gardés sur le téléphone (code oublié → réinitialisation).
create table if not exists vault_keys (
  user_id integer primary key references users(id) on delete cascade,
  key text not null,
  updated_at timestamptz not null default now()
);

-- Codes à 6 chiffres envoyés par e-mail (code du coffre ou mot de passe oubliés). Seule l'empreinte est gardée.
create table if not exists email_codes (
  id serial primary key,
  user_id integer not null references users(id) on delete cascade,
  purpose text not null,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts integer not null default 0,
  used boolean not null default false
);

-- Demandes de récupération de compte (formulaire « mot de passe oublié »), vérifiées puis validées par l'administrateur.
create table if not exists recovery_requests (
  id serial primary key,
  user_id integer references users(id) on delete cascade,
  identifier text not null,
  thread_id integer references support_threads(id) on delete set null,
  given jsonb not null,
  checks jsonb not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'refused')),
  created_at timestamptz not null default now(),
  decided_at timestamptz
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
  for (const statement of (SCHEMA + ';' + AMBASSADOR_SCHEMA).split(';').map((s) => s.trim()).filter(Boolean)) {
    await db.query(statement);
  }
}
