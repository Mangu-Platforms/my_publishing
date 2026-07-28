# ADR-001 — Catalog and Identity Data Ownership

| Field | Value |
| --- | --- |
| **ID** | `docs/architecture/ADR-001-catalog-and-identity-data-ownership.md` |
| **Status** | PROPOSED — decision recorded, implementation in progress (Task 1.0 / Task 1.1) |
| **Date** | 2026-07-28 |
| **Deciders** | Release Manager / Solo Operator (Renee); Engineering |
| **Source task** | Task 1.1 (this document), resolving the Task 1.0 blocker |
| **Supersedes** | Nothing. **Complements** `docs/adr/ADR-001-canonical-platform.md` and `docs/adr/ADR-002-mongodb-data-platform.md`. |
| **Subordinate to** | `docs/NEXT_GO.md` (execution authority, CCR-001). Where this ADR conflicts with `docs/NEXT_GO.md`, `docs/NEXT_GO.md` wins. |

> ### ⚠️ Numbering collision — read this first
>
> The repository **already contains an ADR numbered 001**: `docs/adr/ADR-001-canonical-platform.md`
> (Status: **ACCEPTED (Option B — Vercel)**, signed 2026-07-18, tied to hard gate G9).
> That ADR decides the *hosting platform*. **This** document decides *data ownership* and lives in a
> different directory (`docs/architecture/`).
>
> Two live documents called "ADR-001" is a governance defect. It is filed here under the name the
> Task 1.1 brief specified so the work is not blocked, but **renumbering is a decision Renee must
> make** — see [§12 Open items requiring a human decision](#12-open-items-requiring-a-human-decision).
> Until then: cite platform decisions as **ADR-001 (canonical platform)** and data-ownership
> decisions as **ADR-001 (data ownership)**, never bare "ADR-001".

---

## 1. Context

MANGU Publishers runs on a **split-provider architecture** that was introduced incrementally by
"Project Phoenix" and never fully completed. The split is real, is live in production, and is the
direct cause of the launch blocker described below.

### 1.1 What is actually true in production today

| Concern | Provider in production | How it is switched |
| --- | --- | --- |
| Catalog **reads** (public site, `GET /api/books`) | **MongoDB** — `GET /api/books` returns `"provider":"mongodb"` | `DATABASE_PROVIDER=mongodb` |
| **Authentication / session** | **Supabase** | `AUTH_PROVIDER` defaults to `supabase` |
| Hosting / canonical origin | **Vercel** | ADR-001 (canonical platform), ACCEPTED Option B |
| Object storage | **Supabase Storage** (default) | `STORAGE_PROVIDER` defaults to `supabase` |

The provider switch is `isMongoPrimary()` in `lib/db/provider.ts`:

```ts
// lib/db/provider.ts
export function getDatabaseProvider(): DatabaseProvider {
  const raw = (process.env.DATABASE_PROVIDER || 'supabase').toLowerCase();
  if (raw === 'mongodb' || raw === 'mongo') return 'mongodb';
  return 'supabase';
}
export function isMongoPrimary(): boolean {
  return getDatabaseProvider() === 'mongodb';
}
```

The *code default* is `supabase`. **Production sets `DATABASE_PROVIDER=mongodb`.** Anyone reasoning
from the code default alone will reach the wrong conclusion about production behaviour. This is
itself a documentation hazard and is why this ADR exists.

Auth is switched separately by `lib/auth/provider.ts`, whose default (`supabase`) *is* the production
value. **The two switches are independent.** Data can be on Mongo while identity is on Supabase —
and that is exactly the current state.

### 1.2 The blocker (Task 1.0)

Read paths branch on the provider. **Admin write paths do not.**

| Path | File | Branches on `isMongoPrimary()`? |
| --- | --- | --- |
| `listPublishedBooks` | `lib/data/books.ts:107` | ✅ yes (`lib/data/books.ts:119`) |
| `fetchBookForApi` | `lib/data/books.ts:423` | ✅ yes (`lib/data/books.ts:427`) |
| `createBookForApi` | `lib/data/books.ts:781` | ✅ yes (`lib/data/books.ts:794`) |
| `createBook` (author-scoped) | `lib/actions/books.ts:73` | ✅ yes (`lib/actions/books.ts:75`) |
| `updateBook` (author-scoped) | `lib/actions/books.ts:196` | ✅ yes (`lib/actions/books.ts:198`) |
| **`updateBookAdmin`** | **`lib/actions/books.ts:333`** | ❌ **no** — service-role Supabase write |
| **`createBookAdmin`** | **`lib/actions/books.ts:484`** | ❌ **no** — service-role Supabase write |
| **`updateBookStatusAction`** | **`app/admin/actions.ts:42`** | ❌ **no** — service-role Supabase write |

Admin **read** paths have the same defect:

- `app/admin/books/[id]/edit/page.tsx:11` — `createClient()` from `@/lib/supabase/admin`, reads
  `books` directly, no provider branch.
- `app/admin/books/new/page.tsx:14` — same pattern, reads `authors` directly.

**Consequence:** a book created or published through the admin UI is written to Supabase, while the
public site reads MongoDB. **A book published through the admin UI can never appear on the public
site.** The admin UI also cannot see books that exist only in MongoDB. The two halves of the product
are looking at different databases.

This is not a latent risk. It is the current behaviour of the production admin console.

### 1.3 Why this must be decided rather than patched

Under a launch freeze (issue #209) with a NO-GO status and thirteen hard gates, an undocumented
split-brain data layer makes every catalog-related gate unverifiable: you cannot evidence "browse
`/books`" (QA row 7, gate G10) or "catalog/browse/search" launch scope if the source of truth for a
book depends on which code path last touched it.

---

## 2. Decision

> **Option A — make admin writes provider-aware.**

1. Add `isMongoPrimary()` branches to the three admin write paths
   (`createBookAdmin`, `updateBookAdmin`, `updateBookStatusAction`) so that under
   `DATABASE_PROVIDER=mongodb` they write to **MongoDB**, mirroring the already-correct
   `createBookForApi` in `lib/data/books.ts:781`.
2. Make the admin book **read** paths provider-aware
   (`app/admin/books/[id]/edit/page.tsx`, `app/admin/books/new/page.tsx`) so the admin console reads
   from the same store the public site reads from.
3. **MongoDB is the source of truth for the book catalog.** Supabase remains the source of truth for
   identity, entitlements, commerce, and reader engagement (see §3).
4. **Visibility is derived from status** (see §2.1).
5. Extend the Mongo `Book` model to carry the fields the catalog needs (Task 2.0b, see §4).

The provider switch stays. It is the migration mechanism. What changes is that **every** book path —
read and write, public and admin — must go through it.

### 2.1 Derived visibility rule (new, normative)

The public catalog requires **both** `status = 'published'` **and** `visibility = 'public'`. This is
enforced in every public read path (`lib/data/books.ts:122–123, 144–145, 195–196, 269, 308, 358–359,
399–400, 412–413, 429, 493–494, 512–513, 556, 582–583, 702–703, 753–754`).

The admin UI exposes **status only** — there is no visibility control in
`app/admin/books/[id]/edit/BookEditForm.tsx`. An admin can therefore set `status='published'` and
leave `visibility='private'`, producing a book that is "published" in the admin console and invisible
on the public site, with no UI affordance explaining why.

**Rule:** visibility is *derived*, never independently authored by an admin.

| `status` | Derived `visibility` |
| --- | --- |
| `published` | `public` |
| `draft` | `private` |
| `archived` | `private` |

Every provider-aware admin write path must set `visibility` from `status` in the same operation.
Visibility is not a separate editorial concept at launch; if it later becomes one (e.g. unlisted
preview links), that requires a new ADR.

> **Note:** `types/mongo.ts:15` defines `BookVisibility = 'public' | 'private' | 'unlisted'`, but the
> Supabase `books.visibility` CHECK constraint only permits `('public','private')`
> (`supabase/migrations/20260116000000_initial_schema.sql:52`). `'unlisted'` is a Mongo-only value
> with no Supabase equivalent. **Do not use `'unlisted'`** until the two are reconciled.

---

## 3. Responsibilities

### 3.1 MongoDB responsibilities (source of truth)

| Entity | Notes |
| --- | --- |
| **Book catalog records** | Title, slug, description, genre, price, currency, status, visibility, cover URL, content type, author reference, ratings aggregate, timestamps. Collection `books`; documents typed by `types/mongo.ts` `Book`. |
| Book retailer links | **After Task 2.0b** — the six retailer URL fields. Not present today. |
| Book audio sample metadata | **After Task 2.0b** — sample URL, chapter TOC, narrator, duration. Not present today. |
| Book trailer reference | **After Task 2.0b.** Not present today. |
| Author records | Collection `authors`, typed `Author` in `types/mongo.ts`. Denormalised pen name is joined onto book reads. |
| Reviews (dual-run) | Collection `reviews`; `lib/data/reviews.ts` branches on the switch. |
| Reading progress (dual-run) | Collection typed `ReadingProgress`; `lib/data/reading.ts` branches. |
| Orders (dual-run) | `Order` with **embedded** `order_items` — a Phoenix flatten, *not* a separate collection (contrast Supabase, which has a real `order_items` table). |
| Audit log (dual-run) | `recordAudit` writes `audit_logs` with `actor_id / action / target / metadata / created_at` (`lib/audit.ts:33–42`). |

**Identifier:** MongoDB `ObjectId` (`_id`), serialised to string at API boundaries
(`lib/data/books.ts:437`). `lib/mongo-books.ts:11` coerces a 24-hex string to `ObjectId` and
otherwise passes the value through, so slug-or-id lookups tolerate both shapes.

### 3.2 Supabase responsibilities (source of truth)

| Entity | Notes |
| --- | --- |
| **Identity / authentication** | `auth.users` — owned by Supabase Auth. Authoritative regardless of `DATABASE_PROVIDER`, because `AUTH_PROVIDER=supabase`. |
| **Profiles / roles** | `public.profiles` (`profiles.user_id` → `auth.users.id`; `profiles.id` is its own UUID). `role ∈ (reader, author, partner, admin)`. **The admin gate reads `profiles.role`** (`lib/actions/books.ts:369–376`). |
| **Entitlements / library** | `orders` + `order_items` (+ `subscriptions`). `order_items.license_key` is the entitlement token. |
| **Commerce** | `orders.payment_intent_id`, Stripe correlation. |
| Book content assets | `book_content` — `epub_url`, `pdf_url`, `audio_url`, `toc`. **`epub_url` lives here, not on `books`.** |
| Reading progress (default path) | `reading_progress`, `reading_sessions`. |
| Listening progress | `listening_progress` (`supabase/migrations/20260719042627_...`), composite PK `(user_id, book_id)`. **Supabase-only — no Mongo equivalent.** |
| Newsletter subscribers | `newsletter_subscribers` (`supabase/migrations/20260719042623_...`), double opt-in. **Supabase-only.** |
| Analytics | `analytics_events` (partitioned), `analytics_sessions`, `engagement_events`. **Supabase-only.** |
| Manuscripts / editorial | `manuscripts` + status history + reviews (`20260724000000`–`20260724000006`). **Supabase-only.** |
| Partners / ARC | `partners`, `arc_requests`. **Supabase-only.** |

**Identifier:** UUID (`gen_random_uuid()`).

### 3.3 Storage responsibilities

Object storage is Supabase Storage by default (`lib/storage/provider.ts`,
`STORAGE_PROVIDER=supabase|vercel-blob`). Buckets declared in
`supabase/migrations/20260117000006_storage_policies.sql:3–12`:

| Bucket | Public? | Size limit | MIME types |
| --- | --- | --- | --- |
| `book-covers` | **true** | 5 MB (5242880) | jpeg, png, webp, gif |
| `manuscripts` | false | 100 MB | pdf, doc, docx, txt |
| `published-epubs` | **true** | 50 MB | `application/epub+zip` |

> ⚠️ **`published-epubs` is declared `public = true`.** The locked launch decision is that EPUB is
> retained for internal asset management with **no on-site reader and no public "Start Reading"**.
> A publicly-readable EPUB bucket is inconsistent with that decision — anyone with the object URL can
> download the full book without purchasing. **This needs Renee's decision** (see §12).

Storage URLs are stored *in the database* as plain columns (`cover_url`, `book_content.epub_url`,
etc.). Therefore **flipping `STORAGE_PROVIDER` does not move existing objects or rewrite existing
URLs** — `lib/storage/provider.ts:5–6` says exactly this. A storage cutover is a data migration
(`npm run phoenix:migrate-storage`), not an env flip.

---

## 4. Task 2.0b — catalog field gaps under MongoDB primary

Under `DATABASE_PROVIDER=mongodb`, the catalog read path silently drops fields the public site needs.
Verified in the clone:

| Symptom | Location |
| --- | --- |
| `trailer_vimeo_id` hardcoded `null` | `lib/data/books.ts:466` |
| `audio_url` hardcoded `null` | `lib/data/books.ts:467` |
| All six retailer URL fields **omitted entirely** from the Mongo return object | `lib/data/books.ts:436–476` |
| `discount_price` hardcoded `null` | `lib/data/books.ts:443` |
| `listAudiobooks()` returns `[]` | `lib/data/books.ts:691–694` |
| `fetchAudiobookById()` returns `null` | `lib/data/books.ts:741–744` |

Root cause: the Mongo `Book` interface (`types/mongo.ts:43–62`) has no `isbn`, no `is_featured`, no
`trailer_vimeo_id`, no retailer URLs and no audio fields, and `lib/mongo-books.ts:81–99` never writes
them.

**Resolution (Task 2.0b, being implemented separately):** extend the Mongo `Book` model to carry the
six retailer URLs, an audio sample URL + chapter TOC + narrator + duration, `content_type`, `isbn`,
`is_featured`, and a trailer reference — then remove the hardcoded nulls.

Until 2.0b lands, **retailer links and audio samples cannot render in production**, because
production is Mongo-primary. This is a launch blocker for the "retailer URLs at launch" decision.

---

## 5. Rejected alternatives

### Option B — switch production catalog reads to Supabase (`DATABASE_PROVIDER=supabase`) — REJECTED

One environment variable, zero code. Rejected because:

1. It contradicts the locked architecture decision that MongoDB owns the catalog
   (`docs/adr/ADR-002-mongodb-data-platform.md`). Reversing it by env flip, without an ADR, is
   exactly the kind of undocumented drift this document exists to stop.
2. **The Supabase catalog may not hold current data.** Books written to Mongo since the cutover would
   vanish from the public site the moment the flag flipped. There is no verified reconciliation of
   the two catalogs. Flipping without reconciliation risks *losing* the live catalog, which is a
   worse failure than the current one.
3. It would require its own backfill (Mongo → Supabase) with the same effort as Option A's backfill,
   plus an ADR reversal.

Option B remains a legitimate **rollback lever** if Option A fails in production — but only after a
verified reconciliation. See §7.

### Option C — dual-write to both stores — REJECTED

Write every book to both Mongo and Supabase. Rejected because it **doubles the failure modes**: every
write has two ways to fail and no transactional boundary between them. Partial writes produce
divergence that is harder to detect than today's clean split, and it requires conflict-resolution
rules that nobody has specified. Dual-write is a migration technique with an owner and a
reconciliation job; it is not a launch fix under freeze.

---

## 6. Consequences

**Positive**

- The admin console and the public site read and write the same store. Publishing works.
- `GET /api/books` `"provider"` field stays honest and becomes a meaningful single indicator.
- The derived-visibility rule removes an entire class of "I published it but it isn't there" bugs.
- The provider switch becomes a genuine migration mechanism instead of a trap.

**Negative / accepted costs**

- Every book code path now has two branches to test. Mitigation: the dual-run unit tests
  (`tests/unit/data-catalog-dual-run.test.ts`, `tests/unit/data-admin-books-dual-run.test.ts`) already
  establish the pattern; new branches must extend them.
- Mongo has no RLS. Supabase authorization is partly enforced by RLS policies; on the Mongo path,
  **all** authorization is application-level. Every Mongo write path must perform its own role check
  before writing. `createBookAdmin`/`updateBookAdmin` already check `profiles.role` before the write
  and must keep doing so on both branches.
- Identity stays on Supabase while book data is on Mongo, so `author_id` on a Mongo book document is
  a **cross-system reference** with no referential integrity. See §9.
- Schema drift on the Supabase side (see `docs/architecture/SCHEMA_DRIFT_DISPOSITIONS.md`) is not
  fixed by this ADR; it is dispositioned separately and is constrained by the no-new-migrations rule.

**Neutral**

- Supabase remains fully deployed and load-bearing. This is not a Supabase decommissioning ADR.

---

## 7. Migration and backfill strategy

**Goal:** every book that should be on the public site exists in MongoDB with correct `status` and
derived `visibility`, and no book is silently lost.

Sequence — **steps 1–3 are read-only and safe to run under freeze**:

1. **Inventory both catalogs.** Export `id, slug, title, status, visibility, published_at, updated_at`
   from Supabase `books`, and the same fields from the Mongo `books` collection. Join on `slug`
   (the only identifier stable across stores — Supabase uses UUID, Mongo uses ObjectId).
2. **Classify.** Every book falls into exactly one bucket:
   - **Both, consistent** — no action.
   - **Both, divergent** — record field-level diff; the newer `updated_at` is *not* automatically
     the winner, because admin edits went only to Supabase. Needs human adjudication.
   - **Supabase-only** — the population created through the admin UI since the Mongo cutover. These
     are the books that "disappeared". Candidates for forward migration into Mongo.
   - **Mongo-only** — created via `createBookForApi` or `createBook`. Already live; leave in place.
   - **Slug collision** — `lib/data/books.ts:483–486` documents that duplicate slugs exist in seeded
     data ("the same QA book under two test authors"). These must be resolved before any join-based
     backfill, or the backfill will merge unrelated records.
3. **Publish the inventory** as an evidence artifact referenced from `docs/OPERATOR_QA_LOG.md`.
   Renee approves the disposition per book before anything is written.
4. **Forward-migrate approved Supabase-only books into Mongo**, setting `visibility` from `status`
   per §2.1. Preserve `slug` exactly — slugs are the public URL contract
   (`docs/BOOK_LIFECYCLE.md`).
5. **Do not delete from Supabase.** The Supabase rows are the rollback position for Option B. Leave
   them; they cost nothing and they are the only backup of pre-cutover editorial state.
6. **Re-verify** `GET /api/books` returns `"provider":"mongodb"` and the expected book count, and
   that each launch-approved book resolves at `/books/<slug>`.

**Scope note:** the launch catalog is 3–6 real approved books with all QA/seed content removed
(`docs/launch/LAUNCH_CATALOG.md`). The backfill therefore does not need to be exhaustive to unblock
launch — it needs to be *correct for the launch set* and *inventoried for everything else*. Removing
seed/QA books is part of this work, not separate from it.

**Rollback:** if Option A regresses production, set `DATABASE_PROVIDER=supabase` to fall back to the
Supabase catalog — but only if step 2 confirmed the Supabase catalog is current. If it is not, the
rollback is a *data* rollback, not an env flip. Record the decision either way per CCR-012.

---

## 8. Rules for future contributors

These are normative. A PR violating them should be rejected in review.

1. **Never add a book read or write path that does not branch on `isMongoPrimary()`.**
   If you are writing `.from('books')` against a Supabase client outside a provider branch, you have
   introduced the Task 1.0 bug again.
2. **Never set `visibility` independently of `status`.** Derive it (§2.1).
3. **Never add a Supabase migration** until hosted migration drift is reconciled (Task 3.6 / issue
   #192). Schema problems are fixed **code-side** — remove the reference or remap it to a canonical
   field. "Just add the column" is not available.
4. **Do not assume the code default is the production value.** `DATABASE_PROVIDER` defaults to
   `supabase` in code and is `mongodb` in production. Read `GET /api/books` `"provider"`, or the
   Vercel environment, before reasoning about production.
5. **Identity is Supabase, always** — regardless of `DATABASE_PROVIDER`. `AUTH_PROVIDER=better-auth`
   is not the production path.
6. **Authorize before you write on both branches.** Mongo has no RLS. A role check that only exists
   on the Supabase branch is not a role check.
7. **Cross-system references are strings, not foreign keys** (§9). Never assume a join will fail
   loudly; it will return `null`.
8. **New entity ⇒ new row in `docs/architecture/DATA_OWNERSHIP_MATRIX.md`** in the same PR.
9. **Use one audit function.** `recordAudit` (`lib/audit.ts`) is provider-aware; `logAudit`
   (`lib/actions/books.ts:51`) is not and writes columns that do not exist. Do not add callers to
   `logAudit`.
10. **No secrets in docs, evidence, logs, or screenshots** (CCR-009).

---

## 9. Allowed cross-system references

Because identity is Supabase and catalog is Mongo, some references necessarily cross a system
boundary. These are **allowed**, and carry no referential integrity — the database will not stop you
writing a dangling reference.

| Reference | From | To | Integrity |
| --- | --- | --- | --- |
| `books.author_id` (Mongo) | Mongo `books` | Mongo `authors` | Same store; app-enforced only |
| `authors.profile_id` (Mongo) | Mongo `authors` | Supabase `profiles` (or Mongo `profiles`) | **Cross-system. None.** |
| `orders.user_id` (Mongo) | Mongo `orders` | Supabase auth user | **Cross-system. None.** |
| `order_items.book_id` (Supabase) | Supabase `order_items` | Mongo `books` **when Mongo-primary** | **Cross-system. None.** |
| `reading_progress.book_id` (Supabase) | Supabase | Mongo `books` when Mongo-primary | **Cross-system. None.** |
| `listening_progress.book_id` (Supabase) | Supabase | Supabase `books` (FK exists) | FK enforced — **but the book may not exist in Mongo**, so a listener can have progress on a book the public site cannot show |
| `book_content.book_id` (Supabase) | Supabase | Supabase `books` (FK enforced) | FK enforced; same caveat |

**Rule:** any code dereferencing a cross-system reference must handle `null` as a normal outcome, not
an exception. Entitlement checks in particular must fail **closed** when the referenced book cannot
be resolved.

---

## 10. The Phoenix switch stack

Four independent switches, introduced by Project Phoenix, all defaulting to the pre-Phoenix provider.
**They are independent — flipping one does not flip the others.**

| Switch | File | Values | Code default | Production value | Authoritative? |
| --- | --- | --- | --- | --- | --- |
| `AUTH_PROVIDER` | `lib/auth/provider.ts` | `supabase` \| `better-auth` | `supabase` | **`supabase`** | ✅ **Yes — Supabase is the authoritative identity provider.** `better-auth` is not the launch path. |
| `DATABASE_PROVIDER` | `lib/db/provider.ts` | `mongodb` \| `supabase` | `supabase` | **`mongodb`** | ✅ **Yes — MongoDB is the authoritative catalog store.** Note code default ≠ production value. |
| `STORAGE_PROVIDER` | `lib/storage/provider.ts` | `supabase` \| `vercel-blob` | `supabase` | `supabase` | ✅ **Yes — Supabase Storage is authoritative.** `vercel-blob` requires `BLOB_READ_WRITE_TOKEN` (`lib/utils/env-validation.ts:222–234`) and a URL-rewriting data migration. |
| `MCP_ENABLED` | (see `docs/NEXT_GO.md` §route truth) | on/off | off | off | ✅ Fail-closed; `/api/mcp/[transport]` disabled unless explicitly `true` (P0-017). |

Supporting npm scripts (`package.json:30–35`) — **all are migration tooling, none are authoritative
runtime paths**, and none should be run during freeze without change-control approval:

| Script | Purpose |
| --- | --- |
| `phoenix:export` | `scripts/export-supabase.sh` — dump Supabase for migration |
| `phoenix:transform` | `scripts/transform-data.ts` — reshape Supabase rows into Mongo documents |
| `phoenix:migrate-storage` | `scripts/migrate-storage.ts` — move objects and rewrite stored URLs (required before `STORAGE_PROVIDER=vercel-blob` means anything) |
| `phoenix:verify` | `scripts/verify-migration.mongo.js` |
| `phoenix:forced-resets` | `scripts/send-forced-resets.ts` — password resets for an auth cutover |
| `phoenix:delta` | `scripts/export-delta.ts` — incremental re-export |

**Authoritative summary:** identity = Supabase, catalog = MongoDB, storage = Supabase Storage,
hosting = Vercel. Everything else in the Phoenix stack is tooling or a future option.

---

## 11. Vercel vs Cloud Run duality

The repository contains **both** `vercel.json` and `cloudbuild.yaml` (GCP Cloud Run). They describe
two different production deployments and they contradict each other.

**Vercel is authoritative.** This was decided in `docs/adr/ADR-001-canonical-platform.md`
(ACCEPTED Option B — Vercel, signed 2026-07-18) on the explicit operator instruction to "dump Cloud
Run… stick with Vercel".

`cloudbuild.yaml` and the `scripts/*gcp*` / `scripts/*cloudrun*` tooling are **documentation-only**.
They are retained as history and as rollback context; they are **not** a supported deploy path and
must not be used to produce launch evidence.

Two live consequences recorded in `docs/OPERATOR_QA_LOG.md` and `docs/NEXT_GO.md`:

- The apex domain historically resolved to **both** Google (`216.239.*`) and Vercel (`76.76.21.21`),
  producing intermittent TLS SAN failures (`curl` exit 60) on health checks. Phase 15 DNS cutover
  removes the Cloud Run records.
- **G9 stays FALSE** until Vercel production reaches `ready:true` and monitors are green on the
  canonical Vercel origin. The ADR signature satisfies only the *decision* half of G9.

**Rule:** do not add features, secrets, or CI wiring to the Cloud Run path. If `cloudbuild.yaml`
needs to change to keep CI green, that is a freeze-permitted CI wiring fix, not a re-adoption of
Cloud Run.

---

## 12. Open items requiring a human decision

These are **not** decided by this ADR. They need Renee.

1. **ADR numbering collision.** Two documents named ADR-001. Options: renumber this one (e.g.
   ADR-003, continuing the `docs/adr/` sequence), or formally split the namespaces
   (`docs/adr/` = platform, `docs/architecture/` = data) and always cite with a qualifier. Until
   decided, the collision stands.
2. **`published-epubs` bucket is public** (§3.3) while the launch decision is "no public EPUB
   access". Decide: make the bucket private and serve via signed URLs, or accept the exposure with a
   recorded residual risk.
3. **Backfill dispositions** for every Supabase-only and divergent book (§7 step 3) — per-book human
   approval before any write.
4. **Slug-collision resolution** for the seeded duplicate-slug books (§7 step 2).
5. **Option B rollback precondition:** whether the Supabase catalog is current enough to serve as a
   rollback target. Requires the §7 inventory before it can be answered.

---

## 13. References

| Document | Role |
| --- | --- |
| `docs/NEXT_GO.md` | Execution authority. Supersedes this document on conflict (CCR-001). |
| `docs/adr/ADR-001-canonical-platform.md` | Hosting decision (Vercel). Distinct ADR-001 — see collision note. |
| `docs/adr/ADR-002-mongodb-data-platform.md` | Mongo adoption. |
| `docs/architecture/DATA_OWNERSHIP_MATRIX.md` | Per-entity source of truth, read/write paths. |
| `docs/architecture/SCHEMA_DRIFT_DISPOSITIONS.md` | Nonexistent objects referenced by code, and their dispositions. |
| `docs/BOOK_LIFECYCLE.md` | States, transitions, derived visibility in practice. |
| `docs/BOOK_PUBLISHING_RUNBOOK.md` | Operator procedure. |
| `docs/OPERATOR_QA_LOG.md` | Append-only evidence sink (CCR-002). |
| Issue #209 | Launch freeze / change governance. |
| Issue #192 | Hosted migration reconciliation (P0-004), blocks new migrations. |
