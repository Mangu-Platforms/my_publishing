---
name: mangu-ci-quality
description: This skill should be used when changing CI workflows, Jest, Playwright, test baselines, preview e2e, or deciding whether a Phoenix PR is mergeable.
version: 1.0.0
---

# CI & Quality Gates

## Floor (recon baseline)

- Jest: **do not worsen** the recorded pass count (re-measured: 740/740 across 66 suites @ `main` 2bfebf7, 2026-08-20; the 2026-07-18 recon figure of 127/127 is long superseded — re-measure when touching tests).
- Playwright: CI (`e2e.yml` / `preview-e2e.yml`) is baseline of record when local secrets are absent (delta D7).

## Rules

1. Every PR keeps CI green. No "temporary" red merges.
2. WS5 replaces Supabase mocks with Mongo/Better Auth mocks; add webhook idempotency + rating tests.
3. WS4 retires Supabase/GCP-touching workflows per recon inventory — do not delete rollback-needed Cloud Run artifacts until Phase 13/14 allows.
4. Prefer fixing flakes over skipping.

## Local commands

```bash
npm test
npm run type-check
npm run lint
npx playwright test   # may require env; if blocked, note human gate
```

## References

- `references/workflow-inventory.md`
