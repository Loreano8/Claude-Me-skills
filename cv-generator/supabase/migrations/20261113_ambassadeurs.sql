-- Programme Ambassadeur et codes de parrainage personnalisés (à appliquer AVANT de déployer le serveur).
-- Base de production : schéma cvstudio, rôle applicatif cvstudio_app. Sans risque si relancé (if not exists).
set search_path = cvstudio;

create table if not exists referral_aliases (
  code text primary key,
  user_id integer not null references users(id) on delete cascade,
  created_at timestamptz not null default now()
);
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

grant select, insert, update, delete on referral_aliases, ambassadors, ambassador_number_changes, ambassador_payouts, ambassador_earnings to cvstudio_app;
grant usage, select on sequence ambassador_number_changes_id_seq, ambassador_payouts_id_seq, ambassador_earnings_id_seq to cvstudio_app;
