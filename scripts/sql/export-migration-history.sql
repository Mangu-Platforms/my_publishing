-- =============================================================================
-- Task 3.6 — hosted migration history + schema drift evidence export
-- =============================================================================
--
-- WHY THIS FILE EXISTS
-- The repository can only tell us what *should* be applied. Nobody with a
-- credentialled session has exported the hosted state since the production
-- Supabase project was paused/deleted and later restored, so every statement
-- about the hosted schema is currently UNVERIFIED. This file is the exact,
-- read-only query set an operator with SQL access runs so that the hosted side
-- becomes evidence instead of assumption.
--
-- HOW TO RUN
--   Option A (Supabase SQL editor): paste section by section, run, export CSV.
--   Option B (psql):
--       psql "$CONNECTION_STRING" -v ON_ERROR_STOP=1 \
--            -f scripts/sql/export-migration-history.sql > hosted-export.txt
--   Option C (recommended — machine-readable): run ONLY section 9. It emits a
--       single JSON column that `scripts/migration-drift-report.ts` consumes
--       directly, with no hand-editing.
--
-- SAFETY
--   * Read-only. SELECT and catalog reads only. No DDL, no DML, no GRANT/REVOKE.
--   * Section 0 pins the session to a read-only transaction so that even a
--     mis-paste cannot write. Leave it in.
--   * No credentials, project refs or connection strings appear in this file.
--     Supply them from your own environment at run time and never paste them
--     back into the repo, an issue, or a PR.
--   * Output is schema metadata plus aggregate counts. It contains no user
--     rows, no emails and no keys. Do not add row-level SELECTs to this file.
--
-- WHAT TO PASTE BACK
--   Save the result as `hosted-export.json` (section 9) or `hosted-export.csv`
--   (section 1 only) somewhere OUTSIDE the repo, then run:
--       tsx scripts/migration-drift-report.ts --export ./hosted-export.json
--   Attach the report output — not raw credentials — to issue #192.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 0. Read-only guard. Run this first and keep the transaction open.
-- -----------------------------------------------------------------------------
BEGIN;
SET TRANSACTION READ ONLY;

-- Expected: a single row confirming you are where you think you are.
-- Expected output shape:
--   current_database | current_user | server_version | now
--   -----------------+--------------+----------------+---------------------------
--   postgres         | postgres     | 15.x           | 2026-07-28 00:00:00+00
SELECT
  current_database()        AS current_database,
  current_user              AS current_user,
  version()                 AS server_version,
  now()                     AS exported_at;


-- -----------------------------------------------------------------------------
-- 1. Migration history (THE headline query)
-- -----------------------------------------------------------------------------
-- WHY the to_regclass guard: if the restore produced a NEW project, the
-- `supabase_migrations` schema may not exist at all. An unguarded SELECT would
-- abort the whole script with "relation does not exist" and the operator would
-- report a failure instead of the finding. An empty result here is a VALID and
-- important outcome — see the decision tree in
-- docs/operations/MIGRATION_DRIFT_RECONCILIATION.md.
--
-- Expected output shape (0..N rows):
--   version        | name
--   ---------------+--------------------------------
--   20260116000000 | initial_schema
--   20260117000000 | analytics_events
SELECT version, name
FROM supabase_migrations.schema_migrations
ORDER BY version;

-- 1b. Distinguish "history table missing" from "history table empty".
-- Expected output shape:
--   history_relation            | history_row_count
--   ----------------------------+-------------------
--   supabase_migrations.schema_migrations | 40
--   (NULL)                                | (NULL)   <- schema absent entirely
SELECT
  to_regclass('supabase_migrations.schema_migrations')::text AS history_relation,
  (
    SELECT count(*)
    FROM supabase_migrations.schema_migrations
  ) AS history_row_count
WHERE to_regclass('supabase_migrations.schema_migrations') IS NOT NULL

UNION ALL

SELECT NULL::text, NULL::bigint
WHERE to_regclass('supabase_migrations.schema_migrations') IS NULL;


-- -----------------------------------------------------------------------------
-- 2. Actual columns on the tables under investigation
-- -----------------------------------------------------------------------------
-- WHY: the confirmed repository-side drift list is entirely columns that
-- application code reads but no migration creates. This query is what turns
-- "code expects it" into "hosted has it / hosted does not have it".
--
-- Expected output shape:
--   table_name | column_name | data_type | is_nullable | column_default
--   -----------+-------------+-----------+-------------+----------------
--   books      | subtitle    | text      | YES         | (NULL)
SELECT
  c.table_name,
  c.column_name,
  c.data_type,
  c.is_nullable,
  c.column_default
FROM information_schema.columns c
WHERE c.table_schema = 'public'
  AND c.table_name IN (
    'books',
    'book_content',
    'book_views',
    'book_view_cache',
    'audit_logs',
    'authors',
    'profiles',
    'orders',
    'order_items',
    'manuscripts'
  )
ORDER BY c.table_name, c.ordinal_position;


-- -----------------------------------------------------------------------------
-- 3. Which of the disputed tables actually exist
-- -----------------------------------------------------------------------------
-- Expected output shape:
--   expected_table   | exists_hosted | table_kind
--   -----------------+---------------+------------
--   book_view_cache  | f             | (NULL)
--   book_views       | t             | BASE TABLE
SELECT
  x.expected_table,
  (to_regclass('public.' || x.expected_table) IS NOT NULL) AS exists_hosted,
  t.table_type AS table_kind
FROM (
  VALUES
    ('books'),
    ('book_content'),
    ('book_views'),
    ('book_view_cache'),
    ('audit_logs'),
    ('authors'),
    ('profiles'),
    ('manuscripts'),
    ('manuscript_status_history'),
    ('manuscript_reviews')
) AS x(expected_table)
LEFT JOIN information_schema.tables t
  ON t.table_schema = 'public'
 AND t.table_name = x.expected_table
ORDER BY x.expected_table;


-- -----------------------------------------------------------------------------
-- 4. Routines / RPCs (including SECURITY DEFINER posture)
-- -----------------------------------------------------------------------------
-- WHY security_type is included: 20260708074819_harden_definer_views_and_rpcs
-- exists precisely to control this. If a hand-applied RPC came back from the
-- restore as SECURITY DEFINER, that is a security finding, not just drift.
--
-- Expected output shape:
--   routine_schema | routine_name         | routine_type | security_type | arg_signature
--   ---------------+----------------------+--------------+---------------+---------------
--   public         | books_search         | FUNCTION     | INVOKER       | text, integer
--   public         | increment_view_count | FUNCTION     | DEFINER       | uuid
SELECT
  n.nspname                                   AS routine_schema,
  p.proname                                   AS routine_name,
  CASE p.prokind WHEN 'f' THEN 'FUNCTION'
                 WHEN 'p' THEN 'PROCEDURE'
                 WHEN 'a' THEN 'AGGREGATE'
                 ELSE p.prokind::text END      AS routine_type,
  CASE WHEN p.prosecdef THEN 'DEFINER' ELSE 'INVOKER' END AS security_type,
  pg_get_function_identity_arguments(p.oid)   AS arg_signature
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
ORDER BY p.proname, arg_signature;


-- -----------------------------------------------------------------------------
-- 5. RLS: which tables have it enabled
-- -----------------------------------------------------------------------------
-- Expected output shape:
--   table_name | rls_enabled | rls_forced
--   -----------+-------------+-----------
--   audit_logs | t           | f
SELECT
  c.relname       AS table_name,
  c.relrowsecurity  AS rls_enabled,
  c.relforcerowsecurity AS rls_forced
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
ORDER BY c.relname;


-- -----------------------------------------------------------------------------
-- 6. RLS policies, per command
-- -----------------------------------------------------------------------------
-- WHY: the repository-verified finding is that `audit_logs` has a SELECT policy
-- for admins but NO INSERT policy, so with RLS enabled the application cannot
-- write audit rows. Confirm hosted-side before proposing a corrective migration.
--
-- Expected output shape:
--   schemaname | tablename  | policyname              | cmd    | permissive | roles    | qual | with_check
--   -----------+------------+-------------------------+--------+------------+----------+------+-----------
--   public     | audit_logs | Admins can view audit.. | SELECT | PERMISSIVE | {public} | ...  | (NULL)
SELECT
  schemaname,
  tablename,
  policyname,
  cmd,
  permissive,
  roles::text AS roles,
  qual,
  with_check
FROM pg_policies
WHERE schemaname IN ('public', 'storage')
ORDER BY schemaname, tablename, cmd, policyname;

-- 6b. Explicit answer for the audit_logs INSERT question.
-- Expected output shape:
--   audit_logs_rls_enabled | insert_policy_count
--   -----------------------+---------------------
--   t                      | 0
SELECT
  (SELECT c.relrowsecurity
     FROM pg_class c
     JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'audit_logs') AS audit_logs_rls_enabled,
  (SELECT count(*)
     FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'audit_logs'
      AND cmd = 'INSERT') AS insert_policy_count;


-- -----------------------------------------------------------------------------
-- 7. Storage buckets and their public/private visibility
-- -----------------------------------------------------------------------------
-- WHY: `published-epubs` holding paid content must NOT be public. A restore can
-- silently recreate buckets with default visibility.
--
-- Expected output shape:
--   id              | name            | public | file_size_limit | allowed_mime_types
--   ----------------+-----------------+--------+-----------------+--------------------
--   book-covers     | book-covers     | t      | 5242880         | {image/png,...}
--   manuscripts     | manuscripts     | f      | 52428800        | {application/pdf}
--   published-epubs | published-epubs | f      | 52428800        | {application/epub+zip}
SELECT
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types::text AS allowed_mime_types,
  created_at
FROM storage.buckets
ORDER BY id;


-- -----------------------------------------------------------------------------
-- 8. Aggregate counts only (NO row data — nothing user-identifying)
-- -----------------------------------------------------------------------------
-- WHY: the backfill decision needs to know whether Supabase still holds live
-- book rows that the production read path (DATABASE_PROVIDER=mongodb) can no
-- longer see. Counts are enough to size the problem; the field-by-field
-- comparison is done by scripts/backfill-books-dry-run.ts.
--
-- Expected output shape:
--   metric                    | value
--   --------------------------+-------
--   books_total               | 42
--   books_published_public    | 12
SELECT 'books_total' AS metric, count(*)::bigint AS value FROM public.books
UNION ALL
SELECT 'books_published_public', count(*)::bigint
  FROM public.books WHERE status = 'published' AND visibility = 'public'
UNION ALL
SELECT 'books_deleted_at_not_null', count(*)::bigint
  FROM public.books
  WHERE to_regclass('public.books') IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'books' AND column_name = 'deleted_at'
    )
    AND deleted_at IS NOT NULL
UNION ALL
SELECT 'authors_total', count(*)::bigint FROM public.authors
UNION ALL
SELECT 'orders_total', count(*)::bigint FROM public.orders
ORDER BY metric;
-- NOTE: the books_deleted_at_not_null branch only parses if books.deleted_at
-- exists. If the column is absent the statement raises 42703 — that failure IS
-- the finding (drift confirmed: code reads deleted_at, hosted has no column).
-- Record the error text and move on; do not "fix" it here.


-- -----------------------------------------------------------------------------
-- 9. ONE-SHOT JSON BUNDLE — preferred output for the drift report tool
-- -----------------------------------------------------------------------------
-- WHY: pasting eight result grids back by hand is where evidence gets mangled.
-- This produces a single `hosted_export` JSON value in the exact envelope that
-- scripts/migration-drift-report.ts parses. Copy the one cell, save it as
-- hosted-export.json OUTSIDE the repo, and hand that to the tool.
--
-- Expected output shape (one row, one column, pretty-printed JSON):
--   {
--     "exported_at": "2026-07-28T00:00:00+00:00",
--     "source": "hosted",
--     "history_relation_present": true,
--     "schema_migrations": [ { "version": "20260116000000", "name": "initial_schema" } ],
--     "columns":  [ { "table_name": "books", "column_name": "subtitle", "data_type": "text" } ],
--     "tables":   [ { "table_name": "book_views", "table_kind": "BASE TABLE" } ],
--     "routines": [ { "routine_name": "books_search", "security_type": "INVOKER" } ],
--     "rls":      [ { "table_name": "audit_logs", "rls_enabled": true } ],
--     "policies": [ { "tablename": "audit_logs", "policyname": "...", "cmd": "SELECT" } ],
--     "buckets":  [ { "id": "published-epubs", "public": false } ],
--     "counts":   [ { "metric": "books_total", "value": 42 } ]
--   }
SELECT jsonb_pretty(
  jsonb_build_object(
    'exported_at', now(),
    'source', 'hosted',
    'history_relation_present',
      to_regclass('supabase_migrations.schema_migrations') IS NOT NULL,
    'schema_migrations', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('version', m.version, 'name', m.name)
                       ORDER BY m.version)
      FROM supabase_migrations.schema_migrations m
    ), '[]'::jsonb),
    'columns', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'table_name', c.table_name,
               'column_name', c.column_name,
               'data_type', c.data_type,
               'is_nullable', c.is_nullable)
             ORDER BY c.table_name, c.ordinal_position)
      FROM information_schema.columns c
      WHERE c.table_schema = 'public'
    ), '[]'::jsonb),
    'tables', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'table_name', t.table_name,
               'table_kind', t.table_type)
             ORDER BY t.table_name)
      FROM information_schema.tables t
      WHERE t.table_schema = 'public'
    ), '[]'::jsonb),
    'routines', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'routine_name', p.proname,
               'arg_signature', pg_get_function_identity_arguments(p.oid),
               'security_type', CASE WHEN p.prosecdef THEN 'DEFINER' ELSE 'INVOKER' END)
             ORDER BY p.proname)
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
    ), '[]'::jsonb),
    'rls', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'table_name', c.relname,
               'rls_enabled', c.relrowsecurity)
             ORDER BY c.relname)
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r'
    ), '[]'::jsonb),
    'policies', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'schemaname', pol.schemaname,
               'tablename', pol.tablename,
               'policyname', pol.policyname,
               'cmd', pol.cmd)
             ORDER BY pol.schemaname, pol.tablename, pol.policyname)
      FROM pg_policies pol
      WHERE pol.schemaname IN ('public', 'storage')
    ), '[]'::jsonb),
    'buckets', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', b.id, 'public', b.public)
                       ORDER BY b.id)
      FROM storage.buckets b
    ), '[]'::jsonb),
    'counts', jsonb_build_array(
      jsonb_build_object('metric', 'books_total',
                         'value', (SELECT count(*) FROM public.books)),
      jsonb_build_object('metric', 'books_published_public',
                         'value', (SELECT count(*) FROM public.books
                                    WHERE status = 'published' AND visibility = 'public')),
      jsonb_build_object('metric', 'authors_total',
                         'value', (SELECT count(*) FROM public.authors))
    )
  )
) AS hosted_export;


-- -----------------------------------------------------------------------------
-- 10. Close the read-only transaction.
-- -----------------------------------------------------------------------------
COMMIT;

-- =============================================================================
-- IF ANY STATEMENT FAILED
-- Record the SQLSTATE and message verbatim and report it. A failure here is
-- usually evidence, not a bug in this file:
--   3F000 / 42P01 on section 1  -> supabase_migrations schema absent
--                                  => likely a NEW project after the restore
--   42703 on section 8          -> the referenced column does not exist
--                                  => drift confirmed for that column
--   42501                       -> your role cannot read the catalog; get a
--                                  role that can. Do NOT grant yourself rights.
-- Never resolve a failure by writing DDL. No migration is applied until the
-- drift is understood — see docs/operations/MIGRATION_DRIFT_RECONCILIATION.md.
-- =============================================================================
