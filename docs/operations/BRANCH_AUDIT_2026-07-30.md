# Branch audit — 2026-07-30

**Recorder:** Claude (AI assistant), at the owner's direction.
**Method + honesty note:** classification uses (a) tip-SHA identity against known
`main`-history commits where available, (b) the open-PR map (as of today: the only open
PRs besides #379 and this one are dependabot), and (c) the launch-programme record
(`PROGRAMME_STATUS.md`), which documents the programme branches' content landing on
`main` 2026-07-29. **No per-branch `git merge-base` comparison was run** — rows marked
“likely” deserve a one-glance check before deletion. Nothing was deleted.

**Rule used:** a branch is delete-safe when its work is on `main`, it backs no open PR,
and it is not named by an open decision.

## Proven merged (tip SHA appears in `main` history) — delete-safe

| Branch | Proof |
| --- | --- |
| `docs/nextgo-phoenix-class6` @ `36f7528` | Tip is literally `main` commit #367 |

## Programme branches — content on `main` per the 2026-07-29 merges; delete after one glance

| Branch | Note |
| --- | --- |
| `task/accessibility-and-browser-matrix` | #360's work; A11Y tokens verified live in production HTML today. Keep only until HA-C18 sign-off is recorded, then delete. |
| `cursor/ci-fix-loop-41d2`, `cursor/pr-backlog-triage-*`, `cursor/cowork-pr-*` | Agent working branches from the PR-storm/triage era |
| `cursor/phoenix-*` (7 branches) | Phoenix workstream agents; WS2a–d landed via #348/#349 and the programme |
| `cursor/mcp-*`, `cursor/mongodb-scaffold-dffa` | Mongo/MCP scaffold agents; dual-run layer is on `main` |
| `cursor/e001-*`, `cursor/honest-book-clubs-e001-3c9a`, `cursor/l0-honest-surfaces-facf`, `feat/truth-placeholder-sweep` | Truthfulness sweeps; superseded by Task 4.6 (#354) on `main` |
| `cursor/structured-logger-e002-6004`, `cursor/mangu-navigator-ws2a-*`, `cursor/copilot-cli-integration-3cae` | Experiment branches |
| `agent/pr1-manuscript-hardening` | Manuscript hardening landed as the 20260724* migration set (#345 era); glance then delete |
| `tmp/workflow-scope-probe` | Explicitly temporary |

## Review before deleting — may hold unmerged work or is named by an open item

| Branch | Why keep for now |
| --- | --- |
| `fix/issue-202-203` | Issue #203 (P0-016, payment/rate-limit secrets) is still open; confirm the branch adds nothing before deleting |
| `feat/cinema-library` | Feature work; no matching open PR — confirm abandoned vs pending |
| `feature/top-dog-launch` | Same |

## Dependabot (bot-managed — do not hand-delete)

7 minor/patch PRs remain open for post-launch (#369, #371, #372, #374, #375, #376, #377).
3 majors closed today with comments: #370 (typescript 5→7), #373 (openai 6→7),
#378 (@vercel/blob 0.27→2.6) — major bumps don't belong in a launch freeze; reopen
any of them post-launch and dependabot will refresh the branch.

## Net effect once executed

43 branches → `main` + 7 dependabot + 3 review-first + (temporarily)
`task/accessibility-and-browser-matrix` ≈ **12**, from 43. The repo stops screaming.
