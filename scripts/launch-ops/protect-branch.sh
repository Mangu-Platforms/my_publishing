#!/usr/bin/env bash
# launch-ops: enforce branch protection on `main`.
#
# Required env : GH_PAT_SECRETS  (fine-grained PAT with Administration:write —
#                the default GITHUB_TOKEN can NEVER do this: Actions does not
#                offer an `administration` permission, so branch protection is
#                unreachable with it by design)
# Optional env : GITHUB_REPOSITORY (owner/repo; defaults to redinc23/my_publishing
#                for local runs — the workflow always sets it), DRY_RUN (default true)
#
# Idempotent: GET current protection first; if it already satisfies the policy
# we exit 0 without a PUT. Otherwise report the diff and PUT (unless DRY_RUN).
# The PUT endpoint replaces the WHOLE protection object, so we carry over
# unrelated toggles (linear history, conversation resolution, restrictions…)
# from the current config to avoid silently downgrading them.
set -euo pipefail

REPO="${GITHUB_REPOSITORY:-redinc23/my_publishing}"
DRY_RUN="${DRY_RUN:-true}"
API="https://api.github.com/repos/${REPO}/branches/main/protection"

if [[ -z "${GH_PAT_SECRETS:-}" ]]; then
  echo "::error::Missing secret GH_PAT_SECRETS. Branch protection needs a PAT with repo Administration:write (see HUMAN_TASKS.md H0.1-A). The default GITHUB_TOKEN cannot be used: GitHub Actions never grants the 'administration' permission to it, so this is not fixable via the workflow 'permissions:' block."
  exit 1
fi

auth=(-H "Authorization: Bearer ${GH_PAT_SECRETS}" -H "Accept: application/vnd.github+json" -H "X-GitHub-Api-Version: 2022-11-28")

# ── 1. GET current protection (404 = branch currently unprotected) ───────────
current_file="$(mktemp)"; trap 'rm -f "${current_file}"' EXIT
http_code=$(curl -sS -o "${current_file}" -w '%{http_code}' "${auth[@]}" "${API}") || {
  echo "::error::Network failure talking to GitHub API"; exit 1; }

case "${http_code}" in
  200) has_protection=true ;;
  404) has_protection=false; echo '{}' > "${current_file}" ;;
  403) echo "::error::GH_PAT_SECRETS was rejected (403) for ${API} — the PAT lacks Administration:write on ${REPO} (org-owned repos may also require org approval of the PAT)."; cat "${current_file}"; exit 1 ;;
  *)   echo "::error::Unexpected HTTP ${http_code} from GET ${API}"; cat "${current_file}"; exit 1 ;;
esac

# ── 2. Compare against policy ────────────────────────────────────────────────
# Policy: >=1 approving review, dismiss stale reviews, required status check
# `ci` (the only job in .github/workflows/ci.yml), no force pushes/deletions.
# Contexts are REPLACED with ["ci"]: keeping stale contexts (e.g. checks that
# no longer run) would deadlock every PR.
read -r ok reviews dismiss contexts force del <<< "$(jq -r '
  [
    (((.required_pull_request_reviews.required_approving_review_count // 0) >= 1)
     and (.required_pull_request_reviews.dismiss_stale_reviews // false)
     and ((.required_status_checks.contexts // []) == ["ci"])
     and ((.allow_force_pushes.enabled // false) | not)
     and ((.allow_deletions.enabled // false) | not)),
    (.required_pull_request_reviews.required_approving_review_count // 0),
    (.required_pull_request_reviews.dismiss_stale_reviews // false),
    ((.required_status_checks.contexts // []) | join("+") | if . == "" then "none" else . end),
    (.allow_force_pushes.enabled // false),
    (.allow_deletions.enabled // false)
  ] | @tsv' "${current_file}")"

echo "Current protection on ${REPO}@main (protected=${has_protection}):"
printf '  %-28s current=%-8s desired=%s\n' \
  "approving reviews"        "${reviews}"   ">=1" \
  "dismiss stale reviews"    "${dismiss}"   "true" \
  "required status contexts" "${contexts}"  "ci" \
  "allow force pushes"       "${force}"     "false" \
  "allow deletions"          "${del}"       "false"

if [[ "${ok}" == "true" ]]; then
  echo "OK: branch protection already satisfies the launch policy — nothing to do."
  exit 0
fi

# ── 3. Build merged payload (preserve unrelated existing settings) ───────────
payload=$(jq '
  {
    required_status_checks: {
      # preserve an existing strict choice; default strict=true (branch must be
      # up to date) when protection is created fresh
      strict: (.required_status_checks.strict // true),
      checks: [{context: "ci"}]
    },
    enforce_admins: (.enforce_admins.enabled // false),
    required_pull_request_reviews: {
      dismiss_stale_reviews: true,
      # never DOWNGRADE a stricter review count
      required_approving_review_count: ([(.required_pull_request_reviews.required_approving_review_count // 0), 1] | max),
      require_code_owner_reviews: (.required_pull_request_reviews.require_code_owner_reviews // false)
    },
    restrictions: (if .restrictions then
      {users: [.restrictions.users[]?.login], teams: [.restrictions.teams[]?.slug], apps: [.restrictions.apps[]?.slug]}
      else null end),
    required_linear_history: (.required_linear_history.enabled // false),
    allow_force_pushes: false,
    allow_deletions: false,
    required_conversation_resolution: (.required_conversation_resolution.enabled // false),
    lock_branch: (.lock_branch.enabled // false)
  }' "${current_file}")

if [[ "${DRY_RUN}" == "true" ]]; then
  echo "DRY RUN — would PUT this protection object (no secrets inside):"
  echo "${payload}" | jq .
  exit 0
fi

if ! body=$(printf '%s' "${payload}" | curl -sS --fail-with-body -X PUT "${auth[@]}" \
      -H "Content-Type: application/json" --data-binary @- "${API}"); then
  echo "::error::PUT ${API} failed — response follows (no secrets inside)."
  printf '%s\n' "${body}"
  exit 1
fi
echo "Branch protection updated:"
printf '%s\n' "${body}" | jq '{contexts: .required_status_checks.contexts, reviews: .required_pull_request_reviews.required_approving_review_count, dismiss_stale: .required_pull_request_reviews.dismiss_stale_reviews, force_pushes: .allow_force_pushes.enabled, deletions: .allow_deletions.enabled}'
