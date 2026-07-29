# QA Master Matrix — Mangu Publishers

> **DRAFT — PROPOSED** · v0.1.0 · 2026-07-29 · Proposed repo path: `docs/QA_MASTER_MATRIX.md`
> **Authority:** This document **complements and never supersedes** `docs/NEXT_GO.md` (launch gates G1–G13) and `docs/OPERATOR_QA_LOG.md` (evidence rules). It is the Master Brief §14 governance skeleton (delta report §8 E13, PR-D1). Owners are **TBD** pending owner sign-off.
> **Repo state cited:** `redinc23/my_publishing` HEAD `8246424` (2026-07-29). All counts/filenames below verified against that clone.

## 1. Purpose

One place that answers: for each QA layer the brief mandates, what exists today, what is missing, who owns closing it, and in which governance phase it may be closed. Phases follow delta report §8: **Now** = permitted under freeze #209 (docs / truthful-CI / approved fixes), **Thaw** = after controlled thaw, **Post-GO** = after G1–G13 TRUE.

## 2. Evidence rules (inherited, not redefined)

- Evidence classes are exactly `docs/NEXT_GO.md` §2: **VERIFIED (repo)** — confirmed at an exact HEAD SHA; **VERIFIED (live)** — GitHub API / production observation, dated; **DOC-ONLY** — claimed by a repo document, not independently re-run; **PROPOSED** — not yet executed.
- Every QA run that feeds a gate gets an **append-only** row in `docs/OPERATOR_QA_LOG.md` using its existing columns (`UTC | Actor | Env | SHA / ref | Test-Gate | Action | Expected | Actual | Result | Artifact / follow-up`). Rows are never edited or deleted; corrections are new rows. Every row cites the exact commit SHA tested.
- A layer may be marked covered here only with a VERIFIED evidence class; DOC-ONLY claims stay flagged as such.

## 3. Layer matrix (Brief §14 → repo reality)

| Layer | Mandatory coverage (Brief §14) | Current state (verified at HEAD) | Gap | Owner | Target phase |
|---|---|---|---|---|---|
| Unit | Business logic, schemas, permission decisions, skill routing, prompt builders, parsers, cost calculations | `tests/unit/` **62 files** (Jest), incl. `middleware-rbac`, `reading-entitlement`, `webhook-order-idempotency`, `stripe-webhook-consolidation`, `rate-limit-fail-closed`, `migration-drift`, dual-run `data-*` suites. CI stage: `npm test` runs after gap-ledger/type-check/lint, before build (`.github/workflows/ci.yml`) | AI-side units (skill routing, prompt builders, cost calc) — no AI runtime exists yet (delta §3) | TBD | Now (keep green); AI units with E06 (Thaw) |
| Integration | Auth+DB, catalog APIs, Stripe, Blob, Sentry, retrieval, vector store, tool gateway, approval flow | `tests/integration/` **2 files**: `manuscript-rls.test.ts`, `manuscript-storage-policies.test.ts` | Thinnest real layer. No Stripe/Blob/Sentry/vector-store/tool-gateway integration suites; auth+DB integration is unit-mocked only | TBD | Thaw |
| E2E | Anonymous browse, signup, verification, login, search, book detail, purchase, library, author submission, AI question, escalation | `tests/e2e/` **8 specs** (Playwright): `accessibility`, `auth-flow`, `purchase-flow`, `rate-limit-abuse`, `rbac-matrix`, `role-gating`, `smoke-auth`, `smoke-stripe`. **Not wired into `ci.yml`** (Jest only); run via `npm run test:e2e`, BASE_URL-switchable | Full paid checkout, webhook e2e, entitled reading, author submission, admin publish happy path (see §4). E2E absent from CI. AI question/escalation n/a until assistant exists | TBD | Now (log runs) / Thaw (new specs) |
| AI evaluation | Golden questions, citations, insufficient-evidence, role isolation, tool correctness, adversarial, multilingual | **Nothing** — no LLM inference in repo (delta §3: zero chat calls) | Entire layer. Blocked on E06 platform + `docs/AI_EVALUATION_PLAN.md` (drafted in parallel, §7) | TBD | Spec Now; build Thaw; gate Post-GO |
| Security | OWASP, auth/session, RBAC, IDOR, injection, prompt injection, SSRF, secrets, upload scanning, webhook verification | RBAC e2e (`rbac-matrix`, incl. forged `mangu-role` cookie tests; `role-gating`), rate-limit e2e, webhook signature+idempotency units, `mcp-transport-security` unit, hardening units (`api-route-hardening`, `admin/partner-portal-hardening`) | No scheduled OWASP/dependency scan workflow at HEAD (only `ci.yml`, `merge-steward.yml`, `rotate-supabase-key.yml`). Open risk R1 (unsigned role cookie) until PR-S1. Prompt-injection n/a yet | TBD | R1 Now (class 5); scans Thaw |
| Accessibility | WCAG **2.2** AA; keyboard, screen reader, focus, contrast, motion, forms, dialogs, chat, media controls | Program is real: `docs/operations/ACCESSIBILITY_AUDIT.md` (standard **WCAG 2.1 AA** — brief asks 2.2), `accessibility.spec.ts` (9 describes: catalog, PDP, audio player, auth, checkout, dialogs, contrast, bypass blocks, admin form). First automated run vs production 2026-07-29: **21 pass / 2 fail / 18 skip** (PR #364) | 2 fails open (A11Y-020 checkout `<h1>`, seed cover naming); 18 skips; manual keyboard + screen-reader passes not yet run; 2.1→2.2 uplift unscoped | TBD | Now (fixes are freeze class 1/2-adjacent, else Thaw) |
| Performance | Core Web Vitals, API p95, search, retrieval latency, streaming start, load/burst | `tests/k6/` **1 file** (`load-test.js`). No perf stage in CI; `health-check.yml`/`lighthouse-ci.yml` were deleted in CI minimization (delta §2) | No recurring CWV/latency measurement; k6 never wired to a gate; no budgets defined | TBD | Thaw |
| Resilience | Provider outage, DB outage, vector outage, stale cache, partial tool failure, retry storm, duplicate webhook, rollback | Partial by construction: fail-closed limiter + MCP guard units, `webhook-order-idempotency` (duplicate webhook), Resonance fallback chain | No chaos/outage drill suite; Supabase-pause NXDOMAIN mode (risk R4) untested; see §10 proposal | TBD | Spec Now; drills Thaw/Post-GO |
| Data integrity | Counts, checksums, references, entitlements, orders, files, user identities, search index freshness | Units: `catalog-dupes`, `genre-counts`, `mongo-catalog-field-parity`, `schema-drift-dispositions`, `migration-drift`, dual-run parity suites | No cross-store reconciliation suite (Phoenix WS5 scope, delta §4); search-index freshness unmeasured | TBD | Thaw (with Phoenix WS5) |
| Visual | Responsive breakpoints + screenshot regression for core pages/states | **None** — no screenshot/visual assertions in repo; Playwright trace-on-retry only | Entire layer; see §9 proposal | TBD | Thaw |

## 4. Route × journey E2E coverage (launch-critical)

Mapping of launch-critical journeys to existing `tests/e2e/*.spec.ts`. "Partial" = page/negative-path covered, happy path not.

| Journey | Spec(s) at HEAD | Status |
|---|---|---|
| Anonymous browse (home, /books, /comics, /papers) | `purchase-flow.spec.ts` (homepage, listings, PDP load), `smoke-stripe.spec.ts` (listing renders), `accessibility.spec.ts` (catalog) | Covered |
| Signup / verify / login / reset | `auth-flow.spec.ts` (20 tests: login, register, reset, reset-confirm pages), `smoke-auth.spec.ts` (verify-email page) | Partial — form/page level; full email-loop happy path is manual (operator log header: "Manual browser steps still required for auth/checkout") |
| Search | `purchase-flow.spec.ts` ("search functionality works") | Partial — single smoke test |
| Book detail | `purchase-flow.spec.ts`, `accessibility.spec.ts` (PDP describe) | Covered (read-only) |
| Checkout → webhook → library → reading | `smoke-stripe.spec.ts` (checkout API 401/validation), `purchase-flow.spec.ts` (unpurchased reading gated), `smoke-auth.spec.ts` (library/reading auth-gated); webhook = unit only (`webhook-order-idempotency`, `stripe-webhook-consolidation`) | **GAP** — no paid happy path e2e; webhook liveness is P0-010/G8 operator evidence (two webhook route files, risk R5) |
| Author submission | none (unit `manuscript-migrations`; integration `manuscript-rls`, `manuscript-storage-policies`) | **GAP** in e2e |
| Admin publish | `accessibility.spec.ts` ("Admin book form (credentialed)") ; units `admin-publish-validation`, `admin-book-write-read-roundtrip` | **GAP** — no publish-flow e2e |
| RBAC denial (anon/role/forged cookie) | `rbac-matrix.spec.ts`, `role-gating.spec.ts`, `smoke-auth.spec.ts` (portal gating) | Covered |
| Rate-limit behavior (throttle, honest 429) | `rate-limit-abuse.spec.ts`, `friendly-429` unit | Covered |

## 5. Environments

| Tier | What runs | Notes |
|---|---|---|
| Local (Tier L) | Jest + Playwright against `npm run dev` (webServer auto-start, `http://localhost:3000`); 3 browsers (chromium/firefox/webkit) | Default when `BASE_URL` unset |
| CI (PR) | `ci.yml`: gap-ledger → type-check → lint → **Jest** → build, `USE_MOCKS=true`, dummy env; PRs to `main`, `audit/**`, `task/**` | Playwright **not** in CI; chromium-only if added (config) |
| Preview | Playwright with `BASE_URL=<preview URL>` (webServer skipped when remote) | PROPOSED as standard pre-merge step for UI PRs |
| Production | Playwright with `BASE_URL=https://www.mangu-publishers.com`; retries 2, workers 1 | First production run: a11y suite 2026-07-29, **21/2/18** (PR #364) — every prod run must be logged in `OPERATOR_QA_LOG.md` with SHA + result |

## 6. Browser / device matrix

Canonical artefact: `docs/operations/BROWSER_MATRIX.md` (fill-per-RC template; copies land in `docs/operations/browser-matrix-runs/`, blank Blocking cells block sign-off). **Recorded gap:** automated e2e is chromium-only in CI per `playwright.config.ts` (firefox/webkit local-only); cross-browser evidence is therefore manual until a CI matrix job exists (Thaw).

## 7. AI evaluation layer

Pointer: `docs/AI_EVALUATION_PLAN.md` (skeleton drafted in parallel, PR-D1). That plan owns golden sets, citation/refusal thresholds, adversarial and multilingual suites, and the release-gate wiring into the Command Center "AI quality" panel. This matrix only tracks its layer status (§3) — currently PROPOSED, blocked on E06.

## 8. Flake policy (PROPOSED)

1. CI retries stay at the configured 2 (`playwright.config.ts`); a test passing only on retry is a **flake**, not a pass.
2. Flakes get an issue within 24h, tagged `flake`, linked to the trace artifact (`trace: on-first-retry`).
3. Quarantine (skip-with-issue) allowed max 14 days; a quarantined spec cannot serve as gate evidence.
4. No `.only`/commented-out tests on main (`forbidOnly` already enforced in CI).
5. Deleting a failing test requires the same review class as the code it covered.

## 9. Visual regression (PROPOSED — missing today)

- Adopt Playwright `toHaveScreenshot()` on the §4 launch-critical pages × 3 breakpoints (mobile/tablet/desktop), chromium first.
- Baselines committed per SHA; updates reviewed as UI diffs in PR.
- Start set: home, /books, PDP, login/register, checkout, library, 404/429 honest states.
- Phase: Thaw (new dev-dependency surface is outside freeze classes).

## 10. Resilience / chaos drills (PROPOSED — missing today)

Scripted drills, each producing an OPERATOR_QA_LOG row; never run against production without owner approval:
- **Provider outage:** kill Mongo / Supabase env in a preview deploy; expect honest degradation, no blank pages (fail-closed limiter behavior already unit-tested).
- **Supabase-pause NXDOMAIN mode (risk R4):** simulate paused project DNS failure; verify ISR cache does not mask the outage and `/api/health?ready=1` goes red; runbook `docs/PHOENIX_CUTOVER_RUNBOOK.md`.
- **Duplicate/replayed webhook:** replay Stripe events against the single surviving endpoint (post P0-010); assert idempotency end-to-end, not just in unit.
- **Retry storm / burst:** k6 `load-test.js` profile against preview; record p95 + limiter behavior.
- Phase: spec Now (this section); execution Thaw/Post-GO.

## 11. Change control

This matrix versions with the repo. Any row changed to "Covered" must cite a VERIFIED evidence class + log row in the same PR. Conflicts with `NEXT_GO.md` or freeze #209 resolve in their favor (delta report §6 order of authority). Next revision: assign owners, and decide WCAG 2.1→2.2 uplift scope (owner decision, feeds §3 Accessibility row).
