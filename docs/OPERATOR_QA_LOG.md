# Operator QA Log

Automated checks from plan execution. Manual browser steps still required for auth/checkout.

## MongoDB Atlas scaffold (ADR-002, operator+agent, 2026-07-18)

**Scope:** Operator mid Atlas setup (cluster, DB user, Network Access, Drivers connection string). Agent scaffolds official `mongodb` driver, `lib/mongodb.ts`, env templates, optional readiness ping. Supabase remains required for GO readiness until auth + query cutover.

| UTC | Actor | Env | SHA / ref | Test-Gate | Action | Expected | Actual | Result | Artifact / follow-up |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-07-18 | operator | Atlas UI | — | ADR-002 | Deploy free cluster + DB user + Drivers URI | Cluster reachable | IN PROGRESS (Connect → Drivers) | IN PROGRESS | do not paste URI in chat |
| 2026-07-18 | agent | repo | this branch | ADR-002 | Scaffold Mongo client + env + health ping | Additive path; Supabase still owns ready | `mongodb` + `@vercel/functions`; `lib/mongodb.ts`; `MONGODB_URI` optional; health `checks.mongodb` | PASS (code) | `docs/adr/ADR-002-mongodb-data-platform.md` |

**Notes:** Next operator steps: (1) Network Access allow `0.0.0.0/0` for Vercel, (2) put `MONGODB_URI` in `.env.local` + Vercel Production (password substituted), (3) choose auth replacement (Clerk / Better Auth / Auth.js) before rewriting queries. Full Supabase removal is a later PR.

## MongoDB automation — db:mongo:up (ADR-002, agent-run, 2026-07-18)

**Scope:** Replace click-ops (Drivers / whitelist / Vercel paste) with idempotent Atlas Admin API + Vercel env sync. Agent has no Atlas API keys in this environment — operator runs once locally or via Actions secrets.

| UTC | Actor | Env | SHA / ref | Test-Gate | Action | Expected | Actual | Result | Artifact / follow-up |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-07-18 | agent | repo | this branch | ADR-002 | Add `npm run db:mongo:up` pipeline | Bootstrap/ping/indexes/Vercel sync | Scripts + `mongo-up.yml` workflow_dispatch; `DATABASE_PROVIDER=mongodb` hard-gates mongo ping | PASS (code) | secrets: `ATLAS_*`, `VERCEL_TOKEN` |
| 2026-07-18 | agent | cloud agent | this branch | ADR-002 | Execute live bootstrap | Cluster URI written | **BLOCKED** — no `ATLAS_PUBLIC_KEY`/`ATLAS_PRIVATE_KEY` in agent env | BLOCKED | operator: export keys + `npm run db:mongo:up` |

**Notes:** After keys exist, zero Atlas UI clicks required for network access / URI / Vercel. Auth rewrite still blocking for full Supabase removal.

## Phase 6 — ADR-001 ACCEPTED Option B (Vercel); dump Cloud Run (P0-003, operator+agent, 2026-07-18)

**Scope:** Operator decision: abandon Cloud Run as production authority; stick with Vercel. Agent records ACCEPTED ADR, retargets monitors to interim canonical `www`, rewrites canonical production checklist. **G9 stays FALSE** until Vercel `ready:true`.

| UTC | Actor | Env | SHA / ref | Test-Gate | Action | Expected | Actual | Result | Artifact / follow-up |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-07-18T05:48Z | operator | decision | post-#231 | P0-003 / G9 | Choose platform | One canonical platform | **Accept B — Vercel**; reject A (Cloud Run) | DECIDED | issue #190 |
| 2026-07-18T05:48Z | agent | public HTTPS | this branch | P0-003 evidence | Probe www vs apex vs vercel.app | Know cutover gap | `www` + `manguprojectz.vercel.app` → **503 ready:false** (missing Stripe keys); apex Cloud Run still **ready:true** (legacy) | VERIFIED | — |
| 2026-07-18T05:48Z | operator | signature | this branch | P0-003 | Sign ADR-001 | ACCEPTED Option B | Platform / RM / Eng = Chris (Solo Operator), Accept B @ 2026-07-18T05:48:00Z | PASS | `docs/adr/ADR-001-canonical-platform.md` |
| 2026-07-18 | agent | repo | this branch | P0-007 | Retarget monitors | Vercel interim origin | `health-check.yml` + `lighthouse-ci.yml` → `https://www.mangu-publishers.com` | PASS (code) | expect RED until Vercel env promoted |
| 2026-07-18 | agent | docs | this branch | Phase 6 | Rewrite CANONICAL_PRODUCTION | Vercel checklist; Cloud Run superseded | Cutover steps: Vercel env → ready:true → webhook → apex DNS → retire Cloud Run | PASS | `docs/CANONICAL_PRODUCTION.md` |

**Notes:** Signing unlocks the *decision* half of G9; evidence half requires Vercel Production secrets + green monitor. Apex DNS currently Cloud Run-only — Phase 15 must point apex at Vercel (re-add Vercel records; remove `216.239.*`). Do not use Cloud Run for GO after this acceptance.

## Phase 6/15 — health-check SSL flake from apex DNS split (P0-007 follow-up, agent-run, 2026-07-18)

**Scope:** Scheduled `Production Health Check` failed on first run after #227 retarget (run https://github.com/redinc23/my_publishing/actions/runs/29631499360). Soft startup probe aborted the job before readiness.

| UTC | Actor | Env | SHA / ref | Test-Gate | Action | Expected | Actual | Result | Artifact / follow-up |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-07-18T05:00Z | agent | Actions schedule | `c71689b` | P0-007 | Diagnose failed health-check | Find root cause | Live step 200; Startup step **curl exit 60** SSL SAN mismatch → `set -e` aborted job; readiness skipped | DIAGNOSED | run 29631499360 |
| 2026-07-18T05:03Z | agent | DNS/TLS | `c71689b` | Phase 15 / G9 | Inspect apex A + certs | Identify dual target | Apex A = Google `216.239.*.21` (cert `mangu-publishers.com`) **+** Vercel `76.76.21.21` (cert `www.mangu-publishers.com` only). Round-robin → intermittent SSL 60 | VERIFIED | ADR-001 evidence row |
| 2026-07-18 | agent | repo | this branch | P0-007 | Harden health-check.yml | Soft probes never abort; readiness retries | Soft live/startup capture curl failures; readiness 8 attempts with backoff; documents Phase 15 DNS fix | PASS (code) | `.github/workflows/health-check.yml` |
| 2026-07-18 | agent | repo | this branch | Phase 5 | Bug-to-issue dirty-tree fix | Rebase push reliable | `npm i --no-save` + `git pull --rebase --autostash` (supersedes draft #228/#230) | PASS | `.github/workflows/bug-to-issue.yml` |

**Notes:** Monitor can stay on canonical apex with retries. Permanent fix is operator DNS: delete Vercel A from apex (Phase 15). Do not use `curl -k` (hides real TLS defects).

## Phase 7 — migration reconciliation + order_items policy verify (P0-004/P0-015, agent-run, 2026-07-18)

**Scope:** Master Execution Specification v1.0 Phase 7. Export hosted migration history, classify vs repo, confirm tip policy for `order_items` SELECT (P0-015 schema). Supabase project `tkzvikozrcynhwsqtkqp` (`mangu-publishers`).

| UTC | Actor | Env | SHA / ref | Test-Gate | Action | Expected | Actual | Result | Artifact / follow-up |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-07-18T04:47Z | agent | Supabase MCP | main `bad4045` | P0-004 / G7 | Export hosted `schema_migrations` | Version list | **25** hosted rows; tip `20260717114300` / `order_items_select_own` | PASS | issue #192 |
| 2026-07-18T04:47Z | agent | repo vs hosted | `bad4045` | P0-004 | Classify diff | Applied / pending / remote-only | **Exact match** — 25 local files = 25 hosted; pending=0; remote-only=0. Prior "22 hosted" claim SUPERSEDED | PASS | `docs/MIGRATIONS.md` |
| 2026-07-18T04:47Z | agent | hosted SQL | `bad4045` | P0-015 / G7 | Verify `order_items` SELECT policy | Policy matches migration | Policy `Users can view own order items` cmd=SELECT; USING joins orders→profiles→`auth.uid()` — matches `20260717114300_order_items_select_own.sql` | PASS (schema) | issue #199; entitled nested-read still Phase 12/13 |
| 2026-07-18 | agent | docs | this branch | P0-004 | Update MIGRATIONS.md + recommend #184 close | Same-change docs | Reconciliation section + full order list; #184 close-as-superseded (no reorder needed) | PASS | PR #184 |

**Notes:** No forward migration apply required. G7 still FALSE pending production readiness package / Upstash live proof (P0-011). Operator: close #192 when satisfied; leave #199 open until library nested-read evidence in Phase 12/13.

## Phase 6 close-out — monitor live confirm after #227 (P0-007, agent-run, 2026-07-18)

**Scope:** Confirm post-merge monitors hit canonical apex (not Vercel preview).

| UTC | Actor | Env | SHA / ref | Test-Gate | Action | Expected | Actual | Result | Artifact / follow-up |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-07-18T04:43Z | agent | GitHub Actions | `bad4045` (#227) | P0-007 / G9 | Lighthouse on merge | Target canonical apex | Run https://github.com/redinc23/my_publishing/actions/runs/29631025058 — `TARGET_URL=https://mangu-publishers.com`; collected apex (workflow `\|\| true` so assertion noise non-blocking) | PASS (target) | issue #186 |
| 2026-07-18T04:47Z | agent | public HTTPS | `bad4045` | P0-007 | Apex readiness/startup | ready:true | `/api/health?ready=1` → 200 `ready:true`; `/api/health` → 200; cert SAN = `mangu-publishers.com` only (www cutover still Phase 15). Scheduled health-check not yet re-run on new YAML (agent cannot `workflow_dispatch` — 403); next cron ≈ :00/:15/:30/:45 | PASS (probe) | operator: confirm next scheduled Health Check run |
| 2026-07-18T04:43Z | agent | GitHub Actions | `bad4045` | Phase 5/G2 partial | CI on merge | Green | CI success https://github.com/redinc23/my_publishing/actions/runs/29631025037 | PASS | G2 still FALSE until release/deploy SHA |

## Phase 6 — ADR-001 Option A recommendation + monitor retarget (P0-003/P0-007, agent-run, 2026-07-18)

**Scope:** Master Execution Specification v1.0 Phase 6. Recommend Cloud Run as canonical platform (P0-003) and retarget health/Lighthouse monitors away from stale Vercel preview (P0-007 → G9). Agent cannot sign ADR — G9 stays FALSE until Platform / Release Manager / Engineering complete the signature block.

| UTC | Actor | Env | SHA / ref | Test-Gate | Action | Expected | Actual | Result | Artifact / follow-up |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-07-18T04:31Z | agent | public HTTPS | post-#226 `48b8146` | P0-003 / G9 | Re-verify apex vs www vs Vercel preview | Identify canonical live surface | Apex `mangu-publishers.com`: `server: Google Frontend`, `/api/health?ready=1` → **200 `ready:true`** (env/db/auth/migrations/stripe pass). `www`: still `server: Vercel`. `manguprojectz.vercel.app` readiness → `ready:false` (missing Stripe env) | VERIFIED (live) | issue #190 |
| 2026-07-18 | agent | repo | this branch | P0-003 | Draft ADR-001 Option A | Decision recorded; signatures blank | Status → **RECOMMENDED (Option A)**; rollback command; superseded Amplify docs; live evidence table; signature block empty | PASS (draft) | `docs/adr/ADR-001-canonical-platform.md` |
| 2026-07-18 | agent | repo | this branch | P0-007 / G9 | Retarget monitors + probe semantics | Canonical origin; readiness is GO probe | `health-check.yml` → `https://mangu-publishers.com` with live/startup (warn) + readiness hard-fail on `ready:true`; `lighthouse-ci.yml` `TARGET_URL` same. Owner alert = Actions failure → watchers | PASS (code) | issue #186; live confirm on next scheduled run |
| 2026-07-18 | agent | repo | this branch | Phase 5 close-out | Note #225 merged | Phase 5 CI hygiene landed | #225 merged 2026-07-18T04:29Z (Dockerfile scripts COPY removed; Trivy `--scanners vuln`; bug-to-issue `git pull --rebase`) | PASS | PR #225 |

**Notes:** **G9 remains FALSE** until ADR signatures. Phase 15 must cut `www` DNS to Cloud Run to end split-brain. Operator: sign ADR-001, then close #190/#186 when monitor run URLs confirm production responses.

## Phase 4 — Tier L local release-SHA verification (agent-run, 2026-07-18)

**Scope:** Master Execution Specification v1.0 Phase 4 / Tier L → supports G2 (exact-SHA local evidence). No cloud credentials required. Verified against `origin/main` tip `a0a9cf5` (code tip = #223 `5744794` + subsequent bug-to-issue state chores).

| UTC | Actor | Env | SHA / ref | Test-Gate | Action | Expected | Actual | Result | Artifact / follow-up |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-07-18T04:19Z | agent | local (Node 22.14 / nvm 22.22) | `a0a9cf59370a14c019a30ca0d69d45da80165470` | Phase 4 / Tier L | `SKIP_NPM_CI=1 bash scripts/pre-launch-verify.sh` | All local gates green | **11/11 PASS**: node/.nvmrc, npm ci (skip — modules present), validate-env, type-check, lint, prettier --check, unit tests **127/127** (24 suites), migration files (25), production build (CI mock env), secret pattern scan, HTML doctype/fence | PASS | `/tmp/tier-l-verify.log` |
| 2026-07-18T04:21Z | agent | local mock E2E | `a0a9cf5` | Phase 4 / Tier L | `USE_MOCKS=true` Playwright chromium (CI-shaped placeholders) | Smoke suites pass; real-backend suites skip honestly | **36 passed, 35 skipped**, 0 failed (1.2m). Skips = auth-flow/role-gating without real Supabase (CCR-010) | PASS | `/tmp/mock-e2e.log` |
| 2026-07-18T04:22Z | agent | local `npm run dev` + mock/placeholder env | `a0a9cf5` | Phase 4 / Tier L | Local health probes | Startup/live OK; readiness may fail closed without real backends | `/api/health` → **200** `status:ok` probe=startup; `/api/live` → **200** `alive`; `/api/health?ready=1` → **503** `ready:false` (DB/migrations/stripe fail against placeholders — expected, not G7) | PASS (Tier L) | — |
| 2026-07-18T03:52Z | agent | GitHub Actions | `574479411261f4fbb36d987c83d1c2ea5b870ac9` (#223) | Phase 5 / G2 (partial) | Confirm main CI after MCP route-export fix | Required workflows green on code tip | **CI / Format Check / CodeQL / Lighthouse / Playwright E2E / Release Please = success**. Run: https://github.com/redinc23/my_publishing/actions/runs/29629590731 | PASS | issue #200 follow-up; G2 still FALSE until release/deploy SHA |
| 2026-07-18 | agent | repo | this branch | Phase 4 hygiene | Strip UTF-8 BOM from `scripts/pre-launch-verify.sh` | Shebang executes cleanly | BOM caused `#!/usr/bin/env: No such file or directory` before body ran; stripped → `23 21 2f 75 73 72…` | PASS | `scripts/pre-launch-verify.sh` |

**Notes:** Tier L does **not** flip G1/G7 (production deploy/readiness) or G2 (needs green on the eventual release SHA). Readiness 503 under placeholders is honest fail-closed. Observed related CI noise (not blocking Tier L): bug-to-issue state push race on concurrent main updates — tracked by draft PR #225 (`git pull --rebase` before push). Operator next: Phase 6 ADR-001 / monitor retarget, or Phase 7 hosted migration reconcile when Supabase access is available.

## Phase 5 — preview-E2E BASE_URL / real-target semantics (P0-005, agent-run, 2026-07-18)

**Scope:** Master Execution Specification v1.0 Phase 5 / P0-005 → G2. The `E2E against Preview` workflow set `BASE_URL` to the deployment URL, but `playwright.config.ts` hardcoded `baseURL: 'http://localhost:3000'` and unconditionally booted a local dev server — so "preview E2E" silently tested a local mock server, never the deployed preview. It also forced `USE_MOCKS=true` + placeholder Supabase env against a real target, making real-backend suites skip and results dishonest.

| UTC | Actor | Env | SHA / ref | Test-Gate | Action | Expected | Actual | Result | Artifact / follow-up |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-07-18 | agent | repo | branch base `3fc8998` | P0-005 / G2 | Diagnose preview-E2E target | Identify why BASE_URL was ignored | `playwright.config.ts` hardcoded `baseURL: localhost:3000` + always-on `webServer`; workflow's `BASE_URL` env never read → preview runs tested a local placeholder-env server, not the deployment | DIAGNOSED | issue #194 |
| 2026-07-18 | agent | local (Node 22) | branch `claude/mangu-phase-1-authority-sv2hyn` | P0-005 / G2 | Honor BASE_URL | Remote target when set; local otherwise | Config now uses `process.env.BASE_URL ?? localhost:3000` as `baseURL` and omits `webServer` entirely when `BASE_URL` is set (no local server against a remote target) | PASS | `playwright.config.ts` |
| 2026-07-18 | agent | repo | branch | P0-005 / G2 (truthfulness) | Remove mock env from preview workflow | Real target, no mocks | `preview-e2e.yml` drops `USE_MOCKS=true` + all placeholder Supabase/Stripe env; only `BASE_URL` passed. Real-backend suites (auth-flow, role-gating) self-skip unless real `NEXT_PUBLIC_SUPABASE_URL` is provided — honest, not faked | PASS | `.github/workflows/preview-e2e.yml` |
| 2026-07-18 | agent | local | branch | Verification | Run toolchain | Green | New `tests/unit/playwright-config.test.ts` (3 cases: default local, BASE_URL remote w/o webServer, CI chromium-only) pass; full suite 127/127 across 24 suites; `tsc --noEmit` clean; prettier 3.8.4 clean | PASS | `tests/unit/playwright-config.test.ts` |

**Notes:** Live proof requires an actual preview deployment event (`deployment_status` → environment `Preview`) — recorded as the CI/operator confirmation step, observable on the next preview deploy. Optional follow-up for the operator: provide real `NEXT_PUBLIC_SUPABASE_URL` (+ TEST\_\* creds) as repo secrets to un-skip real-backend suites against previews. **G2 stays FALSE** pending green pipeline evidence at the candidate SHA.

## Phase 5 — bug-to-issue workflow trigger repair (P0-006, agent-run, 2026-07-18)

**Scope:** Master Execution Specification v1.0 Phase 5 / P0-006 → G2. The `bug-to-issue` automation (opens/closes an issue on continuous CI failure) never ran because its `workflow_run` trigger listened for a workflow named `CI/CD Pipeline`, which does not exist — the CI workflow's `name:` is `CI` (`ci.yml`). Verified via a full scan of `.github/workflows/*` `name:` fields.

| UTC | Actor | Env | SHA / ref | Test-Gate | Action | Expected | Actual | Result | Artifact / follow-up |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-07-18 | agent | repo | branch base `a371831` | P0-006 / G2 | Diagnose dead trigger | Identify why bug-to-issue never fires | `bug-to-issue.yml` `workflow_run.workflows: ['CI/CD Pipeline']`; no workflow has that name (CI = `CI`). `workflow_run` matches by `name`, so the event never fired | DIAGNOSED | `.github/workflows/*` name scan |
| 2026-07-18 | agent | repo | branch | P0-006 / G2 | Fix trigger + reset stale state | Trigger matches real CI; clean state | Trigger → `workflows: ['CI']`; `.github/bug-to-issue-state.json` reset to empty `items` (3 stale `CI/CD Pipeline` entries, all `issueNumber: null` → nothing lost). Signature hash includes `workflow:<name>`, so no collision with new `CI` runs | PASS | issue #188 |
| 2026-07-18 | agent | repo | branch | Verification | Validate | Green | YAML parses (trigger `["CI"]`); state JSON valid (0 items); `node --check bug-to-issue.js` OK; no `CI/CD Pipeline` refs remain; prettier clean | PASS | — |

**Notes:** Live proof (an actual failing `CI` run opening an issue, then a passing run closing it) can only be observed once CI next fails on `main` — recorded here as the operator/CI confirmation step. This repair makes the continuous-failure detector actually reachable (G2 truthfulness).

## Phase 8 — MCP transport security (P0-017, agent-run, 2026-07-18)

**Scope:** Master Execution Specification v1.0 Phase 8 / P0-017 → G7. The public `/api/mcp/[transport]` endpoint was open, unauthenticated, and uncapped. Operator decision (2026-07-18): MCP is not a launch-MVP surface → **disabled by default, safe when enabled** (least-privilege / honest-scope; low-maintenance for a solo operator). Verified locally with the repo toolchain.

| UTC | Actor | Env | SHA / ref | Test-Gate | Action | Expected | Actual | Result | Artifact / follow-up |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-07-18 | agent | local (Node 22) | branch `claude/mangu-phase-1-authority-sv2hyn` | P0-017 / G7 | Gate MCP behind `MCP_ENABLED` | 404 unless explicitly enabled | `mcpGuard` returns 404 when `MCP_ENABLED!=='true'`; enabled only for exact `'true'`. Endpoint is off by default (CCR-008, CCR-018) | PASS | issue #200; `app/api/mcp/[transport]/route.ts` |
| 2026-07-18 | agent | local | branch | P0-017 / G7 (CCR-007) | Fail-closed rate limit when enabled | Reject on limiter reject/unavailable | When enabled, each request runs `enforceRateLimit('api', 'mcp:'+clientIp)`; 429 (+`Retry-After`) on `limited` or fail-closed `unavailable` | PASS | shared limiter `lib/rate-limit.ts` |
| 2026-07-18 | agent | local | branch | P0-017 (input hygiene) | Harden `search_books` filter | No PostgREST `.or()` injection | `sanitizeSearchQuery` strips `,()%*\:` and caps length before the `ilike` pattern; empty-after-sanitize returns `[]` | PASS | — |
| 2026-07-18 | agent | local | branch | Phase 8 verification | Run toolchain | Green | `tsc --noEmit` clean; `next lint` clean; new `tests/unit/mcp-transport-security.test.ts` (8 cases: gate/limit/sanitize) pass; full suite green | PASS | `tests/unit/mcp-transport-security.test.ts` |

**Notes:** New env `MCP_ENABLED` (default off) — MCP stays dark in production unless the operator opts in, at which point it is rate-limited and input-sanitized. Broader "use Notion/other MCPs as inbound tooling" is a **post-launch** operator initiative, out of launch scope — not a gate dependency. **G7 stays FALSE** pending live readiness/health + P0-011 Upstash confirmation in Phase 14/12.

## Phase 9 — Product Truth: contact / newsletter / homepage stats (agent-run, 2026-07-18)

**Scope:** Master Execution Specification v1.0 Phase 9 (P0-012, P0-013, P0-014 → G6 "no false success"). Removes three false-success surfaces and replaces them with honest, env-gated behavior per the locked launch scope (§7). Verified locally with the repo's real toolchain (Node 22, `npm ci`). No external services called — Resend paths are unit-tested via mocks; operator confirms live behavior in Phase 12.

| UTC | Actor | Env | SHA / ref | Test-Gate | Action | Expected | Actual | Result | Artifact / follow-up |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-07-18 | agent | local (Node 22) | branch base `9b4ce45` | P0-014 / G6 | Replace fabricated homepage StatsBar | No unverifiable stats | `StatsBar` now takes real counts; `StatsBarSection` (server) fetches published/public book + author counts via admin client, filters zeros, and the section renders nothing when empty. Hardcoded 10k/500/50k/1M removed | PASS (tsc/lint/tests green) | issue #204; `components/home/StatsBar*.tsx`, `lib/supabase/queries.ts:getPlatformStats` |
| 2026-07-18 | agent | local | branch base `9b4ce45` | P0-012 / G6 | Fix contact form false success | Send or honest fallback; never fake | When `RESEND_API_KEY` set, submission emails `books@mangu-publishers.com` via Resend and reports success **only** on real delivery; when absent, form is replaced by an honest mailto fallback and the action returns an honest error (defense in depth). Stale `support@mangu.com` removed | PASS | issue #197; `contact/actions.ts`, `ContactForm.tsx`, `contact/page.tsx` |
| 2026-07-18 | agent | local | branch base `9b4ce45` | P0-013 / G6 | Fix newsletter fake subscription | Real subscribe or honest disabled | `POST /api/newsletter`: 503 `disabled` when unconfigured, 400 invalid, 502 on provider error, 200 only on real subscribe (Resend audience or welcome email). `NewsletterCTA` shows "coming soon" when disabled and surfaces real errors — `setTimeout` fake removed | PASS | issue #201; `app/api/newsletter/route.ts`, `NewsletterCTA.tsx`, `lib/email/send.ts` |
| 2026-07-18 | agent | local | branch base `9b4ce45` | Phase 9 verification | Run repo toolchain | Green | `tsc --noEmit` clean; `next lint` no warnings; **`jest` 116/116 pass** (22 suites) incl. new `tests/unit/product-truth.test.ts` (8 cases proving no false-success on either surface); `prettier --check` clean on all changed files | PASS | `tests/unit/product-truth.test.ts` |

**Notes:** G6 also depends on P0-014's sibling items (route truth, other public claims) — this wave closes the contact/newsletter/stats defects specifically. Live real-backend confirmation (Resend delivery, populated stats) is Phase 12 operator QA; these changes make the surfaces **truthful when unconfigured**, which is the launch-scope requirement. New optional env: `CONTACT_INBOX_EMAIL`, `RESEND_AUDIENCE_ID` (both have safe defaults/fallbacks).

## P0-020 — production verification + IAM scripts (agent-run, 2026-07-18)

**Scope:** Master Execution Specification v1.0 P0-020 (Phases 6/11/14). Author the two MISSING reference scripts flagged in the baseline. Agent support only — scripts are **PROPOSED / unexecuted** here (no gcloud, live GCP, or production access); the operator runs them with credentials in Phases 11/14/15. No secret values are read, printed, or logged by either script (CCR-009).

| UTC | Actor | Env | SHA / ref | Test-Gate | Action | Expected | Actual | Result | Artifact / follow-up |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-07-18 | agent | repo | branch base `9b4ce45` | P0-020 / G7 (Phase 11) | Add `scripts/grant-cloudrun-secret-access.sh` | Idempotent least-privilege secret grant | Grants `roles/secretmanager.secretAccessor` on the 3 required + 4 optional `--set-secrets` names to the Cloud Run runtime SA (resolved: `SERVICE_ACCOUNT` → deployed SA → default compute SA); sources `scripts/gcp-config.sh`; `DRY_RUN=1` supported; fails closed if a required secret is absent | `bash -n` PASS; unexecuted (needs gcloud) | issue #202 |
| 2026-07-18 | agent | repo | branch base `9b4ce45` | P0-020 / G1,G7,G11 (Phase 14/15) | Add `scripts/verify-gcp-production.sh` | D1–D8 production smoke | Asserts Cloud Run Ready=True + 100%-to-latest + optional `EXPECT_SHA` image correlation (D1/D2); `/api/health` 200 (D3); `/api/health?ready=1` 200 & `ready:true` + per-component truth (D4/G7); route truth for `/ /books /comics /papers /login /register` (D5); served-asset localhost/secret scan (D6/D7); unsigned `POST /api/webhook` → 400 (D8); TLS note. Exit 0 pass / 1 fail / 2 degraded | `bash -n` PASS; JSON-extraction logic unit-tested against a mock readiness payload; unexecuted (needs live target) | issue #202 |

**Notes:** Both scripts match existing conventions in `scripts/gcp-config.sh` / `sync-gcp-secrets-from-env.sh` (which already referenced `verify-gcp-production.sh` as the post-sync verifier). Readiness assertions derived from `app/api/health/route.ts` at `9b4ce45` (`ready: !anyFailing`; HTTP 200/503; checks: environment/database/auth/migrations/stripe). **No gate flips** — these are tooling for later phases; G1/G7/G11 require the operator to execute them against the deployed release SHA and append the resulting evidence here.

## Phase 5 (partial) — Format Check repair on main (agent-run, 2026-07-18)

**Scope:** Master Execution Specification v1.0 Phase 5 (CI/CD workflow repair) — resolve the only red required check on `main`. Verified via GitHub Actions API that on `main` HEAD `c925aae` (PR #210 merge) **Format Check = FAILURE** while CI, CodeQL, Lighthouse, Release Please = success. Root cause reproduced locally with pinned `prettier@3` + repo `.prettierrc`: 5 files fail `prettier --check .`. This corrects the stale "CI RED / Actions billing-locked" reports — Actions run and only formatting was red.

| UTC | Actor | Env | SHA / ref | Test-Gate | Action | Expected | Actual | Result | Artifact / follow-up |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-07-18 | agent (Actions API) | repo | main `c925aae` | Phase 5 / G2 | Read required-check status on main | Identify red checks | **Format Check FAILURE**; CI/CodeQL/Lighthouse/Release-Please success; E2E in_progress | DIAGNOSED | Actions run 29620916491 (format) |
| 2026-07-18 | agent (local prettier@3) | repo | branch `claude/mangu-phase-1-authority-sv2hyn` (base `c925aae`) | Phase 5 | Reproduce `prettier --check .` | List unformatted files | 5 files: `docs/NEXT_GO.md`, `docs/adr/ADR-001-canonical-platform.md`, `docs/OPERATOR_QA_LOG.md`, `docs/phase2/_sources/litstream_phase2_sec04.md`, `docs/phase2/_sources/litstream_phase2.agent.final.md` (pre-existing since before `16dc1d7`) | REPRODUCED | `.prettierrc` (prettier@3.2.4 pin) |
| 2026-07-18 | agent | repo | branch base `c925aae` | Phase 5 / CCR-002 | Fix format without rewriting evidence | Format-check green; append-only log untouched | `.prettierignore` += `docs/OPERATOR_QA_LOG.md` (append-only) + `docs/phase2/_sources/` (imported snapshots); `prettier --write` on NEXT_GO.md + ADR-001; `prettier --check` on all md/yaml/json → **"All matched files use Prettier code style!"** | PASS (local); CI confirms on push | this PR |

**Result:** `prettier --check .` passes locally for all plugin-independent files (md/yaml/json). The remaining CI check runs full `npx prettier --check .` including TS/TSX (tailwind plugin) — those were already clean at `16dc1d7` and are untouched here, so CI is expected green. This is a document/config-only change (permitted freeze class 1+2). Supersedes stale cursor autofix vehicles #207/#208, which additionally reformat the authority doc and rewrite the append-only log (CCR-002 violation) — to be closed after this merges. **G2 remains FALSE** until required checks are green on the exact *deployed* release SHA (Phase 14); this only restores a green `main`.

## Phase 2 (Freeze) + Phase 3 (Recovery) + baseline refresh v1.2.0 (agent-run, 2026-07-18)

**Scope:** Master Execution Specification v1.0 Phase 2 (freeze/governance) and Phase 3 Steps 3.4–3.6 (PR closure, branch hygiene, migration triage), executed via GitHub API after authority PR #206 (`0f30649`) and recovery vehicle PR #185 (`16dc1d7`) merged to `main`. Refreshes `docs/NEXT_GO.md` to v1.2.0 / baseline `16dc1d7` per CCR-020/G12. No local/gcloud/supabase/stripe access — external facts remain DOC-ONLY.

| UTC | Actor | Env | SHA / ref | Test-Gate | Action | Expected | Actual | Result | Artifact / follow-up |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-07-18 | agent (GitHub API) | repo | main @ `16dc1d7` | G13 | Confirm authority on main | `docs/NEXT_GO.md` tracked in release tree | Present via PR #206 (`0f30649`); ADR-001 present at `docs/adr/ADR-001-canonical-platform.md` | **G13 TRUE** | `docs/NEXT_GO.md` §6 |
| 2026-07-18 | agent | repo | main @ `16dc1d7` | Step 2.1 | Create launch freeze notice | Freeze issue with permitted change classes + held items | Issue #209 created (permitted classes; #145 + 7 dependabot majors held; #142 deferred) | PASS | issue #209 |
| 2026-07-18 | agent | repo | — | Step 2.2 | Post HOLD comments on held PRs | #145 + dependabot majors carry HOLD; #142 deferred | HOLD comments posted on #145, #167, #160, #155, #154, #152, #133, #129; defer comment on #142 | PASS | PR comment IDs 5009267082–5009268622 |
| 2026-07-18 | agent | repo | recovery `16dc1d7` (PR #185 merged 2026-07-17T23:31:27Z) | Step 3.4 / P0-002 | Close 8 duplicate autofix PRs | Closed as superseded, referencing recovery merge, only after #185 merged | #173, #174, #178, #179, #180, #181, #182, #183 closed with superseded comment citing `16dc1d7` | PASS | 8 PRs closed; issue #189 |
| 2026-07-18 | agent | repo | origin | Step 3.5 / P0-002 | Prune orphaned autofix branches | Delete 24 `cursor/ci-autofix-automation-*` orphans; keep `-709e`/#207, `-609e`/#208 | `git push --delete` → HTTP 403 (sandbox proxy scopes push to designated branch); no MCP delete-branch tool | **BLOCKED — handed to operator** | `docs/NEXT_GO.md` §3.4 (exact command + 24-branch list) |
| 2026-07-18 | agent | repo | #184 head base `3d9ea3c` | Step 3.6 / P0-004 | Triage migration-reorder PR #184 | Independent decision recorded | Diff touches **no** `supabase/migrations/` files; adds competing 1,465-line `NEXT_GO.md`; portal edits superseded by 2026-07-17 wave → recommend close as superseded; ordering handled by #185 `--include-all` + #192 | TRIAGED (recommend close; left open for operator confirm) | PR #184 comment 5009279483 |
| 2026-07-18 | agent | repo | main @ `16dc1d7` | CCR-020 / G12 | Refresh authority baseline | v1.1.0 → v1.2.0; baseline `3d9ea3c` → `16dc1d7`; phase/gate states current | §1 version 1.2.0; §3 refreshed (12 open PRs, G13 TRUE); §4 Phases 1–2 COMPLETE, 3 IN PROGRESS; §6 G13 TRUE, G12 PARTIAL | PASS (this PR) | authority refresh PR |

**Notes:** CI on `16dc1d7` is RED (reported) — #207/#208 target format-check, Trivy secret-scan, webkit E2E flake, and Cloud Build env residuals; **G2 stays FALSE** until required checks are green on the exact deployed SHA (Phase 5). Freeze rule 4 requires consolidating #207/#208 to one vehicle per failure signature before merge. Prior rows below preserved verbatim (append-only, CCR-002).

## Phase 1 — Authority, baseline refresh, traceability (agent-run, 2026-07-18)

**Scope:** Master Execution Specification v1.0 Phase 1 (Steps 1.1–1.5). Executed via GitHub API by the agent; no local/gcloud/supabase/stripe access — external-system facts are DOC-ONLY/REPORTED as classified in `docs/NEXT_GO.md` §2.

| UTC | Actor | Env | SHA / deploy ID | Test-Gate | Action | Expected | Actual | Result | Artifact / follow-up |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-07-18 | agent (GitHub API) | repo | `3d9ea3c77e2829125a950b10a9d2a658d212d58a` (origin/main, commit 2026-07-17T14:52:30Z) | Step 1.2 / G12 | Refresh volatile baseline | Baseline matches or supersedes source snapshot 2026-07-17 | main SHA matches source snapshot exactly; 19 open PRs; 96 branches (25 `cursor/ci-autofix-automation-*`, 9 with open PRs); 0 tags; 0 releases; 19 workflows; 25 local migration files (tip `20260717114300_order_items_select_own.sql`); `docs/NEXT_GO.md` absent; `docs/adr/` absent; `scripts/verify-gcp-production.sh` + `scripts/grant-cloudrun-secret-access.sh` MISSING on main | PASS (baseline refreshed) | `docs/NEXT_GO.md` §3; issue #202 (P0-020) |
| 2026-07-18 | agent | repo | branch `release/next-go-authority` | Step 1.1 / P0-019 / G13 | Commit authority document `docs/NEXT_GO.md` + ADR-001 PROPOSED | Authority establishes NO-GO, decision rule, evidence model, gate matrix | Committed; open to protected main as authority PR | IN PROGRESS until PR merges | authority PR; issues #196 (P0-019), #190 (P0-003) |
| 2026-07-18 | agent | repo | — | Step 1.4 / traceability | Create issue-backed P0 map (20 items) | Every P0 has owner, dependencies, acceptance criteria, evidence location, rollback notes | 20 issues created: #186 (P0-007), #187 (P0-001), #188 (P0-006), #189 (P0-002), #190 (P0-003), #191 (P0-009), #192 (P0-004), #193 (P0-008), #194 (P0-005), #195 (P0-011), #196 (P0-019), #197 (P0-012), #198 (P0-018), #199 (P0-015), #200 (P0-017), #201 (P0-013), #202 (P0-020), #203 (P0-016), #204 (P0-014), #205 (P0-010) | PASS | issues #186–#205; `docs/NEXT_GO.md` §5 |
| 2026-07-18 | agent | repo | — | Step 1.5 | Lock operating rules + launch scope | Rules in authority doc; README/QUICK_START link authority; false production-ready claims corrected | `docs/NEXT_GO.md` §7–§8 locked; QUICK_START "PRODUCTION READY" banner replaced with authority link (CCR-018); README deployment section links authority | IN PROGRESS until PR merges | authority PR |
| 2026-07-18 | agent | external | — | CCR-017 | Classify external claims | GCP/Supabase/Stripe/DNS/Sentry claims marked DOC-ONLY pending in-system verification | GCP `delta-wonder-488420-i3`/`us-central1`/`mangu-publishers`: DOC-ONLY; hosted migration count: DOC-ONLY (25 local VERIFIED; note 2026-07-17 row below reports hardening migrations applied hosted via MCP); Stripe webhook/Secret Manager: DOC-ONLY; www via Vercel + apex TLS mismatch: REPORTED 2026-07-09 (stale); Actions billing lock: REPORTED 2026-07-08 (re-verify next run) | DOCUMENTED | `docs/NEXT_GO.md` §3.3 |

**Notes:** Prior rows below are preserved verbatim (append-only, CCR-002). The 2026-07-17 unit/type-check results remain REPORTED against an uncommitted working tree (base `326bb60`) — not release evidence; Phase 4 reruns on the exact candidate SHA (CCR-005). Manual table rows 1–10 remain unchecked ⇒ G10 FALSE.

## Full-site validation and hardening wave (agent-run, 2026-07-17)

**Scope:** working tree vs baseline `326bb60` — **57 files changed, +1,799 / −269** (excluding `node_modules`). Not yet committed.

| Check | Command | Result |
| --- | --- | --- |
| Unit tests | `npm test` | **PASS 63/63** (baseline was 42; new suites for auth, API, entitlement, analytics, portal fixes) |
| Type-check | `npm run type-check` | **PASS** — `tsc --noEmit` clean after fixing author analytics `Book` typing |

**Changes landed this wave:**

- **SEO / a11y:** canonical + Open Graph metadata fixes across consumer pages; accessible labels added (SearchBar, NewsletterCTA, AudioPlayer, Footer, BookFilters).
- **Auth hardening:** sessionless verification-email resend; honest provider quota errors on register; reset-password confirm restricted to recovery flow only.
- **API hardening:** `/api/resonance/track` input validation + rate limiting; `/api/upload` MIME allowlist; `/api/resonance/similar` safe error responses.
- **Reader / data access:** reading entitlement checks (`lib/reading/entitlement.ts`); library scoped to completed orders; author ownership checks (`lib/supabase/author-ownership.ts`); `analytics_sessions` RLS tightened + `public_profiles` view (migration `20260717114047_tighten_analytics_sessions_rls.sql`).
- **Admin / partner portals:** `profiles.role` escalation protection (migration `20260717114020_protect_profiles_role.sql`); admin book update via admin client; honest error states instead of silent empty tables (`app/admin/_lib/query-error.tsx`, `partner-unavailable.tsx`); ARC rejected filter; pagination clamps.
- **Build config:** `next.config.js` Sentry wrapping gated on Sentry env; `@next/bundle-analyzer` pinned 14.2.35.

**Resolved 2026-07-17:** migrations **`20260717114047`** and **`20260717114020`** (plus `public_read_authors`, `fix_review_stats_trigger`, `revoke_anon_update_reading_progress`) applied to hosted Supabase via MCP — RLS/role protections are live.

**Known operational issues (this machine):**

- Local Windows `node_modules` corruption when multiple agents run `npm ci`/`npm install` concurrently — install solo, repair with `npm install`.
- `@supabase/auth-js` now requires Node **>=22** — older local Node versions fail install/runtime.
- Dev server must run **solo on port 3001** (concurrent dev servers conflict).

## Pre-launch verification (2026-07-09)

Command: `bash scripts/pre-launch-verify.sh` via Git Bash (`C:\Program Files\Git\bin\bash.exe`). Node **v24.14.0** (satisfies `.nvmrc` / `engines`). Final green run: `export SKIP_NPM_CI=1` (Windows: bare `npm ci` in repo root often `ENOTEMPTY` when multiple agents install concurrently; gate skips when `node_modules/.bin/next` exists).

| Gate | Command / check | Result | Notes |
| --- | --- | --- | --- |
| Node version | `.nvmrc` (20) | **PASS** | v24.14.0 |
| Dependencies | `npm ci` (or skip) | **PASS** | SKIP path; `npm install` repair when needed |
| Env validation | `npm run validate-env` | **PASS** | exit 0 (`.env.local` present) |
| Type-check | `npm run type-check` | **PASS** | `tsc --noEmit` exit 0 |
| Lint | `npm run lint` | **PASS** | exit 0 |
| Format | `npm run format:check` | **PASS** | exit 0 (`.prettierignore` restored) |
| Unit tests | `npm test` | **PASS** | **7** suites, **42** tests |
| Migrations | `scripts/verify-migrations.sh` | **PASS** | **15** files |
| Build | `npm run build` (CI mock env) | **PASS** | `next build` exit 0 after `rm -rf .next` |
| Secret scan | `.next/static`, `.next/server`, `public` | **PASS** | tightened pattern (no env-var name false positives) |
| HTML sanity | `public/**/*.html` | **PASS** | **1** file |

**Pre-launch script exit:** **0** — **11 passed, 0 failed**.

**Secrets hygiene:** `git check-ignore -v .env.local` → `.gitignore:18:.env*.local`. Tracked env files: `.env.example`, `.env.local.example`, `.env.production.example` only (no live secrets).

### Playwright E2E (2026-07-09)

Command: `npm run test:e2e -- --project=chromium` with CI mock env from [`.github/workflows/e2e.yml`](../.github/workflows/e2e.yml) (`USE_MOCKS=true`, placeholder Supabase/Stripe keys, `NEXT_PUBLIC_SITE_URL=http://127.0.0.1:3000`). Run from repo root after `npx playwright install chromium`.

| Result | Evidence |
| --- | --- |
| **FAIL** (partial) | exit **1** — **26 passed**, **3 failed** — `auth-flow.spec.ts` (invalid credentials, duplicate email, reset-password success UI); `fetch failed` / `ENOTFOUND placeholder.supabase.co` on webServer |

## Phase 3 + PR #136 review + Phase 4 gate (agent-run, 2026-07-09)

**Supabase project:** `mangu-publishers` / `tkzvikozrcynhwsqtkqp`

| Sub-stage | Result |
| --- | --- |
| `[PASS] 3 / 0.3.c` Î“Ã‡Ã¶ public base table count | `SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'` Î“Ã¥Ã† **36** (exact match). No migration bundle needed. Did not re-run `verify-rls` (known false positive on orders/reading_progress). |
| `[REVIEW] PR #136` Î“Ã‡Ã¶ `fix(ci): resolve deploy, bug-to-issue, and Cloud Build failures` | **Partial accept.** Safe: pin `@actions/core@1.11.1` in `bug-to-issue.yml`; gate optional Vercel deploy on `vars.VERCEL_PROJECT_ID` + `continue-on-error`. **Reject as-is:** `cloudbuild.yaml` silent placeholder/`USE_MOCKS` fallbacks Î“Ã‡Ã¶ would bake mock `NEXT_PUBLIC_*` into Docker/Cloud Run if a trigger omits substitutions. Superseded by fail-closed check + `./scripts/gcloud-build-submit.sh` path. |
| `[BLOCKED] 4.1` Î“Ã‡Ã¶ GCP auth | Cloud agent has **no** `gcloud` credentials. Phase 4 requires interactive `gcloud auth login` as **`renee@mangu-publishers.com`** (not `books@`) on project `delta-wonder-488420-i3`. |
| `[OBS]` Î“Ã‡Ã¶ Current public surface | `www.mangu-publishers.com` responds via **Vercel** (`server: Vercel`). `/api/live` fresh (2026-07-09). `/api/health?ready=1` Î“Ã¥Ã† `degraded` / Stripe **warn** ("Stripe not configured"). Apex `mangu-publishers.com` TLS SAN mismatch from this environment; redirects to `www`. Canonical target remains **Cloud Run** per `docs/CANONICAL_PRODUCTION.md`. |
| `[HOLD]` Î“Ã‡Ã¶ Dependabot #125Î“Ã‡Ã´#134 | Hold until after launch (preserves validated dependency state). |

**Code landed this run (branch `cursor/phase4-pr136-review-7a40`):**

- Take PR #136 safe CI workflow fixes (`bug-to-issue.yml`, `ci.yml`).
- Harden `cloudbuild.yaml` `next-build` to **fail closed** if `_NEXT_PUBLIC_*` substitutions are empty/placeholder (no silent mocks).
- Grant script: add Upstash secrets to optional accessor list (Phase 4.3 historical failure).
- `e2e.yml`: add CI mock env so Playwright webServer can boot (fixes PR #136 Playwright red).

**Operator next (Phase 4 Î“Ã‡Ã¶ Copilot Pro / local machine with `renee@`):**

```bash
gcloud auth login   # must be renee@mangu-publishers.com
gcloud config set project delta-wonder-488420-i3
# ensure .env.local has real secrets (not Phase 2 placeholders)
./scripts/sync-gcp-secrets-from-env.sh
./scripts/grant-cloudrun-secret-access.sh
gcloud secrets list
# verify accessor on upstash-redis-rest-url + upstash-redis-rest-token
./scripts/gcloud-build-submit.sh
./scripts/verify-gcp-production.sh
curl -sS https://www.mangu-publishers.com/api/live
curl -sS "https://www.mangu-publishers.com/api/health?ready=1"
# record KNOWN_GOOD_REVISION from:
gcloud run services describe mangu-publishers --region us-central1 --format='value(status.latestReadyRevisionName)'
```

Do **not** merge PR #136Î“Ã‡Ã–s `cloudbuild.yaml` placeholder fallbacks. Prefer this branch (or cherry-pick its safe workflow hunks only).

## Phase 2 Î“Ã‡Ã¶ Local Validation Gate (agent-run, 2026-07-09)

**Environment:** Node v20.20.2, npm v10.8.2, Next.js 14.2.35, sandbox (GCP Cloud Run target)

| Sub-stage | Result |
| --- | --- |
| `[PASS] 2.0.a` Î“Ã‡Ã¶ Node version | v20.20.2 satisfies `.nvmrc` / `engines >= 20`. |
| `[PASS] 2.0.b` Î“Ã‡Ã¶ npm ci clean install from package-lock.json; Node v20.20.2. | No lockfile drift; 1021 packages installed; 17 audit vulns all in `next@14.2.35` chain, deferred (same as previous run). |
| `[PASS] 2.0.c` Î“Ã‡Ã¶ Stale `.next` cache removed (`rm -rf .next`). | |
| `[PASS] 2.0.d` Î“Ã‡Ã¶ `.env.local` created from `.env.local.example` shape; confirmed git-ignored (`git check-ignore -v .env.local`). Placeholder values: real Supabase project URL, dummy JWT-shaped anon + service-role keys, `pk_test_`/`sk_test_` dummy Stripe keys, `STRIPE_WEBHOOK_SECRET` blank (Phase 5), `NEXT_PUBLIC_SITE_URL=https://mangu-publishers.com`, Upstash dummy URL + token. Real secrets remain operator-local. | |
| `[PASS] 2.0.e` Î“Ã‡Ã¶ `npm run validate-env` exited 0 (placeholder-shaped env; real secrets remain operator-local). | One expected warning: "Stripe webhook secret missing" because Stripe keys are present but `STRIPE_WEBHOOK_SECRET` is blank per Phase 5 checklist. No errors; validator correctly marks Stripe webhook as optional/warning-only. |
| `[PASS] 2.1.a` Î“Ã‡Ã¶ type-check passed. | `tsc --noEmit` exited 0, zero errors. |
| `[PASS] 2.1.b` Î“Ã‡Ã¶ lint passed. | `next lint` Î“Ã‡Ã¶ no ESLint warnings or errors. |
| `[PASS] 2.1.c` Î“Ã‡Ã¶ unit tests passed (6 suites, 25 tests). | All 25 tests pass across 6 suites. Two expected console.warn lines from `lib/rate-limit.ts` (Redis not set in test env Î“Ã‡Ã¶ benign). |
| `[PASS] 2.1.d` Î“Ã‡Ã¶ next build succeeded. | 53 pages generated (static + dynamic); `next build` exited 0. Two webpack Edge Runtime warnings for `@supabase/ssr` and `@upstash/redis` (pre-existing, known, not blocking). Secret audit: no `sk_test_`/`sk_live_`/`whsec_` patterns in `.next` output. |
| `[PASS] 2.1.e` Î“Ã‡Ã¶ `bash scripts/launch-readiness.sh` passed. | npm ci Î“Ã¥Ã† type-check Î“Ã¥Ã† lint Î“Ã¥Ã† 25/25 unit tests Î“Ã¥Ã† 15 migration files Î“Ã¥Ã† build Î“Ã¥Ã† lockfile @upstash check Î“Ã¥Ã† secret audit Î“Ã‡Ã¶ all PASS. No gcloud gates in this script; no SKIPPED items required. |

**Fixes applied this run:** None required. All sub-stages passed on first attempt.

**Notes:**

- `STRIPE_WEBHOOK_SECRET` left blank intentionally Î“Ã‡Ã¶ Phase 5 populates this per checklist.
- `npm audit` 17 vulnerabilities (10 high) in `next@14.2.35` chain Î“Ã‡Ã¶ same as 2026-07-08 entry; fix requires Next 16 (breaking), deferred to engineering.
- `verify-rls` not run per task constraints (Phase 3, known false positive flagged in checklist).
- No gcloud/Supabase/Stripe network operations attempted per task constraints (Phases 3Î“Ã‡Ã´5).

## Automated (agent-run, 2026-07-08)

| Check | Command / URL | Result |
| --- | --- | --- |
| Launch readiness gate | `bash scripts/launch-readiness.sh` | PASS (npm ci, type-check, lint, 25/25 unit tests, 15 migrations, build, lockfile, secret audit) |
| Type-check | `npm run type-check` | PASS (after adding `@types/jest`; was failing on `lib/supabase/queries.test.ts`) |
| E2E (chromium) | `npx playwright test --project=chromium` | PASS 26/26 runnable, 3 skipped (need real Supabase creds) |
| Prod liveness | `curl https://mangu-publishers.com/api/live` | HTTP 200 |
| Prod readiness | `curl "https://mangu-publishers.com/api/health?ready=1"` | HTTP 200 `healthy` Î“Ã‡Ã¶ env, database, auth, migrations, stripe all `pass` |
| Prod RBAC | `curl -I https://mangu-publishers.com/admin/dashboard` | 307 Î“Ã¥Ã† `/login` (unauthenticated blocked) |
| Prod webhook guard | `POST /api/webhook` without signature | HTTP 400 `Missing signature` (correct rejection) |
| Prod routes | `/`, `/books`, `/comics`, `/papers`, `/login`, `/register` | All HTTP 200 |
| Prod env bake | scan served JS for `localhost:3000` | Clean Î“Ã‡Ã¶ `NEXT_PUBLIC_SITE_URL` baked correctly |
| Secret scan | ripgrep for `sk_live_`, `sk_test_`, `whsec_`, JWTs, `re_`, `AIza` | Clean Î“Ã‡Ã¶ zero secrets in repo |
| npm audit | `npm audit --audit-level=high` | 17 vulns (10 high) Î“Ã‡Ã¶ all in `next@14.2.35` chain; fix requires Next 16 (breaking). Deferred to engineering. |
| GitHub Actions | `gh run list` | **BLOCKED: account locked due to billing issue** Î“Ã‡Ã¶ no jobs start. Workflow-file bug (`secrets.*` in job `if:`) fixed on this branch; runs will stay red until billing is resolved. |
| Prod RLS: profiles (anon) | PostgREST query with public anon key | PASS Î“Ã‡Ã¶ `[]`, no rows leak |
| Prod RLS: draft books (anon) | PostgREST query with public anon key | PASS Î“Ã‡Ã¶ `[]`, drafts hidden |
| Prod RLS: orders (anon) | PostgREST query with public anon key | PASS Î“Ã‡Ã¶ `[]`, orders hidden |
| Prod migrations | table probes (missing table returns PGRST205; these return `[]`) | Applied Î“Ã‡Ã¶ `profiles`, `books`, `orders` exist; matches `migrations: pass` from `/api/health?ready=1` |
| Prod catalog | published books (anon) | `[]` Î“Ã‡Ã¶ catalog empty; seed data pending (matches QA item 7 note) |

### Fixes landed this run (branch `cursor/launch-readiness-fixes-6de2`)

- `secrets.*` removed from job-level `if:` in `ci.yml` / `deploy.yml` (invalidated both workflows Î“Ã‡Ã¶ every run failed in 0s)
- `/books`, `/comics`, `/papers` crash fixed: cookie-based Supabase client was used inside `unstable_cache` (`getBooksPage`, `getAuthorSummary`) Î“Ã‡Ã¶ now uses admin client with explicit `visibility='public'` filter
- `/admin/books/new` route created (was a linked 404; known issue in error table) with admin-only `createBookAdmin` action
- `updateBookAdmin` role check fixed (`profiles.user_id`, not `profiles.id` Î“Ã‡Ã¶ admins were rejected)
- E2E selector bugs fixed (strict-mode violations, `/api/health` startup-probe status)
- `@types/jest` added so `tsc --noEmit` passes

## Automated (agent-run)

### 2026-07-11 Î“Ã‡Ã¶ Phase 12 fix sprint (C1Î“Ã‡Ã´C10)

All ten near-term fixes from the master checklist are done (code + docs). Evidence:

| Check | Command | Result |
| --- | --- | --- |
| Type-check | `npm run type-check` | PASS (2026-07-11) |
| Lint | `npm run lint` | PASS Î“Ã‡Ã¶ no warnings or errors (2026-07-11) |
| Unit tests | `npm test` | PASS 42/42, 7 suites (2026-07-11; baseline was 25/6 Î“Ã‡Ã¶ added fail-closed rate-limit + growth-rate suites) |
| Production build | CI-style env (`USE_MOCKS=true` + placeholder Supabase vars) `npm run build` | PASS Î“Ã‡Ã¶ 54/54 pages (2026-07-11) |

Changes: C8 unified fail-closed rate limiter (`lib/rate-limit.ts`; legacy `lib/utils/rate-limit.ts` + `lib/middleware/rate-limit.ts` deleted); C2 `/authors` index page; C5 duplicate ErrorBoundary removed; C6 growth rate (null-safe previous-period compare); C7 SHA-256 upload dedup; C9 strict env validation (Stripe/Upstash required unless mocks); C10 `vercel-deploy.yml` retired (Vercel also removed from ci.yml by PR #144); C1 verified; C3/C4 migration docs corrected (15-file order). Note: no `.env.local` exists on this machine Î“Ã‡Ã¶ build gate used the same env shape as `ci.yml`.

| Check | Command / URL | Result |
| --- | --- | --- |
| Type-check | `npm run type-check` | PASS (2026-05-31) |
| Lint | `npm run lint` | PASS (2026-05-31) |
| Unit tests | `npm test` | PASS 12/12 (2026-05-31) |
| Env validation | `npm run validate-env` | PASS (2026-05-31) |
| Production build | `USE_MOCKS=true npm run build` | PASS (2026-05-19) |
| Local health | `curl localhost:3000/api/health` | PASS (mock mode, 2026-05-19) |
| GitHub Actions secrets | `gh secret list` | 5 secrets configured |
| PR #73 merge | `gh pr merge 73` | Merged to `main` |
| Homepage assets push | commit `ff23d55` | Pushed to `origin/main` (2026-05-31) |
| Prod smoke `/` | `curl https://mangu-publishers.com/` | HTTP 200 (old deploy still live, 2026-05-31) |
| Prod smoke `/api/health` | `curl https://mangu-publishers.com/api/health` | HTTP 200 `{"status":"ok",...}` (2026-05-31) |
| Prod smoke static homepage | `curl https://mangu-publishers.com/homepage/v_a_1.html` | HTTP 404 until Cloud Run redeploy (2026-05-31) |
| Cloud Build deploy | `./scripts/gcloud-build-submit.sh` | **BLOCKED:** `gcloud auth login` required (token refresh failed) |

## Manual (operator — browser)

> **Task 3.7 / issue #193 — release-candidate manual QA block.**
>
> **One immutable SHA.** All ten rows below MUST cite the SAME
> release-candidate SHA. Pick the RC commit, write it into the header table and
> into every row, and never amend it. If the RC changes, this block is void:
> start a fresh copy and re-run all ten. A block whose rows cite different SHAs
> is not evidence — it is ten unrelated observations.
>
> **Human evidence is required (CCR-014).** CI cannot sign off any row here.
> Automated suites prove a code path exists; they do not prove a person saw the
> product behave correctly on the release candidate. `tests/e2e/*.spec.ts` and
> `scripts/crawl-regression.ts` narrow what a human has to check — they never
> replace the human.
>
> **How to fill a row.** Every slot is mandatory. A blank `Actual` next to a
> `PASS` is not evidence; leave `Result` blank until the check was actually
> performed. `Evidence` = link to a screenshot, recording, HAR or provider
> dashboard entry. `Defect` = issue/PR link, required whenever `Result` is
> FAIL. Do not delete a FAIL row; add the defect link and re-run after the fix
> against a NEW RC SHA.
>
> **Supersession note (recorded, not silent):** MQ-10 replaces the previous
> row 10, "New static homepage loads at `/` — after Cloud Run redeploy with
> `ff23d55`". ADR-001 accepted Vercel and retired Cloud Run, so that row's
> precondition can no longer be met. Rows MQ-01…MQ-09 carry the same subjects
> as the original rows 1–9. No result was ever recorded in the original table,
> so no evidence was overwritten (CCR-002).

**Release candidate under test**

| Field | Value |
| --- | --- |
| RC SHA (immutable; applies to all ten rows) | |
| Environment (URL + auth/data provider config) | |
| Tester (name / GitHub handle) | |
| Block started (UTC) | |
| Block completed (UTC) | |

| Test ID | Test | RC SHA | Environment | Tester | Date/time (UTC) | Preconditions | Steps | Expected | Actual | Result (PASS/FAIL) | Evidence link | Defect link |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| MQ-01 | Register at `/register` | | | | | Mailbox reachable; address not already registered | 1. Open `/register` 2. Submit name / email / password 3. Open the verification email 4. Complete verification | Account created; verification email received; the verified account can sign in | | | | |
| MQ-02 | Profile row exists for the new account | | | | | MQ-01 completed | Look up the new account in the auth provider and in the `profiles` table | Exactly one profile row exists and its role is `reader` | | | | |
| MQ-03 | Login / logout | | | | | MQ-01 account verified | 1. Sign in at `/login` 2. Confirm the signed-in state 3. Sign out 4. Re-open a protected route | Sign-in succeeds; sign-out clears the session; the protected route sends you back to `/login` | | | | |
| MQ-04 | Password reset | | | | | MQ-01 account exists | 1. Request a reset at `/reset-password` 2. Open the emailed link 3. Set a new password 4. Sign in with it | Reset email arrives; the link opens the confirm page; the new password works and the old one does not | | | | |
| MQ-05 | Non-admin blocked from `/admin` | | | | | Signed in as a non-admin (reader) | 1. Open `/admin/dashboard` 2. Open `/admin/users` 3. POST directly to an admin route from browser devtools | Bounced every time; no admin data appears in any response body | | | | |
| MQ-06 | Admin `/admin/health` | | | | | Signed in as admin | Open `/admin/health` and read every component status | Page renders and the component statuses match the live `/api/health?ready=1` payload | | | | |
| MQ-07 | Browse `/books` | | | | | Launch catalog published (the 3–6 real titles) | 1. Open `/books` 2. Open each launch title 3. Use search and one genre filter | Only real launch titles are listed; every detail page renders; no seeded QA data is visible | | | | |
| MQ-08 | Stripe test checkout | | | | | Stripe test mode; one purchasable launch title | Complete a test-card checkout end to end — see [WEBHOOK_TESTING.md](./WEBHOOK_TESTING.md) | Checkout completes; the success return page is honest; the order is recorded | | | | |
| MQ-09 | Stripe webhook event received | | | | | MQ-08 completed | Check the Stripe dashboard webhook log, then the resulting order and entitlement | Event delivered and acknowledged once; entitlement granted exactly once (no duplicate) | | | | |
| MQ-10 | Purchased title readable from `/library` | | | | | MQ-08 completed as the MQ-01 account | 1. Open `/library` 2. Open the purchased title 3. Confirm an unpurchased title is absent | The purchased title is present and openable; unpurchased titles are absent | | | | |

**Sign-off:** this block counts as complete only when all ten rows carry the
same RC SHA, a tester, a UTC timestamp, an `Actual`, a `Result` and an evidence
link. A partially-filled block is reported as INCOMPLETE, never as PASS, and
G10 stays FALSE.

## Infrastructure (operator Î“Ã‡Ã¶ cloud)

| Item | Script / action | Status |
| --- | --- | --- |
| GCP secrets | `./scripts/sync-gcp-secrets-from-env.sh` | **Blocked:** run `gcloud auth login` locally, then re-run |
| GCP deploy | `./scripts/gcloud-build-submit.sh` | **Blocked:** same Î“Ã‡Ã¶ auth token refresh failed 2026-05-31 |
| GCP smoke | `./scripts/verify-gcp-production.sh` | Partial: domain live; redeploy needed for new homepage |
| Supabase migrations | `./scripts/bundle-migrations.sh` Î“Ã¥Ã† SQL Editor | Operator-dependent |
| Canonical prod | `docs/CANONICAL_PRODUCTION.md` | **Done** Î“Ã‡Ã¶ Cloud Run; issue #70 closed |
| Stripe prod webhook | `https://mangu-publishers.com/api/webhook` Î“Ã¥Ã† Secret Manager | See [WEBHOOK_TESTING.md](./WEBHOOK_TESTING.md) |

## Phase 2 intake

| Artifact | Status |
| --- | --- |
| `environment.local.sh` | Created with `PROJECT_ID`; fill domain/slugs/RACI |
| `FIELDS_TO_GATHER.md` | Template Î“Ã‡Ã¶ operator to complete |
| `12-ownership-raci.md` | Worksheet placeholders remain until names provided |

## Redeploy checklist (operator Î“Ã‡Ã¶ run after `gcloud auth login`)

```bash
gcloud auth login
gcloud config set project delta-wonder-488420-i3
./scripts/gcloud-build-submit.sh
./scripts/verify-gcp-production.sh
curl -I https://mangu-publishers.com/
curl -I https://mangu-publishers.com/homepage/v_a_1.html
curl -sS https://mangu-publishers.com/api/health | head -c 500
```

Expected after redeploy: `/` redirects or serves new homepage; `/homepage/v_a_1.html` returns HTTP 200.
