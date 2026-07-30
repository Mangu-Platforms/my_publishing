-- Mirrored verbatim from hosted supabase_migrations.schema_migrations on 2026-07-30
-- (version 20260729221355). Committed by Agent LEDGER for zero drift.
-- Isolated schema for the mihir-stack-mcp token vault.
-- Tokens are AES-256-GCM encrypted by the app before insert; this table never sees plaintext.
create schema if not exists mcp_vault;

create table if not exists mcp_vault.credentials (
  provider text primary key check (provider in ('github','google','vercel','supabase','cloudflare')),
  kind text not null check (kind in ('oauth','token')),
  access_token_enc text not null,
  refresh_token_enc text,
  expires_at timestamptz,
  scopes text,
  updated_at timestamptz not null default now()
);

-- Lock it down: no anon/authenticated access at all. Only service_role reaches this schema.
revoke all on schema mcp_vault from anon, authenticated;
revoke all on all tables in schema mcp_vault from anon, authenticated;

alter table mcp_vault.credentials enable row level security;
-- No policies created: with RLS on and no policies, even accidental grants deny by default.
-- service_role bypasses RLS, which is the only intended access path.

-- Make the schema usable via PostgREST for service_role
grant usage on schema mcp_vault to service_role;
grant all on all tables in schema mcp_vault to service_role;
