# MANGU Publishers — End-to-End Project Document

**Document ID:** MANGU-E2E-001  
**Version:** 1.0  
**Last updated:** 2026-05-19  
**Repository:** [redinc23/my_publishing](https://github.com/redinc23/my_publishing) (private)  
**Application name:** `mangu-publishers`  
**Cloud Run service:** `mangu-publishers`

This is the **single comprehensive planning reference** for the project. It merges the Project Status Plan, Master RICEF, Full Hardening audit, Operator Walkthrough, Phase 2 package, and BRD into one narrative any role can follow.

**Companion docs (deeper slices):**

| Doc                                                                                                                         | Purpose                             |
| --------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| [.cursor/plans/mangu_publishers_master_ricef.md](../.cursor/plans/mangu_publishers_master_ricef.md)                         | RICEF program structure             |
| [.cursor/plans/operator_walkthrough_supplement.md](../.cursor/plans/operator_walkthrough_supplement.md)                     | Click-by-click operator steps       |
| [.cursor/plans/full_project_hardening_plan_7b818069.plan.md](../.cursor/plans/full_project_hardening_plan_7b818069.plan.md) | File-level technical audit snapshot |
| [docs/CANONICAL_PRODUCTION.md](./CANONICAL_PRODUCTION.md)                                                                   | Production target decision          |
| [docs/BRD.md](./BRD.md)                                                                                                     | Business requirements source        |

> **⚠ Supersession notice (added 2026-08-25, does not alter the text below):** This document
> is frozen at v1.0 (2026-05-19) as a historical business/product reference. It predates
> Project Phoenix (reactivated 2026-07-20) and the NEXT_GO launch-authority framework
> (2026-07-18+). **Current execution authorities are `docs/NEXT_GO.md` (launch gates
> G1–G13) and `docs/launch/PROGRAMME_END_TO_END.md` (owner-directed programme since
> 2026-07-30)**; stack migration is governed by `docs/PROJECT_PHOENIX.md` v4.0.3 and
> `CLAUDE.md`. In particular, **§7.1 below ("Canonical production: Cloud Run") is
> superseded** — see [§19](#19-2026-08-25-delta) for the resolved decision and a full
> reconciliation. Read §19 first if you only have a few minutes.

---

## Table of contents

1. [Executive summary](#1-executive-summary)
2. [Business context](#2-business-context)
3. [Product scope](#3-product-scope)
4. [System architecture](#4-system-architecture)
5. [Repository and codebase map](#5-repository-and-codebase-map)
6. [Environments and configuration](#6-environments-and-configuration)
7. [Deployment and CI/CD](#7-deployment-and-cicd)
8. [Database and migrations](#8-database-and-migrations)
9. [Integrations](#9-integrations)
10. [Security and compliance](#10-security-and-compliance)
11. [Testing and quality](#11-testing-and-quality)
12. [Phase 2 program (LitStream / GCP cutover)](#12-phase-2-program-litstream--gcp-cutover)
13. [Current status and blockers](#13-current-status-and-blockers)
14. [RICEF summary (Requirements → Forms)](#14-ricef-summary-requirements--forms)
15. [Execution roadmap](#15-execution-roadmap)
16. [GitHub backlog (issues and PRs)](#16-github-backlog-issues-and-prs)
17. [Operator quick start](#17-operator-quick-start)
18. [Glossary](#18-glossary)

---

## 1. Executive summary

**MANGU Publishers** is a digital publishing platform (“Netflix for books”): readers discover and buy books, read in-browser, authors submit manuscripts, partners manage catalogs/orders, and admins operate the marketplace.

**Stack:** Next.js 14 (App Router, standalone output), React 18, TypeScript, Tailwind, Supabase (auth + Postgres + storage), Stripe, optional OpenAI (Resonance recommendations) and Resend (email).

**Program status (May 2026):**

| Area                                                 | Status                                                                                     |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Application code (Phase 1 MVP)                       | Largely complete                                                                           |
| Local build (type-check, lint, 12 unit tests, build) | Passes when env is valid                                                                   |
| GitHub CI                                            | Configured; requires repo secrets for prerender                                            |
| Canonical production                                 | **Cloud Run** via `cloudbuild.yaml` ([CANONICAL_PRODUCTION.md](./CANONICAL_PRODUCTION.md)) |
| GCP production                                       | Project `delta-wonder-488420-i3`; secrets + Cloud Run deploy still operator-dependent      |
| Phase 2 handoff (M0–M7b)                             | **NO-GO** — milestones and RACI not signed                                                 |
| Open engineering issues                              | #65–#72 (except #70 closed)                                                                |

**What blocks launch today:** Real credentials in `.env.local` / GCP Secret Manager, Supabase migrations applied to production DB, Stripe webhook on production URL, and manual QA of auth/payments/admin.

---

## 2. Business context

### 2.1 Vision

Modernize reading and democratize publishing by connecting readers, indie authors, and institutional partners in one web application—without proprietary hardware.

### 2.2 Differentiators

- **Resonance Engine:** AI embeddings for semantic book recommendations (Phase 2+; needs `OPENAI_API_KEY`).
- **Portals:** Separate experiences for readers, authors, partners, and admins.
- **Direct-to-consumer:** Stripe checkout; no walled-garden device.

### 2.3 Personas

| Persona          | Role    | Primary goals                               |
| ---------------- | ------- | ------------------------------------------- |
| The Enthusiast   | Reader  | Discover, read across devices, track habits |
| The Indie Author | Author  | Publish, earn transparently, reach audience |
| The Librarian    | Partner | Institutional content, ARC requests         |
| The Curator      | Admin   | Quality, disputes, revenue oversight        |

### 2.4 Success metrics (launch-grade)

- Custom domain loads over HTTPS; deep links work.
- `GET /api/health` returns HTTP 200 with DB/auth checks passing.
- No server secrets in client bundle or public logs.
- Stripe checkout and webhooks process test/live payments correctly.
- RBAC blocks unauthorized `/admin`, `/author`, `/partner` access.

---

## 3. Product scope

### 3.1 Phase 1 — MVP (implemented in codebase)

| Feature                              | Routes / modules                             | Services               |
| ------------------------------------ | -------------------------------------------- | ---------------------- |
| Auth (email/password, reset)         | `app/(auth)/*`                               | Supabase Auth          |
| Marketplace (browse, search, detail) | `app/(consumer)/books`, `genres`, `discover` | Supabase DB            |
| Reading + progress                   | `app/(consumer)/library`, reading flows      | Supabase + storage     |
| Checkout                             | `app/checkout`, `app/api/checkout`           | Stripe                 |
| Author portal                        | `app/(portals)/author/*`                     | Supabase               |
| Partner portal                       | `app/(portals)/partner/*`                    | Supabase               |
| Admin                                | `app/admin/*`                                | Supabase + health APIs |
| Webhooks                             | `app/api/webhook`                            | Stripe                 |

### 3.2 Phase 2 — Growth (partial / planned)

| Feature                                  | Status                                 |
| ---------------------------------------- | -------------------------------------- |
| Social (reviews, follows)                | Migration exists; UI partial           |
| AI recommendations                       | API routes exist; needs OpenAI in prod |
| Email notifications                      | Code exists; needs Resend              |
| Audiobooks                               | Not built                              |
| Custom domain + Firebase edge + full ops | Phase 2 doc package M0–M7b             |

See [FEATURE_PHASES.md](./FEATURE_PHASES.md) and [BRD.md](./BRD.md) for full FR lists.

---

## 4. System architecture

```mermaid
flowchart TB
  subgraph clients [Clients]
    Browser[Web browser]
  end
  subgraph vercel_optional [Optional Vercel]
    VercelHost[Vercel hosting]
  end
  subgraph gcp_primary [Canonical GCP]
    Firebase[Firebase Hosting edge optional]
    CloudRun[Cloud Run mangu-publishers]
    CloudBuild[Cloud Build]
    SecretMgr[Secret Manager]
  end
  subgraph data [Data and SaaS]
    Supabase[(Supabase Postgres Auth Storage)]
    Stripe[Stripe]
    OpenAI[OpenAI]
    Resend[Resend]
  end
  Browser --> Firebase
  Browser --> VercelHost
  Firebase --> CloudRun
  VercelHost --> Supabase
  CloudRun --> Supabase
  CloudRun --> Stripe
  CloudRun --> OpenAI
  CloudRun --> Resend
  CloudBuild --> CloudRun
  SecretMgr --> CloudRun
```

### 4.1 Request path (Cloud Run)

1. User hits HTTPS (custom domain or Cloud Run URL).
2. Next.js standalone Node server handles SSR/API.
3. `middleware.ts` enforces Supabase session + role routes.
4. Server components / API routes call Supabase (anon or service role) or Stripe.

### 4.2 API surface

| Endpoint                | Purpose                                 |
| ----------------------- | --------------------------------------- |
| `GET /api/health`       | Env, DB, auth, Stripe, migration checks |
| `POST /api/checkout`    | Stripe Checkout session                 |
| `POST /api/webhook`     | Stripe events (requires webhook secret) |
| `POST /api/upload`      | File upload                             |
| `GET/POST /api/session` | Session helpers                         |
| `/api/analytics/*`      | Analytics                               |
| `/api/resonance/*`      | Embeddings / recommendations            |
| `app/(auth)/callback`   | OAuth callback                          |

### 4.3 Auth and roles

- **Middleware:** [`middleware.ts`](../middleware.ts) — SSR cookies via `@supabase/ssr`.
- **Roles:** reader (default), author, partner, admin — enforced on portal and admin paths.
- **Profile creation:** Trigger migration `20260121000000_profile_trigger.sql`.

---

## 5. Repository and codebase map

### 5.1 Top-level layout

| Path                   | Contents                                                               |
| ---------------------- | ---------------------------------------------------------------------- |
| `app/`                 | Next.js App Router (route groups, pages, API)                          |
| `components/`          | UI (shadcn `ui/`), domain components (~66 files)                       |
| `lib/`                 | Actions, services, Supabase/Stripe clients, utils (~47 modules)        |
| `supabase/migrations/` | 12 SQL migrations (Jan 2026)                                           |
| `tests/unit/`          | Jest (3 suites, 12 tests)                                              |
| `tests/e2e/`           | Playwright (`purchase-flow.spec.ts`; full purchase test commented out) |
| `scripts/`             | validate-env, migrations, seed, GCP verify/sync, bundle-migrations     |
| `docs/`                | Deployment, BRD, Phase 2 runbooks, this document                       |
| `.github/workflows/`   | `ci.yml`, `admin-setup.yml`, `bug-to-issue.yml`                        |
| `cloudbuild.yaml`      | Canonical production pipeline                                          |
| `Dockerfile`           | Node 22 Alpine, standalone                                             |

### 5.2 Route groups

| Group          | Path prefix          | Access                 |
| -------------- | -------------------- | ---------------------- |
| Consumer       | `(consumer)/`        | Public + authenticated |
| Auth           | `(auth)/`            | Public                 |
| Author portal  | `(portals)/author/`  | author, admin          |
| Partner portal | `(portals)/partner/` | partner, admin         |
| Admin          | `admin/`             | admin                  |
| Checkout       | `checkout/`          | authenticated          |

### 5.3 Known code TODOs (non-blocking for planning)

| Item                            | File                                         |
| ------------------------------- | -------------------------------------------- |
| Growth rate hardcoded `0`       | `components/analytics/AnalyticsOverview.tsx` |
| File hash dedup not implemented | `lib/actions/upload.ts`                      |
| Duplicate ErrorBoundary         | `components/common/` vs `components/shared/` |

---

## 6. Environments and configuration

### 6.1 Environment variable matrix

| Variable                             | Class  | Local `.env.local` | GitHub Actions | GCP Secret Manager          | Cloud Build `_SUBST`                  |
| ------------------------------------ | ------ | ------------------ | -------------- | --------------------------- | ------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`           | Public | Required           | Secret         | —                           | `_NEXT_PUBLIC_SUPABASE_URL`           |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`      | Public | Required           | Secret         | —                           | `_NEXT_PUBLIC_SUPABASE_ANON_KEY`      |
| `SUPABASE_SERVICE_ROLE_KEY`          | Secret | Required           | Secret         | `supabase-service-role-key` | `--set-secrets`                       |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Public | Payments           | Secret         | —                           | `_NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` |
| `STRIPE_SECRET_KEY`                  | Secret | Payments           | —              | `stripe-secret-key`         | `--set-secrets`                       |
| `STRIPE_WEBHOOK_SECRET`              | Secret | Webhooks           | —              | `stripe-webhook-secret`     | `--set-secrets`                       |
| `NEXT_PUBLIC_SITE_URL`               | Public | Recommended        | Secret         | —                           | `_NEXT_PUBLIC_SITE_URL`               |
| `OPENAI_API_KEY`                     | Secret | Optional           | —              | `openai-api-key`            | `--set-secrets`                       |
| `RESEND_API_KEY`                     | Secret | Optional           | —              | `resend-api-key`            | `--set-secrets`                       |
| `USE_MOCKS`                          | Flag   | Dev/CI             | `true` in CI   | —                           | —                                     |

**Validation:** `npm run dev` runs `scripts/validate-env.ts` → requires 3 Supabase vars minimum.

**Doc note:** `.env.local.example` labels Stripe as Phase 1 required; runtime validation treats Stripe as optional until you test payments.

### 6.2 Where to get values

| Service            | URL                                                   |
| ------------------ | ----------------------------------------------------- |
| Supabase API keys  | https://supabase.com/dashboard/project/_/settings/api |
| Stripe keys        | https://dashboard.stripe.com/test/apikeys             |
| Stripe webhooks    | https://dashboard.stripe.com/webhooks                 |
| GitHub secrets     | Repo → Settings → Secrets and variables → Actions     |
| GCP Secret Manager | Console → Security → Secret Manager                   |
| OpenAI             | https://platform.openai.com/api-keys                  |
| Resend             | https://resend.com/api-keys                           |

### 6.3 Phase 2 intake (non-secret)

File: `docs/phase2/_intake/environment.local.sh` (gitignored). Template: `environment.example.sh`. Worksheet: [FIELDS_TO_GATHER.md](./phase2/_intake/FIELDS_TO_GATHER.md).

| Field           | Example / note                            |
| --------------- | ----------------------------------------- |
| `PROJECT_ID`    | `delta-wonder-488420-i3` (seeded locally) |
| `REGION`        | `us-central1`                             |
| `SERVICE_NAME`  | `mangu-publishers`                        |
| `CUSTOM_DOMAIN` | hostname only, no `https://`              |
| Sample slugs    | book/author/category for P0 probes        |

---

## 7. Deployment and CI/CD

### 7.1 Canonical production: Cloud Run

**Decision:** [CANONICAL_PRODUCTION.md](./CANONICAL_PRODUCTION.md) — GitHub issue #70 closed.

**Pipeline:** [cloudbuild.yaml](../cloudbuild.yaml)

1. `npm ci`
2. lint + type-check
3. `npm run build`
4. secret-audit (static bundle scan)
5. Docker build + push (`:SHORT_SHA`, `:main`)
6. `gcloud run deploy` with startup/liveness probes on `/api/health`
7. verify-deploy

**Runtime secrets (Secret Manager names):**

- `supabase-service-role-key`
- `stripe-secret-key`
- `stripe-webhook-secret`
- `resend-api-key`
- `openai-api-key`

**Operator scripts:**

```bash
gcloud auth login
./scripts/sync-gcp-secrets-from-env.sh   # from .env.local
./scripts/verify-gcp-production.sh       # secrets + health
```

### 7.2 Secondary: GitHub Actions → Vercel

[`.github/workflows/ci.yml`](../.github/workflows/ci.yml):

- **On PR / push to `main`:** type-check, lint, test, build (needs Supabase secrets for build).
- **Deploy job:** Only if `VERCEL_TOKEN` is set; treats Vercel as optional/staging.

### 7.3 Legacy: AWS Amplify

[`amplify.yml`](../amplify.yml), [AMPLIFY_READY.md](../AMPLIFY_READY.md) — no longer recommended for new releases.

### 7.4 CI/CD comparison

| Path           | Node     | Tests in pipeline             | Production?         |
| -------------- | -------- | ----------------------------- | ------------------- |
| Cloud Build    | 20       | lint, type-check, build       | **Yes (canonical)** |
| GitHub Actions | 20       | lint, type-check, test, build | Vercel optional     |
| Amplify        | unpinned | build only                    | Legacy              |

---

## 8. Database and migrations

### 8.1 Migration files (apply in order)

1. `20260116000000_initial_schema.sql` — profiles, authors, books, genres, core schema
2. `20260117000000_analytics_events.sql`
3. `20260117000007_storage_policies.sql` (no-op stub; real policies in `20260117000006_storage_policies.sql`)
4. `20260117000001_analytics_sessions.sql`
5. `20260117000002_book_stats_materialized.sql`
6. `20260117000003_revenue_tracking.sql`
7. `20260117000004_author_payouts.sql`
8. `20260117000005_book_pricing.sql`
9. `20260118000000_critical_fixes.sql`
10. `20260120000006_performance_optimizations.sql`
11. `20260121000000_profile_trigger.sql`
12. `20260122000000_social_features.sql`

**Note:** There is no separate `create_books_table.sql`; books are in `initial_schema.sql`.

### 8.2 How to apply

| Method                           | When to use                                                    |
| -------------------------------- | -------------------------------------------------------------- |
| **Supabase SQL Editor**          | Recommended — run each file or use bundle                      |
| `./scripts/bundle-migrations.sh` | Print all SQL in order → paste into editor                     |
| `npm run db:migrate`             | Only if `exec_sql` RPC exists (usually not on hosted Supabase) |
| Supabase CLI `db push`           | If project linked via CLI                                      |

Full guide: [MIGRATIONS.md](./MIGRATIONS.md).

### 8.3 Seed and verify

```bash
npm run db:seed -- --create-profiles --minimal
npm run verify-rls
```

---

## 9. Integrations

### 9.1 Supabase

- Auth, Postgres, RLS, Storage.
- Clients: `lib/supabase/client.ts`, `server.ts`, `admin.ts`.
- Health check verifies connectivity and migration table when configured.

### 9.2 Stripe

- Checkout: `app/api/checkout`, client in `lib/stripe/`.
- Webhooks: `app/api/webhook` — **requires** `STRIPE_WEBHOOK_SECRET`.
- Local testing: Stripe CLI → [WEBHOOK_TESTING.md](./WEBHOOK_TESTING.md).
- Production: [STRIPE_WEBHOOK_PRODUCTION.md](./STRIPE_WEBHOOK_PRODUCTION.md).

### 9.3 OpenAI (Resonance)

- Routes under `app/api/resonance/`.
- Embeddings in seed script when `OPENAI_API_KEY` set.

### 9.4 Resend (email)

- `lib/email/send.ts` — throws if key missing when module loaded.

---

## 10. Security and compliance

| Control                       | Implementation                                               |
| ----------------------------- | ------------------------------------------------------------ |
| Secret hygiene                | `.gitignore` for `.env*`, `environment.local.sh`, `*.save`   |
| No secrets in `NEXT_PUBLIC_*` | Code review + cloudbuild secret-audit step                   |
| RLS                           | Supabase policies in migrations; `npm run verify-rls`        |
| RBAC                          | Middleware route guards                                      |
| Webhook verification          | Stripe HMAC                                                  |
| Security headers              | CSP, HSTS, X-Frame-Options in `next.config.js`               |
| Admin health exposure         | `/admin/health` shows config presence — restrict admin users |

**Risks (open):** Expand secret scanning ([#68](https://github.com/redinc23/my_publishing/issues/68)); pre-commit hooks ([#72](https://github.com/redinc23/my_publishing/issues/72)).

---

## 11. Testing and quality

| Layer      | Tool       | CI?              | Count                               |
| ---------- | ---------- | ---------------- | ----------------------------------- |
| Unit       | Jest       | Yes (`npm test`) | 12 tests, 3 suites                  |
| E2E        | Playwright | No               | 1 spec; purchase flow commented out |
| Type-check | `tsc`      | Yes              | strict                              |
| Lint       | ESLint     | Yes              | 0 warnings target                   |

**Manual QA checklist:** [OPERATOR_QA_LOG.md](./OPERATOR_QA_LOG.md) and [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md).

**Sanity before push:**

```bash
npm run type-check && npm run lint && npm test && npm run build
```

---

## 12. Phase 2 program (LitStream / GCP cutover)

**Purpose:** Move from dev-only to production custom domain, hardened container, Cloud Build E2E, monitoring, and formal handoff.

**Package:** [docs/phase2/README.md](./phase2/README.md)

### 12.1 Milestones

| ID  | Goal                       |
| --- | -------------------------- |
| M0  | Pre-flight setup           |
| M1  | Local security hardening   |
| M2  | Build pipeline scripts     |
| M3  | Runtime container          |
| M4  | GCP foundation             |
| M5  | Cloud Build end-to-end     |
| M6  | Firebase hosting + domain  |
| M7a | Pre-cutover guardrails     |
| M7b | Post-cutover stabilization |

### 12.2 Handoff gates (automatic NO-GO if)

- Any milestone in [11-handoff-master-checklist.md](./phase2/11-handoff-master-checklist.md) still TODO without evidence URL.
- Any P0 test P0-1–P0-9 PENDING in [06-acceptance-and-test-protocol.md](./phase2/06-acceptance-and-test-protocol.md).
- RACI in [12-ownership-raci.md](./phase2/12-ownership-raci.md) still has `_(worksheet: …)_` placeholders.

### 12.3 P0 acceptance tests (summary)

Secret leakage, build-before-docker, deep links, security headers, health checks, Cloud Run config, CI security gates, content rebuild automation, observability + cost controls.

---

## 13. Current status and blockers

_Snapshot for planning; verify live state in GitHub/GCP dashboards._

### 13.1 Done (engineering / program)

| Item                    | Notes                                                      |
| ----------------------- | ---------------------------------------------------------- |
| PR #73 merged           | Node 20 CI, cloudbuild hardening, intake walkthrough       |
| GitHub Actions secrets  | 5 secrets configured (Supabase, Stripe pub, site URL)      |
| Canonical prod decision | Cloud Run; #70 closed                                      |
| Stale PR triage         | 15 agent PRs closed                                        |
| Migration docs          | Fixed order; `bundle-migrations.sh` added                  |
| GCP helper scripts      | `verify-gcp-production.sh`, `sync-gcp-secrets-from-env.sh` |

### 13.2 Still on you (cannot be completed by docs alone)

| Blocker             | Action                                                |
| ------------------- | ----------------------------------------------------- |
| Real `.env.local`   | Replace placeholder Supabase URL/keys from dashboard  |
| GCP auth            | `gcloud auth login` → sync secrets → deploy Cloud Run |
| Supabase migrations | SQL Editor or bundle script against real project      |
| Stripe prod webhook | Dashboard endpoint → Secret Manager                   |
| Phase 2 RACI names  | Fill `12-ownership-raci.md`                           |
| Browser QA          | Register, admin, checkout per OPERATOR_QA_LOG         |

### 13.3 Engineering backlog (GitHub issues)

| Issue                                                      | Priority | Topic                                   |
| ---------------------------------------------------------- | -------- | --------------------------------------- |
| [#65](https://github.com/redinc23/my_publishing/issues/65) | P1       | Rollback tags + runbook                 |
| [#66](https://github.com/redinc23/my_publishing/issues/66) | P1       | Health probes (partially in cloudbuild) |
| [#67](https://github.com/redinc23/my_publishing/issues/67) | P1       | Migration automation                    |
| [#68](https://github.com/redinc23/my_publishing/issues/68) | P2       | Secret scanning                         |
| [#69](https://github.com/redinc23/my_publishing/issues/69) | P2       | Duplicate build in Cloud Build          |
| [#71](https://github.com/redinc23/my_publishing/issues/71) | P3       | Repo rename                             |
| [#72](https://github.com/redinc23/my_publishing/issues/72) | P3       | Pre-commit hooks                        |

---

## 14. RICEF summary (Requirements → Forms)

### R — Requirements

- **Business:** BRD Phase 1 MVP + Phase 2 growth ([BRD.md](./BRD.md)).
- **Technical:** Node 22, standalone build, health endpoint, RBAC, webhook verification, 12 migrations ([Master RICEF](../.cursor/plans/mangu_publishers_master_ricef.md)).
- **Decisions:** Cloud Run canonical (#70 closed); repo rename #71 open; Phase 2 cutover when RACI filled.

### I — Inputs

- Env matrix (§6.1), GCP intake (§6.3), third-party accounts (Supabase, Stripe, GCP).

### C — Controls

- CI gates: type-check, lint, test, build.
- Security: gitignore, RLS, middleware, secret scan in Cloud Build.
- Phase 2 NO-GO rules (§12.2).

### E — Execution

| Wave | Focus                                              |
| ---- | -------------------------------------------------- |
| 0    | `.env.local` + GitHub secrets                      |
| 1    | Merge hardening / green `main` CI                  |
| 2    | GCP secrets, Cloud Run, migrations, Stripe webhook |
| 3    | Phase 2 M0–M7b + signoffs                          |

### F — Forms (deliverables)

| Deliverable     | Evidence                                                                  |
| --------------- | ------------------------------------------------------------------------- |
| Healthy CI      | Green GitHub Actions on `main`                                            |
| Health API      | `/api/health` JSON on prod                                                |
| Migration state | Supabase tables + `schema_migrations` if used                             |
| Phase 2 signoff | [14-evidence-and-signoff-log.md](./phase2/14-evidence-and-signoff-log.md) |
| Manual QA       | [OPERATOR_QA_LOG.md](./OPERATOR_QA_LOG.md)                                |

---

## 15. Execution roadmap

### Week 1 — Unblock and align

1. Fix `.env.local` with real Supabase (and Stripe if testing payments).
2. Confirm GitHub secrets match (re-sync if you rotate keys).
3. `gcloud auth login` → `./scripts/sync-gcp-secrets-from-env.sh` → `./scripts/verify-gcp-production.sh`.
4. Apply migrations ([MIGRATIONS.md](./MIGRATIONS.md)).
5. Configure Stripe webhook ([STRIPE_WEBHOOK_PRODUCTION.md](./STRIPE_WEBHOOK_PRODUCTION.md)).

### Week 2 — Product confidence

6. Manual QA (auth, admin, checkout).
7. Seed data if needed.
8. Trigger Cloud Build on `main`; confirm Cloud Run revision.

### Month 1 — Hardening and Phase 2

9. Close or schedule #65–#69, #72.
10. Fill Phase 2 intake + RACI if pursuing cutover.
11. Execute M0–M5 per [05-milestone-implementation-plan.md](./phase2/05-milestone-implementation-plan.md).

---

## 16. GitHub backlog (issues and PRs)

### Open issues

See §13.3 (#65–#72; #70 closed).

### Pull requests

- **#73:** Merged (`chore/full-project-hardening`).
- **Stale agent PRs:** Closed per triage (#48, #45, #39, #31, #30, #29, #28, #26, #23, #12, #10, #9, #8, #5, #1).
- **Remote branches:** Many `origin/copilot/*` and `origin/cursor/*` may remain — prune when convenient.

---

## 17. Operator quick start

**Detailed clicks:** [.cursor/plans/operator_walkthrough_supplement.md](../.cursor/plans/operator_walkthrough_supplement.md)

```bash
# 1) Local
cp .env.local.example .env.local
# Edit Supabase + optional Stripe

# 2) Verify
npm run type-check && npm run lint && npm test && npm run build
npm run dev
# Open http://localhost:3000/api/health

# 3) Migrations
./scripts/bundle-migrations.sh > /tmp/mangu-migrations.sql
# Paste into Supabase SQL Editor

# 4) GCP (after auth)
gcloud auth login
./scripts/sync-gcp-secrets-from-env.sh
./scripts/verify-gcp-production.sh
```

---

## 18. Glossary

| Term                  | Meaning                                                                  |
| --------------------- | ------------------------------------------------------------------------ |
| **RICEF**             | Requirements, Inputs, Controls, Execution, Forms — program doc structure |
| **Resonance Engine**  | OpenAI embedding-based recommendations                                   |
| **RLS**               | Row Level Security (Supabase Postgres)                                   |
| **Standalone output** | Next.js build mode for Docker/Cloud Run                                  |
| **Phase 2**           | GCP/LitStream production hardening and cutover program                   |
| **P0 test**           | Launch-blocking acceptance test in Phase 2 protocol                      |
| **NO-GO**             | Handoff blocked until checklist/RACI complete                            |

---

## 19. 2026-08-25 delta

Added by an overnight autonomous session per owner request ("close out issues/PRs, run
the full audit, compile questions"). This section **reconciles** the rest of this document
against repo/live state as of 2026-08-25 ~22:00 UTC — it does not rewrite anything above.
Per this repo's own rule (`CLAUDE.md` §13, `phoenix-contract` skill): amend in place, don't
improvise silently.

### 19.1 Status table — this doc (v1.0, 2026-05-19) vs. verified 2026-08-25

| Claim in this doc                      | 2026-08-25 reality                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Evidence                                                                 |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| §7.1 "Canonical production: Cloud Run" | **Superseded.** Vercel is sole canonical platform (ADR-001, Option B, **ACCEPTED** 2026-07-18). `cloudbuild.yaml`/Cloud Run retained only as a legacy/emergency surface until the Phase 15 DNS cutover, then retired.                                                                                                                                                                                                                                                                                                       | `docs/adr/ADR-001-canonical-platform.md`, `docs/CANONICAL_PRODUCTION.md` |
| §13/§16 issues #65–#72, PR #73         | Renumbered. **11 open issues** tonight, all `[P0-xxx]`-tagged (#187, #191–#195, #198, #199, #203, #205, #209), mapped to `NEXT_GO.md` §5 P0 backlog, not this doc's tracker.                                                                                                                                                                                                                                                                                                                                                | live `list_issues`, `NEXT_GO.md` §5                                      |
| §7.1 production readiness              | **Confirmed healthy tonight** — Vercel project `manguprojectz`, latest deployment `dpl_DPGSsDBKAcp3QEmynCwoCToqFXKH` **READY**, target `production`, on `main@0bb5187`; **zero runtime errors in the trailing 24h**. This session's sandbox network policy blocks direct HTTP probes to `mangu-publishers.com` (egress allowlist), so `/api/health?ready=1` was not independently re-curled tonight — last recorded readiness evidence is the 2026-08-14 NEXT_GO refresh (apex 308→www confirmed, Supabase ACTIVE_HEALTHY). | Vercel MCP `get_project`/`list_deployments`/`get_runtime_errors`         |
| N/A — new since this doc               | **Governance gate state (`docs/NEXT_GO.md` §6, last refreshed 2026-08-14, v1.2.8):** 1 of 13 hard gates TRUE (G13 — authority doc committed), G12 PARTIAL, **G1–G11 all FALSE**. Status remains **NO-GO**. Nothing in tonight's session changed a gate — gates require human-witnessed evidence (CCR-014), not agent claims.                                                                                                                                                                                                | `docs/NEXT_GO.md` §6                                                     |
| N/A                                    | **Two governance programmes now exist and this doc predates both:** Project Phoenix (Supabase→Better Auth/MongoDB/Vercel Blob, dual-run behind `AUTH_PROVIDER`/`DATABASE_PROVIDER`/`STORAGE_PROVIDER` flags, default `supabase` in prod) and the NEXT_GO launch-gate framework. See `.claude/skills/mangu-navigator/SKILL.md` for the current mental model.                                                                                                                                                                 | `docs/PROJECT_PHOENIX.md` v4.0.3, `CLAUDE.md`                            |

### 19.2 Host conflict — resolved, not reopened

The brief that produced this delta asked to "pick ONE production host… Do not leave two
canonicals." **That decision was already made and signed on 2026-07-18** (ADR-001, Option
B — Vercel), five weeks before this delta. Evidence it stuck: `docs/CANONICAL_PRODUCTION.md`
carries the Vercel checklist as primary and the Cloud Run path explicitly marked
"SUPERSEDED — do not use for GO"; tonight's Vercel API check shows `main` deploying to
Vercel automatically on every merge (11 of the last dozen deployments are Phoenix/hardening
PR heads, auto-built by the Vercel↔GitHub integration). Re-litigating this would contradict
a signed ADR for no new evidence. If there's a reason to revisit it, that's a decision for
the owner, not a default action for an agent session — flagged in §19.6.

### 19.3 Competitive landscape (deliverable C)

_(Netflix-for-books comparison: Kindle/KU, Kobo, Apple Books, Google Play Books, Everand,
Libro.fm, Wattpad, Radish, Bookshop.org, D2D, Gumroad — researched 2026-08-25.)_

| Competitor          | Model                                                                 | Reading UX                                               | Author/Publisher onboarding                                         | Note                                                                                                                       |
| ------------------- | --------------------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Kindle/Amazon       | Hybrid: à la carte + Kindle Unlimited (~$11.99–13.99/mo, 20-book cap) | App + dedicated e-readers, strong offline/sync           | KDP self-publish, free, 35–70% royalty; KU needs 90-day exclusivity | Dominant distribution + device lock-in                                                                                     |
| Kobo (Rakuten)      | Hybrid: purchase + Kobo Plus ($7.99–9.99/mo)                          | E-readers + app, strong offline, no exclusivity required | Non-exclusive via aggregators (D2D, Smashwords)                     | Amazon alternative for "wide" authors                                                                                      |
| Apple Books         | À la carte only                                                       | Native app, offline, Apple ecosystem                     | Free, flat 70% royalty at any price, no exclusivity                 | Simplest royalty math; weak discovery off-Apple                                                                            |
| Google Play Books   | À la carte only                                                       | Web + Android/iOS, offline                               | Free, ~70% split, no exclusivity                                    | Broad reach, low destination mindshare                                                                                     |
| Everand (ex-Scribd) | Subscription → **credit-based** ($11.99–28.99/mo)                     | Web + app, offline                                       | Publisher/aggregator-supplied, not self-serve                       | Direct precedent for "Netflix for books" — its retreat from unlimited to credits is a warning sign for flat-rate economics |
| Libro.fm            | Subscription credits ($14.99/mo)                                      | Audiobook-only app                                       | Publisher/distributor supplied                                      | Differentiates on indie-bookstore revenue share                                                                            |
| Wattpad             | Freemium + Coins micropayments                                        | Web + app, serialized format                             | Fully open self-publish                                             | UGC/attention competitor, not a bookstore                                                                                  |
| Radish              | Coins/serialized fiction                                              | —                                                        | —                                                                   | **Shut down Dec 2025** — cautionary tale for coin/micropayment models                                                      |
| Bookshop.org        | À la carte, affiliate/mission-driven                                  | No proprietary reader; fulfills via partners             | Retail storefront via D2D (2026)                                    | Purchase-channel competitor, not UX                                                                                        |
| Draft2Digital       | B2B distributor, free to list, 10% commission                         | N/A — fan-out to other stores                            | Self-serve upload once → many storefronts                           | Study for author-upload UX, not a storefront competitor                                                                    |
| Gumroad             | À la carte, no subscription, 10%+$0.50/txn                            | No reader — raw file download, no DRM                    | Fully open, instant, zero vetting                                   | Frictionless-checkout UX benchmark for the 14-day test-checkout goal                                                       |

**Confirmed from code, not assumed:** `lib/stripe/server.ts` sets `mode: 'payment'` — Mangu
is currently one-time-purchase only, no subscription mode wired. Given Everand's own
retreat from flat-rate-unlimited and Radish's shutdown, that's a defensible launch posture,
not a gap to rush-fix. Differentiation: no competitor above combines curated
browse+buy+in-browser-read+author-submit+partner-catalog+admin in one owned stack — Mangu's
closest analog is Apple Books' simplicity plus Bookshop.org's curation, not the subscription
incumbents. Near-term implication: none of this blocks the 14-day goal below; Gumroad's
single-item checkout is the closer UX reference for that narrow path.

### 19.4 14-day wins — reconciled, not reinvented

The brief's three 14-day wins are **already the tracked critical path**, not a new plan:

1. _One cleared title, test-mode checkout, progress save_ → this is `docs/launch/
PROGRAMME_END_TO_END.md` H0-4 (name 3–6 launch titles + confirm rights, owner-only) →
   H0-5 (admin publish round trip) → H0-1/H0-2 (Stripe dashboard + one real
   purchase/refund). **Nothing code-side blocks this** — Phase 1/2 of the July programme
   (admin write/read split, provider-aware catalog) is merged; the gap is real content and
   owner console actions, not engineering.
2. _Single canonical deploy checklist a human can run_ → already exists:
   `docs/CANONICAL_PRODUCTION.md` "Operator cutover checklist," current since 2026-07-18.
3. _P0 issue milestone; rest parked_ → already the case. All 11 open issues are P0-tagged
   and the launch freeze (#209) already parks everything else (`NEXT_GO.md` §7/§8, Launch
   Scope table). No new milestone needed — the freeze already **is** the milestone.

### 19.5 Risks (deliverable B) — verified tonight where possible

- **RLS / security posture:** live Supabase advisor check (project `tkzvikozrcynhwsqtkqp`,
  2026-08-25) shows **2 ERROR-level `SECURITY DEFINER` view findings**
  (`author_manuscript_feedback`, `author_manuscript_status_history`) — these are already
  known and already have a fix drafted: `docs/launch/PROGRAMME_END_TO_END.md` agent charter
  **A6 HARDEN**, PR #382, deliberately marked "DRAFT, post-launch, DO-NOT-MERGE during
  freeze." Not a new finding — confirmed still accurate, still correctly deferred. Also
  present: `auth_leaked_password_protection` WARN (matches open `HUMAN_TASKS.md` H1.4,
  dashboard-only fix) and a long tail of INFO-level "RLS enabled, no policy" on
  analytics/newsletter tables (low severity, no known exploit path, not actioned tonight).
- **Webhook signing/idempotency:** already addressed by design — unique index on
  `orders.stripe_payment_intent_id`, upsert-on-conflict, 200 on duplicate delivery (Phoenix
  contract §5, `stripe-webhook-mangu` skill). PR #396 (open tonight) extends the dual-run
  session check onto the checkout money-path API specifically so this holds under
  `AUTH_PROVIDER=better-auth` too.
- **Prerender secrets:** not independently re-verified tonight (would require reading
  Vercel env values, which this session should not do — CCR-009 secret hygiene). No new
  signal either way; treat `docs/SECRET_INVENTORY.md` as current.
- **Dual-host drift:** resolved per §19.2 — one canonical host, signed.
- **Rights on titles:** **open question, not answerable by an agent** — see §19.6.
- **InDesign/production binaries in git:** confirmed present — `Kimi_Agent_Book prep for
InDesign.zip` (~4 MB) and `We_Are_Wolf_InDesign_Production_Guide.docx`(+`.pdf`) are
  tracked in the repo. Flagged, not touched: whether these belong in git history (vs. Drive
  / Git LFS / a private asset bucket) and whether "We Are Wolf" is a cleared launch title
  are owner decisions — see §19.6.

### 19.6 Compiled open questions for the owner

Numbered so they're easy to answer piecemeal; none of these blocked tonight's other work.

1. **We Are Wolf / Kimi Agent Book** — are either of these the "one cleared title" for the
   14-day win (H0-4)? Rights confirmed? Should the InDesign `.zip`/`.docx` production files
   move out of git (Drive, LFS, or a private bucket) regardless of which title launches first?
2. **PR #382 (A6 HARDEN — `security_invoker` fix for the 2 ERROR-level Supabase advisor
   findings)** is marked post-launch/do-not-merge. Given these are ERROR (not WARN) severity
   and the fix already exists and is tested against a branch DB per its own charter — worth
   reconsidering for pre-launch merge, or is the post-launch hold intentional for a reason
   this session doesn't have context on (e.g. avoiding freeze-window review load)?
3. **Steward auto-approve dial** (`HUMAN_TASKS.md` A0.2, `STEWARD_AUTO_APPROVE`): currently
   unset, so every PR still needs a human clicking both "approve" and the
   `steward-approved` label. With 7 CI-clean Phoenix/hardening drafts sitting in the queue
   most nights, is it time to turn this dial on, or is manual review-per-PR still preferred
   at this stage?
4. **85 open Dependabot security alerts** were logged in a past session
   (`docs/launch/HUMAN_ACTIONS.md`-adjacent commit, 2026-08-21) but there's no
   Dependabot-alert-reading tool available to this session's GitHub MCP connection to
   re-verify the current count or severity mix tonight. Worth an explicit triage pass (a
   scheduled agent session with the right GitHub App permissions), separate from the 10
   open Dependabot **PRs** already triaged tonight (§19.7)?
5. This document (v1.0) predates Phoenix and NEXT_GO by two months and duplicates content
   now owned by `docs/NEXT_GO.md` / `docs/launch/PROGRAMME_END_TO_END.md` /
   `docs/PROJECT_PHOENIX.md`. Keep it alive as a historical/BRD-style reference (current
   plan, per §7 rule about not deleting things silently), or fold its still-useful parts
   (personas, differentiators, RICEF) into the live docs and mark it SUPERSEDED like
   `docs/LAUNCH_CHECKLIST.md` / `docs/LAUNCH_NOW.md` already are?

### 19.7 Open PR/issue queue — see `HUMAN_TASKS.md`

Full triage of the 18 open PRs (7 Phoenix/hardening drafts, 10 Dependabot bumps, 1
explicitly post-launch-held) and 11 open P0 issues, run the same night, is recorded in
`HUMAN_TASKS.md` rather than duplicated here — that file is the one humans already check
for actionable items.

---

## Document history

| Version | Date       | Change                                                                                                                                                                                                              |
| ------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.0     | 2026-05-19 | Initial end-to-end merge of all planning artifacts                                                                                                                                                                  |
| 1.1     | 2026-08-25 | Added §19 delta (autonomous overnight session): supersession banner, host-decision reconciliation, competitive scan, 14-day-win reconciliation, verified risks, compiled owner questions. No prior content changed. |

**Maintainer:** Update this file when production URL, issue status, or Phase 2 milestones change.
