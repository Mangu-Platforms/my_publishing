# COMMAND_CENTER_SPEC — Mangu Publishers Command Center

> **Status: DRAFT — PROPOSED** · **Version:** v0.1.0 · **Date:** 2026-07-29
> **Proposed repo path:** `docs/COMMAND_CENTER_SPEC.md` (Brief §19 governance doc, missing at HEAD per Delta Report §3)
> **Build gate:** every external integration is **gated on owner-provisioned read-only tokens** — Delta Report §6 C8 and §9.10. Agents never handle new secrets without a human gate (CLAUDE.md rule 7).
> **Freeze:** launch freeze #209 ACTIVE. This spec is freeze class 1 (docs). **No Command Center build during the freeze beyond this spec**; build is Thaw-phase work (Delta Report §8 E11: "spec now, build Thaw").

## 1. Purpose and audience

- One RBAC-gated surface answering: is the platform healthy, deployable, and honest right now — across deployments, runtime health, data stores, auth, incidents, AI, security, content, and approvals (Master Brief §12; Appendix A "centralized command center").
- **Audience: admin role only.** Proposed route **`/admin/command-center`**, guarded like `/admin/health` today (`requireAdmin()` from `lib/middleware/auth` plus RBAC middleware) and additionally behind a `FEATURE_COMMAND_CENTER` flag following the `lib/flags.ts` P-057 pattern (flag off ⇒ honest unavailable page, hidden nav, API 404, no sitemap entry).
- Read-only observation deck: it renders evidence, it never mutates systems (§8).

## 2. Panel catalog (carried from Master Brief §12)

Status vocabulary: `red | amber | green | unknown` (§3). R/A/G rules are quoted from Brief §12. Freshness SLA (proposed) = max data age before the panel degrades itself to stale/`unknown`.

| # | Panel | Data source + integration | Freshness SLA | Red/amber/green rule (Brief §12) |
|---|---|---|---|---|
| 1 | Deployments | Vercel API (deployment, commit, branch, duration, environment); smoke tests via GitHub API (CI runs) | 60 s during deploy; 5 min steady | Red on failed production or health check; amber on stale preview |
| 2 | Application health | Internal: `/api/health?ready=1`, `/api/live`, route probes, latency, error rate (Sentry) | 60 s | Red on readiness fail; amber on SLO breach |
| 3 | Database | Atlas Admin API (read-only) + internal readiness `mongodb`/`database` checks; replication, connection saturation, migration state | 60 s | Red on unreachable or data mismatch |
| 4 | Storage | Internal probes: Vercel Blob upload/read success, migration counts, broken-asset checks | 5 min | Red on entitlement leak or failed migration |
| 5 | Authentication | Internal readiness `auth` check + auth-flow probe metrics (signup, verification, login, reset, session errors, provider state) | 5 min | Red on user lockout or cross-role access |
| 6 | Sentry / incidents | Sentry API (read-only): open critical issues, regressions, release correlation | 60 s | Red on unresolved P0/P1 |
| 7 | AI quality | Internal eval harness (E06+; does not exist yet): grounding, citation, refusal, eval score, feedback | Per eval run (daily) | Red when release threshold fails |
| 8 | AI operations | Internal AI gateway metrics (E06+): latency, token use, cost, fallback rate, rate limits | 5 min | Amber on budget trend; red on runaway cost |
| 9 | Security | GitHub API (secret-scan / Dependabot alerts, read-only) + internal audit log `lib/audit.ts`: suspicious access, agent permission drift | Daily + on event | Red on critical finding or permission bypass |
| 10 | Content pipeline | Internal data layer (`lib/data/*`): submissions, blocked releases, missing metadata/assets | 15 min | Amber on SLA breach; red on release blocker |
| 11 | Approvals | Internal approvals model (v2): pending deployments, agent writes, content, refunds (Stripe read-only for context), role changes | 60 s | Red when overdue high-severity approval |

**Degraded-source behavior (all panels, non-negotiable):** when a source is unreachable or past its SLA, the panel shows the **last known data with its `freshness_ts` and an explicit `stale` marker**, and status falls to `unknown` (or holds a prior red). Panels **never fabricate, extrapolate, or default to green**. A panel with no source yet (e.g. AI quality pre-E06) renders `unknown` with an honest "not yet instrumented" note — the same honesty contract as the `lib/flags.ts` flag-off rule.

## 3. Dashboard schema (proposed)

Single JSON document from a proposed internal endpoint `GET /api/admin/command-center` (RBAC + flag gated; `Cache-Control: no-store` like `/api/health`).

```json
{
  "generated_at": "2026-07-29T00:00:00Z",
  "overall": "red | amber | green | unknown",
  "panels": [
    {
      "id": "deployments",
      "title": "Deployments",
      "status": "red | amber | green | unknown",
      "freshness_ts": "2026-07-29T00:00:00Z",
      "stale": false,
      "metrics": [
        { "key": "prod_deploy_state", "value": "READY", "unit": null, "threshold": null }
      ],
      "alerts": [
        { "severity": "red", "message": "Production health check failing", "since": "..." }
      ],
      "evidence_url": "https://vercel.com/..."
    }
  ]
}
```

- Status mapping from the existing health vocabulary: `pass → green`, `warn → amber`, `fail → red`, absent/stale → `unknown`.
- `overall` = worst panel status (red > amber > unknown > green).
- `evidence_url` links to the authoritative console or internal log view — every status must be traceable to evidence, mirroring the delta report's evidence-class discipline.

## 4. Existing precursors and gap to target (VERIFIED at HEAD `8246424`)

- **`app/admin/health/page.tsx` (`/admin/health`)** — server component behind `requireAdmin()`. Fetches `${NEXT_PUBLIC_SITE_URL}/api/health?ready=1` with `cache: 'no-store'` and renders: an Overall Status card (healthy/degraded/unhealthy → Pass/Warning/Fail badge) plus five check cards — Environment, Database (Supabase), Authentication (Supabase Auth), Migrations, Stripe — each with pass/fail/warn badge, message, and latency where provided; and a masked Environment Configuration card (Supabase URL / Stripe key prefixes; OPENAI/RESEND set-or-not). Refresh is a plain link back to the page (full reload; no polling). On fetch failure it synthesizes `unhealthy` with empty checks, so cards show "Checking…" / Unknown. **Known gap:** its `HealthCheck` interface omits the `mongodb` check the API returns, so Mongo status is silently not rendered.
- **`app/api/health/route.ts`** — bare `GET` = lightweight startup probe (always 200). `?ready=1` = full readiness: env validation, Supabase `profiles` query, `auth.getSession`, migrations table checks, config-only Stripe check (never `fail`), Mongo ping when `MONGODB_URI` is set. Provider-aware gating (`DATABASE_PROVIDER`): Mongo-primary ⇒ Atlas ping is the hard readiness gate; Supabase-primary ⇒ db/auth/migrations gate. 503 on failure; `no-store`; `force-dynamic`.
- **`app/api/live/route.ts`** — liveness probe: `{ status: "alive", timestamp }`, always 200.
- **`app/admin/dashboard/page.tsx`** — business stats via `getAdminDashboardStats()` (`lib/data/admin-dashboard`, dual-run data layer): total users/books/orders + recent activity, `AdminQueryError` fallback.
- **Sentry** — `sentry.client.config.ts` / `sentry.server.config.ts` / `sentry.edge.config.ts`, all initializing through `lib/sentry/shared-options` behind `isSentryEnabled()`.
- **Supporting seams** — `lib/flags.ts` flag registry, `lib/audit.ts` single audit writer, `lib/logger.ts`, `lib/rate-limit.ts` (Delta Report §2).

**Gap to target (Delta Report §4 E11):** existing surfaces partially cover panels 2–5 from one readiness payload. There is no aggregated Deployments / Sentry / AI / Security / Content-pipeline / Approvals view, no panel schema, no freshness tracking, no evidence links — and `docs/COMMAND_CENTER_SPEC.md` itself was missing; this document closes that last gap.

## 5. Integration credential matrix (H-gate — Delta Report §9.10)

All tokens **read-only** and **owner-provisioned per integration** (C8 human gate), stored via Vercel env / SECRET_INVENTORY — never created, pasted, or handled by agents.

| Service | Panels | Minimum scope (read-only) | Provisioned by |
|---|---|---|---|
| Vercel API | 1 | Project + deployments read | Owner |
| GitHub API | 1, 9 | Fine-grained PAT: Actions, Deployments, Issues/PRs, security alerts — read | Owner |
| MongoDB Atlas | 3 | Admin API read-only role (monitoring/metrics) | Owner |
| Sentry | 2, 6 | `org:read`, `project:read`, `event:read` | Owner |
| Stripe | 11 (context) | Restricted key, read-only resources only | Owner |
| Internal APIs | 2–5, 7–8, 10–11 | None new — existing admin-session RBAC | n/a |

## 6. Alerting

- Thresholds are exactly the §2 R/A/G rules — no second threshold system.
- Proposed policy: transition **into red** ⇒ immediate notification; **into amber** ⇒ daily digest; recovery notice on the same channel. All transitions written to the audit log (`lib/audit.ts`).
- **Notification channel: TBD** (owner decision; Brief Appendix A requires "team notifications"). No channel wired in v0.

## 7. Build phasing

| Phase | When (Delta Report §8) | Scope |
|---|---|---|
| **v0** | Thaw | Internal-only panels from existing endpoints — **no new tokens**: App health + Database + Auth from `/api/health?ready=1` and `/api/live` (including rendering the currently-dropped `mongodb` check), Content pipeline from `lib/data/*`; all other panels render honest `unknown`. Ship schema (§3), flag, route, audit events. |
| **v1** | Post C8 token provisioning | External read-only integrations: Vercel (Deployments), GitHub (CI + security), Atlas, Sentry, Stripe context. Freshness SLAs enforced. |
| **v2** | Post-GO / with E06+ | Approvals queue panel (requires internal approvals model); AI quality + AI operations panels as the E06 platform emits metrics. |

## 8. Non-goals

- **No write actions from the dashboard in v0/v1** — no redeploys, flag toggles, issue edits, refunds, or approval grants. v2 renders an approvals queue; acting on items stays in existing human workflows until separately specified.
- Not a public status page; admin-only.
- No autonomous remediation (that is E12, with its human merge gate — Delta Report §6 C4).
- No agent-side secret handling; no net-new data stores in v0.

## 9. Open decisions

| # | Decision | Owner |
|---|---|---|
| 1 | Provision the §5 read-only tokens (Delta Report §9.10) — gates v1 | Owner |
| 2 | Notification channel for §6 | Owner |
| 3 | Route: new `/admin/command-center` vs evolving `/admin/health` in place; fate of the old page | Owner + eng |
| 4 | Refresh mechanism: client polling vs Vercel cron snapshot + cache (serverless: no resident scheduler) | Eng proposal → owner |
| 5 | Snapshot retention: none vs persisted history for trends (net-new table — post-v0) | Owner |
| 6 | Ratify the proposed freshness SLAs in §2 | Owner |
