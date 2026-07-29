# Hosted Migration Drift Reconciliation

**Task 3.6 — issue #192. Analysis only. No migration is written or applied by this document.**

## Why this exists

The repository contains 40 migration files. What the hosted production database
actually contains is **unknown**. The production Supabase project was paused or
deleted and later restored, and nobody has exported the hosted migration history
since. Meanwhile, application code reads columns, tables and RPCs that no
migration in this repository creates.

Writing a migration into that situation is how you drop a live column. So the
order is fixed: **export the hosted state, classify the difference, get a
decision, and only then write a migration.**

## Evidence status — read this before quoting anything below

| Statement | Status |
| --- | --- |
| 40 migration files exist in `supabase/migrations/` | **Repository-verified** |
| Application code references `books.subtitle`, `books.epub_url`, `books.deleted_at`, `books.author_name`, `books.metadata`, `books.tags`, `books.categories`, `books.view_count`, `books.download_count`, `books.manuscript_url`, `books.language`, `books.seo_title`, `books.seo_description` and no migration creates them | **Repository-verified** |
| Application code references tables `book_view_cache`, `book_views` and no migration creates them | **Repository-verified** |
| Application code calls RPCs `books_search`, `increment_view_count` and no migration creates them | **Repository-verified** |
| `audit_logs` columns come from `20260118000000_critical_fixes.sql`; RLS is enabled with a SELECT policy and **no INSERT policy** | **Repository-verified** |
| Production reads the catalog from MongoDB (`DATABASE_PROVIDER=mongodb`) and uses Supabase for auth/identity/orders (`AUTH_PROVIDER=supabase`) | **Repository-verified** (env configuration) |
| Which migrations are recorded in `supabase_migrations.schema_migrations` on the host | **HOSTED — UNVERIFIED** |
| Whether the restore produced a new project with empty history | **HOSTED — UNVERIFIED** |
| Whether the hosted `books` table has any of the drifted columns | **HOSTED — UNVERIFIED** |
| Whether the hosted storage buckets are public or private | **HOSTED — UNVERIFIED** |

One investigator observed that the project ref recorded in repo config still
resolves and returns `401 "No API key found"` — i.e. *a* project exists at that
ref — which contradicts an earlier NXDOMAIN observation. Neither observation
tells us what is **inside** the database. Both remain unverified. Nobody on this
task has, or should seek, database credentials.

## Rules (non-negotiable)

1. **Never rewrite already-applied history.** Do not edit, renumber, rename or
   delete a migration file that any environment has applied, and never `DELETE`
   from `supabase_migrations.schema_migrations`. History is an append-only log
   of what happened, not a description of what we wish had happened.
2. **Forward-only corrective migrations.** Every fix is a new file with a new
   version, written to be safe to run against a database that may already be in
   the target state (`IF NOT EXISTS`, `DROP POLICY IF EXISTS` then `CREATE`,
   `ADD COLUMN IF NOT EXISTS`).
3. **Back up before any corrective action.** A verified, restorable backup of
   the hosted database, taken and confirmed restorable *before* the first
   statement runs. "Supabase takes daily backups" is not a verified backup.
4. **No new migration is applied until the drift is understood.** Understood
   means: the export in step 1 has been run, the report in step 2 has been read,
   and the owner has approved a plan.
5. **Never `DROP` to reconcile.** Anything classified `obsolete` is *proposed*
   for removal in a later, separately approved change. Reconciliation never
   deletes data to make two sides match.
6. **No credentials in the repo.** The export runs from the operator's own
   environment. Connection strings, keys and project refs never enter a file,
   an issue comment or a PR.

## Procedure

### Step 1 — Export the hosted state (operator, requires SQL access)

Run `scripts/sql/export-migration-history.sql`. It is read-only: it opens a
`SET TRANSACTION READ ONLY` block, contains no DDL and no DML, and reads only
catalog metadata plus aggregate counts.

The minimum is section 1:

```sql
SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version;
```

The preferred output is **section 9**, which returns one JSON value in the exact
envelope the report tool consumes. Save that single cell as `hosted-export.json`
**outside the repository** and do not commit it.

If a statement fails, the failure is usually the finding, not a bug:

| Error | Means |
| --- | --- |
| `3F000` / `42P01` on section 1 | `supabase_migrations` schema absent — likely a new project after the restore |
| `42703` on section 8 | The referenced column does not exist — drift confirmed for that column |
| `42501` | Your role cannot read the catalog. Get a role that can. Do **not** grant yourself rights. |

### Step 2 — Classify (anyone, offline)

```bash
tsx scripts/migration-drift-report.ts --export ./hosted-export.json
tsx scripts/migration-drift-report.ts --export ./hosted-export.csv --json
```

The tool opens no database connection and imports no driver — a unit test in
`tests/unit/migration-drift.test.ts` enforces that. It classifies only what was
pasted. Sections that were not exported are reported as **evidence gaps**, never
as "clean".

### Step 3 — Decide (owner)

Attach the report to issue #192. Nothing proceeds without a written decision.

### Step 4 — Write the corrective migration (blocked)

Blocked until steps 1–3 complete and the freeze clears. The proposals below are
written out so this step is a transcription job, not a design job.

## Drift classes

| Class | Meaning | Corrective posture |
| --- | --- | --- |
| `applied-and-in-repo` | Hosted and repository agree | None |
| `applied-missing-from-repo` | Hosted applied something the repo cannot reproduce | Recover the SQL, commit it as an idempotent forward migration. **Never** delete the hosted history row |
| `in-repo-not-applied` | Repo declares it, hosted lacks it | Apply forward in version order, after backup |
| `manually-altered` | Hosted state of the object cannot be explained by the repo's migration history — changed out of band (present-but-undeclared, or needed-and-absent) | Codify the intended shape in a forward migration |
| `obsolete` | Present hosted, nothing in repo or code needs it | Propose removal in a separate approved change. Never auto-drop |
| `intentional-environment-difference` | Known, accepted, owner-recorded | None |

The classifier's allow-list for the last class ships **empty** on purpose. An
entry may only be added alongside a signed-off row in this document.

## Decision tree — "the restore produced a new project with empty history"

This is the case the whole task was designed around. **An empty history is a
finding requiring a fresh migration plan, not an error.**

```
Run section 1 / 1b of the export.
│
├─ supabase_migrations.schema_migrations DOES NOT EXIST
│   └─ New project, migration system never initialised here.
│      ├─ Do hosted tables exist? (section 3)
│      │   ├─ NO  → Genuinely blank project.
│      │   │        PLAN A: baseline. Apply the 40 repo migrations in version
│      │   │        order into the blank project, then export again and confirm
│      │   │        40/40. Requires owner approval + a decision about whether
│      │   │        the old data is being restored into it first.
│      │   └─ YES → Schema exists but was created outside the migration system
│      │            (restore of a dump, or hand-built).
│      │            PLAN B: adopt. Do NOT replay the repo — every migration
│      │            would try to recreate live objects. Instead reconcile the
│      │            actual schema against the repo, then record the already-
│      │            satisfied versions as applied. Requires owner approval.
│      └─ In both cases: the old project's data is a separate question →
│         docs/launch/BACKFILL_PLAN.md.
│
├─ Schema EXISTS but the table is EMPTY (0 rows)
│   └─ History was reset (restore, or manual truncate) while objects survived.
│      Same as PLAN B. Treat "in-repo-not-applied" rows as UNPROVEN — verify
│      object-by-object with sections 2–7 before applying anything. Replaying
│      blindly is the highest-risk action available here.
│
└─ Schema EXISTS with rows
    └─ Normal drift reconciliation. Run the report, work the classes above.
       Only `in-repo-not-applied` rows are candidates for forward apply.
```

**Risk note.** The most dangerous outcome is not the empty history — it is
mistaking PLAN B for PLAN A. Replaying 40 migrations against a live schema whose
history table happens to be empty will attempt to recreate live objects; the
non-idempotent files among them will fail partway, leaving a half-applied
database. **Never resolve an empty history by running `supabase db push`.**

## Drift inventory and proposed corrective migrations

Every item below is **PROPOSED, NOT WRITTEN**. No file under
`supabase/migrations/` has been created, edited or deleted for this task, and
none may be until the freeze and Task 3.6 clear.

Each proposal assumes it will be written as a single forward-only migration with
a new timestamp, fully idempotent, and applied only after a verified backup.

### A. `books` columns — code reads them, no migration creates them

Repository-verified. Hosted presence **unverified** — sections 2 and 3 of the
export decide whether each is `manually-altered` (present, hand-added) or
`manually-altered` in its broken form (absent, so the read path is failing).

| Column | Proposed corrective statement | Status |
| --- | --- | --- |
| `books.subtitle` | `ALTER TABLE books ADD COLUMN IF NOT EXISTS subtitle TEXT;` | **Proposed, not written** |
| `books.epub_url` | `ALTER TABLE books ADD COLUMN IF NOT EXISTS epub_url TEXT;` — note `book_content.epub_url` already exists; confirm which one code actually reads before choosing add-column vs. fix-the-read | **Proposed, not written** |
| `books.deleted_at` | `ALTER TABLE books ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;` plus a partial index `WHERE deleted_at IS NULL`. **Soft-delete semantics must be confirmed first** — if code filters on it but the column is absent, deleted books are currently visible | **Proposed, not written** |
| `books.author_name` | `ALTER TABLE books ADD COLUMN IF NOT EXISTS author_name TEXT;` — denormalised; decide whether it is a cache of `authors.pen_name` or an override before adding | **Proposed, not written** |
| `books.metadata` | `ALTER TABLE books ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;` | **Proposed, not written** |
| `books.tags` | `ALTER TABLE books ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';` | **Proposed, not written** |
| `books.categories` | `ALTER TABLE books ADD COLUMN IF NOT EXISTS categories TEXT[] DEFAULT '{}';` — overlaps existing `genre`/`subgenres`; resolve the overlap rather than adding a third taxonomy | **Proposed, not written** |
| `books.view_count` | `ALTER TABLE books ADD COLUMN IF NOT EXISTS view_count INTEGER NOT NULL DEFAULT 0;` — overlaps existing `total_reads` | **Proposed, not written** |
| `books.download_count` | `ALTER TABLE books ADD COLUMN IF NOT EXISTS download_count INTEGER NOT NULL DEFAULT 0;` | **Proposed, not written** |
| `books.manuscript_url` | `ALTER TABLE books ADD COLUMN IF NOT EXISTS manuscript_url TEXT;` — the manuscript workflow (`20260724*`) already links manuscripts to books; confirm this is not a duplicate path | **Proposed, not written** |
| `books.language` | `ALTER TABLE books ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'en';` | **Proposed, not written** |
| `books.seo_title` | `ALTER TABLE books ADD COLUMN IF NOT EXISTS seo_title TEXT;` | **Proposed, not written** |
| `books.seo_description` | `ALTER TABLE books ADD COLUMN IF NOT EXISTS seo_description TEXT;` | **Proposed, not written** |

**Open question for the owner:** production reads the catalog from MongoDB. If
these columns are only needed by the Supabase read path, and that path is being
retired, the correct corrective action may be **to remove the code references,
not to add the columns**. Do not add thirteen columns to a database the
production read path no longer uses without deciding that first.

### B. Tables — code references them, no migration creates them

| Table | Proposed corrective action | Status |
| --- | --- | --- |
| `book_views` | Create an append-only view-event table (`id`, `book_id` FK to `books`, `user_id` nullable, `viewed_at`, `session_id`), RLS enabled, INSERT policy for authenticated + anon, SELECT restricted to admin. Index on `(book_id, viewed_at DESC)` | **Proposed, not written** |
| `book_view_cache` | Create an aggregate cache (`book_id` PK, `view_count`, `refreshed_at`) or replace it with a materialized view — note `20260117000002_book_stats_materialized.sql` already exists and may supersede it. **Decide before writing** | **Proposed, not written** |

### C. RPCs — code calls them, no migration creates them

| Routine | Proposed corrective action | Status |
| --- | --- | --- |
| `books_search` | Define over the existing `books.search_vector` generated tsvector column. Must be `SECURITY INVOKER`, must filter `status='published' AND visibility='public'`, and must respect the hardening posture set by `20260708074819_harden_definer_views_and_rpcs.sql` | **Proposed, not written** |
| `increment_view_count` | Requires `SECURITY DEFINER` to write a counter an anonymous caller cannot otherwise write. That makes it a security-sensitive object: pin `search_path`, take `book_id` only, and rate-limit at the application layer. **Do not write this one without a security review** | **Proposed, not written** |

If the export shows either routine already present hosted, classification is
`manually-altered` and the corrective migration must reproduce **the definition
that is actually there** — export it with `pg_get_functiondef` first — not a
freshly invented one.

### D. `audit_logs` — RLS enabled, SELECT policy only, no INSERT policy

Repository-verified from `20260118000000_critical_fixes.sql`. With RLS on and no
INSERT policy, any non-service role writing an audit row is silently denied,
which means the audit trail is incomplete exactly when it matters.

| Item | Proposed corrective action | Status |
| --- | --- | --- |
| `audit_logs` INSERT policy | `DROP POLICY IF EXISTS "Service can insert audit logs" ON audit_logs;` then a `FOR INSERT WITH CHECK (...)` policy scoped to the writing role. Decide first whether audit writes should go through the service role only (in which case the correct fix may be to document that, not to widen the policy) | **Proposed, not written** |

### E. Storage buckets

`book-covers`, `manuscripts` and `published-epubs` are declared in
`20260117000006_storage_policies.sql` and `20260724000005_harden_manuscript_storage.sql`.
A restore can recreate buckets with default visibility. Section 7 of the export
answers this. **If `published-epubs` or `manuscripts` comes back `public = true`,
that is a paid-content exposure and an immediate escalation to the owner — not a
migration to schedule.**

## What requires Renee

| Action | Why |
| --- | --- |
| Running the hosted export (or delegating SQL access to someone who can) | No one on this task has or may seek credentials |
| Confirming whether the restore produced a new project | Determines PLAN A vs PLAN B — the highest-consequence branch here |
| Approving any corrective migration before it is written | Rule 4 |
| Approving the backup before any corrective action runs | Rule 3 |
| Deciding whether to add the 13 drifted `books` columns or retire the Supabase read path | Changes the entire corrective plan |
| Approving `increment_view_count` as `SECURITY DEFINER` | Security-sensitive |
| Any `DROP` of an object classified `obsolete` | Rule 5 |
| Adding anything to the `intentional-environment-difference` allow-list | Only the owner may declare a difference intentional |

## Related

- `scripts/sql/export-migration-history.sql` — the read-only export
- `scripts/migration-drift-report.ts` — the offline classifier
- `tests/unit/migration-drift.test.ts` — classifier coverage
- `docs/launch/BACKFILL_PLAN.md` — the stranded Supabase-only books question
