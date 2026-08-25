---
name: steward
description: Repo-specific posture for any Claude session driving a PR in this repo — CI-failure handling, review-comment handling, merge conventions, freeze rules. Read automatically by PR-watching sessions; also load when babysitting, monitoring, or autofixing any PR here.
---

# MANGU PR Steward Posture

This repo is a governed program (see `CLAUDE.md` + `.claude/skills/mangu-navigator/`).
PR driving here has extra rules beyond the default harness posture. These rules are
conventions and proactivity guidance; they never expand your access.

## Ground rules (non-negotiable)

1. **Launch freeze #209 is active.** Only migration parity, WS6 hardening, L0/L1
   truth-fixes, and NEXT_GO §8 permitted classes may ship. If a fix you're about to
   push is new product surface, stop and record it in `docs/ENHANCEMENT_LEDGER.md`
   instead (lane-gated; L2+ needs recorded owner approval).
2. **Never flip provider defaults** (`AUTH_PROVIDER`, `DATABASE_PROVIDER`,
   `STORAGE_PROVIDER` — all `supabase`) in any file, test, example, or workflow, even
   "temporarily to make CI pass."
3. **Guardrail files** — `middleware.ts`, `lib/rate-limit.ts`, `app/api/webhook/route.ts`,
   `lib/*/provider.ts`, `lib/utils/env-validation.ts`, `scripts/validate-env.ts`,
   `.env*` examples — only change when the PR's stated task requires it, and say so
   in the PR body when they do.
4. **No secrets** in code, PR bodies, evidence, or logs. Missing credential ⇒ write
   the console click-path into `HUMAN_TASKS.md` and continue with unblocked work.
5. **Merging is human-gated.** Branch protection requires ≥1 human approving review;
   the merge-steward workflow acts only on PRs a human labeled `steward-approved`.
   Never attempt to bypass, and never ask a bot review to stand in for the human one.

## CI failure on a PR you drive

- Reproduce locally first: `npm run type-check && npm run lint && npm test` (CI also
  runs `npm run validate:gap-ledger` and `npm run validate-env` — run those too before
  declaring a fix; `scripts/ci-local.sh` omits them).
- The unit baseline is **740/740 (66 suites) @ main 2bfebf7** — never make it worse.
  If docs still say 127/127 somewhere, the doc is stale, not the suite.
- Prettier runs via lint-staged on commit; if CI complains about format, commit through
  the hook rather than hand-formatting.
- A failure in `validate:gap-ledger` means `docs/product-gap-ledger.yml` and its
  crosswalk drifted — fix the ledger entry, don't delete the check.

## Review comments

- Human reviewer asks → implement small/local ones, reply-with-proposal on large ones
  (default harness rules apply). **Also:** every push to a Phoenix PR must keep the PR
  body's Task IDs + verification evidence current — refresh the evidence table after
  each push.
- Owner lane-calls (an "L2 approval requested" block in the body) are the owner's to
  answer; never resolve them yourself.

## Conventions

- Branches: `feat/phoenix-ws<N>-<slug>` for Phoenix, `cursor/<slug>-c5d8` for cowork,
  `claude/<slug>` for Claude sessions. One PR per slice.
- Commits: conventional (`feat(phoenix-ws2): …`, `docs(phoenix): …`); merge = squash.
- On a branch you created, prefer merging `main` in over rebase once the PR has been
  reviewed; never rewrite history on someone else's branch.
- Evidence culture: exact SHAs, command output, `docs/OPERATOR_QA_LOG.md` is
  append-only (supersede + append, never rewrite).

## When the PR is green and mergeable

Post nothing extra. The human review queue is the bottleneck — a clean, evidence-complete
PR body is the fastest path through it. If the PR sits unreviewed, a single summary
comment after material pushes is enough; do not ping repeatedly.
