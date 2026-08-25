# Mangu Publishers — Agent Skills

Procedural skill packs for Cursor / Claude Code agents operating **Mangu Publishers**
and Project Phoenix. Skills are instruction packs — they do **not** run unattended.
Humans own consoles, credentials, DNS, and go/no-go decisions (`HUMAN_TASKS.md`).

**Contract:** `docs/PROJECT_PHOENIX.md` (v4.0) wins over improvisation.  
**Briefing:** `CLAUDE.md`  
**Recon:** `docs/PHOENIX_RECON.md`

## Index

### Tier A — Always load for platform work

| Skill               | Path                                                 | Use when                                                                                                                          |
| ------------------- | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| **MANGU Navigator** | [`mangu-navigator/`](./mangu-navigator/)             | **Load first every session.** Orchestration, dual ledgers (NEXT_GO + Phoenix), next-best-action, enhancement engine, task routing |
| Phoenix Contract    | [`phoenix-contract/`](./phoenix-contract/)           | Task IDs, PR order, feature freeze, doc amendments                                                                                |
| PR Steward          | [`steward/`](./steward/)                             | Driving/babysitting any PR here (auto-read by PR-watching sessions); merge conventions, CI-failure discipline                     |
| Ops Runbook         | [`mangu-ops-runbook/`](./mangu-ops-runbook/)         | Incidents, health, rollback triage                                                                                                |
| Env & Secrets       | [`mangu-env-and-secrets/`](./mangu-env-and-secrets/) | Env vars, validate-env, human gates for secrets                                                                                   |
| Better Auth         | [`better-auth-mangu/`](./better-auth-mangu/)         | Sessions, forced reset, RBAC role field, middleware                                                                               |
| MongoDB Atlas       | [`mongodb-atlas-mangu/`](./mongodb-atlas-mangu/)     | `getDb`, indexes, queries, migration verify                                                                                       |
| Stripe Webhook      | [`stripe-webhook-mangu/`](./stripe-webhook-mangu/)   | Checkout, idempotent orders                                                                                                       |
| MCP Catalog Ops     | [`mcp-catalog-ops/`](./mcp-catalog-ops/)             | In-app MCP tools at `/api/mcp`                                                                                                    |

### Tier B — Migration window (Phases 11–15)

| Skill          | Path                                                   |
| -------------- | ------------------------------------------------------ |
| Data Migration | [`phoenix-data-migration/`](./phoenix-data-migration/) |
| Storage / Blob | [`phoenix-storage-blob/`](./phoenix-storage-blob/)     |
| Cutover        | [`phoenix-cutover/`](./phoenix-cutover/)               |

### Tier C — Steady-state product ops

| Skill              | Path                                                   |
| ------------------ | ------------------------------------------------------ |
| RBAC Admin         | [`mangu-rbac-admin/`](./mangu-rbac-admin/)             |
| Observability      | [`mangu-observability/`](./mangu-observability/)       |
| CI Quality         | [`mangu-ci-quality/`](./mangu-ci-quality/)             |
| Content & Commerce | [`mangu-content-commerce/`](./mangu-content-commerce/) |
| Security Hygiene   | [`mangu-security-hygiene/`](./mangu-security-hygiene/) |

### Tier D — Future stubs (activate when product needs them)

| Skill                                                      | Status                         |
| ---------------------------------------------------------- | ------------------------------ |
| [`mcp-catalog-authz/`](./mcp-catalog-authz/)               | Stub — authenticated MCP tools |
| [`mcp-catalog-write/`](./mcp-catalog-write/)               | Stub — mutating catalog tools  |
| [`mangu-partner-payouts/`](./mangu-partner-payouts/)       | Stub                           |
| [`mangu-ai-recommendations/`](./mangu-ai-recommendations/) | Stub                           |
| [`mangu-isr-cache/`](./mangu-isr-cache/)                   | Stub                           |
| [`mangu-compliance/`](./mangu-compliance/)                 | Stub                           |
| [`phoenix-postmortem/`](./phoenix-postmortem/)             | Stub — post Phase 15           |

### Specialized agents

See [`.claude/agents/`](../agents/).

## Conventions

1. Every skill has `SKILL.md` with YAML `name` + `description` (third-person triggers).
2. Keep `SKILL.md` lean; put schemas/checklists in `references/`.
3. Deterministic helpers live in `scripts/` (executable).
4. Never invent secrets. Log blockers to `HUMAN_TASKS.md`.
5. Bump skill `version` when Phoenix deltas or tool schemas change.

## Upstream skills to keep enabled

`nextjs`, `routing-middleware`, `auth`, `vercel-cli`, `deployments-cicd`, `env-vars`,
`vercel-storage`, `vercel-functions`, `verification`, `bootstrap`, `stripe-best-practices`,
`mcp-integration`, `skill-development`, `react-best-practices`.
