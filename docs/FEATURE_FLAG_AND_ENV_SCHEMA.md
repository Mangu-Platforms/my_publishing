# Feature-Flag Plan & Environment-Variable Schema — Mangu Publishers

> **DRAFT — PROPOSED · v0.1.0 · 2026-07-29 · owner: TBD**
> **Proposed repo path:** `docs/FEATURE_FLAG_AND_ENV_SCHEMA.md` · Task **T-13.3** (`docs/MASTER_IMPLEMENTATION_PLAN.md`), Master Brief **§19**.
> **Classification:** Documentation-only (permitted under launch freeze **#209 class 1**). No code, config, secret, flag, or deploy touched.
> **Authority:** **Subordinate to `docs/NEXT_GO.md` §10** (Environment & Secret Matrix) for the launch env matrix, and to `docs/PROJECT_PHOENIX.md` for provider cutover. Operational per-environment detail lives in `docs/operations/ENVIRONMENT_MATRIX.md` (verified 2026-07-28) and store-of-record bindings in `docs/SECRET_INVENTORY.md` — this document does not restate or override either.
> **This file never contains a secret VALUE — names, formats, and store-of-record only (CCR-009).** If a value is ever pasted here, treat it as compromised: rotate, then scrub history.
> **Evidence:** every row is **VERIFIED** (repo path cited, HEAD `36f7528`) or explicitly **PROPOSED** (does not exist).

---

## 1. Flag principle

**"No feature launches merely because code exists."** (Brief §19.) Merging a code path is not a launch decision; flipping a flag is, and it is a human decision.

The flag-off contract is already written into the registry — quoted verbatim from `lib/flags.ts`:

> Flag-off contract: when a flag is off —
>   - its routes return an HONEST unavailable page
>   - its nav entries are hidden
>   - its API routes return 404
>   - its sitemap entries are dropped
>
> Never a broken page, never a dead link.
>
> Each flag: owner · default · environments · expiry · rollback

Three consequences, all binding:

1. **Off is a designed state, not an absence.** A flag-off surface must tell the truth ("Comics are not available yet"), keep working navigation, and stay out of the index (`robots: { index: false }` — verified `app/(consumer)/comics/page.tsx`).
2. **Default OFF is structural.** Every flag reads `process.env.X === 'true'` — absent, empty, `1`, or `TRUE` all evaluate false. Enabling is an explicit, auditable act.
3. **A flag is not a launch.** Enabling requires content/data to exist behind it, the honest-off states to have been verified, and an owner. See §6.

---

## 2. Current flag inventory — VERIFIED (`lib/flags.ts`, HEAD `36f7528`)

Registry file is 41 lines and declares **7** flags. An **8th** flag exists outside the registry (row 8) — see §8 G1.

| # | Flag constant | Env var | Default | Gates | Current wiring state (VERIFIED) | Honest-off behavior today | Owner | Expiry / removal criteria |
|---|---|---|---|---|---|---|---|---|
| 1 | `FEATURE_COMICS` | `FEATURE_COMICS` | OFF | Comics catalog + reader | **Wired:** `app/(consumer)/comics/page.tsx`, `comics/[slug]/page.tsx`, `app/sitemap.ts` | Honest "Not available yet" page + `Browse ebooks instead` link; title/description swap; `noindex`; sitemap entry dropped | TBD | **Not defined in code.** Proposed: remove flag once comic catalog content is live in production for 30 days |
| 2 | `FEATURE_PAPERS` | `FEATURE_PAPERS` | OFF | Academic papers catalog + viewer | **Wired:** `app/(consumer)/papers/page.tsx`, `papers/[slug]/page.tsx`, `app/sitemap.ts` | Same honest-unavailable pattern as comics | TBD | **Not defined in code.** Proposed: remove once paper content ships |
| 3 | `FEATURE_AUDIO` | `FEATURE_AUDIO` | OFF | Audiobook catalog + player | **Partially wired:** `app/sitemap.ts` only; asserted by `scripts/lib/crawl-report.ts` checks. No route reads it | Sitemap drop VERIFIED; route-level honest-off **asserted by crawler, not enforced in a page component** | TBD | **Not defined.** Proposed: remove after audiobook catalog GA |
| 4 | `FEATURE_REVIEWS` | `FEATURE_REVIEWS` | OFF | Reviews + ratings ("coming-soon only" per NEXT_GO A7) | **Declared only — zero consumers repo-wide** | None enforced by this flag; honesty is enforced elsewhere (`tests/unit/form-honesty.test.tsx`, `product-truth.test.ts`) | TBD | **Not defined.** Proposed: wire or delete before Thaw |
| 5 | `FEATURE_BOOK_CLUBS` | `FEATURE_BOOK_CLUBS` | OFF | Book clubs / group reading | **Declared only — zero consumers repo-wide** | None via flag; `tests/unit/book-clubs-honesty.test.ts` guards the surface independently | TBD | **Not defined.** Proposed: wire or delete before Thaw |
| 6 | `FEATURE_WISHLIST` | `FEATURE_WISHLIST` | OFF | Wishlist (blocked on library/entitlement, P-018) | **Declared only — zero consumers repo-wide** | None enforced by this flag | TBD | **Not defined.** Proposed: remove when P-018 entitlement completes |
| 7 | `FEATURE_FOLLOWS` | `FEATURE_FOLLOWS` | OFF | Author follows (data layer exists: `author_follows`, `/api/follows`; no destination) | **Declared only — zero consumers repo-wide** | None enforced by this flag. Registry comment is explicit: a follow button with no observable outcome is a **MISLEADING surface** | TBD | **Not defined.** Proposed: remove when a follow feed/notification destination ships |
| 8 | *(none — no constant)* | `NEXT_PUBLIC_FEATURE_FRIENDLY_429` | OFF | Friendly rate-limit UX (E-003): JSON message + `/too-many-requests` for HTML | **Wired but outside the registry:** `lib/rate-limit-response.ts`; tests `tests/unit/friendly-429.test.ts`, `tests/e2e/rate-limit-abuse.spec.ts` | Standard 429 response (pre-E-003 behavior) | TBD | `docs/ENHANCEMENT_LEDGER.md`: "default off until measured" — **the only flag with a stated enable criterion** |

**Verified gap in the registry's own convention.** `lib/flags.ts` requires "owner · default · environments · expiry · rollback" per flag. Only **default** is actually recorded; **no flag in the file carries an owner, environment list, expiry, or rollback note**. Under §6 that makes all eight flags flag-debt until backfilled. This is a documentation-only observation; no code change is proposed here.

---

## 3. Proposed AI-era flags — **PROPOSED (none of these exist)**

Nothing below exists at HEAD. `lib/ai/*` is entirely PROPOSED per `docs/ARCHITECTURE_AI_PLATFORM.md` §2, which states every component ships **flag-off by default and fail-closed**. `docs/AGENT_REGISTRY.md` §3 requires a **kill switch** ("env flag and/or admin toggle") on every agent, cites `lib/flags.ts` as the precedent, and gates `APPROVED → ACTIVE` on "kill switch implemented and tested off"; `ACTIVE → SUSPENDED` must be reachable by any admin immediately, without approval.

| Proposed flag | Proposed env var | Default | Would gate | Proposed honest-off behavior | Removal criteria |
|---|---|---|---|---|---|
| `FEATURE_AI_ASSISTANT` | `FEATURE_AI_ASSISTANT` | **OFF** | User-facing assistant surface (orchestrator, `lib/ai/orchestrator/`) | Surface absent from nav; route returns honest unavailable page; `/api/ai/*` 404; sitemap drop | Never removed while the surface is user-facing — this is a permanent kill switch, not a rollout flag (AGENT_REGISTRY §3) |
| `FEATURE_AI_RAG` | `FEATURE_AI_RAG` | **OFF** | Retrieval pipeline (`lib/ai/rag/`, Brief §9) | Assistant degrades to non-AI catalog/resonance path; **never fabricates a citation** (ARCH §2 fail-closed) | Permanent kill switch |
| `FEATURE_AI_TOOL_GATEWAY` | `FEATURE_AI_TOOL_GATEWAY` | **OFF** | Tool gateway (`lib/ai/gateway/`, extends `lib/mcp/guard.ts`) | Deny-by-default allowlist; 404/401/429 fail-closed in guard order | Permanent kill switch |
| `FEATURE_AI_CONVERSATION_HISTORY` | `FEATURE_AI_CONVERSATION_HISTORY` | **OFF** | Conversation store (`lib/ai/conversation/`) | Stateless degrade; **no silent persistence** of Restricted data | Permanent (privacy-relevant) |
| `FEATURE_AGENT_<ID>` (one per agent, e.g. `FEATURE_AGENT_A03`) | same | **OFF** | Individual registry agent (A01–A40) | Agent unreachable; orchestrator routes to human or denies; audit event emitted | Permanent per-agent kill switch; retired only when the agent is retired from the registry |

**Rules these must follow (proposed):** (a) same `=== 'true'` opt-in shape as §2; (b) declared in `lib/flags.ts` with the full owner/default/environments/expiry/rollback record; (c) an AI flag may not be enabled while `docs/AI_EVALUATION_PLAN.md` gates are below threshold — ARCH §2 is explicit that a failing eval suite means "surface stays flag-off" and **A38 cannot waive**; (d) per-agent flags are cross-referenced from `docs/AGENT_REGISTRY.md` rather than duplicated.

---

## 4. Environment-variable schema — VERIFIED

Tiers are **NEXT_GO §10's** (`required` / `additive` / `conditional` / `forbidden-in-production`); this table adds consumer + fail-closed columns. Where NEXT_GO §10 and this table could disagree, **NEXT_GO §10 wins**. Store of record for all production runtime env: **Vercel → project `manguprojectz` → Settings → Environment Variables (Production)** (ADR-001 Option B); legacy Cloud Run mounts the same names from GCP Secret Manager `delta-wonder-488420-i3` (`docs/SECRET_INVENTORY.md`).

### 4.1 Security property: `NEXT_PUBLIC_*` is not a scope, it is a publication

Anything prefixed `NEXT_PUBLIC_` is **inlined into the client bundle at build time and is world-readable forever**. A value that must stay secret may never carry that prefix, and renaming a server-only var to `NEXT_PUBLIC_*` is a disclosure, not a refactor. Two public vars are public *by design* and their safety rests elsewhere: `NEXT_PUBLIC_SUPABASE_ANON_KEY` (safety via RLS — NEXT_GO §10) and `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (Stripe.js client key). Every other credential is server-only.

| Variable | Tier | Scope | Consumer (VERIFIED) | Fail-closed behavior when absent | Store of record |
|---|---|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | required | **public** | Supabase clients; `lib/utils/env-validation.ts` | `instrumentation.ts` **throws at production boot — refuses to serve** | Vercel Production |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | required | **public** (RLS-protected) | Browser Supabase client | Boot refusal (launch-critical) | Vercel Production |
| `SUPABASE_SERVICE_ROLE_KEY` | required | server-only **secret** | Server reads, admin ops, `/api/health` | Boot refusal (launch-critical) | Vercel Production; GCP `supabase-service-role-key` |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | required | **public** | Stripe.js | `validate-env` error unless `USE_MOCKS=true`; must match `sk_` mode | Vercel Production (build-time) |
| `STRIPE_SECRET_KEY` | required | server-only **secret** | Stripe server API | `validate-env` error unless mocks; payments unavailable | Vercel; GCP `stripe-secret-key` |
| `STRIPE_WEBHOOK_SECRET` | required | server-only **secret** | `/api/webhook` signature verification | Unverifiable webhooks — must reject | Vercel; GCP `stripe-webhook-secret` |
| `UPSTASH_REDIS_REST_URL` | required | server config | `lib/rate-limit.ts` | **Fail-closed:** protected buckets REJECTED, `reason: 'unavailable'` | Vercel; GCP `upstash-redis-rest-url` |
| `UPSTASH_REDIS_REST_TOKEN` | required | server-only **secret** | `lib/rate-limit.ts` | Same fail-closed rejection | Vercel; GCP `upstash-redis-rest-token` |
| `NEXT_PUBLIC_SITE_URL` | required | **public** | `lib/seo/siteUrl.ts`, canonical/sitemap/robots/OG, auth redirects | Falls back to `VERCEL_URL` — **wrong canonical origin**; never localhost/preview in production | Vercel Production |
| `MONGODB_URI` | additive (ADR-002) | server-only **secret** | `lib/data/*` when `DATABASE_PROVIDER=mongodb` | Warning today; **required** once `AUTH_PROVIDER=better-auth` (validator adds it to `missing`) | Vercel; Atlas |
| `MONGODB_DB` | additive | server config | Mongo client | Defaults to `mangu` | Vercel |
| `RESEND_API_KEY` | conditional | server-only **secret** | `lib/email/send.ts`, `lib/email/triggers.ts`, `lib/auth.ts` | Email **skipped with a `console.warn`** (reset, verification, receipts, review alerts) — degrade, not crash | Vercel; GCP `resend-api-key` |
| `RESEND_AUDIENCE_ID`, `CONTACT_INBOX_EMAIL` | conditional | server config | List email / contact form | Feature inert | Vercel |
| `OPENAI_API_KEY` | conditional | server-only **secret** | `lib/resonance/embeddings.ts` | Embeddings throw; `lib/resonance/recommendations.ts` vector stages **no-op and fall back** to non-vector recommendations | Vercel; GCP `openai-api-key` |
| `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` / `SENTRY_ORG` / `SENTRY_PROJECT` / `SENTRY_AUTH_TOKEN` / `SENTRY_RELEASE` / `SENTRY_ENVIRONMENT` | conditional | DSNs public by design; `SENTRY_AUTH_TOKEN` **secret** (CI only) | `sentry.{client,server,edge}.config.ts` | **Degrades silently** — no error telemetry. Confirm events land after any change | Vercel / GitHub Secrets |
| `BLOB_READ_WRITE_TOKEN` | conditional | server-only **secret** | Vercel Blob (covers, manuscripts) | Validator adds to `missing` when `STORAGE_PROVIDER=vercel-blob` | Vercel Blob |
| `BETTER_AUTH_SECRET` | conditional | server-only **secret** | Better Auth (dual-run) | Required (≥32 chars) when `AUTH_PROVIDER=better-auth`; unused while `supabase` | Vercel |
| `BETTER_AUTH_URL` | conditional | server config | Better Auth base URL | Falls back to `NEXT_PUBLIC_SITE_URL`; must equal it | Vercel |
| `AUTH_LEGACY_RESET_COPY` | conditional | server config | `lib/auth.ts`, `scripts/send-forced-resets.ts` (`1`/`true`) | Standard reset copy | Vercel / operator shell |
| `MCP_ENABLED` | conditional | server config | `lib/mcp/guard.ts` | **Absent ⇒ `/api/mcp/*` returns 404.** Off is the default and the safe state | Vercel |
| `MCP_API_KEY` | conditional | server-only **secret** | `lib/mcp/guard.ts` bearer check | `MCP_ENABLED=true` **without** a key ⇒ logs and **fails closed to 404** — never reachable unauthenticated | Vercel |
| `FEATURE_*` (§2 rows 1–7) | conditional | server config | `lib/flags.ts` | Absent ⇒ feature OFF ⇒ honest-unavailable contract | Vercel |
| `NEXT_PUBLIC_FEATURE_FRIENDLY_429`, `NEXT_PUBLIC_APP_VERSION` | conditional | **public** | `lib/rate-limit-response.ts`; UI/diagnostics | Absent ⇒ prior behavior | Vercel |
| `DATABASE_PROVIDER`, `AUTH_PROVIDER`, `STORAGE_PROVIDER` | conditional | server config | §5 | Absent ⇒ `supabase` (safe legacy default) | Vercel |
| `BASE_URL` | conditional (CI/E2E) | test-runner config | `playwright.config.ts`, `scripts/crawl-regression.ts`, `scripts/role-crawl.ts` | Defaults to localhost; **not a production variable** | CI |
| `TRUSTED_PROXY_COUNT` | conditional (NEXT_GO §10, "after topology fixed") | server config | **No consumer at HEAD** — see §8 G4 | n/a today | n/a |
| `VERCEL_URL`, `VERCEL_PROJECT_PRODUCTION_URL`, `VERCEL_GIT_COMMIT_SHA`, `NODE_ENV`, `NEXT_RUNTIME` | platform-injected | config | `lib/seo/siteUrl.ts`, instrumentation | Never set by hand | Vercel (injected) |
| **`USE_MOCKS`** | **forbidden in production** | server config | `lib/utils/env-validation.ts` `useMocks()`; CI build only | Must be **ABSENT** — not `false`, not empty. `validate-env --production` errors on `=true`, warns on any value | Delete, never rotate |
| **`SKIP_EMAILS`** | **forbidden in production** | server config | `skipEmails()` in `lib/utils/env-validation.ts` | Must be **ABSENT**. `true` silently drops password-reset and receipt email | Delete, never rotate |

---

## 5. Provider switches — the iron rule

| Switch | Values | Default (VERIFIED) | Reader | Production value today |
|---|---|---|---|---|
| `AUTH_PROVIDER` | `supabase` \| `better-auth` (`betterauth`/`ba` accepted) | **`supabase`** — `lib/auth/provider.ts` | `getAuthProvider()`, `isBetterAuthPrimary()` | `supabase` |
| `DATABASE_PROVIDER` | `supabase` \| `mongodb` (`mongo` accepted) | **`supabase`** — `lib/db/provider.ts` | `getDatabaseProvider()`, `isMongoPrimary()` | per `docs/operations/ENVIRONMENT_MATRIX.md` |
| `STORAGE_PROVIDER` | `supabase` \| `vercel-blob` | **`supabase`** — `lib/utils/env-validation.ts` | storage layer | `supabase` unless Blob token set |

**Iron rule.** `CLAUDE.md` (lines 6–7): *"`AUTH_PROVIDER=supabase` (default). Do not flip `AUTH_PROVIDER=better-auth` in Vercel Production until Phase 11 forced-reset readiness."* `docs/PROJECT_PHOENIX.md` §1: production stays on Supabase Auth **until Phase 11–12 cutover** so the site keeps serving readers. Phase 12 entry criteria require Phase 11 migration signed off (P11.6).

Therefore: **a provider switch is not a feature flag and must never be flipped as one.** Flipping either variable in Vercel Production before Phase 11–12 readiness is a data-integrity event, not a rollout — the forced-reset import plan, the Mongo round-trip dry run (P11.3), and `/api/health?ready=1` verification all gate it. Provider flips are owner-authorized, logged in `docs/OPERATOR_QA_LOG.md`, and reversible only by flipping back plus a redeploy.

---

## 6. Flag lifecycle

| Stage | Gate to leave the stage | Evidence required |
|---|---|---|
| 1. **Propose** | Flag record complete: owner · default (**always OFF**) · environments · expiry · rollback (`lib/flags.ts` convention) | Record present in the registry file |
| 2. **Implement flag-off first** | The off-state ships and is reviewed *before* the on-state exists | Honest unavailable page, nav hidden, API 404, sitemap dropped |
| 3. **Verify honest-off** | Every off-state proven, not assumed | Route test + `noindex` + `app/sitemap.ts` exclusion + crawl check (`scripts/lib/crawl-report.ts` pattern) |
| 4. **Enable per environment** | Preview → Production, one environment at a time, with real content behind it | Env change recorded; deploy verified; rollback = unset the var + redeploy |
| 5. **Measure** | Stated success metric observed for a stated window | Metric recorded against the flag's expiry criterion |
| 6. **Remove the flag** | Both branches no longer needed; dead branch deleted with the flag | PR deleting the constant, the env var, and the off-state branch |

**Rule: a flag with no removal criteria is debt.** Every flag is a permanent conditional in the codebase until someone deletes it; a flag nobody has committed to removing is an untracked liability. Two exemptions, declared explicitly: (a) **kill switches** (§3, `MCP_ENABLED`) are permanent by design and record "permanent kill switch" in place of an expiry; (b) **provider switches** (§5) are migration contracts governed by PROJECT_PHOENIX, not this lifecycle.

By this rule, **7 of 8 flags in §2 are currently debt** — only `NEXT_PUBLIC_FEATURE_FRIENDLY_429` carries a stated criterion ("default off until measured"). Four of the seven (`FEATURE_REVIEWS`, `FEATURE_BOOK_CLUBS`, `FEATURE_WISHLIST`, `FEATURE_FOLLOWS`) additionally have **zero consumers**: they are declarations that gate nothing, so flipping them on would change nothing while implying otherwise. Wire them or delete them.

---

## 7. Validation and CI — what actually enforces this today

| Control | Path (VERIFIED) | What it enforces | Where it runs |
|---|---|---|---|
| Env validator library | `lib/utils/env-validation.ts` (413 lines, hand-rolled `EnvConfig[]` — **not zod**) | Required/optional names, prefix formats, `requiredUnlessMocks`, Stripe completeness, Upstash pairing, Better Auth conditionals, Blob-when-`vercel-blob` | Imported by the three controls below |
| CLI validator | `scripts/validate-env.ts` → `npm run validate-env`, `npm run validate-env:production` | Production-shaped check against `.env.production.example`: missing/placeholder-shaped values, Stripe live/test mode consistency, and **`USE_MOCKS`/`SKIP_EMAILS` must be ABSENT** (exit 1). Never prints values (CCR-009) | Manual; and as a `predev` step (`"dev": "npm run validate-env && next dev"`) |
| Production boot guard | `instrumentation.ts` | **Throws and refuses to boot** if `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, or `SUPABASE_SERVICE_ROLE_KEY` is missing. All other findings are logged as warnings only | Every production Node runtime start |
| Runtime health | `app/api/health/route.ts` → `validateEnvironment()`; `/api/health?ready=1` | Readiness surface incl. Mongo when `DATABASE_PROVIDER=mongodb` | On request |

**Stated plainly: there is no CI enforcement of the environment schema.** `.github/workflows/ci.yml` runs `validate:gap-ledger`, `type-check`, `lint`, `test`, `build` — **it does not run `validate-env` or `validate-env:production`**, and it deliberately sets `USE_MOCKS: 'true'` plus dummy Supabase/Stripe/site values so `next build` can prerender. That is correct for the runner and irrelevant to production, but it means the production-shape check is currently **operator-run only**. `docs/operations/ENVIRONMENT_MATRIX.md` §5 records the consequence: absence of `USE_MOCKS`/`SKIP_EMAILS` in Vercel Production is **NOT YET PROVEN**, because no agent can read the Vercel environment.

Equally: **no automated check enforces the flag-off contract across all flags.** Honest-off behavior is covered by targeted tests (`tests/unit/book-clubs-honesty.test.ts`, `form-honesty.test.tsx`, `product-truth.test.ts`) and by `scripts/lib/crawl-report.ts` checks, not by a registry-driven suite.

---

## 8. Open decisions and gaps

| # | Gap | Impact | Proposed resolution (owner decision) |
|---|---|---|---|
| G1 | `NEXT_PUBLIC_FEATURE_FRIENDLY_429` is a real flag that lives in `lib/rate-limit-response.ts`, outside the `lib/flags.ts` registry | The registry is not the single source of truth for flags | Move the constant into `lib/flags.ts` (Thaw), or document the exemption for public/client-read flags |
| G2 | No flag carries owner / environments / expiry / rollback, despite the registry's own stated convention | Every flag is §6 debt; no one is accountable for a flip | Backfill the five fields for all 8 flags; block new flags without them |
| G3 | `FEATURE_REVIEWS`, `FEATURE_BOOK_CLUBS`, `FEATURE_WISHLIST`, `FEATURE_FOLLOWS` have zero consumers; `FEATURE_AUDIO` is wired only in `app/sitemap.ts` | A flag that gates nothing is a false control — flipping it implies an effect it cannot deliver | Wire or delete before Thaw; for `FEATURE_AUDIO`, add the route-level honest-off the crawler already asserts |
| G4 | `TRUSTED_PROXY_COUNT` appears in NEXT_GO §10 (conditional) but has **no consumer at HEAD** | Documented control that does not exist | Owner: implement with the proxy-topology fix, or amend NEXT_GO §10 |
| G5 | `validate-env:production` is not a CI step | Env correctness depends on an operator remembering | Add a names-only production-shape job (must not require secrets), or record the manual run in `docs/OPERATOR_QA_LOG.md` each release |
| G6 | Flag-off contract is not enforced by a registry-driven test | New flags can ship without honest-off states | Add a contract suite that iterates the registry (Thaw work) |
| G7 | §3 AI flags are entirely PROPOSED; no `lib/ai/*` exists | Nothing to enable and nothing to kill | Ratify names with `docs/AGENT_REGISTRY.md` before E06/E07 build starts (post-freeze) |
| G8 | Absence of `USE_MOCKS` / `SKIP_EMAILS` in Vercel Production is unproven | NEXT_GO §10 "forbidden" tier is asserted, not evidenced | Operator action per `docs/operations/ENVIRONMENT_MATRIX.md` §4 item 1; record in `docs/OPERATOR_QA_LOG.md` |
| G9 | This document has no owner | T-13.3 cannot leave PROPOSED | Owner assignment + sign-off |

---

**Change control:** this file is DRAFT/PROPOSED. Nothing in it enables a flag, sets a variable, or authorizes a provider flip. Rollback = revert the docs commit.
