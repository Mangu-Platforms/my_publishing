# Skill Registry — Mangu Publishers

> **DRAFT — PROPOSED, NOT RATIFIED.** **Version:** v0.1.0 · **Date:** 2026-07-29 · **Owner:** TBD · **Proposed repo path:** `docs/SKILL_REGISTRY.md` (task **T-13.1**, freeze #209 **class 1**).
> **Documentation-only.** This file **builds nothing**: no code, no schema, no runtime, no flag, no permission, no secret provisioned — the "registry now (docs)" step only. **No secrets, tokens, credentials, PII, or manuscript text in this document — ever** (public repo; Brief §0 rule; delta R6).
> **No skill may be invoked until it is (a) registered here with a complete §2 record and (b) approved by the owner.** A skill absent from this registry may not be invoked — by any agent, under any role, on any surface. Every row below is **PROPOSED**; nothing here authorizes anything to run.
> **Sources:** Master Brief §6 (complete site skill catalog) and §7 (skill specification template) · `docs/MASTER_BRIEF_DELTA_REPORT.md` §9 · repo `origin/main` `36f7528`.
> **Dovetails with, does not restate:** `AGENT_REGISTRY.md` (who may invoke) · `ARCHITECTURE_AI_PLATFORM.md` §3 (the tool gateway that enforces every invocation) · `AI_EVALUATION_PLAN.md` (release gates and thresholds) · `AI_SAFETY_PRIVACY_POLICY.md` (data-class rules).

---

## 1. Purpose and relationship to the Agent Registry

Master Brief §5: **an agent is a bounded worker** with a role, goal, tools, memory policy, permissions, and exit conditions; **a skill is a discrete capability an agent may invoke.** The two registries are deliberately separate and non-overlapping.

| `AGENT_REGISTRY.md` | This file |
|---|---|
| **Who** runs — A01–A40 roster, audience, primary duty, hard boundary, RBAC scope, kill switch, release metric | **What** may be invoked — the `SK-*` catalog, its inputs/outputs, decision policy, tests |
| An agent absent from that registry **may not run** | A skill absent from this registry **may not be invoked** |
| Grants the permission ceiling; lifecycle per its §7 | Consumes the ceiling and never exceeds it; same lifecycle, mirrored (§6) |

Enforcement is **not** this document. Every invocation is gated at the **tool gateway** (`ARCHITECTURE_AI_PLATFORM.md` §3: schema validation → RBAC → policy → rate limit → timeout → idempotency → audit → confirmation), which generalizes the existing fail-closed `lib/mcp/guard.ts` + `lib/audit.ts` + `lib/rate-limit.ts` seams. Quality thresholds are defined once in `AI_EVALUATION_PLAN.md` §2–§3; this registry names which suites a skill must pass, it does not restate numbers.

## 2. Skill specification template (Master Brief §7)

Every skill gets one full record with all fifteen fields. **A skill may not leave PROPOSED until its record is complete, owner-signed, and its permission ceiling certified (§6).** No partial records; "TBD" in any required field blocks approval. The §4 catalog is the terse index only — no full records exist yet.

| Field | Required content |
|---|---|
| Skill ID and version | Stable identifier, semantic version, owner, status, deprecation date |
| Purpose | One sentence defining the outcome **and what the skill must not do** |
| Eligible agents and roles | Exact agents (A-IDs) and user roles permitted to invoke it |
| Trigger | Intent labels, UI events, scheduled events, or system conditions |
| Inputs | Strict JSON schema, required/optional fields, size limits, allowed classifications |
| Preconditions | Authentication, entitlement, consent, source freshness, feature flags, dependencies |
| Tools | Named tools/endpoints with scope, timeout, retries, and idempotency behavior |
| Decision policy | When to ask, act, refuse, escalate, or request confirmation |
| Outputs | Strict schema plus user-visible rendering rules and citation requirements |
| Memory | What may be remembered, for how long, and how deletion works |
| Safety and privacy | Forbidden data, redaction, prompt-injection handling, logging restrictions |
| Failure behavior | Dependency failure, partial success, stale data, invalid input, and rollback |
| Observability | Events, trace fields, cost fields, metrics, alerts, and dashboards |
| Tests | Unit, integration, policy, adversarial, accessibility, load, and evaluation cases |
| Acceptance criteria | Measurable thresholds and evidence required for release |

## 3. Skill ID scheme

**`SK-<GROUP>-<nn>`** — e.g. `SK-CONV-01`, `SK-AIP-29`. Rules: IDs are stable and **never reused**, even after retirement; `<nn>` is the skill's zero-padded Brief §6 ordinal within its catalog, so every ID traces back to an exact Brief line; group codes are a **closed set** (adding one is a change-control amendment to this document, not an ad-hoc prefix); semantic version lives in the skill's own §2 record, never in the ID. **Count reconciliation:** Brief §6 publishes **ten** catalogs — some summaries say eight; that undercount is corrected here — totalling **204 skills**, taken verbatim below. No skill has been invented, merged, split, or dropped.

| Code | Brief §6 catalog | Count |
|---|---|---|
| `CONV` | Conversation, identity, and safety | 16 |
| `CAT` | Catalog and discovery | 20 |
| `ACCT` | Reader account and commerce | 18 |
| `READ` | Reading and learning | 13 |
| `AUTH` | Author and submission | 20 |
| `EDIT` | Editorial and production | 24 |
| `MKT` | Marketing, sales, and community | 20 |
| `OPS` | Operations and analytics | 19 |
| `ENG` | Engineering and QA | 25 |
| `AIP` | AI platform and governance | 29 |
| **Total** | **10 catalogs** | **204** |

## 4. Catalog

Status of every row: **PROPOSED**. The "Eligible agents" column is a **non-binding hint** mapping to `AGENT_REGISTRY.md` A-IDs where the Brief makes the owner obvious; it is superseded by the exact allowlist in each skill's §2 record and by the gateway's runtime RBAC check. `TBD` = no obvious owner in the current roster.
### CONV — Conversation, identity, and safety (16)
| ID | Skill | Status | Eligible agents (hint) |
|---|---|---|---|
| SK-CONV-01 | Intent classification | PROPOSED | A01 |
| SK-CONV-02 | Role and entitlement resolution | PROPOSED | A01 |
| SK-CONV-03 | Conversation summarization | PROPOSED | A01 |
| SK-CONV-04 | Session context management | PROPOSED | A01 |
| SK-CONV-05 | Clarifying-question generation | PROPOSED | A01 |
| SK-CONV-06 | Language detection and localization | PROPOSED | A01 |
| SK-CONV-07 | Tone adaptation | PROPOSED | A01 |
| SK-CONV-08 | Spoiler preference enforcement | PROPOSED | A05 |
| SK-CONV-09 | Safety classification | PROPOSED | A08 |
| SK-CONV-10 | Abuse and harassment detection | PROPOSED | A08, A26 |
| SK-CONV-11 | PII redaction | PROPOSED | A08, A40 |
| SK-CONV-12 | Prompt-injection detection | PROPOSED | A08, A34 |
| SK-CONV-13 | Tool-output sanitization | PROPOSED | A01, A34 |
| SK-CONV-14 | Human escalation | PROPOSED | A08 |
| SK-CONV-15 | Consent capture | PROPOSED | A04, A08 |
| SK-CONV-16 | User feedback capture | PROPOSED | A01, A03 |
### CAT — Catalog and discovery (20)
| ID | Skill | Status | Eligible agents (hint) |
|---|---|---|---|
| SK-CAT-01 | Catalog search | PROPOSED | A02 |
| SK-CAT-02 | Faceted filtering | PROPOSED | A02 |
| SK-CAT-03 | Semantic search | PROPOSED | A02, A37 |
| SK-CAT-04 | Author search | PROPOSED | A02 |
| SK-CAT-05 | Series and reading-order lookup | PROPOSED | A02 |
| SK-CAT-06 | Format and edition comparison | PROPOSED | A02 |
| SK-CAT-07 | Availability lookup | PROPOSED | A02 |
| SK-CAT-08 | Price lookup from authoritative source | PROPOSED | A02, A23 |
| SK-CAT-09 | Genre and theme discovery | PROPOSED | A02, A03 |
| SK-CAT-10 | Mood-based discovery | PROPOSED | A03 |
| SK-CAT-11 | Age/audience suitability lookup | PROPOSED | A02 |
| SK-CAT-12 | Accessibility-format discovery | PROPOSED | A06 |
| SK-CAT-13 | New release lookup | PROPOSED | A02 |
| SK-CAT-14 | Bestseller/trending lookup | PROPOSED | A02, A23 |
| SK-CAT-15 | Award lookup | PROPOSED | A02 |
| SK-CAT-16 | Event lookup | PROPOSED | A02, A27 |
| SK-CAT-17 | Comparable-title discovery | PROPOSED | A03, A11 |
| SK-CAT-18 | Recommendation explanation | PROPOSED | A03 |
| SK-CAT-19 | Recommendation diversification | PROPOSED | A03 |
| SK-CAT-20 | Recommendation feedback learning | PROPOSED | A03 |
### ACCT — Reader account and commerce (18)
| ID | Skill | Status | Eligible agents (hint) |
|---|---|---|---|
| SK-ACCT-01 | Account creation guidance | PROPOSED | A04 |
| SK-ACCT-02 | Email-verification guidance | PROPOSED | A04, A07 |
| SK-ACCT-03 | Password reset guidance | PROPOSED | A04, A07 |
| SK-ACCT-04 | OAuth sign-in guidance | PROPOSED | A04, A07 |
| SK-ACCT-05 | Profile update | PROPOSED | A04 |
| SK-ACCT-06 | Wishlist add/remove | PROPOSED | A04 |
| SK-ACCT-07 | Library lookup | PROPOSED | A04 |
| SK-ACCT-08 | Order-history lookup | PROPOSED | A04 |
| SK-ACCT-09 | Receipt retrieval | PROPOSED | A04, A07 |
| SK-ACCT-10 | Download entitlement check | PROPOSED | A04 |
| SK-ACCT-11 | Reading-progress lookup/update | PROPOSED | A04, A05 |
| SK-ACCT-12 | Bookmark management | PROPOSED | A04 |
| SK-ACCT-13 | Review eligibility check | PROPOSED | A04, A26 |
| SK-ACCT-14 | Review drafting assistance | PROPOSED | A04 |
| SK-ACCT-15 | Support-case creation | PROPOSED | A07 |
| SK-ACCT-16 | Refund-request routing | PROPOSED | A07 (human-approval matrix) |
| SK-ACCT-17 | Gift and bundle guidance | PROPOSED | A04, A23 |
| SK-ACCT-18 | Cart troubleshooting | PROPOSED | A07 |
### READ — Reading and learning (13)
| ID | Skill | Status | Eligible agents (hint) |
|---|---|---|---|
| SK-READ-01 | Book overview | PROPOSED | A02, A05 |
| SK-READ-02 | Spoiler-free summary | PROPOSED | A05 |
| SK-READ-03 | Chapter recap from licensed content | PROPOSED | A05 |
| SK-READ-04 | Character and concept lookup | PROPOSED | A05 |
| SK-READ-05 | Vocabulary explanation | PROPOSED | A05 |
| SK-READ-06 | Discussion-question generation | PROPOSED | A05, A27 |
| SK-READ-07 | Book-club guide creation | PROPOSED | A05, A27 |
| SK-READ-08 | Reading-plan creation | PROPOSED | A05 |
| SK-READ-09 | Progress coaching | PROPOSED | A05 |
| SK-READ-10 | Theme analysis | PROPOSED | A05 |
| SK-READ-11 | Citation to approved excerpts | PROPOSED | A05, A37 |
| SK-READ-12 | Audiobook chapter navigation | PROPOSED | A05, A17 |
| SK-READ-13 | Accessibility reading guidance | PROPOSED | A06 |
### AUTH — Author and submission (20)
| ID | Skill | Status | Eligible agents (hint) |
|---|---|---|---|
| SK-AUTH-01 | Author onboarding checklist | PROPOSED | A09 |
| SK-AUTH-02 | Submission requirement lookup | PROPOSED | A09 |
| SK-AUTH-03 | File-format validation | PROPOSED | A10 |
| SK-AUTH-04 | Virus-scan status check | PROPOSED | A10 |
| SK-AUTH-05 | Metadata completeness check | PROPOSED | A10, A11 |
| SK-AUTH-06 | Title/subtitle validation | PROPOSED | A11 |
| SK-AUTH-07 | Description drafting | PROPOSED | A11 |
| SK-AUTH-08 | Keyword suggestion | PROPOSED | A11 |
| SK-AUTH-09 | Category suggestion | PROPOSED | A11 |
| SK-AUTH-10 | Audience definition | PROPOSED | A11 |
| SK-AUTH-11 | Comparable-title suggestion | PROPOSED | A11 |
| SK-AUTH-12 | Author bio drafting | PROPOSED | A09 |
| SK-AUTH-13 | Cover-spec validation | PROPOSED | A16 |
| SK-AUTH-14 | Manuscript status lookup | PROPOSED | A09, A10 |
| SK-AUTH-15 | Revision checklist creation | PROPOSED | A12 |
| SK-AUTH-16 | Submission draft save | PROPOSED | A09 |
| SK-AUTH-17 | Submission confirmation gate | PROPOSED | A09, A10 |
| SK-AUTH-18 | Rights declaration capture | PROPOSED | A15 |
| SK-AUTH-19 | Accessibility checklist | PROPOSED | A06, A16 |
| SK-AUTH-20 | Royalty/revenue explanation | PROPOSED | A09, A23 |
### EDIT — Editorial and production (24)
| ID | Skill | Status | Eligible agents (hint) |
|---|---|---|---|
| SK-EDIT-01 | Structural editorial analysis | PROPOSED | A12 |
| SK-EDIT-02 | Line-edit suggestions | PROPOSED | A13 |
| SK-EDIT-03 | Copyedit flags | PROPOSED | A13 |
| SK-EDIT-04 | Style-sheet generation | PROPOSED | A13 |
| SK-EDIT-05 | Consistency checking | PROPOSED | A13 |
| SK-EDIT-06 | Fact-check task extraction | PROPOSED | A13 |
| SK-EDIT-07 | Citation verification queue | PROPOSED | A13 |
| SK-EDIT-08 | Plagiarism-risk routing | PROPOSED | A14 |
| SK-EDIT-09 | Sensitivity-risk flagging | PROPOSED | A14 |
| SK-EDIT-10 | Defamation-risk routing | PROPOSED | A14 |
| SK-EDIT-11 | Permissions checklist | PROPOSED | A15 |
| SK-EDIT-12 | Image rights checklist | PROPOSED | A15 |
| SK-EDIT-13 | ISBN metadata checklist | PROPOSED | A16 |
| SK-EDIT-14 | Interior-file preflight | PROPOSED | A16 |
| SK-EDIT-15 | ePub validation | PROPOSED | A16 |
| SK-EDIT-16 | PDF validation | PROPOSED | A16 |
| SK-EDIT-17 | Cover preflight | PROPOSED | A16 |
| SK-EDIT-18 | Print specification check | PROPOSED | A16 |
| SK-EDIT-19 | Audiobook script preparation | PROPOSED | A17 |
| SK-EDIT-20 | Pronunciation lexicon | PROPOSED | A17 |
| SK-EDIT-21 | Audio QC checklist | PROPOSED | A17 |
| SK-EDIT-22 | Comic panel order validation | PROPOSED | A18 |
| SK-EDIT-23 | Alt-text drafting | PROPOSED | A18, A06 |
| SK-EDIT-24 | Release readiness scoring | PROPOSED | A16, A28 |
### MKT — Marketing, sales, and community (20)
| ID | Skill | Status | Eligible agents (hint) |
|---|---|---|---|
| SK-MKT-01 | Campaign brief generation | PROPOSED | A19 |
| SK-MKT-02 | Audience segment proposal | PROPOSED | A19 |
| SK-MKT-03 | Landing-page copy draft | PROPOSED | A19, A20 |
| SK-MKT-04 | Email copy draft | PROPOSED | A22 |
| SK-MKT-05 | Social copy draft | PROPOSED | A21 |
| SK-MKT-06 | Press-kit checklist | PROPOSED | A19 |
| SK-MKT-07 | Media pitch draft | PROPOSED | A19 |
| SK-MKT-08 | Ad variant generation | PROPOSED | A19 |
| SK-MKT-09 | SEO title/meta draft | PROPOSED | A20 |
| SK-MKT-10 | Structured-data validation | PROPOSED | A20 |
| SK-MKT-11 | Internal-link suggestion | PROPOSED | A20 |
| SK-MKT-12 | Merchandising row proposal | PROPOSED | A23 |
| SK-MKT-13 | Bundle proposal | PROPOSED | A23 |
| SK-MKT-14 | Promotion calendar | PROPOSED | A19, A23 |
| SK-MKT-15 | A/B test hypothesis | PROPOSED | A19, A24 |
| SK-MKT-16 | Community prompt generation | PROPOSED | A27 |
| SK-MKT-17 | Book-club setup | PROPOSED | A27 |
| SK-MKT-18 | Reading challenge setup | PROPOSED | A27 |
| SK-MKT-19 | Event FAQ generation | PROPOSED | A27 |
| SK-MKT-20 | Campaign performance summary | PROPOSED | A19, A24 |
### OPS — Operations and analytics (19)
| ID | Skill | Status | Eligible agents (hint) |
|---|---|---|---|
| SK-OPS-01 | KPI definition lookup | PROPOSED | A24 |
| SK-OPS-02 | Dashboard explanation | PROPOSED | A24, A29 |
| SK-OPS-03 | Anomaly detection | PROPOSED | A24, A29 |
| SK-OPS-04 | Funnel analysis | PROPOSED | A24 |
| SK-OPS-05 | Cohort analysis | PROPOSED | A24 |
| SK-OPS-06 | Experiment readout | PROPOSED | A24 |
| SK-OPS-07 | Forecast draft | PROPOSED | A24, A39 |
| SK-OPS-08 | Content pipeline status | PROPOSED | A28 |
| SK-OPS-09 | Release dependency tracking | PROPOSED | A28 |
| SK-OPS-10 | Task creation | PROPOSED | A28, A30 |
| SK-OPS-11 | Ticket classification | PROPOSED | A30 |
| SK-OPS-12 | SLA tracking | PROPOSED | A29, A30 |
| SK-OPS-13 | Incident severity assignment | PROPOSED | A30 |
| SK-OPS-14 | Runbook lookup | PROPOSED | A30 |
| SK-OPS-15 | Status-page draft | PROPOSED | A30 |
| SK-OPS-16 | Postmortem draft | PROPOSED | A31 |
| SK-OPS-17 | Vendor status correlation | PROPOSED | A29 |
| SK-OPS-18 | Cost attribution | PROPOSED | A39 |
| SK-OPS-19 | Capacity forecast | PROPOSED | A39 |
### ENG — Engineering and QA (25)
| ID | Skill | Status | Eligible agents (hint) |
|---|---|---|---|
| SK-ENG-01 | Repository inventory | PROPOSED | A33 |
| SK-ENG-02 | Dependency audit | PROPOSED | A34 |
| SK-ENG-03 | Architecture conformance check | PROPOSED | A33, A34 |
| SK-ENG-04 | Code search | PROPOSED | A31, A32 |
| SK-ENG-05 | Issue deduplication | PROPOSED | A30 |
| SK-ENG-06 | Bug reproduction | PROPOSED | A30, A33 |
| SK-ENG-07 | Log and trace correlation | PROPOSED | A31 |
| SK-ENG-08 | Root-cause hypothesis | PROPOSED | A31 |
| SK-ENG-09 | Minimal patch generation | PROPOSED | A32 (no direct main push) |
| SK-ENG-10 | Unit-test generation | PROPOSED | A32, A33 |
| SK-ENG-11 | Integration-test generation | PROPOSED | A33 |
| SK-ENG-12 | Playwright test generation | PROPOSED | A33 |
| SK-ENG-13 | Visual regression comparison | PROPOSED | A33 |
| SK-ENG-14 | Accessibility audit | PROPOSED | A33, A06 |
| SK-ENG-15 | Performance audit | PROPOSED | A33 |
| SK-ENG-16 | Security scan | PROPOSED | A34 |
| SK-ENG-17 | Secret scan | PROPOSED | A34 |
| SK-ENG-18 | RBAC test | PROPOSED | A34 |
| SK-ENG-19 | API contract test | PROPOSED | A33 |
| SK-ENG-20 | Migration verification | PROPOSED | A35, A36 |
| SK-ENG-21 | Data reconciliation | PROPOSED | A36 |
| SK-ENG-22 | Deployment smoke test | PROPOSED | A35 |
| SK-ENG-23 | Rollback verification | PROPOSED | A35 |
| SK-ENG-24 | PR summary | PROPOSED | A32 |
| SK-ENG-25 | Release-note generation | PROPOSED | A28, A32 |
### AIP — AI platform and governance (29)
| ID | Skill | Status | Eligible agents (hint) |
|---|---|---|---|
| SK-AIP-01 | Knowledge-source registration | PROPOSED | A37 |
| SK-AIP-02 | Document ingestion | PROPOSED | A37 |
| SK-AIP-03 | Chunking | PROPOSED | A37 |
| SK-AIP-04 | Metadata enrichment | PROPOSED | A37 |
| SK-AIP-05 | Embedding generation | PROPOSED | A37 |
| SK-AIP-06 | Index update | PROPOSED | A37 |
| SK-AIP-07 | Freshness and expiry enforcement | PROPOSED | A37 |
| SK-AIP-08 | Retrieval | PROPOSED | A37, A01 |
| SK-AIP-09 | Reranking | PROPOSED | A37 |
| SK-AIP-10 | Citation assembly | PROPOSED | A37, A02 |
| SK-AIP-11 | Answer grounding check | PROPOSED | A38 |
| SK-AIP-12 | Model routing | PROPOSED | A01, A39 |
| SK-AIP-13 | Fallback routing | PROPOSED | A01, A39 |
| SK-AIP-14 | Prompt versioning | PROPOSED | A40 |
| SK-AIP-15 | Tool schema validation | PROPOSED | A40, A34 |
| SK-AIP-16 | Permission policy evaluation | PROPOSED | A40 |
| SK-AIP-17 | Rate limiting | PROPOSED | A39 |
| SK-AIP-18 | Token budgeting | PROPOSED | A39 |
| SK-AIP-19 | Response caching | PROPOSED | A39 |
| SK-AIP-20 | Trace logging | PROPOSED | A29, A40 |
| SK-AIP-21 | Evaluation execution | PROPOSED | A38 (cannot waive a gate) |
| SK-AIP-22 | Red-team execution | PROPOSED | A38, A34 |
| SK-AIP-23 | Hallucination scoring | PROPOSED | A38 |
| SK-AIP-24 | Citation scoring | PROPOSED | A38 |
| SK-AIP-25 | Latency monitoring | PROPOSED | A29, A39 |
| SK-AIP-26 | Cost monitoring | PROPOSED | A39 |
| SK-AIP-27 | Agent permission review | PROPOSED | A40 |
| SK-AIP-28 | Agent suspension | PROPOSED | A40 (proposes only; admin acts) |
| SK-AIP-29 | Data deletion and retention enforcement | PROPOSED | A40 |

## 5. Minimum implementation contract and minimum verification

Brief §6 states these identically for **all 204 skills**, so they are stated **once here** and never repeated per row. They are the floor, not the ceiling — a skill's §2 record may add stricter requirements, never looser ones. **Minimum implementation contract, every skill, no exceptions:**

| Requirement | Meaning here |
|---|---|
| Explicit schema | Strict input and output schemas; unvalidated input is rejected at the gateway, never coerced |
| Role check | Caller's role and entitlement verified per invocation; deny-by-default allowlist, no wildcards |
| Audit event | One `lib/audit.ts`-pattern event per invocation; **no audit, no action** — writes fail closed |
| Timeout | Bounded wall-clock per call; expiry is a failure, not a silent partial result |
| Deterministic error shape | One documented error taxonomy; identical inputs produce identical error codes |

**Minimum verification (before any skill leaves PROPOSED):** a **unit** test, a **policy** test (role/permission enforcement), an **integration** test, and a **user-visible failure state** — the surface must show an honest unavailable/failed state, never a fabricated answer. Adversarial, accessibility, load, and evaluation cases are additionally required where the §2 record names them; suite IDs and thresholds come from `AI_EVALUATION_PLAN.md` §2–§3 (EV1–EV8) and are not restated here.

## 6. Lifecycle, approval, and the permission ceiling

Lifecycle mirrors `AGENT_REGISTRY.md` §7 exactly — same states, same discipline, no state skipping: `PROPOSED → APPROVED → ACTIVE → SUSPENDED → RETIRED`.

| Transition | Requires |
|---|---|
| PROPOSED → APPROVED | Owner sign-off on the complete §2 record; §5 contract implemented; tools + RBAC scope certified (A34-style review); eval cases defined (A38-style); flag-off default tested |
| APPROVED → ACTIVE | §5 verification green; acceptance criteria met with exact-SHA evidence; audit events verified flowing; budget assigned; **at least one ACTIVE eligible agent** exists |
| ACTIVE → SUSPENDED | Kill switch — any admin, immediately, no approval needed to *suspend*; triggers: incident, eval regression, drift, failed recertification, budget breach. **Suspending an agent suspends its skills' invocation path with it** |
| SUSPENDED → ACTIVE | Root cause documented + owner re-approval |
| any → RETIRED | Invocation path removed, prompts archived, registry row retained (never deleted); ID never reused |

**Permission ceiling — the load-bearing rule.** A skill's effective permission is the **intersection** of its own declared scope and the invoking agent's `AGENT_REGISTRY.md` allowlist and RBAC scope. A skill **never** exceeds its invoking agent's ceiling, and never widens it — not by prompt, not by tool choice, not by chaining another skill. If a skill needs a permission its eligible agent lacks, the **agent's** registry record must be amended and re-approved first; approving the skill alone is not sufficient. Corollaries: a skill invoked by two agents runs at each agent's ceiling independently, never at the union; escalation of privilege via skill composition is a permission bypass and a release blocker (`AI_EVALUATION_PLAN.md` EV4, target zero). Actions in `AGENT_REGISTRY.md` §10 (publish, refund, sanction, deploy, gate waiver, secrets, activation) require a human regardless of which skill proposes them. Permission certification is **quarterly**, on the A40 cadence, covering skill scopes alongside agent scopes.

## 7. Open decisions (blocking; owners per delta report §9)

| # | Decision | Blocks |
|---|---|---|
| 1 | **First-release scope** — which of the 204 are in scope for release one, in what order. Recommendation: none until the assistant scope question (below) resolves; then sequence CONV + CAT first (A01–A03 read-only, public-source, lowest blast radius), ACCT/READ only after role-isolation evals pass | Every downstream item |
| 2 | Assistant in launch scope vs post-GO (delta §9.9 / C6) | Whether any skill builds before GO |
| 3 | Primary + fallback model providers (delta §9.2; only the `openai` SDK is present today) | All AIP-12/13 routing skills |
| 4 | Agent autonomy ceiling — ratify agents-draft/humans-merge (delta §9.6 / §9.12) | ENG-09, ENG-24, all write-capable skills |
| 5 | Conversation retention + unpublished-manuscript use (delta §9.3–9.4) | Every skill with a Memory field; READ-03, EDIT-01…07 |
| 6 | Internal knowledge sources: register + classify before any ingestion (delta §9.8) | All AIP-01…10 |
| 7 | Refund/account actions remain human-routed until policy-backed workflows exist (delta §9.7) | ACCT-16, ACCT-15 |
| 8 | Personalization boundaries; no sensitive inference (delta §9.5) | CAT-09/10/17…20 |
| 9 | Command-center read-only tokens (delta §9.10 / C8) | OPS-02/12/17, AIP-20/25 |
| 10 | Registry owner + backup named; first certification date set | Any transition past PROPOSED |

---
*v0.1.0 — drafted from Master Brief §6 (204 skills, ten catalogs, verbatim) and §7 (specification template). No code inspected or changed; no runtime created. Review via the PR carrying T-13.1. Every future edit bumps the version and records the approver.*
