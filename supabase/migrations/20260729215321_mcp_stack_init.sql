-- Mirrored verbatim from hosted supabase_migrations.schema_migrations on 2026-07-30
-- (version 20260729215321, applied 2026-07-29 by the mihir-stack-mcp experiment).
-- Committed by Agent LEDGER to bring hosted↔repo drift to zero. Keep-or-drop decision
-- for these schemas is tracked in PROGRAMME_END_TO_END.md §5; both are empty today.
create schema if not exists mcp_stack;

create table if not exists mcp_stack.oauth_clients (
  client_id text primary key,
  client_secret text not null,
  client_name text,
  redirect_uris text[] not null,
  created_at timestamptz not null default now()
);

create table if not exists mcp_stack.oauth_codes (
  code text primary key,
  client_id text not null references mcp_stack.oauth_clients(client_id) on delete cascade,
  redirect_uri text not null,
  code_challenge text not null,
  code_challenge_method text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists oauth_codes_expires_at_idx on mcp_stack.oauth_codes(expires_at);

create table if not exists mcp_stack.oauth_refresh_tokens (
  token text primary key,
  client_id text not null references mcp_stack.oauth_clients(client_id) on delete cascade,
  revoked boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists mcp_stack.vault (
  key text primary key,
  ciphertext text not null,
  iv text not null,
  updated_at timestamptz not null default now()
);
