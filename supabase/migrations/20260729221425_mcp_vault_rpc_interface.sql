-- Mirrored verbatim from hosted supabase_migrations.schema_migrations on 2026-07-30
-- (version 20260729221425). Committed by Agent LEDGER for zero drift.
-- RPC interface to mcp_vault so PostgREST schema exposure isn't needed.
-- All functions are security definer, revoked from everyone except service_role.

create or replace function public.mcp_vault_upsert(
  p_provider text,
  p_kind text,
  p_access_token_enc text,
  p_refresh_token_enc text default null,
  p_expires_at timestamptz default null,
  p_scopes text default null
) returns void
language sql
security definer
set search_path = mcp_vault, pg_temp
as $$
  insert into mcp_vault.credentials (provider, kind, access_token_enc, refresh_token_enc, expires_at, scopes, updated_at)
  values (p_provider, p_kind, p_access_token_enc, p_refresh_token_enc, p_expires_at, p_scopes, now())
  on conflict (provider) do update set
    kind = excluded.kind,
    access_token_enc = excluded.access_token_enc,
    refresh_token_enc = excluded.refresh_token_enc,
    expires_at = excluded.expires_at,
    scopes = excluded.scopes,
    updated_at = now();
$$;

create or replace function public.mcp_vault_get(p_provider text)
returns table (provider text, kind text, access_token_enc text, refresh_token_enc text, expires_at timestamptz, scopes text)
language sql
security definer
set search_path = mcp_vault, pg_temp
as $$
  select provider, kind, access_token_enc, refresh_token_enc, expires_at, scopes
  from mcp_vault.credentials where provider = p_provider;
$$;

create or replace function public.mcp_vault_list()
returns table (provider text, kind text, updated_at timestamptz)
language sql
security definer
set search_path = mcp_vault, pg_temp
as $$
  select provider, kind, updated_at from mcp_vault.credentials;
$$;

revoke all on function public.mcp_vault_upsert(text,text,text,text,timestamptz,text) from public, anon, authenticated;
revoke all on function public.mcp_vault_get(text) from public, anon, authenticated;
revoke all on function public.mcp_vault_list() from public, anon, authenticated;

grant execute on function public.mcp_vault_upsert(text,text,text,text,timestamptz,text) to service_role;
grant execute on function public.mcp_vault_get(text) to service_role;
grant execute on function public.mcp_vault_list() to service_role;
