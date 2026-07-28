# Programme Evidence Packet — MANGU Publishers launch

**Compiled:** 2026-07-28 · **Compiled at base:** `audit/2026-07-28-fixes` @ `23e50c1`
**Covers:** PRs #350–#360. One evidence record per task in the controlling plan.
**Companion documents:** `docs/launch/PROGRAMME_STATUS.md` (state of play),
`docs/launch/HUMAN_ACTIONS.md` (the single human action list).

This is a record of evidence, not an assertion of readiness. It is **not** gate evidence for
G1–G13 — those require an exact release-candidate SHA, a named human approver and a real
environment, per `docs/NEXT_GO.md` §6. See `docs/launch/LAUNCH_GATE_EVIDENCE.md` (PR #351)
for that.

---

## 0. The validation truth, stated once

Every record below inherits this. Where a record's **Validation executed** section adds
something, it says so explicitly; where it does not, this is the whole of it.

**What was executed, across the whole programme:**

- **Static TypeScript syntax checks passed** on every changed `.ts`/`.tsx` file in every PR.
  Agents ran a standalone compiler (variously `tsc --noEmit --strict`, `--noResolve`,
  `--skipLibCheck`, `--noCheck`). Residual `TS2307`/`TS2304`/`TS2580`/`TS2582`/`TS2503`
  module- and global-resolution diagnostics were expected and excluded, because
  `node_modules` was never installed.
- **Several agents additionally compiled modules and executed them under `node` against
  fakes**, outside jest: #353 (67 assertions), #357 (the gate compiler against the real and
  a doctored evidence document), #358 (101 assertions plus five end-to-end CLI runs), #359
  (27 assertions), #356 (Mongo write helpers against a fake `Db`).
- **Two agents ran live, read-only probes against production**: #353 (`health:check` 5/5
  green, `seo:check` 0 errors / 2 warnings) and #352 (`GET /register` → 200, 43,502 bytes,
  full server-rendered form markup and `<title>`).

**What was NOT executed:**

- **The jest suite was not run by any agent.** Not once, in any of the eleven PRs.
- **The Playwright suite was not run by any agent.** No browser rendered any page in this
  programme.
- The reason is uniform and was declared by every agent that had a suite to run: the
  authoring sandbox caps commands at 45 seconds, which `npm ci` for this repository exceeds,
  so dependencies could not be installed.

**What CI says, and it is authoritative:**

- CI now runs on stacked PRs. Before `.github/workflows/ci.yml` was changed to accept
  `audit/**` and `task/**` as pull-request base branches, **no PR in this programme had any
  checks at all**.
- **CI is currently red at `npm test` on all eleven branches** (runs #881–#891).
  `type-check` and `lint` pass on all eleven. **`npm run build` is skipped on all eleven and
  is therefore entirely unverified.**
- The red is inherited by the ten stacked branches (all fork at `8e6fa50`) and was
  introduced by PR #350's own final content commit `8e6fa50`. `main` is green (run #875,
  `7effd55`). See `PROGRAMME_STATUS.md` §1.

**No statement in this packet claims a test passed that was not run.** Where an agent
claimed something this recorder could not confirm, the claim is attributed and marked
UNCONFIRMED.

---

## Task 0.4 Evidence

Status: `READY_FOR_HUMAN_ACTION` | Branch: `task/ops-monitoring-and-launch-tooling` | Commit(s): `7ec644e` (head) | PR: #353 | Environment tested: production (read-only HTTP GETs) + local `node`

### Current-state findings
The monitor named `mangu-site-health-check` **is not in this repository**. It is a Cowork
scheduled task on Renee's machine (daily, cron `30 7 * * *`, America/New_York, ~8 min
jitter). The repo's nearest relatives — `app/api/health/route.ts` and
`.claude/skills/mangu-ops-runbook/scripts/health-probe.sh` — perform none of the three
documented checks. The agent flagged this as a contradiction against its brief rather than
inventing a file.

### Changes made
Added a deterministic, unit-tested implementation of the monitor's checks so the behaviour
is reviewable. Checks 1–3 preserve the existing monitor exactly (homepage, `/api/books` with
`success:true`, book-detail canary with fallback to the first slug from `/api/books`). New:
(4) `/login` server render asserting the raw HTML contains `Welcome back`; (5) Supabase
`/auth/v1/health` with the project ref parsed from the env var at runtime, never hardcoded,
masked in output, anon key sent as a header only; (6) `/checkout` non-5xx, opt-in via
`--with-checkout` and advisory so it can never page anyone at 07:30.

### Files changed
`scripts/lib/site-health.ts` (new) · `scripts/site-health-check.ts` (new) ·
`tests/unit/site-health.test.ts` (new) · `package.json` (one alias, `health:check`)

### Validation executed
Per §0. Additionally: `tsc --strict` clean; 24 unit assertions in `site-health.test.ts`
executed outside jest as part of the 67-assertion run; **`health:check` run live against
production — 5/5 checks green, exit 0, no false alarm**; `--simulate-failure=login-render`
produced a full alert with dual timestamps, URL, status, threshold result, redacted excerpt
and first diagnostic action, exit 1; a non-existent Supabase ref correctly reported
`DNS resolution failed (NXDOMAIN / ENOTFOUND) … paused-or-deleted-project signature`; a live
ref unauthenticated returned 401 and was correctly accepted as healthy — a bug found and
fixed during development. Jest not run. CI red at `npm test` (run #884), build skipped.

### Acceptance criteria
Six checks implemented and unit-covered ✅ · no secret, project ref or email survives into
rendered output ✅ (dedicated test) · advisory checks never page ✅ · **the running scheduled
task on Renee's machine actually uses the new prompt** ❌ — not done, and not an agent action.

### Risks and follow-up
The repository copy and the machine copy can drift silently. Until the scheduled task is
updated, this code monitors nothing on a schedule.

### Rollback
`git revert` the merge, or delete the branch. Nothing imports these files at runtime and no
CI step calls them. Reverting `package.json` removes one alias.

### Human action required
**HA-B4** — apply the updated monitor prompt to the `mangu-site-health-check` scheduled task.
**HA-B5** — decide where alerts go (`docs/operations/INCIDENT_RESPONSE.md` ships with `_TBD_`
recipients).

---

## Task 0.7 Evidence

Status: `READY_FOR_REVIEW` | Branch: `task/ops-monitoring-and-launch-tooling` | Commit(s): `7ec644e` | PR: #353 | Environment tested: workflow dry-run render + local `bash -n`

### Current-state findings
`.github/workflows/rotate-supabase-key.yml` carried a **hardcoded Supabase project ref** and
a summary implying rotation was complete when only the **anon** key had been rotated. A bulk
"disable all legacy JWT keys" action in the Supabase console also disables the `service_role`
JWT, which nothing in the workflow re-provisions. Separately, the agent probed the old ref
`tkzvikozrcynhwsqtkqp` on 2026-07-28 and found it does **not** NXDOMAIN — it resolves and
`/auth/v1/health` returns 401 "No API key found", i.e. the project exists and its gateway is
serving. The ref was therefore parameterised, not replaced.

### Changes made
Project ref removed; dashboard link and verification `curl` now use an optional
`supabase_project_ref` input, else derive from `new_supabase_url`, else fall back to
Supabase's `/project/_/` picker with a `::warning::`. Summary gains a prominent
**⛔ READ BEFORE DISABLING ANY KEY** block. Step 2 explicitly says not to use the bulk action.

### Files changed
`.github/workflows/rotate-supabase-key.yml`

### Validation executed
Per §0. Additionally: YAML parse ✅; `bash -n` on the rewritten summary step ✅; rendered
dry-run and live output inspected ✅; grep for a hardcoded ref ✅ none. CI red at `npm test`
(run #884) — unrelated to this file.

### Acceptance criteria
No hardcoded ref ✅ · no secret value ✅ · service-role gap loud rather than silent ✅ ·
**workflow actually run in dry-run mode by a human** ❌.

### Risks and follow-up
The workflow's rotation steps are byte-identical either way — only the summary and links
changed. The service-role key still has no automated rotation path.

### Rollback
Revert the file. Restores the previous summary and the dead hardcoded link.

### Human action required
**HA-B6** — run *Actions → Rotate Supabase Anon Key* with `dry_run: true` and confirm the
⛔ block renders and the dashboard link uses your ref (or the `_` picker).

---

## Task 1.0 Evidence — CRITICAL PATH

Status: `READY_FOR_REVIEW` | Branch: `task/phase1-catalog-data-path` | Commit(s): `00c6758` (head), incl. `4842a41`, `1667e9a`, `f2ffa8d` | PR: #356 | Environment tested: none — static checks and `node` against a fake `Db` only

### Current-state findings
**A book published through the admin UI could never appear on the public site.**
`createBookAdmin`, `updateBookAdmin` (`lib/actions/books.ts`) and `updateBookStatusAction`
(`app/admin/actions.ts`) wrote to Supabase unconditionally via the service-role client, while
`lib/data/books.ts` reads MongoDB in production (`/api/books` reports
`"provider":"mongodb"`). Second half of the same defect: the admin *read* paths
(`app/admin/books/new/page.tsx`, `app/admin/books/[id]/edit/page.tsx`) also went straight to
Supabase, so under the production provider the edit form could not load a Mongo book at all.
Third: `createBookMongo` hardcoded `visibility:'private'`, so even a "published" Mongo book
stayed invisible to the public filter (`status='published' AND visibility='public'`).
Fourth: `updateBookStatusAction` accepted only `draft|published` while the edit form offered
`archived` — it silently no-op'd. Fifth: unpublish **nulled `published_at`**, destroying the
original publication date irrecoverably.

### Changes made
Option A, as recorded in ADR-001 (PR #351): admin writes are provider-aware, branching on the
existing `isMongoPrimary()`. No new provider switch. Options B (flip production reads to
Supabase) and C (dual-write) were rejected with reasons in the ADR. Admin reads route through
`lib/data/admin-books.ts`, which dual-runs. Visibility is derived from status on both
providers (published ⇒ public; draft/archived ⇒ private). `published_at` is stamped on first
publish and **never nulled**. Status domain aligned to `ADMIN_BOOK_STATUSES`. Auth and the
`profiles.role` admin gate are unchanged — auth stays on Supabase per the locked architecture.

### Files changed
`lib/books/fields.ts` (new — one definition of the six retailer fields, the status→visibility
rule, https-only URL normalisation, the catalog projection list, slug derivation; replaces
three independent copies) · `lib/actions/books.ts` · `app/admin/actions.ts` ·
`lib/mongo-books.ts` (new `createBookAdminMongo`, `updateBookAdminMongo`, `setBookStatusMongo`,
`getAdminBookMongo`, `listAdminAuthorsMongo`) · `lib/data/admin-books.ts` ·
`app/admin/books/new/page.tsx` · `app/admin/books/[id]/edit/page.tsx` ·
`tests/unit/mongo-book-admin-writes.test.ts` ·
`tests/unit/admin-book-write-read-roundtrip.test.ts`

### Validation executed
Per §0. Additionally: one agent compiled and executed the Mongo write helpers against a fake
`Db`. **The headline acceptance test — create draft → not visible to the public read path →
publish → appears in `listPublishedBooks` *and* `fetchBookForApi` → unpublish → disappears →
`published_at` survives — was written and has never executed.** CI red at `npm test`
(run #882), build skipped. The PR body states: *"do not merge until `validate:gap-ledger`,
`type-check`, `lint`, `test` and `build` are green."*

### Acceptance criteria
Admin write reaches the database the public read path consults ⏳ unverified · no write path
constructs a client for a database no read path consults ⏳ unverified · result codes and
`revalidatePath`/`revalidateTag` calls preserved ⏳ unverified · `published_at` survives
unpublish ⏳ unverified. **Zero acceptance criteria are evidenced.**

### Risks and follow-up
Existing Supabase-only book rows are **not** migrated by this PR — backfill is a separate,
approval-gated step (Task 3.6, PR #359). If both stores hold non-identical live book rows,
that is a documented STOP condition. Author-scoped `createBook` on Supabase cannot satisfy
`books.genre NOT NULL` (`CreateBookInput` has no genre) — pre-existing, needs a product
decision.

### Rollback
Revert the PR. No migration to unwind, no data deleted. One persistent effect: books
published through the admin UI while it was live exist as Mongo documents with
`visibility:'public'`, and after a revert the admin UI returns to writing Supabase while
those Mongo books remain public until unpublished directly.

### Human action required
**HA-A2** (merge #356 after #350 goes green) · **HA-C5** (approve or refuse the backfill of
stranded Supabase-only rows) · **HA-E6** (manual QA of the full publish round trip in a
preview with `DATABASE_PROVIDER=mongodb`).

---

## Task 1.1 Evidence

Status: `READY_FOR_REVIEW` | Branch: `task/architecture-and-governance-docs` | Commit(s): `5080fad` | PR: #351 | Environment tested: n/a — documentation only

### Current-state findings
No accepted record existed of which database owns which entity, so three separate copies of
the retailer field list and four conflicting `BookStatus` type definitions had accumulated.
The Task 1.0 blocker had never been written down as a decision.

### Changes made
`ADR-001-catalog-and-identity-data-ownership.md` records **Option A** as the decision, with a
per-path branch table, the derived-visibility rule, Mongo/Supabase/storage responsibilities,
the Task 2.0b field gaps, rejected Options B and C, a six-step migration/backfill strategy,
ten rules for future contributors, the full Phoenix switch stack and the Vercel-vs-Cloud-Run
duality (Vercel authoritative). `DATA_OWNERSHIP_MATRIX.md` covers 13 entities plus a
per-field source-of-truth table. `SCHEMA_DRIFT_DISPOSITIONS.md` records 17 items D-01…D-17,
each with file, line, grep evidence that the object exists in no migration, a disposition and
an owner.

### Files changed
`docs/architecture/ADR-001-catalog-and-identity-data-ownership.md` ·
`docs/architecture/DATA_OWNERSHIP_MATRIX.md` ·
`docs/architecture/SCHEMA_DRIFT_DISPOSITIONS.md`

### Validation executed
Per §0. The agent reports an automated pass confirming **all 86 cited source paths resolve**
at `8e6fa50` — **UNCONFIRMED**: this recorder did not re-run it. Documentation has no test
surface; correctness here is a review activity. CI red at `npm test` (run #885) for the
inherited reason only; this PR changes no `.ts`, `.sql`, `.json` or workflow file.

### Acceptance criteria
Decision recorded ✅ · alternatives and reasons recorded ✅ · every entity has a source of
truth ✅ · **ADR signed** ❌ (G9 requires a signature) · **numbering collision resolved** ❌.

### Risks and follow-up
**Two live ADR-001s.** `docs/adr/ADR-001-canonical-platform.md` already exists and is
ACCEPTED. The agent filed under the requested name so work was not blocked and escalated the
collision rather than renumbering unilaterally.

### Rollback
Delete the three files. Nothing references them from code.

### Human action required
**HA-C6** — resolve the ADR-001 numbering collision. **HA-A5** — sign ADR-001 (G9).

---

## Task 1.2 Evidence

Status: `READY_FOR_REVIEW` | Branch: `task/phase1-catalog-data-path` | Commit(s): `00c6758` | PR: #356 (code) + #351 (dispositions doc) | Environment tested: none — static checks only

### Current-state findings
Code read and wrote columns, tables and RPCs that exist in **no migration**:
`books.{subtitle, epub_url, deleted_at, author_name, metadata, tags, categories, view_count,
download_count, manuscript_url, language, seo_title, seo_description}`, tables
`book_view_cache` / `book_views`, and RPCs `books_search` / `increment_view_count`. Two
parallel audit systems (`logAudit` and `recordAudit`) wrote different shapes. `audit_logs`
has RLS on with a SELECT policy and **no INSERT policy**.

### Changes made
No new migration — hosted drift is unreconciled (Task 3.6), so every disposition is
code-side. `subtitle` **removed** from the admin form, action inputs and payloads, deferred
pending a post-3.6 forward migration. `epub_url` **remapped** through `setBookAssets`
(Supabase → `book_content.epub_url`). `deleted_at` soft-delete semantics **removed**,
expressed via the real `status='archived'` plus non-public visibility; nothing that was a
soft delete became a hard delete. `author_name`, `metadata`, `tags`, `categories`, `language`,
`seo_title`, `seo_description`, `manuscript_url` **removed** from the Supabase payload, which
is now an explicit real-column allow-list. `getBookStats` and `incrementViewCount`
**deleted** — no callers. RPC `searchBooks` **deleted** — no callers. `manuscript_url` in
`app/api/files/[id]` **remapped** to `book_content.epub_url` with a `pdf_url` fallback;
authorisation and streaming unchanged. Audit **consolidated** onto `recordAudit`, writing
only columns that exist, with failures surfaced to the caller rather than swallowed, and
tokens/passwords/payment secrets/private file URLs redacted.

### Files changed
`lib/actions/books.ts` · `lib/audit.ts` · `lib/data/book-assets.ts` (new — first
`book_content` writer in the repo) · `app/api/files/[id]/route.ts` · `types/mongo.ts` ·
`tests/unit/schema-drift-dispositions.test.ts` · plus
`docs/architecture/SCHEMA_DRIFT_DISPOSITIONS.md` in #351

### Validation executed
Per §0. Static checks clean. The disposition unit cases were written and **not run**.
The #351 companion asks reviewers to confirm the evidence by grep — `grep -rn "subtitle"
supabase/migrations/` expecting 0 matches and `grep -rn "books_search"
supabase/migrations/` expecting exactly one `CREATE INDEX` (`idx_books_search`). CI red at
`npm test` (run #882), build skipped.

### Acceptance criteria
Every drift item has a disposition ✅ (17 of 17, documented) · no code path writes a
non-existent column ⏳ unverified · audit writes succeed ⏳ unverified · **no migration
created** ✅ verified — zero files under `supabase/migrations/` changed in any of the eleven
PRs.

### Risks and follow-up
`audit_logs` has no INSERT policy, so audit writes must continue to use the service-role
client. `subtitle` returns only after a post-3.6 forward migration, if Renee wants it.

### Rollback
Revert the PR. Deletions of dead code are safe; the remaps are behavioural and revert cleanly.

### Human action required
**HA-C1** — decide whether `subtitle` comes back. **HA-C5** / **HA-B1** — the hosted export
(Task 3.6) must complete before any of this can be reconciled on the database side.

---

## Task 1.3 Evidence

Status: `READY_FOR_REVIEW` | Branch: `task/phase1-auth-security` | Commit(s): `6f56089` | PR: #352 | Environment tested: **production** (`https://www.mangu-publishers.com/register`)

### Current-state findings
**No genuine SSR de-opt exists on `/register`.** The only App Router client-side-rendering
bail-out is `useSearchParams()`/`usePathname()` outside a `<Suspense>` boundary. Grepping the
whole `/register` render tree (`app/(auth)/layout.tsx` → `register/page.tsx` →
`RegisterForm.tsx` → `Card`/`Input`/`Button`/`LoadingSpinner`) finds **zero** occurrences.
No `export const dynamic`, no `ssr: false`. The only two hits in `app/(auth)/**` are
`login/LoginForm.tsx` (wrapped in Suspense by #350) and `reset-password/confirm/page.tsx`
(already wraps its own content).

### Changes made
**None.** The task was investigated before anything was touched, as instructed, and the
premise did not hold.

### Files changed
None.

### Validation executed
Per §0. Additionally, and decisively: a **live production probe** at the branch's base commit
deployed — `GET /register` → HTTP 200, 43,502 bytes, containing `Create an account` ×1,
`Full Name` ×1, `Confirm Password` ×1, `aria-label="Create account form"` ×1,
`name="password"` ×1, the server-generated `<title>Create Account | MANGU Publishers</title>`,
and **zero** occurrences of `"Bail out to client-side rendering"`. This is the strongest
single piece of evidence in the programme. CI red at `npm test` (run #883) for reasons
unrelated to this task.

### Acceptance criteria
`/register` returns server-rendered form markup ✅ evidenced live · server-generated `<title>`
present ✅ · no CSR bail-out marker ✅. **All criteria met.** Status is `READY_FOR_REVIEW`
rather than `COMPLETE` only because the branch carrying this finding cannot merge while CI
is red.

### Risks and follow-up
PR #350 noted that `/register` "also serves an empty body in production" and asked for a
local repro. This investigation contradicts that: at the probed commit it served 43,502 bytes.
**#350's claim about `/register` should be treated as superseded.**

### Rollback
Nothing to roll back.

### Human action required
None.

---

## Task 1.4 Evidence

Status: `READY_FOR_HUMAN_ACTION` | Branch: `task/phase1-auth-security` | Commit(s): `6f56089` | PR: #352 | Environment tested: none — static checks only

### Current-state findings
`app/api/webhooks/stripe/route.ts` was a **49-byte silent re-export**
(`export { GET, POST } from '../../webhook/route'`). Two live URLs accepted production
payment events, two signing secrets could drift, and nothing in the repo recorded which URL
Stripe was actually pointed at.

### Changes made
**410 Gone, not deletion.** The Stripe dashboard endpoint URL is external configuration this
repo cannot read; deleting the route turns a misconfigured dashboard into an anonymous 404
with no operator signal, whereas a 410 whose JSON body names `/api/webhook` appears verbatim
in Stripe's event log. The deprecated route never verifies a signature and never fulfils an
order, and logs the misroute **without** echoing the unverified payload or headers. The
canonical handler `app/api/webhook/route.ts` was **audited and left byte-identical**: it
verifies with `stripe.webhooks.constructEvent`, returns 503 when the secret is unconfigured
and 400 on a missing/failed signature — both *before* any fulfilment — and is idempotent at
event level (`checkIdempotency()` against `webhook_events`) and at order level under
`DATABASE_PROVIDER=mongodb` (`$setOnInsert` upsert keyed on `stripe_payment_intent_id`).
Four events handled: `checkout.session.completed`, `checkout.session.expired`,
`charge.refunded`, `payment_intent.payment_failed`.

### Files changed
`app/api/webhooks/stripe/route.ts` · `tests/unit/stripe-webhook-consolidation.test.ts` (new)

### Validation executed
Per §0. Static checks clean. The 410-contract and canonical-handler-contract unit cases were
written and **not run**. The existing `tests/unit/webhook-order-idempotency.test.ts` was read,
unchanged, and **not run**. CI red at `npm test` (run #883).

### Acceptance criteria
One canonical endpoint ✅ in code · deprecated endpoint returns 410 naming the canonical path
⏳ unverified · **Stripe dashboard points at the canonical endpoint** ❌ unknown ·
**signing secret matches `STRIPE_WEBHOOK_SECRET` in Vercel production** ❌ unknown ·
**enabled event list is exactly the four handled** ❌ unknown.

### Risks and follow-up
**If the Stripe dashboard currently points at `/api/webhooks/stripe`, deliveries start
failing with 410 the moment this deploys.** Separately,
`scripts/create-stripe-webhook.sh` targets the **apex** `https://mangu-publishers.com/api/webhook`
while the canonical host is `https://www.mangu-publishers.com` — not changed, because the repo
does not say whether the apex redirect is intentional.

### Rollback
Revert the one file. The canonical handler is untouched either way.

### Human action required
**HA-B7** (confirm the dashboard endpoint URL) · **HA-B8** (confirm the signing secret) ·
**HA-B9** (confirm the enabled event list) · **HA-C7** (decide apex vs www). All four block
G8.

---

## Task 1.5 Evidence

Status: `READY_FOR_REVIEW` | Branch: `task/phase1-auth-security` | Commit(s): `6f56089` | PR: #352 | Environment tested: none — static checks only

### Current-state findings
**Defect A, production-reachable.** The legacy Supabase branch of `middleware.ts` logged and
**continued** when `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY` were missing,
serving `/admin`, `/author`, `/partner`, `/dashboard`, `/library`, `/reading` and `/api/files`
completely ungated. **Defect B.** The Better Auth branch made authorization decisions from
the unsigned, client-settable `mangu-role` cookie. **Defect C.** Only `/author/dashboard` and
`/author/submit` checked the author role — `/author/analytics`, `/author/projects` and
`/author/projects/[id]` checked authentication only.

### Changes made
Middleware fails closed: protected paths get **503** (`application/json` for `/api/*`,
`text/plain` otherwise, `Cache-Control: no-store`) while public marketing and catalog routes
still render, so an env misconfiguration does not black out the site. Middleware no longer
reads `mangu-role` at all — it only enforces "must be signed in"; every role decision is
server-side. New `lib/auth/require-role.ts` derives the role from `getRequestUser()`
(dual-run aware) and denies on a missing profile because `normalizeManguRole` defaults to
`reader`. New `app/(portals)/author/layout.tsx` closes Defect C; new
`app/(portals)/partner/layout.tsx` adds defence in depth.

### Files changed
`middleware.ts` · `lib/auth/require-role.ts` (new) · `app/(portals)/author/layout.tsx` (new) ·
`app/(portals)/partner/layout.tsx` (new) · `tests/unit/middleware-rbac.test.ts` (new)

### Validation executed
Per §0. Static checks clean across all 27 changed files in #352. The RBAC matrix unit cases —
anonymous / customer / author / partner / admin plus a forged `mangu-role=admin` cookie, on
both auth branches, plus the fail-closed 503 matrix and public-route passthrough — were
written and **not run**. The E2E coverage that asserts this same contract lives in PR #355
and was **also not run**. CI red at `npm test` (run #883).

### Acceptance criteria
Protected routes cannot be served ungated during env misconfiguration ⏳ unverified · forged
`mangu-role` grants nothing ⏳ unverified · `/author/analytics` and `/author/projects/*`
gated ⏳ unverified · public routes still render ⏳ unverified. **G5 remains FALSE.**

### Risks and follow-up
`lib/middleware/auth.ts::requireAdmin()` is Supabase-only; under `AUTH_PROVIDER=better-auth`
it will deny **all** admins. Fail-closed, so not a security defect, but `/admin` becomes
unusable post-cutover. Deliberately deferred to the cutover rather than done during the freeze.

### Rollback
Revert the PR. Partial rollback is safe file-by-file; `middleware.ts` is the single
highest-value file to keep.

### Human action required
**HA-E2** (manual fail-closed and forged-cookie QA in a preview) · **HA-B10** (create
disposable `TEST_*` role accounts so #355's RBAC matrix can actually run).

---

## Task 1.6 Evidence

Status: `READY_FOR_HUMAN_ACTION` | Branch: `task/ops-monitoring-and-launch-tooling` | Commit(s): `7ec644e` | PR: #353 | Environment tested: none against production — **deliberately**

### Current-state findings
**The production catalog is currently 100% seed data.** `/api/books` returns exactly three
books, all on the known seed slug list; both authors are known seed author ids; all five are
published in `sitemap.xml`. Task 1.6 is therefore not a tidy-up — **removing the seed records
empties the public catalog.**

### Changes made
A duplicate/seed audit reporting across **both** providers, with deterministic duplicate keys
(`slug`, ISBN, normalised `title+author`, known seed markers). Safety properties, all
unit-covered: dry run is the default; `--execute` **and** a matching `--confirm=<token>` are
both required; the token is derived from the exact candidate set so a stale token cannot
authorize a changed plan; seed matching is **exact only** (`the-launch-gate-ii`,
`testing-the-waters` and `Testa Authorson` correctly do **not** match); structurally invalid
ISBNs never become keys; groups never span providers or collections; every group keeps exactly
one survivor (oldest `created_at`, tiebreak lowest id); an author is never deleted while a
book still references it.

### Files changed
`scripts/lib/catalog-dupes.ts` (new) · `scripts/catalog-seed-audit.ts` (new) ·
`tests/unit/catalog-dupes.test.ts` (new) · `package.json` (alias `catalog:seed-audit`)

### Validation executed
Per §0. `tsc --strict` clean. 24 unit assertions executed outside jest within the
67-assertion run. **`catalog-seed-audit.ts` was NOT executed** — it needs live credentials;
its logic is covered by unit tests only. **This was never run against production.** Jest not
run. CI red at `npm test` (run #884).

### Acceptance criteria
Dry run is default ✅ in code · two independent execution gates ✅ in code · exact-match-only
seed detection ✅ unit-covered, unrun · **a dry run actually performed against production**
❌ · **a decision on what to do with the seed data** ❌.

### Risks and follow-up
The single largest risk in this task is running it. Do not execute before real catalog
content exists.

### Rollback
Revert the files and the alias. The write path was never reachable.

### Human action required
**HA-C8** — decide the seed/QA content removal order relative to real content arriving.
**HA-E7** — run `npm run catalog:seed-audit` (dry run) and read the report before any decision.

---

## Task 1.7 Evidence

Status: `READY_FOR_REVIEW` | Branch: `task/phase1-auth-security` (+ `task/phase1-catalog-data-path`) | Commit(s): `6f56089`, `00c6758` | PR: #352 + #356 | Environment tested: none — static checks only

### Current-state findings
`/reading/[bookId]` rendered fake reader chrome ("Reading interface coming soon") with dead
Previous/Next buttons and a progress bar writing **fabricated** reading-position rows every
30 seconds. The auth and entitlement checks around it were correct.

### Changes made
Auth and entitlement logic untouched; only the payload changed, to an honest page pointing at
the PDP and the library. Every remaining in-app link to the stub repointed: `LibraryCard`,
`ContinueReadingHero`, `ReadersHubTabs` ("Open in reader" removed). EPUB upload and retailer
buttons untouched.

### Files changed
`app/(consumer)/reading/[bookId]/page.tsx` · `.../ReadingUnavailable.tsx` (new) ·
`.../ReadingClient.tsx` (gutted to a re-export so no import dangles) ·
`components/library/LibraryCard.tsx` · `components/library/ContinueReadingHero.tsx` ·
`app/(consumer)/readers-hub/ReadersHubTabs.tsx`

### Validation executed
Per §0. Static checks clean. No unit or E2E coverage was added for this task specifically.
CI red at `npm test` (run #883).

### Acceptance criteria
No fabricated reading progress is written ⏳ unverified · no in-app link points at a dead
reader ⚠️ **incomplete** — the PDP "Start Reading" button at
`app/(consumer)/books/[slug]/page.tsx:172–174` was **not** removed by #352, which does not own
that file. #356 owns it. **Confirm the button is gone in the merged result before calling
1.7 done.**

### Risks and follow-up
`app/(consumer)/reading/[bookId]/actions.ts::saveReadingProgress` is now unreferenced dead
code — delete alongside `ReadingClient.tsx` in a cleanup PR. `readers-hub` empty-state copy
still says "while reading".

### Rollback
Revert the PR.

### Human action required
**HA-A6** — at merge, verify the PDP "Start Reading" block is gone. It is the one
cross-PR handoff in the programme that nobody's CI can catch.

---

## Task 1.8 Evidence

Status: `READY_FOR_REVIEW` | Branch: `task/phase1-auth-security` | Commit(s): `6f56089` | PR: #352 | Environment tested: none — static checks only

### Current-state findings
Login could render a literal `{}` to the user — Better Auth throws `APIError` objects whose
`message` is not always a string, and nothing coerced them. `LoginForm` could also throw on a
malformed `decodeURIComponent` of the `?error=` URL parameter.

### Changes made
New `lib/auth/error-messages.ts`. `normalizeAuthErrorMessage(input, fallback)` walks
`message` / `error_description` / `error` / `msg` / `detail` / `statusText` (depth-limited,
cycle-safe) and returns a collapsed ≤200-char string, rejecting `{}`, `[]`, `null`,
`undefined`, `[object Object]`, `NaN`, stack traces, URLs, file paths, JWTs,
`sk_`/`pk_`/`whsec_` keys and SQL fragments. `redactAuthDiagnostic(input)` produces a
server-only log line with emails, JWTs, API keys and `password=`/`token=`/`secret=` values
stripped, capped at 500 chars. Applied at every layer. **The rate-limit distinction from
#350 is preserved**: `reason === 'unavailable'` (503-style "temporarily unavailable" plus a
loud server log) stays distinct from `'limited'` ("too many attempts, try again in 15
minutes") and from the invalid-credential path.

### Files changed
`lib/auth/error-messages.ts` (new) · `app/(auth)/login/actions.ts` ·
`app/(auth)/login/LoginForm.tsx` · `app/(auth)/register/RegisterForm.tsx` ·
`app/(auth)/reset-password/actions.ts` · `app/(auth)/reset-password/confirm/page.tsx` ·
`lib/auth/better-auth-actions.ts` · `tests/unit/auth-error-messages.test.ts` (new)

### Validation executed
Per §0. Static checks clean. Unit cases covering object / string / unknown error shapes,
circular references, stack traces, JWTs, keys and SQL fragments were written and **not run**.
CI red at `npm test` (run #883).

### Acceptance criteria
No raw object reaches a browser ⏳ unverified · no secret-shaped string reaches a browser
⏳ unverified · rate-limit vs invalid-credential vs outage remain three distinct messages
⏳ unverified.

### Risks and follow-up
None specific beyond the shared unverified status.

### Rollback
Revert the PR.

### Human action required
**HA-E1** — a real signup, login-failure and password-reset pass on a preview. Only a human
can confirm the copy a user actually sees.

---

## Task 1.9 Evidence

Status: `READY_FOR_REVIEW` | Branch: `task/phase1-auth-security` | Commit(s): `6f56089` | PR: #352 | Environment tested: none — static checks only

### Current-state findings
Two password minimums existed (6 in `lib/utils/validation.ts` and the reset-confirm page, 8
in the Better Auth server config `lib/auth.ts`), so the UI accepted a password the auth
server then rejected. Both `register/actions.ts` and `reset-password/actions.ts` carried an
identical `resolveAuthOrigin()` copy that trusted `x-forwarded-host` **first**, so a forged
Host header could steer `emailRedirectTo` / `redirectTo` at a host MANGU does not own
(**host-header injection**). And `register/actions.ts` logged-and-continued on
profile-creation failure ("Don't fail registration if profile creation fails"), producing auth
users with no `profiles` row and therefore no role — silently losing every role-gated surface
(**A.6**).

### Changes made
**Chose 8**, in `lib/auth/password-policy.ts`: the stronger value, and the one the auth
server already enforces. Applied to register (form, server action, help text), reset-confirm
(validation, message, help text) and the shared `passwordSchema`. **Deliberate exception —
sign-in does not enforce it**, because applying a *creation* policy at sign-in would
permanently lock out any pre-existing 6–7 character credential (Supabase's own default
minimum is 6) and leaks policy state to an attacker; sign-in validates presence only. The one
E2E assertion testing the 6-character sign-in rule was rewritten to test the presence rule.
New `lib/auth/origin.ts` with precedence `NEXT_PUBLIC_SITE_URL` → `VERCEL_URL` → request Host
→ `http://localhost:3000`. **A.6**: profile-creation failure now returns an actionable error
(the auth user already exists, so the copy says the account was created but setup did not
finish and points at Contact), plus a redacted server log and `profileSetupFailed: true`.

### Files changed
`lib/auth/password-policy.ts` (new) · `lib/auth/origin.ts` (new) ·
`app/(auth)/register/actions.ts` · `app/(auth)/register/RegisterForm.tsx` ·
`app/(auth)/reset-password/actions.ts` · `app/(auth)/reset-password/confirm/page.tsx` ·
`app/(auth)/login/actions.ts` · `app/(auth)/login/LoginForm.tsx` ·
`lib/utils/validation.ts` · `tests/unit/auth-password-policy.test.ts` (new) ·
`tests/e2e/auth-flow.spec.ts`

### Validation executed
Per §0. Static checks clean. Unit cases for the single minimum, the sign-in exception, origin
precedence and A.6 were written and **not run**. The modified E2E assertion was **not run**.
CI red at `npm test` (run #883).

### Acceptance criteria
One password minimum in the codebase ⏳ unverified · existing 6-character accounts can still
sign in ⏳ unverified · verification and reset links cannot be steered by a forged Host header
⏳ unverified · registration no longer silently produces role-less users ⏳ unverified.

### Risks and follow-up
The sign-in exception is a deliberate deviation from "apply everywhere" and needs sign-off.
A.6 feeds Task 3.1, which no PR in this programme carries.

### Rollback
Revert the PR.

### Human action required
**HA-C9** — sign off the sign-in presence-only rule, or accept the lockout risk of raising
it to 8. **HA-E3** — verify on a preview that the email verification link points at
`NEXT_PUBLIC_SITE_URL`, not the preview host.

---

## Task 2.0 Evidence

Status: `READY_FOR_REVIEW` | Branch: `task/architecture-and-governance-docs` | Commit(s): `5080fad` | PR: #351 (+#356 code) | Environment tested: n/a — documentation

### Current-state findings
Four conflicting `BookStatus` type definitions. Mongo permits only `draft|published|archived`
while the Supabase CHECK permits six values. "Ready for review" is therefore **not a
supported book state**, despite appearing in a type. `updateBookStatusAction` accepted only
`draft|published` while the edit form offered `archived`.

### Changes made
`docs/BOOK_LIFECYCLE.md`: states subject to repository reality, a 9-row state-transition
table with authorization and validation per transition, rules R1–R8 marked ENFORCED vs
TARGET, the deletion policy (hard delete cascades to `order_items`), and §2 recording the
`updateBookStatusAction` / edit-form `archived` inconsistency in detail. The code fix for
that inconsistency landed in #356.

### Files changed
`docs/BOOK_LIFECYCLE.md`

### Validation executed
Per §0. Documentation; no test surface. CI red at `npm test` (run #885) for the inherited
reason only.

### Acceptance criteria
Every reachable state documented ✅ · every transition has an authorization rule ✅ ·
inconsistencies recorded rather than papered over ✅ · **the four conflicting type definitions
reconciled in code** ❌ — not in scope of this PR.

### Risks and follow-up
The document is accurate about a codebase that #356 then changes. Re-read §2 after #356
merges.

### Rollback
Delete the file.

### Human action required
None directly. Feeds **HA-A2** (merge order).

---

## Task 2.0b Evidence

Status: `READY_FOR_REVIEW` | Branch: `task/phase1-catalog-data-path` | Commit(s): `00c6758`, incl. `4842a41`, `1c5dc91` | PR: #356 | Environment tested: none — static checks and `node` against a fake `Db`

### Current-state findings
**Audio and retailer data were inexpressible under MongoDB primary.** `fetchBookForApi`'s
Mongo branch hardcoded `audio_url: null` and `trailer_vimeo_id: null` and omitted all six
retailer URL fields; `listAudiobooks()` returned `[]`; `fetchAudiobookById()` returned `null`;
the list mappers dropped `content_type` and retailer fields; `listFeaturedBooks()` had no
`is_featured` equivalent. Consequence: **the retailer buttons shipped in #350 and the PDP
Audio Sample tab could not render in production, and `/audio` was permanently empty.**

### Changes made
`types/mongo.ts` `Book` extended with the six retailer URLs, `audio_url`, `audio_toc`,
`audio_narrator`, `audio_duration_seconds`, `epub_url`, `trailer_vimeo_id`, `isbn`,
`is_featured`, `featured_at`, `page_count`, `word_count`. **No `subtitle`** — see Task 1.2.
`fetchBookForApi` projects the full contract; `mapBookWithAuthor` / `mapMongoBookCard` carry
`content_type` and retailer fields; `listFeaturedBooks` prefers `is_featured` sorted by
`featured_at` and tops up from the rating sort so the rail is never short;
`listAudiobooks`/`fetchAudiobookById` are real implementations. **Audio TOC representation:**
the flat Mongo document is viewed as a Supabase `book_content` row, so
`components/audio/parse-chapters.ts`, `pickNarrator` and `pickDurationSec` are reused
unchanged. **No audio player component contract was modified and no full-length-audiobook
entitlement logic was added.** The published+public gate from #350 is applied on both new
Mongo audio branches.

### Files changed
`types/mongo.ts` · `lib/data/books.ts` · `lib/books/fields.ts` ·
`tests/unit/mongo-catalog-field-parity.test.ts` (new)

### Validation executed
Per §0. Static checks clean; Mongo helpers exercised against a fake `Db`. The parity unit
cases, including a **draft-book negative case on both the id and slug paths**, were written
and **not run**. CI red at `npm test` (run #882), build skipped.

### Acceptance criteria
Retailer buttons can render under the production provider ⏳ unverified · PDP Audio Sample
tab can render ⏳ unverified · `/audio` is not permanently empty ⏳ unverified · draft books
stay invisible on both providers and both lookup paths ⏳ unverified.

### Risks and follow-up
No audio storage bucket is provisioned, so the audio field accepts a hosted https URL rather
than a direct upload. No `books.currency` column exists — currency is fixed at USD in the UI.

### Rollback
Revert the PR. Existing Mongo documents read back `null` for absent fields either way.

### Human action required
**HA-C3** — decide where audio samples are hosted and who owns that hosting.

---

## Task 2.1 Evidence

Status: `READY_FOR_REVIEW` | Branch: `task/phase1-catalog-data-path` | Commit(s): `00c6758`, incl. `1667e9a`, `f2ffa8d`, `e2c4f83` | PR: #356 | Environment tested: none

### Current-state findings
`BookUploadForm` existed but was **mounted on no page**. Neither admin form exposed even a
text field for `cover_url`/`epub_url`. The admin actions silently dropped form fields, and
the form posted a publication date nothing accepted.

### Changes made
`app/admin/books/_lib/BookForm.tsx` — a single form serving both create and edit.
`StatusToggleForm.tsx` adds explicit unpublish confirmation. Three follow-up commits on the
branch fixed the silent field drop (`1667e9a`) and the unaccepted publication date
(`f2ffa8d`), and pinned the form-payload / action-input seam with a test (`e2c4f83`).

### Files changed
`app/admin/books/_lib/BookForm.tsx` (new) · `app/admin/books/_lib/StatusToggleForm.tsx` (new) ·
`app/admin/books/new/page.tsx` · `app/admin/books/[id]/edit/page.tsx`

### Validation executed
Per §0. Static checks clean. Unit cases pinning the form/action seam were written and **not
run**. CI red at `npm test` (run #882), build skipped. **Note:** PRs #358 and #360 both base
on `a43cea0`, which predates all three of these fixes — they are reviewing a version of this
form that no longer exists.

### Acceptance criteria
One form, two modes ⏳ unverified · every field round-trips on edit ⏳ unverified · no field
is silently dropped ⏳ unverified.

### Risks and follow-up
See **HA-A3** — #358 and #360 must be updated from #356 before review.

### Rollback
Revert the PR.

### Human action required
**HA-E6** — manual QA: create a draft, edit it, confirm every field round-trips.

---

## Task 2.2 Evidence

Status: `READY_FOR_REVIEW` | Branch: `task/phase1-catalog-data-path` | Commit(s): `00c6758` | PR: #356 | Environment tested: none

### Current-state findings
Upload plumbing existed but was unreachable from any mounted form. There was no writer for
the `book_content` table anywhere in the repository.

### Changes made
The dead, unmounted `components/books/BookUploadForm.tsx` became `BookAssetFields` — the
cover/EPUB/audio panel both admin forms render. Existing upload plumbing is reused; no new
uploader, no new dependencies. `lib/data/book-assets.ts` is the **first `book_content` writer
in the repo**: Mongo → the book document; Supabase → `books.cover_url` plus `book_content`
via select-then-insert/update, because `book_content.book_id` has no unique constraint and
`upsert(onConflict)` would fail.

### Files changed
`components/books/BookUploadForm.tsx` → `BookAssetFields` · `lib/data/book-assets.ts` (new)

### Validation executed
Per §0. Static checks clean. No executed coverage. CI red at `npm test` (run #882).

### Acceptance criteria
Admin can attach a cover and an EPUB through the UI ⏳ unverified · assets persist on both
providers ⏳ unverified.

### Risks and follow-up
Server-side cover **dimension** enforcement still needs
`app/api/upload/book-assets/route.ts` to call `validateCoverDimensions`; MIME and size are
already enforced there. No audio bucket exists, so audio is a hosted URL only.

### Rollback
Revert the PR.

### Human action required
**HA-C2** — decide `published-epubs` bucket exposure (currently `public = true`).
**HA-C3** — audio hosting.

---

## Task 2.3 Evidence

Status: `READY_FOR_REVIEW` | Branch: `task/phase1-catalog-data-path` | Commit(s): `00c6758` | PR: #356 | Environment tested: none

### Current-state findings
No publish gate existed. Client and server validation could drift because there was no shared
rule set.

### Changes made
`app/admin/books/_lib/book-validation.ts` — **one** rule set, imported by the form and
re-enforced server-side in `setBookAssets`, so client and server cannot drift. **Publish
blockers:** title, author, cover, description, genre, price, valid slug, no broken (non-https)
asset reference. **Warnings only:** no retailer URL, no audio sample, no trailer, no ISBN.
Money is handled as integer cents — no floating-point money math.

### Files changed
`app/admin/books/_lib/book-validation.ts` (new) ·
`tests/unit/admin-publish-validation.test.ts` (new)

### Validation executed
Per §0. Static checks clean. The validation unit cases were written and **not run**.
**Independent corroboration:** PR #358's rule engine imports `validateAdminBook` **unchanged**
and executed **101 assertions** against it under `node`, all passing — that exercises this
rule set more than any test in #356 did. #358 also includes a test comparing its
admin-sourced messages against `validateAdminBook` directly, so a private copy of a rule would
fail loudly. CI red at `npm test` (run #882).

### Acceptance criteria
Client and server enforce the same rules ⏳ unverified in situ, ✅ corroborated by #358's
101 executed assertions against the same module · publish is blocked on missing required
fields ⏳ unverified · warnings never block ✅ corroborated by #358.

### Risks and follow-up
`isValidIsbn` is a **shape** check, not a check-digit check — the admin UI accepts a
transposed digit. #358 deliberately runs stricter at intake so nothing that passes intake can
fail the admin UI.

### Rollback
Revert the PR.

### Human action required
**HA-E6** — attempt to publish with a required field missing and confirm a field-level error
with no data loss.

---

## Task 2.4 Evidence

Status: `READY_FOR_REVIEW` | Branch: `task/phase1-catalog-data-path` | Commit(s): `00c6758`, incl. `c18a802` | PR: #356 | Environment tested: none

### Current-state findings
`updateBookStatusAction` accepted only `draft|published` while the edit form offered
`archived` — selecting archive **silently no-op'd**. Unpublish nulled `published_at`.

### Changes made
Status domain aligned to `ADMIN_BOOK_STATUSES`. Explicit unpublish confirmation in
`StatusToggleForm`. `published_at` stamped on first publish and never nulled on either
provider. `featured_at` stamped with `is_featured` on the Mongo write path (`4842a41`), pinned
by a test (`c18a802`).

### Files changed
`app/admin/actions.ts` · `app/admin/books/_lib/StatusToggleForm.tsx` · `lib/mongo-books.ts`

### Validation executed
Per §0. Static checks clean; Mongo write helpers exercised against a fake `Db`. The
`featured_at` pin and the round-trip test were written and **not run**. CI red at `npm test`
(run #882).

### Acceptance criteria
Archive works rather than silently no-op'ing ⏳ unverified · `published_at` survives
unpublish and republish does not restamp it ⏳ unverified · unpublish requires explicit
confirmation ⏳ unverified.

### Risks and follow-up
The `published_at` behaviour is the one change in #356 that is **irreversible if wrong** — the
previous code destroyed the date, so any row already unpublished has already lost it.

### Rollback
Revert the PR. Dates already lost are not recoverable by any rollback.

### Human action required
**HA-E6** — unpublish and republish a book, confirm the original date is not restamped.

---

## Task 2.6 Evidence

Status: `READY_FOR_REVIEW` | Branch: `task/architecture-and-governance-docs` | Commit(s): `5080fad` | PR: #351 | Environment tested: n/a — documentation

### Current-state findings
No runbook existed for publishing a book through the admin UI.

### Changes made
`docs/BOOK_PUBLISHING_RUNBOOK.md`: asset prep, cover specs (JPG/PNG, 2:3, ≥1600×2400, ≤2 MB),
audio sample specs (MP3/M4A, 2–5 min), EPUB handling, metadata definitions with examples,
retailer-link requirements (https only, destination verified), admin steps, a 13-row
troubleshooting table keyed to real error codes, preview/publish/post-publish checklists,
update/unpublish/rollback/emergency-correction procedures, and a per-book signoff template.

### Files changed
`docs/BOOK_PUBLISHING_RUNBOOK.md`

### Validation executed
Per §0. Documentation; no test surface. **One discrepancy this recorder found:** the runbook
states cover ≤2 MB, while PR #358 cites the `book-covers` bucket
`file_size_limit = 5242880` (5 MB) from `supabase/migrations/20260117000006_storage_policies.sql`
and `COVER_RULES` in `book-validation.ts`. **Reconcile before use** — the runbook may be
stricter than the system on purpose, but it is not stated as such.

### Acceptance criteria
An operator can publish a book end to end from this document ⏳ untested — nobody has followed
it · cover size figure agrees with the enforced limit ❌ discrepancy above.

### Risks and follow-up
The runbook describes a pipeline that only exists once #356 merges.

### Rollback
Delete the file.

### Human action required
**HA-D5** — reconcile the 2 MB vs 5 MB cover limit before the runbook is used for a real book.

---

## Task 3.4 Evidence

Status: `READY_FOR_HUMAN_ACTION` | Branch: `task/qa-automation-and-crawl-regression` | Commit(s): `3733af8` | PR: #355 | Environment tested: none — **Playwright never executed**

### Current-state findings
No RBAC coverage existed that hit surfaces directly rather than checking client-side hiding.

### Changes made
`tests/e2e/rbac-matrix.spec.ts` asserts the **hardened** contract from #352 across role ×
surface: `/admin/*`, `/author/*`, `/partner/*`, `/library`, `/dashboard/*`,
`GET /partner/orders/export`, `POST /api/books`, `GET /api/files/<id>`, `GET /api/session`,
raw POSTs to server-action routes, forged `mangu-role` cookies, and the bare
`/dashboard` `/author` `/partner` roots. Every denial also asserts **no data leak** — the
response body must not contain `order_number`, `total_amount`, `stripe_customer_id`,
`manuscript_url`, `service_role`, `SUPABASE_SERVICE_ROLE_KEY` or `"role":"admin"`. Server-action
tests additionally assert the *effect* did not happen: the caller's role via `/api/session` is
unchanged after an escalation attempt. Credentials come from `TEST_*_EMAIL` / `_PASSWORD` with
**no defaults** — a spec that falls back to a well-known password teaches people to create
that account in production.

### Files changed
`tests/e2e/rbac-matrix.spec.ts` (new)

### Validation executed
Per §0. `tsc --noEmit --strict --noResolve` clean. **Playwright was not run.** The
credentialed blocks `test.skip()` without `TEST_*` secrets; the anonymous and forged-cookie
blocks need no credentials and would run everywhere — but `ci.yml` has **no Playwright job**,
so nothing runs them in CI either. CI red at `npm test` (run #887).

### Acceptance criteria
Matrix covers every role × every protected surface ✅ written · **matrix has been executed
once** ❌ · **G5 evidenced** ❌.

### Risks and follow-up
Two findings the spec **encodes as current behaviour** and which need a decision, not a fix:
`/dashboard`, `/author` and `/partner` have no index page, so a correctly-authorised user who
passes the gate lands on a 404; and `/partner/orders/export` refuses **admins** (the handler
requires `role === 'partner'` exactly) while admins are allowed into every partner portal
*page*.

### Rollback
Delete the spec file.

### Human action required
**HA-B10** (create disposable `TEST_*` role accounts as repo/CI secrets) · **HA-B11** (decide
where these run — RBAC on preview E2E) · **HA-C10** (`/dashboard` `/author` `/partner`:
index page or redirect) · **HA-C11** (should admins be allowed the partner CSV export).

---

## Task 3.5 Evidence

Status: `READY_FOR_HUMAN_ACTION` | Branch: `task/qa-automation-and-crawl-regression` | Commit(s): `3733af8` | PR: #355 | Environment tested: none — **Playwright never executed**

### Current-state findings
No coverage existed for whether rate-limit responses are *truthful* — only whether they block.

### Changes made
`tests/e2e/rate-limit-abuse.spec.ts`. Scenarios: N invalid attempts · attempt during cooldown
· recovery after cooldown · limiter backend unavailable · the IP dimension of the `auth`
bucket · `/api/auth/*` parity · friendly-429 navigation. The property under test is
truthfulness: a 429 must carry `Retry-After` and must **not** claim an outage; a 503 must
**not** claim "too many requests"; neither may leak the probe identity, the limiter backend
(`upstash.io`, `UPSTASH_*`, `redis://`), `x-forwarded-for` or a stack; once throttled,
throttling must not flip back to allowed inside the window; `GET /login` must stay 200 while
POSTs are throttled; after cooldown the user **recovers** — no permanent lockout. Probes use
`.invalid` addresses and a randomised wrong password, never a real account.

### Files changed
`tests/e2e/rate-limit-abuse.spec.ts` (new)

### Validation executed
Per §0. `tsc` clean. **Playwright was not run.** The file is opt-in behind
`E2E_RATE_LIMIT_TESTS=true` by design — it exhausts a shared per-IP bucket and would make the
auth and RBAC specs fail if run alongside them. The limiter-outage block skips unless
`E2E_LIMITER_UNAVAILABLE_BASE_URL` names a genuinely broken target, because faking an outage
would prove nothing. CI red at `npm test` (run #887).

### Acceptance criteria
Every scenario written ✅ · **executed once** ❌ · limiter-outage path covered ❌ (no target
exists).

### Risks and follow-up
The asserted limits (5 / 60s) mirror `BUCKETS.auth` in `lib/rate-limit.ts` and are commented
as such — the spec exists to catch drift, not to silently follow it.

### Rollback
Delete the spec file.

### Human action required
**HA-B11** (these must **not** run on PR CI — schedule them against a dedicated target) ·
**HA-B12** (decide whether to stand up a deliberately-broken-limiter instance).

---

## Task 3.6 Evidence

Status: `BLOCKED_EXTERNAL` | Branch: `task/3.6-migration-drift-and-backfill` | Commit(s): `69ed6f4` | PR: #359 | Environment tested: none — **no database was contacted**

### Current-state findings
The repo has **40 migration files**. What the hosted production database contains is
**unknown** — the Supabase project was paused/deleted and later restored, and nobody has
exported the hosted migration history since. Meanwhile application code reads columns, tables
and RPCs that no migration creates. **Repository-verified:** the 13 drifted `books` columns,
tables `book_view_cache` / `book_views`, RPCs `books_search` / `increment_view_count`, and
`audit_logs` with RLS on, a SELECT policy and **no INSERT policy**. **Hosted — UNVERIFIED:**
everything. One investigator saw the configured project ref return `401 "No API key found"`
(so a project exists), contradicting an earlier NXDOMAIN observation. Neither observation says
what is *inside* the database. **Nobody on this task has, or sought, credentials.**

### Changes made
Machinery to *understand* the drift, deliberately stopping there. **Not one file under
`supabase/migrations/` is created, edited or deleted** — verified across all eleven PRs. Six
drift classes: `applied-and-in-repo`, `applied-missing-from-repo`, `in-repo-not-applied`,
`manually-altered`, `obsolete`, `intentional-environment-difference`. Two design decisions
worth review: **absent evidence yields `null`, not a guess** — an unexported section is
reported as an explicit evidence gap and must never read as "clean"; and **the
intentional-difference allow-list ships empty** — no agent may declare a difference
intentional. The backfill dry run matches by slug → ISBN → normalised title+author and reports
Supabase-only / Mongo-only / identical / **conflicting** with a field-by-field diff. It **has
no execute mode**; `--execute` / `--apply` / `--write` / `--force` are a hard error.
Comparison runs at full fidelity and prints at redacted fidelity, so signed-URL noise cannot
fake a conflict.

### Files changed
`scripts/sql/export-migration-history.sql` (new) · `scripts/migration-drift-report.ts` (new) ·
`docs/operations/MIGRATION_DRIFT_RECONCILIATION.md` (new) ·
`scripts/backfill-books-dry-run.ts` (new) · `docs/launch/BACKFILL_PLAN.md` (new) ·
`tests/unit/migration-drift.test.ts` (new)

### Validation executed
Per §0. `tsc --strict` clean on the classifier with `@types/node`; all three TS files pass a
pure-syntax check. **Jest was not run.** To compensate the agent compiled the classifier and
executed **all 27 assertions from the test file directly: 27/27 pass**, including
empty-history, `applied-missing-from-repo`, `in-repo-not-applied`, all six object classes, and
the real 40-file repo inventory (unique and strictly ascending). No secret, project ref or
connection string in any file. Only existing env var names used. CI red at `npm test`
(run #890).

### Acceptance criteria
Drift can be classified from an operator export ✅ (classifier executed) · absent evidence is
never reported as clean ✅ · **the hosted export has been run** ❌ · **PLAN A vs PLAN B
determined** ❌ · **the drift is actually reconciled** ❌.

### Risks and follow-up
**The highest risk identified is mistaking PLAN B for PLAN A.** Replaying 40 migrations
against a live schema whose history table happens to be empty will try to recreate live
objects, fail partway and leave a half-applied database. **Never resolve an empty history with
`supabase db push`.** Stop condition: if both stores hold non-identical live book rows, that
needs the owner's approval and a verified backup before any reconciliation.

### Rollback
Delete the files. Nothing runs.

### Human action required
This task is **entirely** human-gated. **HA-B1** (run the hosted export or delegate SQL
access) · **HA-B2** (confirm whether the restore produced a new project — the PLAN A/B branch)
· **HA-B3** (confirm a verified, restore-tested backup) · **HA-C4** (add the 13 drifted columns
**or** retire the Supabase read path — production reads from MongoDB, so adding thirteen
columns to a database the read path no longer uses may be the wrong fix) · **HA-C5** (approve
a backfill option and decide every conflicting row) · **HA-C12** (approve
`increment_view_count` as `SECURITY DEFINER`) · **HA-A7** (approve any corrective migration
before it is written) · **HA-B13** (escalate immediately if the export shows
`published-epubs` or `manuscripts` as `public = true`).

---

## Task 3.7 Evidence

Status: `READY_FOR_HUMAN_ACTION` | Branch: `task/qa-automation-and-crawl-regression` | Commit(s): `3733af8` | PR: #355 | Environment tested: n/a — documentation

### Current-state findings
`docs/OPERATOR_QA_LOG.md` is **not blank** — it is extensive. It is the *manual QA table at
lines 396–405* whose rows 1–10 are blank (issue #193). Those rows had three columns
(`Pass` / `Date` / `Notes`) and nowhere to record what was done, on which build, by whom, or
with what evidence. **That is why #193 has stayed open — the table was unfillable, not just
unfilled.**

### Changes made
Each row now has explicit slots for **test ID · RC SHA · environment · tester · date/time
(UTC) · preconditions · steps · expected · actual · PASS/FAIL · evidence link · defect link**,
behind a header stating that all ten rows must cite **one immutable release-candidate SHA**
(if the RC changes the block is void and all ten re-run), that **human evidence is required
(CCR-014)** and CI cannot sign off any row, and that a blank `Actual` next to a `PASS` is not
evidence. MQ-10 replaces the old row 10 ("New static homepage loads at `/` — after Cloud Run
redeploy with `ff23d55`") with a library-entitlement check, because ADR-001 accepted Vercel
and retired Cloud Run, so that row's precondition can never be met. The supersession is
written into the block rather than done silently; no result was ever recorded in the original
table, so no evidence was overwritten (CCR-002).

### Files changed
`docs/OPERATOR_QA_LOG.md` (manual QA block restructured; the contents API can only write a
whole file, so the diff shows all 438 lines — historical wording is byte-identical, including
the existing mojibake, which was deliberately **not** "fixed". Verify with
`git diff -w audit/2026-07-28-fixes -- docs/OPERATOR_QA_LOG.md`.)

### Validation executed
Per §0. Documentation. **Every result cell is left blank.** CI red at `npm test` (run #887).

### Acceptance criteria
Rows 1–10 are fillable ✅ · **rows 1–10 are filled** ❌ · **G10 TRUE** ❌.

### Risks and follow-up
Ten blank rows keep G10 FALSE, and G10 is one of the eleven FALSE gates. Nothing an agent can
do moves it.

### Rollback
Revert the file.

### Human action required
**HA-E5** — fill the manual QA block: an RC SHA, an environment, a tester and ten sets of
evidence. This is the single largest human deliverable in the programme.

---

## Task 4.1 Evidence

Status: `READY_FOR_HUMAN_ACTION` | Branch: `task/architecture-and-governance-docs` | Commit(s): `5080fad` | PR: #351 | Environment tested: n/a

### Current-state findings
No launch catalog existed. Production holds three seeded QA books.

### Changes made
`docs/launch/LAUNCH_CATALOG.md` — an empty-but-complete candidate table (title, author,
publication status, rights, cover, description, genre, price, ISBN, retailer links, EPUB,
audio sample, inclusion decision, blocking issue) with column definitions, the **exactly 3–6
launch-approved** count check, a QA/seed removal table and sign-off.

### Files changed
`docs/launch/LAUNCH_CATALOG.md`

### Validation executed
Per §0. Documentation; template is empty by design. CI red at `npm test` (run #885).

### Acceptance criteria
Template complete ✅ · **3–6 real launch titles identified** ❌ · **rights confirmed for each**
❌ · **inclusion decisions signed** ❌.

### Risks and follow-up
This is the gating content dependency for the whole launch. Nothing downstream — 4.2 intake,
5.5 communications, the crawl harness's launch-book checks — has anything real to operate on
until it is filled.

### Rollback
Delete the file.

### Human action required
**HA-D1** — name the 3–6 launch titles and their authors, confirm rights, and sign the
inclusion decisions.

---

## Task 4.2 Evidence

Status: `READY_FOR_REVIEW` | Branch: `task/4.2-content-intake-pipeline` | Commit(s): `72bead2` | PR: #358 | Environment tested: local `node` (CLI run end to end)

### Current-state findings
No definitive per-book handover spec existed, so nothing told a contributor what a complete
book kit contains, and nothing could tell them offline whether a kit would pass the admin
publish gate.

### Changes made
A spec, a copyable template and an offline validator that runs the **same rule set as the
admin publish gate**, so a kit that passes offline cannot be refused later.
`scripts/lib/asset-kit.ts` maps a kit onto `AdminBookFormValues` and calls
**`validateAdminBook` unchanged** — it does not re-implement a single admin rule. Every emitted
issue is tagged `source: 'admin-validation' | 'intake'`, so the reuse is auditable in `--json`
output, and a test compares admin-sourced messages against `validateAdminBook` directly. Five
rules are added on top, each justified: ISBN **check digit** (mod-11 / EAN-13) as a blocker —
the one deliberate place intake is stricter than the admin UI, because `isValidIsbn` is a
*shape* check and the admin UI accepts a transposed digit; batch slug and ISBN uniqueness,
because `books.slug`/`books.isbn` are UNIQUE and the admin UI only finds out when the insert
fails; on-disk asset facts (existence, header-sniffed MIME, PNG/JPEG geometry, ZIP/OCF magic);
a rights and approval record; and length caps cited to `types/books.ts`.
**35 blockers, 16 warnings.** Every asset constraint is cited to the migration, rule constant
or type it came from.

### Files changed
`docs/launch/ASSET_KIT_SPEC.md` (new) · `docs/launch/asset-kit-template/book.json` (new) ·
`docs/launch/asset-kit-template/README.md` (new) · `scripts/lib/asset-kit.ts` (new) ·
`scripts/validate-asset-kit.ts` (new) · `tests/unit/asset-kit.test.ts` (new)

### Validation executed
Per §0. Full `tsc` with real path resolution, `@types/node` and a jest ambient shim: **clean,
exit 0**. The rule engine was compiled and executed against **101 assertions mirroring the
test file: 101 passed, 0 failed**, including the `0.1 + 0.2` integer-cent trap. The CLI was
run end to end: a complete kit exits 0; the template folder (no binaries) exits 1 with the
missing-cover blocker; a two-kit batch exits 1 with slug and ISBN collisions naming both kits;
`--json` emits the batch result; an audio file in the kit blocks with the missing-bucket
explanation. **Jest not run.** CI red at `npm test` (run #889). **Base is seven commits behind
#356** — see Risks.

### Acceptance criteria
Intake cannot pass something the admin UI would refuse ✅ (101 executed assertions against the
shared module) · rules are cited, not invented ✅ · **run against a real asset kit** ❌ — none
exists.

### Risks and follow-up
**Base staleness**: `72bead2` forks `task/phase1-catalog-data-path` at `a43cea0`, seven
commits behind `00c6758`, missing three substantive fixes to the very form and validation
module this work reuses. **Update before review.** The template ships **without**
`cover.jpg` / `book.epub` — binary blobs cannot be pushed through the file API, and the README
says a fresh run is expected to report them.

### Rollback
Delete the files. Nothing imports them at runtime.

### Human action required
**HA-A3** (update #358 from #356) · **HA-C3** (audio hosting — no bucket exists) ·
**HA-C13** (`books.short_description`: add the column or drop the field) · **HA-C14** (cover
alt-text column: covers currently render a hardcoded `Cover of <title>`) · **HA-C15**
(`seo_title`/`seo_description` persist nowhere — add columns or accept derived metadata) ·
**HA-D6** (retailer link destinations stay a human attestation; nothing can machine-verify
them without networked CI).

---

## Task 4.5 Evidence

Status: `READY_FOR_HUMAN_ACTION` | Branch: `task/5.1-5.5-launch-readiness` | Commit(s): `4b4b058` | PR: #357 | Environment tested: n/a

### Current-state findings
Three findings that **contradict the brief the agent was given**, all verified at `8e6fa50`
and worth recording:

1. **The author spotlight does NOT currently degrade to nothing.**
   `components/home/AuthorSpotlight.tsx` renders a full "Author Spotlight" section with
   *"Our authors will be featured here soon. Stay tuned!"* when the list is empty — including
   when `listFeaturedAuthors` **throws**, since the error is caught and flattened to `[]`, so
   an outage is presented as a content state. Per card it also substitutes the fabricated bio
   *"An amazing author contributing to our platform."* under a real person's name. The
   degrade-to-nothing behaviour **arrives with PR #354**; it does not exist on this base.
2. **The spotlight cannot render a headshot at all.** `FeaturedAuthor` in
   `lib/data/authors.ts` has no `photo_url` field (only `DirectoryAuthor` and `AuthorDetail`
   do); the card renders an initial letter. Independent of #354.
3. **There is no author links field anywhere in the model.** "Approved links only" is
   currently satisfiable only by having no links. Adding one is a schema change and is blocked
   until Task 3.6.

### Changes made
`docs/launch/AUTHOR_PROFILE_SPEC.md`: ten requirements for a complete public author profile
(name, approved headshot, alt text, real biography, associated published books, approved links
only, no placeholder content, cross-surface consistency, accurate `is_verified`, no PII), six
homepage spotlight requirements, and the acceptance rule — **every public launch author has a
complete profile and the homepage is free of QA content.** Findings 2 and 3 were flagged as
decisions rather than fixed, because `lib/` and `components/` are owned by other PRs.

### Files changed
`docs/launch/AUTHOR_PROFILE_SPEC.md`

### Validation executed
Per §0. Documentation. CI red at `npm test` (run #888).

### Acceptance criteria
Spec written ✅ · **any real author profile meets it** ❌ — no real authors exist ·
**headshot decision made** ❌ · **links decision made** ❌.

### Risks and follow-up
Finding 1 means that until #354 merges, an outage in `listFeaturedAuthors` looks like a
content state on the homepage. That is a truthfulness defect with a live blast radius.

### Rollback
Delete the file.

### Human action required
**HA-C16** — headshots in the spotlight: required at launch, or accept the initials fallback?
**HA-C17** — author links: launch with none, or wait for a post-3.6 schema change?

---

## Task 4.6 Evidence

Status: `READY_FOR_HUMAN_ACTION` | Branch: `task/4.6-marketing-truthfulness` | Commit(s): `6d99621` | PR: #354 | Environment tested: none

### Current-state findings
Public pages claimed functionality that does not exist at launch: on-site reading, mobile
apps, cookie consent controls, a blog, a press kit, and streaming. The homepage hero said
*"Stream unlimited books, audiobooks, and exclusive videos"* — false on three counts. The
footer carried App Store and Google Play badges linking to generic store homepages, a `<button>`
language selector with no handler, and a PayPal badge while Stripe checkout is
`payment_method_types: ['card']`. `/faqs` promised "start reading right away", cross-device
reading progress and an unbacked 14-day refund window. `/contact` promised a reply "within two
business days", unmeasured.

### Changes made
Rewrote `/about`, `/contact`, `/faqs`, `/help` and the homepage hero and metadata (including
root `SITE_DESCRIPTION`, keywords, JSON-LD and the web manifest). Minimally published
`/press`, `/cookies`, `/privacy`, `/discover/book-clubs`. `/blog` now `notFound()`s and its
footer link is removed (the sitemap already excluded it). `AuthorSpotlight` now requires at
least one published book, never invents a bio, and renders nothing when empty;
`FeaturedBooksSection` and `TrendingBooksSection` disappear rather than showing "check back
soon". Both newsletter surfaces render nothing when `RESEND_API_KEY` is unset instead of
promising a future newsletter. **The "0 Books / 0 Authors" stat band and the genre tile counts
were confirmed non-bugs and left untouched.**

### Files changed
20 files across `app/(consumer)/**`, `app/layout.tsx`, `components/home/**`,
`components/shared/Footer.tsx`, the newsletter surfaces, plus
`tests/unit/form-honesty.test.tsx`

### Validation executed
Per §0 — and **this PR's body records no verification section at all.** No static check
result, no executed assertions, no live probe is claimed. `tests/unit/form-honesty.test.tsx`
was updated and `tests/unit/book-clubs-honesty.test.ts` is said to still pass unchanged —
**UNCONFIRMED; neither was run.** CI red at `npm test` (run #886), build skipped. **This is
the weakest evidence position in the programme and the widest user-visible blast radius —
20 files, +514/−419, across nine public pages, the homepage, the footer and the root
metadata.**

### Acceptance criteria
No public page claims functionality that does not ship ⏳ unverified · nothing dangles
✅ claimed (`/blog` is the only route removed from navigation and the sitemap already excluded
it) — **UNCONFIRMED** · **all copy signed off by Renee** ❌ — required by the PR itself before
merge.

### Risks and follow-up
Six `TODO(renee):` placeholders remain in source: an optional "who we are" paragraph in
`/about`; whether to commit to a stated reply time in `/contact`; a written refund policy for
the Terms page; real brand assets and a press address; a re-check of `/cookies` if analytics
are ever added; and confirmation that `@mangupublishers` in `app/layout.tsx` is an account
MANGU controls.

### Rollback
Revert the PR. Restores the previous copy exactly.

### Human action required
**HA-D2** (sign off every line of copy — blocks merge) · **HA-D3** (resolve the six
`TODO(renee):` placeholders) · **HA-B14** (confirm which social accounts MANGU controls; #354
could not confirm `@mangupublishers`) · **HA-D4** (write a refund policy for the Terms page).

---

## Task 5.1 Evidence

Status: `READY_FOR_HUMAN_ACTION` | Branch: `task/architecture-and-governance-docs` + `task/5.1-5.5-launch-readiness` | Commit(s): `5080fad`, `4b4b058` | PR: #351 (template) + #357 (compiler) | Environment tested: local `node`, against the real template

### Current-state findings
No structured place existed to record gate evidence, and no check existed for the failure
mode that matters — a gate marked **PASSED with an empty evidence cell**, which reads as a
pass to anyone skimming a 13-row table.

### Changes made
**#351:** `docs/launch/LAUNCH_GATE_EVIDENCE.md`, with gate names, Requirement and Pass logic
**transcribed verbatim from `docs/NEXT_GO.md` §6 lines 159–171**, with provenance cited. Maps
G1–G13 and every issue #209 requirement to status / evidence link / commit SHA / environment /
approver / open exception. **#357:** `scripts/compile-gate-evidence.ts`, which reads that
document and reports gate by gate which carry evidence. A gate marked PASSED **without** an
evidence link, a commit SHA, an environment and a named human approver is an **ERROR**, not a
pass (CCR-006). Every evidence SHA must equal the declared RC SHA (CCR-005). An evidence cell
that is not an openable link is rejected — "verified locally" is not evidence. An approver
matching a bot/CI/agent name is rejected on human gates (CCR-014). G3, G5 and G10 additionally
reject a `localhost`/`mock` environment. `WAIVED` is rejected outright. It **refuses to report
readiness at all** when any gate carries no status, prints `VERDICT WITHHELD` rather than
`NO-GO`, because "nothing was evaluated" and "we evaluated and it failed" are different facts.
Exit codes 0 / 1 / 2, where 2 exists so "we did not check" is never reported as "we checked
and it passed".

### Files changed
`docs/launch/LAUNCH_GATE_EVIDENCE.md` (#351) · `scripts/compile-gate-evidence.ts` (#357)

### Validation executed
Per §0. `tsc --noEmit --strict --noResolve` clean. **Compiled and run against the real
`LAUNCH_GATE_EVIDENCE.md` from #351's branch: 0/13 evidenced, 13 blockers, `VERDICT WITHHELD`,
exit 1** — correct for an empty template. Run against a doctored copy exercising every failure
path: correctly caught PASSED-with-no-evidence, evidence from a different SHA,
`github-actions` as approver on G3, `localhost` environment on G3, `WAIVED` status, and an
exception missing `mitigation` and `deadline`. Run against a missing file: `CANNOT RUN`,
exit 2. **One real defect was found by running it and fixed before pushing** — an unanchored
`release candidate sha` regex matched prose in §1 and read a sentence fragment as a commit
SHA. Jest not run. CI red at `npm test` (runs #885, #888).

### Acceptance criteria
Compiler works ✅ demonstrably · template complete ✅ · **any gate evidenced** ❌ — 0 of 13 ·
**G2 evidenced** ❌ — impossible while CI is red.

### Risks and follow-up
The compiler checks the **shape** of evidence, never its truth. It cannot open a link, confirm
a deploy, or confirm a human did the work — and it says so in its own report, and says it is
not itself gate evidence.

### Rollback
`git revert` the merge or delete the branches. Nothing imports the script.

### Human action required
**HA-B15** — add the npm alias `"gates:compile": "tsx scripts/compile-gate-evidence.ts"`.
**HA-E4** — produce evidence for G1–G11. Every one is human-gated.

---

## Task 5.2 Evidence

Status: `READY_FOR_REVIEW` | Branch: `task/ops-monitoring-and-launch-tooling` | Commit(s): `7ec644e` | PR: #353 | Environment tested: **production** (read-only)

### Current-state findings
`app/sitemap.ts` reads the catalog through **Supabase**, not Mongo, despite
`DATABASE_PROVIDER=mongodb` — so a Supabase outage empties the sitemap while `/api/books`
keeps serving. `app/robots.ts` uses `process.env.NEXT_PUBLIC_SITE_URL` directly rather than
`getSiteUrl()`, so it does not share the `VERCEL_URL` fallback. Neither was changed (provider
routing is owned by other PRs); both are documented as triage signals.

### Changes made
`scripts/lib/seo-audit.ts` (pure canonical/sitemap/robots/metadata audit logic) and
`scripts/seo-check.ts` (report-only CLI). Same-origin only — any sitemap URL on another origin
is reported and skipped, never fetched.

### Files changed
`scripts/lib/seo-audit.ts` (new) · `scripts/seo-check.ts` (new) ·
`tests/unit/seo-audit.test.ts` (new) · `package.json` (alias `seo:check`)

### Validation executed
Per §0. `tsc --strict` clean. 19 unit assertions executed outside jest within the
67-assertion run, **including a regression test that `/audio` stays in the sitemap**.
**`seo:check` run live against production — 0 errors, 2 warnings** (short meta descriptions on
two seeded books). Jest not run. CI red at `npm test` (run #884).

### Acceptance criteria
SEO issues detectable before launch ✅ demonstrated live · **canonical host issue resolved**
❌ — apex vs www is an open decision (see HA-C7).

### Risks and follow-up
The two warnings are on seeded books that will be replaced. Re-run after real content lands.

### Rollback
Revert the files and the alias.

### Human action required
**HA-C7** — decide apex vs www and align the canonical host, `scripts/create-stripe-webhook.sh`
and `docs/reports/deployment/deployment_status.md`.

---

## Task 5.3 Evidence

Status: `READY_FOR_REVIEW` | Branch: `task/qa-automation-and-crawl-regression` | Commit(s): `3733af8` | PR: #355 | Environment tested: none — the harness has not been run

### Current-state findings
No regression crawl existed. Production still holds seeded QA data that will be replaced by
the 3–6 real launch titles, so nothing about the catalog can be hardcoded.

### Changes made
`scripts/crawl-regression.ts` (runner) and `scripts/lib/crawl-report.ts` (pure rules).
**Discovery hardcodes nothing**: `/robots.txt` → the `*` group and its `Sitemap:` lines;
`/sitemap.xml` plus any robots-declared sitemaps, following sitemap indexes;
`/api/books?page=N&perPage=100` read defensively (`books`/`items`/`data`/`results`, `slug`
falling back to `id`); and same-origin `<a href>` found while crawling. No book slug and no
host is hardcoded; with no target supplied the harness exits **2** rather than guessing.
Politeness: same-origin only, bounded concurrency (default 4), a delay after every request
(default 250 ms), a crawl budget, a one-shot HEAD cache, and robots.txt obeyed for the
frontier. Exit codes 0 / 1 / 2, where **2 means "could not run"**, deliberately distinct from
1 so "we did not check" is never reported as "we checked and it passed".

### Files changed
`scripts/crawl-regression.ts` (new) · `scripts/lib/crawl-report.ts` (new)

### Validation executed
Per §0. `tsc --noEmit --strict --noResolve` clean. **This caught one real defect**:
`scripts/**/*.ts` **is** covered by `npm run type-check` (tsconfig excludes `tests`, not
`scripts`), and `let ORIGIN: string` assigned inside try/catch tripped TS2454 — fixed by
resolving the origin in an IIFE that returns or throws. **The harness has not been run against
any target.** CI red at `npm test` (run #887).

### Acceptance criteria
Nothing hardcoded ✅ by inspection · "could not run" is distinguishable from "passed" ✅ ·
**one crawl actually performed** ❌.

### Risks and follow-up
Honest about its own limits: fetch-based, so console errors are reported as
`not-collected (fetch-based crawl, no browser)` unless the HTML contains a rendered Next.js
error marker; mobile is a viewport-meta check; a11y is static (`html[lang]`, `img[alt]`,
unlabelled inputs, `h1` count). It narrows what a human must check; it never replaces the
human.

### Rollback
Delete the two files and the alias if added.

### Human action required
**HA-B16** — add the npm alias `"qa:crawl": "tsx scripts/crawl-regression.ts"`.
**HA-E8** — run one full crawl against the release candidate and file the report.

---

## Task 5.4 Evidence

Status: `READY_FOR_HUMAN_ACTION` | Branch: `task/ops-monitoring-and-launch-tooling` | Commit(s): `7ec644e` | PR: #353 | Environment tested: n/a — documentation

### Current-state findings
No incident response procedure existed for the failure modes this platform actually has: a
paused or deleted Supabase project, a Stripe webhook misroute, and a catalog provider failure.

### Changes made
`docs/operations/INCIDENT_RESPONSE.md`: severity table with response and update cadences; an
alert-recipient table left as explicit `_TBD_` placeholders; first-response steps; **Supabase
pause/deletion diagnosis with the `DNS_PROBE_FINISHED_NXDOMAIN` / `ENOTFOUND` signature and a
200/401/000 interpretation table**; Vercel rollback including what rollback does *not* fix; a
Stripe webhook triage table; catalog provider failure; public communication owner (Renee); and
a post-incident review template that requires at least one "detect" action item.

### Files changed
`docs/operations/INCIDENT_RESPONSE.md`

### Validation executed
Per §0. Documentation. The NXDOMAIN diagnosis path it documents **was exercised** by the
health monitor (Task 0.4) against a non-existent ref, and the 401-is-healthy case was found
and fixed during that work — so the interpretation table is grounded in an observation, not a
guess. CI red at `npm test` (run #884).

### Acceptance criteria
Every known failure mode has a first response ✅ · **alert recipients named** ❌ ·
**one incident rehearsed** ❌.

### Risks and follow-up
A runbook nobody has rehearsed is a document, not a capability.

### Rollback
Delete the file.

### Human action required
**HA-B5** — name the alert recipients (replace every `_TBD_`). **HA-E9** — rehearse one
rollback and record the transcript and revision id; **G11 cannot go TRUE without it.**

---

## Task 5.5 Evidence

Status: `READY_FOR_HUMAN_ACTION` | Branch: `task/5.1-5.5-launch-readiness` | Commit(s): `4b4b058` | PR: #357 | Environment tested: n/a

### Current-state findings
No release sequence, no rollback triggers and no launch communications existed.

### Changes made
`docs/launch/RELEASE_CHECKLIST.md`: the ordered sequence — merge → preview → automated tests →
operator QA → freeze the RC SHA → confirm env → promote → smoke test → monitor — plus **eight
rollback triggers** (public 500s, auth outage, unauthorized admin access, duplicate or
incorrect charges, fulfilment failure at scale, missing launch catalog, data corruption,
secret exposure); a rollback procedure covering the previous known-good deployment identifier,
Vercel Instant Rollback / promote, a **database-compatibility check before any code rollback**
including the data effects of #356 that survive a revert, Stripe endpoint compatibility across
#352's 410 change, a full post-rollback smoke test, and an incident record; and a pre-flight
table of the in-flight PRs with merge order and dependencies.
`docs/launch/LAUNCH_COMMUNICATIONS.md`: website announcement, announcement email, social
posts, an optional press/partner note, an internal launch note, and the launch-day checklist.
The email is **explicitly conditional**, with a send-condition block that must be fully ticked
first: double opt-in completed, consent covers *this* kind of message, `RESEND_API_KEY`
configured and a test send verified, unsubscribe clicked and working. **The provider is wired
end to end, which is precisely why the decision has to be deliberate — the send button works.**
All copy is constrained to what ships: no on-site reading, no mobile apps, audio samples only,
small catalog. **No book title, author name, date, price, quote, endorsement or metric is
invented**; each is a `TODO(renee):` placeholder.

### Files changed
`docs/launch/RELEASE_CHECKLIST.md` (new) · `docs/launch/LAUNCH_COMMUNICATIONS.md` (new)

### Validation executed
Per §0. Documentation. CI red at `npm test` (run #888). **This recorder verified the merge
order recommended in §1 of the checklist against the actual git bases and found it correct**,
with two additions the checklist does not make: #359's base is `audit/2026-07-28-fixes` (not
#356), and #358/#360 are seven commits behind #356.

### Acceptance criteria
Rollback triggers defined ✅ · rollback procedure covers the irreversible data effects ✅ ·
**known-good rollback target recorded** ❌ — it must be captured at cut time and cannot be
reconstructed later · **launch copy approved** ❌ · **send/don't-send decision made** ❌.

### Risks and follow-up
The known-good rollback target is the one item on this list that becomes **impossible** if
missed at the right moment. G11 depends on it.

### Rollback
Delete the two files.

### Human action required
**HA-A4** (record the known-good rollback target — Vercel deployment ID + SHA — at cut time) ·
**HA-D7** (decide whether the announcement email is sent at all — a consent decision) ·
**HA-D8** (sign off all launch copy) · **HA-B17** (name the launch owner and incident owner) ·
**HA-D9** (launch date/window, titles, authors, retailers, and whether prices appear in public
copy).

---

## Section G Evidence — Environment matrix

Status: `BLOCKED_EXTERNAL` | Branch: `task/ops-monitoring-and-launch-tooling` | Commit(s): `7ec644e` | PR: #353 | Environment tested: n/a — documentation

### Current-state findings
No single document recorded which environment variables are required where, which are public
versus secret, who owns each, or how each is rotated. The `service_role` key has no automated
rotation path.

### Changes made
`docs/operations/ENVIRONMENT_MATRIX.md`: **variable names only, zero values.** A requirement
matrix (local / preview / production), public-vs-secret class and owner; source dashboard,
validation method and rotation procedure per variable; the service-role rotation gap; human
actions; and a "last verified" table that **honestly marks production presence as NOT
VERIFIED**.

### Files changed
`docs/operations/ENVIRONMENT_MATRIX.md`

### Validation executed
Per §0. Documentation. Grep for secret-shaped literals across all files added by #353: **none**
(JWT, `sb_secret_`, `sk_live_`, `whsec_`, `mongodb+srv://` shapes). CI red at `npm test`
(run #884).

### Acceptance criteria
Every variable documented ✅ · no value committed ✅ verified · **production presence
verified** ❌ — requires the Vercel dashboard.

### Risks and follow-up
PR #350 flagged two likely production env problems that this matrix cannot resolve from
outside: a missing or rotated `SUPABASE_SERVICE_ROLE_KEY` (book detail pages returned "Book
Not Found" for all three live books) and Upstash rate-limit env (`GET /api/books` returned an
empty body; the limiter is fail-closed).

### Rollback
Delete the file.

### Human action required
**HA-B18** — walk the matrix in the Vercel dashboard and mark each production variable
verified. **HA-B19** — confirm `SUPABASE_SERVICE_ROLE_KEY` and the Upstash variables are
present and current in production; these are the two most likely causes of the live defects
#350 documented.

---

## Section H Evidence — Accessibility and browser matrix

Status: `READY_FOR_HUMAN_ACTION` | Branch: `task/accessibility-and-browser-matrix` | Commit(s): `c5e44a0` | PR: #360 | Environment tested: none — **no browser rendered any page**

### Current-state findings
Nineteen findings by inspection. **A11Y-001, critical:** `text-secondary` resolves to
`--secondary`, which is a **surface** token, not a text token; the matching text token
(`--secondary-foreground`) is almost never used. Computed from `app/globals.css` through
`tailwind.config.ts`: dark theme on the page background **1.37:1**; dark theme inside a
`bg-muted` section **1.00:1**; light theme on the page background **1.09:1** — against a
required 4.5:1. Dark is the default theme and the product-detail hero is
`<Section className="bg-muted">`, so **the author byline, the strikethrough price and the
"Also available at" heading are foreground on identical background.** 149 usages across 62
files, covering audio timecodes and the checkout order summary too. **A11Y-002, high:** the
default `Button` is `#ffffff` on `#ef4343` at 14px/500 → **3.78:1**; `--primary: 0 84% 48%`
would give 4.87:1. Also: the audio seek bar is `role="slider"` with no `tabIndex`/`onKeyDown`;
a document-level Space handler `preventDefault`s on every button; no skip link and `<main>`
has no `id`; admin field errors have no `id`/`aria-describedby`/`aria-invalid`; heading levels
skip h1→h3 on catalog, product and audio; auth pages have no `<h1>` because `CardTitle`
renders `<h3>`; and **26 files open with a blanket `/* eslint-disable */`, killing `jsx-a11y`
entirely**. Confirmed good and worth not regressing: the three auth forms are the
best-implemented in the repo; the global `:focus-visible` outline computes to 5.28:1; Radix
handles every dialog's focus trap and restoration; the PDP retailer links already carry
`rel="noopener noreferrer"` and are real anchors.

### Changes made
Three new files. **No application code was modified.** Every fix is described precisely
(file, line, change) in the audit and handed to the PR owning that file. The spec hardcodes
nothing — base URL from `playwright.config.ts`, book and audio slugs discovered from the live
catalog, no credentials in source; credentialed specs `test.skip()` with a message naming the
variables; empty environments skip rather than fail; **seven known defects are `test.fixme()`
with the audit ID in a comment**, so CI stays green and flipping one line to `test()` is the
regression guard for that fix.

### Files changed
`tests/e2e/accessibility.spec.ts` (new, 940 lines) ·
`docs/operations/ACCESSIBILITY_AUDIT.md` (new, 889 lines) ·
`docs/operations/BROWSER_MATRIX.md` (new, 309 lines)

### Validation executed
Per §0. `tsc --strict --noEmit` with typed `@playwright/test` and `process` stubs: **clean,
zero errors** — note `tsconfig.json` excludes `tests/`, so `npm run type-check` would not have
covered this file. No line exceeds Prettier's `printWidth: 100`. All three files verified
byte-identical after push. `git diff --stat` vs base: 3 files, 2138 insertions, 0 deletions.
**Playwright never executed and no browser ever rendered these pages** — the PR says so under a
heading titled "I could not run these specs" and asks that the findings be read as *"verified
by reading the code"*, not *"observed"*. CI red at `npm test` (run #891). **Base is seven
commits behind #356.**

### Acceptance criteria
Audit complete ✅ by inspection · spec written ✅ · **spec executed** ❌ · **any finding fixed**
❌ — no accessibility fix exists anywhere in the programme · **browser matrix filled** ❌ — it
ships with blank pass/fail cells.

### Risks and follow-up
`playwright.config.ts` runs chromium **only** in CI and no project uses a mobile viewport, so
this matrix is currently the launch's **only** Firefox, WebKit and mobile coverage. There is
no accessibility library in `package.json` — no `axe-core`, `@axe-core/playwright`,
`jest-axe` or `pa11y`; the spec implements its own accessible-name resolution, heading-outline
extraction, focus-indicator detection and WCAG contrast maths in-page. The PR recommends
adding `@axe-core/playwright` as a dev dependency and explains why. **Base staleness**:
`c5e44a0` forks `task/phase1-catalog-data-path` at `a43cea0`, seven commits behind, and the
audit cites `app/admin/books/_lib/BookForm.tsx` line numbers that three later commits changed.

### Rollback
Delete the three files. Nothing imports them.

### Human action required
**HA-C18** — **decide A11Y-001.** Fixing it touches 62 files, or one token plus a rename. It
is the difference between a low-vision reader being able to see the price and author of a book
and not. **HA-A3** (update #360 from #356) · **HA-B20** (approve `@axe-core/playwright` as a
dev dependency) · **HA-E10** (fill the browser matrix — six device classes × four browsers ×
six surfaces; no automation covers Firefox, WebKit or mobile).

---

## Section A.6 Evidence — Registration profile-creation failure

Status: `READY_FOR_REVIEW` | Branch: `task/phase1-auth-security` | Commit(s): `6f56089` | PR: #352 | Environment tested: none

Recorded in full under **Task 1.9** above, of which it is a part. Summary: `register/actions.ts`
logged and continued on profile-creation failure, producing auth users with no `profiles` row
and therefore no role, silently losing every role-gated surface. It now returns an actionable
error, logs redacted diagnostics and sets `profileSetupFailed: true`. Written, statically
checked, **unrun**. Feeds Task 3.1, which no PR in this programme carries — see
`PROGRAMME_STATUS.md` §4 Phase 3.

---

## Programme-level Evidence — this PR

Status: `READY_FOR_REVIEW` | Branch: `task/evidence-packet` | Commit(s): see the PR | PR: this one | Environment tested: GitHub API + a clone at `23e50c1`

### Current-state findings
Eleven open PRs, ~12,000 lines of change and documentation, and no single place recording what
is verified, what is merely written, and what only Renee can do. The most important status
fact — that CI is red everywhere and `next build` has never run — was not stated in any one
place.

### Changes made
Three documents: `PROGRAMME_STATUS.md`, `EVIDENCE_PACKET.md` (this file) and
`HUMAN_ACTIONS.md`.

### Files changed
`docs/launch/PROGRAMME_STATUS.md` · `docs/launch/EVIDENCE_PACKET.md` ·
`docs/launch/HUMAN_ACTIONS.md`. **Nothing else.** No code, no test, no workflow, no migration.

### Validation executed
Every PR number, branch name, head SHA, git base, fork point, CI run number, per-step CI
conclusion, gate state and issue state in these three documents was read from the GitHub API
or a clone at `23e50c1` on 2026-07-28 and is reproducible. No test was run and none is
claimed. Five corrections to the briefing facts were found and are recorded in
`PROGRAMME_STATUS.md` §1, §2, §5 and §6.

### Acceptance criteria
Every task has an evidence record ✅ · every human action names the task and PR it unblocks ✅ ·
no unverified claim is presented as verified ✅ · no secret, project ref or credential appears
✅.

### Risks and follow-up
These documents are a snapshot at `23e50c1`. Every SHA, CI run and base branch changes the
moment anything merges. Re-derive before using them as gate evidence.

### Rollback
Delete the three files. Nothing depends on them.

### Human action required
Read `HUMAN_ACTIONS.md`.
