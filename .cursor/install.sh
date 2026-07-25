#!/usr/bin/env bash
#
# Cursor Cloud Agent bootstrap for redinc23/my_publishing.
#
# Wired from `.cursor/environment.json` (`install: bash .cursor/install.sh`).
# Runs NON-interactively from the project root after each pull, so it cannot
# rely on ~/.bashrc having already activated nvm.
#
# Two faults this exists to prevent (diagnosed 2026-07-25):
#
#   1. Lockfile drift — `npm ci` exits EUSAGE when package.json and
#      package-lock.json disagree. Fall back to `npm install` so the VM is
#      still usable, and print a loud WARN so the next PR regenerates the
#      lockfile.
#   2. Node shadowing — `/exec-daemon/node` is v22.14.0 and sits ahead of
#      nvm on the default PATH. `/exec-daemon` ships no `npm`, so a bare
#      `npm ci` pairs nvm's npm with the older node. Combined with
#      `engine-strict=true` and `engines.node >= 22.22.1`, that fails
#      EBADENGINE. We pin .nvmrc's node onto PATH first and make it stick.
#
set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$(pwd)"

log()  { printf '>>> [install] %s\n' "$*"; }
warn() { printf '>>> [install] WARN: %s\n' "$*" >&2; }

# ── 1. Env file FIRST ───────────────────────────────────────────────────────
# A dependency failure must never leave the VM without a bootable .env.local.
# `npm run dev` gates on validate-env; without these stubs it cannot start.
if [ ! -f .env.local ]; then
  log "writing .env.local stubs (USE_MOCKS=true)"
  cat > .env.local <<'ENV'
USE_MOCKS=true
SKIP_EMAILS=true
NEXT_PUBLIC_SUPABASE_URL=https://test.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=test-anon-key-for-local-development-only
SUPABASE_SERVICE_ROLE_KEY=test-service-role-key-for-local-development-only
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_placeholder
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NODE_ENV=development
ENV
else
  log ".env.local already present — leaving it alone"
fi

# ── 2. Pin Node from .nvmrc ahead of /exec-daemon/node ──────────────────────
if [ ! -f .nvmrc ]; then
  echo "FATAL: .nvmrc missing — cannot pin Node" >&2
  exit 1
fi
NODE_VERSION="$(tr -d '[:space:]' < .nvmrc)"
NODE_VERSION="${NODE_VERSION#v}"

export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [ ! -s "$NVM_DIR/nvm.sh" ]; then
  echo "FATAL: nvm not found at $NVM_DIR/nvm.sh — bake nvm into the snapshot" >&2
  exit 1
fi
# shellcheck disable=SC1091
. "$NVM_DIR/nvm.sh"

log "installing Node v${NODE_VERSION} via nvm (honours .nvmrc)"
nvm install "$NODE_VERSION" >/dev/null
nvm alias default "$NODE_VERSION" >/dev/null || true

NODE_BIN="$NVM_DIR/versions/node/v${NODE_VERSION}/bin"
if [ ! -x "$NODE_BIN/node" ]; then
  echo "FATAL: expected $NODE_BIN/node after nvm install" >&2
  exit 1
fi
export PATH="$NODE_BIN:$PATH"

# Persist the pin for every subsequent agent shell. Cursor often resets PATH
# between steps; without this, the next non-interactive command falls back to
# /exec-daemon/node (v22.14.0) and EBADENGINE returns.
if ! grep -qF 'MANGU_NODE_PIN' "$HOME/.bashrc" 2>/dev/null; then
  {
    echo ''
    echo '# MANGU_NODE_PIN — keep .nvmrc node ahead of /exec-daemon/node'
    echo "export PATH=\"$NODE_BIN:\$PATH\""
  } >> "$HOME/.bashrc"
  log "appended MANGU_NODE_PIN to ~/.bashrc"
fi

ACTIVE="$(node -v)"
if [ "$ACTIVE" != "v${NODE_VERSION}" ]; then
  echo "FATAL: expected v${NODE_VERSION}, got ${ACTIVE}. PATH=$PATH" >&2
  exit 1
fi
log "node $(node -v) / npm $(npm -v)  (from $NODE_BIN)"

# ── 3. Dependencies ─────────────────────────────────────────────────────────
# Prefer `npm ci` (reproducible, cacheable). Fall back so lockfile drift
# degrades the environment instead of bricking it — but warn loudly.
log "npm ci"
if ! npm ci --no-audit --no-fund; then
  warn "npm ci failed — package-lock.json has drifted from package.json."
  warn "Falling back to npm install. Regenerate and commit the lockfile in the next PR."
  npm install --no-audit --no-fund
fi

# ── 4. Best-effort tooling ──────────────────────────────────────────────────
# Never fail the VM for these. Each is gated by `command -v` so re-runs are
# cheap, and each failure is a WARN rather than an exit.

# Playwright browsers — Phoenix contract makes Playwright a merge gate.
if [ ! -d "$HOME/.cache/ms-playwright" ]; then
  log "installing Playwright Chromium (best-effort)"
  if ! npx --yes playwright install --with-deps chromium; then
    warn "playwright browsers unavailable — npm run test:e2e will not run"
  fi
else
  log "Playwright cache present — skipping browser install"
fi

# psql — npm run phoenix:export (P11.1)
if ! command -v psql >/dev/null 2>&1; then
  log "installing postgresql-client (best-effort)"
  if ! { sudo apt-get update -qq && sudo apt-get install -y -qq postgresql-client; }; then
    warn "psql unavailable — npm run phoenix:export will not run"
  fi
else
  log "psql already present: $(command -v psql)"
fi

# mongosh + mongoimport — npm run phoenix:verify / P11.4
if ! command -v mongosh >/dev/null 2>&1 || ! command -v mongoimport >/dev/null 2>&1; then
  log "installing mongosh + mongodb-database-tools (best-effort)"
  if ! {
    curl -fsSL https://pgp.mongodb.com/server-8.0.asc \
      | sudo gpg --dearmor --yes -o /usr/share/keyrings/mongodb-server-8.0.gpg \
    && echo "deb [signed-by=/usr/share/keyrings/mongodb-server-8.0.gpg] https://repo.mongodb.org/apt/ubuntu noble/mongodb-org/8.0 multiverse" \
      | sudo tee /etc/apt/sources.list.d/mongodb-org-8.0.list >/dev/null \
    && sudo apt-get update -qq \
    && sudo apt-get install -y -qq mongodb-mongosh mongodb-database-tools
  }; then
    warn "mongosh/mongoimport unavailable — phoenix:verify and P11.4 need them"
  fi
else
  log "mongosh already present: $(command -v mongosh)"
fi

# ── Summary ─────────────────────────────────────────────────────────────────
log "bootstrap complete"
log "  node      : $(node -v) ($(command -v node))"
log "  npm       : $(npm -v)"
log "  next      : $([ -x node_modules/.bin/next ] && echo present || echo MISSING)"
log "  psql      : $(command -v psql 2>/dev/null || echo MISSING)"
log "  mongosh   : $(command -v mongosh 2>/dev/null || echo MISSING)"
log "  mongoimport: $(command -v mongoimport 2>/dev/null || echo MISSING)"
log "  playwright: $([ -d "$HOME/.cache/ms-playwright" ] && echo present || echo MISSING)"
log "cwd=$ROOT"
