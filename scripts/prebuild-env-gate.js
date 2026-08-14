#!/usr/bin/env node
/**
 * Prebuild production environment gate (F-03).
 *
 * `next build` inlines NEXT_PUBLIC_* values into client bundles, so a Vercel
 * PRODUCTION build with a missing/placeholder variable must fail BEFORE the
 * build runs — not at first request. The contract itself (10 required vars,
 * USE_MOCKS/SKIP_EMAILS forbidden) lives in scripts/validate-env.ts; this
 * wrapper only decides WHEN to enforce it:
 *
 *   - VERCEL_ENV === 'production'  -> run the production validator and abort
 *     the build on failure.
 *   - anywhere else (local builds, Vercel preview, GitHub CI, Docker/Cloud
 *     Build) -> print a one-line skip notice and exit 0. CI intentionally
 *     builds with dummy values + USE_MOCKS=true, so the production contract
 *     cannot hold there; runtime enforcement is instrumentation.ts.
 *
 * Plain Node with zero dependencies on purpose: it must be runnable before
 * anything else in the build pipeline is assumed to work.
 */
'use strict';

const { spawnSync } = require('node:child_process');

// Vercel sets VERCEL_ENV to 'production' | 'preview' | 'development'.
const isVercelProduction = process.env.VERCEL_ENV === 'production';
// GitHub Actions is detected via GITHUB_ACTIONS, NOT the generic CI variable:
// Vercel also exports CI=1 during builds, so keying off CI would silently
// disable the gate exactly where it matters.
const isGitHubCI = process.env.GITHUB_ACTIONS === 'true';

if (!isVercelProduction || isGitHubCI) {
  const reason = isGitHubCI
    ? 'GITHUB_ACTIONS=true'
    : `VERCEL_ENV=${process.env.VERCEL_ENV || '(unset)'}`;
  console.log(
    `[prebuild-env-gate] Skipping production env validation (${reason}) — gate only enforces Vercel production builds.`
  );
  process.exit(0);
}

console.log(
  '[prebuild-env-gate] VERCEL_ENV=production — validating env contract before `next build`…'
);

// Reuse the exact runner package.json already defines for this contract
// ("validate-env:production": "tsx scripts/validate-env.ts --production") so
// the required-variable list keeps a single source of truth.
const result = spawnSync('npm', ['run', 'validate-env:production'], {
  stdio: 'inherit',
  shell: process.platform === 'win32', // npm is npm.cmd on Windows
});

if (result.error) {
  console.error(`[prebuild-env-gate] Could not run validator: ${result.error.message}`);
  process.exit(1);
}
if (result.status !== 0) {
  console.error(
    '[prebuild-env-gate] Production env contract FAILED — aborting before `next build`. Fix the Vercel Production env vars named above.'
  );
  process.exit(result.status ?? 1);
}
console.log('[prebuild-env-gate] Production env contract OK — proceeding to `next build`.');
