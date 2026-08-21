# AGENTIC FOUNDRY — the repo's agent fleet, deeply installed

**Status:** installed 2026-08-21 (this document describes what is in the tree, not aspiration).
**Owner dials:** §4. **Portability to other repos:** §5.
**Question this answers:** _"why are there no agents in this repo that facilitate the movement of PRs?"_ — there are; here is the full machine, what fences it, and the exact switches that remove each fence.

---

## 1. The layer model

Agents are only as good as what the repo itself hands them. This repo installs agency at
six layers, so _any_ harness (Claude Code local/web/cloud, Copilot CLI, Cursor) arrives
pre-briefed and pre-tooled:

| Layer              | What                                                                                                                                    | Where                                                        |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| **L1 Briefing**    | Truthful entry docs every agent reads first                                                                                             | `CLAUDE.md`, `AGENTS.md`, `cursorrules`                      |
| **L2 Skills**      | 30+ procedural packs incl. the navigator (orchestration) and **steward** (PR-driving posture, auto-read by PR-watching Claude sessions) | `.claude/skills/`                                            |
| **L3 Subagents**   | Specialist reviewer/verifier profiles                                                                                                   | `.claude/agents/`, `.github/agents/`                         |
| **L4 Hooks**       | SessionStart bootstrap: deps install + mock env + state-sync printout, so web/cloud sessions are productive at second zero              | `.claude/hooks/session-start.sh` via `.claude/settings.json` |
| **L5 Workflows**   | Always-on GitHub-resident agents (PR review, queue stewarding, auto-approve dial, @claude responder)                                    | `.github/workflows/`                                         |
| **L6 Automations** | Scheduled cowork prompts (Cursor) / CCR routines                                                                                        | `.cursor/automations/`, operator-created                     |

## 2. The PR-movement pipeline (the core machine)

```
PR opened ──► ci (required check)          ──► green
         ──► CodeQL (default setup)        ──► green
         ──► Claude auto-review            ──► readiness verdict on the PR   [needs ANTHROPIC_API_KEY]
                                                │
                            human act #1: approving review  ◄─── the ONLY remaining human step
                            human act #2: `steward-approved` label
                                                │
         merge-steward.yml (hourly + on label) ──► arms squash auto-merge
         GitHub ──► merges when green & up to date
```

**With the dial turned** (`STEWARD_AUTO_APPROVE=true`, §4.2), acts #1 and #2 collapse into
one: the label alone triggers `steward-auto-approve.yml` to submit the required approving
review, and the steward arms the merge. One click per PR, end to end.

Why not zero clicks? Branch protection (`scripts/launch-ops/protect-branch.sh`) and the
launch freeze (#209) exist because July's unfenced automations produced an 11-PR storm.
The label is the storm-proof control point: cheap for the owner, impossible for an agent
to fake. If post-GO you want zero-click for agent-authored PRs, that is a one-line change
to the auto-approve job's condition — make it a deliberate decision then.

### Pieces, by file

- `.github/workflows/merge-steward.yml` — existing; arms auto-merge on labeled PRs (hourly).
- `.github/workflows/steward-auto-approve.yml` — **new**; the dial. Inert until the repo
  variable is set. Label + `ci` green + same-repo ⇒ submits the approving review.
  `dismiss_stale_reviews` keeps it honest across new pushes.
- `.github/workflows/claude-pr-review.yml` — **new**; Claude reviews every non-draft PR on
  open/ready with the repo checklist (freeze class, guardrail files, Task IDs, baseline),
  so the human decision takes under a minute. Inert until `ANTHROPIC_API_KEY` exists.
- `.github/workflows/claude.yml` — **new**; @claude mention agent on issues/PRs: answer
  questions, implement small asks, push fixes to PR branches. Same key gate.
- `.github/agents/merge-steward.agent.md` — rewritten to freeze-compliant posture
  (was: "standing authority to merge without approval" — a pre-freeze relic).
- `.claude/skills/steward/SKILL.md` — posture any Claude session auto-loads when driving
  PRs here (CI-failure discipline, evidence culture, guardrail files, merge conventions).

## 3. What else the fleet does

- **Session bootstrap (L4):** every Claude web/cloud session lands with `node_modules`
  installed, CI-parity mock env exported, and the navigator state-sync printed. No more
  "fresh clone, nothing runs" sessions.
- **Truthful briefings (L1):** `AGENTS.md` corrected 2026-08-21 — Vercel is canonical
  (was: Cloud Run), Phoenix is ACTIVE (was: paused), dual-run stack documented. A wrong
  briefing is worse than no agent: it aims the whole fleet at retired infrastructure.
- **Specialist review (L3):** `phoenix-pr-reviewer`, `repo-reviewer`, `mcp-security-reviewer`,
  `migration-verifier` subagents for deep passes on demand.
- **Scheduled cowork (L6):** `.cursor/automations/phoenix-next-slice.prompt.md` is ready to
  register (after C0.1 disables the legacy storm automations — see `HUMAN_TASKS.md`).

## 4. Owner activation runbook (one sitting, ~10 minutes)

1. **`ANTHROPIC_API_KEY`** → repo Settings → Secrets and variables → Actions → _Secrets_ →
   New repository secret. Powers `claude.yml` + `claude-pr-review.yml`. (Alternative:
   install the Claude GitHub App and use its OAuth token — see the workflow headers.)
2. **`STEWARD_AUTO_APPROVE`** → same page → _Variables_ → New variable → value `true`.
   This is the dial from §2. Leave unset to keep review-by-human.
3. **C0.1 (unchanged, still required):** disable the two legacy Cursor storm automations
   (IDs in `HUMAN_TASKS.md`) before registering any new scheduled automation.
4. Optional: register `.cursor/automations/phoenix-next-slice.prompt.md` (C0.2) for
   scheduled Phoenix slices, 2×/day.

## 5. Replicating to your other repos

Everything here is file-based and portable:

1. Copy `.github/workflows/{claude.yml,claude-pr-review.yml,steward-auto-approve.yml,merge-steward.yml}`.
2. Copy `.claude/hooks/session-start.sh` + `.claude/settings.json` (swap the install command
   for the repo's package manager) and an `AGENTS.md` that tells the truth about that repo.
3. Per repo: set `ANTHROPIC_API_KEY`, create the `steward-approved` label, run branch
   protection with a single required `ci` context (see `scripts/launch-ops/protect-branch.sh`
   for the reference implementation), set `STEWARD_AUTO_APPROVE` when trusted.
4. The steward posture skill (`.claude/skills/steward/SKILL.md`) travels as-is; strip the
   Phoenix-specific rules for repos without a freeze.

A note on platform choice: "install Foundry" (Azure AI Foundry / other agent platforms)
would bolt a second orchestration cloud onto a GitHub+Vercel repo whose agent surface is
already native to its harnesses. The leverage here is depth in the layers above — briefing,
skills, hooks, and GitHub-resident workflows — which every compatible agent picks up for
free. Revisit external platforms only if you need agents that live outside the repo
lifecycle (e.g., customer-facing product agents).

## 6. Guardrails that stay

- Freeze #209 classes gate what agents may _ship_; discovery is unbounded
  (`docs/ENHANCEMENT_LEDGER.md` lanes).
- Provider defaults never flip in any automation.
- `merge-steward` never approves, never bypasses protection, never treats freeze language
  as noise (its profile says so explicitly now).
- Secrets only via GitHub/Vercel secret stores; agents log missing credentials to
  `HUMAN_TASKS.md` and keep moving.

## 7. Roadmap (not yet installed)

- **CI-fix loop:** claude-code-action job on `workflow_run: ci` failure for agent-authored
  branches (supersedes the deleted `ci-fix-loop.yml` idea; needs the API key first).
- **Dependabot triage agent:** scheduled Claude pass over the 85 open alerts → grouped
  fix PRs (freeze-legal hardening).
- **Nightly repo-health routine:** CCR scheduled session running the navigator ritual and
  refreshing a pinned status issue.
- **Post-GO:** widen auto-approve to agent-authored L0/L1 classes; retire the label for
  docs-only PRs.
