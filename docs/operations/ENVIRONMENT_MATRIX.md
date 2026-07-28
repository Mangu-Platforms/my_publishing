# Environment Variable Matrix — MANGU Publishers

> **VARIABLE NAMES ONLY.** This file must never contain a value, a fragment of
> a value, a project ref, a connection string or a key prefix beyond the format
> hints already published in `.env.local.example`. If you are tempted to paste
> a value here to make something clearer, don't.

**Canonical store:** Vercel Project → Settings → Environment Variables
(ADR-001). The legacy Cloud Run path mounts the same names from GCP Secret
Manager — see `docs/SECRET_INVENTORY.md`.

**Verified against:** `.env.example`, `.env.local.example`,
`.env.production.example`, `scripts/validate-env.ts`,
`lib/utils/env-validation.ts`, and every `process.env.*` reference in
`app/`, `lib/`, `components/`, `scripts/`, `middleware.ts`, `instrumentation.ts`
and the Sentry config files, as of **2026-07-28**.

Legend — **Required**: ✅ required · ⚠️ optional (feature degrades if absent) ·
🚫 must be ABSENT · — not applicable.
**Class**: `public` = shipped to the browser (`NEXT_PUBLIC_*`, never a secret) ·
`secret` = server-only · `config` = non-sensitive server setting.

---

## 1. Requirement matrix

| Variable | Purpose | Local | Preview | Production | Class | Owner |
| --- | --- | --- | --- | --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Canonical origin for canonical tags, sitemap, robots, OG URLs and auth redirects | ✅ | ✅ | ✅ | public | Renee |
| `VERCEL_URL` | Vercel-injected deployment host; **fallback only** in `lib/seo/siteUrl.ts` | — | auto | auto | config | Vercel (injected) |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL; the project ref is derived from it at runtime | ✅ | ✅ | ✅ | public | Renee |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser/anon Supabase key | ✅ | ✅ | ✅ | public | Renee |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side Supabase admin access (public catalog reads, admin ops) | ✅ | ✅ | ✅ | secret | Renee |
| `DATABASE_PROVIDER` | Catalog read provider switch (`mongodb` \| `supabase`) — production is `mongodb` | ✅ | ✅ | ✅ | config | Engineering |
| `AUTH_PROVIDER` | Auth provider switch (`supabase` \| `better-auth`) — production is `supabase` | ✅ | ✅ | ✅ | config | Engineering |
| `MONGODB_URI` | MongoDB Atlas connection string (catalog data plane) | ✅ | ✅ | ✅ | secret | Renee |
| `MONGODB_DB` | Atlas database name (defaults to `mangu` when unset) | ⚠️ | ⚠️ | ✅ | config | Engineering |
| `UPSTASH_REDIS_REST_URL` | Distributed rate-limit store endpoint | ⚠️ | ✅ | ✅ | config | Renee |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash REST auth token | ⚠️ | ✅ | ✅ | secret | Renee |
| `STRIPE_SECRET_KEY` | Server-side Stripe API access | ✅ | ✅ | ✅ | secret | Renee |
| `STRIPE_WEBHOOK_SECRET` | Signature verification for `/api/webhook` | ✅ | ✅ | ✅ | secret | Renee |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe.js in the browser | ✅ | ✅ | ✅ | public | Renee |
| `RESEND_API_KEY` | Transactional email delivery | ⚠️ | ⚠️ | ⚠️ | secret | Renee |
| `RESEND_AUDIENCE_ID` | Resend audience for list email | ⚠️ | ⚠️ | ⚠️ | config | Renee |
| `CONTACT_INBOX_EMAIL` | Destination for contact-form submissions | ⚠️ | ⚠️ | ⚠️ | config | Renee |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob storage read/write token (covers, manuscripts) | ⚠️ | ✅ | ✅ | secret | Renee |
| `STORAGE_PROVIDER` | Storage backend switch (Vercel Blob vs Supabase Storage) | ⚠️ | ⚠️ | ⚠️ | config | Engineering |
| `SENTRY_DSN` | Server-side error reporting endpoint | ⚠️ | ⚠️ | ⚠️ | config | Engineering |
| `NEXT_PUBLIC_SENTRY_DSN` | Browser error reporting endpoint (same DSN value, public by design) | ⚠️ | ⚠️ | ⚠️ | public | Engineering |
| `SENTRY_ORG` | Sentry org slug (source-map upload) | ⚠️ | ⚠️ | ⚠️ | config | Engineering |
| `SENTRY_PROJECT` | Sentry project slug (source-map upload) | ⚠️ | ⚠️ | ⚠️ | config | Engineering |
| `SENTRY_AUTH_TOKEN` | Source-map upload credential (CI only) | — | ⚠️ | ⚠️ | secret | Engineering |
| `SENTRY_RELEASE` | Release tag; CI sets it to the commit SHA | — | ⚠️ | ⚠️ | config | CI |
| `SENTRY_ENVIRONMENT` | Sentry environment label | ⚠️ | ⚠️ | ⚠️ | config | Engineering |
| `BETTER_AUTH_SECRET` | Better Auth signing secret (dual-run; unused while `AUTH_PROVIDER=supabase`) | ⚠️ | ⚠️ | ⚠️ | secret | Engineering |
| `BETTER_AUTH_URL` | Better Auth base URL; must equal `NEXT_PUBLIC_SITE_URL` | ⚠️ | ⚠️ | ⚠️ | config | Engineering |
| `OPENAI_API_KEY` | AI recommendations (Resonance Engine) | ⚠️ | ⚠️ | ⚠️ | secret | Renee |
| `MCP_ENABLED` | Public MCP transport master switch; absent ⇒ `/api/mcp/*` returns 404 | ⚠️ | ⚠️ | ⚠️ | config | Engineering |
| `MCP_API_KEY` | Bearer credential for the MCP transport; `MCP_ENABLED` without it fails closed | ⚠️ | ⚠️ | ⚠️ | secret | Engineering |
| `FEATURE_COMICS` / `FEATURE_PAPERS` / `FEATURE_AUDIO` / `FEATURE_REVIEWS` / `FEATURE_BOOK_CLUBS` / `FEATURE_WISHLIST` / `FEATURE_FOLLOWS` | Feature flags, default OFF (`lib/flags.ts`) | ⚠️ | ⚠️ | ⚠️ | config | Engineering |
| `NEXT_PUBLIC_FEATURE_FRIENDLY_429` | Friendly rate-limit UX flag (E-003) | ⚠️ | ⚠️ | ⚠️ | public | Engineering |
| `NEXT_PUBLIC_APP_VERSION` | Version string surfaced in the UI/diagnostics | ⚠️ | ⚠️ | ⚠️ | public | Engineering |
| **`USE_MOCKS`** | Dev-only mock mode — bypasses external services | ⚠️ | ⚠️ | **🚫 ABSENT** | config | Engineering |
| **`SKIP_EMAILS`** | Dev-only email suppression | ⚠️ | ⚠️ | **🚫 ABSENT** | config | Engineering |

### `USE_MOCKS` and `SKIP_EMAILS` must be proven ABSENT in production

Both variables **must not exist at all** in the Vercel Production environment —
not `false`, not empty. Absent.

- `USE_MOCKS=true` in production would serve fabricated catalog and payment
  behaviour to real customers.
- `SKIP_EMAILS=true` in production would silently drop password-reset and
  receipt emails with no error anywhere.

The enforcement already exists and fails closed:
`scripts/validate-env.ts` → `validateProductionShape()` raises an **error**
(exit 1) for `=true` and a **warning** for any other value, with the message
*"must be ABSENT in production"*. CI sets `USE_MOCKS: 'true'` deliberately for
the `next build` prerender step only — that is the CI runner, never production.

**Proof procedure** (Renee — see §4):

```bash
# Names only. This prints variable NAMES, never values.
vercel env ls production | grep -E 'USE_MOCKS|SKIP_EMAILS'   # expect: no output
npm run validate-env:production                              # expect: exit 0
```

**Current status: NOT YET PROVEN.** No agent can read the Vercel environment.
Renee must run the command above and record the result in
`docs/OPERATOR_QA_LOG.md`.

### Analytics IDs

There is **no analytics ID variable consumed anywhere in this codebase.**
`NEXT_PUBLIC_VERCEL_ANALYTICS_ID` appears only as a commented placeholder in
`.env.local.example`; no code reads it, and Vercel Analytics does not require
it. The only telemetry configuration in use is the Sentry group above. Do not
add an analytics variable to production until code actually reads it.

---

## 2. Source, validation and rotation

| Variable | Source dashboard | Validation method | Rotation procedure |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Vercel → Settings → Environment Variables | `validate-env:production` requires `https://`; `npm run seo:check` fails if canonical/sitemap origins disagree | Edit in Vercel (Production + Preview) → redeploy → re-run `npm run seo:check` |
| `VERCEL_URL` | Injected by Vercel; not settable | `tests/unit/siteUrl.test.ts` pins the fallback order | n/a — never set by hand |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API | `validate-env:production` requires `https://*.supabase.co`; `npm run health:check` probes `/auth/v1/health` | Changes only when the project ref changes → `rotate-supabase-key.yml` (pass `supabase_project_ref`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API | `validate-env:production` length check; health check auth probe | GitHub Actions → **Rotate Supabase Anon Key** (updates GitHub Secrets + both Vercel projects) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API | `validate-env:production` length check | **MANUAL — not automated.** See the warning in §3 |
| `DATABASE_PROVIDER` | Vercel | `tests/unit/db-provider.test.ts`; `/api/health?ready=1` gates on Mongo when `mongodb` | Change + redeploy; verify `checks.mongodb` before and after |
| `AUTH_PROVIDER` | Vercel | `tests/unit/auth-provider.test.ts` | Cutover-only change; requires the forced-reset plan |
| `MONGODB_URI` | MongoDB Atlas → Database → Connect | `assertMongoUri` rejects placeholders; `npm run db:mongo:ping` | Atlas → Database Access → edit user password → update Vercel → `npm run db:mongo:sync-vercel` → redeploy |
| `MONGODB_DB` | Atlas | `validate-env:production` optional-format warning | Edit in Vercel → redeploy |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` | Upstash Console → Redis → REST API | `validate-env:production` format checks; `/api/health?ready=1` | Upstash → rotate REST token → update Vercel → redeploy |
| `STRIPE_SECRET_KEY` | Stripe → Developers → API keys | `validate-env:production` requires `sk_` and live/test mode consistency | Stripe → roll key → update Vercel → redeploy → verify a test charge |
| `STRIPE_WEBHOOK_SECRET` | Stripe → Developers → Webhooks → endpoint → Signing secret | `validate-env:production` requires `whsec_` | Stripe → roll signing secret → update Vercel → redeploy → **Resend** a failed event |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe → Developers → API keys | `validate-env:production` requires `pk_` and matching mode | Rotate together with `STRIPE_SECRET_KEY` |
| `RESEND_API_KEY` | Resend → API Keys | `validate-env:production` warns unless `re_` | Resend → create new key → update Vercel → delete old key |
| `RESEND_AUDIENCE_ID` / `CONTACT_INBOX_EMAIL` | Resend → Audiences / Renee | none automated | Edit in Vercel → redeploy |
| `BLOB_READ_WRITE_TOKEN` | Vercel → Storage → Blob | none automated — a 401 on upload is the signal | Vercel → Blob → regenerate token → update env → redeploy |
| `STORAGE_PROVIDER` | Vercel | none automated | Edit + redeploy |
| `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` | Sentry → Settings → Client Keys (DSN) | Absence degrades silently — confirm events land in Sentry after change | Sentry → new client key → update both names → redeploy |
| `SENTRY_AUTH_TOKEN` | Sentry → Settings → Auth Tokens | CI source-map upload step | Sentry → revoke + reissue → update GitHub Secrets |
| `SENTRY_ORG` / `SENTRY_PROJECT` / `SENTRY_ENVIRONMENT` / `SENTRY_RELEASE` | Sentry / CI | build logs | n/a (not secrets) |
| `BETTER_AUTH_SECRET` | Generated locally (`openssl rand -base64 32`) | unused while `AUTH_PROVIDER=supabase` | Regenerate → update Vercel → invalidates Better Auth sessions |
| `BETTER_AUTH_URL` | Vercel | must equal `NEXT_PUBLIC_SITE_URL` | Edit + redeploy |
| `OPENAI_API_KEY` | OpenAI → API keys | `validate-env:production` warns unless `sk-` | OpenAI → revoke + reissue → update Vercel |
| `MCP_ENABLED` / `MCP_API_KEY` | Vercel | `tests/unit/mcp-transport-security.test.ts` — fails closed to 404 | `openssl rand -hex 32` → update Vercel → redeploy |
| `FEATURE_*`, `NEXT_PUBLIC_FEATURE_*` | Vercel | `lib/flags.ts`; flag-off contract tests | Edit + redeploy |
| `USE_MOCKS`, `SKIP_EMAILS` | Vercel (must not be present) | `validate-env:production` fails closed | n/a — **delete**, never rotate |

---

## 3. ⚠️ Known gap — the service-role key is not rotated by automation

`.github/workflows/rotate-supabase-key.yml` rotates the **anon** key only.

If an operator follows the workflow summary and disables *all* legacy JWT keys
in the Supabase dashboard, the legacy **`service_role`** JWT is disabled too —
and nothing re-provisions it. Server-side catalog reads, admin operations and
`/api/health` would all start failing while the anon key looks perfectly fine.

**Rotating `SUPABASE_SERVICE_ROLE_KEY` is a manual, human-gated procedure:**

1. Supabase → Project Settings → API → copy the **new** `service_role` key.
2. Vercel → each project → Settings → Environment Variables → update
   `SUPABASE_SERVICE_ROLE_KEY` for **Production and Preview**.
3. Redeploy both projects.
4. Verify **before** disabling the old key:
   ```bash
   curl -fsS "https://www.mangu-publishers.com/api/health?ready=1" | jq '.ready'
   npm run health:check
   ```
5. Only once step 4 is green, disable the old key in Supabase.

Never place a service-role key in the repo, in a workflow input, in a PR
description, or in this file.

---

## 4. Human actions required (Renee)

| # | Action | Expected result |
| --- | --- | --- |
| 1 | Run `vercel env ls production` and confirm `USE_MOCKS` and `SKIP_EMAILS` do not appear | No output for either name; record in `docs/OPERATOR_QA_LOG.md` |
| 2 | Run `npm run validate-env:production` against the real production env | Exit 0, no errors |
| 3 | Fill in every _TBD_ in `INCIDENT_RESPONSE.md` §2 (alert recipients) | No placeholders remain |
| 4 | Confirm `NEXT_PUBLIC_SITE_URL` is set in Vercel Production | Set to the canonical `https://www.mangu-publishers.com`, so `lib/seo/siteUrl.ts` never falls back to `VERCEL_URL` |
| 5 | Confirm the Supabase project referenced by `NEXT_PUBLIC_SUPABASE_URL` is ACTIVE and **off the free tier** | Project active; auto-pause no longer possible |
| 6 | Set the "Last verified" date below after completing 1–5 | Date recorded |

---

## 5. Last verified

| Scope | Verified by | Date | Notes |
| --- | --- | --- | --- |
| Variable **names**, requirement levels, and validation methods | Repo audit against `.env*.example`, `scripts/validate-env.ts`, `lib/utils/env-validation.ts` and all `process.env.*` references | 2026-07-28 | Complete |
| Actual **presence/absence** in Vercel Production | _NOT VERIFIED_ | — | Requires Renee (§4). No agent can read the Vercel environment |
| `USE_MOCKS` / `SKIP_EMAILS` absent in production | _NOT VERIFIED_ | — | Requires Renee (§4 item 1) |
