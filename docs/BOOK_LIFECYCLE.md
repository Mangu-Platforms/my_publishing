# Book Lifecycle

> **Task 2.0.** Verified against `audit/2026-07-28-fixes` @ `8e6fa50`.
> Depends on `docs/architecture/ADR-003-catalog-and-identity-data-ownership.md`.
> Operator procedure lives in `docs/BOOK_PUBLISHING_RUNBOOK.md`.
> Subordinate to `docs/NEXT_GO.md` (CCR-001).

## 0. Scope and honesty note

This document describes the lifecycle **as the repository actually implements it**, and marks every
place where the implementation is inconsistent or where the target state is not yet built. It is not
a wish list. Where a rule is aspirational it is labelled **TARGET**; where the code already enforces
it, **ENFORCED**.

Several rules below cannot be satisfied until the fixes in
`docs/architecture/SCHEMA_DRIFT_DISPOSITIONS.md` and the Option A work in ADR-001 land. Those
dependencies are called out inline.

---

## 1. Supported states

| State | Stored `status` | Public? | Meaning |
| --- | --- | --- | --- |
| **Draft** | `draft` | No | Work in progress. Metadata may be incomplete. Never reachable by the public. |
| **Ready for review** | ⚠️ **no dedicated state — see §1.1** | No | Editorially complete, awaiting approval. |
| **Published** | `published` | Yes (with `visibility='public'`) | Live on the storefront. |
| **Unpublished / Archived** | `archived` | No | Was live, deliberately removed from public view. **Not deleted.** |

### 1.1 "Ready for review" — repository reality

The Supabase `books.status` CHECK constraint
(`supabase/migrations/20260116000000_initial_schema.sql:51`) permits **six** values:

```
draft, submitted, review, accepted, published, archived
```

So `submitted`, `review` and `accepted` **exist in the database** and would be the natural home for
"Ready for review". But:

- The MongoDB `BookStatus` type — and **MongoDB is the production catalog store** — permits only
  **three**: `draft | published | archived` (`types/mongo.ts:14`).
- No admin UI exposes `submitted`, `review` or `accepted` for books.

**Therefore "Ready for review" is not a supported book state at launch.** A book is either Draft,
Published, or Archived. Editorial review happens on the **manuscript** entity
(`manuscripts` + `manuscript_status_history` + `manuscript_reviews`,
`supabase/migrations/20260724000000`–`20260724000006`), which has its own workflow with
`accepted`/`rejected` (`app/admin/actions.ts:106–134`). Review-before-publish is a *manuscript*
concern; a book row is created after that.

If a book-level review state is wanted later it must be added to the Mongo type first, and that is a
new decision — not something to infer from the Supabase CHECK constraint.

### 1.2 ⚠️ Four conflicting `BookStatus` definitions

| File | Definition |
| --- | --- |
| `app/admin/actions.ts:9` | `'draft' \| 'published'` |
| `types/books.ts:3` | `'draft' \| 'published' \| 'archived'` |
| `types/index.ts:155` | `'draft' \| 'published' \| 'archived'` |
| `types/mongo.ts:14` | `'draft' \| 'published' \| 'archived'` |
| `types/database.ts:626` | `'draft' \| 'submitted' \| 'review' \| 'accepted' \| 'published' \| 'archived'` |
| Supabase CHECK | `draft, submitted, review, accepted, published, archived` |

TypeScript will not catch a status bug here, because every file is internally consistent with a
*different* domain. **Follow-up: Engineering to consolidate on a single exported type.**

---

## 2. ⚠️ The archived-status inconsistency (known defect)

**`updateBookStatusAction` cannot set `archived`. The admin edit form offers it.**

| Surface | File | Accepted statuses |
| --- | --- | --- |
| Admin list Publish/Unpublish button | `app/admin/books/page.tsx:113–121` → `app/admin/actions.ts:42` | **`draft` \| `published` only** — guard at `app/admin/actions.ts:48`: `if (!id \|\| !['draft', 'published'].includes(status)) return;` |
| Admin **edit form** status dropdown | `app/admin/books/[id]/edit/BookEditForm.tsx:223–225` | `draft` \| `published` \| **`archived`** |
| Admin edit form submit handler | `app/admin/books/[id]/edit/BookEditForm.tsx:85` | casts to `'draft' \| 'published' \| 'archived'` |
| `updateBookAdmin` action | `lib/actions/books.ts:345` | `draft` \| `published` \| `archived` |
| Admin **create form** | `app/admin/books/new/BookCreateForm.tsx:172–173` | `draft` \| `published` |
| `createBookAdmin` action | `lib/actions/books.ts:490` | `draft` \| `published` |

**Consequences:**

1. Archiving is possible **only** through the edit form (`updateBookAdmin`), never through the list's
   Publish/Unpublish toggle. The toggle silently unpublishes to `draft` instead of `archived` —
   `app/admin/books/page.tsx:118` computes `book.status === 'published' ? 'draft' : 'published'`.
2. `updateBookStatusAction` **returns silently on an invalid status** (`app/admin/actions.ts:49`
   is a bare `return;`). An operator who somehow submits `archived` gets **no error and no change** —
   the UI will appear to have worked. This violates CCR-006 (no false success) and gate **G6**.
3. Once a book is `archived`, the list toggle can flip it back to `published` (since the guard only
   validates the *incoming* status, not the current one) — so archive is reachable one way but not
   the other, through two different screens.
4. `deleteBook`/`restoreBook` (`lib/actions/books.ts:594`, `:656`) implement a *second*, parallel
   "remove from view" mechanism using `deleted_at` — **a column that exists in no migration**
   (drift D-03). Soft delete is entirely non-functional today.

**Disposition:** unify on `archived` as the single unpublish target; widen the
`updateBookStatusAction` guard; make the invalid-status path return a visible error; remove the
`deleted_at` mechanism per drift D-03. **Owner: Engineering.**
**This is a launch blocker for the Unpublish transition** and must be fixed before G10 QA of the
admin console.

---

## 3. Derived visibility (from ADR-001 §2.1)

The public catalog requires **both** `status='published'` **and** `visibility='public'`, enforced in
every public read path (e.g. `lib/data/books.ts:122–123, 195–196, 493–494`). The admin UI exposes
**status only** — there is no visibility control anywhere in the admin forms.

**Rule: visibility is derived from status. It is never independently authored.**

| `status` | Derived `visibility` |
| --- | --- |
| `published` | `public` |
| `draft` | `private` |
| `archived` | `private` |

Every provider-aware write path must set `visibility` from `status` **in the same operation**.

⚠️ **Current gap:** none of the three admin write paths set `visibility` at all
(`lib/actions/books.ts:553–567`, `:400–450`; `app/admin/actions.ts:53–60`). They rely on the Supabase
column default `'public'` (`...initial_schema.sql:52`). **A draft created through the admin UI is
therefore stored with `visibility='public'`** and is kept off the storefront only by the `status`
filter. That is a single point of failure protecting unpublished work. Fixing it is part of the
Option A implementation.

⚠️ **`'unlisted'`** exists in `types/mongo.ts:15` but is **not permitted** by the Supabase CHECK
constraint. Do not use it.

---

## 4. Lifecycle rules

| # | Rule | Status |
| --- | --- | --- |
| R1 | **Drafts are never public.** No draft is reachable by URL, API, sitemap, search, or feed. | **ENFORCED** on the read side — `fetchBookForApi` filters `status='published' AND visibility='public'` on both branches (`lib/data/books.ts:429, :493–494`). This was a real leak fixed in PR #350. ⚠️ Weakened on the write side by the §3 default-visibility gap. |
| R2 | **Publish validates required metadata and assets** (§6). | **TARGET** — no validation exists on the publish transition today. `updateBookStatusAction` performs **no** metadata checks (`app/admin/actions.ts:42–68`). Currently a **manual gate** enforced by `docs/BOOK_PUBLISHING_RUNBOOK.md`. |
| R3 | **Unpublish removes visibility without deleting.** Row, slug, assets, orders and entitlements all survive. | **PARTIALLY ENFORCED** — `archived` does this correctly; but see §2, and see R7. |
| R4 | **Slugs are stable unless deliberately changed.** The slug is the public URL contract. | **PARTIALLY ENFORCED** — slug is auto-derived from title on create (`lib/actions/books.ts:530–533`) and uniqueness-checked (`:542`), but `updateBookAdmin` accepts a slug change with **no redirect and no warning**. ⚠️ Duplicate slugs already exist in seeded data (`lib/data/books.ts:483–486`). |
| R5 | **All transitions are audited.** Actor, timestamp, from-state, to-state. | ⚠️ **BROKEN** — see `SCHEMA_DRIFT_DISPOSITIONS.md` D-15/D-16/D-17. `updateBookStatusAction` calls `recordAudit` (`app/admin/actions.ts:63`) but **ignores its return value**, and the Supabase branch writes columns that do not exist. Only the Mongo branch actually records. |
| R6 | **Every public book has a resolvable author.** | **TARGET** — `author_id` is nullable and `createBookAdmin` explicitly permits `null` (`lib/actions/books.ts:557`). Manual gate. |
| R7 | **Unpublishing must not destroy the publication date.** | ⚠️ **VIOLATED** — `app/admin/actions.ts:57` sets `published_at: status === 'published' ? new Date().toISOString() : null`. **Unpublishing NULLs `published_at`**, and re-publishing writes a *new* date. The original publication date is permanently lost, and `fetchBookForApi` orders by `published_at` (`lib/data/books.ts:497`). Fix: set `published_at` only on the *first* transition to `published`; never null it. |
| R8 | **Launch catalog contains only real, approved books.** All QA/seed content removed. | **TARGET** — tracked in `docs/launch/LAUNCH_CATALOG.md`. Seed content is known to exist. |

---

## 5. State transition table

**Authorization model.** Two distinct admin gates exist, both reading `profiles.role === 'admin'`:

- `requireAdminForAction()` — `app/admin/actions.ts:13–35`; session client.
- Inline role check — `lib/actions/books.ts:369–376` (update) and `:501–511` (create); session client
  for the check, then a **service-role client** for the write, because there is no admin UPDATE RLS
  policy on `books` (comment at `lib/actions/books.ts:381–382`).

Author-scoped `createBook`/`updateBook` (`lib/actions/books.ts:73`, `:196`) are additionally bounded
by `author_id = auth.uid()` under RLS. Rate limiting applies at 10 requests/minute per
`(user, action)` (`lib/actions/books.ts:24–48`).

| # | From | To | Trigger (file) | Authorization | Validation enforced today | Validation required (TARGET) | Side effects |
| --- | --- | --- | --- | --- | --- | --- | --- |
| T1 | — | **Draft** | `createBookAdmin` (`lib/actions/books.ts:484`) | admin (`:501–511`) + rate limit | Title non-empty (`:522`); genre non-empty (`:525`); slug derivable (`:535`); slug unique (`:542`) | — | `published_at=null` (`:566`); revalidate `/admin/books`, `/books`, tag `featured-books` (`:578–581`) |
| T1a | — | **Draft** | `createBook` (author-scoped, `lib/actions/books.ts:73`) | authenticated author, RLS-bound | Zod `CreateBookSchema`; slug unique per author | — | ⚠️ Supabase branch fails on drift D-04/D-05/D-06/D-07 |
| T2 | Draft | Draft | `updateBookAdmin` (`lib/actions/books.ts:333`) | admin + rate limit | Book exists (`:391`); not soft-deleted (`:394`) ⚠️ D-03 | Slug change → confirm intent | Revalidate |
| T3 | **Draft → Published** | | List toggle → `updateBookStatusAction` (`app/admin/actions.ts:42`); or edit form → `updateBookAdmin` | admin | ⚠️ **None** | **Full publish checklist §6** | Sets `published_at=now()` (`app/admin/actions.ts:57`); **must** set `visibility='public'` (§3 — not implemented); audit (⚠️ R5); revalidate |
| T4 | **Published → Draft** ("Unpublish" button) | | `updateBookStatusAction` | admin | ⚠️ None | Confirm; capture reason for audit | ⚠️ **Nulls `published_at`** (R7); removes from public catalog; **orders and entitlements survive** |
| T5 | **Published → Archived** | | Edit form only → `updateBookAdmin` | admin | ⚠️ None | Confirm; reason; verify no active promotion links | Removes from public catalog. ⚠️ Not reachable from the list toggle (§2) |
| T6 | **Archived → Published** (restore) | | List toggle, or edit form | admin | ⚠️ None | **Re-run the full publish checklist** — assets and retailer links may have rotted | Re-sets `published_at` ⚠️ (R7) |
| T7 | **Archived → Draft** | | Edit form only | admin | ⚠️ None | — | — |
| T8 | Any → **Hard delete** | | `deleteBook(bookId, hardDelete=true)` (`lib/actions/books.ts:594`) | admin/author | ⚠️ None | 🚫 **Prohibited at launch** | `.delete()` at `:624`. **Cascades to `book_content` and `order_items` via ON DELETE CASCADE** — destroys purchase records. See §7 |
| T9 | Any → **Soft delete** | | `deleteBook(hardDelete=false)` (`:630`) | admin/author | — | 🚫 **Non-functional** | Writes `deleted_at` — **column does not exist** (D-03). Fails. |

**Transitions that must NOT exist:**

- Draft → public visibility without `status='published'` (§3).
- Any transition performed by a non-admin (or, for author-scoped paths, by a non-owner).
- Any transition that changes the slug of a book that has ever been published, without a redirect.

---

## 6. Publish validation checklist (rule R2)

**Currently a manual gate.** Nothing in the code enforces any of it — `updateBookStatusAction`
performs zero validation. Until validation is implemented, `docs/BOOK_PUBLISHING_RUNBOOK.md` is the
only control, and the per-book signoff is the only evidence.

**Required metadata**

| Field | Requirement | Store |
| --- | --- | --- |
| `title` | Non-empty, final | Both |
| `slug` | Unique, lowercase, hyphenated, final | Both |
| `description` | Non-empty, proofread | Both |
| `genre` | Non-empty, from the approved list | Both |
| `price` | Set deliberately (0 is valid but must be *chosen*) | Both |
| `author_id` | Resolves to a real author with a `pen_name` (R6) | Both |
| `content_type` | `book` \| `comic` \| `paper` | Both |
| `isbn` | Present if the book has one | Supabase; **Mongo after Task 2.0b** |

**Required assets**

| Asset | Requirement |
| --- | --- |
| Cover | Uploaded, correct specs (see runbook), `cover_url` resolves over HTTPS |
| Retailer links | At least one; `https://` only; destination verified to be *this* book |
| Audio sample | If the book has one: plays, correct book, ≤ the agreed length |
| EPUB | Attached for internal asset management. **No public "Start Reading" at launch.** |

⚠️ **Task 2.0b dependency:** under MongoDB primary, retailer URLs and audio are **not carried by the
read path** (`lib/data/books.ts:436–476`, `:466–467`). Until 2.0b lands, a book can pass this
checklist in the admin console and still render **without** retailer buttons or audio on the public
site. **Verification must be done on the live public page, not in the admin console.**

**Required derived state**

- `visibility='public'` (§3)
- `published_at` set (R7)

---

## 7. Deletion policy

**Hard delete is prohibited for any book that has ever been published.**

`deleteBook(bookId, hardDelete=true)` issues a real `.delete()` (`lib/actions/books.ts:624`). Because
`book_content.book_id` and `order_items.book_id` are declared `ON DELETE CASCADE`
(`...initial_schema.sql:77, :209`), a hard delete **destroys purchase records** — which are financial
records with long retention (`DATA_OWNERSHIP_MATRIX.md` §1.5) — and silently revokes every buyer's
entitlement.

**Policy:**

1. Never hard-delete a published or previously-published book. Use `archived`.
2. Hard delete of a never-published draft is acceptable but should be rare; prefer `archived`.
3. Hard delete requires Renee's explicit approval, recorded in `docs/OPERATOR_QA_LOG.md`.
4. Soft delete (`deleted_at`) is non-functional (D-03) and is being removed.

---

## 8. Audit requirements (rule R5)

Every transition in §5 must record: actor (auth user id), UTC timestamp, book id, from-status,
to-status, and reason where the transition is destructive (T4, T5, T8).

**Current state:** ⚠️ **not met.** `logAudit` (`lib/actions/books.ts:51`) writes three columns that
do not exist and uses an RLS-bound client with no INSERT policy. `recordAudit` (`lib/audit.ts:17`)
is provider-aware and works on the Mongo branch, but its Supabase branch writes the same nonexistent
columns, and its callers ignore the `{ ok, error }` return. Neither records from-status.

**Required fix** (see `SCHEMA_DRIFT_DISPOSITIONS.md` D-15/D-16/D-17): consolidate on `recordAudit`,
remap columns, check the return value, and include the previous status in `metadata`.

Until then, **the runbook's per-book signoff in `docs/OPERATOR_QA_LOG.md` is the audit trail of
record** for launch-catalog transitions.

---

## 9. Open items requiring Renee

1. **Approve the §2 unification** — `archived` as the single unpublish target, and widening the
   `updateBookStatusAction` guard.
2. **Accept or reject "Ready for review" being out of scope** for book status at launch (§1.1).
3. **Accept the R5 audit gap**: transitions performed before the D-17 fix are not reliably recorded.
   This must be logged as a known evidence gap, not silently backfilled.
4. **Confirm the deletion policy** (§7), in particular that hard delete requires her approval.
5. **Decide the R7 fix**: `published_at` should be set once and never nulled — confirm that
   re-publishing an archived book keeps the *original* publication date.
