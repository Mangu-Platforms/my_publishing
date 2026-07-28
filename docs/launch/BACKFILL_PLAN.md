# Backfill Plan — stranded Supabase-only books

**Task 3.6 — issue #192. Analysis and options only. Nothing here has been executed, and nothing here may be executed without the owner's written approval and a verified backup.**

## The problem in one paragraph

Production reads the catalog from MongoDB (`DATABASE_PROVIDER=mongodb`) while
auth, identity and orders stay on Supabase (`AUTH_PROVIDER=supabase`). A separate
in-flight change (#356) makes admin book writes provider-aware, so every book
published through the admin UI now lands in MongoDB. Any book row that only ever
existed in Supabase is therefore **invisible to the production read path**. It is
not deleted, not broken, and not served. Deciding what happens to those rows is
this document.

## STOP CONDITION

> **If Supabase and MongoDB both contain non-identical live book rows, stop.**
> That is not an engineering call. It requires the owner's approval and a
> verified, restorable backup of both stores before any reconciliation begins.

`scripts/backfill-books-dry-run.ts` prints this condition prominently and exits
having written nothing, in either store, ever. It has no execute mode and must
not be given one.

## Step 1 — Measure before deciding

```bash
tsx scripts/backfill-books-dry-run.ts
tsx scripts/backfill-books-dry-run.ts --limit 50
tsx scripts/backfill-books-dry-run.ts --json      # redacted, safe to paste
```

Read-only. Uses the repository's existing helpers and existing environment
variable names (`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
`MONGODB_URI`, `MONGODB_DB`) and introduces no new ones. Output is redacted:
identifiers are hashed to a short tag, storage URLs are reduced to their final
path segment with any query string stripped, and long free text is reported as a
length plus a short hash rather than printed.

If either store cannot be read, the script reports that as an explicit gap and
aborts rather than reporting a misleading zero. **A Supabase connection failure
is a finding, not a result** — the project's state after the restore is
unverified, and "we couldn't read it" must never be recorded as "there was
nothing there."

### Matching

Records are matched in strict precedence order:

1. **`slug`** — the identity the public catalog route uses. Highest confidence.
2. **`isbn`** — globally unique when present, but usually blank on drafts.
3. **normalised `title` + author** — lowercased, punctuation and whitespace
   folded away. A **heuristic**. A pair matched only this way should be read as
   "probably the same book", never as proof, and the report labels it as such.

### The four buckets

| Bucket | Meaning | Default reading |
| --- | --- | --- |
| **Supabase-only** | Exists in Supabase, no counterpart in Mongo | The stranded set. This is the population this document is about |
| **Mongo-only** | Exists in Mongo, no counterpart in Supabase | Expected and healthy — anything published through the admin UI since #356 |
| **In both, identical** | Matched, and every compared field agrees | No action |
| **In both, conflicting** | Matched, but at least one compared field disagrees | **Triggers the stop condition** |

Conflicts are detected field by field across `title`, `slug`, `isbn`,
`author_name`, `description`, `genre`, `status`, `visibility`, `price`,
`cover_url` and `published_at`. Comparison is done on normalised full values
(case and whitespace folded; prices to two decimals; dates as ISO instants;
storage URLs compared on path only, because signed query strings differ on every
read). Printing is done on the **redacted** value. Comparing at full fidelity
while printing at reduced fidelity is deliberate: it avoids both false
"conflicts" from signed-URL noise and leaking anything sensitive into an issue
thread.

## Step 2 — Choose an option

None of these may begin before the dry run has been read and the owner has
approved in writing.

### Option A — Backfill Supabase-only books into MongoDB

Write the stranded rows into the Mongo `books` collection so the production read
path can serve them.

**For:** preserves the catalog; one operation; no author involvement; the fastest
path to "everything that existed is visible again".

**Against:** the highest-risk option. Field mapping between the two schemas is
not one-to-one — Supabase `books` carries `isbn`, `subgenres`, `discount_price`,
`total_reads`, `average_rating`, `page_count`, `word_count` and a `status`
enum with six values (`draft`, `submitted`, `review`, `accepted`, `published`,
`archived`), while the Mongo `Book` shape uses three (`draft`, `published`,
`archived`) plus a separate `visibility`. Every mapping choice is a silent data
decision. It also assumes the Supabase rows are the good copy, which is exactly
what a conflict disproves. Author and cover-asset references must be resolved
too — a backfilled book pointing at a Supabase Storage URL is a book that breaks
when that project is finally shut down.

**Choose when:** the Supabase-only set is large, the rows are genuinely live
published content, and the conflicting bucket is empty.

### Option B — Republish through the admin UI

Have the responsible person re-enter or re-publish each stranded book through
the admin interface, which after #356 writes to MongoDB.

**For:** by far the safest. Uses the real, tested write path, so validation,
slug-uniqueness checks, asset handling and audit trail all behave normally. No
bespoke migration script exists afterwards to be re-run by accident. Produces
correct Mongo-shaped documents by construction.

**Against:** manual and slow; unattractive beyond roughly a dozen books; loses
original `created_at` and any accumulated counters unless they are re-entered.

**Choose when:** the stranded set is small, or the rows matter enough that
correctness beats speed. **This is the recommended default for a launch.**

### Option C — Abandon as QA data

Leave the Supabase-only rows where they are and do not surface them.

**For:** zero risk, zero effort, and honest if the rows are what they usually
are — seed and test data from before the dual-database split.

**Against:** irreversible in perception if any row turns out to be real author
content. Requires actually looking at the list, not assuming.

**Choose when:** the dry run shows the stranded rows are drafts, test titles or
seed fixtures with no orders and no author expectation attached.

These are not exclusive. The likely real answer is **C for most rows and B for
the few that are real**, decided by reading the dry-run list.

## Decision criteria

Work through these in order:

1. **Is the conflicting bucket empty?** If not — **STOP**. Owner decision and
   backup first. Nothing below applies until conflicts are resolved one way or
   the other, per row, by a human.
2. **How many Supabase-only rows are there?** ≤ 12 → Option B. Substantially
   more → Option A becomes worth its risk.
3. **Are they real?** For each stranded row: is `status = 'published'` and
   `visibility = 'public'`? Does a real author own it? Is there an order or an
   entitlement referencing it? If none of those hold for any row → Option C.
4. **Do any orders reference a stranded book?** If yes, that row is not QA data
   under any circumstance, and it is also an entitlement problem, not just a
   catalog one. Escalate.
5. **Is the cover or EPUB asset in Supabase Storage?** Then Option A also
   requires an asset migration, which is a separate piece of work and a separate
   approval. Do not treat it as part of the row copy.
6. **Is the Supabase project's future decided?** If it is being retired, Option A
   buys time but not a solution — the assets and the auth data still need a plan.

## Backup requirement

Before **any** write, in any option including B:

- A verified, restorable snapshot of the MongoDB `books` and `authors`
  collections. Verified means a test restore was performed, not that a backup
  job reported success.
- A verified export of the Supabase `books` and `authors` tables.
- Both snapshots recorded in issue #192 with their timestamp and location.
- A named person who confirmed the restore test.

"Supabase and Atlas both take automatic backups" does not satisfy this. Neither
does a backup taken after the first write.

## Rollback

| Option | Rollback |
| --- | --- |
| **A — backfill into Mongo** | Every inserted document must carry a distinguishing marker (for example a `backfill_batch` field set to the issue number and timestamp) recorded at write time. Rollback is deleting exactly the documents carrying that batch marker, then restoring from the verified snapshot and re-verifying counts. Without the marker there is no rollback, only a restore that also discards anything published in the meantime — so **the marker is a precondition of approval, not a nice-to-have**. |
| **B — republish via admin** | Unpublish or archive the re-created book through the same admin UI. Normal product behaviour, fully audited. |
| **C — abandon** | Nothing to roll back. The Supabase rows are untouched and remain recoverable for as long as that project exists — which is itself a reason to decide the project's future before relying on this. |

Rollback for every option assumes the backup above exists and has been restore-tested.

## What requires Renee

| Action | Why |
| --- | --- |
| Approving any backfill at all | The stop condition; live customer-facing data |
| Approving the specific option (A, B or C) per row or per batch | Each has different, non-reversible consequences |
| Confirming the backup was taken and restore-tested | Nothing runs before this |
| Deciding any conflicting row | Both stores hold a live version; only the owner can say which is correct |
| Deciding the Supabase project's future | Determines whether Option A is a fix or a delay |
| Approving a Supabase Storage asset migration, if Option A is chosen | Separate work, separate risk |

## Related

- `scripts/backfill-books-dry-run.ts` — the read-only comparison
- `docs/operations/MIGRATION_DRIFT_RECONCILIATION.md` — the schema-drift side of the same problem
- Issue #192 — Task 3.6
- PR #356 — provider-aware admin book writes (the change that created the stranded set)
