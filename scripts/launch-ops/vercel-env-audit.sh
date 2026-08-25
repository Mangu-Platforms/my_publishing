#!/usr/bin/env bash
# launch-ops: audit Vercel env var NAMES (values are never fetched or printed)
# for the my_publishing project, production + preview.
#
# Required env : VERCEL_TOKEN, VERCEL_PROJECT_MY_PUBLISHING
# Optional env : VERCEL_TEAM_ID
#
# Read-only — DRY_RUN does not apply. Exit code IS the audit verdict:
#   0 = all 10 required vars present in production, no forbidden vars there
#   1 = a required var is missing in production OR USE_MOCKS/SKIP_EMAILS exists
#       in production (validate-env.ts P0-016: both must be ABSENT)
# Preview gaps only warn — preview may legitimately lag production.
set -euo pipefail

missing=()
[[ -z "${VERCEL_TOKEN:-}" ]] && missing+=(VERCEL_TOKEN)
[[ -z "${VERCEL_PROJECT_MY_PUBLISHING:-}" ]] && missing+=(VERCEL_PROJECT_MY_PUBLISHING)
if (( ${#missing[@]} > 0 )); then
  echo "::error::Missing secret(s): ${missing[*]} (see HUMAN_TASKS.md H0.1-A)."
  exit 1
fi

# The 10 production-required vars — mirrors validateProductionShape() in
# scripts/validate-env.ts. Update BOTH places if the contract changes.
REQUIRED=(
  NEXT_PUBLIC_SUPABASE_URL
  NEXT_PUBLIC_SUPABASE_ANON_KEY
  SUPABASE_SERVICE_ROLE_KEY
  MONGODB_URI
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  STRIPE_SECRET_KEY
  STRIPE_WEBHOOK_SECRET
  NEXT_PUBLIC_SITE_URL
  UPSTASH_REDIS_REST_URL
  UPSTASH_REDIS_REST_TOKEN
)
FORBIDDEN=(USE_MOCKS SKIP_EMAILS)

PROJECT_ID="${VERCEL_PROJECT_MY_PUBLISHING}"
TEAM_PARAM=""
[[ -n "${VERCEL_TEAM_ID:-}" ]] && TEAM_PARAM="?teamId=${VERCEL_TEAM_ID}"

if ! envs=$(curl -sS --fail-with-body -H "Authorization: Bearer ${VERCEL_TOKEN}" \
      "https://api.vercel.com/v9/projects/${PROJECT_ID}/env${TEAM_PARAM}"); then
  echo "::error::Could not list Vercel envs — check VERCEL_TOKEN / VERCEL_PROJECT_MY_PUBLISHING / VERCEL_TEAM_ID."
  exit 1
fi

# Keep ONLY key+target from the response; drop everything else immediately so
# no later line can accidentally touch a value field.
names=$(jq '[.envs[] | {key, target: (.target | if type=="array" then . else [.] end)}]' <<<"${envs}")
in_target() { # $1=var $2=target → 0 if present
  jq -e --arg k "$1" --arg t "$2" \
    'any(.[]; .key == $k and (.target | index($t)))' <<<"${names}" >/dev/null
}

SUMMARY="${GITHUB_STEP_SUMMARY:-/dev/null}"
fails=0; warns=0
{
  echo "### Vercel env audit — project my_publishing"
  echo ""
  echo "| Variable | production | preview |"
  echo "|---|---|---|"
} | tee -a "${SUMMARY}"

for var in "${REQUIRED[@]}"; do
  p="MISSING"; v="missing"
  in_target "${var}" production && { p="present"; v="ok"; }
  [[ "${v}" == "ok" ]] || fails=$((fails+1))
  pre="missing"
  in_target "${var}" preview && pre="present"
  [[ "${pre}" == "present" ]] || warns=$((warns+1))
  echo "| ${var} | ${p} | ${pre} |" | tee -a "${SUMMARY}"
done
for var in "${FORBIDDEN[@]}"; do
  prod="absent (good)"; pre="absent (good)"
  if in_target "${var}" production; then prod="PRESENT — forbidden"; fails=$((fails+1)); fi
  if in_target "${var}" preview; then pre="present (warn)"; warns=$((warns+1)); fi
  echo "| ${var} (must be absent) | ${prod} | ${pre} |" | tee -a "${SUMMARY}"
done

echo ""
if (( fails > 0 )); then
  echo "::error::Vercel production env audit FAILED (${fails} problem(s) above): every required var must exist in production and USE_MOCKS/SKIP_EMAILS must be ABSENT (scripts/validate-env.ts P0-016)."
  exit 1
fi
(( warns > 0 )) && echo "::warning::${warns} preview-only gap(s) — preview may lag production, review the table."
echo "Production env audit passed."
