# Incident Response — MANGU Publishers

**Scope:** production incidents affecting `https://www.mangu-publishers.com`.
**Owner:** Renee (business owner + public communication owner).
**Companion docs:** [`ENVIRONMENT_MATRIX.md`](./ENVIRONMENT_MATRIX.md) ·
`docs/ROLLBACK.md` · `.claude/skills/mangu-ops-runbook/SKILL.md`

Production topology, for reference while triaging:

| Layer | Value |
| --- | --- |
| Hosting | Vercel |
| Canonical host | `https://www.mangu-publishers.com` |
| Catalog reads | MongoDB Atlas (`DATABASE_PROVIDER=mongodb`) |
| Auth | Supabase (`AUTH_PROVIDER=supabase`) |
| Payments | Stripe (`/api/webhook`) |
| Rate limiting | Upstash Redis |

---

## 1. Severity definitions

| Sev | Definition | Examples | Initial response | Update cadence | Who is woken |
| --- | --- | --- | --- | --- | --- |
| **Sev1** | Production unavailable, money at risk, or a suspected security/secret compromise | Site down; checkout broken; login broken for everyone; Supabase project paused/deleted; leaked key | 10 min | every 15 min | Renee + on-call engineer |
| **Sev2** | Major degradation with real user impact, workaround exists | Book pages 500 while homepage works; Stripe webhooks failing so purchases do not grant access; catalog provider down but cache still serving | 20 min | every 30 min | on-call engineer, Renee notified |
| **Sev3** | Partial or internal impact, no user-visible breakage | Elevated latency; a single admin screen broken; monitor warning without failure | 60 min | every 2 hr | on-call engineer |

**Escalate a Sev2 to Sev1** the moment any of these is true: the failure is
customer-visible on a revenue path, it has lasted more than 60 minutes, or you
cannot name the cause.

### The cache-masking rule

> A green homepage does **not** mean the site is healthy.
> Cached and ISR pages continue serving after the database is unreachable.

On 2026-07-28 the production Supabase project was paused/removed while `/books`
kept listing books from cache. **Never** close an incident on the strength of a
page that could be cached. Always confirm with an uncacheable surface:
`/api/health?ready=1`, the `/login` server render, or a direct provider probe.

---

## 2. Alert recipients

> **PLACEHOLDER — Renee to fill in.** These fields are intentionally blank
> rather than guessed. Do not invent an address or number here.

| Role | Name | Channel / address | Hours |
| --- | --- | --- | --- |
| Primary on-call | _TBD_ | _TBD_ | _TBD_ |
| Secondary / escalation | _TBD_ | _TBD_ | _TBD_ |
| Business owner (Sev1 decisions, rollback approval) | Renee | _TBD_ | _TBD_ |
| Public communication owner | Renee | _TBD_ | _TBD_ |
| Security contact (suspected key/secret exposure) | _TBD_ | _TBD_ | _TBD_ |
| Status page / customer comms channel | _TBD_ | _TBD_ | _TBD_ |

Automated sources that can raise an incident:

- `mangu-site-health-check` — scheduled daily 07:30 America/New_York.
- `npm run health:check` — the same checks, on demand (`scripts/site-health-check.ts`).
- Sentry (`NEXT_PUBLIC_SENTRY_DSN`) — unhandled exceptions.
- Vercel deployment failure notifications.
- Stripe Dashboard → Developers → Webhooks → failure notifications.

---

## 3. First-response steps (all severities)

Work top to bottom. Do not skip step 2 — it is the step that would have caught
the 2026-07 outage weeks earlier.

1. **Record the start time in UTC and America/New_York.** Every alert payload
   already carries both; copy them into the incident notes.
2. **Run the full health check — do not eyeball the homepage.**
   ```bash
   npm run health:check -- --with-checkout
   curl -fsS "https://www.mangu-publishers.com/api/health?ready=1" | jq .
   ```
   The health check reports the failed URL, HTTP status, response-time budget
   result, a redacted body excerpt, and a suggested first action.
3. **Classify severity** using the table in §1 and say the severity out loud in
   the incident channel. Anything you cannot classify is a Sev1 until disproven.
4. **Check whether a deploy caused it.** Vercel → Project → Deployments. If the
   first bad timestamp is within minutes of a deployment, go to §6 (rollback)
   before debugging further.
5. **Identify the failing layer** with §4–§7 below.
6. **Post the first update** to the customer comms channel if the incident is
   customer-visible (owner: Renee, §8).
7. **Fix or roll back.** Prefer rollback when the cause is a recent deploy.
8. **Verify the fix on an uncacheable surface**, then re-run `npm run health:check`.
9. **Schedule the post-incident review** (§9) before closing.

---

## 4. Supabase pause / deletion diagnosis

**This is the known catastrophic failure mode.** Supabase free-tier projects
auto-pause after roughly a week of inactivity, and a paused or removed project
stops resolving in DNS.

### The signature

| Where you see it | What it looks like |
| --- | --- |
| Browser | `DNS_PROBE_FINISHED_NXDOMAIN` on `https://<project-ref>.supabase.co` |
| `curl` / Node | `getaddrinfo ENOTFOUND <project-ref>.supabase.co`, or `EAI_AGAIN` |
| `dig` | `status: NXDOMAIN`, empty ANSWER section |
| `/api/health?ready=1` | `checks.auth` and `checks.database` fail with `fetch failed` / "Cannot connect to Supabase" |
| The site | Homepage and `/books` **still work** (cache/ISR), but `/login` fails and no one can sign in |
| `npm run health:check` | `DNS resolution failed (NXDOMAIN / ENOTFOUND) … This is the paused-or-deleted-project signature.` |

### Diagnosis

```bash
# 1. Which project is production actually pointed at? (name only — never echo keys)
#    Read NEXT_PUBLIC_SUPABASE_URL from Vercel → Project → Settings → Environment Variables.

# 2. Does the project hostname resolve at all?
dig +short "<project-ref>.supabase.co"          # empty output => NXDOMAIN => paused or deleted

# 3. Is the API gateway answering?
curl -s -o /dev/null -w '%{http_code}\n' "https://<project-ref>.supabase.co/auth/v1/health"
#   200 => healthy (with an apikey header)
#   401 => gateway alive, key missing/invalid — the project EXISTS
#   000 => no DNS / no connection — the project is paused or gone
```

Interpretation:

- **Empty `dig` + `000`** → the project is paused or deleted. This is the
  catastrophic case.
- **`401`** → the project exists; the problem is a key, not the project.
- **`200`** → Supabase is fine; look elsewhere (§7).

### Recovery

1. Open the Supabase dashboard for the **current** project ref (read it from
   `NEXT_PUBLIC_SUPABASE_URL`; do not rely on a ref written down anywhere).
2. If the project is **paused** → **Restore project**. Restoration typically
   takes a few minutes. Then re-run `npm run health:check`.
3. If the project is **deleted** → this is a Sev1 data-loss event. Stop, notify
   Renee, and do not create a replacement project until the restore options in
   the Supabase dashboard have been exhausted.
4. If the project ref **changed**, update `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` in Vercel
   (Production **and** Preview), then redeploy. See
   `.github/workflows/rotate-supabase-key.yml`.
5. **Prevention:** a paused free-tier project is a launch blocker. Moving the
   production Supabase project off the free tier removes this failure mode
   entirely — recommend it to Renee at the post-incident review.

---

## 5. Catalog provider failure (MongoDB primary)

Production reads the catalog from MongoDB Atlas (`DATABASE_PROVIDER=mongodb`).
When Mongo is unreachable, `/api/health?ready=1` returns **503** and
`checks.mongodb` fails — Mongo is a hard readiness gate under Mongo-primary.

```bash
curl -fsS "https://www.mangu-publishers.com/api/health?ready=1" | jq '.checks.mongodb'
npm run db:mongo:ping     # local probe against MONGODB_URI
```

Triage:

1. **Atlas cluster paused?** Atlas free/shared tiers auto-pause. Resume it.
2. **IP allowlist.** Vercel serverless egress is not fixed; the project uses
   `0.0.0.0/0` on purpose. If someone narrowed it, that is the cause.
3. **Database user / rotated password** — `MONGODB_URI` must contain a live
   credential. A placeholder `<password>` fails `assertMongoUri`.
4. **Wrong database name** — `MONGODB_DB` (defaults to `mangu`).

**Cache-masking warning:** `/books` may keep rendering from ISR cache while
Mongo is down. Confirm with `/api/health?ready=1`, never with `/books`.

**Known asymmetry (verify during triage):** `app/sitemap.ts` reads the catalog
through the Supabase public catalog client, not through the Mongo path. A
Supabase outage can therefore empty the sitemap while `/api/books` still serves
from Mongo. Treat an unexpectedly small sitemap as a Supabase symptom.

---

## 6. Vercel rollback procedure

Use rollback whenever a recent deployment correlates with the incident. Rolling
back is cheaper than debugging under pressure.

**Approval:** Renee approves any production rollback. Record the approval.

### Dashboard (preferred)

1. Vercel → Project **my_publishing** → **Deployments**.
2. Find the last deployment known good (before the first bad timestamp).
3. **⋯ → Promote to Production** (older UI: **Rollback**).
4. Wait for the promotion to report Ready.
5. Verify — an uncacheable surface, not the homepage:
   ```bash
   npm run health:check -- --with-checkout
   curl -fsS "https://www.mangu-publishers.com/api/health?ready=1" | jq '.ready'
   ```
6. Announce the rollback (§8) and open a follow-up issue for the fix-forward.

### CLI

```bash
vercel ls my_publishing                       # list deployments
vercel promote <deployment-url> --scope <team>
```

### What rollback does NOT fix

A rollback reverts **code**, never data or configuration. It will not help if
the cause is a paused Supabase project (§4), a paused Atlas cluster (§5), an
expired key, or a Stripe webhook secret mismatch (§7). Diagnose first; if the
failing layer is a provider, rollback is the wrong tool.

If an environment variable changed, revert the variable in Vercel and redeploy —
a promotion of an older build still reads the current environment.

---

## 7. Stripe webhook diagnosis

Symptom: payment succeeds in Stripe but the customer never receives access.

1. **Stripe Dashboard → Developers → Webhooks → your endpoint.** Look at recent
   deliveries and their response codes.

   | Response | Meaning | Action |
   | --- | --- | --- |
   | `400` signature failure | `STRIPE_WEBHOOK_SECRET` in Vercel does not match the endpoint's signing secret | Copy the signing secret from this endpoint into Vercel Production; redeploy |
   | `404` | Endpoint URL is wrong | Must point at `https://www.mangu-publishers.com/api/webhook` |
   | `500` | Handler threw | Vercel runtime logs + Sentry for `/api/webhook` |
   | Timeout | Handler too slow | Check the order-write path and database latency |

2. **Replay rather than guess.** Use **Resend** on a failed delivery in the
   Stripe dashboard after fixing the cause. Order creation is idempotent
   (see `tests/unit/webhook-order-idempotency.test.ts`), so replay is safe.
3. **Mode mismatch.** `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` and
   `STRIPE_SECRET_KEY` must be the same account and the same live/test mode.
   `npm run validate-env:production` fails closed on a mismatch.
4. **Never** paste a webhook secret, API key or signature into an issue, a chat
   message or this document.

Reference: `docs/STRIPE_WEBHOOK_PRODUCTION.md`, `docs/WEBHOOK_TESTING.md`.

---

## 8. Public communication

**Owner: Renee.** No one else posts customer-facing statements about an
incident. Engineers supply facts; Renee decides what is said and when.

- **Sev1, customer-visible:** first public note within 60 minutes of
  confirmation, then an update at each cadence interval in §1.
- **Sev2:** communicate if customers are likely to notice or if the incident
  lasts beyond one update cycle.
- **Sev3:** no public communication.

Say what is affected, what customers should do, and when the next update comes.
Never publish internal hostnames, project refs, stack traces or key material.
If a payment or personal data may be involved, Renee decides in consultation
with the security contact before anything is published.

---

## 9. Post-incident review template

Run for every Sev1 and every Sev2. Blameless — the target is the system, never
a person. Complete within 5 business days.

```markdown
# Post-Incident Review — <short title>

- **Incident ID / date:** 
- **Severity:** Sev_
- **Detected at:** <UTC> / <America/New_York>
- **Resolved at:** <UTC> / <America/New_York>
- **Total customer-facing duration:** 
- **Detected by:** (monitor / customer report / engineer — name the source)
- **Author:** 
- **Reviewers:** 

## Customer impact
Who was affected, how many, what they experienced, and any money or data at risk.

## Timeline (UTC / America/New_York)
| Time | Event |
| --- | --- |
|  | First bad event (may predate detection) |
|  | Detected |
|  | Severity declared |
|  | Cause identified |
|  | Mitigation applied |
|  | Verified resolved |

## Root cause
The technical cause. Keep asking "why" until you reach something changeable.

## Detection gap
How long between first bad event and detection? If a cached page masked the
failure, say so explicitly and name the uncacheable check that would have
caught it sooner.

## What went well

## What went badly

## Action items
| # | Action | Type (prevent / detect / mitigate) | Owner | Due | Issue |
| --- | --- | --- | --- | --- | --- |
| 1 |  |  |  |  |  |

Every review must produce at least one **detect** action item.

## Monitoring changes
Which check in `scripts/lib/site-health.ts` was added or changed as a result?
If none, justify why the existing checks were sufficient.
```

---

## Appendix — quick command reference

```bash
npm run health:check                      # all monitor checks, live
npm run health:check -- --with-checkout   # include the advisory checkout probe
npm run health:check -- --json            # machine-readable alert payload
npm run health:check -- --simulate-failure # prove alerting works end to end
npm run seo:check                         # canonical / sitemap / robots audit
npm run catalog:seed-audit                # duplicate + QA-seed report (dry run)
npm run validate-env:production           # production env shape, names only
curl -fsS "https://www.mangu-publishers.com/api/health?ready=1" | jq .
dig +short "<project-ref>.supabase.co"    # empty => NXDOMAIN => paused/deleted
```
