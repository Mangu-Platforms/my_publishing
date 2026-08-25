#!/usr/bin/env bash
# launch-ops: enable Supabase leaked-password protection (HaveIBeenPwned check)
# via the Management API — HUMAN_TASKS.md H1.4, flagged by Security Advisor.
#
# Required env : SUPABASE_ACCESS_TOKEN (sbp_… personal access token,
#                supabase.com/dashboard/account/tokens)
# Optional env : SUPABASE_PROJECT_REF (default tkzvikozrcynhwsqtkqp — override
#                via the repo/org *variable* SUPABASE_PROJECT_REF),
#                DRY_RUN (default true)
#
# The exact field name is verified against the live API response at runtime
# (we grep the returned key names) instead of trusting documentation: the
# Management API has renamed auth-config fields before. We only ever print
# key NAMES and this one boolean — the config payload also carries secrets
# (SMTP password, captcha keys) and must never be dumped.
set -euo pipefail

REF="${SUPABASE_PROJECT_REF:-tkzvikozrcynhwsqtkqp}"
DRY_RUN="${DRY_RUN:-true}"
FIELD="password_hibp_enabled"   # expected name; verified below before use
API="https://api.supabase.com/v1/projects/${REF}/config/auth"

if [[ -z "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
  echo "::error::Missing secret SUPABASE_ACCESS_TOKEN (create at supabase.com/dashboard/account/tokens)."
  exit 1
fi
auth=(-H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}")

if ! config=$(curl -sS --fail-with-body "${auth[@]}" "${API}"); then
  echo "::error::GET ${API} failed — check SUPABASE_ACCESS_TOKEN and project ref '${REF}'."
  printf '%s\n' "${config}" | jq -r '.message? // .' 2>/dev/null || true
  exit 1
fi

# Runtime verification: list candidate key names (names only, never values).
echo "Auth-config keys matching hibp/leak/pwned:"
candidates=$(jq -r 'keys[] | select(test("hibp|leak|pwned"; "i"))' <<<"${config}")
printf '  %s\n' ${candidates:-"(none)"}

if ! grep -qx "${FIELD}" <<<"${candidates}"; then
  echo "::error::Expected field '${FIELD}' not present in the auth config response. The API shape changed — inspect the candidate key names above and update FIELD in this script. Refusing to PATCH an unverified field."
  exit 1
fi

current=$(jq -r --arg f "${FIELD}" '.[$f]' <<<"${config}")
echo "Current ${FIELD}=${current}"
if [[ "${current}" == "true" ]]; then
  echo "OK: leaked-password protection already enabled — nothing to do."
  exit 0
fi

if [[ "${DRY_RUN}" == "true" ]]; then
  echo "DRY RUN — would PATCH ${FIELD}=true on project ${REF}."
  exit 0
fi

if ! patched=$(curl -sS --fail-with-body -X PATCH "${auth[@]}" \
      -H "Content-Type: application/json" \
      -d "{\"${FIELD}\": true}" "${API}"); then
  echo "::error::PATCH failed — enable manually: Dashboard → Authentication → Settings → Password Security (project ${REF})."
  printf '%s\n' "${patched}" | jq -r '.message? // .' 2>/dev/null || true
  exit 1
fi

# Confirm from the PATCH response (never dump the whole payload).
after=$(jq -r --arg f "${FIELD}" '.[$f]' <<<"${patched}")
if [[ "${after}" != "true" ]]; then
  echo "::error::PATCH accepted but ${FIELD} is still '${after}' — verify in the dashboard."
  exit 1
fi
echo "Leaked-password protection ENABLED on ${REF}. Re-run Security Advisor to confirm the finding clears (H1.4)."
