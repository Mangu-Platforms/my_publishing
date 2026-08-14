# MANGU Publishers — NEXT_GO (Execution Authority)

> **This document is the single canonical execution authority for the MANGU Publishers production launch.**
> All DOCX/PDF exports and companion documents (README, QUICK_START, runbooks, checklists) are read-only snapshots. Where any companion conflicts with this file, the companion is superseded — link back here (CCR-001).

## 1. Document Control

| Field                        | Value                                                                                                                                                                                             |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Authority version**        | 1.2.8                                                                                                                                                                                             |
| **Status**                   | **NO-GO / NOT RELEASE-READY**                                                                                                                                                                     |
| **Effective date (UTC)**     | 2026-07-18                                                                                                                                                                                        |
| **Accountable owner**        | Release Manager / Solo Operator                                                                                                                                                                   |
| **Source specification**     | MANGU Master Execution Specification v1.0 (source snapshot 2026-07-17; 16 phases / 115 steps / 9 appendices)                                                                                      |
| **Baseline SHA (refreshed)** | `16dc1d7c3c3b2861efc8b289649b29a3bda56424` (origin/main, PR #185 merged 2026-07-17T23:31:27Z)                                                                                                     |
| **Evidence sink**            | `docs/OPERATOR_QA_LOG.md` (append-only)                                                                                                                                                           |
| **Decision rule**            | **No GO, release tag, or production-ready claim until hard gates G1–G13 are all evidenced and TRUE (CCR-003).**                                                                                   |
| **Established by**           | ADR-001 Option B (Vercel). ADR-002 Mongo: run `npm run db:mongo:up` (Atlas API keys + optional Vercel token). `DATABASE_PROVIDER=mongodb` hard-gates Atlas ping. Auth cutover still open. v1.2.8 (reality refresh 2026-08-14). |

### Revision — Reality refresh (2026-08-14; v1.2.7 → v1.2.8)

Documentation-only reconciliation (freeze #209, class 1) of the §3 inventory against the repository tree and live probes verified 2026-08-14. **No gate status changed; status remains NO-GO.** Cut from `main@4cb928b`; §3 rows not marked 2026-08-14 remain 2026-07-18 history.

- **Tags / releases:** 0/0 → **4 tags** (v1.0.0, v1.0.1, v1.1.0, v1.1.1), and `CHANGELOG.md` records a **1.2.0 release commit (2026-07-20)**. The prior "no release ever cut" claim is SUPERSEDED.
- **Workflows:** 19 → **3** (`ci.yml`, `merge-steward.yml`, `rotate-supabase-key.yml`; `main.yml` removed in this 2026-08-14 wave).
- **Migrations:** 25 → **46** repo files after this wave (44 mirrored-hosted at zero drift per 2026-07-30 + 2 pending-apply added 2026-08-14).
- **Remote branches:** ~96 → **≈18**; **0** `cursor/ci-autofix-*` branches remain (§3.4 prune complete).
- **Live probes (informational — no gate flipped pending formal evidence entries):** production Vercel deployment READY at `main@2090c3b` (~2026-07-31); apex `mangu-publishers.com` 308-redirects to `www` (verified live 2026-08-14); production Supabase ACTIVE_HEALTHY. Dated notes added at G1/G9 only.
- **ADR numbering (DoLC B11):** the data-ownership ADR is renumbered ADR-001 → **ADR-003** (`docs/architecture/ADR-003-catalog-and-identity-data-ownership.md`); `docs/adr/ADR-001-canonical-platform.md` is the sole ADR-001.
- **Superseded plans:** `docs/LAUNCH_CHECKLIST.md` (AWS Amplify), `docs/LAUNCH_NOW.md` (Cloud Run), `docs/IMPLEMENTATION_STATUS.md`, and `docs/MASTER_EXECUTION_CHECKLIST.md` are banner-marked SUPERSEDED. The only live authorities are **this file** and `docs/launch/PROGRAMME_END_TO_END.md`.

### Evidence status vocabulary

| Status      | Meaning                                               | Satisfies a hard gate?           |
| ----------- | ----------------------------------------------------- | -------------------------------- |
| NOT STARTED | No execution evidence exists                          | No                               |
| IN PROGRESS | Actions started; acceptance incomplete                | No                               |
| BLOCKED     | Dependency/access/defect/decision prevents completion | No                               |
| FAILED      | Observed result violates pass criteria                | No                               |
| PASSED      | Exact-SHA criteria met and evidence reviewed          | Yes, if current and complete     |
| SUPERSEDED  | Historical result retained but replaced               | No                               |
| WAIVED      | Approved exception, owner + residual risk recorded    | Never for an unchanged hard gate |

## 2. Evidence Classification (applies to every factual claim)

| Class               | Meaning                                                                               |
| ------------------- | ------------------------------------------------------------------------------------- |
| **VERIFIED (repo)** | Directly confirmed against a named SHA via git/GitHub API                             |
| **REPORTED**        | Recorded by an operator; not independently queryable                                  |
| **DOC-ONLY**        | External-system claim (GCP, Supabase, Stripe, DNS, Sentry) awaiting live verification |
| **PROPOSED**        | A not-yet-executed action                                                             |

Every executed test is appended to `docs/OPERATOR_QA_LOG.md` with: UTC timestamp, actor, environment, exact SHA, deployment/revision ID, test/gate ID, action, expected, actual, result, artifact link, follow-up issue. Prior evidence is never replaced — superseded rows are marked and new rows appended (CCR-002, CCR-020). No secrets or PII in evidence (CCR-009, CCR-015).

## 3. Refreshed Baseline — 2026-07-18 (v1.2.5; ADR-001 Option B ACCEPTED)

> **Reality refresh (2026-08-14, v1.2.8):** rows below marked "VERIFIED 2026-08-14" supersede their 2026-07-18 values; unmarked rows are 2026-07-18 history. See the §1 revision entry.

> **Refresh trigger (CCR-020):** Phase 7 migration match (#229) + apex DNS split diagnosis (Vercel A on apex). Prior tips SUPERSEDED where replaced; retained in git history.

### 3.1 Repository facts — VERIFIED (GitHub API, against baseline SHA above)

| Item                                      | Value                                        | Notes                                                                                                                                                                                                                                                               |
| ----------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| origin/main                               | `bad404588fc43df82de47050f1192b3df9f9fe1a`   | Phase 6 ADR/monitors (#227). Prior baseline `16dc1d7` (#185) SUPERSEDED for tip tracking; G12 final refresh still due at release cut                                                                                                                                |
| Branch protection                         | main = **protected**                         | All changes via PR                                                                                                                                                                                                                                                  |
| Open PRs                                  | 19 → **12**                                  | 8 duplicate autofix PRs closed 2026-07-18 (Step 3.4); 2 new autofix vehicles (#207, #208) opened against `16dc1d7`. Inventory in §3.2                                                                                                                               |
| Open issues                               | **21**                                       | P0-001…P0-020 (#186–#205) + freeze notice #209; see §5                                                                                                                                                                                                              |
| Branches                                  | **≈18 remote; 0 `cursor/ci-autofix-*`** | VERIFIED 2026-08-14 — SUPERSEDES "~96; 26 autofix"; §3.4 prune complete, 0 autofix branches remain                                                                                                              |
| Tags / Releases                           | **4 tags / see note**                                    | VERIFIED 2026-08-14 — tags v1.0.0, v1.0.1, v1.1.0, v1.1.1; `CHANGELOG.md` records a 1.2.0 release commit (2026-07-20). SUPERSEDES 0/0 and the "no release ever cut" claim (#145 note historical)                                                                                                                                                                          |
| Workflows                                 | **3** in `.github/workflows/`               | VERIFIED 2026-08-14 — `ci.yml`, `merge-steward.yml`, `rotate-supabase-key.yml`. SUPERSEDES 19 (`main.yml` removed in the 2026-08-14 wave; the 2026-07-18 list is in git history)                       |
| Local migrations                          | **46** files in `supabase/migrations/`       | VERIFIED 2026-08-14 (supersedes 25) — 44 mirrored-hosted at zero drift (2026-07-30) + 2 pending-apply added 2026-08-14: `20260814090000_orders_payment_intent_unique.sql`, `20260814091000_rls_policy_backfill.sql`                                                                                                                                                                                                                    |
| `docs/NEXT_GO.md`                         | **present on main** (via #206)               | **G13 TRUE** — authority tracked in release tree                                                                                                                                                                                                                    |
| `docs/adr/ADR-001-canonical-platform.md`  | **present on main**                          | ADR-001 **ACCEPTED Option B (Vercel)** 2026-07-18; G9 pending Vercel readiness + DNS cutover                                                                                                                                                                        |
| `scripts/verify-gcp-production.sh`        | **PRESENT (reference impl, unexecuted)**     | P0-020 — added on this branch; D1–D8 production smoke (service READY, revision/SHA, readiness `ready:true`, route truth, env-bake + secret scan, webhook guard). `bash -n` clean; operator runs in Phase 14/15                                                      |
| `scripts/grant-cloudrun-secret-access.sh` | **PRESENT (reference impl, unexecuted)**     | P0-020 — added on this branch; idempotent least-privilege grant of `secretmanager.secretAccessor` to the Cloud Run runtime SA for the `--set-secrets` names. `bash -n` clean; operator runs in Phase 11                                                             |
| CI on `main` `bad4045` (#227)             | **GREEN** (VERIFIED 2026-07-18)              | CI success https://github.com/redinc23/my_publishing/actions/runs/29631025037; Lighthouse collected `https://mangu-publishers.com` (run 29631025058). Prior Format/MCP-export RED SUPERSEDED. G2 still FALSE until green on the **deployed release** SHA (Phase 14) |

### 3.2 Open PR inventory — VERIFIED (2026-07-18, post-recovery)

| PR                                                                                                                                                            | Class                        | Draft | Base      | Disposition                                                                                                                                                                                              |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- | ----- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ~~#185~~                                                                                                                                                      | Recovery vehicle             | —     | —         | **MERGED** 2026-07-17T23:31:27Z → `16dc1d7` (P0-001 partial: main advanced; deploy READY still Phase 14)                                                                                                 |
| **#207** `fix(ci): format, E2E webkit, Cloud Build env` / **#208** `fix(ci): format + Trivy secret scan`                                                      | Stale autofix vehicles       | Yes   | `16dc1d7` | **CLOSE as superseded** — both reformat the authority doc AND rewrite the append-only QA log (CCR-002 violation), on pre-refresh state. Actual failure (format only) fixed narrowly in Phase-5 format PR |
| ~~#183, #182, #181, #180, #179, #178, #174, #173~~                                                                                                            | Duplicate cursor autofix (8) | —     | stale     | **CLOSED as superseded** 2026-07-18 (Step 3.4 / P0-002)                                                                                                                                                  |
| #184 `reorder migrations` (mislabeled)                                                                                                                        | Stale mega-branch            | Yes   | `3d9ea3c` | **CLOSE as superseded** — P0-004 proves hosted↔repo already exact-match 25/25; no reorder. (Also: no migration files in diff; competing NEXT_GO.md.)                                                     |
| #145 `chore(main): release 1.0.0`                                                                                                                             | release-please               | No    | current   | **HOLD until G1–G13 TRUE (Phase 16)** — freeze comment posted                                                                                                                                            |
| #167 openai 4→6, #160 jest 29→30, #155 react-dom 18→19, #154 tailwind-merge 2→3, #152 react-day-picker 9→10, #133 @types/node 20→26, #129 deploy-cloudrun 2→3 | Dependabot majors (7)        | No    | mixed     | **HELD pre-GO** (Phase 2); freeze comments posted; triage post-GO                                                                                                                                        |
| #142 Copilot CLI integration                                                                                                                                  | Tooling                      | Yes   | stale     | **Deferred** — freeze comment posted; not launch-critical                                                                                                                                                |

### 3.3 External-system claims — DOC-ONLY / UNVERIFIED (no live access from agent; verify per CCR-017)

| Claim                                                                                            | Last observed                                                                               | Source                                |
| ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- | ------------------------------------- |
| GCP project `delta-wonder-488420-i3`, region `us-central1`, Cloud Run service `mangu-publishers` | DOC-ONLY                                                                                    | spec / `docs/CANONICAL_PRODUCTION.md` |
| `docs/CANONICAL_PRODUCTION.md` declares **Vercel** canonical (Option B)                          | VERIFIED (this PR) — supersedes Cloud Run declaration                                       | file content + ADR-001                |
| Canonical = Vercel (`www`); apex still Cloud Run; www `ready:false` (missing Stripe)             | VERIFIED 2026-07-18 — SUPERSEDED 2026-08-14 (live-probe rows below)                                                | `docs/OPERATOR_QA_LOG.md` / ADR-001   |
| Supabase project `mangu-publishers` / `tkzvikozrcynhwsqtkqp`; hosted migrations = **25**         | VERIFIED 2026-07-18 (exact match to repo) — supersedes "22 hosted"                          | `docs/MIGRATIONS.md` / QA log         |
| GitHub Actions blocked by account billing lock                                                   | REPORTED 2026-07-08 (QA log) — re-verify on next run                                        | `docs/OPERATOR_QA_LOG.md`             |
| Unit tests 127/127 PASS; type-check PASS; Tier L 11/11                                           | VERIFIED 2026-07-18 on `a0a9cf5` (Phase 4) — see QA log; supersedes 2026-07-17 63/63 report | `docs/OPERATOR_QA_LOG.md`             |
| Stripe production webhook registered; secrets in GCP Secret Manager                              | DOC-ONLY                                                                                    | Phase 11/13 verification              |
| Manual QA rows 1–10 complete                                                                     | **FALSE — all rows blank** (VERIFIED repo)                                                  | `docs/OPERATOR_QA_LOG.md` → G10 FALSE |
| Production Vercel deployment **READY** at `main@2090c3b` (~2026-07-31)                           | LIVE PROBE 2026-08-14 — informational; Phase 14 dossier still required (G1 unchanged)       | reality-refresh probe 2026-08-14      |
| Apex `mangu-publishers.com` **308-redirects** to `https://www.mangu-publishers.com`              | VERIFIED live 2026-08-14 — supersedes the "apex still Cloud Run" row above                  | reality-refresh probe 2026-08-14      |
| Production Supabase project **ACTIVE_HEALTHY**                                                   | VERIFIED live 2026-08-14                                                                    | reality-refresh probe 2026-08-14      |

### 3.4 Branch prune list (Step 3.5 / P0-002) — OPERATOR ACTION REQUIRED

> **2026-08-14 — COMPLETE.** Prune executed; **0** `cursor/ci-autofix-*` branches remain and remote branches ≈18 (VERIFIED 2026-08-14). The list below is retained as history only.

Agent push is scoped to the designated branch (`git push --delete` → HTTP 403 from the sandbox proxy), so branch deletion is handed to the operator. The 8 duplicate PRs are closed (Step 3.4); their now-orphaned heads plus other autofix orphans (no open PR) are safe to delete. **Keep** `cursor/ci-autofix-automation-709e` (#207) and `-609e` (#208).

Operator command:

```bash
for b in 0017 09f1 1378 1427 197b 1c1d 24a2 36be 4505 8647 96e5 99be \
         9e7c a0f8 b1b2 b9dc c494 ceab d494 db24 dd2a dd48 dfa4 f88c; do
  git push origin --delete "cursor/ci-autofix-automation-$b"
done
```

24 branches. Those tied to the 8 closed PRs (`-0017`/#173, `-b9dc`/#174, `-09f1`/#178, `-36be`/#179, `-a0f8`/#180, `-c494`/#181, `-1378`/#182, `-dd48`/#183) restore from the PR "Restore branch" button if ever needed; the rest are stale autofix orphans with no PR. Non-autofix `cursor/*` branches (seo, launch-readiness, revamp-doc, etc.) are out of scope for this step.

## 4. Program Map — 16 Phases

| #   | Phase                                             | Status                                  | Exit summary                                                                                                                                                                                                                          |
| --- | ------------------------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Authority, Baseline, Evidence Control             | **COMPLETE** (PR #206 merged; G13 TRUE) | Authority on main; refreshed baseline; evidence model + traceability active                                                                                                                                                           |
| 2   | Launch Freeze & Change Governance                 | **COMPLETE**                            | Freeze notice #209; HOLD comments on #145 + 7 dependabot majors; #142 deferred; permitted change classes locked                                                                                                                       |
| 3   | Repository Recovery, PR Closure, Branch Hygiene   | **IN PROGRESS**                         | #185 merged; 8 duplicates closed; #184 triaged; Format Check + MCP route-export fixed (#211/#223); **main CI green** on `5744794`; branch prune still operator (§3.4); deploy READY remains Phase 14                                  |
| 4   | Local Environment & Release-SHA Verification      | **COMPLETE** (agent Tier L)             | Tier L on `a0a9cf5`: pre-launch **11/11**, unit **127/127**, mock E2E **36 pass / 35 skip**, `/api/health`+`/api/live` 200; readiness 503 under placeholders (expected). Evidence in QA log. Operator cloud steps remain Phases 11/14 |
| 5   | CI/CD Workflow Repair                             | **COMPLETE** (agent wiring)             | Format (#211); P0-006 (#219); P0-005 (#221); MCP export (#223); vuln-scan + bug-to-issue push (#225). Preview-E2E live confirm remains operator observation                                                                           |
| 6   | Canonical Platform Decision & Runbooks            | **COMPLETE** (decision)                 | ADR-001 **ACCEPTED Option B (Vercel)**. Monitors → `www`. Cloud Run superseded for GO. **G9 FALSE** until Vercel env `ready:true` + apex DNS to Vercel                                                                                |
| 7   | Database Migration, RLS, Recovery Readiness       | **IN PROGRESS**                         | P0-004 **DONE** (25/25 exact match). P0-015 schema **DONE** (policy present). Remaining: entitled nested-read / `verify-rls` (Phase 12/13); recovery runbook polish                                                                   |
| 8   | Security, Privacy, Abuse Controls, Secret Hygiene | **IN PROGRESS**                         | P0-017 resolved: MCP transport off by default (`MCP_ENABLED`), fail-closed rate-limited when on, search injection hardened. P0-011 (Upstash fail-closed) remains for live verification                                                |
| 9   | Product Truth & Entitlement UX                    | **IN PROGRESS**                         | P0-012 (contact), P0-013 (newsletter), P0-014 (homepage stats) false-success surfaces fixed — honest env-gated behavior; suite now 127/127; G6 stays FALSE pending live Phase 12 QA + remaining public-claim/route-truth items        |
| 10  | Observability, Sentry, Synthetic Monitoring       | **IN PROGRESS**                         | Health/Lighthouse → `www` (Vercel). Remaining: green readiness after env; Sentry release-SHA; alert routing                                                                                                                           |
| 11  | Production Env & Secret Promotion                 | NOT STARTED                             | P0-016; USE_MOCKS/SKIP_EMAILS proven absent                                                                                                                                                                                           |
| 12  | Real-Backend Manual QA: Auth/RBAC/Catalog         | NOT STARTED                             | P0-008, P0-009 (G3, G5, G10)                                                                                                                                                                                                          |
| 13  | Payments, Webhooks, Entitlement, Refunds          | NOT STARTED                             | P0-010 (G4, G8)                                                                                                                                                                                                                       |
| 14  | Production Deployment, Health, Rollback           | NOT STARTED                             | P0-018 retargeted to **Vercel** promote/redeploy semantics (Cloud Run D1–D8 scripts superseded for GO)                                                                                                                                |
| 15  | DNS/TLS Cutover & Stabilization                   | **IN PROGRESS**                         | Option B: point **apex** at Vercel; remove Google `216.239.*` from apex; keep/confirm `www` on Vercel; then set `NEXT_PUBLIC_SITE_URL` to final origin                                                                                |
| 16  | Gates, Release 1.0.0, Post-GO Transition          | NOT STARTED                             | G1–G13 TRUE; sign-off; cut from approved SHA; post-release monitoring; controlled thaw                                                                                                                                                |

## 5. P0 Backlog & Traceability (all OPEN; issues created 2026-07-18)

| P0     | Requirement                                                   | Phases      | Gates           | Issue                                                                                                                |
| ------ | ------------------------------------------------------------- | ----------- | --------------- | -------------------------------------------------------------------------------------------------------------------- |
| P0-001 | Merge/replace recovery vehicle and verify main/deploy READY   | 3, 14       | G1, G2          | [#187](https://github.com/redinc23/my_publishing/issues/187)                                                         |
| P0-002 | Close duplicate autofix PRs and remove merge noise            | 3           | G2              | [#189](https://github.com/redinc23/my_publishing/issues/189)                                                         |
| P0-003 | Lock canonical platform/DNS authority in ADR-001              | 6, 15       | G9              | [#190](https://github.com/redinc23/my_publishing/issues/190) — **ACCEPTED Option B (Vercel)**; close after merge     |
| P0-004 | Reconcile migration history and hosted state                  | 7           | G7              | [#192](https://github.com/redinc23/my_publishing/issues/192) — **DONE** (25/25 match); close when operator confirms  |
| P0-005 | Preview E2E honors BASE_URL / real target semantics           | 5           | G2              | [#194](https://github.com/redinc23/my_publishing/issues/194) — **agent DONE** (#221); close when operator confirms   |
| P0-006 | Repair bug-to-issue workflow trigger                          | 5           | G2              | [#188](https://github.com/redinc23/my_publishing/issues/188) — **agent DONE** (#219); close when operator confirms   |
| P0-007 | Retarget health/Lighthouse monitors to canonical production   | 6, 10, 15   | G9              | [#186](https://github.com/redinc23/my_publishing/issues/186) — retargeted to **www** (Vercel); green when env ready  |
| P0-008 | Complete launch-critical manual QA rows 1–10                  | 12, 13      | G3, G4, G5, G10 | [#193](https://github.com/redinc23/my_publishing/issues/193)                                                         |
| P0-009 | Complete Phase 7A auth evidence                               | 12          | G3              | [#191](https://github.com/redinc23/my_publishing/issues/191)                                                         |
| P0-010 | Stripe purchase → webhook → order → library → reading         | 13          | G4, G8          | [#205](https://github.com/redinc23/my_publishing/issues/205)                                                         |
| P0-011 | Production Upstash fail-closed controls                       | 8, 11, 12   | G3, G7          | [#195](https://github.com/redinc23/my_publishing/issues/195)                                                         |
| P0-012 | Fix or honestly disable contact form                          | 9           | G6              | [#197](https://github.com/redinc23/my_publishing/issues/197) — **agent DONE** (product-truth); live confirm Phase 12 |
| P0-013 | Fix or honestly disable newsletter CTA                        | 9           | G6              | [#201](https://github.com/redinc23/my_publishing/issues/201) — **agent DONE** (product-truth); live confirm Phase 12 |
| P0-014 | Replace/remove contradictory homepage statistics              | 9           | G6              | [#204](https://github.com/redinc23/my_publishing/issues/204) — **agent DONE** (product-truth); live confirm Phase 12 |
| P0-015 | Apply + verify hosted `order_items` SELECT policy             | 7, 13       | G4, G7          | [#199](https://github.com/redinc23/my_publishing/issues/199) — **schema DONE**; entitled nested-read = Phase 12/13   |
| P0-016 | Validate payment/rate-limit production secrets                | 11, 13      | G4, G7, G8      | [#203](https://github.com/redinc23/my_publishing/issues/203)                                                         |
| P0-017 | Disable/auth/rate-limit public MCP transport                  | 8           | G7              | [#200](https://github.com/redinc23/my_publishing/issues/200) — **agent DONE** (#217 + #223 route-export fix)         |
| P0-018 | Deploy via canonical path; complete D1–D8                     | 14          | G1, G2, G7, G11 | [#198](https://github.com/redinc23/my_publishing/issues/198)                                                         |
| P0-019 | Commit authority document; create ADR directory               | 1, 6, 9, 16 | G9, G12, G13    | [#196](https://github.com/redinc23/my_publishing/issues/196) — **DONE** (G13 TRUE); close when operator confirms     |
| P0-020 | Create/validate missing production verification + IAM scripts | 6, 11, 14   | G1, G7, G11     | [#202](https://github.com/redinc23/my_publishing/issues/202) — **create DONE**; validate/execute needs operator      |

**Priority discipline (CCR-004):** No P1/P2 may displace an open prerequisite P0.

## 6. Hard Gate Matrix — ALL-TRUE RULE

> Every gate must be explicitly TRUE with current, accessible, exact-SHA evidence. FALSE, PENDING, UNVERIFIED, or evidence from another SHA ⇒ NO-GO (CCR-003, CCR-005).

| Gate | Requirement                                       | Pass logic                                                        | Required evidence                  | State                                                                                                    |
| ---- | ------------------------------------------------- | ----------------------------------------------------------------- | ---------------------------------- | -------------------------------------------------------------------------------------------------------- |
| G1   | origin/main deployment READY                      | Platform ready conditions + candidate revision identity           | Phase 14 D1/D2 dossier             | **FALSE** — note 2026-08-14: live probe shows a production Vercel deployment READY at `main@2090c3b` (~2026-07-31); gate stays FALSE pending the Phase 14 dossier + formal evidence entry                                                                                                |
| G2   | CI green on exact release SHA                     | All required workflows green on deployed SHA                      | Actions run URLs + SHA correlation | **FALSE**                                                                                                |
| G3   | Phase 7A auth evidence complete                   | Registration, host, PKCE, login/logout, reset, duplicate          | Phase 12 signed auth package       | **FALSE**                                                                                                |
| G4   | Stripe purchase → order → library → reading       | Signed webhook fulfillment, DB rows, entitlement, refund          | Phase 13 correlation package       | **FALSE**                                                                                                |
| G5   | RBAC smokes pass                                  | Non-admin denied; nonpartner export denied; roles succeed         | Phase 12 RBAC/portal evidence      | **FALSE**                                                                                                |
| G6   | No false-success public forms/claims              | Contact/newsletter/stats/CTA/route truth acceptance               | Phase 9 acceptance package         | **FALSE**                                                                                                |
| G7   | Production readiness passes                       | `/api/health?ready=1` → `ready:true` with critical components     | Phase 14/15 curl JSON + logs       | **FALSE**                                                                                                |
| G8   | Production webhook registered + test event        | Canonical endpoint, subscriptions, signed event 2xx + side effect | Stripe endpoint/event evidence     | **FALSE**                                                                                                |
| G9   | ADR signed; monitors hit real production          | ADR-001 signed; DNS/monitor URLs canonical                        | ADR commit + monitor run URLs      | **FALSE** — ADR ACCEPTED B; monitors → www. 2026-07-18 sub-claims (Vercel `ready:false`; apex on Cloud Run) SUPERSEDED by 2026-08-14 live probes: deployment READY, apex 308→www redirect working; gate stays FALSE pending formal evidence entry      |
| G10  | Manual QA rows 1–10 complete with dates           | Tester, time, SHA, deploy ID, artifact per row                    | QA log commit + evidence index     | **FALSE**                                                                                                |
| G11  | Known-good revision recorded; rollback traceable  | Verified target + successful rehearsal                            | Rollback transcript + revision ID  | **FALSE**                                                                                                |
| G12  | Master baseline refreshed with release SHA        | Latest source/deploy/DNS/migration facts here                     | Refresh commit                     | **PARTIAL** — refreshed to `16dc1d7` (v1.2.0); final release-SHA refresh due at cut (recurs per CCR-020) |
| G13  | Authority document committed at `docs/NEXT_GO.md` | File tracked in release tree, matches approved version            | git tree proof + commit SHA        | **TRUE** — `docs/NEXT_GO.md` on main via PR #206 (`0f30649`); tracked in release tree                    |

## 7. Launch Scope (Step 1.5 — signed operating rule)

| Class                                     | Items                                                                                                                                                                                                                                                |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Launch-in-MVP**                         | Catalog/browse/search; auth (register/login/reset/PKCE); Stripe checkout + webhook fulfillment; library + entitlement-gated reading; author portal submission; admin portal; RBAC; RLS; rate limiting (fail-closed); health/readiness probes; Sentry |
| **Launch-with-flag / honest-unavailable** | AI recommendations (Resonance — requires `OPENAI_API_KEY`, else flagged off); email/newsletter (requires `RESEND_API_KEY`, else disabled honestly); contact form (works verifiably or disabled); audiobooks; reviews/ratings (coming-soon only)      |
| **Post-launch (post-GO)**                 | Stripe Connect/payouts; major dependency upgrades (#167/#160/#155/#154/#152/#133/#129); Next 16 migration (fixes 17 npm-audit vulns in `next@14.2.35` chain); growth features; k6 load testing rollout                                               |
| **Out-of-scope for launch**               | Any feature merge during freeze outside permitted classes (Phase 2 §8); marketing "production-ready" claims before G1–G13 TRUE                                                                                                                       |

Scope changes require change-control approval and a same-PR update to this file.

## 8. Operating Rules (locked, Step 1.5)

1. **NO-GO is the default.** Any unresolved/failed/unverified gate keeps status NO-GO.
2. **P0 > P1 > P2.** No P1/P2 displaces an open prerequisite P0 (CCR-004).
3. **Exact-SHA evidence only.** Tests, CI, deploy, QA, and sign-off all reference the same candidate SHA (CCR-005). A green from another SHA is not evidence.
4. **Freeze (Phase 2, upon this PR merging):** only document-only changes, CI wiring fixes, PR-closure comments, minimal recovery repairs, and approved security fixes. Release-please #145 and all dependabot majors HELD. One recovery vehicle per failure signature; no mega-PRs.
5. **Append-only evidence.** `docs/OPERATOR_QA_LOG.md` never rewrites history; supersede + append (CCR-002).
6. **Secret hygiene.** No private values in git, client bundles, images, logs, evidence, or screenshots (CCR-009). Exposure ⇒ revoke/rotate + history remediation.
7. **Real backend for Tier R.** Mocks/`USE_MOCKS`/`SKIP_EMAILS` cannot satisfy manual real-backend gates and must be absent in production (CCR-010, Appendix E).
8. **Rollback first.** Every production/DNS change has a verified known-good target and rehearsed rollback before execution (CCR-012).
9. **Post-change refresh.** Every material merge/deploy/cutover refreshes §3 baseline, evidence, and QA log in a new commit (CCR-020, G12).
10. **Honest scope.** Unready surfaces are hidden, flagged, or explicitly unavailable; false production-ready claims are defects (CCR-018, G6).

## 9. Cross-Cutting Controls (CCR-001…020 — apply to every phase)

Single authority (001) · Evidence freshness (002) · All-true release rule (003) · Priority discipline (004) · Exact-SHA testing (005) · No false success (006) · Fail closed (007) · Least privilege (008) · Secret hygiene (009) · Real backend for Tier R (010) · Idempotency (011) · Rollback first (012) · Truthful health semantics (013) · Human evidence for manual gates (014) · PII minimization (015) · Change isolation (016) · External verification in-system (017) · Honest scope (018) · Accessibility of critical states (019) · Post-change refresh (020). Full text: spec Appendix A.

## 10. Environment & Secret Matrix (summary — full text: spec Appendix E)

Required (current GO path): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (public; safety via RLS), `SUPABASE_SERVICE_ROLE_KEY` (server-only), `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` (fail-closed), `NEXT_PUBLIC_SITE_URL` (canonical origin — never localhost/preview in production).
Additive (ADR-002 Mongo migration): `MONGODB_URI` (Atlas `mongodb+srv://…`), optional `MONGODB_DB` (default `mangu`). Not yet a readiness hard-fail; becomes required after Supabase cutover.
Conditional: `RESEND_API_KEY`, `OPENAI_API_KEY` (feature flagged off if absent), `SENTRY_*`, `BASE_URL` (CI/E2E), `TRUSTED_PROXY_COUNT` (after topology fixed).
**Forbidden in production:** `USE_MOCKS`, `SKIP_EMAILS` — proven absent in Phase 11.

## 11. Route & API Security Matrix (summary — full text: spec Appendix F)

`/api/live` public liveness (never a GO gate) · `/api/health` startup (not readiness) · `/api/health?ready=1` readiness — `ready:true` required for GO (G7) · `/api/session` cookie session · `/api/checkout` authenticated, server-derived identity, payment rate limit · `/api/webhook` Stripe-signature verified; unsigned → 400; missing secret ⇒ fail closed · `/api/upload` authenticated/role + limits · `/api/resonance/*` matched-auth or public-catalog only · `/api/analytics/*` minimal PII · `/api/mcp/[transport]` **disabled unless `MCP_ENABLED=true`; fail-closed rate-limited + input-sanitized when on (P0-017 resolved)** · `/partner/orders/export` partner-only · `/callback` PKCE on canonical host.

## 12. Go/No-Go Sign-Off (Phase 16 — blank until then)

| Role             | Scope                                              | Decision / Signature / UTC |
| ---------------- | -------------------------------------------------- | -------------------------- |
| Release Manager  | Sequence, gate integrity, version/tag              | \_\_\_\_                   |
| Engineering      | Source/build correctness                           | \_\_\_\_                   |
| Platform         | Deployment, secrets, monitoring, DNS/TLS, rollback | \_\_\_\_                   |
| QA               | Tier L/R/P evidence, defect disposition            | \_\_\_\_                   |
| Product          | Launch scope, public truth, residual risk          | \_\_\_\_                   |
| Security         | RBAC/RLS/secret/abuse/privacy                      | \_\_\_\_                   |
| Finance/Payments | Stripe mode, price mapping, refunds                | \_\_\_\_                   |

Rules: any owner NO-GO ⇒ NO-GO; absence is not consent; a signature on a different SHA is invalid.

## 13. Evidence Register

Primary ledger: `docs/OPERATOR_QA_LOG.md` (append-only). Phase 1 entries (2026-07-18): baseline refresh (§3), authority document creation (this PR), P0 issue map (§5), ADR-001 PROPOSED, README/QUICK_START authority links + honest status fix. Artifact storage: `docs/reports/` and durable links per entry.

## 14. Source Documents

MANGU Master Execution Specification v1.0 (2026-07-17; 16 phases / 115 steps / appendices A–I) — controlling procedure text · Next-Go v4.0 consolidated plan · granular steps document · `docs/OPERATOR_QA_LOG.md` historical entries (2026-05-31 → 2026-07-17) · `docs/CANONICAL_PRODUCTION.md` (Cloud Run declaration — subordinate to ADR-001 once signed).

## 15. Refresh Protocol (CCR-020 / G12)

After every material merge, deploy, migration, or DNS change: re-run the §3 baseline queries, append new evidence rows, mark superseded rows, and commit with message `docs(next-go): refresh baseline @<SHA> <UTC timestamp>`. The release cut requires a final refresh naming the release SHA (G12).
