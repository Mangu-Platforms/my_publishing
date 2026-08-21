#!/usr/bin/env bash
# mangu-navigator: session-start state sync for redinc23/my_publishing.
# Read-only. Prints git state, provider switches, both ledger headers, the
# North Star #6 counter, human-gate load, and (with --probe) live prod health.
# Usage: state-sync.sh [--probe] [--repo <path>]
set -uo pipefail

PROBE=0
REPO=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --probe) PROBE=1 ;;
    --repo) REPO="${2:-}"; shift ;;
    *) echo "unknown arg: $1" >&2; exit 2 ;;
  esac
  shift
done

if [[ -z "${REPO}" ]]; then
  REPO="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
fi
cd "${REPO}" || { echo "cannot cd to ${REPO}" >&2; exit 1; }
if [[ ! -f "package.json" ]] || ! grep -q '"name": "mangu-publishers"' package.json 2>/dev/null; then
  echo "warning: ${REPO} does not look like the mangu-publishers repo" >&2
fi

ORIGIN="${CANONICAL_ORIGIN:-https://www.mangu-publishers.com}"
hr() { printf '%s\n' "----------------------------------------------------------------------"; }

hr; echo "MANGU STATE SYNC  ($(date -u +%Y-%m-%dT%H:%M:%SZ))"; hr

echo "[git]"
echo "  branch : $(git branch --show-current 2>/dev/null || echo '?')"
echo "  head   : $(git rev-parse --short HEAD 2>/dev/null || echo '?')  ($(git log -1 --format=%cs 2>/dev/null || echo '?'))"
echo "  recent :"
git log --oneline -5 2>/dev/null | sed 's/^/    /' || echo "    (no git history)"
DIRTY=$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')
echo "  dirty  : ${DIRTY} uncommitted path(s)"

echo
echo "[switches]  (defaults are prod-safe: supabase)"
AUTHP="${AUTH_PROVIDER:-supabase (default)}"
DBP="${DATABASE_PROVIDER:-supabase (default)}"
echo "  AUTH_PROVIDER     = ${AUTHP}"
echo "  DATABASE_PROVIDER = ${DBP}"
if [[ "${AUTH_PROVIDER:-}" == "better-auth" ]]; then
  echo "  !! better-auth is primary in THIS shell. Never let this reach Vercel Production before Phase 11-12."
fi

echo
echo "[ledger B: phoenix]"
if [[ -f CLAUDE.md ]]; then
  head -8 CLAUDE.md | grep -E "PROJECT PHOENIX|Status" | sed 's/^[#> ]*/  /' | head -3
fi
if [[ -f docs/PROJECT_PHOENIX.md ]]; then
  echo "  contract: docs/PROJECT_PHOENIX.md ($(git log -1 --format=%cs -- docs/PROJECT_PHOENIX.md 2>/dev/null || echo '?'))"
fi
LAST_PHX=$(git log --oneline -3 --grep="phoenix" -i 2>/dev/null | sed 's/^/    /')
if [[ -n "${LAST_PHX}" ]]; then echo "  recent phoenix commits:"; echo "${LAST_PHX}"; fi

echo
echo "[ledger A: launch authority]"
if [[ -f docs/NEXT_GO.md ]]; then
  STATUS_LINE=$(grep -m1 -E '^\| \*\*Status\*\*' docs/NEXT_GO.md | sed 's/[|*]//g' | tr -s ' ' | sed 's/^ //')
  echo "  ${STATUS_LINE:-status line not found}"
  TRUES=$(grep -cE '^\| G[0-9]+.*\*\*TRUE\*\*' docs/NEXT_GO.md 2>/dev/null || echo 0)
  echo "  hard gates marked TRUE in doc: ${TRUES}/13 (verify against live evidence, not just the doc)"
  echo "  updated: $(git log -1 --format=%cs -- docs/NEXT_GO.md 2>/dev/null || echo '?')"
else
  echo "  docs/NEXT_GO.md missing (!)"
fi

echo
echo "[north star #6: supabase burn-down]"
SUPA_FILES=$(grep -rl "supabase" app/ lib/ components/ types/ --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l | tr -d ' ')
echo "  files referencing supabase in app/ lib/ components/ types/: ${SUPA_FILES}  (target: 0 after WS4)"
MIGS=$(ls supabase/migrations/*.sql 2>/dev/null | wc -l | tr -d ' ')
echo "  supabase migrations tracked: ${MIGS}"

echo
echo "[human gates]"
if [[ -f HUMAN_TASKS.md ]]; then
  ITEMS=$(grep -cE '^### ' HUMAN_TASKS.md 2>/dev/null || echo 0)
  echo "  HUMAN_TASKS.md items (### headings): ${ITEMS}  ($(git log -1 --format=%cs -- HUMAN_TASKS.md 2>/dev/null || echo '?'))"
  grep -m4 -E '^### ' HUMAN_TASKS.md | sed 's/^### /    - /'
  echo "    ..."
else
  echo "  HUMAN_TASKS.md missing (!)"
fi

echo
echo "[quality signals]"
[[ -x scripts/ci-local.sh ]] && echo "  local CI parity: ./scripts/ci-local.sh" || echo "  scripts/ci-local.sh not found"
echo "  unit baseline expectation: 740/740 across 66 suites @ 2026-08-20 (do not regress)"

if [[ ${PROBE} -eq 1 ]]; then
  echo
  echo "[prod probes] ${ORIGIN}"
  for path in /api/live /api/health "/api/health?ready=1"; do
    code=$(curl -sS -o /tmp/mangu-probe.$$ -w '%{http_code}' --max-time 15 "${ORIGIN}${path}" 2>/dev/null)
    body=$(head -c 200 /tmp/mangu-probe.$$ 2>/dev/null | tr -d '\n')
    echo "  ${path} -> HTTP ${code:-000}  ${body}"
    rm -f /tmp/mangu-probe.$$
  done
fi

if command -v gh >/dev/null 2>&1; then
  echo
  echo "[open PRs]"
  gh pr list --state open --limit 8 2>/dev/null | sed 's/^/  /' || echo "  (gh available but query failed)"
fi

echo
hr
echo "Next: apply the next-best-action algorithm (SKILL.md section 4)."
echo "Read: CLAUDE.md | HUMAN_TASKS.md | docs/NEXT_GO.md | docs/PROJECT_PHOENIX.md"
hr
