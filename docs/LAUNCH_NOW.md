> # ⛔ SUPERSEDED (2026-08-14) — DO NOT EXECUTE
>
> This **Cloud Run** launch sequence is not the launch path — `docs/adr/ADR-001-canonical-platform.md` made **Vercel** canonical (2026-07-18).
> **The only live launch authorities are [`docs/NEXT_GO.md`](./NEXT_GO.md) and
> [`docs/launch/PROGRAMME_END_TO_END.md`](./launch/PROGRAMME_END_TO_END.md).** Where this file
> conflicts with them, they win. This file is retained as history only and is no longer maintained.

---

# LAUNCH NOW — Operator Checklist

Single-page launch sequence. **Account:** `renee@mangu-publishers.com` · **Project:** `delta-wonder-488420-i3` · **Domain:** `mangu-publishers.com` · **Webhook:** `/api/webhook` (not `/api/stripe/webhook`)

**Detail:** [PHASE4_OPERATOR_RUNBOOK.md](./PHASE4_OPERATOR_RUNBOOK.md) · **Status tracker:** [deployment_status.md](./reports/deployment/deployment_status.md) · **Canonical:** [CANONICAL_PRODUCTION.md](./CANONICAL_PRODUCTION.md)

---

```bash
# 0. Local preflight (agent may have run; optional re-check)
bash scripts/pre-launch-verify.sh

# 1. Environment
cp .env.local.example .env.local
npm run validate-env

# 2. GCP auth (interactive — choose renee@mangu-publishers.com)
gcloud auth login
gcloud auth application-default login
gcloud config set account renee@mangu-publishers.com
gcloud config set project delta-wonder-488420-i3
gcloud config set run/region us-central1

# 3. Secrets + IAM + deploy
./scripts/sync-gcp-secrets-from-env.sh
./scripts/grant-cloudrun-secret-access.sh
./scripts/gcloud-build-submit.sh

# 4. Post-deploy verify
./scripts/verify-gcp-production.sh
curl -sS https://mangu-publishers.com/api/live
curl -sS "https://mangu-publishers.com/api/health?ready=1"
curl -sS -o /dev/null -w "%{http_code}\n" https://mangu-publishers.com/homepage/v_a_1.html
```

**Stripe webhook:** Dashboard → Developers → Webhooks → `https://mangu-publishers.com/api/webhook` → events `checkout.session.completed` → copy `whsec_...` into `.env.local` as `STRIPE_WEBHOOK_SECRET` → `./scripts/sync-gcp-secrets-from-env.sh` → `./scripts/gcloud-build-submit.sh`

**DNS cutover:** `www.mangu-publishers.com` currently serves via **Vercel**. Point apex/www to Cloud Run only after step 4 passes (see PHASE4_OPERATOR_RUNBOOK §7). Use DNS-only in Cloudflare during cutover.

**Optional services (Sentry, Resend, OpenAI):** See [OPTIONAL_SERVICES_SETUP.md](./OPTIONAL_SERVICES_SETUP.md). Sentry DSN goes in `.env.local` as `NEXT_PUBLIC_SENTRY_DSN` and is passed automatically by `./scripts/gcloud-build-submit.sh`.
