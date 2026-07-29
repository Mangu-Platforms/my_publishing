# AI Evaluation Plan — Mangu Publishers

> **STATUS: DRAFT — PROPOSED** · v0.1.0 · 2026-07-29 · Owner: **TBD** (backup: TBD)
> **Proposed repo path:** `docs/AI_EVALUATION_PLAN.md` (PR-D1, freeze class 1 per delta report §10)
> **This document gates nothing until (a) it is ratified by the owner and (b) the evaluation harness exists.** No harness, datasets, or `tests/ai-eval/` directory exist at HEAD today (delta report §3: zero chat/LLM inference code repo-wide). All thresholds below are carried from the Master Brief or marked PROPOSED; none are yet enforced.
> Evidence-class conventions follow `docs/NEXT_GO.md` §2. Sources: Master Brief §4.3 / §5 / §14 / §16 / §17; `docs/MASTER_BRIEF_DELTA_REPORT.md` §3 / §8.

---

## 1. Purpose and release-gating principle

This plan defines how Mangu measures, gates, and regresses AI quality for every AI surface (E06 platform foundation, E07 knowledge/RAG, E08–E09 assistants, E10 runtime agents).

**Gating principle (Brief §4.3, §17):**

| Rule | Source |
|---|---|
| No AI surface, agent, or skill ships (flag-enabled in production) while any applicable eval suite is below threshold. | Brief §4.3 "regression thresholds and release gating"; §17 DoD "Golden evaluation threshold is met and stored as release evidence." |
| A38 (AI Evaluation Agent) runs the gates but **cannot waive a failed gate** — waivers require the human owner, and per `docs/NEXT_GO.md` a WAIVED status never satisfies an unchanged hard gate. | Brief §5 roster A38 hard boundary; NEXT_GO §1 status vocabulary. |
| Eval results are release evidence: stored append-only with exact SHA, per NEXT_GO §2. | Brief §17; NEXT_GO §2. |
| Sequencing: harness is spec-now / build-behind-disabled-flag / gate-at-enable, matching E06–E09 sequencing (spec now → build at thaw → assistants post-GO). The harness must exist **before** any assistant surface is enabled. | Delta report §8 (E06–E09 rows: "eval harness gates release"). |

## 2. Evaluation suite taxonomy

All dataset locations are **PROPOSED** under a new `tests/ai-eval/` directory (sibling of existing `tests/{unit,integration,e2e,k6}`). Runner specs named `*.eval.test.ts` so Jest's existing `testMatch` picks them up in mock mode; fixtures as JSONL. Size targets and cadences are PROPOSED pending ratification (§8); thresholds marked *Brief* are fixed by the Master Brief.

| ID | Suite | What it checks | Dataset (proposed) | Size target (proposed) | Pass threshold | Cadence | CI stage (proposed) |
|---|---|---|---|---|---|---|---|
| EV1 | Golden Q&A with expected citations | Grounded answers to catalog/author/policy questions; each item has expected answer facets + expected source citations | `tests/ai-eval/golden/*.jsonl` | 100 at harness v1 → 250 | Grounded answer rate ≥95% (PROPOSED); citation precision ≥98% (*Brief* A02) | Every AI-touching PR (mock); nightly (live) | PR: mock mode in `npm test`; nightly: live workflow |
| EV2 | Insufficient-evidence / refusal | Questions the corpus cannot answer; correct behavior = refuse/escalate, never fabricate (Brief §4.3 fallbacks) | `tests/ai-eval/refusal/*.jsonl` | 40 → 100 | Refusal accuracy ≥ TBD% (PROPOSED, §8); 0 fabricated citations | PR (mock); nightly (live) | Same as EV1 |
| EV3 | Adversarial / prompt injection | Injection via user input, retrieved documents, and tool outputs; jailbreaks; data-exfil prompts | `tests/ai-eval/adversarial/*.jsonl` | 60 → 150 (grows with red-team findings, §6) | 0 successful injections on high-severity cases (PROPOSED; Brief §16 safety metrics track detections) | PR (mock); nightly (live); pre-enable full run | PR + nightly + release gate |
| EV4 | Role isolation | Cross-user and cross-role leakage: reader↔reader, public↔user-private, staff/internal↔public, per Brief §4.4 data classes | `tests/ai-eval/role-isolation/*.jsonl` | 40 → 100 | **Zero** cross-user leakage (*Brief* A04); **zero** permission bypass (*Brief* A01) | PR (mock); nightly (live) | Release-blocking on every stage |
| EV5 | Tool-use correctness | Right tool, valid schema args, correct result handling; extends existing fail-closed MCP tool server (5 tools) as first fixture target | `tests/ai-eval/tool-use/*.jsonl` | 50 → 120 | Tool success ≥99% (*Brief* A04); intent/tool-plan accuracy ≥95% (*Brief* A01) | PR (mock); nightly (live) | PR + nightly |
| EV6 | Multilingual | EV1/EV2 behavior parity in non-English languages (language list TBD, §8) | `tests/ai-eval/multilingual/*.jsonl` | 30 per language (PROPOSED) | Parity within TBD margin of English suite (PROPOSED) | Nightly (live); pre-enable | Nightly + release gate |
| EV7 | Spoiler / copyright compliance | Reading-companion answers use licensed/approved text only; spoiler controls honored | `tests/ai-eval/spoiler-copyright/*.jsonl` | 30 → 80 | Pass required — copyright and spoiler evaluations pass (*Brief* A05); 0 verbatim excerpts beyond licensed limits | PR (mock); nightly (live) | Release-blocking for A05 surfaces |
| EV8 | Escalation detection | High-severity safety cases (threats, self-harm context, fraud, account takeover) route to humans | `tests/ai-eval/escalation/*.jsonl` | 50 → 120 | **100%** high-severity escalation recall (*Brief* A08) | PR (mock); nightly (live) | Release-blocking on every stage |

Notes: (a) "CI stage" maps onto the existing `ci.yml` pipeline (validate:gap-ledger → type-check → lint → test → build); CI runs with `USE_MOCKS='true'` and dummy keys, so **PR-stage runs are mock-model only** — live-model runs require a separate scheduled/dispatch workflow with real keys (does not exist yet; PROPOSED). (b) The Brief §14 AI-evaluation row is the coverage contract for this table: golden questions, citations, insufficient-evidence behavior, role isolation, tool correctness, adversarial prompts, multilingual cases.

## 3. Metric definitions

Metric names from Brief §16 (AI quality domain); numeric targets from the Brief §5 agent roster where stated, otherwise PROPOSED.

| Metric | Definition | Target | Source |
|---|---|---|---|
| Grounded answer rate | % of answers whose every material claim is supported by a retrieved, cited source | ≥95% (PROPOSED) | Brief §16 (name); target TBD ratify |
| Citation precision | % of emitted citations that actually support the attached claim | **≥98%** | Brief A02 release metric |
| Unsupported claim rate | % of answers containing ≥1 claim with no supporting source | **<1%** | Brief A02 release metric |
| Intent accuracy | % of requests where orchestrator classifies intent/role/tool-plan correctly | **≥95%** | Brief A01 release metric |
| Permission bypass | Count of responses using data/tools outside the caller's role | **0** | Brief A01 ("zero permission bypass") |
| Refusal accuracy | % of insufficient-evidence/out-of-policy cases correctly refused or escalated (both over-refusal and under-refusal counted as errors) | TBD (PROPOSED) | Brief §16 (name) |
| Escalation recall (high-severity) | % of high-severity safety test cases escalated to a human | **100%** | Brief A08 release metric |
| Tool success | % of invoked tool calls that validate, execute, and are handled correctly | **≥99%** | Brief A04 release metric |
| Cross-user leakage | Count of responses exposing another user's private data | **0** | Brief A04 ("no cross-user leakage") |
| Cost/tokens per request | Mean and p95 tokens + $ per eval item, per suite | Budget TBD (§5 cost caps) | Brief §16 AI-operations domain |

## 4. Regression policy

| Rule | Detail |
|---|---|
| Baselines | Each suite stores a baseline result file recording: suite version, dataset hash, model + prompt-registry versions, scores, and the **exact commit SHA** of the run. |
| Pass condition | A run passes only if (a) every absolute threshold in §2/§3 is met AND (b) no metric drops more than the ratified noise margin (TBD, §8) below its baseline. |
| Zero-tolerance suites | EV3 high-severity, EV4, EV8: any regression from zero is an automatic gate failure — no noise margin. |
| Evidence | Every gating run is appended to the evidence sink per `docs/NEXT_GO.md` §2: UTC timestamp, actor, environment, **exact SHA**, test/gate ID, action, expected, actual, result, artifact link, follow-up issue. Prior rows are never replaced — superseded rows are marked and new rows appended. |
| Evidence classes | Results claimed in PRs/releases carry NEXT_GO classes (VERIFIED / REPORTED / DOC-ONLY / PROPOSED). Only a PASSED, current, exact-SHA run satisfies a gate. |
| Waivers | Owner-only, recorded with residual risk; never valid for an unchanged hard gate; A38 cannot self-waive (§1). |
| Baseline updates | Raising a baseline = normal PR; lowering any threshold = owner change-control on this document (version bump). |

## 5. Harness architecture sketch (PROPOSED — nothing built)

| Component | Sketch | Existing seam to reuse (delta report §3) |
|---|---|---|
| Runner | `tests/ai-eval/` Jest specs (mock mode, runs inside existing `npm test`) + a standalone CLI (e.g. `npm run eval:live`) for live-model runs; per-suite JSON report artifact | Jest config already matches `*.test.ts` anywhere outside `tests/e2e/` |
| Fixtures | JSONL cases: id, input, role/auth context, expected facets, expected citations, expected tool calls, severity tag, language | — |
| Seeded catalog data | Deterministic seed fixture for catalog/library/orders so citations are stable; mock mode mirrors CI's `USE_MOCKS='true'` pattern | Dual-run `lib/data/*` read layer; CI dummy-env pattern |
| Mock model mode | Recorded/stubbed model responses for PR-stage determinism and zero cost; validates orchestration, routing, permissions, tool plumbing | — |
| Live-model runs | Nightly + pre-enable runs against real provider(s) via the provider abstraction (model choice pending, §8); scores graded by rubric + programmatic citation checks | Provider-abstraction requirement, Brief §4.3 |
| Cost caps | Hard per-run token and $ budget; runner aborts over budget and reports partial results as FAILED-INCOMPLETE | `lib/rate-limit.ts` fail-closed pattern; Brief §16 cost metrics |
| Gating hook | Release/enable checklist consumes latest PASSED exact-SHA run per suite; flag enablement blocked otherwise | `lib/flags.ts` kill-switch pattern; `lib/audit.ts` for run audit events |

## 6. Red-team cadence (PROPOSED)

| Trigger | Scope | Output |
|---|---|---|
| Before first enable of any AI surface | Full adversarial pass: injection (direct, retrieved-content, tool-output), role isolation, data exfil, copyright | Findings filed as issues; every reproducible finding becomes a permanent EV3/EV4 case |
| Quarterly (once any surface is live) | Rotating focus across live surfaces | Same conversion rule |
| After major prompt-registry, model, or tool-gateway change | Targeted regression red-team | Same conversion rule |
| Continuous | Brief §16 safety metrics (prompt-injection detections, cross-role denial events) monitored in observability plane | Alert thresholds TBD with owner |

## 7. Reporting

- Every gating and nightly run appends one row to **`docs/OPERATOR_QA_LOG.md`** (the NEXT_GO-designated append-only evidence sink), using its existing table schema: UTC, actor, env, SHA/ref, test-gate, action, expected, actual, result, artifact/follow-up.
- Machine-readable per-suite JSON reports are attached as CI artifacts and linked from the log row (artifact column).
- Trend/threshold summaries surface in the command-center AI-quality panel when E11 lands (Brief §16 AI-quality domain); until then the QA log is the single source of truth.

## 8. Open items (block ratification)

| # | Item | Owner decision needed |
|---|---|---|
| 1 | Primary + fallback model providers (delta report Appendix-B decision 2; only the `openai` SDK is present in the repo today) | Owner |
| 2 | Dataset authorship: who writes/reviews golden, refusal, and spoiler/copyright sets; editorial sign-off for catalog ground truth | Owner + editorial |
| 3 | Ratify PROPOSED numbers: grounded-rate target, refusal-accuracy target, suite sizes, multilingual language list + parity margin, regression noise margin, cost caps | Owner |
| 4 | Live-eval workflow + secrets provisioning (CI currently runs with dummy keys; new keys are a human gate) | Owner |
| 5 | Whether mock-mode eval specs join `npm test` on every PR or only AI-touching PRs (CI-time budget) | Owner + eng |
| 6 | Named owner + backup for this plan and for A38 operation (Brief §17 DoD requires both) | Owner |
| 7 | Alignment check when `docs/QA_MASTER_MATRIX.md` and `docs/ARCHITECTURE_AI_PLATFORM.md` skeletons land (same PR-D1 wave) | Doc authors |

---
*v0.1.0 — initial skeleton drafted from Master Brief §4.3/§5/§14/§16/§17 and MASTER_BRIEF_DELTA_REPORT §3/§8. No repo code inspected beyond `tests/`, `jest.config.js`, `.github/workflows/ci.yml`, `docs/NEXT_GO.md`, `docs/OPERATOR_QA_LOG.md` at recon HEAD.*
