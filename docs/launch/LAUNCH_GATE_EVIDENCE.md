# Launch Gate Evidence

> **Task 5.1.** Template — **intentionally empty**. One row per gate, one row per freeze requirement.
> Subordinate to `docs/NEXT_GO.md` (CCR-001). Evidence sink is `docs/OPERATOR_QA_LOG.md` (CCR-002).

## Provenance of the gate names — these are real, not invented

**Source: `docs/NEXT_GO.md` §6 "Hard Gate Matrix — ALL-TRUE RULE"** (Authority version 1.2.7,
effective 2026-07-18). The Gate, Requirement, Pass-logic and Required-evidence columns in §2 below
are **transcribed from that table**, not authored here.

Corroborating references in the repository:

- `docs/NEXT_GO.md:17` — *"No GO, release tag, or production-ready claim until hard gates G1–G13 are
  all evidenced and TRUE (CCR-003)."*
- `docs/NEXT_GO.md:159–171` — the gate table itself.
- `docs/PRODUCT_GAP_LEDGER.md:9–10` — *"subordinate to `docs/NEXT_GO.md` (G13 TRUE, G12 PARTIAL,
  G1–G11 FALSE)"*.
- `docs/PRODUCT_GAP_CROSSWALK.md:5, :14` — per-gap gate ties.
- `docs/PRODUCT_FEATURE_STORIES.md:37` — *"all G1-G13 gates must be true before a production-ready
  claim or release tag."*
- Issue #209 — the freeze notice, which restates the ALL-TRUE rule.

**Where the gate state came from:** the "Authority state" column in §2 is the state recorded in
`docs/NEXT_GO.md` §6 **as of authority version 1.2.7 / 2026-07-18**. It is reproduced for context
only. **It is not current evidence** and must be re-verified against the release candidate SHA
(CCR-005). Do not treat the reproduced state as satisfying anything.

---

## 1. How to complete this document

1. **One evidence set, one SHA.** Every row must reference the *same* release candidate SHA. A green
   result from a different SHA is not evidence (CCR-005).
2. **Links must be live and accessible** — Actions run URLs, Stripe event IDs, commit SHAs, monitor
   run URLs. "Verified locally" is not evidence.
3. **No secrets, no PII** in any cell, link title, or attached artifact (CCR-009, CCR-015).
4. **Human gates need human evidence.** G3, G5 and G10 cannot be satisfied by CI (CCR-014).
5. **Approver is a person**, and not the same person who produced the evidence where the roles are
   separable.
6. **An open exception blocks the gate** unless formally `WAIVED` with an owner and a recorded
   residual risk — and per `docs/NEXT_GO.md` §1, `WAIVED` is **never** valid for an unchanged hard
   gate.
7. Every completed row also gets an append-only row in `docs/OPERATOR_QA_LOG.md`.

**Status vocabulary** (`docs/NEXT_GO.md` §1): `NOT STARTED` · `IN PROGRESS` · `BLOCKED` · `FAILED` ·
`PASSED` · `SUPERSEDED` · `WAIVED`.

**Evidence classification** (`docs/NEXT_GO.md` §2): `VERIFIED (repo)` · `REPORTED` · `DOC-ONLY` ·
`PROPOSED`.

---

## 2. Hard gate matrix G1–G13

**Release candidate SHA:** `________________________________________`
**Environment:** `________________________`  **Date (UTC):** `____________________`

| Gate | Requirement *(from `docs/NEXT_GO.md` §6)* | Pass logic *(verbatim)* | Required evidence *(verbatim)* | Authority state @ v1.2.7 | **Status** | **Evidence link** | **Commit SHA** | **Environment** | **Approver** | **Open exception** |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **G1** | origin/main deployment READY | Platform ready conditions + candidate revision identity | Phase 14 D1/D2 dossier | FALSE |  |  |  |  |  |  |
| **G2** | CI green on exact release SHA | All required workflows green on deployed SHA | Actions run URLs + SHA correlation | FALSE |  |  |  |  |  |  |
| **G3** | Phase 7A auth evidence complete | Registration, host, PKCE, login/logout, reset, duplicate | Phase 12 signed auth package | FALSE |  |  |  |  |  |  |
| **G4** | Stripe purchase → order → library → reading | Signed webhook fulfillment, DB rows, entitlement, refund | Phase 13 correlation package | FALSE |  |  |  |  |  |  |
| **G5** | RBAC smokes pass | Non-admin denied; nonpartner export denied; roles succeed | Phase 12 RBAC/portal evidence | FALSE |  |  |  |  |  |  |
| **G6** | No false-success public forms/claims | Contact/newsletter/stats/CTA/route truth acceptance | Phase 9 acceptance package | FALSE |  |  |  |  |  |  |
| **G7** | Production readiness passes | `/api/health?ready=1` → `ready:true` with critical components | Phase 14/15 curl JSON + logs | FALSE |  |  |  |  |  |  |
| **G8** | Production webhook registered + test event | Canonical endpoint, subscriptions, signed event 2xx + side effect | Stripe endpoint/event evidence | FALSE |  |  |  |  |  |  |
| **G9** | ADR signed; monitors hit real production | ADR-001 signed; DNS/monitor URLs canonical | ADR commit + monitor run URLs | FALSE — ADR ACCEPTED B; monitors → www; Vercel `ready:false`; apex still Cloud Run |  |  |  |  |  |  |
| **G10** | Manual QA rows 1–10 complete with dates | Tester, time, SHA, deploy ID, artifact per row | QA log commit + evidence index | FALSE |  |  |  |  |  |  |
| **G11** | Known-good revision recorded; rollback traceable | Verified target + successful rehearsal | Rollback transcript + revision ID | FALSE |  |  |  |  |  |  |
| **G12** | Master baseline refreshed with release SHA | Latest source/deploy/DNS/migration facts here | Refresh commit | PARTIAL — refreshed to `16dc1d7`; final release-SHA refresh due at cut |  |  |  |  |  |  |
| **G13** | Authority document committed at `docs/NEXT_GO.md` | File tracked in release tree, matches approved version | git tree proof + commit SHA | TRUE — on main via PR #206 (`0f30649`) |  |  |  |  |  |  |

### ALL-TRUE check

| | |
| --- | --- |
| Gates `PASSED` | **___ / 13** |
| Any `FALSE` / `PENDING` / `UNVERIFIED` / evidence from another SHA? | ☐ YES ☐ NO |
| **Decision** | ☐ **GO** (only if 13/13) ☐ **NO-GO** |
| Decided by | ______________________ |
| Date (UTC) | ______________________ |

> **NO-GO is the default** (`docs/NEXT_GO.md` §8 rule 1). Any unresolved, failed or unverified gate
> keeps the status NO-GO.

---

## 3. G10 detail — manual QA rows 1–10

`docs/NEXT_GO.md:88` records these as **"FALSE — all rows blank" (VERIFIED repo)**. The table lives
in `docs/OPERATOR_QA_LOG.md:396–405` and is tracked by **issue #193 (P0-008)**.

Row titles are transcribed from that table. Each needs tester, UTC time, exact SHA, deploy/revision
ID and an artifact link — **CI cannot substitute** (CCR-014).

| Row | Test | Tester | UTC time | SHA | Deploy/revision ID | Artifact | Result |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Register at `/register` |  |  |  |  |  |  |
| 2 | Profile row in Supabase `profiles` |  |  |  |  |  |  |
| 3 | Login / logout |  |  |  |  |  |  |
| 4 | Password reset |  |  |  |  |  |  |
| 5 | Non-admin blocked from `/admin` |  |  |  |  |  |  |
| 6 | Admin `/admin/health` |  |  |  |  |  |  |
| 7 | Browse `/books` |  |  |  |  |  |  |
| 8 | Stripe test checkout (`4242…`) |  |  |  |  |  |  |
| 9 | Stripe webhook event received |  |  |  |  |  |  |
| 10 | New static homepage loads at `/` |  |  |  |  |  |  |

> ⚠️ Row 7 ("Browse `/books`") intersects the Task 1.0 blocker and the launch catalog. It cannot be
> honestly passed until the catalog shows only launch-approved books
> (`docs/launch/LAUNCH_CATALOG.md`).

---

## 4. Issue #209 — freeze requirement mapping

Requirements transcribed from issue #209, *"🧊 LAUNCH FREEZE IN EFFECT — change governance until
G1–G13 are TRUE (Phase 2)"* (opened 2026-07-18).

### 4.1 Permitted change classes

| # | Permitted class | Status | Evidence link | Commit SHA | Environment | Approver | Open exception |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Document-only changes (authority refreshes, evidence appends, runbooks, ADRs) |  |  |  |  |  |  |
| 2 | CI/CD wiring fixes needed to make required checks truthful (Phase 5) |  |  |  |  |  |  |
| 3 | PR-closure comments and branch hygiene (Phase 3) |  |  |  |  |  |  |
| 4 | Minimal recovery repairs — one recovery vehicle per failure signature, no mega-PRs |  |  |  |  |  |  |
| 5 | Approved security fixes |  |  |  |  |  |  |

### 4.2 Held until post-GO — must still be held at cut

| Item | Held? | Verified by | Date | Note |
| --- | --- | --- | --- | --- |
| **#145** `chore(main): release 1.0.0` (release-please) |  |  |  | **HELD until Phase 16.** See §5. |
| #167 openai 4→6 |  |  |  | Dependabot major |
| #160 jest 29→30 |  |  |  | Dependabot major |
| #155 react-dom 18→19 |  |  |  | Dependabot major |
| #154 tailwind-merge 2→3 |  |  |  | Dependabot major |
| #152 react-day-picker 9→10 |  |  |  | Dependabot major |
| #133 @types/node 20→26 |  |  |  | Dependabot major |
| #129 deploy-cloudrun 2→3 |  |  |  | Dependabot major. ⚠️ Cloud Run is documentation-only per ADR-001 (canonical platform) |
| #142 Copilot CLI integration |  |  |  | Deferred, not launch-critical |

### 4.3 Rules in force

| Rule | Status | Evidence link | Commit SHA | Approver | Open exception |
| --- | --- | --- | --- | --- | --- |
| Append-only evidence in `docs/OPERATOR_QA_LOG.md` (CCR-002) |  |  |  |  |  |
| Exact-SHA evidence only; no gate flips TRUE without it (CCR-005) |  |  |  |  |  |
| No secrets in git / logs / evidence (CCR-009) |  |  |  |  |  |
| Priority discipline: P0 before any P1/P2 (CCR-004) |  |  |  |  |  |
| Freeze lifts only via controlled thaw in Phase 16 after Release 1.0.0 |  |  |  |  |  |
| Scope changes require change-control approval **and** a same-PR update to `docs/NEXT_GO.md` |  |  |  |  |  |

### 4.4 P0 issue closure

`docs/NEXT_GO.md` §5 and `docs/OPERATOR_QA_LOG.md:202` record **20 P0 issues, #186–#205**
(P0-001 … P0-020).

> ⚠️ **Discrepancy:** the Task 5.1 brief describes the P0 range as **#187–#205**. The repository is
> unambiguous that the range is **#186–#205** — #186 is P0-007 ("Retarget health/Lighthouse monitors
> to canonical production"), created in the same batch. **The repository range is used here.**

| Issue | P0 | Requirement | Gates | Open/Closed | Evidence link | Approver |
| --- | --- | --- | --- | --- | --- | --- |
| #186 | P0-007 | Retarget health/Lighthouse monitors to canonical production | G9 |  |  |  |
| #187 | P0-001 | Merge/replace recovery vehicle and verify main/deploy READY | G1, G2 |  |  |  |
| #188 | P0-006 | Repair bug-to-issue workflow trigger | G2 |  |  |  |
| #189 | P0-002 | Close duplicate autofix PRs and remove merge noise | G2 |  |  |  |
| #190 | P0-003 | Lock canonical platform/DNS authority in ADR-001 | G9 |  |  |  |
| #191 | P0-009 | Complete Phase 7A auth evidence | G3 |  |  |  |
| #192 | P0-004 | Reconcile migration history and hosted state | G7 |  |  |  |
| #193 | P0-008 | Complete launch-critical manual QA rows 1–10 | G3, G4, G5, G10 |  |  |  |
| #194 | P0-005 | Preview E2E honors BASE_URL / real target semantics | G2 |  |  |  |
| #195 | P0-011 | Production Upstash fail-closed controls | G3, G7 |  |  |  |
| #196 | P0-019 | Commit authority document; create ADR directory | G9, G12, G13 |  |  |  |
| #197 | P0-012 | Fix or honestly disable contact form | G6 |  |  |  |
| #198 | P0-018 | Deploy via canonical path; complete D1–D8 | G1, G2, G7, G11 |  |  |  |
| #199 | P0-015 | Apply + verify hosted `order_items` SELECT policy | G4, G7 |  |  |  |
| #200 | P0-017 | Disable/auth/rate-limit public MCP transport | G7 |  |  |  |
| #201 | P0-013 | Fix or honestly disable newsletter CTA | G6 |  |  |  |
| #202 | P0-020 | Create/validate missing production verification + IAM scripts | G1, G7, G11 |  |  |  |
| #203 | P0-016 | Validate payment/rate-limit production secrets | G4, G7, G8 |  |  |  |
| #204 | P0-014 | Replace/remove contradictory homepage statistics | G6 |  |  |  |
| #205 | P0-010 | Stripe purchase → webhook → order → library → reading | G4, G8 |  |  |  |

---

## 5. ⚠️ Numbering reconciliation — REQUIRED before this document is used

**Two independent numbering schemes are in play and they collide.**

| Scheme | Origin | Shape | Example |
| --- | --- | --- | --- |
| **A — Authority phases** | MANGU Master Execution Specification v1.0, encoded in `docs/NEXT_GO.md` §4 | **16 phases / 115 steps** | Phase 5 = CI/workflow repair · Phase 12 = Real-Backend Manual QA · **Phase 16 = Gates, Release 1.0.0, Post-GO Transition** |
| **B — Current work plan** | The launch remediation plan these documents were commissioned under | Task IDs `N.n` | Task 1.0 (blocker) · Task 2.0 (lifecycle) · Task 2.6 (runbook) · Task 3.6 (migration reconciliation) · Task 4.1 (catalog) · **Task 5.1 (this document)** |

**The collision:** "Phase 5" in scheme A is *CI/workflow repair*. "Phase 5" in scheme B is
*launch governance* (Task 5.1). Issue #209 uses scheme A throughout — it says the freeze lifts in
"Phase 16" and cites "(Phase 2)" in its own title. Issue #209 also holds **PR #145
(`chore(main): release 1.0.0`)** for Phase 16 of **scheme A**.

**Consequence:** a statement like "we finished Phase 5" is ambiguous and could be read as CI repair
or as launch governance. Any gate evidence citing a bare phase number is therefore ambiguous, which
directly undermines CCR-005.

**Required action — Renee decides.** Options:

1. **Adopt scheme A exclusively.** Re-express Tasks 1.0/2.0/2.6/3.6/4.1/5.1 as steps within the
   existing 16 phases. Highest fidelity to `docs/NEXT_GO.md`, most re-labelling work.
2. **Keep both, always qualified.** Never write a bare phase number — write "Authority Phase 5" or
   "Plan Task 5.1". Cheapest; relies on discipline.
3. **Supersede scheme A** with the new plan via a change-control update to `docs/NEXT_GO.md` (§7
   requires a same-PR authority update for any scope change). Cleanest long-term, highest governance
   cost, and would need a new authority version.

**Until this is decided, every reference in this document uses scheme A** (the authority's numbering)
and names plan items as "Task N.n" so the two never appear as bare numbers.

**Also note:** PR #145 is held for release 1.0.0 and must not be merged until 13/13 gates are
`PASSED` and the §2 decision is **GO**.

---

## 6. Final release sign-off

| Role | Name | Statement | Signature | Date (UTC) |
| --- | --- | --- | --- | --- |
| **Engineering** |  | All code-side gate evidence is complete, accurate, and from the named SHA. |  |  |
| **QA** |  | All manual gate evidence (G3, G5, G10) was produced by a human against a real backend at the named SHA. |  |  |
| **Platform** |  | Deployment, readiness, monitors, DNS and rollback evidence (G1, G7, G9, G11) is complete. |  |  |
| **Release Manager** |  | The ALL-TRUE rule is satisfied; the baseline is refreshed to the release SHA (G12). |  |  |
| **Publisher (Renee)** |  | I approve the release of MANGU Publishers 1.0.0. |  |  |

**Release SHA:** `________________________________________`
**Release tag:** `________________`  **PR:** `#145`
**Decision:** ☐ GO ☐ NO-GO  **Date (UTC):** `____________________`

---

## 7. Change log

Append-only (CCR-002).

| Date (UTC) | Actor | Change | Reason |
| --- | --- | --- | --- |
| 2026-07-28 | agent | Template created (Task 5.1); gate names transcribed from `docs/NEXT_GO.md` §6 | Launch governance |
