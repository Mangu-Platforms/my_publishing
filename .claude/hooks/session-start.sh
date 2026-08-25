#!/bin/bash
# SessionStart hook — bootstrap Claude Code on the web / cloud sessions.
#
# Remote containers start from a fresh clone with no node_modules, so tests,
# lint, and type-check all fail until dependencies exist. This hook installs
# them up front and prints the navigator state-sync so every session starts
# with ledger ground truth instead of re-deriving it.
#
# Local sessions are untouched (guarded on CLAUDE_CODE_REMOTE).
set -uo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-$(pwd)}"

# --- dependencies (idempotent; container state is cached between sessions) ---
if [ ! -d node_modules ] || [ package-lock.json -nt node_modules ]; then
  npm install --no-audit --no-fund 2>&1 | tail -n 3
fi

# --- CI-parity mock env for build/dev iterations (same values as ci-local.sh;
#     Jest needs none of these — they only unblock `next build` / `next dev`) ---
if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  {
    echo 'export USE_MOCKS="${USE_MOCKS:-true}"'
    echo 'export NEXT_PUBLIC_SUPABASE_URL="${NEXT_PUBLIC_SUPABASE_URL:-https://test.supabase.co}"'
    echo 'export NEXT_PUBLIC_SUPABASE_ANON_KEY="${NEXT_PUBLIC_SUPABASE_ANON_KEY:-test-anon-key-for-ci}"'
    echo 'export NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="${NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY:-pk_test_placeholder}"'
    echo 'export NEXT_PUBLIC_SITE_URL="${NEXT_PUBLIC_SITE_URL:-http://localhost:3000}"'
  } >> "$CLAUDE_ENV_FILE"
fi

# --- session ground truth (read-only; navigator ritual step 1) ---
if [ -x .claude/skills/mangu-navigator/scripts/state-sync.sh ]; then
  bash .claude/skills/mangu-navigator/scripts/state-sync.sh 2>/dev/null || true
fi

exit 0
