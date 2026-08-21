# Prosperity ledger — the two scoreboards and how to move them

Prosperity = **Ledger A all-TRUE** (GO declared, v1.0.0 cut) **and** **Ledger B
all-certifiable** (Phoenix North Stars) **while prod never breaks**. Everything
productive maps to a cell below. Snapshot dated 2026-07-20 @ `9a8a940` — always
re-verify state lines with `scripts/state-sync.sh` before quoting them.

## Ledger A — Launch hard gates (authority: `docs/NEXT_GO.md` §6)

All-true rule: any FALSE/PENDING/stale-SHA gate ⇒ NO-GO (CCR-003, CCR-005).

| Gate | Meaning                                            | State @ snapshot                                                                                                                                                                                    | Typical mover                       |
| ---- | -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| G1   | main deployment READY on canonical platform        | FALSE                                                                                                                                                                                               | Phase 14 deploy dossier (operator)  |
| G2   | CI green on the exact release SHA                  | FALSE (main CI green, but not on a release SHA)                                                                                                                                                     | Release-cut CI run                  |
| G3   | Auth evidence package complete                     | FALSE                                                                                                                                                                                               | Phase 12 manual QA (real backend)   |
| G4   | Purchase → order → library → reading proven        | FALSE                                                                                                                                                                                               | Phase 13 Stripe correlation package |
| G5   | RBAC smokes pass                                   | FALSE                                                                                                                                                                                               | Phase 12 RBAC evidence              |
| G6   | No false-success public surfaces                   | FALSE (fixes merged; live QA pending)                                                                                                                                                               | Phase 12 live acceptance            |
| G7   | `/api/health?ready=1` → `ready:true` in prod       | FALSE in doc; **live probe 2026-07-20 returned `ready:true` on www** — gate stays FALSE until evidenced at an exact SHA and appended to the QA log (CCR-002/005). Cheap win: capture that evidence. | Evidence append + Phase 14 confirm  |
| G8   | Prod Stripe webhook registered + signed test event | FALSE                                                                                                                                                                                               | Stripe console + evidence           |
| G9   | ADR signed; monitors on real prod; DNS canonical   | FALSE (ADR ACCEPTED-B; apex DNS still split)                                                                                                                                                        | Vercel env + apex DNS cutover       |
| G10  | Manual QA rows 1–10 complete                       | FALSE (rows blank)                                                                                                                                                                                  | Operator QA session                 |
| G11  | Known-good revision + rehearsed rollback           | FALSE                                                                                                                                                                                               | Rollback rehearsal transcript       |
| G12  | Baseline refreshed at release SHA                  | PARTIAL (recurring per CCR-020)                                                                                                                                                                     | Refresh commit at cut               |
| G13  | Authority doc tracked on main                      | **TRUE**                                                                                                                                                                                            | —                                   |

Supporting backlog: P0-001…P0-020 (issues #186–#205). P0 > P1 > P2, always.

## Ledger B — Phoenix North Stars (authority: `docs/PROJECT_PHOENIX.md` §1.2)

| #   | Star               | Certify with                                                     | State @ snapshot                                                                                           |
| --- | ------------------ | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| 1   | Build integrity    | `npm run build` exit 0, zero warnings                            | Attainable locally; certify at end                                                                         |
| 2   | Operational health | prod `GET /api/health?ready=1` → `{"ready":true}`                | Observed TRUE live 2026-07-20 (Supabase path); needs QA-log evidence, and must hold post-cutover (ties G7) |
| 3   | User confidence    | 22-point QA suite in prod (Phoenix §6.1)                         | Not started (human-run, agent-supported)                                                                   |
| 4   | Process completion | PRs #1–#6 merged, Vercel prod green                              | **WS1 merged (#304)**; WS2–WS6 open                                                                        |
| 5   | Data sovereignty   | mongodump stored securely                                        | Human gate, Phase 15                                                                                       |
| 6   | Clean codebase     | `grep -ri "supabase" app/ lib/ components/ types/` → 0 code hits | ~109 files at snapshot (dual-run peak; falls in WS2d/WS4)                                                  |
| 7   | User transition    | Forced-reset batch executed + telemetry                          | Script exists (`scripts/request-password-reset.ts`); batch is Phase 11                                     |
| 8   | Platform hardening | 429s verified, Sentry receiving, logs draining                   | WS6                                                                                                        |

Workstream order (strict, one PR each): **WS2a → 2b → 2c → 2d → WS3 → WS4 →
WS5 → WS6**, then Phases 11–15 (migration window, mostly human-executed with
agent-written scripts — see `CLAUDE.md` §11 for the six scripts you own).

## Next-best-action, in detail

Evaluate top-down; act on the first true condition:

1. **Prod incident** (probe failure, error spike) → `mangu-ops-runbook`,
   rollback decision tree, QA-log append. Everything else waits.
2. **main CI red** → `mangu-ci-quality`; restore green before any feature PR.
3. **Open agent-actionable security P0** (e.g., H0.1 legacy-anon-key
   consumers still in CI/Vercel config that the agent can edit) → do it now.
4. **Advance the frontier workstream.** After WS1, that's **WS2a**: `lib/mongo`
   query layer + `types/mongo.ts` + `lib/mongo-queries.ts` per `CLAUDE.md` §7,
   provider-gated so Supabase paths keep serving. Then 2b (API routes), 2c
   (server actions + audit), 2d (page swap), WS3, WS4 (the great purge), WS5,
   WS6.
5. **Parallel always-valuable work** when the frontier is review- or
   gate-blocked: WS5 test scaffolding (webhook double-delivery, avg_rating
   recompute), gate-evidence prep (drafting QA matrices, verification
   scripts), doc amendments, HUMAN_TASKS grooming with exact click-paths.
6. **Session close-out:** PR body carries Task IDs + verification output;
   material merges refresh baselines (CCR-020); new blockers land in
   `HUMAN_TASKS.md`; never leave evidence only in chat.

## Verification commands — what counts as proof

Run from repo root. Paste relevant output into PR bodies / QA log.

```bash
# Full local CI parity (quality + unit + build) — required before every PR
./scripts/ci-local.sh

# Individually
npm run type-check          # tsc --noEmit, strict — must be clean
npm run lint
npm test                    # baseline 740/740 across 66 suites (2026-08-20); never regress
npm run validate-env        # env schema sanity
npm run build               # North Star #1 when 0 warnings

# North Star #6 burn-down counter (target: 0 after WS4)
grep -rl "supabase" app/ lib/ components/ types/ --include="*.ts*" | wc -l

# Health contract (local dev or prod origin)
curl -s http://localhost:3000/api/health | head -c 400
curl -s "https://www.mangu-publishers.com/api/health?ready=1" | head -c 400

# Mongo bootstrap (human runs with real Atlas keys; you write/maintain)
npm run db:mongo:ping && npm run db:mongo:indexes

# RLS posture (legacy path while Supabase serves prod)
npm run verify-rls

# E2E (needs env/secrets; CI runs preview-e2e otherwise)
npm run test:e2e

# Ops snapshot (probes + open PRs)
./scripts/cowork-status.sh
```

**Evidence rules:** exact-SHA only (CCR-005); append, never rewrite
(CCR-002); no secrets in any pasted output (CCR-009); a green run from a
different SHA proves nothing.
