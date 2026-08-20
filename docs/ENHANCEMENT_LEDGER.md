# Enhancement Ledger — ranked product backlog

Authority: `.claude/skills/mangu-navigator/references/enhancement-engine.md`.  
Freeze rule: **discovery never stops; shipping is lane-gated.** L0/L1 may ship
now under NEXT_GO permitted classes; L2 needs owner approval; L3+ waits for GO
or explicit unfreeze in `HUMAN_TASKS.md` / `CLAUDE.md`.

Statuses: `PROPOSED` → `APPROVED` → `BUILDING` → `SHIPPED(flag)` → `PROMOTED` / `KILLED`.

Seeded 2026-07-20 from navigator SCOUT @ `9a8a940`. Re-run
`.claude/skills/mangu-navigator/scripts/enhance-scan.sh` before each SCOUT pass.

---

### E-001 Honest book-clubs placeholder

Lane: L0 · Status: SHIPPED · Score: R3 I3 C5 /E1 = 45
Story: As a reader, I see an honest status (not fake “Coming Soon” that looks live) on book clubs.
Evidence: stub surface under `app/(consumer)/book-clubs`; G6 no false-success
Metric & target: zero false-success complaints on that route; G6 closer to TRUE
Flag: n/a (truth fix; remove misleading CTA if present)
Gate/Star tie: G6
Effort: S · Risk: none · Verification: `npm test -- tests/unit/book-clubs-honesty.test.ts`
Approval: not required (L0)
Shipped: `/book-clubs`, `/discover/book-clubs`, discover hub CTA → honest “Not available yet” (#325)

### E-006 MCP catalog dual-run (Phoenix prep)

Lane: L1 · Status: SHIPPED · Score: R4 I4 C5 /E2 = 40
Story: As an operator/agent, catalog MCP tools keep working when DATABASE_PROVIDER flips to mongodb.
Evidence: `lib/mcp/catalog.ts`; tool names stable; default supabase
Metric & target: health returns provider; smoke green on both providers in staging
Flag: n/a (provider switch already gated)
Gate/Star tie: North Star migration parity / MCP ops
Effort: M · Risk: response field drift · Verification: unit + mcp-transport-security
Approval: not required (L1 hardening / migration parity)
Shipped: 2026-07-20 — PR `cursor/mcp-dual-run-catalog-f698` (#324)

### E-002 Replace console.log with structured logger in app/lib

Lane: L0 · Status: PROPOSED · Score: R2 I3 C5 /E2 = 15
Story: As an operator, I get structured logs instead of raw console noise in production.
Evidence: enhance-scan hygiene signal; WS6 / `mangu-observability` path
Metric & target: `console.log` count in app+lib → 0
Flag: n/a (hygiene)
Gate/Star tie: North Star #8 (hardening)
Effort: S · Risk: log volume · Verification: `grep -r console.log app lib | wc -l` → 0
Approval: not required (L0)

### E-003 Friendly 429 / rate-limit UX

Lane: L1 · Status: SHIPPED(flag) · Score: R4 I3 C4 /E2 = 24
Story: As a reader hitting rate limits, I see a clear retry message instead of a blank error.
Evidence: WS6 rate-limit contract; CCR-019 a11y on critical states
Metric & target: 429 responses render Retry-After guidance; support tickets ↓
Flag: NEXT_PUBLIC_FEATURE_FRIENDLY_429 (default off until measured)
Gate/Star tie: North Star #8
Effort: S · Risk: none · Verification: unit tests in `tests/unit/friendly-429.test.ts`; enable flag in preview
Approval: not required (L1 hardening-adjacent)
Shipped: 2026-07-20 — `lib/rate-limit-response.ts` + `/too-many-requests` page; middleware wired.

### E-004 Metadata coverage for pages missing generateMetadata

Lane: L2 · Status: PROPOSED · Score: R5 I4 C4 /E3 = 26.7
Story: As a search crawler / social sharer, every public page has correct title/description/OG.
Evidence: enhance-scan SEO gap (~24 of 61 pages lack metadata)
Metric & target: 100% of public `page.tsx` export metadata; OG share previews correct
Flag: n/a (SEO hygiene; ship page-by-page)
Gate/Star tie: post-GO growth (or owner change-control during freeze)
Effort: M · Risk: wrong titles · Verification: crawl sample + Lighthouse SEO
Approval: required for L2 during freeze

### E-005 Audio↔text position sync (signature differentiator)

Lane: L3 · Status: PROPOSED · Score: R5 I5 C3 /E5 = 15
Story: As a reader, I switch between listening and reading and resume at the same place.
Evidence: benchmark map — few competitors do this well; MANGU has both engines
Metric & target: session resume cross-mode ≥80% within 30s of last position
Flag: NEXT_PUBLIC_FEATURE_AUDIO_TEXT_SYNC (default off)
Gate/Star tie: post-GO growth
Effort: L · Risk: scope / sync correctness · Verification: e2e cross-mode resume
Approval: wait for GO or explicit unfreeze

### E-007 Honest blog empty-state copy pass

Lane: L0 · Status: SHIPPED · Score: R2 I2 C5 /E1 = 20
Shipped: superseded by a stronger fix — `app/(consumer)/blog/page.tsx` ships
`notFound()` + `robots: { index: false }` (Task 4.6), so no empty-state copy is
reachable. Verified 2026-08-20; scouts should stop re-proposing this.
Story: As a reader, the blog page does not imply a live editorial feed when no posts exist.
Evidence: enhance-scan stub `app/(consumer)/blog/page.tsx` @ 625f46d
Metric & target: G6 honesty; no false “newsroom” cues
Flag: n/a
Gate/Star tie: G6
Effort: S · Risk: none · Verification: visual QA `/blog`
Approval: not required (L0)

### E-008 Route-level code-splitting for heavy clients

Lane: L2 · Status: PROPOSED · Score: R4 I4 C3 /E3 = 16
Story: As a visitor, first load ships less JS by dynamically importing heavy reader/audio clients.
Evidence: enhance-scan — 90 `use client` vs 1 dynamic import
Metric & target: LCP/TBT improvement on `/books/[slug]` and reader routes
Flag: NEXT_PUBLIC_FEATURE_ROUTE_SPLIT (default off)
Gate/Star tie: post-GO / owner change-control
Effort: M · Risk: hydration · Verification: bundle analyzer before/after
Approval: required for L2 during freeze

---

## Intake — 2026-08-20 eight-scout sweep (PROPOSED, pending full scoring)

Source: 8-domain parallel audit (phoenix burn-down, UI/UX, perf, SEO, a11y,
security, quality/CI, gates/ledger) + synthesis, run 2026-08-20 on `main`
@ `2bfebf7`. The sweep's ship-now slice landed as the
`claude/website-improvements-zxivd8` PR; everything deferred is recorded here
so the burn-down is tracked. Promote to full `E-###` entries when picked up.

| Id    | Lane/Effort | Item                                                                                                                                                                                                                                                            |
| ----- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| E-009 | L1/S        | Dual-run auth on checkout money-path: swap `supabase.auth.getUser()` for the existing `getRequestUser()` shim in `app/api/checkout/route.ts` + `app/checkout/page.tsx` — the last non-dual-run link in purchase→webhook→download. Own PR (`feat/phoenix-ws2b`). |
| E-010 | L1/S        | Delete dead Supabase export chain `lib/services/export-queue.ts` + `lib/actions/export-data.ts` (667 LOC, zero importers verified) — removes 2 files from the WS4 grep-zero target.                                                                             |
| E-011 | L1/S        | WS3 parity: add `https://*.public.blob.vercel-storage.com` to CSP img-src in `next.config.js`; add `STORAGE_PROVIDER` + `BLOB_READ_WRITE_TOKEN` to all three `.env*.example` files. Inert until the storage flip; blocks covers at cutover if missed.           |
| E-012 | L1/M        | Rewire `app/sitemap.ts` onto the dual-run `lib/data` layer; skip slug-less books (it emits `/books/{id}` URLs the slug-only PDP 404s).                                                                                                                          |
| E-013 | L1/L        | WS2 remnant burn-down: 41 files with direct supabase `.from()` queries + 14 auth-session-only files needing `getRequestUser()`. Batch order: auth-only swaps → API-route reads → portals → email/resonance/services.                                            |
| E-014 | L2/M        | Supabase Realtime analytics (`lib/services/realtime-analytics.ts`, LiveReaders, `/api/analytics/stream`) has no Mongo equivalent — owner decision: SSE/polling replacement vs graceful degrade vs documented post-GO gap.                                       |
| E-015 | L1/M        | Rate limiting delta vs WS6 spec: add `enforceRateLimit` to `/api/files/[id]` and `/api/session`; implement blanket `/api/*` limit in middleware or amend the Phoenix WS6 verification text to the per-route bucket model actually shipped.                      |
| E-016 | L1/M        | Add mock-mode Playwright job to `ci.yml` (contract rule 6 requires Jest+Playwright before merge; mock E2E already proven locally per OPERATOR_QA_LOG).                                                                                                          |
| E-017 | L1/M        | `/books` pagination UI: thread `total` out of BookListStream and render the existing pagination component — catalog currently unreachable past book 20 (owner freeze-read call).                                                                                |
| E-018 | L1/S        | `/genres/[genre]` soft-404: `notFound()` or noindex when a genre has zero published books (unbounded indexable thin pages today).                                                                                                                               |
| E-019 | L1/S        | Perf batch: drop framer-motion from Footer/BookCard (~30KB gz off first-load); delete dead font preconnects + vimeo dns-prefetch in `app/layout.tsx`; uninstall unused chart.js/react-chartjs-2/d3/lodash/react-window.                                         |
| E-020 | L1/S-M      | Cache batch: `unstable_cache` for `getTrendingBooks` (match `getFeaturedBooks`); public-catalog client + default-view caching for `listPublishedBooks`; singleton-ize `lib/supabase/admin.ts`.                                                                  |
| E-021 | L1/S        | Re-wire `AnalyticsDashboard.tsx` imports through the orphaned ChartIsland dynamic wrapper to restore the recharts code-split (PERF-PHASE2-4 built then bypassed).                                                                                               |
| E-022 | L1/S-M      | A11y batch: StarRating role/value announcement; PDP heading order + un-hidden ★ glyph; aria-hidden on homepage watermark spans; admin nested `<main>`; explicit light-on-dark text in fixed-dark sections; ReviewForm rating label association.                 |
| E-023 | L1/S        | Stop rendering raw `error.message` to users (`library/page.tsx`, `app/error.tsx`) — static copy + server-side logging.                                                                                                                                          |
| E-024 | L1/S        | Internal `<a href>` → `next/link` on verify-email, terms, privacy.                                                                                                                                                                                              |
| E-025 | L1/S        | `robots.ts`: use `getSiteUrl()` instead of raw env fallback (consistency with sitemap/layout/JsonLd).                                                                                                                                                           |
| E-026 | L1/S        | Hygiene: Jest worker open-handle leak (`--detectOpenHandles`, teardown/unref); add `validate:gap-ledger` to `pre-launch-verify.sh` and `prettier --check` to `ci.yml`.                                                                                          |
| E-027 | L0/S        | Structured-logger sweep (extends E-002): route remaining `console.log` call sites in app/+lib through `lib/logger`; verification `grep -r console.log app lib → 0`.                                                                                             |
| E-028 | human       | TODO(renee) decisions: confirm-or-remove `@mangupublishers` twitter handles + Organization sameAs links; six copy placeholders; product-gap-ledger ratification; C0.1 storm-automation re-verification.                                                         |
| E-029 | L2          | Retire `rotate-supabase-key.yml`, launch-ops Supabase steps, orphaned `cloudbuild.yaml` — Phase 14–15 only, per rollback rule 8. Do not delete now.                                                                                                             |

---

## How to add an entry

Copy the proposal template from
`.claude/skills/mangu-navigator/references/enhancement-engine.md`.
Assign the next `E-###` id. Never reclassify upward to ship sooner.
