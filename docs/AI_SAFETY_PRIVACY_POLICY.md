# AI Safety & Privacy Policy — Mangu Publishers

> **DRAFT — PROPOSED. NOT RATIFIED. No section below is active policy yet.**
> Documentation-only deliverable (permitted under launch freeze #209 class 1; PR-D1 scope).
> Ratification requires sign-off from the **owner (Faith/Renee)** and **legal counsel**.
>
> **Version:** v0.1.0 (skeleton) · **Date:** 2026-07-29
> **Proposed repo path:** `docs/AI_SAFETY_PRIVACY_POLICY.md` (Master Brief §19 governance doc)
> **No secrets, credentials, PII, or manuscript text may ever appear in this document.**
> The repository is public (delta report §7 R6). The `docs/SECRET_INVENTORY.md` rule —
> names and store identifiers only, never values (CCR-009) — applies to this file too.

Sources: Mangu Claude Execution Master Brief (§0, §4.2, §4.4, §15); `docs/MASTER_BRIEF_DELTA_REPORT.md`
(§3, §7, §9); repo precedents cited inline (paths verified to exist at recon HEAD `8246424`).

---

## 1. Scope and definitions

**Applies to** every AI surface of Mangu Publishers: the existing Resonance engine
(`lib/resonance/embeddings.ts`, `lib/resonance/recommendations.ts`) and MCP tool server
(`app/api/mcp/[transport]`, guarded by `lib/mcp/guard.ts`), and all planned surfaces in the
Master Brief §4.2 interaction modes (public catalog assistant, authenticated reader assistant,
author assistant, partner assistant, staff copilot, admin operations agent). It governs any
data leaving Mangu infrastructure toward a model provider and all AI-adjacent storage.

| Term | Definition |
|---|---|
| AI surface | Any feature that sends data to, or renders output from, a model. |
| External model request | Any payload sent to a third-party model/embedding provider. |
| Tool gateway | The guarded server path through which model-initiated tool calls run (seed pattern: `lib/mcp/guard.ts`). |
| Data class | Classification per §2, carried from Master Brief §4.4. |
| Fail closed | On error, outage, or misconfiguration: deny or degrade to the non-AI path. Never silently allow. |
| Owner decision (D-n) | An open human gate in delta report §9; TBD until ratified. |

## 2. Data classification and AI-use rules (Master Brief §4.4)

| Class | Examples | AI-use rule |
|---|---|---|
| **Public** | Published catalog, author bios, public policies, events, FAQs, press releases | May be used by the public assistant; cite source and last-updated metadata. |
| **User-private** | Orders, library, reading progress, support cases | Only for the authenticated owner; minimum necessary fields; never in shared caches. |
| **Author-private** | Unpublished manuscripts, submission status, private editorial notes | Author/staff scope only. Manuscript text requires explicit policy **and opt-in** (D-3, §11). |
| **Internal** | Editorial calendars, launch plans, runbooks, incident records | Staff-only. Do not expose internal reasoning, private schedules, or security details. |
| **Restricted** | Contracts, rights terms, payment details, secrets, legal matters, security credentials | **Never sent to general-purpose models.** Route to an approved secure workflow or a human. |

Classification of a new knowledge source is a prerequisite for ingestion (delta §9.8); unclassified
sources default to **Restricted**.

## 3. Hard prohibitions (Master Brief §0)

The following are **never** included in an external model request, under any mode or flag:

1. Secrets and credentials of any kind (also banned from prompts, logs, screenshots, tickets, and client bundles — Master Brief §15; store-of-record rules in `docs/SECRET_INVENTORY.md`).
2. Unpublished manuscript text, absent explicit author opt-in under a ratified policy (D-3).
3. Contracts, rights terms, or any Restricted-class legal material.
4. Personally identifiable information beyond the minimum the current, authenticated skill requires.
5. Payment data (card data, payment intents' sensitive fields, payout details).

A violation of this section is a **security incident**, handled per the planned
`docs/AI_INCIDENT_RESPONSE.md` (Master Brief §19), not a bug.

## 4. Prompt-injection defense

Threat model per Master Brief §15: injection arrives via retrieved documents, user uploads, tool
output, web pages, and book text.

- **Retrieved content is data, not instructions.** System prompts must direct models to ignore imperative text inside retrieved/quoted material; retrieval results are delimited and labeled untrusted.
- **Tool inputs and outputs are sanitized.** Precedent: `sanitizeSearchQuery()` in `lib/mcp/guard.ts` strips PostgREST filter-grammar characters and caps length before any user text reaches a query. Equivalent sanitizers are required at every tool boundary.
- **No action on retrieved say-so.** A tool call may never execute solely because retrieved text requested it; write actions require the confirmation rules of the §4.2 mode table (e.g., reader assistant: low-risk actions **with confirmation** only).
- **Guard ordering.** Gate → rate limit → auth, per `lib/mcp/guard.ts` (limiter runs before auth so credential brute force is also capped); the shared limiter is `lib/rate-limit.ts`.
- **Output handling.** Model output rendered to users is escaped; model output is never piped into shells, SQL, or privileged APIs without schema validation.

## 5. Data minimization and retention

**Minimization rule (Master Brief §15):** the AI receives only the fields required for the current
skill; User-private data follows the minimum-necessary rule of §2.

**Retention schedule (all values TBD-owner — D-4 blocks ratification):**

| Data type | Store | Retention period | User deletion path | Legal hold | Owner |
|---|---|---|---|---|---|
| Conversations / chat transcripts | TBD (none exists yet) | TBD | TBD (required) | TBD | TBD |
| Traces, AI logs, telemetry | TBD | TBD | TBD | TBD | TBD |
| Embeddings / vectors | Supabase `resonance_vectors` (book-level today) | TBD | TBD | TBD | TBD |
| User uploads to AI features | TBD | TBD | TBD (required) | TBD | TBD |
| Support cases touched by AI | TBD | TBD | TBD | TBD | TBD |

Note (delta §7, privacy note): **no conversation store exists at HEAD** — retention is designed
before the first byte is stored, not retrofitted. Deletion and legal hold support are mandatory
capabilities (Master Brief §15), whatever periods the owner sets.

## 6. User controls

Required before any assistant surface ships (delta §9.4–9.5 recommendations):

1. **Personalization off** — a per-user switch; no sensitive-attribute inference regardless of setting (D-5).
2. **Clear preferences** — user-initiated reset of AI preferences and personalization signals.
3. **Delete** — user-initiated deletion of their conversations and AI-derived data (feeds §5 deletion paths).
4. **Export** — user-accessible export of their conversations and stored preferences.
5. **Anonymous mode floor** — unauthenticated users get Public-class data only (§4.2 public mode).

UI placement and API contracts: TBD at E08–E09 spec time.

## 7. Copyright and content reproduction

- **No full-text reproduction** of books, chapters, lyrics, or extensive excerpts (Master Brief §15) — in answers, prompts, or logs.
- **Approved excerpts only:** excerpt sources, maximum lengths, and approval workflow TBD-owner; retrieval and answer policies must enforce licensed use mechanically, not by convention.
- Public-class citations carry source and last-updated metadata (§2).
- Author-private text is additionally governed by §3.2 and D-3 — opt-in is about *use*, and never implies training rights.

## 8. Escalation to humans

The following are routed to a human and never resolved autonomously (Master Brief §15; delta §9.7):

| Trigger | Route |
|---|---|
| Refunds, account actions, disputes | Human-routed until policy-backed workflows exist (D-7). Today the refund path is routing-only (delta §2). |
| Legal, rights, medical, financial determinations | Provide approved information only; decision goes to a qualified human. |
| Security reports / suspected incidents | Security owner, per incident-response plan. |
| Legal process / law-enforcement requests | Owner + counsel. |

Escalation SLAs and queue tooling: TBD-owner.

## 9. Fail-closed requirements

Every AI surface inherits the repo's established fail-closed posture (all precedents verified):

- **`lib/mcp/guard.ts`** — disabled by default (404); enabled-but-misconfigured (no API key) is *also* 404; the surface can never be reachable unauthenticated.
- **`lib/rate-limit.ts`** — limiter unreachable or unconfigured in production ⇒ requests **rejected** (`reason: 'unavailable'`), never silently allowed.
- **`middleware.ts`** — auth unverifiable at the Edge ⇒ 503 (`auth_unavailable`), never a silent pass-through.

Requirements for AI surfaces:

1. **Model provider outage** ⇒ explicit unavailable state or non-AI fallback (Resonance's fault-tolerant fallback chain in `lib/resonance/recommendations.ts` is the pattern). Never downgrade to a weaker data-access path or an unapproved provider.
2. **Vector store outage** ⇒ no retrieval. Answer without retrieval only where the mode permits public-only knowledge; otherwise unavailable.
3. **Tool gateway outage** ⇒ no tool calls, no bypass. Read-only degradation where defined; otherwise unavailable.
4. **Kill switches** — every AI surface sits behind a flag (`lib/flags.ts` pattern), default **OFF**, togglable without deploy (env-read-per-request, as in `isMcpEnabled()`).
5. **Budgets** — per-user/IP rate limits, input/output size caps, and model/tool budgets (Master Brief §15) fail closed when exceeded.

## 10. Enforcement and audit events

- All privileged AI actions write to the **single audit writer** `lib/audit.ts` (`recordAudit`). Its redaction rules apply: secret-shaped keys redacted; private asset URLs treated as capability tokens and redacted.
- Proposed audit events (final names TBD): `ai.request.blocked` (§3 prohibition hit), `ai.tool.invoked`, `ai.tool.denied`, `ai.rate_limited`, `ai.escalated_to_human`, `ai.user_data.deleted`, `ai.flag.toggled`.
- Enforcement: PR-review checklist item for every AI PR; CI lint for banned patterns TBD; §3 violations follow the security-incident path, including provider-breach and prompt-leakage scenarios (Master Brief §15).
- No autonomous production change: agents draft and verify; humans merge and approve (Master Brief §0 model; delta §9.6).

## 11. Open decisions blocking ratification (delta report §9)

| ID | Decision (delta §9 item) | Delta recommendation | Feeds | Status |
|---|---|---|---|---|
| D-3 | §9.3 — Unpublished-manuscript use in AI | Default **NO**; opt-in, staff-scoped, no training | §2, §3, §7 | OPEN |
| D-4 | §9.4 — Conversation retention policy | Minimal retention + user delete | §5 table | OPEN |
| D-5 | §9.5 — Personalization boundaries | Explicit controls; no sensitive inference | §6 | OPEN |
| D-7 | §9.7 — Refund/account actions | Human-routed until policy-backed workflows exist | §8 | OPEN |

These are owner decisions (Faith/Renee); this draft records the delta recommendations as proposed
defaults, not as policy. Related but out of scope here: D-2 (model providers), D-8 (knowledge-source
registration), D-9 (assistant launch scope).

## 12. Review cadence

- **Ratification:** owner + legal sign-off converts this draft to v1.0.0; all §11 items must be CLOSED first.
- **Scheduled:** quarterly review after ratification.
- **Event-triggered re-review:** new AI surface or interaction mode; model-provider change; any AI incident; relevant regulation change; closure of any §11 decision.
- **Change control:** docs PR with human merge (Master Brief §0); semver bump + changelog line below.

## Changelog

- **v0.1.0** (2026-07-29) — Initial draft skeleton (PR-D1 scope). Not ratified.
