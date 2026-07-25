# Cowork Operator — Continuous Agent Playbook

**Mission:** Production site + catalog MCP working; Project Phoenix North Star complete.  
**Owner (human):** Faith / books@mangu-publishers.com  
**Agents:** Cursor Cloud / Claude Code reading this repo

This file is the **in-repo cowork control plane**. Cursor dashboard automations cannot be
created by agents via API — humans toggle those; agents keep this file + `HUMAN_TASKS.md` honest.

---

## Status check (agents: run first)

```bash
./scripts/cowork-status.sh
```

Or manually:

1. Read `HUMAN_TASKS.md` (especially **Cowork control** section).
2. `gh pr list --state open --limit 30`
3. Probe `https://www.mangu-publishers.com/api/health?ready=1`
4. Confirm storm automations are **disabled** (see below). If still enabled → stop opening new work; tell human.

---

## Path decision (locked)

| Path               | Meaning                                                                  |
| ------------------ | ------------------------------------------------------------------------ |
| **B — Phoenix**    | **ACTIVE.** Execute WS1→WS6 per `CLAUDE.md` + `docs/PROJECT_PHOENIX.md`. |
| A — Stabilize only | Paused. Do not use unless human flips this table.                        |

Skills live in `.claude/skills/` (merged). Load relevant `SKILL.md` every slice.

---

## Human must disable these Cursor automations (storm sources)

| Name                         | ID                                     | URL                                                                 | Required state |
| ---------------------------- | -------------------------------------- | ------------------------------------------------------------------- | -------------- |
| Fix CI failures              | `094ce0ad-7ba5-11f1-ba66-0e7d0216e441` | https://cursor.com/automations/094ce0ad-7ba5-11f1-ba66-0e7d0216e441 | **DISABLED**   |
| pr (Repository health sweep) | `ab582f50-7ba7-11f1-ba66-0e7d0216e441` | https://cursor.com/automations/ab582f50-7ba7-11f1-ba66-0e7d0216e441 | **DISABLED**   |

Verified enabled as of 2026-07-19 — they keep opening draft CI/health PRs.

---

## Safe Cursor automations to create (human, dashboard)

Create at https://cursor.com/automations — **only after** the two storm automations are off.

### Automation 1 — Phoenix next slice (cron 2×/day)

- **Name:** `Phoenix next slice`
- **Trigger:** Schedule — `0 14,22 * * *` UTC (adjust as needed)
- **Repo:** `redinc23/my_publishing`
- **Prompt:** paste from [`.cursor/automations/phoenix-next-slice.prompt.md`](../.cursor/automations/phoenix-next-slice.prompt.md)

### Automation 2 — Prod health triage (only on failure)

Prefer GitHub Actions `prod-health-watch.yml` (in-repo). If you also want a Cursor agent:

- **Name:** `Prod health triage`
- **Trigger:** Manual or rare cron (max 1×/day)
- **Prompt:** paste from [`.cursor/automations/prod-health-triage.prompt.md`](../.cursor/automations/prod-health-triage.prompt.md)

**Do not** recreate “fix every CI failure” without branch protection + max-1-PR guard.

---

## Cloud Agent environment (repo-owned)

`.cursor/environment.json` is committed and **overrides** any personal or team
dashboard environment (Cursor resolution order: repo file → personal → team).
It runs `bash .cursor/install.sh` on every VM boot.

That script exists because two install-time faults kept bricking cloud agents
(diagnosed 2026-07-25 — see PR #348):

1. **Lockfile drift** — `npm ci` exits `EUSAGE` when `package.json` and the
   lockfile disagree. The script falls back to `npm install` and warns.
2. **Node shadowing** — `/exec-daemon/node` is v22.14.0 and precedes nvm on the
   default PATH. Combined with `engine-strict=true` and
   `engines.node >= 22.22.1`, a bare `npm ci` fails `EBADENGINE`. The script
   pins `.nvmrc`'s node onto `PATH` first and appends the pin to `~/.bashrc`.

Do **not** re-record a personal SETUP_FLOW install that only runs `npm ci` —
it will be ignored while the repo file is present, and recreating it after
deleting the repo file would reintroduce both faults. Edit
`.cursor/install.sh` instead.

---

## One-shot Cloud Agent prompt (manual)

When starting a new agent by hand, paste:

[`../.cursor/automations/phoenix-next-slice.prompt.md`](../.cursor/automations/phoenix-next-slice.prompt.md)

---

## Agent rules (non-negotiable)

1. One slice → one PR → stop. Branch `cursor/<slug>-c5d8`.
2. No duplicate recon / health-sweep / ci-autofix PRs.
3. Never invent secrets; append `HUMAN_TASKS.md`.
4. Keep CI green; feature freeze.
5. End every run with a **Next-run prompt** block the human can paste.

---

## Definition of done (engagement)

Phoenix North Star `docs/PROJECT_PHOENIX.md` §1.2 + prod `ready:true` + MCP gated correctly.
