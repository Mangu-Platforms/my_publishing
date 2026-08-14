#!/usr/bin/env bash
# launch-ops: ensure the `steward-approved` label exists (merge-steward gate).
#
# Required env : GH_TOKEN (the workflow passes the default GITHUB_TOKEN —
#                creating labels only needs `issues: write`, no PAT required)
# Optional env : GITHUB_REPOSITORY (defaults to redinc23/my_publishing),
#                DRY_RUN (default true)
#
# Idempotent: GET first; create only when missing; PATCH only on color/
# description drift; a 422 on create (concurrent creation race) is tolerated
# and re-verified instead of failing.
set -euo pipefail

REPO="${GITHUB_REPOSITORY:-redinc23/my_publishing}"
DRY_RUN="${DRY_RUN:-true}"
NAME="steward-approved"
COLOR="B91C1C"   # GitHub wants the hex WITHOUT the leading '#'
DESC="Human-approved for steward auto-merge"

if [[ -z "${GH_TOKEN:-}${GITHUB_TOKEN:-}" ]]; then
  echo "::error::Missing GH_TOKEN (or GITHUB_TOKEN). In the workflow this is the default github.token; locally run 'gh auth login' or export GH_TOKEN."
  exit 1
fi

fetch_label() { gh api "repos/${REPO}/labels/${NAME}" 2>/dev/null; }

if existing=$(fetch_label); then
  color=$(jq -r '.color' <<<"${existing}")
  desc=$(jq -r '.description // ""' <<<"${existing}")
  # Compare color case-insensitively — GitHub normalises hex to lowercase.
  if [[ "${color,,}" == "${COLOR,,}" && "${desc}" == "${DESC}" ]]; then
    echo "OK: label '${NAME}' already exists with the expected color/description."
    exit 0
  fi
  echo "Label '${NAME}' exists but drifted (color=${color} desc='${desc}')."
  if [[ "${DRY_RUN}" == "true" ]]; then
    echo "DRY RUN — would PATCH to color=${COLOR} desc='${DESC}'."
    exit 0
  fi
  gh api -X PATCH "repos/${REPO}/labels/${NAME}" -f color="${COLOR}" -f description="${DESC}" >/dev/null
  echo "Label '${NAME}' updated."
  exit 0
fi

echo "Label '${NAME}' is missing."
if [[ "${DRY_RUN}" == "true" ]]; then
  echo "DRY RUN — would create '${NAME}' (color=${COLOR}, desc='${DESC}')."
  exit 0
fi

# 422 = "already_exists" (someone created it between our GET and POST). That is
# success for our purposes — re-fetch to confirm rather than failing the run.
if gh api -X POST "repos/${REPO}/labels" \
     -f name="${NAME}" -f color="${COLOR}" -f description="${DESC}" >/dev/null 2>&1; then
  echo "Label '${NAME}' created."
elif fetch_label >/dev/null; then
  echo "Label '${NAME}' appeared concurrently (422 tolerated) — verified present."
else
  echo "::error::Could not create label '${NAME}' on ${REPO} — check that the token has issues:write on this repo."
  exit 1
fi
