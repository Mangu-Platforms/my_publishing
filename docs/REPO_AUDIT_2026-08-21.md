# REPO DEEP AUDIT — 2026-08-21

**Baseline:** `main` @ `2bfebf7` (2026-08-14) · **Auditor:** agent session (navigator ritual §2 followed)
**Evidence class:** VERIFIED (repo) unless marked otherwise. Live-prod probes were made via the
Vercel API (the sandbox egress proxy blocks direct HTTPS to the prod domain).
**Scope:** full-repo state sync, code-level Phoenix workstream audit, CI/test/workflow audit,
security & secrets hygiene scan, both ledgers, open PR/issue queue, doc-drift reconciliation.

> Supersedes nothing; this is a point-in-time audit. Ledger authorities remain
> `docs/NEXT_GO.md` (launch) and `docs/PROJECT_PHOENIX.md` (migration).

---

## 1. Executive summary

The repo is in **good mechanical health and bad throughput health**. Everything an agent can
green is green; almost everything a human must touch is idle.

| Signal                             | State                                                                                                | Evidence                                              |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Unit tests (local, this audit)     | **740/740 pass, 66 suites**; `tsc --noEmit` clean                                                    | run @ `2bfebf7`, 2026-08-21                           |
| CI on `main`                       | GREEN (single `ci` context gates merge + 1 review)                                                   | `ci.yml`; branch protection via `protect-branch.sh`   |
| Production                         | Vercel deployment **READY**, serving exactly `main@2bfebf7`                                          | `dpl_5S72YVMXTs3s2DuRNRX5tHqJU1tt`, target=production |
| Launch ledger A                    | **1/13 hard gates TRUE** (G13 only); status NO-GO                                                    | `docs/NEXT_GO.md` §4                                  |
| Phoenix ledger B                   | WS2 complete in code; WS1 ~70%, WS3 ~50%, WS4 ~10%, WS5 ~75%, WS6 split                              | §4 below (code evidence, not docs)                    |
| Supabase burn-down (North Star #6) | **128 files** still reference supabase in `app/ lib/ components/ types/`                             | grep, this audit                                      |
| Open PRs                           | **9 agent drafts, all fully CI-green, all awaiting human review**; 9 dependabot; 1 post-launch draft | §5 below                                              |
| Open issues                        | Freeze notice #209 + **10 P0 launch issues untouched since 2026-07-19**                              | GitHub API                                            |
| Provider switches                  | `AUTH_PROVIDER`/`DATABASE_PROVIDER`/`STORAGE_PROVIDER` all default `supabase` (prod-safe)            | `lib/{auth,db,storage}/provider.ts`                   |

**The single biggest blocker is not code — it is review bandwidth.** Nine green PRs (including
the doc-reconciliation keystone #395) are waiting on the one human approval branch protection
requires. The full-tree + history secrets scan found **zero real leaks**, and the app-layer
security posture is strong (fail-closed middleware, gated MCP, idempotent webhook). The four
riskiest _code_ gaps: the auth-flow tail is not dual-run (§6 F2 — blocks Phase 11 forced-reset
readiness), webhook event-log idempotency is Supabase-bound even in Mongo mode (§6 F6.2 —
blocks Phase 13–15 teardown), the storage switch is decorative (§6 F3 — flipping it today
would split-brain uploads), and e2e tests never run in CI (§6 F4). The oldest open _human_
security item is H0.1-C: the exposed legacy Supabase anon key is still live.

---

## 2. Ground truth (verified this session)

- `origin/main` = `2bfebf7` — 35 commits landed 2026-08-14 (the "GO build" wave), nothing since.
  Velocity since Phoenix reactivation (2026-07-20): 78 commits, bursty (7–10/day in late July,
  then 2026-08-06 and 2026-08-14 spikes).
- Remote branches: 26 heads (post-prune; was ~96).
- Repo now lives in the **`Mangu-Platforms` org**; `CLAUDE.md`, `NEXT_GO.md` (21 refs) and
  `HUMAN_TASKS.md` still say `redinc23/my_publishing` (GitHub redirects, so links work — doc-drift only).
- Test baseline: **740/740 across 66 suites** re-verified locally this session. The 127/127
  figure still quoted in `PHOENIX_RECON.md`, `OPERATOR_QA_LOG.md`, `NEXT_GO.md` and the
  ci-quality skill is a 2026-07-18 historical value; PR #395 carries the re-baseline.
- Production Vercel project is `manguprojectz` (team `redinc23s-projects`); latest production
  deploy is READY at `main@2bfebf7` (2026-08-14). Preview deploys for all 9 draft PRs are READY.

## 3. Ledger A — launch (authority: `docs/NEXT_GO.md` v1.2.8, NO-GO)

G13 TRUE; G1–G12 FALSE. G1/G9 carry 2026-08-14 "informational" live-probe notes (deployment
READY, apex 308→www working) but stay FALSE pending formal evidence entries. Every remaining
gate is blocked on **operator-executed evidence**, not code:

- G3/G5/G10 → Phase 12 QA matrix rows (tester + SHA + artifacts, `OPERATOR_QA_LOG.md` rows all blank)
- G4/G8 → Stripe production webhook registration + signed-event correlation
- G2/G7 → CI + `/api/health?ready=1` on the deployed release SHA
- G11 → rollback rehearsal transcript
- The 10 open P0 issues (#187–#205) map to these same gates and have had no activity since 2026-07-19.

`docs/OPERATOR_QA_LOG.md` still ends with a GCP/Cloud Run-era "redeploy checklist"
(`delta-wonder-488420-i3`, `gcloud auth login`) that predates ADR-001 Option B (Vercel) —
append-only rules apply, but a superseding note is due.

## 4. Ledger B — Phoenix, judged from code (not docs)

Three provider switches exist (`lib/auth/provider.ts`, `lib/db/provider.ts`,
`lib/storage/provider.ts`), all defaulting `supabase`, consumed at 35 call sites.

| WS                | Code status  | Evidence highlights                                                                                                                                                                                                                                                                                                                                                                     |
| ----------------- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| WS1 Auth          | **~70%**     | `lib/auth.ts` fully spec-conformant (mongodbAdapter, requireEmailVerification, role additionalField input:false, databaseHooks→profiles upsert). Login/register/reset-_request_ dual-run. **Missing Better Auth leg:** `reset-password/confirm/page.tsx`, `verify-email/*`, `(auth)/callback/route.ts`, `components/providers/auth-provider.tsx`, `lib/middleware/auth.ts` (`isAdmin`). |
| WS2a infra        | **Complete** | `lib/mongodb.ts` cached client (globalThis promise, pool attach, ping), `lib/mongo.ts` D2 alias shim, `types/mongo.ts`, mongo-up/ping/indexes scripts.                                                                                                                                                                                                                                  |
| WS2b/c/d data     | **Complete** | 13 `lib/data/*` modules dual-run; webhook `upsertOrderByPaymentIntent`; audit log; admin writes; 7 dedicated dual-run/mongo test suites.                                                                                                                                                                                                                                                |
| WS3 Storage       | **~50%**     | Switch + `lib/actions/upload.ts` + `migrate-storage.ts` + remotePatterns exist, `/api/files/[id]` fully dual-run and streams with auth/purchase checks. **But `isBlobPrimary()` has exactly one consumer** — `app/api/upload/route.ts`, `app/api/upload/book-assets/route.ts`, `lib/uploads/store-asset.ts` write Supabase Storage unconditionally; zero blob tests.                    |
| WS4 Cleanup       | **~10%**     | 128 supabase-referencing files; 72 importers of `lib/supabase/server`, 64 of `lib/supabase/admin`; both `@supabase/*` packages still installed; ~7 dead files with zero importers (PR #398 deletes 2).                                                                                                                                                                                  |
| WS5 Tests         | **~75%**     | Strong dual-run unit coverage. Gaps: nothing imports/tests `@/lib/auth` itself; zero storage/blob tests; e2e specs are Supabase-shaped (`hasRealSupabase()` guards will silently skip forever post-cutover).                                                                                                                                                                            |
| WS6 Observability | **Split**    | Rate limiting production-grade (Upstash sliding window, fail-closed in prod, Retry-After, 20 consumers, tested). Sentry configured. **`lib/logger.ts` has zero importers** — WS6.1 structured logger written, never adopted.                                                                                                                                                            |

Phase 11 scripts: all six exist and are wired as `npm run phoenix:*`
(`export-supabase.sh`, `transform-data.ts` with locked-credential accounts + `_id_map.json`,
`migrate-storage.ts` idempotent + DRY_RUN, `export-delta.ts`, `send-forced-resets.ts`
dry-run-default, `verify-migration.mongo.js`). `phoenix:verify` needs `mongosh` on PATH
(not an npm dep) — worth noting in HUMAN_TASKS for the operator machine.

## 5. Open PR / issue queue

**Agent drafts — all CI-green (`ci` + CodeQL + Vercel preview READY), all need 1 human review:**

| PR       | Slice                                              | Note                                                                                                                                                                                                                                                                                                                        |
| -------- | -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **#395** | Freeze-safe hardening sweep (38 files, +974/−236)  | **Merge first.** Carries the doc reconciliation the whole queue references (C0.0→DONE, 740/740 re-baseline, ledger intake E-009…E-029) plus L0 authz truth-fixes (`/api/files` purchaser 403 bug, books-API authz). Contains one explicit owner lane-call (JSON-LD, leaning L2) — approve or ask for the one-commit revert. |
| #396     | WS2b checkout API dual-run session check           | Money-path; prod behavior unchanged                                                                                                                                                                                                                                                                                         |
| #397     | WS3 CSP for Blob covers + env docs                 | Inert until flip                                                                                                                                                                                                                                                                                                            |
| #398     | WS4 dead Supabase export chain deletion (−667 LOC) | Zero importers verified                                                                                                                                                                                                                                                                                                     |
| #399     | WS2d sitemap dual-run + slug-less skip             | Also a live SEO fix under Supabase                                                                                                                                                                                                                                                                                          |
| #400     | Genres soft-404 noindex                            | SEO truth-fix                                                                                                                                                                                                                                                                                                               |
| #401     | Error-message redaction                            | Info-disclosure hardening                                                                                                                                                                                                                                                                                                   |
| #402     | robots.ts getSiteUrl()                             | Consistency                                                                                                                                                                                                                                                                                                                 |
| #403     | next/link conversions                              | A11y/UX polish                                                                                                                                                                                                                                                                                                              |

Merge order note: #395 first (it owns the doc/ledger deltas and overlaps surfaces the others
reference), then the rest in any order — they were cut against the same base `2bfebf7` and are
surface-disjoint from each other.

**Dependabot (9, from 2026-08-04, base is 10 days stale):** #385–#393. Two bump `@supabase/*`
— fine to take while WS4 is incomplete, but they'll be deleted by WS4; lowest priority.
Branch protection is `strict`, so each needs an update-branch before merge anyway.

**#382** `manuscript views → security_invoker` is deliberately marked **post-launch DO-NOT-MERGE**
(freeze). Leave as-is.

**Issues:** #209 freeze notice + 10 P0s (#187–#205), all operator-gated, idle since 2026-07-19.

## 6. Findings (ranked)

### F1 — Throughput: the review gate is the program's critical path (impact: whole program)

Nine green PRs are queued behind the ≥1-human-approval branch-protection rule. This same
pattern stalled WS2d for weeks (C0.0). **Every day of review idleness now costs more than any
code gap in this list.** Recommendation in §7.1.

### F2 — Phoenix: the auth tail is not dual-run (impact: Phase 11 readiness) 🔴

Verified: `app/(auth)/reset-password/confirm/page.tsx`, `verify-email/*`, `(auth)/callback/route.ts`
have no Better Auth branch (grep for `better-auth|isBetterAuthPrimary|getAuthProvider` → 0 hits).
Under `AUTH_PROVIDER=better-auth`, users could sign up and _request_ resets but could not
**complete** a reset or verification — and the forced-reset cutover for every legacy account
(§6.7 of the briefing, `send-forced-resets.ts`) depends on exactly these flows. This is the
highest-value remaining WS1 work and is freeze-legal (migration parity).

### F3 — Phoenix: `STORAGE_PROVIDER` is decorative (impact: WS3 integrity) 🔴

`isBlobPrimary()` gates one function; three upload paths write Supabase Storage unconditionally.
Flipping the switch today would split-brain storage and **no test would catch it** (zero blob
tests). Either route all upload paths through the switch or document the flag as not-yet-flippable.

### F4 — CI: Playwright never runs (impact: G-gates, regression risk) 🟠

8 e2e specs / ~97 cases exist; no workflow invokes them. The ci-quality skill cites
`e2e.yml`/`preview-e2e.yml` as "baseline of record" — **neither file exists** (the skill's
workflow-inventory reference names ~16 workflows; only 4 exist). Also: 5 e2e guards keyed on
`hasRealSupabase()` will silently self-skip forever after cutover; 3 `test.fixme` a11y defects
(heading levels, missing h1) are parked with a paper trail.

### F5 — Governance: `.github/agents/merge-steward.agent.md` contradicts the freeze 🟠

It grants an agent "standing authority to merge PRs without … human approval, reviewer approval,
labels, or confirmation" and says to ignore freeze language. The _workflow_ was hardened to
require the `steward-approved` label (F-12), but this prompt was not updated. Any agent invoked
with it gets pre-freeze behavior. One-file docs fix.

### F6 — Security posture (dedicated full-tree + 78-commit-history scan)

**No real secret leaks found.** Every `sk_/whsec_/eyJ…/mongodb+srv://` hit is a placeholder,
CI dummy, detector regex, or test fixture; committed evidence files are clean; no `.env*`
tracked; `.gitignore` covers the PII-bearing Phoenix migration artifacts. Application-layer
posture is unusually strong: middleware is Edge-safe (no mongodb in the import chain) and
fail-closed with comments naming each closed defect; MCP is 404-unless-enabled + timing-safe
key auth; CORS is allow-listed; health is disclosure-gated; the webhook verifies raw-body
signatures and is idempotent at both the event and order level (unique sparse index on
`stripe_payment_intent_id`, 200 on duplicates).

Open items, ranked:

1. **H0.1-C (human): the legacy Supabase anon key is still live** — rotation automation landed
   2026+ but the operator steps (bootstrap 5 secrets → run workflow → disable old key, verify 401) have not run. The one asserted real exposure; everything below is hypothetical by comparison.
2. **Webhook event-log idempotency is Supabase-bound in Mongo mode** 🟠 —
   `checkIdempotency`/`recordWebhookEvent`/`markEventProcessed` hit the Supabase
   `webhook_events` table unconditionally even when `isMongoPrimary()` fulfills via Mongo
   (`app/api/webhook/route.ts:405-418`); no Mongo equivalent exists in `mongo-ensure-indexes.ts`.
   After Supabase teardown these calls throw → 500 → Stripe retry storms. The PI unique index
   still prevents duplicate _orders_, so it's reliability risk, not double-charge risk — but it
   must be fixed before Phase 13–15.
3. **No secret scanning on the canonical deploy path** — the pattern grep lives in legacy
   `cloudbuild.yaml`; a gitleaks step in `ci.yml` (or lint-staged) would close it. Similarly no
   dependency-review/npm-audit step (CodeQL _does_ run via GitHub default setup on every PR).
4. `rotate-supabase-key.yml`: unpinned third-party action (`gliech/create-github-secret-action@v1`)
   holding a secrets-write PAT; key passed as unmasked dispatch input; DELETE-then-POST env
   upsert can leave prod missing the var on partial failure.
5. Minor: the 10-var production env list is hand-duplicated (`instrumentation.ts` ↔
   `validate-env.ts`); `npm run lint` skips `middleware.ts` and `scripts/`; the files-route
   `isAuthorOwner` id-space mismatch found on `main` is **already fixed in PR #395** (fails
   safe today — authors 403 on their own manuscripts); the Better-Auth middleware path drops
   the role pre-check the Supabase path performs (server layouts still enforce — re-verify at
   cutover).

### F7 — Doc drift (mostly self-heals when #395 merges)

Stale now on `main`: C0.0 "blocked" (actually merged as `93a68cc`), 127/127 baselines,
`NEXT_GO` §3.1 workflow/migration rows, ledger missing E-009…E-029 — **all fixed inside #395**.
Not fixed anywhere yet: `redinc23/…` repo refs (24+), the ci-quality skill's phantom workflow
inventory, `OPERATOR_QA_LOG` GCP-era tail, recon's "24 suites" note, `mongosh` prerequisite
unlisted in HUMAN_TASKS.

### F8 — WS4 wall: 72 importers of `lib/supabase/server`

The burn-down's real shape: 33 files are dual-run, ~88 are live Supabase-only, ~7 are dead
(zero importers — `lib/actions/payouts.ts`, `lib/actions/follows.ts`, `lib/resonance/server.ts`,
`lib/supabase/queries.test.ts` misplaced in `lib/`, `app/dev/library-preview/page.tsx`, …).
Dead-file deletion is free progress; the 72-importer wall falls only after cutover.

### F9 — WS6: `lib/logger.ts` has zero importers

The cheapest WS6 close: adopt it in API handlers (start with `middleware.ts`'s 3 bare
`console.error` sites and the api routes), then the log-drain human gate becomes meaningful.

## 7. Next steps

### 7.1 Human (Faith / Max) — unblocks everything else, ~1 sitting

1. **Review & merge the queue:** #395 first (one lane-call to decide: JSON-LD keep-or-revert),
   then #396–#403 in any order. All are green; protection re-runs `ci` on merge anyway.
2. **H0.1 key rotation** (three console steps written up in HUMAN_TASKS) — oldest security P0.
3. **C0.1** disable the two Cursor storm automations (IDs in HUMAN_TASKS).
4. Then the launch-evidence lane when ready: Phase 12 QA rows (G3/G5/G10), Stripe webhook
   registration (G4/G8) — these are the only path to moving the 1/13 gate count.

### 7.2 Agent, freeze-legal, ranked (each = one small PR, Task IDs in body)

1. **WS1 auth-tail dual-run** (F2): Better Auth legs for reset-confirm, verify-email, callback;
   unit tests for each branch. _Phoenix 1.7/parity; unblocks Phase 11 rehearsal._
2. **Webhook event-log dual-run** (F6.2): give `checkIdempotency`/`recordWebhookEvent`/
   `markEventProcessed` a Mongo leg (+ unique index on event id in `mongo-ensure-indexes.ts`);
   deliver-twice test in Mongo mode. _Phoenix 2c / stripe parity; blocks Phase 13–15._
3. **WS3 upload unification** (F3): route `app/api/upload*`, `lib/uploads/store-asset.ts`
   through `isBlobPrimary()`; add blob-leg tests. _Phoenix 3.2._
4. **Steward prompt fix** (F5): align `.github/agents/merge-steward.agent.md` with F-12 label
   gating. _Docs, one file._
5. **Logger adoption** (F9): wire `lib/logger.ts` into middleware + API handlers. _WS6.1._
6. **e2e in CI** (F4): add a smoke-tier Playwright job (chromium, mocked env, the 3 spec files
   with 0 skips) as a non-required check first; fix the ci-quality skill's phantom inventory.
7. **Secret-scan gate** (F6.3): gitleaks (or equivalent) step in `ci.yml`; pin the third-party
   action in `rotate-supabase-key.yml` to a SHA. _Hardening, NEXT_GO permitted class._
8. **WS4 dead-file sweep** (F8): delete the remaining zero-importer files beyond #398.
9. **Doc hygiene batch** (F7): org rename refs, QA-log superseding note, recon suite-count note,
   `mongosh` prerequisite → HUMAN_TASKS.
10. **Dependency hygiene**: rebase/merge dependabot #384–#392 after the queue lands; hold the
    two `@supabase/*` bumps for last (WS4 deletes them).

### 7.3 Explicitly not now

- Flipping any provider default (iron rule 1).
- #382 security_invoker migration (post-launch by design).
- L2+ enhancement items without recorded owner approval (ledger lane gates).

---

_Audit method: navigator state-sync → parallel code/CI/security scans (3 agents) → local
740/740 + tsc verification → GitHub/Vercel API cross-checks. No code or settings changed;
this document is the only artifact._
