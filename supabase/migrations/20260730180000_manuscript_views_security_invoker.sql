-- A6 HARDEN (docs/launch/PROGRAMME_END_TO_END.md §1) — POST-LAUNCH ONLY.
-- DO NOT MERGE OR APPLY DURING FREEZE #209.
--
-- Clears the two ERROR-level Supabase security advisor findings (2026-07-30
-- snapshot, evidence doc §7): views author_manuscript_status_history and
-- author_manuscript_feedback run as SECURITY DEFINER (postgres), which
-- bypasses the querying user's RLS. Switching them to security_invoker makes
-- the caller's RLS policies (hardened in the 20260724 migration set) apply.
--
-- BEFORE APPLYING TO HOSTED:
-- 1. Test on a Supabase branch DB: confirm the author portal's manuscript
--    status-history and feedback panels still render for a normal author
--    account. If they relied on definer privileges to read across tables the
--    author cannot see directly, the underlying RLS/grants must be adjusted
--    first — that is precisely what this draft exists to surface in testing.
-- 2. Re-version this file to the actual apply date at merge time (LEDGER rule:
--    repo version must match supabase_migrations.schema_migrations exactly).
-- 3. Re-run the security advisor: both ERRORs should clear.

alter view public.author_manuscript_status_history set (security_invoker = true);
alter view public.author_manuscript_feedback set (security_invoker = true);
