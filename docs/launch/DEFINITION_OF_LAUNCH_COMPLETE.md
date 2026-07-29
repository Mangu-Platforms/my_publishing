# Definition of Launch Complete

> The single answer to *"are we done?"*. If a condition below is not met, MANGU Publishers has not
> launched — regardless of what any dashboard, deploy log, or individual document says.
> Subordinate to `docs/NEXT_GO.md` (CCR-001). Evidence sink: `docs/OPERATOR_QA_LOG.md` (CCR-002).

## Principles

1. **NO-GO is the default** (`docs/NEXT_GO.md` §8 rule 1). Launch-complete is a state you *prove*,
   not one you assume.
2. **Exact-SHA evidence only** (CCR-005). Every condition is evidenced against the same release
   candidate SHA.
3. **No false success** (CCR-006, CCR-018). A condition that is "working in a way we don't want to
   look at too closely" is not met.
4. **Human gates need human evidence** (CCR-014). CI cannot sign off manual verification.
5. **No secrets or PII** in evidence, screenshots, or links (CCR-009, CCR-015).

## Scope of this document

`docs/launch/LAUNCH_GATE_EVIDENCE.md` covers the **hard gates G1–G13** from the authority.
This document covers **everything that must be true to launch**, which is a superset: the gates,
**plus** the architectural preconditions found in the 2026-07-28 audit that sit outside the G1–G13
matrix because they were discovered after the matrix was written (§B), plus content and operational
readiness (§C–§F).

**A gate can be TRUE while the product is still broken.** G10 row 7 ("Browse `/books`") can pass
while the admin console is publishing into a database the site does not read. Section B exists
because of exactly that gap.

---

## Section A — Hard gates G1–G13

| # | Condition | How evidenced | Signed off by |
| --- | --- | --- | --- |
| A1 | **All 13 hard gates are `PASSED`** against the release candidate SHA | `docs/launch/LAUNCH_GATE_EVIDENCE.md` §2 fully completed, 13/13, one SHA | Release Manager |
| A2 | G10 manual QA rows 1–10 each have tester, UTC time, SHA, deploy ID, artifact | `docs/OPERATOR_QA_LOG.md` rows 1–10 (currently blank; issue #193) | QA |
| A3 | No gate is `WAIVED` | `LAUNCH_GATE_EVIDENCE.md` §2 — `WAIVED` is never valid for an unchanged hard gate (`docs/NEXT_GO.md` §1) | Release Manager |
| A4 | G12 baseline refreshed to name the **release** SHA | Refresh commit `docs(next-go): refresh baseline @<SHA> <UTC>` (CCR-020) | Release Manager |
| A5 | Every P0 issue #186–#205 is closed or has a recorded, approved exception | GitHub issue states + `LAUNCH_GATE_EVIDENCE.md` §4.4 | Release Manager |

---

## Section B — Architectural preconditions (outside the G1–G13 matrix)

> These come from the 2026-07-28 audit and the Task 1.0 analysis. **None of them are covered by any
> existing gate.** They are launch-complete conditions in their own right.

| # | Condition | How evidenced | Signed off by |
| --- | --- | --- | --- |
| B1 | **Admin book writes are provider-aware.** `createBookAdmin`, `updateBookAdmin` and `updateBookStatusAction` branch on `isMongoPrimary()`. | Merged PR; unit tests extending `tests/unit/data-admin-books-dual-run.test.ts`; **live proof**: publish a book via the admin UI and see it on the public site | Engineering |
| B2 | **Admin book reads are provider-aware.** `app/admin/books/[id]/edit/page.tsx` and `app/admin/books/new/page.tsx` read the same store the public site reads. | Merged PR; the admin console lists exactly the books `GET /api/books` returns | Engineering |
| B3 | **Visibility is derived from status** on every write path (ADR-001 §2.1). | Merged PR; a book created as `draft` is stored `visibility='private'` | Engineering |
| B4 | **Task 2.0b complete** — Mongo `Book` carries the six retailer URLs, audio sample + TOC + narrator + duration, `content_type`, `isbn`, `is_featured`, trailer ref; hardcoded `null`s removed from `lib/data/books.ts`. | Merged PR; **retailer buttons and audio sample render on the live public book page** | Engineering |
| B5 | **Schema drift dispositioned.** Every item D-01…D-17 is remedied or has a recorded, approved deferral. | `docs/architecture/SCHEMA_DRIFT_DISPOSITIONS.md` §3 with each row resolved | Engineering |
| B6 | **Audit consolidation (D-17).** `logAudit` removed; all callers on `recordAudit`; return values checked; columns remapped. | Merged PR; an admin status change produces a readable audit row | Engineering |
| B7 | **Archive transition works** (`BOOK_LIFECYCLE.md` §2). Unpublish reaches `archived` from both admin surfaces; invalid statuses return a visible error. | Merged PR; manual verification of T4/T5/T6 | Engineering + QA |
| B8 | **`published_at` is not destroyed on unpublish** (`BOOK_LIFECYCLE.md` R7). | Merged PR; archive-then-republish preserves the original date | Engineering |
| B9 | **Hosted migration drift reconciled** (Task 3.6 / issue #192). Hosted `schema_migrations` exported and classified against the repo's 40 migration files. | SQL export attached; `docs/MIGRATIONS.md` updated in the same change | Database Owner |
| B10 | **`published-epubs` bucket decision made** — private + signed URLs, or accepted with recorded residual risk. | Decision recorded in `docs/OPERATOR_QA_LOG.md`; ADR-001 §12 item closed | **Publisher (Renee)** |
| B11 | **ADR numbering collision resolved** — two live documents named ADR-001. | Decision recorded; documents renamed or a citation convention adopted | **Publisher (Renee)** |
| B12 | **Phase/task numbering reconciled** (`LAUNCH_GATE_EVIDENCE.md` §5). | Decision recorded; no bare phase numbers remain in launch docs | **Publisher (Renee)** |
| B13 | **Data backup and restore verified.** A restore has been rehearsed for **both** MongoDB Atlas and Supabase. | Restore transcript in `docs/OPERATOR_QA_LOG.md` | Database Owner |

> ⚠️ **B13 has no gate.** G11 covers *deployment* rollback (revision traffic), not *data* restore.
> Nothing in the repository evidences a tested data restore for either store. A launch without a
> rehearsed restore is an accepted risk that **Renee must accept explicitly** — it should not pass
> by default.

---

## Section C — Catalog and content

| # | Condition | How evidenced | Signed off by |
| --- | --- | --- | --- |
| C1 | **3–6 books marked launch-approved** — no more, no fewer | `docs/launch/LAUNCH_CATALOG.md` §3 count check | Publisher |
| C2 | Every launch book has rights confirmed **in writing** | `LAUNCH_CATALOG.md` §1 + contract references | Rights/Legal |
| C3 | Every launch book has a completed signoff | `BOOK_PUBLISHING_RUNBOOK.md` §16, one per book | Publisher |
| C4 | Every launch book passed post-publish verification **on the public site, in incognito** | Runbook §11 checklist per book | QA |
| C5 | **All QA/seed content removed from both stores** — not merely unpublished | `LAUNCH_CATALOG.md` §4 removal table + verification | Engineering |
| C6 | No duplicate slugs remain | `LAUNCH_CATALOG.md` §4; known seeded duplicates (`lib/data/books.ts:483–486`) resolved | Engineering |
| C7 | No placeholder titles or test authors anywhere in the live catalog | `LAUNCH_CATALOG.md` §4 verification | Editorial |
| C8 | Every launch book has ≥1 verified retailer link that opens the correct product page | Runbook §6.3 per book | Editorial |
| C9 | **No public "Start Reading" / on-site reader affordance exists** | Manual verification of every book page | QA |
| C10 | Descriptions, genres and prices are approved and proofread | `LAUNCH_CATALOG.md` §1 | Editorial + Publisher |

---

## Section D — Product truth (gate G6 and beyond)

| # | Condition | How evidenced | Signed off by |
| --- | --- | --- | --- |
| D1 | Contact form works verifiably, or is honestly disabled | Issue #197 (P0-012); live verification | QA |
| D2 | Newsletter CTA works verifiably, or is honestly disabled | Issue #201 (P0-013); live verification. Requires `RESEND_API_KEY`, else disabled honestly | QA |
| D3 | Homepage statistics are true, or removed | Issue #204 (P0-014); live verification. ⚠️ Cross-check against drift D-11/D-12/D-14 — view/download counters are non-functional, so any count sourced from them is a false claim | QA |
| D4 | No unavailable feature is presented as available | Route-truth acceptance; `docs/NEXT_GO.md` §7 launch-scope classes | QA + Publisher |
| D5 | Audiobook surfaces show **samples only**; no full-audiobook or entitlement promise | Live verification of every audio surface | QA |
| D6 | Reviews/ratings are presented as **coming-soon only** (`docs/NEXT_GO.md` §7) | Live verification | QA |
| D7 | No marketing claim of "production-ready" before 13/13 gates | Publisher attestation | Publisher |

---

## Section E — Platform and operations

| # | Condition | How evidenced | Signed off by |
| --- | --- | --- | --- |
| E1 | **Vercel is the canonical origin**; Cloud Run is not serving production traffic | ADR-001 (canonical platform); DNS records; monitor targets | Platform |
| E2 | Apex DNS points at Vercel; no split-brain A records | `dig` output; no `216.239.*` on the apex | Platform |
| E3 | `/api/health?ready=1` → `ready:true` on the canonical origin (G7) | curl JSON transcript | Platform |
| E4 | Monitors (`health-check.yml`, `lighthouse-ci.yml`) are green on the canonical origin (G9) | Actions run URLs | Platform |
| E5 | Stripe production webhook registered; signed test event 2xx with visible side effect (G8) | Stripe endpoint + event evidence | Platform + Finance-Payments |
| E6 | Rate limiting **fails closed** on Redis loss (CCR-007) | Outage-test transcript; issue #195 | Engineering |
| E7 | `USE_MOCKS` and `SKIP_EMAILS` proven **absent** from production (CCR-010) | Masked env-name export; issue #203 | Platform |
| E8 | Known-good revision recorded and rollback rehearsed (G11) | Rollback transcript + revision ID | Platform |
| E9 | Sentry (or equivalent) receiving events from production | Live error captured and visible | Platform |
| E10 | No secrets in git, client bundles, images, logs, or evidence (CCR-009) | Secret scan on the release SHA; `docs/SECRET_INVENTORY.md` (redacted) | Platform |
| E11 | `/api/mcp/[transport]` disabled unless `MCP_ENABLED=true` (fail-closed) | Live probe; issue #200 | Engineering |

---

## Section F — Governance

| # | Condition | How evidenced | Signed off by |
| --- | --- | --- | --- |
| F1 | `docs/NEXT_GO.md` is on the release tree and matches the approved version (G13) | git tree proof + commit SHA | Release Manager |
| F2 | `docs/OPERATOR_QA_LOG.md` is complete, append-only, no rewritten history (CCR-002) | Log review | Release Manager |
| F3 | The launch freeze (issue #209) was honoured — every merge falls in a permitted class | PR audit against `LAUNCH_GATE_EVIDENCE.md` §4.1 | Release Manager |
| F4 | Held items are still held at cut: #145, dependabot majors, #142 | `LAUNCH_GATE_EVIDENCE.md` §4.2 | Release Manager |
| F5 | PR #145 (release 1.0.0) merged **only after** the GO decision | PR #145 merge commit timestamp after the §A1 decision | Release Manager |
| F6 | Release 1.0.0 cut from the approved SHA | Tag + release SHA correlation | Release Manager |
| F7 | Controlled thaw plan exists for post-launch (Authority Phase 16) | Documented thaw plan | Release Manager |
| F8 | Every open exception has a named owner and recorded residual risk | `LAUNCH_GATE_EVIDENCE.md` exception columns | Publisher |

---

## Section G — Final determination

**Launch is complete when, and only when, every condition in Sections A–F is met against a single
release candidate SHA, and the Publisher has signed.**

| | |
| --- | --- |
| Release candidate SHA | `________________________________________` |
| Section A — hard gates | ___ / 5 conditions met |
| Section B — architectural preconditions | ___ / 13 |
| Section C — catalog and content | ___ / 10 |
| Section D — product truth | ___ / 7 |
| Section E — platform and operations | ___ / 11 |
| Section F — governance | ___ / 8 |
| **Total** | **___ / 54** |
| Any unmet condition without an approved, owner-signed exception? | ☐ YES ☐ NO |
| **Determination** | ☐ **LAUNCH COMPLETE** ☐ **NOT COMPLETE** |

### Sign-off

| Role | Name | Statement | Signature | Date (UTC) |
| --- | --- | --- | --- | --- |
| **Engineering** |  | Sections B and E engineering conditions are met and evidenced at the named SHA. |  |  |
| **QA** |  | Sections C and D verification was performed by a human against the real production backend at the named SHA. |  |  |
| **Platform** |  | Section E platform conditions are met and evidenced. |  |  |
| **Database Owner** |  | B9 and B13 are met — migration history is reconciled and a restore has been rehearsed. |  |  |
| **Rights / Legal** |  | C2 is met for every launch book. |  |  |
| **Release Manager** |  | Sections A and F are met; the ALL-TRUE rule is satisfied. |  |  |
| **Publisher (Renee)** |  | **MANGU Publishers is launch complete. I authorise release.** |  |  |

---

## Section H — Decisions that only Renee can make

Launch cannot be declared complete while any of these is open.

| # | Decision | Reference |
| --- | --- | --- |
| H1 | `published-epubs` public bucket — make private, or accept the exposure | B10 · ADR-001 §12 |
| H2 | ADR numbering collision — renumber, or adopt a citation convention | B11 · ADR-001 §12 |
| H3 | Phase/task numbering reconciliation | B12 · `LAUNCH_GATE_EVIDENCE.md` §5 |
| H4 | **Accept or reject launching without a rehearsed data restore** | B13 |
| H5 | Per-book backfill dispositions for Supabase-only and divergent books | ADR-001 §7 |
| H6 | Drift D-02 scope — build a `book_content` writer, or accept out-of-band asset attachment | `SCHEMA_DRIFT_DISPOSITIONS.md` §4 |
| H7 | Drift D-13 — whether `searchBooks` is on a launch-scope surface (search is Launch-in-MVP) | `SCHEMA_DRIFT_DISPOSITIONS.md` §4 |
| H8 | Accept the pre-consolidation audit gap (D-17) as a recorded evidence gap | `BOOK_LIFECYCLE.md` §9 |
| H9 | Accept publish-time validation remaining manual for launch | `BOOK_PUBLISHING_RUNBOOK.md` §17 |
| H10 | Approve the final 3–6 launch catalog | C1 · `LAUNCH_CATALOG.md` §6 |
| H11 | Approve hard-delete policy and any individual hard delete | `BOOK_LIFECYCLE.md` §7 |
| H12 | Final **GO / NO-GO** | Section G |
