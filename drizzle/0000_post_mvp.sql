-- MatchCV pós-MVP: Better Auth, chaves cifradas e candidaturas.
-- Aplicar com `npm run db:push` ou este SQL num Postgres (Supabase ou Neon).

create table if not exists users (
  id text primary key,
  name text not null,
  email text not null unique,
  email_verified boolean not null default false,
  image text,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table if not exists sessions (
  id text primary key,
  expires_at timestamptz not null,
  token text not null unique,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  ip_address text,
  user_agent text,
  user_id text not null references users (id) on delete cascade
);
create index if not exists sessions_user_id_idx on sessions (user_id);

create table if not exists accounts (
  id text primary key,
  account_id text not null,
  provider_id text not null,
  user_id text not null references users (id) on delete cascade,
  access_token text,
  refresh_token text,
  id_token text,
  access_token_expires_at timestamptz,
  refresh_token_expires_at timestamptz,
  scope text,
  password text,
  created_at timestamptz not null,
  updated_at timestamptz not null
);
create index if not exists accounts_user_id_idx on accounts (user_id);
create unique index if not exists accounts_provider_account_idx on accounts (provider_id, account_id);

create table if not exists verifications (
  id text primary key,
  identifier text not null,
  value text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null,
  updated_at timestamptz not null
);
create index if not exists verifications_identifier_idx on verifications (identifier);

create table if not exists saved_api_keys (
  id text primary key,
  user_id text not null references users (id) on delete cascade,
  provider text not null,
  last4 text not null,
  status text not null,
  kek_version integer not null,
  iv text not null,
  auth_tag text not null,
  ciphertext text not null,
  wrapped_dek_iv text not null,
  wrapped_dek_auth_tag text not null,
  wrapped_dek_ciphertext text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null
);
create index if not exists saved_api_keys_user_id_idx on saved_api_keys (user_id);
create unique index if not exists saved_api_keys_user_provider_idx on saved_api_keys (user_id, provider);

create table if not exists job_applications (
  id text primary key,
  user_id text not null references users (id) on delete cascade,
  company text not null,
  role text not null,
  applied_at timestamptz not null,
  status text not null,
  notes text not null default '',
  materials jsonb not null,
  created_at timestamptz not null,
  updated_at timestamptz not null
);
create index if not exists job_applications_user_id_idx on job_applications (user_id);
