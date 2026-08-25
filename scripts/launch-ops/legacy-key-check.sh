#!/usr/bin/env bash
# launch-ops: verify the OLD (legacy JWT) Supabase anon key is really disabled.
# Companion to rotate-supabase-key.yml: after a rotation the summary tells the
# human to disable the old key and probe it with curl — this automates that
# probe so "did we actually finish the rotation?" is a one-click question.
#
# Optional env : SUPABASE_LEGACY_ANON_KEY (the OLD key; when unset the check
#                is skipped with a notice — that is not a failure),
#                SUPABASE_PROJECT_REF (default tkzvikozrcynhwsqtkqp)
#
# Read-only probe — DRY_RUN does not apply.
#   401/403 → PASS  (Supabase rejects the key: rotation fully complete)
#   200     → FAIL  (legacy key still active — disable it in the dashboard)
set -euo pipefail

REF="${SUPABASE_PROJECT_REF:-tkzvikozrcynhwsqtkqp}"

if [[ -z "${SUPABASE_LEGACY_ANON_KEY:-}" ]]; then
  echo "::notice::Secret SUPABASE_LEGACY_ANON_KEY not set — legacy-key check skipped. To arm it, store the OLD anon key under that name after the next rotation."
  exit 0
fi
# Belt-and-braces: Actions already masks secret values, but mask again in case
# the value arrived via other plumbing. (::add-mask:: is consumed by the
# runner; the guard keeps non-Actions shells from echoing the key.)
[[ -n "${GITHUB_ACTIONS:-}" ]] && echo "::add-mask::${SUPABASE_LEGACY_ANON_KEY}"

URL="https://${REF}.supabase.co/rest/v1/"
# -o /dev/null: the body could echo request details; only the status matters.
code=$(curl -sS -o /dev/null -w '%{http_code}' \
  -H "apikey: ${SUPABASE_LEGACY_ANON_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_LEGACY_ANON_KEY}" \
  "${URL}") || {
    echo "::error::Network failure probing ${URL} — check SUPABASE_PROJECT_REF ('${REF}')."; exit 1; }

case "${code}" in
  401|403)
    echo "PASS: legacy anon key is rejected (HTTP ${code}) — rotation is complete." ;;
  200)
    echo "::error::FAIL: legacy key still ACTIVE (HTTP 200 from ${URL}) — disable it: https://supabase.com/dashboard/project/${REF}/settings/api → API Keys → legacy anon JWT → Disable. Rotate first via rotate-supabase-key.yml if you have not."
    exit 1 ;;
  *)
    echo "::error::Inconclusive: HTTP ${code} from ${URL} (expected 401/403 or 200). Verify SUPABASE_PROJECT_REF and re-run."
    exit 1 ;;
esac
