# Schema Drift Dispositions

> **Companion to** `docs/architecture/ADR-003-catalog-and-identity-data-ownership.md`.
> Verified against `audit/2026-07-28-fixes` @ `8e6fa50`. Line numbers are from that commit.

## The constraint that shapes every disposition

**No new Supabase migrations may be created** until hosted migration drift is reconciled
(Task 3.6 / issue #192, P0-004). The repository holds 40 migration files; the hosted database's
`supabase_migrations.schema_migrations` history has **not** been re-verified since the 25-file
export recorded in `docs/OPERATOR_QA_LOG.md` on 2026-07-18. Adding a migration on top of an
unreconciled history risks a divergent hosted schema that is far harder to repair than the drift
itself.

**Therefore every disposition below is code-side.** The available dispositions are:

| Disposition | Meaning |
| --- | --- |
| **REMOVE** | Delete the reference. The feature it supports does not work today and is not launch scope. |
| **REMAP** | Point the reference at the canonical field/table that actually exists. |
| **DEFER** | Keep the intent, ship without it, revisit after Task 3.6 unblocks migrations. |

**"Add the column" is not available.** Any PR proposing a new migration before Task 3.6 completes
should be rejected in review.

## Evidence method

For each item: `grep -rn "<object>" supabase/migrations/` over all 40 migration files. "Exists in no
migration" means zero matching DDL. The canonical `books` table is
`supabase/migrations/20260116000000_initial_schema.sql:40–69`; subsequent `ALTER TABLE books`
statements are at `20260118000000_critical_fixes.sql:15–16, :192`,
`20260122000000_social_features.sql:141`, `20260619124500_add_content_type_to_books.sql:4`,
`20260619162409_add_content_type.sql:2`, and `20260619170000_add_retailer_urls.sql:2`. Together
these define the complete real column set.

> **Why this drift has not caused a total outage:** `PUBLIC_BOOK_SELECT` is
> `` `*, author:authors(...)` `` (`lib/supabase/public-queries.ts:27`) — the public read path uses
> `SELECT *` and never names a drifted column. The drift bites on **writes** and on **explicit
> column selects**, which is why it surfaces in the admin console and not on the storefront.

---

## 1. Drift register

### D-01 `books.subtitle`

| | |
| --- | --- |
| **Referenced at** | `app/admin/books/[id]/edit/page.tsx:15` (explicit `.select('id, title, subtitle, …')`) · `lib/actions/books.ts:337` (`updateBookAdmin` input) · `lib/actions/books.ts:782` (raw SQL in `searchBooks`) · `app/admin/books/[id]/edit/BookEditForm.tsx:22, :46, :77, :122–126` (form field "Subtitle") · `types/books.ts:13` |
| **Evidence** | `grep -rn "subtitle" supabase/migrations/` → **0 matches.** Not in the `CREATE TABLE books` block, not in any `ALTER TABLE books`. |
| **Impact** | The admin edit page's explicit select **names `subtitle`**, so PostgREST rejects the whole query — the edit page cannot load a book. This is a hard failure, not a silent one. |
| **Disposition** | **DEFER — remove from code now, pending a post-3.6 forward migration.** Subtitle is legitimate editorial metadata and should exist. It cannot be added while migrations are frozen. Remove `subtitle` from the select list, the form, and the action input so the admin console works; re-add via a forward migration after Task 3.6. |
| **Follow-up owner** | Engineering (removal) → Database Owner (post-3.6 migration) |
| **Launch impact** | Books ship without subtitles at launch. If a launch book *needs* a subtitle, fold it into `title` and note it on the per-book signoff. |

### D-02 `books.epub_url`

| | |
| --- | --- |
| **Referenced at** | `lib/actions/books.ts:494` (`createBookAdmin` input), **`:564` (INSERT into `books`)** · `lib/actions/books.ts:348` (`updateBookAdmin` input), **`:419` (UPDATE `books`)** · `types/books.ts:27` |
| **Evidence** | `grep -rn "epub_url" supabase/migrations/` → **exactly 1 match: `20260116000000_initial_schema.sql:78`**, which is inside `CREATE TABLE book_content`, **not** `books`. |
| **Impact** | Every admin book create/update that supplies `epub_url` fails at the database. |
| **Disposition** | **REMAP to `book_content.epub_url`.** The canonical field exists and is already the read path (`PUBLIC_BOOK_WITH_CONTENT_SELECT`, `lib/supabase/public-queries.ts:30`). ⚠️ **Blocker:** there is **no application write path for `book_content` anywhere in the repo** — the remap target has no writer. Either write the upsert as part of this remap, or **REMOVE** the field from the admin forms and attach EPUBs out-of-band. |
| **Follow-up owner** | Engineering — **needs a scope decision from Renee** (build the `book_content` writer, or accept out-of-band attachment for a 3–6 book launch) |
| **Launch impact** | Locked decision: **no on-site EPUB reader at launch**; EPUB is retained for internal asset management only. Out-of-band attachment is therefore viable for launch. |

### D-03 `books.deleted_at` (soft delete)

| | |
| --- | --- |
| **Referenced at** | `lib/actions/books.ts:137, :252, :260, :272, :388, :395, :436, :610, :631, :670, :678, :685, :788` — includes `deleteBook` writing `deleted_at` (`:631`) and `restoreBook` clearing it (`:685`) · `types/books.ts:46` |
| **Evidence** | `grep -rn "deleted_at" supabase/migrations/` → **0 matches.** |
| **Impact** | **The entire soft-delete/restore feature is non-functional.** `deleteBook` with `hardDelete=false` errors; `restoreBook` errors; and every `.is('deleted_at', null)` filter errors, which breaks the duplicate-slug check in `createBook` (`:137`) and the ownership check in `updateBook` (`:252`). |
| **Disposition** | **REMAP to `status='archived'`.** `books.status` already includes `'archived'` in its CHECK constraint (`...initial_schema.sql:51`) and `docs/BOOK_LIFECYCLE.md` defines Unpublished/Archived as the supported "remove from public view without deleting" state. Soft delete is a redundant second mechanism for the same concept. Delete the `deleted_at` filters; make `deleteBook`/`restoreBook` status transitions. |
| **Follow-up owner** | Engineering |
| **Launch impact** | High — the archive transition is a launch-required lifecycle state (`docs/BOOK_LIFECYCLE.md`). Must be fixed before G10 QA of the admin console. |

### D-04 `books.author_name` (denormalised author name)

| | |
| --- | --- |
| **Referenced at** | `lib/actions/books.ts:154` (INSERT in `createBook`) · `lib/actions/books.ts:782` (raw SQL in `searchBooks`) · `types/books.ts:16, :102` · read defensively at `app/(consumer)/genres/[genre]/page.tsx:78` |
| **Evidence** | `grep -rn "author_name" supabase/migrations/` → **1 match: `20260116000000_initial_schema.sql:482`**, which is `a.pen_name as author_name` — a **column alias inside a VIEW**, not a column on `books`. |
| **Impact** | `createBook` (author-scoped, Supabase branch) fails on insert. |
| **Disposition** | **REMAP to the joined `authors.pen_name`.** Every read path already joins the author (`PUBLIC_AUTHOR_COLUMNS`, `lib/data/books.ts:435`). Remove the denormalised write; read `book.author.pen_name`. `app/(consumer)/genres/[genre]/page.tsx:78` already falls back correctly and is the pattern to follow. |
| **Follow-up owner** | Engineering |
| **Launch impact** | Medium — affects author-scoped creation, not the admin path used for the launch catalog. |

### D-05 `books.metadata` (JSONB)

| | |
| --- | --- |
| **Referenced at** | `lib/actions/books.ts:155` (INSERT `metadata: validated.metadata \|\| {}`) · `types/books.ts:36` + the `BookMetadata` interface at `types/books.ts:52–58` (chapters, reading time, maturity rating, content warnings, accessibility features) |
| **Evidence** | `grep -rn "metadata" supabase/migrations/` returns 10 files, **none of which add a `metadata` column to `books`**. `profiles.preferences` is JSONB (`...initial_schema.sql:16`); that is a different table and a different name. |
| **Impact** | `createBook` fails on insert. |
| **Disposition** | **DEFER — remove from code now, pending a post-3.6 forward migration.** `BookMetadata` describes real editorial needs (accessibility features in particular — CCR-019 covers accessibility of critical states). Remove the write; keep the TypeScript interface as the specification for the eventual column. |
| **Follow-up owner** | Engineering (removal) → Database Owner (post-3.6) |
| **Launch impact** | Low for launch scope; **accessibility metadata should be revisited** post-3.6. |

### D-06 `books.tags` (TEXT[])

| | |
| --- | --- |
| **Referenced at** | `lib/actions/books.ts:89` (Mongo branch — **valid there**), `:156` (Supabase INSERT — **invalid**), `:217`, `:813` (raw SQL `$N = ANY(tags)`) · `types/books.ts:37` |
| **Evidence** | `grep -rn "tags" supabase/migrations/` → **0 matches.** |
| **Impact** | Supabase-branch create/update fails. **Note the asymmetry:** Mongo `Book` *does* have `tags` (`types/mongo.ts:57`, written at `lib/mongo-books.ts:94`), so tags work on the Mongo path and fail on the Supabase path. |
| **Disposition** | **REMAP to `books.subgenres`** (TEXT[], `...initial_schema.sql:49`) — the real array column that serves the same purpose — **or DEFER** by removing the Supabase-branch write and keeping tags Mongo-only. Given MongoDB is the production catalog store (ADR §2), **keeping tags Mongo-only is the lower-risk choice**; remove the Supabase write, keep `lib/mongo-books.ts:94`. |
| **Follow-up owner** | Engineering |
| **Launch impact** | Low — tags are not a launch-catalog requirement. |

### D-07 `books.categories` (TEXT[])

| | |
| --- | --- |
| **Referenced at** | `lib/actions/books.ts:157` (INSERT), `:807` (raw SQL `$N = ANY(categories)`) · `types/books.ts:38, :66, :119` |
| **Evidence** | `grep -rn "categories" supabase/migrations/` → **0 matches.** No Mongo equivalent either. |
| **Impact** | `createBook` fails on insert; the category search filter is dead code. |
| **Disposition** | **REMOVE.** `books.genre` (NOT NULL) plus `books.subgenres` already cover taxonomy, and `content_type` covers the book/comic/paper axis. A third taxonomy is unjustified. |
| **Follow-up owner** | Engineering |
| **Launch impact** | None. |

### D-08 `books.view_count` and `books.download_count`

| | |
| --- | --- |
| **Referenced at** | `lib/actions/books.ts:873` — `.select('view_count, download_count, average_rating, review_count')` in `getBookStats` · `types/books.ts:30, :31` · `types/index.ts:238` |
| **Evidence** | `grep -rn "view_count" supabase/migrations/` matches only `review_count` (`20260122000000_social_features.sql:143`) and the `get_book_review_count` function. `grep -rn "download_count" supabase/migrations/` → **0 matches.** |
| **Impact** | `getBookStats` names both columns explicitly, so the whole select fails — **book stats never load**. |
| **Disposition** | **REMAP `view_count` → `books.total_reads`** (INTEGER, `...initial_schema.sql:56` — the real counter). **REMOVE `download_count`** — with no on-site reader at launch there are no tracked downloads, and no store records them. |
| **Follow-up owner** | Engineering |
| **Launch impact** | Low — admin stats display only. |

### D-09 `books.manuscript_url`

| | |
| --- | --- |
| **Referenced at** | `app/api/files/[id]/route.ts:59` (`.select('manuscript_url, author_id')` on the **Supabase branch**), `:63`, `:122`, `:138` · `lib/actions/books.ts:87` (Mongo branch — valid) · `lib/data/books.ts:447` (Mongo branch — valid) · `types/books.ts:28` |
| **Evidence** | `grep -rn "manuscript_url" supabase/migrations/` → **0 matches.** Mongo `Book` **does** have `manuscript_url` (`types/mongo.ts:50`, written `lib/mongo-books.ts:87`). |
| **Impact** | Gated file download works under Mongo-primary (**production**) and fails on the Supabase branch. `app/api/files/[id]/route.ts:45–53` correctly branches; only the Supabase half is broken. |
| **Disposition** | **REMAP the Supabase branch to `manuscripts.file_url`** — the real manuscript store is the `manuscripts` table (`...initial_schema.sql:143`), linked to books by `20260724000003_add_manuscript_book_link.sql`. Alternatively **DEFER** the Supabase branch, since production is Mongo-primary. |
| **Follow-up owner** | Engineering |
| **Launch impact** | Low — production path works. Becomes a **blocker if Option B rollback is ever exercised** (ADR §7). |

### D-10 `books.language`, `books.seo_title`, `books.seo_description` *(additional drift, not in the original brief)*

| | |
| --- | --- |
| **Referenced at** | `types/books.ts:19` (`language: string` — **required**), `:42`, `:43` · `lib/actions/books.ts:795` (raw SQL `AND language = $N`) |
| **Evidence** | `grep -rn "language" supabase/migrations/` matches only `$$ language 'plpgsql';` function declarations. `seo_title` / `seo_description` → **0 matches.** |
| **Impact** | The `language` search filter is dead. `Book.language` being a **required** TypeScript field on a column that does not exist means the type does not describe any real row. |
| **Disposition** | **REMOVE** `seo_title` / `seo_description` (Next.js metadata is generated from `title`/`description`). **DEFER** `language` — remove the filter, keep the concept for post-3.6. |
| **Follow-up owner** | Engineering |
| **Launch impact** | None — single-language launch catalog. |

### D-11 Table `book_view_cache`

| | |
| --- | --- |
| **Referenced at** | `lib/actions/books.ts:907` (`.from('book_view_cache').select('last_viewed')`), `:921` (`.upsert(...)`) |
| **Evidence** | `grep -rn "book_view_cache" supabase/migrations/` → **0 matches.** No `CREATE TABLE` anywhere. |
| **Impact** | `incrementViewCount` fails — **silently**. The function catches and swallows errors (`lib/actions/books.ts:941–945`, comment: *"Don't fail the request if view counting fails"*). View counting has never worked and nothing reported it. |
| **Disposition** | **REMOVE.** The whole `incrementViewCount` function targets three objects that do not exist (D-11, D-12, D-13). Delete it and its call sites; view counting is out of launch scope. |
| **Follow-up owner** | Engineering |
| **Launch impact** | None functionally. ⚠️ **Governance impact:** any homepage or admin statistic sourced from view counts is a **false claim** and violates CCR-018 / gate **G6** (P0-014, issue #204). Verify no surface reads these numbers. |

### D-12 Table `book_views`

| | |
| --- | --- |
| **Referenced at** | `lib/actions/books.ts:930` (`.from('book_views').insert({ book_id, user_id, viewed_at, ip_address, user_agent })`) |
| **Evidence** | `grep -rn "book_views" supabase/migrations/` → **0 matches.** |
| **Impact** | Same silent failure as D-11. |
| **Disposition** | **REMAP to `analytics_events`** (`supabase/migrations/20260117000000_analytics_events.sql`, partitioned) **or REMOVE** with D-11. **Prefer REMOVE** — the analytics pipeline (`lib/services/analytics-tracker.ts`, `app/api/analytics/track/route.ts`) already exists and is the canonical event path; a second one is drift by construction. ⚠️ Note this row would have written `ip_address` and `user_agent`, which is a **CCR-015 PII-minimisation concern** — another reason to remove rather than remap. |
| **Follow-up owner** | Engineering |
| **Launch impact** | None. |

### D-13 RPC `books_search`

| | |
| --- | --- |
| **Referenced at** | `lib/actions/books.ts:825` — `await supabase.rpc('books_search', { search_query: query, ...filters })` |
| **Evidence** | `grep -rn "books_search" supabase/migrations/` → **1 match: `20260116000000_initial_schema.sql:252`**, which is `CREATE INDEX idx_books_search ON books USING GIN(search_vector);` — **a GIN index, not a function.** There is no `CREATE FUNCTION books_search` in any migration. |
| **Impact** | `searchBooks` always throws and returns `{ success: false, code: 'UNKNOWN_ERROR' }`. **Author-facing search is entirely non-functional.** |
| **Additional defect** | `searchBooks` builds ~45 lines of parameterised SQL (`lib/actions/books.ts:780–823`) and then **discards it**, calling the RPC instead. The `sqlQuery` and `params` variables are constructed and never used. Any reviewer reading the function will believe it does something it does not. |
| **Disposition** | **REMOVE the RPC call and the dead SQL builder.** Replace with a PostgREST query using the existing `search_vector` GIN index via `.textSearch('search_vector', query)`, **or** route search through the provider-aware `lib/data/books.ts` layer. Note that **`search_vector` is Supabase-only** — Mongo has no equivalent (see `DATA_OWNERSHIP_MATRIX.md` §3), so a provider-aware search needs a Mongo implementation too. |
| **Follow-up owner** | Engineering |
| **Launch impact** | **Medium.** `docs/NEXT_GO.md` §7 lists "Catalog/browse/search" as **Launch-in-MVP**. If any launch-scope search surface calls `searchBooks`, this is a launch blocker; if the storefront search uses `listPublishedBooks` filters instead, it is not. **Requires verification before G6/G10 sign-off.** |

### D-14 RPC `increment_view_count` *(additional drift, not in the original brief)*

| | |
| --- | --- |
| **Referenced at** | `lib/actions/books.ts:918` — `supabase.rpc('increment_view_count', { book_id: bookId })` |
| **Evidence** | `grep -rn "increment_view_count" supabase/migrations/` → **0 matches.** |
| **Impact** | Same silent failure as D-11/D-12. |
| **Disposition** | **REMOVE** with D-11 and D-12. |
| **Follow-up owner** | Engineering |
| **Launch impact** | None. |

---

## 2. `audit_logs` — column drift and two parallel systems

### 2.1 The real table

`supabase/migrations/20260118000000_critical_fixes.sql:382–393`:

```sql
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id),
    action TEXT NOT NULL,
    table_name TEXT,
    record_id UUID,
    old_data JSONB,
    new_data JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

RLS is enabled at `:401`. The **only** policy is `"Admins can view audit logs"` — `FOR SELECT`
(`:403–405`). **There is no INSERT policy.**

### 2.2 D-15 — `audit_logs.resource_id` / `resource_type` / `details`

| | |
| --- | --- |
| **Referenced at** | `lib/actions/books.ts:65–67` (`logAudit` INSERT) · `lib/audit.ts:49–52` (`recordAudit` Supabase branch) |
| **Evidence** | None of `resource_id`, `resource_type`, `details` appear in the `CREATE TABLE audit_logs` block or in any `ALTER TABLE audit_logs`. The real analogues are `record_id`, `table_name`, and `new_data`/`old_data`. |
| **Impact** | **Every Supabase-branch audit write fails.** `recordAudit` returns `{ ok: false, error }` (`lib/audit.ts:55–57`); callers in `app/admin/actions.ts` **do not check the return value** (`:63`, `:98`, `:127`), so the failure is invisible. |
| **Disposition** | **REMAP:** `resource_id` → `record_id`, `resource_type` → `table_name`, `details` → `new_data`. All three targets exist and have compatible types (`record_id` is UUID — confirm callers pass a UUID, not a Mongo ObjectId string). |
| **Follow-up owner** | Engineering |

### 2.3 D-16 — missing INSERT RLS policy on `audit_logs`

| | |
| --- | --- |
| **Evidence** | `grep -n "audit_logs" supabase/migrations/*.sql` → table + 4 indexes + `ENABLE ROW LEVEL SECURITY` + **one SELECT policy only**. |
| **Impact** | With RLS enabled and no INSERT policy, **any non-service-role insert is denied**. `recordAudit` uses the service-role client (`lib/audit.ts:45`) and therefore bypasses RLS — so it would work *if* D-15 were fixed. `logAudit` uses the **session** client (`lib/actions/books.ts:52, :62`) and is **denied by RLS even after D-15 is fixed**. |
| **Disposition** | **REMAP to the service-role client** — do not add a policy (that would need a migration, which is blocked). `lib/audit.ts` already demonstrates the correct pattern. |
| **Follow-up owner** | Engineering |

### 2.4 D-17 — two parallel audit systems

| | `logAudit` | `recordAudit` |
| --- | --- | --- |
| **File** | `lib/actions/books.ts:51–71` | `lib/audit.ts:17–63` |
| **Client** | Session client (RLS-bound) ❌ | Service-role client ✅ |
| **Provider-aware** | ❌ No — Supabase only | ✅ Yes (`lib/audit.ts:33`) |
| **Mongo shape** | n/a | `actor_id, action, target, metadata, created_at` |
| **Supabase columns written** | `user_id, action, resource_id, resource_type, details, ip_address, user_agent` | `user_id, action, resource_id, resource_type, details, created_at` |
| **Error handling** | Unhandled — awaited, throws propagate into the action's `catch` | Returns `{ ok, error }`; **callers ignore it** |
| **Callers** | `lib/actions/books.ts:165, :297, :456, :572, :638, :693` (6) | `app/admin/actions.ts:63, :98, :127` (3) |

**Impact:** book mutations are audited by one broken system and admin mutations by another
half-broken one. **`docs/NEXT_GO.md` §8 rule 5 and CCR-002 require append-only evidence**, and the
locked launch rule is that **all lifecycle transitions are audited** (`docs/BOOK_LIFECYCLE.md`).
Neither system currently satisfies that on the Supabase path; only `recordAudit`'s Mongo branch works
end-to-end — and Mongo is production, so **admin status changes are audited in production while book
CRUD is not**.

| | |
| --- | --- |
| **Disposition** | **REMOVE `logAudit` entirely; REMAP all six call sites to `recordAudit`.** `recordAudit` is provider-aware, uses the correct client, and already has test coverage (`tests/unit/audit.test.ts`). Apply D-15's column remap inside `recordAudit`. Additionally: **callers must check the returned `{ ok }`** — a silently-dropped audit record is an evidence-integrity failure, not a cosmetic one. |
| **Follow-up owner** | Engineering (implementation) · Release Manager (accepts that pre-fix audit history is incomplete) |
| **Launch impact** | **High.** Audit completeness is a stated lifecycle requirement and underpins gate evidence. |

---

## 3. Summary

| ID | Object | Disposition | Launch impact | Owner |
| --- | --- | --- | --- | --- |
| D-01 | `books.subtitle` | DEFER (remove now, post-3.6 migration) | Medium — breaks admin edit page | Engineering → Database Owner |
| D-02 | `books.epub_url` | REMAP → `book_content.epub_url` (⚠️ no writer exists) | Medium — **needs Renee's scope call** | Engineering |
| D-03 | `books.deleted_at` | REMAP → `status='archived'` | **High** — breaks archive lifecycle | Engineering |
| D-04 | `books.author_name` | REMAP → joined `authors.pen_name` | Medium | Engineering |
| D-05 | `books.metadata` | DEFER (remove now, post-3.6) | Low | Engineering → Database Owner |
| D-06 | `books.tags` | REMAP → `subgenres`, or keep Mongo-only | Low | Engineering |
| D-07 | `books.categories` | REMOVE | None | Engineering |
| D-08 | `view_count` / `download_count` | REMAP → `total_reads` / REMOVE | Low | Engineering |
| D-09 | `books.manuscript_url` | REMAP → `manuscripts` table (Supabase branch only) | Low (prod OK) | Engineering |
| D-10 | `language`, `seo_title`, `seo_description` | REMOVE / DEFER | None | Engineering |
| D-11 | `book_view_cache` | REMOVE | None (⚠️ G6 if surfaced) | Engineering |
| D-12 | `book_views` | REMOVE | None | Engineering |
| D-13 | RPC `books_search` | REMOVE + reimplement | **Medium — verify vs launch search scope** | Engineering |
| D-14 | RPC `increment_view_count` | REMOVE | None | Engineering |
| D-15 | `audit_logs` columns | REMAP → `record_id` / `table_name` / `new_data` | High | Engineering |
| D-16 | `audit_logs` INSERT RLS | REMAP → service-role client | High | Engineering |
| D-17 | Two audit systems | REMOVE `logAudit`, consolidate on `recordAudit` | **High** | Engineering + Release Manager |

## 4. Decisions that require Renee

1. **D-02 scope:** build a `book_content` write path, or accept out-of-band EPUB attachment for a
   3–6 book launch.
2. **D-13 launch-scope check:** is any launch-scope search surface calling `searchBooks`? If yes, its
   removal/reimplementation is a launch blocker under the "catalog/browse/search" MVP class.
3. **D-17 acceptance:** audit history prior to consolidation is incomplete. This must be recorded as
   a known evidence gap in `docs/OPERATOR_QA_LOG.md`, not quietly fixed.
4. **Post-3.6 forward-migration list:** `subtitle`, `metadata`, `language` are deferred, not
   cancelled. They need a place on the post-launch schema backlog or they will be lost.
5. **D-11 verification:** confirm no public or admin surface displays a view/download count sourced
   from these dead paths — a displayed zero-or-stale count is a G6 false-claim defect.
