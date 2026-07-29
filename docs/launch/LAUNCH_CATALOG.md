# Launch Catalog

> **Task 4.1.** Template — **intentionally empty**. Fill one row per candidate book.
> Companion to `docs/BOOK_PUBLISHING_RUNBOOK.md` (how to publish) and
> `docs/BOOK_LIFECYCLE.md` (what the states mean).
> Subordinate to `docs/NEXT_GO.md` (CCR-001). Evidence goes to `docs/OPERATOR_QA_LOG.md` (CCR-002).

## Rules

1. **Exactly 3–6 books are marked launch-approved.** Fewer than 3 is not a catalog. More than 6
   exceeds the agreed launch scope. Enforced by the count in §3.
2. **No placeholder titles.** No "Test Book", "Sample", "Demo", "Lorem", "TBD", "Untitled", or
   author "Test Author" / "QA Author" in the launch set — and none anywhere in the live catalog.
3. **All QA and seed content is removed before launch**, not merely unpublished. See §4.
4. **Every launch-approved book has a completed signoff** (`docs/BOOK_PUBLISHING_RUNBOOK.md` §16).
5. **A book is launch-approved only when every gating column in §2 is `YES`.** A single `NO` or `—`
   means `Include = NO` and a blocking issue must be named.
6. **Rights confirmed is non-negotiable.** No rights, no launch, no exception, no waiver.
7. **This file is the record.** If a book is not on this table, it is not in the launch.

## Status vocabulary

Aligned with `docs/NEXT_GO.md` §1: `NOT STARTED` · `IN PROGRESS` · `BLOCKED` · `FAILED` · `PASSED` ·
`SUPERSEDED` · `WAIVED`. For the YES/NO columns below use `YES` / `NO` / `N/A`, never blank —
blank means "nobody has looked".

---

## 1. Candidate books

> One row per candidate. Add rows as needed. **Do not delete rows** for rejected candidates — set
> `Include = NO` and record why. The rejected set is evidence that the decision was made.

| # | Title | Author (pen name) | Publication status | Rights confirmed | Cover ready | Description approved | Genre approved | Price approved | ISBN | Retailer links | EPUB ready | Audio sample ready | Launch inclusion decision | Blocking issue |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 2 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 3 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 4 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 5 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 6 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 7 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 8 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |

### Column definitions

| Column | Definition | Accepted values |
| --- | --- | --- |
| **Title** | Exactly as on the cover. | text |
| **Author (pen name)** | Must match an existing `authors.pen_name` record. ⚠️ There is no author-creation UI — new authors need Engineering. | text |
| **Publication status** | Current `books.status`. | `draft` · `published` · `archived` · `not created` |
| **Rights confirmed** | Signed contract or release on file. **Gating.** | `YES` + reference · `NO` |
| **Cover ready** | Meets runbook §3 (JPG/PNG, 2:3, ≥1600×2400, ≤2 MB) **and** `cover_url` resolves. **Gating.** | `YES` · `NO` |
| **Description approved** | Proofread and signed off by the Publisher. **Gating.** | `YES` + approver · `NO` |
| **Genre approved** | Single value from the approved list. **Gating.** | genre name · `NO` |
| **Price approved** | Publisher-approved. `$0.00` is valid if deliberate. **Gating.** | `$nn.nn` · `NO` |
| **ISBN** | 13 digits, no hyphens, or `N/A`. | digits · `N/A` |
| **Retailer links** | Count verified per runbook §6.3. **At least one is gating.** | `n/6 verified` · `NO` |
| **EPUB ready** | Validated and attached. ⚠️ **Not gating** — no on-site reader at launch. ⚠️ See §5. | `YES` · `NO` · `N/A` |
| **Audio sample ready** | Meets runbook §4. ⚠️ **Not gating.** ⚠️ Blocked by Task 2.0b. | `YES` · `NO` · `N/A` |
| **Launch inclusion decision** | Final call. **`YES` requires every gating column `YES`.** | `YES` · `NO` · `PENDING` |
| **Blocking issue** | GitHub issue number, or a one-line reason. Required whenever the decision is not `YES`. | `#nnn` / text |

---

## 2. Gating summary

A book may be marked `Include = YES` **only if all of these are `YES`**:

- [ ] Rights confirmed
- [ ] Cover ready
- [ ] Description approved
- [ ] Genre approved
- [ ] Price approved
- [ ] At least one verified retailer link
- [ ] Author resolves to a real `authors` record with a `pen_name`
- [ ] Signoff complete (`BOOK_PUBLISHING_RUNBOOK.md` §16)
- [ ] Post-publish verification passed **on the public site** (runbook §11)

**Not gating** (documented, not blocking): ISBN, EPUB, audio sample, page/word count.

---

## 3. Launch count check

| | |
| --- | --- |
| Books marked `Include = YES` | **___** |
| Required range | **3–6** |
| Within range? | ☐ YES ☐ NO |
| Checked by | ______________________ |
| Date (UTC) | ______________________ |

> If this is outside 3–6, **launch is not ready** regardless of gate status.

---

## 4. QA / seed content removal

All QA and seed content must be **gone from the live catalog** before launch — not merely
unpublished. A published-then-drafted test book still occupies a slug and can still be found by
anyone with the URL, and a duplicate slug will block a real book from publishing.

**Known:** `lib/data/books.ts:483–486` documents that duplicate slugs exist in seeded data —
"the same QA book under two test authors". `scripts/seed-database.ts` is the likely origin.
`docs/OPERATOR_QA_LOG.md` (manual QA row 7) notes `/books` "Requires migrations + seed".

⚠️ Removal must be coordinated with `docs/BOOK_LIFECYCLE.md` §7 — hard delete cascades to
`order_items`. Seed books should have no orders, but **verify before deleting**.

| # | Seed/QA item | Type | Where it lives | Removed? | Verified by | Date |
| --- | --- | --- | --- | --- | --- | --- |
| 1 |  | book / author / order / other | Mongo / Supabase / both |  |  |  |
| 2 |  |  |  |  |  |  |
| 3 |  |  |  |  |  |  |
| 4 |  |  |  |  |  |  |
| 5 |  |  |  |  |  |  |

**Removal verification (all in an incognito browser):**

- [ ] `GET /api/books` returns **only** launch-approved books — count matches §3
- [ ] `/books` shows only launch-approved books
- [ ] No author named "Test Author", "QA Author", or similar appears in `/authors`
- [ ] No duplicate slugs remain in the catalog
- [ ] Every genre page shows only launch-approved books
- [ ] Search returns no seed content
- [ ] Sitemap contains only launch-approved book URLs

⚠️ **Check both stores.** Seed data may exist in Supabase, MongoDB, or both. Removing it from one
does not remove it from the other, and which one the site reads depends on `DATABASE_PROVIDER`
(ADR-001 §1.1).

---

## 5. Known blockers affecting every row

These are architectural, not per-book. Record on each affected row.

| Blocker | Effect on this table | Reference |
| --- | --- | --- |
| **Task 1.0** — admin writes go to Supabase, public reads MongoDB | **A book published via the admin UI may not appear on the public site.** Post-publish verification will fail for reasons unrelated to the book. | ADR-001 §1.2 |
| **Task 2.0b** — retailer URLs and audio not carried by the MongoDB read path | "Retailer links" and "Audio sample ready" may be `YES` here and still not render live. Mark `BLOCKED-2.0b` on the signoff. | ADR-001 §4 |
| **Drift D-01** — `books.subtitle` in the admin edit select | The admin **edit page may fail to load**, blocking metadata completion for every book. | `SCHEMA_DRIFT_DISPOSITIONS.md` D-01 |
| **Drift D-02** — `books.epub_url` does not exist | Admin create/update fails if the EPUB field is populated. Leave it blank. | D-02 |
| **No admin upload UI** — `BookUploadForm` is mounted nowhere | Cover upload requires Engineering for every book. | `BOOK_PUBLISHING_RUNBOOK.md` §7.3 |
| **`published-epubs` bucket is public** | Any uploaded EPUB is publicly downloadable. | ADR-001 §12 |

---

## 6. Sign-off

| Role | Name | Statement | Signature | Date (UTC) |
| --- | --- | --- | --- | --- |
| **Editorial** |  | Descriptions, genres and metadata are accurate and proofread for every included book. |  |  |
| **Production** |  | Covers, EPUBs and audio samples meet spec for every included book. |  |  |
| **Rights / Legal** |  | Rights are confirmed in writing for every included book. |  |  |
| **Engineering** |  | Every included book is verified live on the public site; no seed/QA content remains in either store. |  |  |
| **Publisher (Renee)** |  | I approve this catalog as the MANGU Publishers launch catalog. |  |  |

> Sign-off is only valid against a named commit SHA. Record it here: `________________________`
> (CCR-005 — exact-SHA evidence only).

---

## 7. Change log

Append-only (CCR-002). Never rewrite a row; supersede and add.

| Date (UTC) | Actor | Change | Reason |
| --- | --- | --- | --- |
| 2026-07-28 | agent | Template created (Task 4.1) | Launch governance |
