# Data Ownership Matrix

> **Companion to** `docs/architecture/ADR-003-catalog-and-identity-data-ownership.md`.
> **Subordinate to** `docs/NEXT_GO.md` (CCR-001).
> Every read/write path below was verified by opening the file in the repository at
> `audit/2026-07-28-fixes` @ `8e6fa50`. Line numbers are from that commit.

## How to read this

- **Source of truth** — the store that wins if the two disagree. Where a path is *dual-run*, the
  effective store depends on `DATABASE_PROVIDER`; **production is `mongodb`**.
- **Read path / Write path** — the file that actually performs the query, not the caller.
- **Sensitivity** — `public` (safe to expose), `internal` (business data), `personal` (PII, subject
  to CCR-015 minimisation), `secret` (never in logs/evidence/docs, CCR-009).
- **Backup owner** — the human accountable for the backup existing and being restorable. Roles, not
  named individuals, except where the repo names a single operator.
- ⚠️ marks a row where the code contradicts the intended ownership. Each is dispositioned in
  `docs/architecture/SCHEMA_DRIFT_DISPOSITIONS.md` or in the ADR.

**Roles:** Release Manager / Solo Operator (Renee) · Engineering · Database Owner · QA ·
Platform. At time of writing several of these resolve to the same person; they are kept distinct
because the gate evidence requires distinct sign-off.

---

## 1. Entity matrix

### 1.1 Books (catalog)

| Field | Value |
| --- | --- |
| **Source of truth** | **MongoDB** `books` collection (production, `DATABASE_PROVIDER=mongodb`). Supabase `public.books` is the fallback store and the pre-cutover record. |
| **Read path (public)** | `lib/data/books.ts` — `listPublishedBooks` (:107, branch :119), `fetchBookForApi` (:423, branch :427), `listFeaturedBooks` (:262), `listTrendingBooks` (:301), `listBooksByGenreParam` (:340), `fetchPublishedBookForCheckout` (:548). Supabase branch goes through `lib/supabase/public-queries.ts` (`createPublicCatalogClient`, `PUBLIC_BOOK_SELECT`). |
| **Read path (API)** | `app/api/books/route.ts:46` → `listPublishedBooks`; provider echoed at `:50`. `app/api/books/[id]/route.ts`. |
| **Read path (admin)** | ⚠️ `app/admin/books/[id]/edit/page.tsx:11–18` and `app/admin/books/new/page.tsx:14–19` — **Supabase service-role client, no provider branch**. `lib/data/admin-books.ts:34` (`listAdminBooks`) *is* dual-run. |
| **Write path (author)** | `lib/actions/books.ts` — `createBook` (:73, branch :75), `updateBook` (:196, branch :198), `deleteBook` (:594), `restoreBook` (:656). |
| **Write path (admin)** | ⚠️ `lib/actions/books.ts` — `updateBookAdmin` (:333), `createBookAdmin` (:484); `app/admin/actions.ts` — `updateBookStatusAction` (:42). **All three write Supabase unconditionally via the service-role client.** This is the Task 1.0 blocker. |
| **Write path (API)** | `lib/data/books.ts:781` `createBookForApi` (branch :794) — correct reference implementation. |
| **Mongo mutation layer** | `lib/mongo-books.ts` — `createBookMongo` (:59), `updateBookMongo` (:104). |
| **Identifier** | Mongo `ObjectId` (`_id`), stringified at API boundaries (`lib/data/books.ts:437`). Supabase: UUID. **`slug` is the only identifier stable across both stores** and is the public URL contract. ⚠️ Duplicate slugs exist in seeded data (`lib/data/books.ts:483–486`). |
| **Retention** | Indefinite. Unpublish/archive is a status change, never a delete. Supabase rows retained as the Option B rollback position (ADR §7 step 5). |
| **Sensitivity** | `public` for published books; `internal` for drafts. Draft leakage is a security defect — PR #350 fixed exactly this in `fetchBookForApi`. |
| **Backup owner** | Database Owner (Mongo Atlas snapshots) + Database Owner (Supabase PITR). ⚠️ Neither is evidenced in-repo — see §4. |
| **Allowed cross-system refs** | `author_id` → `authors` (same store). Referenced *from* Supabase by `book_content.book_id`, `order_items.book_id`, `reading_progress.book_id`, `listening_progress.book_id` — all **cross-system with no integrity** when Mongo-primary. |

### 1.2 Book content and assets (EPUB / PDF / audio / TOC)

| Field | Value |
| --- | --- |
| **Source of truth** | **Supabase** `public.book_content` (`supabase/migrations/20260116000000_initial_schema.sql:75–86`). **No Mongo equivalent exists.** |
| **Read path** | `lib/supabase/public-queries.ts` (`PUBLIC_BOOK_WITH_CONTENT_SELECT`), consumed by `lib/data/books.ts` — `listAudiobooks` (:690), `fetchAudiobookById` (:738). ⚠️ Both return empty/`null` under Mongo-primary (`:691–694`, `:741–744`). |
| **Write path** | ⚠️ **No application write path exists in the repo.** `book_content` rows must be created out-of-band (SQL / Supabase console). `createBookAdmin` writes `epub_url` onto `books` instead — a column that does not exist (`lib/actions/books.ts:566`). |
| **Objects** | Supabase Storage buckets, declared `supabase/migrations/20260117000006_storage_policies.sql:3–12`: `book-covers` (public, 5 MB), `manuscripts` (private, 100 MB), `published-epubs` (**public**, 50 MB). Provider switch `lib/storage/provider.ts`. |
| **Identifier** | UUID `id`; `book_id` UUID FK → Supabase `books` (**ON DELETE CASCADE**). |
| **Retention** | Indefinite. EPUB retained for internal asset management even though there is no launch reader. |
| **Sensitivity** | `internal` — full-book files are the saleable product. ⚠️ `published-epubs` is `public = true`, i.e. anyone with the object URL downloads the full book. Escalated in ADR §12. |
| **Backup owner** | Database Owner (rows) + Platform (Storage objects). |
| **Allowed cross-system refs** | `book_id` → Supabase `books` (FK enforced). **When Mongo-primary the same book may not exist in Mongo**, so a `book_content` row can be orphaned from the public catalog's point of view. |

### 1.3 Authors

| Field | Value |
| --- | --- |
| **Source of truth** | **MongoDB** `authors` (`types/mongo.ts:32–42`) when Mongo-primary; Supabase `public.authors` otherwise. |
| **Read path** | `lib/data/authors.ts` — `listAuthorsForDirectory` (:34), `listFeaturedAuthors` (:79), `fetchAuthorById` (:124), `listPublishedBooksForAuthor` (:170). Pen name is joined onto book reads (`lib/data/books.ts:435`). |
| **Write path** | ⚠️ No first-class author CRUD in the repo. `app/admin/books/new/page.tsx:14–19` **reads** authors via the Supabase service-role client (no provider branch) to populate the author dropdown. |
| **Identifier** | Mongo `ObjectId` / Supabase UUID. `profile_id` links to identity. |
| **Retention** | Indefinite. |
| **Sensitivity** | `public` for `pen_name`, `bio`, `photo_url`. `internal` for `royalty_rate`. |
| **Backup owner** | Database Owner. |
| **Allowed cross-system refs** | `authors.profile_id` → `profiles` — **cross-system, no integrity** when Mongo-primary. |

### 1.4 Profiles and identity

| Field | Value |
| --- | --- |
| **Source of truth** | **Supabase — always, regardless of `DATABASE_PROVIDER`.** `auth.users` (Supabase Auth) + `public.profiles` (`...initial_schema.sql:9–20`). `AUTH_PROVIDER` defaults to `supabase` (`lib/auth/provider.ts:13`) and that is the production value. |
| **Read path** | `lib/api/request-user.ts` (provider-aware session resolution). Role lookups query `profiles` by `user_id` across `app/api/**` and `lib/**` — e.g. `lib/actions/books.ts:371–375`, `app/api/books/route.ts`, `app/api/audio/progress/route.ts`. |
| **Write path** | Registration trigger `supabase/migrations/20260121000000_profile_trigger.sql`. Role changes: `app/admin/actions.ts:70` `updateUserRoleAction` (service-role client, audited at `:98`). Role column protected by `supabase/migrations/20260717114020_protect_profiles_role.sql`. |
| **Identifier** | `profiles.id` UUID (own PK) **and** `profiles.user_id` UUID → `auth.users.id` (UNIQUE). ⚠️ **These are different values.** `lib/actions/books.ts:367–368` documents the trap explicitly. Most FKs point at `profiles.id`, not the auth user id. |
| **Retention** | For the life of the account + statutory retention. Deletion cascades from `auth.users` via `ON DELETE CASCADE`. |
| **Sensitivity** | **`personal`** — email, full name, preferences. CCR-015 minimisation applies. Never in evidence, screenshots, or docs. |
| **Backup owner** | Database Owner. Identity is the one store that cannot be reconstructed from anything else. |
| **Allowed cross-system refs** | Referenced by Mongo `orders.user_id`, Mongo `authors.profile_id`, and every `user_id` on Supabase engagement tables. **No integrity across the boundary.** |

### 1.5 Orders and commerce

| Field | Value |
| --- | --- |
| **Source of truth** | **Supabase** `public.orders` + `public.order_items` (`...initial_schema.sql:193–217`) for the launch payment path. Mongo `Order` (`types/mongo.ts:82–94`) exists for dual-run with **embedded `order_items`** — a Phoenix flatten, *not* a separate collection. **The two shapes are not equivalent.** |
| **Read path** | `lib/data/library.ts:68` `getLibraryForAuthUser`; `lib/data/admin-orders.ts:31` `listAdminOrders`; `app/(portals)/partner/_lib/partner-data.ts`; `app/(portals)/partner/orders/export/route.ts` (partner-only). |
| **Write path** | `app/api/webhook/route.ts` — Stripe `checkout.session.completed` fulfilment (order + order_items + license key at `:186–188`, `:238–240`). Status changes: `app/admin/actions.ts:136` `updateOrderStatusAction`. |
| **Identifier** | `orders.id` UUID; `orders.order_number` TEXT UNIQUE (human-facing); `orders.payment_intent_id` (Stripe correlation). Mongo uses a unique sparse index on `stripe_payment_intent_id` for webhook idempotency (`types/mongo.ts:78–80`). |
| **Retention** | **Financial record — long retention. Never delete.** Refunds are status transitions (`status='refunded'`), not deletions. |
| **Sensitivity** | **`personal` + `internal`.** Contains purchase history tied to an identity. Stripe keys are `secret` and live only in the secret store (P0-016 / issue #203). |
| **Backup owner** | Database Owner + Finance-Payments (per issue #205 ownership). |
| **Allowed cross-system refs** | `orders.user_id` → `profiles.id`. `order_items.book_id` → `books` — **cross-system when Mongo-primary**. Entitlement checks must fail **closed** if the book cannot be resolved. |

### 1.6 Entitlements / library

| Field | Value |
| --- | --- |
| **Source of truth** | **Supabase** — derived from `orders` + `order_items` (+ `subscriptions`). There is no standalone `entitlements` table. `order_items.license_key` is the entitlement token. |
| **Read path** | `lib/reading/entitlement.ts` (dual-run; comment at `:9` notes it resolves the auth user id via `profiles` under Mongo-primary); `lib/data/library.ts:68`. |
| **Write path** | Granted by `app/api/webhook/route.ts` on signed Stripe fulfilment. Revoked on refund. |
| **Identifier** | `(user_id, book_id)` via `order_items`. |
| **Retention** | Same as orders — permanent. An entitlement is a purchase record. |
| **Sensitivity** | `personal` + `internal`. |
| **Backup owner** | Database Owner + Finance-Payments. |
| **Allowed cross-system refs** | `book_id` → catalog — **cross-system when Mongo-primary; fail closed on unresolved.** RLS: `supabase/migrations/20260717114300_order_items_select_own.sql` (hosted application unverified — issue #199). |

### 1.7 Reviews

| Field | Value |
| --- | --- |
| **Source of truth** | Dual-run: **MongoDB** `reviews` when Mongo-primary (`types/mongo.ts:96–107`), else Supabase `public.reviews`. |
| **Read path** | `lib/data/reviews.ts` — `getBookReviewPage` (:348), `listPublicReviewsPage` (:592), `listMyReviews` (:805). Provider gating documented at `:589` and `:803`. |
| **Write path** | `app/api/reviews/route.ts`; `app/api/reviews/[id]/helpful/route.ts`; `lib/actions/reviews.ts`; Mongo layer `lib/mongo-reviews.ts`. |
| **Identifier** | `ObjectId` / UUID; unique per `(book_id, user_id)`. |
| **Retention** | Indefinite; moderation is out of scope at launch. |
| **Sensitivity** | `public` (body, rating) + `personal` (author identity linkage). |
| **Backup owner** | Database Owner. |
| **Allowed cross-system refs** | `book_id` → catalog; `user_id` → identity. `verified_purchase` derives from orders — a **three-way** cross-system read. |
| **Launch note** | `docs/NEXT_GO.md` §7 classes reviews/ratings as **"coming-soon only"** at launch. |

### 1.8 Reading progress

| Field | Value |
| --- | --- |
| **Source of truth** | Dual-run: **MongoDB** `ReadingProgress` when Mongo-primary, else Supabase `public.reading_progress` (`...initial_schema.sql:102–116`). |
| **Read path** | `lib/data/reading.ts:61` `getReadingSession`; `lib/data/library.ts:68` (progress rows on the library page). |
| **Write path** | `lib/data/reading.ts:127` `upsertReadingProgress`. Also touched by `lib/services/analytics-tracker.ts`, `lib/resonance/recommendations.ts`. |
| **Identifier** | `UNIQUE(user_id, book_id)`; `user_id` → **`profiles.id`**, not the auth user id. |
| **Retention** | Life of the account; cascades on profile deletion. |
| **Sensitivity** | **`personal`** — reading behaviour is sensitive. Anonymous update was revoked by `supabase/migrations/20260717114221_revoke_anon_update_reading_progress.sql`. |
| **Backup owner** | Database Owner. |
| **Allowed cross-system refs** | `book_id` → catalog (cross-system when Mongo-primary). |
| **Launch note** | No on-site EPUB reader at launch, so this path is largely dormant for launch traffic. |

### 1.9 Listening progress (audiobook)

| Field | Value |
| --- | --- |
| **Source of truth** | **Supabase** `public.listening_progress` (`supabase/migrations/20260719042627_listening_progress_schema_reconciliation.sql:11–18`). **No Mongo equivalent.** |
| **Read path** | `app/api/audio/progress/route.ts`. |
| **Write path** | `app/api/audio/progress/route.ts`. |
| **Identifier** | Composite PK `(user_id, book_id)`; `user_id` → **`profiles.id`** (matching the `reading_progress` convention, per the migration header). |
| **Retention** | Life of the account; `ON DELETE CASCADE` from both `profiles` and `books`. |
| **Sensitivity** | **`personal`.** RLS restricts to own rows. |
| **Backup owner** | Database Owner. |
| **Allowed cross-system refs** | `book_id` FK → **Supabase** `books`. ⚠️ Under Mongo-primary the referenced book may not exist in the live catalog. |
| **Launch note** | Launch ships **audio samples only**; full audiobook delivery + entitlements are post-launch. Position sync for a sample is not a launch requirement. |

### 1.10 Audit logs

| Field | Value |
| --- | --- |
| **Source of truth** | Dual-run: **MongoDB** `audit_logs` when Mongo-primary (`lib/audit.ts:33–42`), else Supabase `public.audit_logs` (`supabase/migrations/20260118000000_critical_fixes.sql:382–393`). |
| **Read path** | ⚠️ **No application read path.** Supabase has an admin-only SELECT policy (`...critical_fixes.sql:403–405`). Reading is console/SQL only. |
| **Write path (canonical)** | `lib/audit.ts:17` `recordAudit(actorId, action, target, metadata)` — provider-aware. Callers: `app/admin/actions.ts:63, :98, :127`. |
| **Write path (legacy)** | ⚠️ `lib/actions/books.ts:51` `logAudit` — **not provider-aware**, and writes `resource_id` / `resource_type` / `details`, **none of which exist** on the Supabase table. Callers at `:165, :297, :456, :572, :638, :693`. |
| **Schema reality** | Real columns: `id, user_id, action, table_name, record_id, old_data, new_data, ip_address, user_agent, created_at`. **There is no INSERT RLS policy** — only an admin SELECT policy. |
| **Identifier** | UUID / `ObjectId`. |
| **Retention** | **Append-only, permanent.** Mirrors CCR-002 for `docs/OPERATOR_QA_LOG.md`. |
| **Sensitivity** | `internal` + `personal` (actor identity, IP, user agent). |
| **Backup owner** | Database Owner + Release Manager (audit trail is gate evidence). |
| **Allowed cross-system refs** | `user_id` → identity; `record_id` / `target` → any entity, untyped. |
| **⚠️ Status** | **Two parallel audit systems with incompatible shapes.** Dispositioned in `SCHEMA_DRIFT_DISPOSITIONS.md`. |

### 1.11 Analytics

| Field | Value |
| --- | --- |
| **Source of truth** | **Supabase** — `analytics_events` (partitioned by year: `_2025`, `_2026`, `_2027`, `_default`; `supabase/migrations/20260117000000_analytics_events.sql`), `analytics_sessions` (`...20260117000001`), `engagement_events` (`...initial_schema.sql:131`). **No Mongo equivalent.** |
| **Read path** | `lib/data/stats.ts:16` `getPlatformStats`; `lib/actions/export-data.ts`; `app/api/analytics/stream/route.ts`. |
| **Write path** | `app/api/analytics/track/route.ts`; `lib/actions/analytics.ts`; `lib/services/analytics-tracker.ts`. |
| **Identifier** | Event UUID; session id. |
| **Retention** | Partition-bounded. **Drop old partitions rather than deleting rows.** |
| **Sensitivity** | **`personal`** — CCR-015 requires minimal PII on `/api/analytics/*` (`docs/NEXT_GO.md` route-truth section). RLS tightened by `supabase/migrations/20260717114047_tighten_analytics_sessions_rls.sql`. |
| **Backup owner** | Database Owner. Lowest restore priority — analytics loss is not a launch incident. |
| **Allowed cross-system refs** | `book_id` → catalog (cross-system when Mongo-primary). Analytics **must never block** a user-facing path on a failed cross-system resolve. |
| **⚠️ Launch note** | `docs/NEXT_GO.md` P0-014 / issue #204: homepage statistics were contradictory and were fixed to honest env-gated behaviour. Do not reintroduce unsourced counts (G6). |

### 1.12 Newsletter subscribers

| Field | Value |
| --- | --- |
| **Source of truth** | **Supabase** `public.newsletter_subscribers` (`supabase/migrations/20260719042623_newsletter_subscribers_schema_reconciliation.sql:5–18`). **No Mongo equivalent.** |
| **Read path** | `lib/email/newsletter.ts`. |
| **Write path** | `lib/email/newsletter.ts` — double opt-in: insert `status='pending'` + `confirm_token`, then confirm. |
| **Identifier** | UUID `id`; `email` UNIQUE (lowercased/trimmed, making subscribe idempotent). |
| **Retention** | Until unsubscribe (`status='unsubscribed'`, `unsubscribed_at`). **Do not hard-delete** — the row is the proof of consent and of the unsubscribe. |
| **Sensitivity** | **`personal`.** `confirm_token` is **`secret`** — never log it, never put it in evidence. |
| **Backup owner** | Database Owner + Marketing/Comms. |
| **Allowed cross-system refs** | None. Deliberately standalone — a subscriber need not be a registered user. |
| **Launch note** | `docs/NEXT_GO.md` §7 classes newsletter as *launch-with-flag*: requires `RESEND_API_KEY`, else **honestly disabled** (P0-013 / issue #201, gate G6). |

### 1.13 Manuscripts / editorial (not launch-facing, listed for completeness)

| Field | Value |
| --- | --- |
| **Source of truth** | **Supabase** `manuscripts` + `manuscript_status_history` + `manuscript_reviews` (`supabase/migrations/20260724000000`–`20260724000006`). No Mongo equivalent. |
| **Read/Write path** | `app/admin/actions.ts:106` `updateManuscriptStatusAction`; `lib/data/author-portal.ts:160`; `app/api/files/[id]/route.ts` (gated download). |
| **Identifier** | UUID. |
| **Retention** | Indefinite (submission record). |
| **Sensitivity** | **`internal`** — unpublished author work. Bucket `manuscripts` is private (5 MB→100 MB limit) and hardened by `20260724000005_harden_manuscript_storage.sql`. |
| **Backup owner** | Database Owner + Editorial. |
| **Allowed cross-system refs** | `20260724000003_add_manuscript_book_link.sql` links a manuscript to a book — **cross-system when Mongo-primary**. |

---

## 2. Per-field source of truth — `books`

Every field on the active `books` entity. "Mongo field" is the corresponding property on
`types/mongo.ts` `Book`; **"— (2.0b)"** means the field does **not exist in Mongo today** and is
scheduled by Task 2.0b. Under Mongo-primary those fields are unavailable in production.

| Supabase column | Mongo field | Source of truth (production) | Notes |
| --- | --- | --- | --- |
| `id` (UUID) | `_id` (ObjectId) | Mongo | Different types; `slug` is the portable key |
| `isbn` | — **(2.0b)** | Mongo after 2.0b | Supabase column exists and is UNIQUE |
| `title` | `title` | Mongo | Required |
| `slug` | `slug` | Mongo | UNIQUE both sides; public URL contract |
| `description` | `description` | Mongo | |
| `cover_url` | `cover_url` | Mongo | Points at Supabase Storage `book-covers` |
| `trailer_vimeo_id` | — **(2.0b)** | Mongo after 2.0b | ⚠️ Hardcoded `null` at `lib/data/books.ts:466` |
| `genre` | `genre` | Mongo | Supabase declares NOT NULL |
| `subgenres` (TEXT[]) | — | Supabase only | No Mongo equivalent; unused on the Mongo path |
| `price` | `price` | Mongo | |
| `discount_price` | — | Supabase only | ⚠️ Hardcoded `null` at `lib/data/books.ts:443` |
| — | `currency` | Mongo only | Defaults `'USD'` (`lib/mongo-books.ts:92`); no Supabase column |
| `status` | `status` | Mongo | ⚠️ **Domains differ** — see §3 |
| `visibility` | `visibility` | Mongo | ⚠️ **Domains differ** — see §3. Derived from `status` (ADR §2.1) |
| `is_featured` | — **(2.0b)** | Mongo after 2.0b | Supabase column exists |
| `featured_at` | — | Supabase only | |
| `total_reads` | — | Supabase only | Mongo substitutes `review_count` (`lib/data/books.ts:99–100`) |
| `total_reviews` | `review_count` | Mongo | Two names for one concept |
| `review_count` | `review_count` | Mongo | Added by `20260122000000_social_features.sql:143`; duplicates `total_reviews` |
| `average_rating` | `avg_rating` | Mongo | Aliased both ways at `lib/data/books.ts:449–451` |
| `page_count` | — | Supabase only | Editable in the admin form; **lost on the Mongo path** |
| `word_count` | — | Supabase only | Same |
| `author_id` | `author_id` | Mongo | Cross-store type change (UUID vs ObjectId) |
| `content_type` | `content_type` | Mongo | `book \| comic \| paper`; `20260619124500` |
| `published_at` | `published_at` | Mongo | Set on publish transition |
| `created_at` / `updated_at` | `created_at` / `updated_at` | Mongo | |
| `search_vector` (generated tsvector) | — | Supabase only | Postgres FTS; no Mongo equivalent. Mongo search must be reimplemented |
| `amazon_url` | — **(2.0b)** | Mongo after 2.0b | ⚠️ **Omitted entirely** from the Mongo return (`lib/data/books.ts:436–476`) |
| `kindle_url` | — **(2.0b)** | Mongo after 2.0b | ⚠️ Same |
| `apple_books_url` | — **(2.0b)** | Mongo after 2.0b | ⚠️ Same |
| `audible_url` | — **(2.0b)** | Mongo after 2.0b | ⚠️ Same |
| `barnes_noble_url` | — **(2.0b)** | Mongo after 2.0b | ⚠️ Same |
| `google_play_books_url` | — **(2.0b)** | Mongo after 2.0b | ⚠️ Same |
| — | `manuscript_url` | Mongo only | ⚠️ **No Supabase `books.manuscript_url` column** — see drift dispositions |
| — | `tags` | Mongo only | ⚠️ No Supabase column; written at `lib/mongo-books.ts:94` |

**Fields on `book_content` (Supabase only, no Mongo equivalent):** `epub_url`, `pdf_url`,
`audio_url`, `toc`. Task 2.0b adds an audio sample URL, chapter TOC, narrator and duration to the
Mongo `Book`; until then, **audio is `null` in production** (`lib/data/books.ts:467`).

**Fields referenced by code but present in no store at all** (`subtitle`, `books.epub_url`,
`deleted_at`, `books.author_name`, `books.metadata`, `books.categories`, `view_count`,
`download_count`, `books.manuscript_url`): see `docs/architecture/SCHEMA_DRIFT_DISPOSITIONS.md`.

---

## 3. Domain mismatches between the two stores

| Concept | Supabase domain | Mongo domain | Consequence |
| --- | --- | --- | --- |
| `books.status` | `draft, submitted, review, accepted, published, archived` (CHECK, `...initial_schema.sql:51`) | `draft, published, archived` (`types/mongo.ts:14`) | A Supabase book in `submitted` / `review` / `accepted` **has no valid Mongo status**. The backfill must map these — see `docs/BOOK_LIFECYCLE.md`. |
| `books.visibility` | `public, private` (CHECK, `...initial_schema.sql:52`) | `public, private, unlisted` (`types/mongo.ts:15`) | `'unlisted'` is Mongo-only and **must not be used** until reconciled. |
| `order_items` | Separate table with FK | Embedded array on `Order` | Order shapes are not interchangeable; migration is a reshape, not a copy. |
| `audit_logs` | `user_id, action, table_name, record_id, old_data, new_data, …` | `actor_id, action, target, metadata, created_at` | Two incompatible audit schemas; neither matches what `logAudit` writes. |
| Full-text search | Generated `search_vector` + GIN index `idx_books_search` | none | Search must be reimplemented on the Mongo path. |

---

## 4. Gaps this matrix cannot close (require Renee)

1. **Backup ownership is aspirational.** Nothing in the repository evidences a Mongo Atlas backup
   policy, a Supabase PITR window, or a tested restore. Every "Backup owner" cell above names an
   accountable role, not a verified control. **A restore has never been rehearsed** in any evidence
   the repo contains. Gate G11 covers *deployment* rollback, not *data* restore — there is no gate
   for data restore at all.
2. **`published-epubs` is a public bucket** holding full books (§1.2). Decision required.
3. **No application write path for `book_content`** (§1.2) — EPUB/audio/TOC cannot be attached
   through the product. Whether that is acceptable for a 3–6 book launch is an operator call.
4. **Hosted Supabase state is unverified** against the repo migrations (issue #192). Every Supabase
   claim in this matrix is *repo-verified*, not *hosted-verified*.
5. **No `authors` CRUD** (§1.3) — authors must be created out-of-band.
