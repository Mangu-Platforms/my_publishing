#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${ROOT}/.env.local"
# A5 SWEEP 2026-07-30: MUST be the canonical www host. The apex
# (https://mangu-publishers.com) 308-redirects to www, and Stripe does NOT
# follow redirects for webhook deliveries — an apex-registered endpoint fails
# on every event. Do not change this back to the apex.
URL="https://www.mangu-publishers.com/api/webhook"

echo "Creating live Stripe webhook for $URL..."

# Extract Stripe Secret Key from env
STRIPE_SK=$(grep '^STRIPE_SECRET_KEY=' "${ENV_FILE}" | cut -d '=' -f2)

# Create the webhook and capture JSON output
OUTPUT=$(stripe webhook_endpoints create \
  --api-key "$STRIPE_SK" \
  --url "$URL" \
  --enabled-events checkout.session.completed \
  --enabled-events checkout.session.expired \
  --enabled-events charge.refunded \
  --enabled-events payment_intent.payment_failed 2>&1)

# Extract the secret using grep/sed
# Stripe CLI outputs JSON-like format
SECRET=$(echo "$OUTPUT" | grep '"secret":' | head -1 | sed -E 's/.*"secret": *"([^"]+)".*/\1/')

if [[ -z "$SECRET" || ! "$SECRET" =~ ^whsec_ ]]; then
  echo "ERROR: Failed to extract webhook secret from output:"
  echo "$OUTPUT"
  exit 1
fi

echo "Webhook created successfully! Secret starts with: ${SECRET:0:10}..."

# Update .env.local
cp "${ENV_FILE}" "${ENV_FILE}.bak2"
if grep -q '^STRIPE_WEBHOOK_SECRET=' "${ENV_FILE}"; then
  sed -i.bak "s|^STRIPE_WEBHOOK_SECRET=.*|STRIPE_WEBHOOK_SECRET=${SECRET}|" "${ENV_FILE}"
else
  echo "STRIPE_WEBHOOK_SECRET=${SECRET}" >> "${ENV_FILE}"
fi

echo "Updated .env.local"
echo "Done. Update STRIPE_WEBHOOK_SECRET in your Vercel project environment variables before the next deploy."
