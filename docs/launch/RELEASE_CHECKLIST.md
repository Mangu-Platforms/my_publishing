# Release Checklist

> **Task 5.5.** The ordered sequence for taking MANGU Publishers 1.0.0 to production, the
> rollback contract, and the pre-flight state of the in-flight PRs.
>
> Subordinate to `docs/NEXT_GO.md` (CCR-001). Gate evidence lives in
> `docs/launch/LAUNCH_GATE_EVIDENCE.md`. Manual QA evidence lives in
> `docs/OPERATOR_QA_LOG.md` (append-only, CCR-002). This file is the *procedure*; it is
> not evidence and never records a gate state.

**Verified context** (checked against the repository at `8e6fa50`, not assumed):

| Fact | Source |
| --- | --- |
| Canonical production host is `https://www.mangu-publishers.com` on Vercel | `docs/NEXT_GO.md` §6 G9; ADR-001 Option B |
| Apex is still on Cloud Run; DNS Option B is IN PROGRESS | `docs/NEXT_GO.md` §4 phase 15, §6 G9 |
| Catalog reads run on MongoDB; auth runs on Supabase | `lib/data/books.ts`, `lib/db/provider.ts` |
| Launch freeze is issue **#209**; it holds PR **#145** (`chore(main): release 1.0.0`) until Authority Phase 16 | issue #209, `docs/NEXT_GO.md` §8 rule 4 |
| P0 backlog is issues **#186–#205** (20 issues, P0-001…P0-020) | `docs/NEXT_GO.md` §5 |
| Hard gates are **G1–G13** and every one must be TRUE (CCR-003) | `docs/NEXT_GO.md` §6 |
| Production catalog is currently **100% seed data** (3 books, known seed slugs) | PR #353 finding, probed 2026-07-28 |

---

## 1. Pre-flight — the in-flight PRs

Seven PRs are open. **#350 is the base branch of the other six**, so it lands first and
every other PR must then be retargeted to `main` before it can merge. Each PR body already
carries that instruction.

| # | Title (verbatim) | Head branch | Depends on | Merge slot |
| --- | --- | --- | --- | --- |
| **350** | Audit fixes: auth pages SSR, book-page 404s, draft-book leak, retailer buttons, cleanup | `audit/2026-07-28-fixes` | — (base is `main`) | **1** |
| **351** | Docs: ADR-001 data ownership, drift dispositions, book lifecycle + publishing runbook, launch governance templates (Tasks 1.1, 2.0, 2.6, 4.1, 5.1) | `task/architecture-and-governance-docs` | #350 | **2** |
| **356** | CRITICAL PATH — Admin writes reach the database the site reads + Mongo catalog field parity (Tasks 1.0, 1.2, 2.0b, 2.1–2.4) | `task/phase1-catalog-data-path` | #350 | **3** |
| **352** | Phase 1: auth SSR, RBAC hardening, webhook consolidation, error + password policy (Tasks 1.3–1.5, 1.7–1.9) | `task/phase1-auth-security` | #350 | **4** |
| **354** | Task 4.6: make marketing pages truthful (remove false functionality claims) | `task/4.6-marketing-truthfulness` | #350; copy sign-off | **5** |
| **353** | Ops: health monitor auth checks, incident runbook, environment matrix, seed-cleanup dry run (Tasks 0.4, 0.7, 1.6, 5.2, 5.4) | `task/ops-monitoring-and-launch-tooling` | #350 | **6** |
| **(this)** | Launch readiness: gate evidence compiler, release checklist + communications, author profile spec (Tasks 4.5, 5.1, 5.5) | `task/5.1-5.5-launch-readiness` | #350, **#351** | **7** |
| **355** | QA: RBAC + rate-limit E2E coverage, operator QA log, full-crawl regression harness (Tasks 3.4, 3.5, 3.7, 5.3) | `task/qa-automation-and-crawl-regression` | #350, #352, #354, #356 | **8** |

### Why this order

1. **#350 first** — it is the literal git base of the other six. Nothing else can merge cleanly until it does.
2. **#351 second** — documentation only, zero code conflict, and it creates `docs/launch/LAUNCH_GATE_EVIDENCE.md`, which this PR's compiler reads and which the whole gate process depends on.
3. **#356 third** — it fixes the R0 blocker (admin writes went to a database the public site never reads). Until it lands, **no real launch book can be published through the admin UI at all**, so the launch catalog cannot be built and G10 row 7 cannot pass.
4. **#352 fourth** — auth/RBAC hardening on disjoint files. It must precede #355, whose RBAC matrix asserts *this* PR's hardened contract; running it earlier would fail against pre-hardening behaviour.
5. **#354 fifth** — marketing truthfulness (G6). Its copy needs Renee's sign-off before merge, so it may slip; nothing else depends on it except #355's crawl expectations.
6. **#353 sixth** — ops tooling; it is the only PR that edits `package.json` (three script aliases), so it has no merge conflict with anything.
7. **This PR seventh** — needs #351's evidence document to exist.
8. **#355 last** — it is the verification layer. Its assertions describe the post-merge state of #352, #354 and #356; landing it earlier produces red CI that means nothing.

### Cross-PR items that will be missed if nobody checks

| Item | Detail |
| --- | --- |
| **"Start Reading" button on the PDP** | PR #352 (Task 1.7) removed every other link into `/reading/[bookId]` but did **not** edit `app/(consumer)/books/[slug]/page.tsx` (another agent's file). #356's manual QA step 7 says "Confirm no *Start Reading* control appears anywhere". **Verify the button is actually gone after #356 merges** — if it is not, the site still promises on-site reading, and G6 cannot pass. |
| **Retargeting** | Six PRs point at `audit/2026-07-28-fixes`. After #350 merges, each must be retargeted to `main` or it will show an empty/incorrect diff. |
| **npm alias for this script** | This PR does not touch `package.json`. Until an alias is added, run the compiler as `npx tsx scripts/compile-gate-evidence.ts`. Requested alias: `"gates:compile": "tsx scripts/compile-gate-evidence.ts"`. PR #355 similarly requested `qa:crawl`. |
| **Freeze classification** | Every merge during the freeze must fall into a permitted class in issue #209 (document-only, CI truthfulness, PR hygiene, minimal recovery repair, approved security fix). Record the class in the merge comment. |

---

## 2. Deployment sequence

Do these in order. Do not skip forward when a step is amber; NO-GO is the default
(`docs/NEXT_GO.md` §8 rule 1).

### Step 1 — Merge the approved PRs

- [ ] Merge in the order in §1. After each merge, confirm CI is green **on the resulting `main` SHA**, not on the PR head.
- [ ] Retarget every remaining PR to `main` immediately after #350 lands.
- [ ] Confirm PR **#145** (release 1.0.0) and every held dependabot major (#167, #160, #155, #154, #152, #133, #129) and #142 are still **HELD**.
- [ ] Record the merge class from issue #209 on each merge.

### Step 2 — Deploy preview / staging

- [ ] Confirm a Vercel preview deployment builds from the merged `main`.
- [ ] Preview env must have the same provider settings as production (`DATABASE_PROVIDER`, `AUTH_PROVIDER`, `STORAGE_PROVIDER`) — see `docs/operations/ENVIRONMENT_MATRIX.md` (arrives with #353).
- [ ] `USE_MOCKS` and `SKIP_EMAILS` must be **absent** — mocks cannot satisfy a Tier R gate (CCR-010).

### Step 3 — Automated tests

- [ ] `npm run type-check`, `npm run lint`, `npm test`, `npm run build` — all green on the candidate SHA.
- [ ] `npx tsx scripts/validate-gap-ledger.ts` green.
- [ ] `npm run health:check` and `npm run seo:check` against the preview (after #353).
- [ ] `npx tsx scripts/crawl-regression.ts --base-url=<preview>` exit 0 (after #355).
- [ ] Playwright E2E against the preview. **CI is the authoritative run.** No agent in this programme could execute Jest or Playwright — `npm ci` exceeds the authoring sandbox's command budget — so no PR body's claim of a green suite substitutes for the CI run on the merge commit.

### Step 4 — Operator QA (human, cannot be automated)

- [ ] Fill `docs/OPERATOR_QA_LOG.md` rows 1–10 (issue #193 / P0-008). Human evidence is required (CCR-014); CI cannot sign off a row.
- [ ] Every row cites the **same** RC SHA, an environment, a tester and an artifact link.
- [ ] Row 7 ("Browse `/books`") cannot honestly pass while the catalog is seed data. See Step 6.

### Step 5 — Freeze the release candidate SHA

- [ ] Record one immutable commit SHA as the RC. Write it into `docs/launch/LAUNCH_GATE_EVIDENCE.md`.
- [ ] **If any code changes after this point, the RC SHA changes** and every affected test and QA row re-runs against the new SHA (CCR-005). A green from another SHA is not evidence.
- [ ] Run `npx tsx scripts/compile-gate-evidence.ts`. It refuses to report a verdict while any gate is unevidenced or any exception lacks an owner, risk, mitigation and deadline. Exit 2 means it could not check — that is not a pass.

### Step 6 — Launch catalog

- [ ] Confirm the catalog contains **3–6 real launch books** and no QA/seed content (`docs/launch/LAUNCH_CATALOG.md`, arrives with #351).
- [ ] `npm run catalog:seed-audit` (dry run) to enumerate seed records (after #353). **Removing the seed records empties the public catalog** until real books exist — sequence the real books in first.
- [ ] Each launch book has a cover, description, genre, price and at least one verified retailer link.
- [ ] Confirm `app/sitemap.ts` output lists only launch books. Note: the sitemap reads through **Supabase** while `/api/books` reads Mongo — they can disagree (PR #353 finding). Check both.

### Step 7 — Confirm environment variables

- [ ] Production env matches `docs/operations/ENVIRONMENT_MATRIX.md`. Values are never printed, pasted into evidence, or committed (CCR-009).
- [ ] `NEXT_PUBLIC_SITE_URL` = the canonical origin (`https://www.mangu-publishers.com`).
- [ ] `SUPABASE_SERVICE_ROLE_KEY` present and valid — PR #350 identified a missing/rotated service-role key as the likely cause of production book pages 404ing.
- [ ] Upstash limiter env present. The limiter is **fail-closed**: missing env takes down auth, not just rate limiting.
- [ ] `STRIPE_WEBHOOK_SECRET` matches the dashboard endpoint's signing secret.
- [ ] `RESEND_API_KEY` — its absence is what makes the newsletter surfaces render nothing. Decide deliberately, do not discover it at launch.

### Step 8 — Promote to production

- [ ] **Record the current production deployment ID and its commit SHA before promoting.** This is the rollback target and it cannot be reconstructed afterwards. → `TODO(renee):` paste the known-good Vercel deployment ID + SHA here at cut time.
- [ ] Confirm database backups exist and their restore path is known (`scripts/backup-db.sh`; MongoDB Atlas and Supabase are separate backup domains).
- [ ] Promote the candidate deployment to production in Vercel.
- [ ] Confirm the production deployment's commit SHA equals the RC SHA. If it does not, stop.

### Step 9 — Immediate smoke test (production, within minutes of promote)

- [ ] `GET /` — 200, correct canonical host, no preview-host canonical.
- [ ] `GET /books` — the launch catalog, nothing else.
- [ ] `GET /books/<each launch slug>` — 200, renders, retailer links present and correct.
- [ ] `GET /api/health?ready=1` → `ready:true` with all critical components (G7).
- [ ] `GET /login`, `GET /register` — server-rendered HTML, not a blank shell.
- [ ] Sign in as a real test account; sign out.
- [ ] `POST /api/webhook` unsigned → **400**. `POST /api/webhooks/stripe` → **410** naming `/api/webhook` (after #352).
- [ ] One real Stripe test-mode purchase → order row → library entitlement.
- [ ] `/reading/<bookId>` shows the honest unavailable page; no "Start Reading" control anywhere.
- [ ] Non-admin hitting `/admin` is denied.
- [ ] `npm run health:check` and `npx tsx scripts/crawl-regression.ts` against production.

### Step 10 — Monitor

- [ ] Watch Sentry (or the configured error sink) for the first 60 minutes, then hourly for 24 hours.
- [ ] Watch Stripe: every event delivered, every delivery 2xx, no duplicate charge.
- [ ] Watch the scheduled health monitor's first post-launch run.
- [ ] Record the launch timestamp (UTC) in `docs/OPERATOR_QA_LOG.md`.
- [ ] Refresh `docs/NEXT_GO.md` §3 baseline to the release SHA (G12, CCR-020) in a new commit.

---

## 3. Rollback triggers

**Any one of these triggers a rollback decision immediately.** The decision is the incident
owner's; it does not wait for consensus.

| # | Trigger |
| --- | --- |
| 1 | Public **500s on critical routes** (`/`, `/books`, `/books/<slug>`, `/login`, `/register`, checkout) |
| 2 | **Auth outage** — users cannot register, sign in, or reset a password |
| 3 | **Unauthorized admin access** — any non-admin reaching an admin surface, or a forged role granting anything |
| 4 | **Duplicate or incorrect charges** |
| 5 | **Fulfilment failure at material scale** — paid orders not producing entitlements |
| 6 | **Missing launch catalog** — the launch books are not visible on the public site |
| 7 | **Data corruption** in either store |
| 8 | **Secret exposure** in git, a client bundle, a log, an image or an evidence artifact (CCR-009) |

Triggers 3 and 8 additionally require **revoke/rotate plus history remediation**, not just a
rollback — rolling back the code does not un-expose a secret.

---

## 4. Rollback procedure

> Rollback is rehearsed before it is needed (CCR-012, G11). A rollback target that has
> never been promoted is not a known-good target.

**R0. Declare.** Name the incident owner. Start the record (§4, incident record). Post the
first internal update. See `docs/operations/INCIDENT_RESPONSE.md` (arrives with #353).

**R1. Identify the previous known-good deployment.**
- Vercel Dashboard → the project → **Deployments** → the last deployment that was in
  Production and was verified healthy.
- Record its **deployment ID/URL and its commit SHA**. Both. A SHA alone does not identify
  a deployment, and a deployment ID alone does not tell you what code it is.
- `TODO(renee):` this identifier cannot be read from the repository. Capture it at Step 8
  of every release and keep it with the release record.

**R2. Database compatibility check — before rolling back any code.**
Rolling code back under a forward-migrated database is how a rollback becomes an outage.

- [ ] Did any migration land between the known-good deployment and the current one?
      `git log <known-good-sha>..<current-sha> -- supabase/migrations/`
- [ ] **If yes: stop.** A code rollback across a schema change needs the compatibility of the
      old code with the new schema established first. Prefer rolling *forward* with a fix.
- [ ] If no migration landed, a code rollback is schema-safe.
- [ ] Check the *data* effects that survive a code revert. For this release specifically:
      books published through the admin UI while #356 was live exist as Mongo documents with
      `visibility:'public'`; after a revert the admin UI writes Supabase again and those
      Mongo books stay public until unpublished directly. `published_at` values stamped
      under #356 are retained and are not restored by a revert.
- [ ] Confirm a current backup exists before any restorative action (`scripts/backup-db.sh`).

**R3. Stripe endpoint compatibility.**
- [ ] The canonical webhook handler is `app/api/webhook/route.ts` → `/api/webhook`. After #352,
      `/api/webhooks/stripe` returns **410 Gone** naming the canonical path.
- [ ] Rolling back to a pre-#352 deployment makes `/api/webhooks/stripe` functional again; it
      does **not** break a dashboard endpoint that points at `/api/webhook`. Rolling *forward*
      while the dashboard still points at `/api/webhooks/stripe` **does** break fulfilment.
- [ ] Confirm the dashboard endpoint URL, its signing secret, and that its enabled events are
      exactly `checkout.session.completed`, `checkout.session.expired`, `charge.refunded`,
      `payment_intent.payment_failed`.
- [ ] Note: `scripts/create-stripe-webhook.sh` targets the **apex** host while the canonical
      host is **www**. `TODO(renee):` confirm which host the live endpoint uses.
- [ ] After rollback, replay or resend a failed event and confirm a 2xx plus the side effect.

**R4. Execute the rollback.**
- Vercel Dashboard → Deployments → the known-good deployment → **Instant Rollback**
  (or **Promote to Production** on that deployment).
- CLI alternative: `vercel rollback` / `vercel promote` against the recorded deployment.
  `TODO(renee):` confirm the installed Vercel CLI version supports the command you intend
  to use, *before* you need it. Do not learn this during an incident.
- If the trigger is a DNS/host problem rather than a code problem, rollback is a DNS action,
  not a deployment action — see `docs/NEXT_GO.md` §4 phase 15.

**R5. Post-rollback smoke test.** Re-run **every** check in Step 9 against production. A
rollback is not complete because the deployment changed; it is complete when the site is
verified healthy on the old build. Include at minimum: homepage, catalog, one book page,
login, `/api/health?ready=1`, and one Stripe test event.

**R6. Incident record.** In `docs/OPERATOR_QA_LOG.md` (append-only) plus the incident record:
trigger observed, time detected (UTC), time decided, time rolled back, time verified healthy,
the from/to deployment IDs and SHAs, user impact, whether money moved incorrectly, and the
follow-up issue. At least one action item must improve **detection**, not just the fix.

---

## 5. Decisions this checklist cannot make

| # | Needs Renee |
| --- | --- |
| 1 | The **launch owner** and the **incident owner** (names, and who is reachable during the window) |
| 2 | The **launch date and time window** |
| 3 | The **known-good rollback target** (deployment ID + SHA) at cut time |
| 4 | Whether the Stripe endpoint is **test or live mode** at launch, and its exact URL and host |
| 5 | Confirmation that **3–6 real launch books** exist and that seed data is removed in the right order |
| 6 | The backup/restore owner for **MongoDB Atlas** and **Supabase** separately |
| 7 | Whether the freeze is lifted before or after the announcement (issue #209 lifts it in Authority Phase 16) |
