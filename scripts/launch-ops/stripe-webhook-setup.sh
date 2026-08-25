#!/usr/bin/env bash
# launch-ops: ensure the production Stripe webhook exists and its signing
# secret is stored in Vercel (STRIPE_WEBHOOK_SECRET, target: production).
#
# Required env : STRIPE_SECRET_KEY
#                VERCEL_TOKEN, VERCEL_PROJECT_MY_PUBLISHING (only when a NEW
#                webhook gets created — that is the only time Stripe reveals
#                the whsec_ signing secret, so only then is there a push)
# Optional env : VERCEL_TEAM_ID, DRY_RUN (default true), REDEPLOY (default false)
#
# Behaviour (idempotent):
#   exactly 1 enabled endpoint for the www URL with the 4 required events → OK
#   0 endpoints  → create one, then push whsec_ to Vercel production
#   1 endpoint, wrong events → update events IN PLACE. We deliberately do NOT
#       create a second endpoint for the same URL: Stripe would deliver every
#       event twice. Updating keeps the existing signing secret valid.
#   >1 endpoints → fail loudly; pruning duplicates is destructive, human decides.
#
# Creation prefers the existing scripts/create-stripe-webhook.sh (single source
# of truth for the endpoint definition; it already targets the canonical www
# host because Stripe won't follow the apex 308 redirect). That script needs
# the `stripe` CLI + a .env.local, so on bare CI runners we fall back to the
# same call via Stripe's REST API.
set -euo pipefail

WEBHOOK_URL="https://www.mangu-publishers.com/api/webhook"
REQUIRED_EVENTS='["charge.refunded","checkout.session.completed","checkout.session.expired","payment_intent.payment_failed"]'
DRY_RUN="${DRY_RUN:-true}"
REDEPLOY="${REDEPLOY:-false}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

# ::add-mask:: is consumed by the Actions runner (the value is registered as a
# secret and never written to the log). Outside Actions an echo WOULD leak, so
# the guard makes mask() a no-op there.
mask() { [[ -n "${GITHUB_ACTIONS:-}" ]] && echo "::add-mask::$1" || true; }

if [[ -z "${STRIPE_SECRET_KEY:-}" ]]; then
  echo "::error::Missing secret STRIPE_SECRET_KEY (sk_live_… — Stripe dashboard → Developers → API keys)."
  exit 1
fi

stripe_get() { curl -sS --fail-with-body -u "${STRIPE_SECRET_KEY}:" "$1"; }

# ── 1. Inventory existing endpoints for the canonical URL ────────────────────
if ! endpoints=$(stripe_get "https://api.stripe.com/v1/webhook_endpoints?limit=100"); then
  echo "::error::Stripe API rejected the webhook_endpoints list — is STRIPE_SECRET_KEY valid and live-mode?"
  printf '%s\n' "${endpoints}" | jq -r '.error.message? // .' 2>/dev/null || true
  exit 1
fi

matches=$(jq --arg url "${WEBHOOK_URL}" \
  '[.data[] | select(.url == $url and .status == "enabled")]' <<<"${endpoints}")
count=$(jq 'length' <<<"${matches}")
echo "Enabled Stripe endpoints for ${WEBHOOK_URL}: ${count}"

if (( count == 1 )); then
  events_ok=$(jq --argjson want "${REQUIRED_EVENTS}" \
    '(.[0].enabled_events | sort) == ($want | sort)' <<<"${matches}")
  ep_id=$(jq -r '.[0].id' <<<"${matches}")
  if [[ "${events_ok}" == "true" ]]; then
    echo "OK: ${ep_id} already listens for exactly the 4 required events."
    echo "Note: Stripe only reveals whsec_ at creation, so nothing to push to Vercel."
    echo "Run action 'vercel-env-audit' to confirm STRIPE_WEBHOOK_SECRET is set in production."
    exit 0
  fi
  echo "Endpoint ${ep_id} exists but its events drifted:"
  jq -r '.[0].enabled_events | sort | "  current: " + join(", ")' <<<"${matches}"
  jq -r 'sort | "  wanted : " + join(", ")' <<<"${REQUIRED_EVENTS}"
  if [[ "${DRY_RUN}" == "true" ]]; then
    echo "DRY RUN — would update ${ep_id} in place (signing secret unchanged)."
    exit 0
  fi
  if ! body=$(curl -sS --fail-with-body -u "${STRIPE_SECRET_KEY}:" \
        -X POST "https://api.stripe.com/v1/webhook_endpoints/${ep_id}" \
        -d "enabled_events[]=checkout.session.completed" \
        -d "enabled_events[]=checkout.session.expired" \
        -d "enabled_events[]=charge.refunded" \
        -d "enabled_events[]=payment_intent.payment_failed"); then
    echo "::error::Failed to update events on ${ep_id}"
    printf '%s\n' "${body}" | jq -r '.error.message? // .' 2>/dev/null || true
    exit 1
  fi
  echo "Events updated on ${ep_id}; existing signing secret stays valid — no Vercel change needed."
  exit 0
fi

if (( count > 1 )); then
  echo "::error::${count} enabled endpoints target ${WEBHOOK_URL} — every event is delivered ${count}x. Deleting is destructive, so decide manually which to keep: https://dashboard.stripe.com/webhooks"
  jq -r '.[] | "  " + .id + "  created " + (.created | todate)' <<<"${matches}"
  exit 1
fi

# ── 2. No endpoint → create one ──────────────────────────────────────────────
if [[ "${DRY_RUN}" == "true" ]]; then
  echo "DRY RUN — would create webhook for ${WEBHOOK_URL} (4 events) and push whsec_ to Vercel production."
  exit 0
fi

SECRET=""
if command -v stripe >/dev/null 2>&1; then
  # Reuse the canonical script. Its interface: reads STRIPE_SECRET_KEY from
  # <root>/.env.local, calls the stripe CLI, writes STRIPE_WEBHOOK_SECRET back
  # into that file. Materialise a throwaway .env.local only if none exists.
  created_env=false
  if [[ ! -f "${ROOT}/.env.local" ]]; then
    ( umask 077 && printf 'STRIPE_SECRET_KEY=%s\n' "${STRIPE_SECRET_KEY}" > "${ROOT}/.env.local" )
    created_env=true
  fi
  bash "${ROOT}/scripts/create-stripe-webhook.sh"
  SECRET=$(grep '^STRIPE_WEBHOOK_SECRET=' "${ROOT}/.env.local" | tail -1 | cut -d '=' -f2-)
  mask "${SECRET}"
  if [[ "${created_env}" == "true" ]]; then
    rm -f "${ROOT}/.env.local" "${ROOT}/.env.local.bak" "${ROOT}/.env.local.bak2"
  fi
else
  echo "stripe CLI not installed (normal on CI runners) — creating via REST API instead."
  if ! created=$(curl -sS --fail-with-body -u "${STRIPE_SECRET_KEY}:" \
        -X POST "https://api.stripe.com/v1/webhook_endpoints" \
        -d "url=${WEBHOOK_URL}" \
        -d "enabled_events[]=checkout.session.completed" \
        -d "enabled_events[]=checkout.session.expired" \
        -d "enabled_events[]=charge.refunded" \
        -d "enabled_events[]=payment_intent.payment_failed" \
        -d "description=Created by launch-ops workflow"); then
    echo "::error::Stripe webhook creation failed"
    printf '%s\n' "${created}" | jq -r '.error.message? // .' 2>/dev/null || true
    exit 1
  fi
  SECRET=$(jq -r '.secret' <<<"${created}")
  mask "${SECRET}"
  echo "Created endpoint $(jq -r '.id' <<<"${created}")"
fi

if [[ ! "${SECRET}" =~ ^whsec_ ]]; then
  echo "::error::Webhook created but no whsec_ secret captured — fetch it from https://dashboard.stripe.com/webhooks and set STRIPE_WEBHOOK_SECRET in Vercel manually."
  exit 1
fi
echo "Webhook created; signing secret captured (masked)."

# ── 3. Push whsec_ to Vercel production env ──────────────────────────────────
missing=()
[[ -z "${VERCEL_TOKEN:-}" ]] && missing+=(VERCEL_TOKEN)
[[ -z "${VERCEL_PROJECT_MY_PUBLISHING:-}" ]] && missing+=(VERCEL_PROJECT_MY_PUBLISHING)
if (( ${#missing[@]} > 0 )); then
  echo "::error::Webhook exists in Stripe but the signing secret could NOT be pushed — missing secret(s): ${missing[*]}. Set STRIPE_WEBHOOK_SECRET in Vercel production manually (value is in this run's masked output only — recreate via dashboard if lost)."
  exit 1
fi
PROJECT_ID="${VERCEL_PROJECT_MY_PUBLISHING}"
TEAM_PARAM=""
[[ -n "${VERCEL_TEAM_ID:-}" ]] && TEAM_PARAM="?teamId=${VERCEL_TEAM_ID}"

# Same delete-then-create upsert as rotate-supabase-key.yml (v9 list/delete,
# v10 create) — Vercel has no true upsert for encrypted envs. Production only.
EXISTING_ID=$(curl -sS --fail-with-body -H "Authorization: Bearer ${VERCEL_TOKEN}" \
  "https://api.vercel.com/v9/projects/${PROJECT_ID}/env${TEAM_PARAM}" \
  | jq -r '.envs[] | select(.key=="STRIPE_WEBHOOK_SECRET" and ((.target | if type=="array" then . else [.] end) | index("production"))) | .id' \
  | head -1)
if [[ -n "${EXISTING_ID}" ]]; then
  curl -sS --fail-with-body -X DELETE -H "Authorization: Bearer ${VERCEL_TOKEN}" \
    "https://api.vercel.com/v9/projects/${PROJECT_ID}/env/${EXISTING_ID}${TEAM_PARAM}" > /dev/null
fi
if ! pushed=$(jq -n --arg v "${SECRET}" \
      '{key:"STRIPE_WEBHOOK_SECRET", value:$v, type:"encrypted", target:["production"]}' \
      | curl -sS --fail-with-body -X POST -H "Authorization: Bearer ${VERCEL_TOKEN}" \
        -H "Content-Type: application/json" --data-binary @- \
        "https://api.vercel.com/v10/projects/${PROJECT_ID}/env${TEAM_PARAM}"); then
  echo "::error::Vercel env push failed — set STRIPE_WEBHOOK_SECRET (production) manually."
  exit 1
fi
echo "Vercel env updated: $(jq -r '.key + " → " + ((.target | if type=="array" then . else [.] end) | join(","))' <<<"${pushed}")"

# ── 4. Redeploy (env changes only apply to NEW deployments) ──────────────────
if [[ "${REDEPLOY}" != "true" ]]; then
  echo "::warning::STRIPE_WEBHOOK_SECRET changed in Vercel but env vars only take effect on the NEXT deployment. Re-run with redeploy=true, or redeploy from the Vercel dashboard."
  exit 0
fi
list_url="https://api.vercel.com/v6/deployments?projectId=${PROJECT_ID}&target=production&limit=1&state=READY"
redeploy_url="https://api.vercel.com/v13/deployments?forceNew=1"
if [[ -n "${VERCEL_TEAM_ID:-}" ]]; then
  list_url+="&teamId=${VERCEL_TEAM_ID}"
  redeploy_url+="&teamId=${VERCEL_TEAM_ID}"
fi
if ! latest=$(curl -sS --fail-with-body -H "Authorization: Bearer ${VERCEL_TOKEN}" "${list_url}"); then
  echo "::warning::Could not list production deployments — redeploy manually from the Vercel dashboard."
  exit 0
fi
dep_uid=$(jq -r '.deployments[0].uid // empty' <<<"${latest}")
dep_name=$(jq -r '.deployments[0].name // empty' <<<"${latest}")
if [[ -z "${dep_uid}" || -z "${dep_name}" ]]; then
  echo "::warning::No READY production deployment found to redeploy — redeploy manually from the Vercel dashboard."
  exit 0
fi
if redeploy_resp=$(jq -n --arg id "${dep_uid}" --arg name "${dep_name}" \
      '{deploymentId:$id, name:$name, target:"production"}' \
      | curl -sS --fail-with-body -X POST -H "Authorization: Bearer ${VERCEL_TOKEN}" \
        -H "Content-Type: application/json" --data-binary @- "${redeploy_url}"); then
  echo "Redeploy triggered: $(jq -r '.id // .url // "accepted"' <<<"${redeploy_resp}")"
else
  echo "::warning::Redeploy API call failed — trigger it manually from the Vercel dashboard."
fi
