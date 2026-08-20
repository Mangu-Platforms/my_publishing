# HUMAN_TASKS — MANGU Publishers production remediation

Work items that genuinely require console access or token scopes the agent swarm
does not have. Everything else is being executed autonomously. Ordered by priority.

## Cowork control (do these first)

### C0.0 Merge Phoenix WS2d PR #349 to `main` — DONE (2026-07-25)

**DONE — #349 squash-merged to `main` as `93a68cc` (feat(phoenix-ws2d): dual-run
query layer for consumer + admin reads). Record below kept for history.**

**PR:** https://github.com/redinc23/my_publishing/pull/349  
**Branch:** `cursor/phoenix-ws2d-query-layer-a030`  
**CI:** green (`ci` SUCCESS). **Auto-merge (squash)** already armed.  
**Blocker:** branch protection — needs **≥1 approving review** from someone with write access. Agents cannot satisfy that from this environment (`gh pr merge --admin` rejected).

**Click path:** open PR → **Review** → **Approve** → auto-merge should land squash to `main`.

**Handoff for next agents after merge:** `docs/PHOENIX_WS2D_AGENT_HANDOFF.md`

### C0.1 Disable Cursor storm automations — STILL REQUIRED (verified 2026-07-19)

Both are still **`enabled: true`** and still opening draft PRs:

| Automation                   | ID                                     | Action                                                                            |
| ---------------------------- | -------------------------------------- | --------------------------------------------------------------------------------- |
| Fix CI failures              | `094ce0ad-7ba5-11f1-ba66-0e7d0216e441` | **Disable** → https://cursor.com/automations/094ce0ad-7ba5-11f1-ba66-0e7d0216e441 |
| pr (Repository health sweep) | `ab582f50-7ba7-11f1-ba66-0e7d0216e441` | **Disable** → https://cursor.com/automations/ab582f50-7ba7-11f1-ba66-0e7d0216e441 |

Agents cannot toggle these via API (read-only). Close duplicate draft PRs after disable.

### C0.2 Create safe Phoenix cowork automation (after C0.1)

Dashboard → New automation → paste entire file:

`.cursor/automations/phoenix-next-slice.prompt.md`

Schedule suggestion: 2×/day UTC. Details: `docs/COWORK_OPERATOR.md`.

Optional second automation: `.cursor/automations/prod-health-triage.prompt.md` (manual / rare).

### C0.2b Cloud Agent environment — now repo-owned (2026-07-25)

`.cursor/environment.json` + `.cursor/install.sh` are committed (PR #348) and
**override** the personal SETUP_FLOW environment recorded in the dashboard
(`environmentPublicId: c272e120-…`). No dashboard action required for the
override itself — Cursor resolves repo file → personal → team.

**Do not** re-record a personal install that only runs `npm ci`. That is exactly
the command that failed with `EUSAGE` (lockfile drift) and would next fail with
`EBADENGINE` (Node v22.14.0 from `/exec-daemon` shadowed `.nvmrc`'s v22.22.2).
Edit `.cursor/install.sh` instead. Details: `docs/COWORK_OPERATOR.md` § Cloud
Agent environment.

### C0.3 Path decision — LOCKED to Phoenix (B)

**Resolved (owner-confirmed 2026-07-20):** Project Phoenix is **ACTIVE**. Owner Faith
Beckwith reactivated migration ("we gotta do that migration now") while requiring the
site keep serving the public. Path A (stabilize-only) is **off**. Production remains
`AUTH_PROVIDER=supabase` until Phase 11–12 cutover; do not flip Better Auth live early.

---

## P0 — security-critical

### H0.1 Migrate off the exposed legacy Supabase anon key

**Automation status:** `.github/workflows/rotate-supabase-key.yml` +
`scripts/update-supabase-anon-key.sh` land in this commit. The workflow pushes
any new key to GitHub Secrets and both Vercel projects in one trigger — no more
touching three UIs.

**Remaining manual steps (3) — operator must do these:**

#### H0.1-A One-time bootstrap (do once, never again)

Set these five GitHub Secrets at
`github.com/redinc23/my_publishing/settings/secrets/actions`:

| Secret                         | Where to get it                                                        |
| ------------------------------ | ---------------------------------------------------------------------- |
| `VERCEL_TOKEN`                 | vercel.com/account/tokens → Create                                     |
| `GH_PAT_SECRETS`               | github.com/settings/tokens → Fine-grained → secrets:write on this repo |
| `VERCEL_PROJECT_MY_PUBLISHING` | Vercel → my_publishing → Settings → General → Project ID               |
| `VERCEL_PROJECT_MANGUPROJECTZ` | Vercel → manguprojectz → Settings → General → Project ID               |
| `VERCEL_TEAM_ID`               | Vercel team ID (blank if personal account)                             |

#### H0.1-B Run the rotation workflow (pushes new key everywhere)

1. Go to **Actions → Rotate Supabase Anon Key → Run workflow**
2. Paste the `sb_publishable_…` key from
   [Supabase dashboard → project `tkzvikozrcynhwsqtkqp` → Settings → API](https://supabase.com/dashboard/project/tkzvikozrcynhwsqtkqp/settings/api)
3. Click **Run workflow** — GitHub Secrets + both Vercel projects update automatically

#### H0.1-C Disable the OLD key in Supabase (kills the git-history exposure)

1. Supabase dashboard → project `tkzvikozrcynhwsqtkqp` → Settings → API Keys
2. Find the legacy `anon` JWT (`eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRrenZp…`) → **Disable**
3. Verify: `curl -I https://tkzvikozrcynhwsqtkqp.supabase.co/rest/v1/ -H "apikey: <OLD_JWT>"` → must return `401`

Do not rotate the project JWT signing secret; that is a separate session-impacting operation.

### H0.2 Disable both external Cursor PR automations

Superseded / expanded by **C0.1** (both storm automations). Keep this item until
`enabled: false` is verified for id `094ce0ad-7ba5-11f1-ba66-0e7d0216e441`.

Original detail (retained): the duplicate-PR storm (11 closed PRs: #212, #220, #222,
#224, #228, #230, #232, #242, #244, #246, #247) is generated by a Cursor cloud
automation (id `094ce0ad-7ba5-11f1-ba66-0e7d0216e441`). No in-repo change can stop it —
disable or throttle it at cursor.com/automations. Also disable the health-sweep
automation (id `ab582f50-7ba7-11f1-ba66-0e7d0216e441`), which creates a second class of
noisy PRs.

**Sequencing warning (PR #283):** disable the legacy automation above _before_ enabling
the in-repo loop (`.github/workflows/ci-fix-loop.yml`), or both may fire and recreate
the storm.

### H0.2b Enable the in-repo CI fix loop (closed loop)

One-time setup so PRs with `auto-merge` get: CI fail → Cursor agent fixes → CI
re-run → auto-merge on green.

1. **Cursor Dashboard → API Keys** — create a key; add as GitHub repo secret
   `CURSOR_API_KEY` (Settings → Secrets → Actions).
2. **Cursor Dashboard → Cloud Agents** — connect GitHub; grant this repo access.
3. **Disable** the legacy automation (H0.2 above).
4. On any PR you want in the loop: add label **`auto-merge`**.
5. Optional: add **`ci-fix-loop-paused`** to stop further dispatches (max 5 attempts
   per PR otherwise).

Workflows involved: `ci-fix-loop.yml` (dispatch on CI / Format Check failure),
`auto-merge.yml` (merge when green). E2E / preview failures are **not** auto-fixed
yet — fix those manually or extend the workflow list later.

### H0.3 Re-authenticate gcloud and verify Secret Manager entries (before first hardened deploy run)

The local gcloud session is expired; run `gcloud auth login`, then verify that
`cloudbuild.yaml` mounts these via `--set-secrets`:
`supabase-service-role-key`, `stripe-secret-key`, `stripe-webhook-secret`
(plus optional `resend-api-key`, `openai-api-key`, `upstash-redis-rest-url`,
`upstash-redis-rest-token`). Create any that are missing in the GCP project.

### H0.4 Apply the deploy.yml hardening manually (token scope gap)

> **Update 2026-07-25:** the scope gap no longer applies to Cursor cloud agents —
> a `.github/workflows/ci.yml` change was pushed successfully on
> `cursor/phoenix-cutover-readiness-a030`. Workflow-file edits can be requested
> from an agent again. Note also that `deploy.yml` and 18 other workflows were
> **deleted** by the CI minimization in `8c8ba3f` (only `ci.yml`,
> `merge-steward.yml` and `rotate-supabase-key.yml` remain), so the hardening
> below applies to whichever of those files you choose to restore.

The swarm's GitHub token lacks the `workflow` OAuth scope, so
`.github/workflows/*` edits could not be pushed by the swarm. Apply this change
to `.github/workflows/deploy.yml` by hand (or grant the token `workflow` scope
and ask the swarm to re-run the CI-hardening workstream):

- Move `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
  out of plaintext `env_vars:` into a `secrets:` block:
  `SUPABASE_SERVICE_ROLE_KEY=supabase-service-role-key:latest`,
  `STRIPE_SECRET_KEY=stripe-secret-key:latest`,
  `STRIPE_WEBHOOK_SECRET=stripe-webhook-secret:latest`
  (same Secret Manager names already used by cloudbuild.yaml).
- Add top-level `permissions: { contents: read }`,
  `concurrency: { group: deploy-production-cloud-run, cancel-in-progress: false }`,
  and `environment: production` + `timeout-minutes: 30` on the deploy job.
  The full hardened workflow-file set (all 19 workflows: permissions, concurrency,
  timeouts, bug-to-issue loop guard, auto-merge label-gate, ci.yml service-role
  removal from PR jobs) is produced by the swarm's CI audit — request it when a
  workflow-scoped token is available.

Also: if `cowork-operator-guard.yml` fails to land due to the same scope gap, apply
from the cowork PR manually.

## P1 — release governance

### H1.1 Enable branch protection on `main` — DONE

**DONE — see "Completed by the repository recovery" below: one approval, strict
`test` + `format` checks, linear history, conversation resolution, no
force-pushes/deletion.** (This entry previously contradicted that record.)

### H1.2 Decide Project Phoenix vs. current Supabase stack

**DONE — Path B (Phoenix) REACTIVATED 2026-07-20.** Owner confirmed migration is on.
Legacy Supabase remains the live public auth/data path until Phase 11–14 cutover
(`AUTH_PROVIDER=supabase` default). Agents execute WS1→WS6; do not pause again unless
the owner reopens this item.

### H1.3 Vercel environment audit

- `NEXT_PUBLIC_SITE_URL` must be `https://www.mangu-publishers.com` in Production
  (the old repo fallback pointed at a preview domain).
- Confirm Production + Preview env sets match `.env.production.example`.

### H1.4 Enable Supabase leaked-password protection

Supabase Auth currently reports leaked-password protection disabled. Enable it
under Authentication → Settings → Password Security, then re-run Security
Advisor.

## Completed by the repository recovery

- H0.4 workflow hardening: cache-backed bug state, no direct state commits,
  protected production secrets, PR-safe CI credentials, label-gated auto-merge.
- H1.1 branch protection: one approval, strict `test` + `format` checks, linear
  history, conversation resolution, and no force-pushes or branch deletion.
- H1.2 Phoenix decision: reactivated 2026-07-20 — Path B active; dual-run keeps
  public Supabase Auth until cutover (`AUTH_PROVIDER`).
- Reader-engagement, newsletter, listening-progress, and security migrations
  are recorded and applied to project `tkzvikozrcynhwsqtkqp`.

## P2 — environment-limited (swarm sandbox)

### H2.1 Docker build + scan

No Docker daemon in the swarm environment. Dockerfile was hardened statically
(`.dockerignore`); run `docker build` + `trivy image` in CI or locally to close
Phase 8.

### H2.2 Playwright authenticated E2E against Preview

Needs real Supabase test user + Vercel preview URL secrets. Public smoke probes
were run by the swarm; authenticated flows need a dedicated non-admin test user
(see directive Task 5.7).

---

## Project Phoenix human gates (integrated from PR #248)

> Per **H1.2** (reactivated 2026-07-20), Phoenix is **ACTIVE**. Supabase remains the
> public production auth/data path until cutover. The tables below are human-owned gates
> (from `docs/PHOENIX_RECON.md`) — agents write scripts/docs; humans run consoles.

Human-owned gates. Agents write scripts and docs; humans operate consoles, credentials, and DNS.
Click-paths reference `docs/PROJECT_PHOENIX.md` unless noted.

**Status legend:** ⬜ pending · 🟡 in progress · ✅ done · ⏸️ blocked

---

## Immediate (unblocks local / scaffold)

| ID        | Task                                                                                                          | Status | Notes                                       |
| --------- | ------------------------------------------------------------------------------------------------------------- | ------ | ------------------------------------------- |
| H-RECON-1 | Provide local Supabase + Stripe secrets (or confirm CI-only e2e) so Playwright can establish a local baseline | ⬜     | Recon D7 — `npm run dev` → `validate-env`   |
| H-P5.2    | Run `npm run db:mongo:up` with Atlas API keys once scaffold lands on a WS branch                              | ⬜     | Doc P5.2 — agent writes scripts; human runs |
| H-P5.3    | `npm run db:mongo:ping`                                                                                       | ⬜     |                                             |
| H-P5.4    | `npm run db:mongo:indexes`                                                                                    | ⬜     |                                             |

## Phase 1 — prep (from Phoenix §5)

| ID   | Task                                                        | Status |
| ---- | ----------------------------------------------------------- | ------ |
| P1.4 | Create MongoDB Atlas API key                                | ⬜     |
| P1.5 | Create Vercel token (env sync)                              | ⬜     |
| P1.7 | Feature-freeze communications to stakeholders               | ⬜     |
| P1.8 | Full Supabase `pg_dump` + storage snapshot (restore-tested) | ⬜     |

## Phase 8 — Vercel env / Stripe

| ID   | Task                                                                                                                            | Status |
| ---- | ------------------------------------------------------------------------------------------------------------------------------- | ------ |
| P8.x | Load all Phoenix §9.1 (+ amended SITE_URL / extras) into Vercel Production + Preview                                            | ⬜     |
| P8.x | Add `AUTH_PROVIDER=supabase`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` to Vercel (do **not** flip to better-auth until Phase 11) | ⬜     |
| P8.x | Point Stripe webhook at Vercel `/api/webhook` (keep Cloud Run standby)                                                          | ⬜     |

## Phase 11 — data cutover

> **All six agent-owned scripts now exist and are runnable** (they did not before
> 2026-07-25 — four were missing, so Phase 11 could not be executed at all).
> Step-by-step operator instructions, including what "good" output looks like and
> when to abort: **`docs/PHOENIX_CUTOVER_RUNBOOK.md`**.
>
> Nothing in Phase 11 writes to Supabase or changes what the public site serves.
> **Do not begin until P1.8 (restore-tested `pg_dump` + storage snapshot) is done.**

| ID    | Task                                                                    | Command                                            | Status |
| ----- | ----------------------------------------------------------------------- | -------------------------------------------------- | ------ |
| P11.1 | Export from Supabase (needs `SUPABASE_DB_URL`)                          | `npm run phoenix:export`                           | ⬜     |
| P11.2 | Transform (agent-verified; gate = zero unmapped FKs)                    | `npm run phoenix:transform`                        | ⬜     |
| P11.3 | **Dry run into a staging Atlas db + preview smoke 6/6 — do not skip**   | see runbook §3                                     | ⬜     |
| P11.4 | Production `mongoimport` + `npm run db:mongo:indexes`                   | see runbook §4                                     | ⬜     |
| WS3.4 | Storage migration (needs `BLOB_READ_WRITE_TOKEN`), before P11.5         | `npm run phoenix:migrate-storage`                  | ⬜     |
| P11.5 | `mongosh` verification — exits non-zero on any failed check             | `npm run phoenix:verify`                           | ⬜     |
| P11.6 | Data Owner sign-off on the reconciliation bundle                        | see runbook §9                                     | ⬜     |
| —     | Delta capture, both directions (rollback safety net)                    | `npm run phoenix:delta -- --since <ts> --source …` | ⬜     |
| —     | Forced-reset batch in prod — start `--limit 25`, needs `RESEND_API_KEY` | `npm run phoenix:forced-resets -- --send`          | ⬜     |

**Abort conditions (from the runbook — memorize these two):**

- `npm run phoenix:verify` reports `FAIL` on **`no bcrypt hashes present`** → a
  password hash reached Better Auth. Stop the cutover. This breaks North Star #4
  and locks users out in a way that superficially looks like working auth.
- `npm run db:mongo:indexes` fails on a duplicate key after import → the
  uniqueness invariant is violated (slug or Stripe payment intent). Drop the
  collections, fix the transform, restart. Do not "just skip the index" — the
  unique sparse index on `orders.stripe_payment_intent_id` is the only thing
  making the Stripe webhook idempotent.

**Until the forced-reset batch runs, no legacy user can log in.** That is by
design (hashes are never migrated), but it means step 7 of the runbook is not
optional cleanup — it is how the userbase regains access.

## Phase 13–15 — cutover / teardown

| ID  | Task                                                                         | Status |
| --- | ---------------------------------------------------------------------------- | ------ |
| P13 | Cloudflare DNS → Vercel; Cloud Run standby 48h                               | ⬜     |
| P14 | Prod QA matrix, mongodump to cloud storage, token revocation, Supabase pause | ⬜     |
| P15 | Post-mortem                                                                  | ⬜     |

## Doc decisions needed from humans (recon §10)

| ID  | Decision                                                                                                        | Status |
| --- | --------------------------------------------------------------------------------------------------------------- | ------ |
| D8  | Confirm manuscripts stay non-public (proxy-only) even if Blob `put` uses path obscurity                         | ⬜     |
| D12 | Confirm feature freeze: resonance/MCP/social-beyond-reviews/payouts deferred post-Phoenix unless listed in §1.4 | ⬜     |

---

_Updated with Phase 0 deep dive (`docs/PHOENIX_RECON.md`)._

---

## Ledger governance

### H-L1 Supply or ratify the Product Gap handover (owner decision)

`docs/PRODUCT_GAP_AI_HANDOVER.md` — the document `docs/AGENT_EXECUTION_PACKET.md`
cites as defining the 60 Product Gap items (P-001..P-060) — is **absent from the
repo and from git history** as of baseline `47340b73f6c609059229c3102ae442f5d161b910`.
The canonical ledger `docs/product-gap-ledger.yml` (Run R1) was therefore
**reconstructed** from `docs/AGENT_EXECUTION_PACKET.md`, `docs/NEXT_GO.md`,
`docs/PRODUCT_FEATURE_STORIES.md`, and `docs/ENHANCEMENT_LEDGER.md`.

**Owner action:** supply the original handover document, or ratify the
reconstructed ledger. Pay particular attention to the **area assignments** for
P-013..P-016, P-019, P-020, P-023..P-030, P-033..P-037, P-039..P-042,
P-044..P-047, and P-050..P-058 — these were inferred from the four source
documents above rather than from the missing original. Also ratify the
owner-decision table in `docs/PRODUCT_GAP_LEDGER.md` §3 (P-015, P-021, P-022,
P-031, P-038, P-043, P-048, P-049, P-059).
