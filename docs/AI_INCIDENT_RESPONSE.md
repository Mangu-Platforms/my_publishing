# AI Incident Response Plan — Mangu Publishers

> **DRAFT — PROPOSED v0.1.0, NOT RATIFIED.** Documentation-only deliverable (permitted under launch freeze #209 class 1). Creates no runtime, no rota, no on-call obligation.
>
> **Version:** v0.1.0 · **Date:** 2026-07-29 · **Owner:** TBD · **Proposed repo path:** `docs/AI_INCIDENT_RESPONSE.md` (Master Brief §15 required plan; §19 governance doc)
> **Sources:** Master Brief §13 (autonomous SDLC / incident loop) and §15 (security, privacy, legal controls); repo precedents cited inline, all paths verified to exist at HEAD `36f7528`.
>
> **This plan is pre-positioned, not yet exercised.** No conversational or agentic AI surface is live today: every agent A01–A40 is `PROPOSED` (`docs/AGENT_REGISTRY.md` §5), and the MCP tool gateway is fail-closed 404 by default (`lib/mcp/guard.ts`). The one shipped ML-adjacent surface is Resonance recommendations (`lib/resonance/recommendations.ts`). Nothing below has ever been run in anger.
>
> **No secrets, credentials, PII, or manuscript text may ever appear in this document or in any incident record it governs.** The repository is public.

---

## 1. Scope and what counts as an AI incident

**Applies to** every AI surface in scope of `docs/AI_SAFETY_PRIVACY_POLICY.md` §1, every agent in `docs/AGENT_REGISTRY.md`, the tool gateway, and any data leaving Mangu infrastructure toward a model provider.

A violation of `docs/AI_SAFETY_PRIVACY_POLICY.md` §3 (hard prohibitions) is **a security incident handled here, not a bug** — that document routes §3 violations to this plan by name.

| # | Class | Source | One-line trigger |
|---|---|---|---|
| 1 | **Cross-user data exposure** | Brief §15 | One user's User-private/Author-private data reaches another user, or any Restricted-class data reaches a general-purpose model. |
| 2 | **Prompt / system-prompt leakage** | Brief §15 | System prompt, tool schema, internal reasoning, or prompt-registry content is emitted to a user or third party. |
| 3 | **Unauthorized or erroneous tool action** | Brief §15 | A tool call outside the agent's allowlist, outside RBAC scope, or correct-by-schema but wrong in effect. |
| 4 | **Model-provider breach or outage** | Brief §15 | Provider discloses a breach, or a provider failure degrades an AI surface. |
| 5 | **Compromised agent credentials/keys** | Brief §15 | Agent API key, bearer token, or service credential is exposed, leaked, or used from an unexpected source. |
| 6 | **Eval-gate failure** | `AI_EVALUATION_PLAN.md` §1/§4; `AGENT_REGISTRY.md` §9 | A release-gating eval regresses below threshold. Waivers are prohibited (`AGENT_REGISTRY.md` §10). |
| 7 | **Runaway cost / budget breach** | Brief §12 panel 8; `AGENT_REGISTRY.md` §7 | Model, tool, or retrieval spend breaches its budget. Budget breach is a named suspension trigger. |
| 8 | **Agent permission drift** | Brief §12 panel 9 | Actual grants diverge from the registered allowlist/RBAC scope, or a permission bypass is observed. |

**Out of scope:** platform incidents (site down, database unreachable, Stripe webhook failure, deploy failure). Those are `docs/operations/INCIDENT_RESPONSE.md` — see §8.

## 2. Severity ladder (all response times PROPOSED — owner ratification required)

Severity is anchored to **blast radius**, not to how loud the alert was.

| Sev | Blast radius | Examples | Ack | Contain | Platform equivalent |
|---|---|---|---|---|---|
| **SEV1** | Cross-user or Restricted-class data exposure; **or** an unauthorized tool action with real-world effect; **or** compromised agent credentials | Answer contains another user's order/library/manuscript; contract or payment data sent to a model; agent moved money, published, deleted, emailed externally, or granted a role; agent key found leaked | 10 min | 30 min | Sev1 |
| **SEV2** | Single-user exposure with no cross-user spread; capability disclosure; confirmed drift | System prompt or tool schema leaked to a user; provider breach notice with no confirmed Mangu data; permission drift detected at certification; a user sees their own data via a path that should not have served it | 20 min | 2 hr | Sev2 |
| **SEV3** | No data or permission impact; availability, cost, or release impact | Provider outage where fail-closed degradation worked as designed; budget breach / runaway cost; eval-gate failure blocking a release | 60 min | 1 business day | Sev3 |
| **SEV4** | Quality regression only | Grounding, citation-accuracy, or refusal-accuracy metric below target with no data, permission, or availability impact | Next business day | Next eval cycle | *(none — new, see §9 O-2)* |

**Promotion rules (mirroring `docs/operations/INCIDENT_RESPONSE.md` §1):**
- Any suspicion that a second user could have been reached ⇒ **SEV1 until disproven.**
- Anything you cannot classify, or whose cause you cannot name ⇒ **SEV1 until disproven.**
- A SEV2 that persists past 60 minutes on an authenticated surface ⇒ **SEV1.**

## 3. Response flow

| Stage | Concrete action | Brief §13 step | Repo hook |
|---|---|---|---|
| **Detect** | Normalize the event and deduplicate by fingerprint/route/release/agent. Sources: command-center panels 7 (AI quality), 8 (AI operations), 9 (Security) per `docs/COMMAND_CENTER_SPEC.md` §2; Sentry; the `AGENT_REGISTRY.md` §9 alertable events (permission denial, kill-switch trip, budget breach, escalation, eval-gate failure); user report. | 1–2 | `sentry.server.config.ts`, `lib/sentry/shared-options.ts`, `lib/audit.ts` |
| **Contain** | **FIRST MOVE IS THE KILL SWITCH.** Flip the agent's flag **off** before any diagnosis. Per `docs/AGENT_REGISTRY.md` §7, `ACTIVE → SUSPENDED` is available to **any admin, immediately, with no approval required to suspend** — suspension is always cheap, activation is always gated. Never debug a live agent. If the surface is the tool gateway, `MCP_ENABLED=false` returns 404 (`lib/mcp/guard.ts`). Preserve state; do not delete or "clean up" anything. | — | `lib/flags.ts` (flag-off ⇒ honest unavailable, never a broken page), `lib/mcp/guard.ts` |
| **Assess** | Assign severity (§2), blast radius, affected-user **count and IDs** (never content), confidence, and owner. | 3 | §2 |
| **Notify** | Fire the §6 matrix at the severity's cadence. Notify before you are certain; correct later. | 3 | §6 |
| **Eradicate** | Collect evidence (§5), then **reproduce deterministically. If reproduction is impossible, do not patch blindly** (Brief §13.5). Rank hypotheses with evidence. Minimal patch on a branch with a regression test. | 4–7 | `docs/ROLLBACK.md` when the cause is a merged change |
| **Recover** | Validate (lint, type, unit, integration, e2e, security, evals). Human reviews and merges — no autonomous production change. **Un-suspension requires documented root cause plus owner re-approval** (`AGENT_REGISTRY.md` §7 `SUSPENDED → ACTIVE`). Verify on an uncacheable, non-fallback surface. | 8–10 | `docs/AGENT_REGISTRY.md` §7, §10 |
| **Learn** | Postmortem, runbook update, new detector, permanent eval case. | 11 | §7 |

## 4. Per-scenario playbooks

### 4.1 Cross-user data exposure (SEV1)

| | |
|---|---|
| **Detection** | Role-isolation eval failure; audit rows where the acting user ≠ the subject of the data read; user report; Security panel 9 permission-bypass signal. |
| **Contain** | Kill switch off for the agent **and every agent sharing its retrieval index or cache**. Assume the cache is poisoned until proven otherwise. |
| **Evidence** | Agent ID + prompt version ref, tool calls (names + parameter classes), data classes read, affected user IDs, request timestamps, retrieval source IDs. **Never the exposed content itself.** |
| **Notify** | Owner immediately; legal counsel same-day (disclosure is their call, §6); affected users per counsel's determination. |
| **Recover** | Purge affected caches/indexes; re-verify role isolation with a targeted eval before un-suspension. |
| **Prevent** | New EV3 role-isolation eval case (§7); RBAC re-certification of the agent ahead of the `AGENT_REGISTRY.md` §8 quarterly cadence. |

### 4.2 Prompt / system-prompt leakage (SEV2, SEV1 if the prompt embeds user data)

| | |
|---|---|
| **Detection** | Adversarial eval failure; output containing system-prompt markers or tool schemas; injection-detection counter spike (Brief §16 safety metrics). |
| **Contain** | Kill switch off. Treat the leaked prompt version as burned. |
| **Evidence** | Prompt version ref, the injection vector (retrieved doc / upload / tool output / web page / book text), transcript **metadata only**. |
| **Notify** | Owner. Counsel only if the prompt embedded user or Restricted data. |
| **Recover** | Rotate to a new pinned prompt version; re-run the full injection suite before un-suspension. |
| **Prevent** | Convert the exact vector into a permanent EV4 injection case; re-check retrieved-content delimiting per `AI_SAFETY_PRIVACY_POLICY.md` §4. |

### 4.3 Unauthorized or erroneous tool action (SEV1 with real-world effect)

| | |
|---|---|
| **Detection** | `ai.tool.denied` / permission-denial audit events; tool call outside the registered allowlist; a write with no matching human approval (`AGENT_REGISTRY.md` §10); reconciliation mismatch. |
| **Contain** | Kill switch off. Revoke the agent's tool grants at the gateway, not only in the prompt — boundaries are enforced in code, never prompt-only. |
| **Evidence** | Full tool-call chain, the authorization decision and who/what made it, the resulting state change, and the approval record that should have existed. |
| **Notify** | Owner immediately. Anyone whose money, content, or account state changed. Counsel if money or rights moved. |
| **Recover** | Reverse the real-world effect first (refund, unpublish, restore, revoke role) — that is a **human** action; then patch. |
| **Prevent** | EV3 tool-correctness case; deny-by-default allowlist review; verify the confirmation gate that was bypassed. |

### 4.4 Model-provider breach or outage (SEV2 breach / SEV3 outage)

| | |
|---|---|
| **Detection** | Provider status page or breach notice; fallback-rate and error-rate spike on command-center panel 8. |
| **Contain** | **Outage:** confirm fail-closed behaviour actually engaged — explicit unavailable state or the non-AI path (`AI_SAFETY_PRIVACY_POLICY.md` §9). **Never** fail over to an unapproved provider or a weaker data-access path. **Breach:** kill switch off; stop all sends to that provider. |
| **Evidence** | Provider notice, exposure window, which surfaces sent what **data classes** in that window, retention terms in force. |
| **Notify** | Owner; counsel on any breach (mandatory); users per counsel. |
| **Recover** | Rotate provider credentials before resuming; re-enable only after the provider confirms remediation. |
| **Prevent** | Record the provider's breach-notification SLA in the model-provider decision (§9 O-6); add a resilience drill per `docs/QA_MASTER_MATRIX.md` §10. |

### 4.5 Compromised agent credentials / keys (SEV1)

| | |
|---|---|
| **Detection** | Secret-scan or Dependabot alert (panel 9); key used from an unexpected source, region, or at anomalous volume; key found in a log, prompt, screenshot, ticket, or client bundle (all four are prohibited by Brief §15). |
| **Contain** | Kill switch off, **then rotate immediately** — assume active use. Precedent: `.github/workflows/rotate-supabase-key.yml`. Names and store identifiers only, never values (`docs/SECRET_INVENTORY.md`, CCR-009). |
| **Evidence** | Which credential (by **name**), where it was exposed, exposure window, every action taken with it in that window, blast radius of its scopes. **Never the value, not even redacted-partial.** |
| **Notify** | Owner + security contact immediately; counsel if the credential could reach user data. |
| **Recover** | Rotate → verify the old key is dead → re-issue with the minimum scope → un-suspend on owner re-approval. |
| **Prevent** | Scope reduction; add the leak path to the secret-scan ruleset; re-run the `AGENT_REGISTRY.md` §8 certification early. |

## 5. Evidence and record-keeping

**Append-only, per the `docs/OPERATOR_QA_LOG.md` conventions (CCR-002).** Prior rows are preserved verbatim; corrections are new rows that supersede, never edits. That log is deliberately listed in `.prettierignore` so formatters cannot rewrite evidence — an AI incident record gets the same treatment.

**Exact-SHA rule (CCR-005).** Every record cites the **exact deployed SHA** the incident occurred on, plus the pinned prompt version ref and agent ID. One immutable SHA per record; evidence gathered against an uncommitted or drifting tree is not release evidence.

| Record | Rule |
|---|---|
| Timestamps | UTC **and** America/New_York, matching the platform runbook. |
| Identity | Agent ID, prompt version ref, acting user/role (or `system`), on-behalf-of subject. |
| Actions | Tool names + **parameter classes**, not raw payloads. Data **classes** read/written, not the data. |
| Cost | Latency, tokens, retrieval count. |
| **Never record** | Secrets or credentials (even partial); full PII payloads; unpublished manuscript text; raw prompts or transcripts containing user data; signed/private asset URLs; internal hostnames, project refs, or stack traces in anything customer-facing. |

**Redaction is mechanical, not a matter of care.** `lib/audit.ts` is the single audit writer and redacts before persistence: `SECRET_KEY_PATTERN` (token, password, secret, api_key, authorization, credential, signature, cvv) → `[redacted]`; `PRIVATE_URL_KEY_PATTERN` (manuscript_url, epub_url, pdf_url, audio_url, file_url, download_url, signed_url) → `[redacted-url]`, because private asset URLs are capability tokens. Incident records inherit both rules. **No audit event, no action** — writes fail closed if the audit writer fails (`AGENT_REGISTRY.md` §9).

**Sign-off pattern:** attach the evidence set to the record and get written owner sign-off before closing, following `docs/PHOENIX_CUTOVER_RUNBOOK.md` §9.

## 6. Notification and escalation

> **PLACEHOLDER — owner to fill in.** Channels are intentionally blank rather than guessed, matching the discipline of `docs/operations/INCIDENT_RESPONSE.md` §2. Do not invent an address, number, or channel here.

| Role | Who | Channel | Triggered by |
|---|---|---|---|
| AI incident owner | TBD | TBD | All severities |
| Business owner / Sev1 decisions | Renee | TBD | SEV1, SEV2 |
| Security contact | TBD | TBD | Credential compromise, permission bypass, provider breach |
| Legal counsel | TBD | TBD | Any confirmed exposure of user, Restricted, or Author-private data; any provider breach |
| Affected users | — | TBD | **Only** on counsel's determination |
| Public statement | Renee only | TBD | Per `docs/operations/INCIDENT_RESPONSE.md` §8 — engineers supply facts, Renee decides what is said |

**Regulatory and disclosure obligations are a legal determination, never an agent determination.** `AI_SAFETY_PRIVACY_POLICY.md` §8 and Brief §15 both bar AI systems from making legal determinations; that bar applies to the disclosure decision itself. An agent may assemble the facts and draft nothing else. No notification content leaves the building without owner + counsel approval.

## 7. Postmortem

Required for every **SEV1 and SEV2**, within 5 business days. **Blameless — the target is the system, never a person.**

Use the existing template at `docs/operations/INCIDENT_RESPONSE.md` §9 verbatim; do **not** fork a second template. Add an AI addendum: agent ID, prompt version ref, model + provider, tool calls attempted vs. permitted, data classes touched, eval cases that should have caught it and did not.

**Conversion rule (mandatory).** Per `docs/AI_EVALUATION_PLAN.md` §6, **every reproducible finding becomes a permanent EV3/EV4 eval case.** A finding that cannot be reproduced is recorded as a detection gap, not discarded. The existing rule that every review produces at least one **detect** action item carries over. Eval waivers remain prohibited (`AGENT_REGISTRY.md` §10) — a postmortem may not conclude by lowering a threshold.

## 8. Relationship to existing runbooks

This plan covers **AI-specific** incidents. Platform incidents are already owned elsewhere and are not restated here.

| Runbook | Owns | Interaction |
|---|---|---|
| `docs/operations/INCIDENT_RESPONSE.md` | Production platform: site down, Supabase pause/deletion, catalog provider failure, Stripe webhook, Vercel rollback, public comms, PIR template | **Primary.** If an incident is both, **run the platform runbook first** — an AI surface on a dead platform is not the emergency. Sev1–Sev3 map per §2. |
| `docs/ROLLBACK.md` | Reverting merged changes (`git revert`, per-task verification, emergency full revert) | Invoked at Eradicate/Recover when the cause is a merged change. |
| `docs/PHOENIX_CUTOVER_RUNBOOK.md` | Migration and data cutover; read-only gates, delta capture, §9 evidence sign-off | Source of the §5 sign-off pattern. Not an AI path. |
| `.claude/skills/mangu-ops-runbook/SKILL.md` | On-call triage entry point and Sev definitions | Referenced by the platform runbook as the escalation path. |
| `docs/QA_MASTER_MATRIX.md` §10 | Resilience drill proposals | Where AI outage/failover drills get scheduled. |

**Known failure mode to carry across — the cache-masking rule.** On 2026-07-28 the production Supabase project was paused/removed while `/books` kept serving from cache; the signature is `DNS_PROBE_FINISHED_NXDOMAIN` / `ENOTFOUND` on the project host, diagnosed in `docs/operations/INCIDENT_RESPONSE.md` §4 (still untested as a drill — risk R4, `docs/QA_MASTER_MATRIX.md` §10). **The AI analogue is a fallback chain that degrades silently** (`lib/resonance/recommendations.ts`). A plausible-looking answer proves nothing. Never close an AI incident on a cached, fallback, or flag-off-honest response — confirm on a live, uncacheable path.

## 9. Open decisions (blocking ratification)

| ID | Decision | Recommendation | Status |
|---|---|---|---|
| O-1 | Incident owner, security contact, and notification channels (§6) | Fill the same placeholders already open in `docs/operations/INCIDENT_RESPONSE.md` §2 — one set, not two | OPEN |
| O-2 | SEV4 has no platform equivalent | Keep it; a quality regression is real but must never wake anyone | OPEN |
| O-3 | All §2 response-time targets | PROPOSED only; ratify against actual staffing (solo operator today) | OPEN |
| O-4 | Where AI incident records live | Not `OPERATOR_QA_LOG.md` — that is QA evidence. Needs its own append-only record or issue convention | OPEN |
| O-5 | Regulatory notification thresholds and jurisdictions | Legal counsel determination; blocks §6 | OPEN |
| O-6 | Model provider(s) and their breach-notification SLA | Depends on `AGENT_REGISTRY.md` §11.2 / delta §9.2 (unresolved) | OPEN |
| O-7 | Alert channel wiring | `COMMAND_CENTER_SPEC.md` §6 — no channel wired in v0 | OPEN |
| O-8 | Whether an agent may draft incident comms at all | Recommend: facts only, never customer-facing text | OPEN |

## Changelog

- **v0.1.0** (2026-07-29) — Initial draft. Not ratified. Documentation-only under freeze #209 class 1.
