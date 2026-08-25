# ADR-001: Canonical Production Platform and DNS Authority

| Field         | Value                                                                                   |
| ------------- | --------------------------------------------------------------------------------------- |
| **Status**    | **ACCEPTED (Option B — Vercel)** — signed Phase 6 (P0-003); G9 pending cutover evidence |
| **Created**   | 2026-07-18 (Phase 1 / P0-019)                                                           |
| **Updated**   | 2026-07-18T05:48:00Z (operator decision: dump Cloud Run; stick with Vercel)             |
| **Deciders**  | Platform, Release Manager, Engineering (solo operator)                                  |
| **Hard gate** | G9 (ADR signed + monitors on canonical origin with production readiness)                |

> **Numbering note (2026-08-14):** This document is the sole **ADR-001**. The catalog-and-identity
> data-ownership ADR (PR #351, 2026-07-28) briefly also carried the number ADR-001 and is now
> [`docs/architecture/ADR-003-catalog-and-identity-data-ownership.md`](../architecture/ADR-003-catalog-and-identity-data-ownership.md)
> (`docs/launch/DEFINITION_OF_LAUNCH_COMPLETE.md` B11 / HA-C6).

## Context

Two production surfaces existed:

- **Cloud Run** — previously declared canonical in `docs/CANONICAL_PRODUCTION.md`; apex `mangu-publishers.com` still served by Google Frontend with `ready:true` as of 2026-07-18 (legacy surface during cutover).
- **Vercel** — `www.mangu-publishers.com` served by Vercel; project `manguprojectz`. As of 2026-07-18, Vercel readiness is **`ready:false`** (missing `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` / `STRIPE_SECRET_KEY` and dependent checks). That is a cutover blocker, not a reason to keep Cloud Run as authority.

Exactly one platform must own the canonical origin. Monitors (P0-007), Stripe webhook (G8), DNS/TLS (Phase 15), and rollback (G11) derive from this decision.

## Options

| Option                      | Description                                                   | Consequence sketch                                                                                                    |
| --------------------------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| **A — Cloud Run canonical** | Route apex + www to Cloud Run; Vercel preview-only            | Matches prior runbooks; rejected by operator 2026-07-18                                                               |
| **B — Vercel canonical**    | Keep Vercel serving; retire Cloud Run as production authority | Requires Vercel env promotion, apex DNS to Vercel, webhook/monitor retarget, Cloud Run docs/scripts marked superseded |
| **C — Documented split**    | Different surfaces per host                                   | Rejected — violates single-authority / exact-SHA (CCR-005)                                                            |

## Decision (ACCEPTED)

**Option B — Vercel is the sole canonical production platform.**

| Item                     | Value                                                                                                                                              |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Platform                 | Vercel                                                                                                                                             |
| Vercel project           | `manguprojectz` (team/account owning `www.mangu-publishers.com`)                                                                                   |
| Interim canonical origin | `https://www.mangu-publishers.com` (already on Vercel)                                                                                             |
| Final canonical origin   | `https://mangu-publishers.com` after apex DNS points at Vercel (Phase 15)                                                                          |
| Stripe webhook (target)  | `https://www.mangu-publishers.com/api/webhook` until apex cutover; then apex equivalent                                                            |
| Monitor / Lighthouse URL | `https://www.mangu-publishers.com` (retargeted with this acceptance)                                                                               |
| Cloud Run                | **Non-canonical / retire.** May remain live during transition; not a GO evidence target; do not deploy new production revisions there intending GO |
| Deploy path              | Vercel Git integration / dashboard deploy from `main` (Cloud Build → Cloud Run **superseded** for GO)                                              |

**G9 remains FALSE** until: (1) Vercel production has secrets such that `/api/health?ready=1` → `ready:true`, (2) monitors hit that origin green, (3) apex DNS is on Vercel (or interim `www` is explicitly accepted as the only production hostname with apex redirect).

## Consequences

- `docs/CANONICAL_PRODUCTION.md` rewritten for Vercel; Cloud Run checklist retained only as **SUPERSEDED / retirement** notes.
- Health-check and Lighthouse retargeted to `https://www.mangu-publishers.com`.
- Operator must set production env on Vercel (Stripe, Supabase, Upstash, site URL, webhook secret) — **current www is not readiness-green**.
- Phase 15: point apex A/AAAA/CNAME at Vercel; remove Google `216.239.*` Cloud Run mapping records from apex; optionally decommission Cloud Run service.
- Scripts `gcloud-build-submit.sh`, `verify-gcp-production.sh`, `grant-cloudrun-secret-access.sh`, `cloudbuild.yaml` are **non-canonical** for launch GO (may remain for historical/emergency use until deleted in a follow-up).
- Rollback for Vercel: redeploy previous Vercel deployment / promote prior deployment in the Vercel dashboard (CCR-012). Do **not** fail over to Cloud Run for GO evidence after cutover completes.

## Rollback (CCR-012) — Vercel

1. Vercel Dashboard → Project → Deployments → Promote the last known-good deployment to Production.
2. If DNS was changed and must revert mid-incident: restore prior Cloudflare records from a saved screenshot/export (take that export **before** apex cutover).

## Live evidence snapshot (2026-07-18 UTC)

| Target                                      | Observation                                                                                               |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `https://www.mangu-publishers.com/`         | HTTP 200; `server: Vercel` — **chosen interim canonical host**                                            |
| `www` `/api/health?ready=1`                 | HTTP 503; `ready:false` — missing Stripe env (and skipped DB/auth/migrations) — **cutover blocker**       |
| `https://manguprojectz.vercel.app/…ready=1` | Same: `ready:false` (missing Stripe)                                                                      |
| `https://mangu-publishers.com/…ready=1`     | HTTP 200; `ready:true` on **Cloud Run** — legacy; not authority after this ADR                            |
| Apex DNS A                                  | Cloud Run Google IPs only (`216.239.*`); Vercel A previously removed — **must re-add for apex on Vercel** |

## Signature Block (Phase 6)

| Role            | Name                  | Decision | UTC                  |
| --------------- | --------------------- | -------- | -------------------- |
| Platform        | Chris (Solo Operator) | Accept B | 2026-07-18T05:48:00Z |
| Release Manager | Chris (Solo Operator) | Accept B | 2026-07-18T05:48:00Z |
| Engineering     | Chris (Solo Operator) | Accept B | 2026-07-18T05:48:00Z |

Signed via operator instruction 2026-07-18 (“dump Cloud Run… stick with Vercel”). Status → **ACCEPTED**. G9 flips TRUE only after Vercel readiness + monitor evidence on the canonical Vercel origin.
