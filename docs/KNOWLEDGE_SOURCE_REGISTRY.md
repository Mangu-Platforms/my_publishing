# Knowledge Source Registry — Mangu Publishers

> **DRAFT — PROPOSED v0.1.0 · 2026-07-29 · owner: TBD**
> **Proposed repo path:** `docs/KNOWLEDGE_SOURCE_REGISTRY.md` (Brief §19 doc set item 5; task **T-07.1**).
> **Classification:** Documentation-only (permitted under launch freeze **#209 class 1**). No code, config, secret, or deploy touched.
> **THE REGISTRY IS EMPTY BY DESIGN TODAY: zero sources approved, zero ingested.** §3 is intentionally blank. There is no `lib/ai/`, no ingestion job, and no chunk/source table in `supabase/migrations/` at this HEAD — nothing has ever been ingested.
> **Registration is a prerequisite for ingestion.** An unclassified source defaults to **Restricted** — see `docs/AI_SAFETY_PRIVACY_POLICY.md` §2, which is the sole authority on data classes and their AI-use rules. This file does **not** restate them.
> **Blocked on owner gate HG-8** (`docs/MASTER_IMPLEMENTATION_PLAN.md` §6: "Internal knowledge sources (register+classify)" — OPEN). No row may reach APPROVED until HG-8 is ratified.
> **No secrets, credentials, PII, or manuscript text may ever appear in this file** (repo is public). Names and paths only.

**Siblings referenced, not restated:** `docs/AI_SAFETY_PRIVACY_POLICY.md` §2 (data classes), §3 (hard prohibitions); `docs/ARCHITECTURE_AI_PLATFORM.md` §4 (RAG stage table + v0 retrieval decision); `docs/MASTER_IMPLEMENTATION_PLAN.md` (T-07.1, T-07.2, HG-3, HG-8).

---

## 1. Purpose and the governing rule

This registry is the single record of **what the AI is allowed to know**. It exists to satisfy the *Source registration* stage of the Brief §9 pipeline, whose acceptance evidence is "Registry entry and approval record" (carried into `ARCHITECTURE_AI_PLATFORM.md` §4).

> **THE RULE.** No source may be **ingested, extracted, chunked, embedded, indexed, retrieved, or cited** by any Mangu AI surface until it has an **APPROVED** row in §3 of this document.
> Corollaries: (a) absence from this registry is a **deny**, not a gap; (b) a source whose classification is blank is **Restricted** and therefore not ingestible; (c) retrieval filters must be enforced against the classification recorded here, not against the store's own defaults; (d) an APPROVED row grants ingestion only for the **allowed answer types** recorded in that row.

**Scope note.** Retrieval that exists today (`lib/resonance/*` over `resonance_vectors`) is **book-level, one vector per book** — not a document-knowledge plane (see `ARCHITECTURE_AI_PLATFORM.md` §4, RAG v0 decision). It predates this registry and is out of scope here. Chunk-level ingestion of anything listed in §4 is **T-07.2**, gated by this document.

## 2. Required fields per source

Every row in §3 carries all thirteen fields. A row missing any field is **not** a valid registration.

| # | Field | Definition | Constraint |
|---|---|---|---|
| 1 | **Source ID** | Stable identifier, `KS-###`. Never reused after deletion. | Immutable |
| 2 | **Name** | Human-readable source name. | Required |
| 3 | **Owner** | Named accountable human (not a team, not an agent). | Required; TBD blocks approval |
| 4 | **Classification** | One of Public / User-private / Author-private / Internal / Restricted. | Per `AI_SAFETY_PRIVACY_POLICY.md` §2. Blank ⇒ Restricted |
| 5 | **Audience** | Which assistant modes may retrieve it (public / reader / author / partner / staff / admin). | Must be ⊆ what the classification permits |
| 6 | **Canonical URL / path** | The one authoritative location. Repo path or public URL. | Must be verified to exist at approval time |
| 7 | **Effective date** | Date the content becomes authoritative. | ISO date |
| 8 | **Review / expiry date** | Date the row must be re-verified or auto-expires. | Per §7 cadence; hard stop |
| 9 | **Ingestion status** | `NOT REGISTERED` → `PROPOSED` → `APPROVED` → `INGESTED` → `EXPIRED` / `DELETED`. | Only `INGESTED` may be retrieved |
| 10 | **Allowed answer types** | What the source may be used to answer (e.g. catalog facts, policy statements). | Anything not listed is out of bounds |
| 11 | **Deletion rule** | Trigger + required teardown for source and derived artifacts. | See §5.2 |
| 12 | **Approver** | Owner who signed off (HG-8 authority). | Required for `APPROVED` |
| 13 | **Approval date** | Date of sign-off. | Required for `APPROVED` |

## 3. The registry — **EMPTY**

**Zero approved sources. Zero ingested sources.** The single row below is a format illustration only and confers no permission.

| Source ID | Name | Owner | Class | Audience | Canonical URL/path | Effective | Review/expiry | Status | Allowed answer types | Deletion rule | Approver | Approval date |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| *KS-000* | *EXAMPLE — NOT APPROVED* | *TBD* | *Public* | *public assistant* | *`/faqs`* | *TBD* | *TBD* | **EXAMPLE — NOT APPROVED** | *illustration only* | *illustration only* | *none* | *none* |

<!-- Real rows begin below this line. None exist. Do not add a row without an approver signature (HG-8). -->

## 4. Candidate sources for the first approval wave (Public class only)

All rows are **CANDIDATE — NOT REGISTERED**. Each path was read at HEAD `36f7528` and confirmed to exist. Nothing here is approved, and nothing here may be ingested.

| # | Candidate source | Verified path(s) | Proposed class | Why it is a safe first source |
|---|---|---|---|---|
| C1 | Published book catalog | `lib/data/books.ts` (`listPublishedBooks`, `fetchBookForApi`); routes `app/(consumer)/books/page.tsx`, `books/[slug]/` | Public | Every read path already filters `status='published' AND visibility='public'`; unpublished and hidden titles are excluded at the data layer, not by prompt. Also the source the v0 book-level plane already covers. |
| C2 | Author directory + public bios | `lib/data/authors.ts` (`listAuthorsForDirectory`, `fetchAuthorById`, `listPublishedBooksForAuthor`); `app/(consumer)/authors/page.tsx`, `authors/[id]/` | Public | Bios are author-supplied for publication; Brief §4.4 names "author bios" as Public. Book list for an author reuses the published/public filter. |
| C3 | Genre taxonomy + counts | `lib/data/genres.ts` (`listGenresForBrowse`, `getGenreCounts`); `app/(consumer)/genres/page.tsx` | Public | Derived facts only — no free text, no PII. Counts are computed over published+public books, and the helper returns `null` on failure so "unavailable" never renders as a false zero. |
| C4 | About page | `app/(consumer)/about/page.tsx` | Public | Static, hand-written, in the sitemap with a canonical URL. Small, stable, easy to diff on change. |
| C5 | FAQs | `app/(consumer)/faqs/page.tsx` | Public | Purpose-built Q&A; the file's own header records that every answer was rewritten to match what actually ships, so grounding errors are least likely here. Highest answer value per chunk. |
| C6 | Help Center | `app/(consumer)/help/page.tsx` | Public | Static topic index, same truthfulness pass as C5. Routes users to real surfaces only. |
| C7 | Press page | `app/(consumer)/press/page.tsx` | Public | Deliberately claim-free (no downloadable kit is promised); safe boilerplate + contact routing. |
| C8 | Careers page | `app/(consumer)/careers/page.tsx` | Public | Static values + an explicit "No open roles right now". Low value but zero risk; useful to answer hiring questions correctly rather than by inference. |
| C9 | Contact page | `app/(consumer)/contact/page.tsx` | Public | Routing facts only. Prevents the assistant from inventing a contact channel. |
| C10 | Published legal pages — Privacy, Terms, Cookies | `app/(consumer)/privacy/page.tsx`, `terms/page.tsx`, `cookies/page.tsx` | Public | These are the *published* policies (each carries "Last updated: January 2026"), distinct from the unratified `docs/` drafts. Policy conditions must not be split across chunks (Brief §9 chunking rule). Recommend approving these **last** in the wave. |

**Verified NON-candidates** (checked, deliberately excluded):

| Surface | Verified state | Why excluded |
|---|---|---|
| `/blog` | `app/(consumer)/blog/page.tsx` exists but calls `notFound()`; no posts; excluded from the sitemap (P-004) | There is no content to ingest. A route that 404s is not a source. |
| Reviews | `lib/data/reviews.ts` | User-generated text. Class not decided (§8); an untrusted-input surface — treat as data, never instructions (`AI_SAFETY_PRIVACY_POLICY.md` §4). |
| `docs/*.md` | Present, but `AI_SAFETY_PRIVACY_POLICY.md`, `ARCHITECTURE_AI_PLATFORM.md`, `MASTER_IMPLEMENTATION_PLAN.md` are all **DRAFT — PROPOSED / not ratified** | Ingesting an unratified draft would let the assistant state proposed policy as current policy. Blocked by HG-8 regardless (Internal class). |
| `lib/data/admin-*.ts`, `library.ts`, `reading.ts`, `author-portal.ts` | Present | User-private / Author-private / Internal. Out of the Public first wave by definition. |

## 5. Workflows

### 5.1 Registration

| Step | Action | Exit condition |
|---|---|---|
| 1. Propose | Add a row with status `PROPOSED`; fill fields 1–2, 5–8, 10. Verify the canonical path exists at current HEAD. | Row present; path verified |
| 2. Classify | Assign field 4 against `AI_SAFETY_PRIVACY_POLICY.md` §2. Cannot be left blank — blank is Restricted and stops here. | Class recorded |
| 3. Owner approve | Named owner (field 3) signs fields 12–13 under HG-8 authority. Restricted/Author-private additionally require the separate action in §6. | Status `APPROVED` |
| 4. Ingest | Run the Brief §9 stages (extract → normalize → chunk → metadata → embed/index) per `ARCHITECTURE_AI_PLATFORM.md` §4. Index namespace must be partitioned by environment **and** classification. | Status `INGESTED`; extraction report + 100% metadata schema validation |
| 5. Verify | Recall benchmark **and** the forbidden-source test: confirm no non-registered source is retrievable and no class-mismatched chunk returns for a given audience. | Both tests pass; evidence linked from the row |
| 6. Review on cadence | Re-verify at the field-8 date per §7. | New review date, or expiry |

**Failure rule:** any step that cannot produce its exit condition returns the row to `PROPOSED` and requires teardown of anything already ingested via §5.2.

### 5.2 Deletion and expiry

Triggers: review date passed without re-approval; source content withdrawn or unpublished; classification reclassified upward; owner revocation; incident.

| # | Required teardown step | Evidence |
|---|---|---|
| 1 | Remove the source record and mark the row `DELETED` or `EXPIRED` (never delete the row — keep the audit trail; never reuse the Source ID) | Registry diff |
| 2 | Delete all derived chunks, metadata rows, and embeddings in every index namespace and environment | Deletion audit |
| 3 | **Negative-retrieval test** — query for known content from the removed source and confirm zero hits across all audiences (Brief §9 Deletion row) | Negative retrieval test result |
| 4 | Purge caches and any conversation-store copies subject to the retention schedule | Cache/store confirmation |

Expiry is **fail-closed**: a row past its review date is treated as not registered, and retrieval must exclude it before a human reviews it.

## 6. Prohibited sources

Never registrable through the §5 workflow. Adding any of these requires a **separate, explicit owner decision plus legal sign-off**, recorded outside this registry — an APPROVED row here is not sufficient authority.

| Prohibited source | Basis |
|---|---|
| Unpublished manuscript text | HG-3 (OPEN — standing recommendation **NO**; any future use is opt-in and staff-scoped only). Also `AI_SAFETY_PRIVACY_POLICY.md` §3.2 |
| Contracts, rights terms, licensing agreements | Restricted class; §3.3 |
| Payment data (card data, payout details, payment-intent sensitive fields) | §3.5 |
| Secrets, credentials, keys, tokens, connection strings | §3.1; `docs/SECRET_INVENTORY.md` rule — names and store identifiers only, never values |
| Customer PII beyond the minimum the current authenticated skill requires | §3.4 |
| Internal editorial notes, submission status, private author correspondence | Author-private / Internal class |
| Legal matters, security findings, incident detail | Restricted / Internal class |

Ingesting anything in this table is a **security incident**, not a bug (`AI_SAFETY_PRIVACY_POLICY.md` §3).

## 7. Freshness and review cadence

| Source type | Reingest trigger | Review cadence | On breach |
|---|---|---|---|
| Catalog / author / genre data (C1–C3) | Record change (publish, unpublish, visibility flip, metadata edit) | Quarterly spot-check | Unpublish must expire derived chunks **immediately**, not on cadence |
| Static informational pages (C4–C9) | Commit touching the file | Every 6 months | Row expires; excluded from retrieval until re-approved |
| Published legal pages (C10) | Any edit, plus the page's own "Last updated" changing | Every 6 months, and on every edit | Superseded policy versions expire at once — never answer from a stale policy |

Rules: reingest on change, expire superseded policies and unpublished revisions (Brief §9 Freshness). Every answer citing a source must carry its source ID and last-updated metadata. Freshness SLA reporting is deferred to T-07.2.

## 8. Open decisions

| # | Decision | Owner | Blocks | Status |
|---|---|---|---|---|
| HG-8 | Internal knowledge sources — register + classify | Owner | All of §3; T-07.1, T-10.1 | **OPEN** — no row may be approved until ratified |
| HG-3 | Unpublished-manuscript use in AI | Owner | §6 row 1; T-07.2 | **OPEN** — recommendation **NO** (opt-in, staff-scoped) |
| KSR-1 | Who is the standing **classification owner** (may set field 4 and sign field 12)? Named human required; "the team" is not an answer. | Owner | Every future registration | **OPEN** |
| KSR-2 | Does the first wave approve C1–C10 as one batch, or catalog (C1–C3) first and pages second? | Owner | Sequencing of T-07.2 | **OPEN** — recommend catalog first |
| KSR-3 | Classification of user-generated reviews | Owner + legal | Any future review ingestion | **OPEN** — default Restricted until decided |

**Verification:** every repo path cited above was confirmed to exist by read-only inspection of `origin/main` at `36f7528`. No file in the clone was modified. No source was ingested, indexed, or retrieved in the production of this document. Rollback = revert the docs commit.
