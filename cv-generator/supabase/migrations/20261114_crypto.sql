-- Paiement crypto (USDT BEP20). À appliquer avec le rôle cvstudio_app et search_path = cvstudio.
create table if not exists crypto_orders (
  id serial primary key,
  user_id integer not null references users(id) on delete cascade,
  pack_id text not null,
  credits integer not null,
  price integer not null,
  amount_usd integer not null,
  token text not null default 'USDT',
  status text not null default 'open',
  tx_hash text,
  proof text,
  chain text not null default '',
  reason text not null default '',
  note text not null default '',
  attempts integer not null default 0,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  submitted_at timestamptz,
  decided_at timestamptz,
  payment_id integer references payments(id) on delete set null
);
create unique index if not exists crypto_orders_paid_hash on crypto_orders (lower(tx_hash)) where status = 'paid';
create index if not exists crypto_orders_user on crypto_orders (user_id, id desc);
create table if not exists app_flags (
  key text primary key,
  value text not null
);
