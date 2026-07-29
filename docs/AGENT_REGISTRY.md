# Agent Registry — Mangu Publishers

> **DRAFT — PROPOSED, NOT RATIFIED.** Documentation-only artifact (freeze #209 class 1); creates no runtime, no permissions, no access. Nothing in this file authorizes any agent to run. **Owner sign-off required before any row moves past PROPOSED.**
>
> **Version:** 0.1.0 · **Date:** 2026-07-29 · **Owner:** TBD (proposed: Faith Beckwith) · **Proposed repo path:** `docs/AGENT_REGISTRY.md` (PR-D1 per delta report §10)
> **Sources:** Master Brief §5 roster · `docs/MASTER_BRIEF_DELTA_REPORT.md` (§3 seams, §4 E10, §6 conflicts, §8, §9) · repo HEAD `8246424`
> **No secrets, tokens, or PII in this document — ever** (public repo; Brief §0 rule; delta R6).

---

## 1. Purpose and scope

Single source of truth for every AI agent Mangu operates or proposes to operate. An agent absent from this registry may not run. Runtime build of any agent is post-GO / behind disabled flags (delta §8 E10); this document is the "registry now (docs)" step only.

## 2. Agent definition (from Master Brief §5)

> An agent is a bounded worker with a role, goal, tools, memory policy, permissions, and exit conditions. A skill is a discrete capability an agent may invoke. Agents do not receive blanket access merely because they are "internal."

## 3. Registry schema

Every agent gets one full record with these fields. The roster table (§5) is the terse index; full records live one-per-agent below it as agents advance past PROPOSED (none yet).

| Field | Meaning | Rule |
|---|---|---|
| ID | Stable `Ann` identifier | Never reused |
| Name | Role name | From Brief §5 |
| Audience | Who it serves | Public / Reader / Author / Staff / Marketing / Business / Community / Operations / Engineering / Security / AI Ops / Admin / Finance |
| Primary duty | One-sentence goal | No scope creep without re-approval |
| Hard boundary | What it must never do | Enforced in code, not prompt-only |
| Tools (allowlist) | Named tools only | Deny-by-default; no wildcard; per-tool grant recorded here |
| Permissions / RBAC scope | Roles + data classes readable/writable | Maps to existing RBAC middleware roles; least privilege |
| Prompt version ref | Pinned prompt/registry version | No unversioned prompts in ACTIVE |
| Memory policy | none / session / persistent+TTL | Persistent requires retention decision (delta §9.4) |
| Release metric | Gate to enter/stay ACTIVE | From Brief §5; measured by A38 evals |
| Status | Lifecycle state (§7) | PROPOSED default |
| Kill switch | Env flag and/or admin toggle | **Repo precedent:** `lib/flags.ts` env-flag registry (P-057, honest-unavailable contract) + the fail-closed `MCP_ENABLED` + bearer-key guard in `lib/mcp/guard.ts` / `app/api/mcp/[transport]/route.ts` (404 when off). Every agent ships flag-off by default, fail-closed. |

## 4. Kill-switch and gateway pattern (repo precedent, reuse not reinvent)

Per delta §3 seams: tool gateway extends the MCP guard (fail-closed flag + bearer + shared limiter `lib/rate-limit.ts`); budgets/kill-switches via `lib/flags.ts` pattern; every agent action emits an audit event via the single-writer `lib/audit.ts` pattern; observability rides Sentry + `lib/logger.ts`.

## 5. Roster A01–A40 (carried from Master Brief §5, terse)

Status: all **PROPOSED**. `PROPOSED*` = PROPOSED, precursor exists in-repo (see §6). Precursor names verified against `.claude/skills/` and `.github/workflows/` at HEAD.

| ID | Agent | Audience | Primary duty (terse) | Hard boundary (terse) | Release metric (terse) | Status | Existing precursors |
|---|---|---|---|---|---|---|---|
| A01 | Conversation Orchestrator | All users | Classify intent, role, risk, retrieval, tool plan | No direct writes; delegates only | Intent ≥95%; zero permission bypass | PROPOSED | (dev-side analogue: `mangu-navigator`) |
| A02 | Public Catalog Librarian | Public | Catalog/author/format/event/policy answers with citations | Public sources only | Citation precision ≥98% | PROPOSED | `mcp-catalog-authz`/`-ops`/`-write` + MCP server (adjacent) |
| A03 | Recommendation Curator | Public/Reader | Preference elicitation, explainable recs | No hidden sensitive inference; resettable profile | Satisfaction + diversity targets | PROPOSED | `mangu-ai-recommendations` (Resonance, live) |
| A04 | Authenticated Reader Concierge | Reader | Personal library/orders/wishlist/progress help | Owner-only data; confirm before changes | No cross-user leakage; tool success ≥99% | PROPOSED | `better-auth-mangu` (identity infra, adjacent) |
| A05 | Reading Companion | Reader | Summaries, prompts, plans, spoiler-aware help | Licensed/approved text only | Copyright + spoiler evals pass | PROPOSED | — |
| A06 | Accessibility Assistant | All users | Explain a11y features, formats, accommodations | Never diagnose disability; route complaints | WCAG support journeys pass | PROPOSED | — |
| A07 | Customer Support Triage | All users | Diagnose account/access/purchase/download issues | No refund/payment change w/o approved workflow | Correct routing; low false closure | PROPOSED | `stripe-webhook-mangu` (adjacent) |
| A08 | Safety and Escalation | All users | Detect threats, self-harm, fraud, takeover | Human escalation; minimum data | 100% high-severity escalation | PROPOSED | — |
| A09 | Author Onboarding | Author | Guide profile, submission readiness, metadata | Saves drafts; cannot publish | Submission completeness up | PROPOSED | — |
| A10 | Manuscript Intake | Author/Staff | Validate file, metadata, structure, scan status | Not final editorial authority | No malformed/unsafe upload accepted | PROPOSED | — |
| A11 | Metadata Enrichment | Author/Editorial | Suggest categories, keywords, descriptions, comps | Suggestions need approval; provenance | Schema validity + editor acceptance | PROPOSED | — |
| A12 | Editorial Assessment | Staff | Structured diagnostics + revision questions | No autonomous accept/reject | Consistent rubric; evidence-linked | PROPOSED | — |
| A13 | Copyediting Assistant | Staff/Author | Flag grammar, consistency, style, fact-check needs | No silent rewrite of author voice | Traceability; low false positives | PROPOSED | — |
| A14 | Sensitivity & Risk Review | Staff | Flag sensitive/defamatory/plagiarized content | Flags only; human/legal decides | High recall; explainable evidence | PROPOSED | `mangu-compliance` (adjacent) |
| A15 | Rights & Permissions Triage | Staff | Spot quotes/images/lyrics/trademark issues | Not legal advice; checklist only | Complete capture + routing | PROPOSED | `mangu-compliance` (adjacent) |
| A16 | Production Readiness | Staff | Check trim, formats, assets, ISBN, cover, a11y | Cannot release | 100% checklist before gate | PROPOSED | — |
| A17 | Audiobook Production | Staff | Track script, narrator, chapters, audio QC | No voice cloning w/o consent+policy | Audio QC + rights checks pass | PROPOSED | — |
| A18 | Comic & Graphic Content | Staff | Validate panels, order, dimensions, alt text | No unlicensed art generation | Reader flow + asset QA pass | PROPOSED | — |
| A19 | Marketing Campaign | Marketing | Draft plans, copy variants, schedules, segments | No auto-publish; no sensitive targeting | Brand/legal/approval checks pass | PROPOSED | — |
| A20 | SEO & Discoverability | Marketing | Optimize metadata, schema, links, indexability | No stuffing or deceptive pages | Technical SEO audit green | PROPOSED | — |
| A21 | Social Content | Marketing | Platform-specific posts + creative briefs | Publishing requires approval | Brand + factual consistency | PROPOSED | — |
| A22 | Email Lifecycle | Marketing/Support | Draft onboarding/launch/cart/reset emails | Consent, suppression, transactional rules | Deliverability + compliance gates | PROPOSED | — |
| A23 | Sales & Merchandising | Business | Suggest placements, bundles, featured rows | No price change w/o approval | Explainable recs + lift tests | PROPOSED | `mangu-content-commerce`, `mangu-partner-payouts` (adjacent) |
| A24 | Analytics Narrator | Staff | Explain KPIs, anomalies, funnels, experiments | No source-data change; marks uncertainty | Consistent metrics; no invented numbers | PROPOSED | — |
| A25 | Fraud & Abuse Triage | Operations | Flag suspicious logins, orders, scraping, bots | No permanent sanctions automatically | Precision/recall + appeals | PROPOSED | — |
| A26 | Content Moderation | Community/Staff | Classify reviews/comments/uploads vs policy | Borderline/high-impact to humans | Policy benchmark thresholds | PROPOSED | — |
| A27 | Community Manager | Community | Clubs, challenges, prompts, events, questions | No covert manipulation | Engagement + safety metrics | PROPOSED | — |
| A28 | Release Coordinator | Staff | Release checklist, dependencies, owners, blockers | Cannot publish or deploy | No missed critical dependency | PROPOSED | — |
| A29 | Command Center Orchestrator | Admin | Aggregate GitHub/Vercel/Atlas/Sentry/Stripe/AI health | Read-only by default | Status freshness + alert accuracy | PROPOSED* | `mangu-observability`; `/admin/health` + `/api/health` (delta §4 E11); tokens gated by C8/§9.10 |
| A30 | Incident Triage | Engineering | Cluster incidents, severity, evidence, tickets | No production change | MTTA reduction; severity accuracy | PROPOSED* | `mangu-ops-runbook`; `mangu-isr-cache`; `.cursor/automations/prod-health-triage` (delta §2) |
| A31 | Root Cause Analysis | Engineering | Correlate logs, traces, deploys, commits, tests | Conclusions labeled by confidence | RCA benchmark + evidence links | PROPOSED* | `phoenix-postmortem`; `mangu-ops-runbook` |
| A32 | Patch Drafting | Engineering | Minimal branch, patch, tests, PR for approved incidents | No direct main push; no secret access | CI green; rollback included | PROPOSED* | `merge-steward.yml` + agent-PR pattern (#350/#363/#364, delta §4 E12) |
| A33 | QA Swarm Coordinator | Engineering/Product | Test plans across UI/API/a11y/security/data | No prod mutation except safe synthetic | Coverage + escaped-defect targets | PROPOSED* | `mangu-ci-quality`; `ci.yml` pipeline |
| A34 | Security Review | Security | Scan code, deps, auth, RBAC, secrets, headers, tool perms | Findings only; remediation via PR | No critical issue released | PROPOSED* | `mangu-security-hygiene`; `mangu-env-and-secrets`; `mangu-rbac-admin`; `rotate-supabase-key.yml` |
| A35 | Deployment Verification | Engineering | Verify preview/prod health, routes, migrations, rollback | Cannot promote without approval | Deployment gate evidence complete | PROPOSED* | `merge-steward.yml` (adjacent); `phoenix-cutover` |
| A36 | Data Migration Reconciliation | Engineering/Data | Compare counts, checksums, samples during Phoenix | Read-only until approved repair script | Zero unexplained variance | PROPOSED | `phoenix-data-migration`, `phoenix-contract`, `phoenix-storage-blob`, `mongodb-atlas-mangu` (strong precursors; status per §6 note) |
| A37 | Knowledge Ingestion | AI Ops | Ingest approved sources, chunk, index, expire | Registered sources only; no restricted data | Freshness, coverage, dup thresholds | PROPOSED | Resonance vectors = RAG v0 seam (delta §3) |
| A38 | AI Evaluation | AI Ops | Golden sets, red-team, citation checks, regressions | Cannot waive failed gate | Release thresholds enforced | PROPOSED | — |
| A39 | AI Cost & Capacity | AI Ops/Finance | Track token/retrieval/tool costs; budgets, fallbacks | No silent quality degradation | Budget alerts + forecast accuracy | PROPOSED | budget seams: `lib/rate-limit.ts`, `lib/flags.ts` (delta §3) |
| A40 | Agent Governance Auditor | Admin | Review permissions, prompts, logs, drift, stale agents | Read-only; suspension proposal to admin | Quarterly certification; zero orphan access | PROPOSED | — |

## 6. Existing precursors — the 23 `.claude/skills` packs (verified by `ls` at HEAD)

These are **dev-time skill packs for coding agents, not runtime product agents** (delta §4 E10: "none are runtime product agents"). Mapping = nearest roster role the pack's knowledge seeds. Only A29–A35 are marked `PROPOSED*` above per this registry's scoping decision; A36's Phoenix packs are equally strong precursors and noted in its row.

| Pack | Nearest agent(s) | Pack | Nearest agent(s) |
|---|---|---|---|
| `better-auth-mangu` | A04/A25 (identity infra) | `mcp-catalog-authz` | A02 (adjacent) |
| `mangu-ai-recommendations` | A03 | `mcp-catalog-ops` | A02 (adjacent) |
| `mangu-ci-quality` | A33 | `mcp-catalog-write` | A02 (adjacent; writes approval-gated) |
| `mangu-compliance` | A14/A15 | `mongodb-atlas-mangu` | A36 |
| `mangu-content-commerce` | A23 | `phoenix-contract` | A36/A28 |
| `mangu-env-and-secrets` | A34 | `phoenix-cutover` | A35/A36 |
| `mangu-isr-cache` | A30/A35 | `phoenix-data-migration` | A36 |
| `mangu-navigator` | A01 (dev-side analogue) | `phoenix-postmortem` | A31 |
| `mangu-observability` | A29/A30 | `phoenix-storage-blob` | A36 |
| `mangu-ops-runbook` | A30/A31 | `stripe-webhook-mangu` | A07/A29 |
| `mangu-partner-payouts` | A23 | `mangu-security-hygiene` | A34 |
| `mangu-rbac-admin` | A34/A40 | | |

Workflows (verified): `ci.yml` → A33 · `merge-steward.yml` → A32/A35 · `rotate-supabase-key.yml` → A34. Also `.cursor/automations/` (phoenix-next-slice, prod-health-triage) → A30 (delta §2; note HUMAN_TASKS C0.1 pending).

## 7. Lifecycle

`PROPOSED → APPROVED → ACTIVE → SUSPENDED → RETIRED`

| Transition | Requires |
|---|---|
| PROPOSED → APPROVED | Owner sign-off on full §3 record; tool allowlist + RBAC scope certified (A34-style review); eval plan defined (A38-style); kill switch implemented and tested off |
| APPROVED → ACTIVE | Release metric evals pass; flag flipped by admin (human); audit events verified flowing; budget assigned |
| ACTIVE → SUSPENDED | Kill switch (env flag/admin toggle) — any admin, immediately, no approval needed to *suspend*; triggers: incident, drift, failed recertification, budget breach |
| SUSPENDED → ACTIVE | Root cause documented + owner re-approval |
| any → RETIRED | Access revoked, prompts archived, registry row retained (never deleted) |

No state skipping. Suspension is always cheap; activation is always gated.

## 8. Permission certification cadence

**Quarterly**, executed by A40 (until A40 exists: manual owner/admin review on the same cadence, first due 2026-10-29). Scope: per-agent tool allowlists vs actual grants, RBAC scopes, prompt version pins, kill-switch fire test, stale/orphan agent detection, log sampling. Output: certification record + sign-off; any failure → automatic suspension proposal. Matches A40's release metric ("quarterly certification and zero orphan access").

## 9. Audit and observability event requirements

Every agent invocation MUST emit (single-writer pattern per `lib/audit.ts` precedent; Sentry + `lib/logger.ts` plane):

- **Who/what:** agent ID, prompt version ref, acting user/role (or `system`), on-behalf-of subject
- **Did:** tool calls (names + parameter classes, not raw payloads), data classes read/written, decision/outcome, escalations
- **Cost:** latency, tokens, retrieval count (feeds A39 budgets)
- **Never:** secrets, full PII payloads, unpublished manuscript text
- **Alertable events:** permission denial, kill-switch trip, budget breach, A08-class escalation, eval-gate failure

Retention per `AI_SAFETY_PRIVACY_POLICY` (skeleton pending, PR-D1 sibling). No audit event, no action — writes fail closed if the audit writer fails.

## 10. Human-approval matrix (always requires a human — no exceptions, no gate waivers)

| Action | Route | Basis |
|---|---|---|
| Merge to main / deploy / promote to prod | Human merges; steward verifies only | Brief §0; delta C4 (H0.2b auto-merge unresolved, §9.12) |
| Publish anything (book, post, email send, campaign) | Approver per surface | A09/A19/A21/A22 boundaries |
| Refunds / payment or price changes | Human until policy-backed workflow exists | A07/A23; delta §9.7 |
| Permanent sanctions, bans, content takedowns | Human moderator/admin | A25/A26 boundaries |
| Release/launch gate pass; waiving any failed eval | Owner; **waivers prohibited** (A38) | A16/A28/A38 |
| New secrets, tokens, scopes, integrations | Owner provisions (per-integration) | CLAUDE.md rule 7; delta C8/§9.10 |
| Agent activation, permission grant, un-suspension | Admin human (A40 proposes only) | §7 lifecycle |
| Data repair/deletion scripts (Phoenix) | Approved script + human run | A36 boundary |
| High-severity safety cases | Immediate human escalation, 100% | A08 |

## 11. Open decisions (blocking; owners in delta report §9)

1. **Agent autonomy ceiling** — ratify agents-draft/humans-merge as the permanent model AND ratify-or-retire HUMAN_TASKS H0.2b's auto-merge-on-green intent (delta §9.6 + **§9.12**; recommendation: retire auto-merge). Until decided, every agent here is capped at draft/verify.
2. **Model provider(s)** — primary + fallback TBD (delta §9.2; only `openai` SDK in repo today; abstraction-first per E06).
3. Assistant launch scope (post-GO vs scope change) — delta §9.9/C6; sequences A01–A08.
4. Command-center read-only tokens — delta §9.10/C8; blocks A29 beyond spec.
5. Conversation retention + unpublished-manuscript use — delta §9.3–9.4; blocks any persistent memory policy.
6. Registry owner confirmation (Faith Beckwith proposed) + first certification date.

---
*End of draft 0.1.0 — review via PR-D1; every future edit bumps version and records approver.*
