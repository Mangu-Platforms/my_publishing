---
name: mangu-navigator
description: The master orchestration skill for the MANGU Publishers repo (redinc23/my_publishing). Use this at the start of EVERY session touching this repo, and whenever anyone asks "what should I work on", "what's the state of the project", "what's next", "prioritize", "roadmap", "get us to launch", "finish Phoenix", "onboard me", or gives any vague/ambitious productivity goal for mangu-publishers.com. Also use it when anyone asks to improve the product itself — "enhance the UI", "make it best in class", "industry leader", "what features should we build", "UX ideas", "polish", "growth" — its enhancement engine turns those into a ranked, freeze-safe pipeline. It holds the complete mental model (dual-run architecture, authority chain, both scoreboards), routes every task to the correct specialist skill pack, and converts any session into evidence-gated forward motion. If in doubt whether a MANGU task needs orchestration — it does; load this first.
metadata:
  version: 1.1.0
  repo: redinc23/my_publishing
  snapshot: main@9a8a940 (2026-07-20)
---

# MANGU Navigator — the path to productivity and prosperity

This repo is not a pile of code. It is a **governed program** with two concurrent
missions, an authority chain, human gates, and an evidence culture. Working here
productively means knowing which mission a task serves, which document rules it,
which specialist skill executes it, and what proof closes it. This skill is the
map and the compass. The specialist packs in `.claude/skills/` are the vehicles.

## 1. The mental model (30 seconds)

**Product:** MANGU Publishers — a Netflix-inspired digital publishing platform.
Book/audio/comics marketplace, reader with progress + highlights, author &
partner portals, admin, Stripe checkout, Resonance AI recommendations,
transactional email. Prod: `https://www.mangu-publishers.com` (apex 301 → www).

**Stack today (dual-run):** Next.js 14 App Router · React 18 · strict TS ·
Tailwind. Supabase (Postgres+RLS, Auth, Storage) is **live in production**.
Better Auth + MongoDB Atlas + Vercel Blob are **merging in behind switches**:

- `lib/auth/provider.ts` → `AUTH_PROVIDER=supabase|better-auth` (default **supabase**)
- `lib/db/provider.ts` → `DATABASE_PROVIDER=supabase|mongodb` (default **supabase**)

Flipping either flag in Vercel Production before Phase 11–12 readiness is the
single fastest way to cause an outage. The public site must keep serving
throughout the migration — that constraint shapes everything.

**Two missions, two scoreboards (details: `references/prosperity-ledger.md`):**

| Ledger          | Authority                              | Goal                                                           |
| --------------- | -------------------------------------- | -------------------------------------------------------------- |
| **A — Launch**  | `docs/NEXT_GO.md`                      | Hard gates G1–G13 all TRUE ⇒ GO / v1.0.0 release               |
| **B — Phoenix** | `docs/PROJECT_PHOENIX.md` (v4.0/4.0.1) | Supabase → Better Auth/Mongo/Blob; North Stars 1–8 certifiable |

Phoenix is **ACTIVE** (owner Faith Beckwith reactivated it 2026-07-20; recorded
in `CLAUDE.md` header and `HUMAN_TASKS.md` C0.3). Feature freeze is on: only
migration parity, hardening, and NEXT_GO-permitted change classes may merge.

**Prosperity, operationally defined:** G1–G13 all TRUE **and** North Stars 1–8
certifiable **and** the public site never broke on the way. Every session should
move at least one gate, one star, one P0, or one human-gate unblock — with
evidence — or it wasn't productive.

## 2. Session ritual — sync before acting

The repo moves fast; documents go stale within days (the recon's "zero Phoenix
code merged" was overtaken by PR #304 within 48h). Never trust a doc's snapshot
over `git log`. Start every session:

1. Run `scripts/state-sync.sh` from this skill (read-only; prints git state,
   provider defaults, both ledger headers, the supabase-import counter, open
   human gates, and — with `--probe` — live prod health).
2. Read the top of `CLAUDE.md` (execution briefing) and skim `HUMAN_TASKS.md`
   for new blockers or owner decisions.
3. If anything you're about to do conflicts with a doc, stop and consult
   `references/authority-chain.md` — precedence is explicit here, and there are
   known stale-record traps.

## 3. Iron rules (violating these causes outages or contract breaches)

1. **Prod stays `AUTH_PROVIDER=supabase`** until Phase 11–12 cutover readiness
   (forced-reset machinery proven). Never flip it "to test".
2. **Edge middleware is cookie-only.** The Mongo driver cannot run on Edge; use
   `getSessionCookie` there, full session checks server-side only.
3. **Never migrate password hashes** (Supabase bcrypt ≠ Better Auth scrypt).
   Legacy users get locked credentials + forced reset. Any "re-hash on first
   login" idea is the known v3.0 bug — reject it.
4. **Stripe webhook stays idempotent:** unique index on
   `orders.stripe_payment_intent_id`, upsert, 200 on duplicates.
5. **No secrets in the repo, logs, evidence, or screenshots** — ever. Missing
   credential ⇒ write the exact console click-path into `HUMAN_TASKS.md` and
   continue with unblocked work. Never fabricate credentials.
6. **CI green on every PR** (Jest + Playwright). Baseline is 740/740 unit tests
   across 66 suites (@ `main` 2bfebf7, 2026-08-20) — you may not make the
   baseline worse. Never merge red.
7. **Feature freeze.** No new product features outside migration parity, WS6
   hardening, and NEXT_GO §8 permitted classes.
8. **Evidence is append-only.** `docs/OPERATOR_QA_LOG.md` never gets rewritten —
   supersede and append (CCR-002). Exact-SHA evidence only (CCR-005).
9. **Doc conflicts with reality ⇒ amend the doc in the same PR** with a `docs:`
   commit. Do not improvise silently (Phoenix contract rule).
10. **One PR per workstream slice.** Branches `feat/phoenix-ws<N>-<slug>` (or
    `cursor/<slug>-c5d8` for cowork). Conventional commits:
    `feat(phoenix-ws2): …`, `docs(phoenix): …`.

## 4. Next-best-action algorithm

When the task is vague ("make progress", "what's next", "maximize productivity"),
run this decision procedure top-down and take the first branch that fires:

1. **Prod down or readiness failing?** (`--probe` output, `/api/health?ready=1`)
   → incident mode: load `mangu-ops-runbook`, follow its rollback decision tree.
   Nothing outranks a burning site.
2. **CI red on `main`?** → load `mangu-ci-quality`; fix the pipeline before
   building anything on top of it.
3. **Agent-actionable security P0 open?** (`HUMAN_TASKS.md` H0.x, NEXT_GO §5
   P0 list) → burn it down; security P0s outrank feature work (NEXT_GO rule 2).
4. **Otherwise: advance the lowest-numbered incomplete Phoenix workstream** that
   is unblocked. WS1 merged (#304) ⇒ default forward motion is **WS2a → 2b →
   2c → 2d → WS3 → WS4 → WS5 → WS6**, one reviewable PR per slice, with
   `phoenix-contract` loaded and Task IDs + verification evidence in the PR body.
5. **Everything console-blocked?** → write precise human gates into
   `HUMAN_TASKS.md`, then spend the session on always-valuable work: tests
   toward WS5, docs amendments, gate-evidence prep, QA-matrix scaffolding, or
   an enhancement-engine SCOUT pass (§4b) — ledger grooming is always
   freeze-legal.
6. **Close every session** by recording evidence (PR body, QA log append) and
   refreshing baselines if the merge was material (CCR-020 / G12).

## 4b. Enhancement engine — proactive product leadership

The navigator doesn't only defend the launch; it compounds toward industry
leadership. `references/enhancement-engine.md` defines a continuous pipeline
(SCOUT → SPEC → RANK → LEDGER → GATE → BUILD → MEASURE) plus a benchmark map
of what best-in-class means per domain (discovery, reading UX, audio, social,
author tools, commerce, perf, SEO, a11y, trust) against what MANGU already has.

Operating principle: **discovery never stops; shipping is lane-gated.** Ideas
are classified L0–L4; L0 truth-fixes and L1 hardening may ship now under the
freeze's permitted classes, L2 needs recorded owner approval, L3+ waits for GO
or explicit unfreeze. Every build ships behind a default-off flag with a named
metric. The ranked backlog lives in `docs/ENHANCEMENT_LEDGER.md` so any agent
can pick up the top approved item cold. Run `scripts/enhance-scan.sh` for
fresh code-level signals before each SCOUT pass.

## 5. Routing table — load the right specialist

Full matrix with docs + verification commands: `references/task-router.md`.
Quick routes:

| Task smells like…                              | Load                     | Plus read                                                        |
| ---------------------------------------------- | ------------------------ | ---------------------------------------------------------------- |
| Order/priorities/PR mechanics                  | `phoenix-contract`       | `CLAUDE.md`, doc §4.3/§5                                         |
| Auth, sessions, forced reset, middleware       | `better-auth-mangu`      | recon §5, `lib/auth.ts`                                          |
| Mongo schema, indexes, queries                 | `mongodb-atlas-mangu`    | `types/`, doc §4.2                                               |
| Checkout, webhook, orders                      | `stripe-webhook-mangu`   | `docs/STRIPE_WEBHOOK_PRODUCTION.md`                              |
| Env vars, secrets, validate-env                | `mangu-env-and-secrets`  | `.env*.example`, `scripts/validate-env.ts`                       |
| Incidents, health, rollback                    | `mangu-ops-runbook`      | `docs/ROLLBACK.md`                                               |
| Data export/transform/import                   | `phoenix-data-migration` | doc §5.5                                                         |
| File storage, Blob migration                   | `phoenix-storage-blob`   | doc §3.4/§8 spec in `CLAUDE.md`                                  |
| CI workflows, flaky tests                      | `mangu-ci-quality`       | `.github/workflows/`                                             |
| MCP tools at `/api/mcp`                        | `mcp-catalog-ops`        | `docs/MCP_SERVER.md`                                             |
| Roles/permissions/admin                        | `mangu-rbac-admin`       | recon role model (no `editor`!)                                  |
| Cutover day                                    | `phoenix-cutover`        | doc §5.6–5.8                                                     |
| "Improve the product / UI / features / growth" | (this skill) §4b engine  | `references/enhancement-engine.md`, `docs/ENHANCEMENT_LEDGER.md` |

## 6. Repo map & scoreboards

- **Where everything lives** (routes, lib modules, scripts, workflows, docs by
  tier): `references/repo-map.md`
- **Which document wins** + stale-record traps: `references/authority-chain.md`
- **Both scoreboards, current position, and the proof commands** that count as
  evidence: `references/prosperity-ledger.md`

## 7. What "done" looks like for any unit of work

A slice is finished when: code merged green → verification commands from the
ledger pass → evidence pasted in the PR body → any doc deltas amended → human
gates logged → the relevant gate/star/checklist box measurably closer to TRUE.
If you can't name which G-gate or North Star a task serves, either it's freeze-
violating scope (drop it) or you haven't synced state (go back to §2).
