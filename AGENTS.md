# MANGU Publishers — Agent Instructions

Primary project instructions for GitHub Copilot CLI (and compatible agents). Cursor simulation rules live in [`cursorrules`](cursorrules). Custom agent profiles live in [`.github/agents/`](.github/agents/). Full product docs: [`docs/MANGU_PUBLISHERS_END_TO_END.md`](docs/MANGU_PUBLISHERS_END_TO_END.md). Copilot CLI operator guide: [`docs/COPILOT_CLI.md`](docs/COPILOT_CLI.md).

> **Start here, every session:** read the top of [`CLAUDE.md`](CLAUDE.md), then load
> `.claude/skills/mangu-navigator/SKILL.md` (mental model, authority chain, next-best-action)
> and run `bash .claude/skills/mangu-navigator/scripts/state-sync.sh` for ground truth.
> If you drive a PR, also read `.claude/skills/steward/SKILL.md`. The agent-fleet
> architecture and activation runbook live in [`docs/AGENTIC_FOUNDRY.md`](docs/AGENTIC_FOUNDRY.md).

## Project

MANGU Publishers is a Netflix-inspired digital publishing platform: book marketplace, reading progress, author/partner portals, Stripe checkout, admin dashboard, and analytics.

## Stack and canonical paths

- **Framework:** Next.js 14 App Router, React 18, TypeScript (strict), Tailwind CSS
- **Backend (dual-run, Project Phoenix ACTIVE):** Supabase (Postgres+RLS, Auth, Storage) is
  **live in production**; Better Auth + MongoDB Atlas + Vercel Blob are merging in behind
  provider switches (`AUTH_PROVIDER` / `DATABASE_PROVIDER` / `STORAGE_PROVIDER`, all
  defaulting `supabase`). Never flip a default; contract: `docs/PROJECT_PHOENIX.md`.
- **Payments:** Stripe
- **AI (product):** OpenAI embeddings for Resonance; heuristic AI insights elsewhere
- **Production path:** **Vercel** (ADR-001 Option B, ACCEPTED 2026-07-18; project
  `manguprojectz`). The GCP Cloud Build → Cloud Run path (`cloudbuild.yaml`) is **legacy
  standby only** — do not deploy or "fix" it unless explicitly asked.

| Path                   | Role                                        |
| ---------------------- | ------------------------------------------- |
| `app/`                 | App Router pages and API routes             |
| `lib/`                 | Business logic, server actions, services    |
| `components/`          | UI and feature components                   |
| `supabase/migrations/` | Ordered SQL migrations                      |
| `scripts/`             | Setup, seed, bootstrap, CI helpers          |
| `tools/`               | Dev tooling (e.g. Copilot deep-dive packet) |
| `docs/`                | Ops, deploy, Phase 2, standards             |

## Hard constraints

- Prefer existing patterns over new abstractions; match local style.
- TypeScript strict; do not weaken types to “make it compile.”
- Never commit secrets, tokens, or real `.env` values. Use placeholders in examples.
- Do not invent migrations out of order; respect `supabase/migrations/` naming and apply order.
- Vercel is the canonical production path (ADR-001). Do not treat Cloud Run or Amplify as primary.
- Launch freeze (issue #209) is active: only migration parity, hardening, and NEXT_GO §8
  permitted classes may merge. New product surface goes to `docs/ENHANCEMENT_LEDGER.md` instead.
- Avoid drive-by refactors unrelated to the asked task.
- Confirm before destructive shell (`rm`, mass `sed`, `chmod`, force-push) unless the user explicitly allows all tools (`--yolo` / `--allow-all` / equivalent).

## Workflow modes (from `cursorrules`)

When the user asks for a mode—or you select a matching custom agent—behave accordingly:

| Mode            | Agent profile | Behavior                                                                           |
| --------------- | ------------- | ---------------------------------------------------------------------------------- |
| **Explore**     | `explore`     | Quick codebase analysis; clear answers; no context bloat; cite files               |
| **Task**        | `task`        | Scripts, tests, automations; brief success summary; full verbose output on failure |
| **Code Review** | `code-review` | Real bugs, security, regressions; minimize stylistic noise                         |
| **Research**    | `research`    | Deep dive with a citation report and file paths                                    |
| **Plan Mode**   | `plan`        | Collaborate on an implementation plan first; wait for approval before writing code |

## Slash-command mapping (Copilot CLI)

Copilot CLI has built-in plan mode (e.g. Shift+Tab / `/plan`). Map human shortcuts to agents as follows:

- `/plan` → use **plan** agent (or CLI plan mode); no code until approved
- `/review` → **code-review** agent on current file or recent changes
- `/research [topic]` → **research** agent; produce a citation report
- `/task [goal]` → **task** agent; emit exact shell/scripts/config to hit the goal
- `--yolo` / `--allow-all` → skip conversational confirmation; act directly within tool permissions

Invoke agents interactively with `/agent`, or programmatically:

```bash
copilot --agent code-review --prompt "Review the latest diff for security issues"
```

## Tool and file rules

- Prefer `@`-referenced files and paths the user names.
- Briefly explain _why_ before large code or command blocks.
- Keep changes scoped; update docs only when behavior or operator workflow changes.

## Continuous cowork entrypoint (from PR #281)

Before any work:

1. Read `docs/COWORK_OPERATOR.md` (path + storm guards).
2. Read `CLAUDE.md` and `docs/PROJECT_PHOENIX.md` for Phoenix slices.
3. Load skills from `.claude/skills/README.md` as needed.
4. Run `./scripts/cowork-status.sh` when diagnosing prod/PRs.
5. Log console-only blockers in `HUMAN_TASKS.md`.

**Prompts for continuous cowork:** `.cursor/automations/*.prompt.md`
**Cowork branch convention:** `cursor/<slug>-c5d8`. One PR per run.

> **Integration note (superseded record corrected 2026-08-21):** Project Phoenix is
> **ACTIVE** — owner Faith Beckwith reactivated it 2026-07-20 (`CLAUDE.md` header
> "PROJECT PHOENIX (ACTIVE)"; `HUMAN_TASKS.md` C0.3 "LOCKED to Phoenix (B)"). The earlier
> "paused" record above this note is history, not guidance. Default path: Phoenix (B),
> one PR per run, production stays `AUTH_PROVIDER=supabase` until Phase 11–12 cutover.
