# Backup & Restore Runbook — Supabase (P1.8, DoLC B13)

> **NEVER run a restore against production.** Every restore in this runbook
> targets a scratch database, and §5.1's guard block is mandatory before
> `pg_restore` is typed at all. "I was sure it was the scratch URL" is how
> production databases die. There is no step anywhere below that points
> `pg_restore` at `SUPABASE_DB_URL`.

Operator-facing. A *backup* here means all three of: a logical dump of the
hosted Supabase Postgres 17 database, a snapshot of both storage buckets, and
a **passed restore test on a scratch database**. An untested dump is a hope,
not a backup — Phoenix **P1.8** is satisfied only by the restore test, and
DoLC **B13** notes that G11's deployment rollback never covers data. This
runbook is that data half.

Run a full backup immediately **before**:

- designating an RC and starting the G10 block (`RC_EVIDENCE_KIT.md` §1);
- the Phase 11 export (`docs/PHOENIX_CUTOVER_RUNBOOK.md` §0 refuses to start
  until P1.8 is done);
- any destructive migration or bulk data operation.

**Freeze note (#209):** class 1 documentation. Executing §1–§4 is read-only
against production; §5 touches only scratch infrastructure.

## 0. Prerequisites

| Need | Where it comes from |
| --- | --- |
| `SUPABASE_DB_URL` | Supabase → Project Settings → Database → Connection string → URI. Use the **direct** connection (port 5432) or session pooler — not the transaction pooler (`:6543`); `pg_dump` needs session semantics |
| `SUPABASE_PROJECT_REF` | Supabase → Project Settings → General |
| `SUPABASE_ACCESS_TOKEN` | Supabase account token — only for `supabase` CLI (link + storage) |
| `RESTORE_DB_URL` | The scratch target from §5.1 — never production |
| `BACKUP_STORE_URI` | A **versioned**, access-controlled GCS/S3 bucket, e.g. `gs://<org-backups>/mangu` |
| `pg_dump` / `pg_restore` / `psql` **17.x** | Postgres 17 client tools; client major must match the server (hosted is Postgres 17). Check `pg_dump --version` |
| `supabase` CLI, `jq`, `shasum`, `tar` | package manager |

Placeholder names only — real values live in `.env.local` (git-ignored) or
your shell. Never in this repo, never in a ticket, never in chat.

Working area (inside the git-ignored `export/` tree):

```bash
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BK="export/backups/${STAMP}"
mkdir -p "$BK/storage"
git check-ignore -v export/
```

**Good:** `git check-ignore` prints the `.gitignore` rule for `/export/` — the
whole tree is uncommittable. **Stop if** it prints nothing: fix `.gitignore`
before creating a single artifact. Backups contain real user emails and order
history; they never enter git, and their contents are never pasted anywhere.

## 1. Baseline counts (production, read-only)

Captured at dump time; the §5.3 verification is meaningless without them. Run
this immediately before §2 — a gap between the two invites drift.

```bash
psql "$SUPABASE_DB_URL" -At <<'SQL' | tee "$BK/baseline_counts.txt"
select 'profiles: ' || count(*) from public.profiles
union all select 'books: '  || count(*) from public.books
union all select 'orders: ' || count(*) from public.orders;
SQL

psql "$SUPABASE_DB_URL" -At -c \
  "select id, title, status from public.books order by created_at asc limit 3;" \
  | tee "$BK/baseline_spot.txt"
```

**Good:** three labelled counts and up to three book rows on disk under `$BK`.

## 2. Logical dump

Primary form — one restorable artifact:

```bash
pg_dump "$SUPABASE_DB_URL" \
  --format=custom --no-owner --no-privileges \
  --file "$BK/db_full.dump"

pg_dump "$SUPABASE_DB_URL" --schema-only > "$BK/schema.sql"   # human-readable companion
```

**Good:** both commands exit 0 and `db_full.dump` has a plausible size for the
current data volume. **Stop if** you see a server/client version mismatch —
install the Postgres 17 client and re-run from the top of §2. A partial dump
is not a backup.

Alternative (`supabase` CLI, plain-SQL trio):

```bash
supabase db dump --db-url "$SUPABASE_DB_URL" -f "$BK/roles.sql"  --role-only
supabase db dump --db-url "$SUPABASE_DB_URL" -f "$BK/schema.sql"
supabase db dump --db-url "$SUPABASE_DB_URL" -f "$BK/data.sql"   --data-only --use-copy
```

> `scripts/backup-db.sh` runs `supabase db dump` **without** `--data-only` —
> that is a schema-only dump. It is not, on its own, a P1.8 backup.

## 3. Storage snapshot

Production buckets: **`book-covers`** (public cover assets) and
**`manuscripts`** (private author uploads — the one you cannot recreate).
Both are in scope.

```bash
supabase link --project-ref "$SUPABASE_PROJECT_REF"
supabase storage ls ss:/// --experimental                      # confirm the bucket list
supabase storage cp -r "ss:///book-covers" "$BK/storage/book-covers" --experimental
supabase storage cp -r "ss:///manuscripts" "$BK/storage/manuscripts" --experimental
```

Build the manifest the restore test will check against:

```bash
( cd "$BK" && find storage -type f | sort | wc -l | tee storage_count.txt )
( cd "$BK" && find storage -type f -exec shasum -a 256 {} + > storage_manifest.sha256 )
```

**Good:** `ls` shows exactly the two buckets named above; both copies
complete; manifest line count equals `storage_count.txt`. **Stop if** `ls`
shows a bucket this runbook does not name — the runbook is stale. Add the
bucket to the snapshot **and** to this section before continuing.

## 4. Seal and store off-site — not in git

```bash
( cd "$BK" && shasum -a 256 db_full.dump schema.sql > artifacts.sha256 )
tar -czf "export/backups/mangu_backup_${STAMP}.tar.gz" -C export/backups "$STAMP"
shasum -a 256 "export/backups/mangu_backup_${STAMP}.tar.gz"
```

Encrypt, then upload to `BACKUP_STORE_URI` (bucket must have **versioning
on**), e.g.:

```bash
age -r <recipient-key> -o "mangu_backup_${STAMP}.tar.gz.age" "export/backups/mangu_backup_${STAMP}.tar.gz"
# gsutil cp … / aws s3 cp … the .age file to "$BACKUP_STORE_URI/"
```

Where artifacts live: the versioned off-site bucket. Where they never live:
this repo (`/export/` is git-ignored precisely so they cannot be committed),
Vercel, issues, chat. The local copy under `export/` may stay until §5 passes;
after that, the off-site copy is the one that counts. Record file **names and
sha256 hashes** in the log — hashes are safe to record; contents never are.

## 5. Restore test — scratch only

### 5.1 Pick and guard the target

Scratch options, best first: (a) a Supabase **branch database** off the
project; (b) a separate throwaway Supabase project; (c) the local stack
(`supabase start`, Postgres 17 in Docker — it prints its DB URL). Set
`RESTORE_DB_URL`, then run the guard **verbatim**:

```bash
case "$RESTORE_DB_URL" in
  *"$SUPABASE_PROJECT_REF"*) echo "REFUSING — target contains the production project ref"; exit 1 ;;
esac
PROD_HOST="$(printf '%s' "$SUPABASE_DB_URL"  | sed -E 's|.*@([^:/?]+).*|\1|')"
REST_HOST="$(printf '%s' "$RESTORE_DB_URL" | sed -E 's|.*@([^:/?]+).*|\1|')"
[ -n "$REST_HOST" ] && [ "$REST_HOST" != "$PROD_HOST" ] \
  || { echo "REFUSING — restore host equals production host"; exit 1; }
psql "$RESTORE_DB_URL" -c "select current_database(), version();"
```

**Good:** both guards pass and `psql` shows the scratch database on Postgres
17. **Stop if** either guard trips — you were one command from restoring into
production. Walk away, re-read the banner, start §5.1 again.

### 5.2 Restore

```bash
pg_restore --no-owner --no-privileges --clean --if-exists \
  --dbname "$RESTORE_DB_URL" "$BK/db_full.dump"
```

`--clean` is tolerable **only** because §5.1 proved the target is scratch.
Warnings about Supabase-managed schemas or roles (`auth`, `storage`,
`supabase_admin`) are expected on a managed scratch target; §5.3 is the
pass/fail authority, not a clean console.

### 5.3 Verification — five named queries, results recorded

```bash
psql "$RESTORE_DB_URL" -At <<'SQL'
-- V1 profiles-count
select 'V1 profiles: ' || count(*) from public.profiles;
-- V2 books-count
select 'V2 books: '    || count(*) from public.books;
-- V3 orders-count
select 'V3 orders: '   || count(*) from public.orders;
-- V5 orphan-orders (referential spot-check; expect 0)
select 'V5 orphans: '  || count(*)
  from public.orders o
  left join public.profiles p on p.id = o.user_id
  where p.id is null;
SQL

# V4 book-spot-check — compare byte-for-byte to the baseline
psql "$RESTORE_DB_URL" -At -c \
  "select id, title, status from public.books order by created_at asc limit 3;" \
  | diff "$BK/baseline_spot.txt" - && echo "V4 MATCH"
```

| ID | Name | Pass criterion |
| --- | --- | --- |
| V1 | profiles-count | equals `profiles` in `baseline_counts.txt` |
| V2 | books-count | equals `books` in `baseline_counts.txt` |
| V3 | orders-count | equals `orders` in `baseline_counts.txt` |
| V4 | book-spot-check | `diff` silent → `V4 MATCH` |
| V5 | orphan-orders | exactly `0` |

**Good:** all five pass. Only now may the backup be described as
**restore-tested**; record it in §6 and cite it for P1.8 / B13. **Stop if**
any check fails: it is not a backup yet. Diagnose (truncated dump? wrong
flags? §1→§2 gap?), re-dump from §1, re-test. Do not average it out; do not
mark P1.8 done on 4/5.

### 5.4 Storage snapshot integrity

```bash
( cd "$BK" && shasum -a 256 -c storage_manifest.sha256 --quiet ) && echo "storage snapshot OK"
```

…then open one file from each bucket locally (one cover renders, one
manuscript opens).

**Good:** `storage snapshot OK` and both spot files open. **Stop if** any hash
fails — re-copy that bucket (§3) and re-verify.

### 5.5 Tear down

Delete the scratch branch/project (or `supabase stop`) when done — it now
holds real user data and inherits every handling rule in §0/§4.

## 6. Restore log entry — dated, append-only

Fill this and **append** it to `docs/OPERATOR_QA_LOG.md` (the log is
append-only: complete blank cells or add new entries; never edit recorded
history). This entry is the P1.8 / B13 evidence.

| Field | Value |
| --- | --- |
| Date/time (UTC) | |
| Operator | |
| Backup artifact | `mangu_backup_<STAMP>.tar.gz` |
| Artifact sha256 | |
| Off-site location (bucket + object version) | |
| Restore target (scratch host, §5.1 guard passed) | |
| V1 profiles-count (restored / baseline) | / |
| V2 books-count (restored / baseline) | / |
| V3 orders-count (restored / baseline) | / |
| V4 book-spot-check | MATCH / MISMATCH |
| V5 orphan-orders | |
| Storage manifest check (§5.4) | OK / FAIL |
| Result | RESTORE-TESTED / FAILED |
| Evidence link | |

## 7. If you ever need it for real

A production incident does not suspend the banner. Even then: restore into a
**new** scratch database, run §5.3, and only after it passes repoint the
application (or replay rows forward) with the Data Owner's written sign-off.
`pg_restore --clean` aimed at the production URL is never the move — not
during a drill, not during an outage. Escalation path and Sev definitions:
`.claude/skills/mangu-ops-runbook/SKILL.md`.
