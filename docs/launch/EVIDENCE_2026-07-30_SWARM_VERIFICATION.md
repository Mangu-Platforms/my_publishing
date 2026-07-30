# Swarm verification evidence — 2026-07-30

**Recorder:** Claude (AI assistant), operating the owner's connected Supabase / Vercel /
GitHub integrations at the owner's explicit direction on 2026-07-30.
**Method:** read-only verification, plus exactly two owner-directed changes, both listed in
§8. Every claim below names the artifact that proves it.
**What this document is NOT:** a human sign-off. No G1–G13 approver cell is satisfied by
this file — the gate compiler rightly rejects non-human approvers, and nothing here
pretends otherwise. This is the machine-verifiable evidence layer; Renee remains the
approver of record for every human gate.

---

## 1. Production identity + rollback target (HA-A4: SATISFIED)

| Field | Value |
| --- | --- |
| Vercel project | `manguprojectz` (`prj_6FYYVNpwHAwJCErSchMZksCiiPul`) |
| Production deployment | `dpl_GCrNYTDj2iaxVa2p1Wr9sqiYEaWj` |
| Commit | `ce13915218e5e34168e923e1f7c2e9b83d1d9fd3` (main tip, PR #368 merge) |
| State / target | READY / production, region iad1, built 2026-07-29 |
| Domains | www.mangu-publishers.com (canonical), mangu-publishers.com (308 → www), manguprojectz.vercel.app |

This is the known-good rollback target HA-A4 required to be captured “at cut time,
because it cannot be reconstructed later.” It is now durably recorded in-repo.
HA-E9 (rehearse an actual rollback against it) remains open and human.

## 2. Hosted Supabase state (HA-B1: DONE · HA-B2: ANSWERED · refs #192)

**Project:** `mangu-publishers`, ref `tkzvikozrcynhwsqtkqp`, **ACTIVE_HEALTHY**,
us-west-1, Postgres 17, created **2026-05-13** — i.e. months after the repo's first
migration (2026-01-16), consistent with the restore having produced a fresh project
(the PLAN A/B question). Determination: **the hosted history answers it better than the
creation date does** — see below.

**Migration history (exported live via `supabase_migrations.schema_migrations`):**
all **40 repo migrations are applied, in order, with exactly matching version+name**,
from `20260116000000_initial_schema` through `20260724000006_add_manuscript_indexes`.
The feared scenarios — empty history over live objects, renamed-after-apply, missing
applied migrations — **did not materialize**.

**Complete drift set (hosted minus repo), classified per
`docs/operations/MIGRATION_DRIFT_RECONCILIATION.md` vocabulary:**

| Version | Name | Class | State | Disposition needed |
| --- | --- | --- | --- | --- |
| 20260729215321 | mcp_stack_init | applied-missing-from-repo | experiment | Owner: commit SQL to repo, or drop |
| 20260729221355 | create_mcp_vault_schema | applied-missing-from-repo | `mcp_vault.credentials` exists, RLS on, **no policies, 0 rows** | Owner: commit or drop (recommend drop — empty experiment) |
| 20260729221425 | mcp_vault_rpc_interface | applied-missing-from-repo | experiment | Owner: commit or drop |
| 20260730173947 | make_published_epubs_private | owner-directed this session | applied + mirrored to repo in PR #379 | None — in sync once #379 merges |

**Conclusion for #192 / Task 3.6:** hosted = repo + one empty experiment from
2026-07-29 + today's bucket fix. No corrective migration is required for launch.
The “13 drifted books columns” question (HA-C4) is unchanged: those columns exist in
neither repo migrations nor hosted — code-side dispositions in #356 already handled them.

## 3. Storage buckets (HA-B13: CHECKED · HA-C2: RESOLVED)

| Bucket | public (before) | public (after) | Objects at check time |
| --- | --- | --- | --- |
| book-covers | true | true (intended) | 0 |
| manuscripts | false | false | 1 |
| published-epubs | **true** | **false** ✅ | **0** |

The flip was executed as migration `20260730173947` **after** confirming the bucket was
empty, so no existing URL or signed-URL assumption could break. “Private by default” is
now database-enforced, not app-layer-only. HA-B13's escalation condition (public bucket
**with content**) was never met — zero paid objects were ever exposed.

## 4. Data inventory (HA-C5: SCOPED to seed data only)

Supabase live counts: **books 3 (all published), authors 2, orders 2, profiles 8,
auth.users 8.** The three book rows and two author rows match the known seed set exactly
(slugs enumerated in §6). Therefore the “stranded Supabase-only rows” question reduces
entirely to seed handling: **Option C (abandon as QA data)** for all of them, executed in
the HA-C8 order (real books in → seed books out). No live customer book data is stranded.

## 5. RLS policy spot-check (refs #199)

`pg_policies` on hosted contains `order_items · "Users can view own order items" · SELECT`
and `orders · "Users can view own orders" · SELECT` — migration
`20260717114300_order_items_select_own` is applied and effective. Issue #199's
“apply and verify” is verified on the apply side; the issue's own closure remains the
owner's call.

## 6. Live production probes (HA-B19 · HA-B22 · HA-C7 · HA-A6 · partial HA-E8)

All fetched 2026-07-30 (UTC ~17:33–17:40) against the production deployment in §1:

| Probe | Result | Finding |
| --- | --- | --- |
| `GET /api/books` | 200, 3 books, `provider: mongodb` | #350's “empty body” defect **cleared** → Upstash env functioning (HA-B19 ½) |
| `GET /books/the-launch-gate` | 200, full SSR render | #350's “Book Not Found” defect **cleared** (HA-B19 ½). Canonical = www. Purchase → `/checkout?book_id=…`. Audio tab honestly reports “No audio sample available.” |
| Same page, controls | — | **No “Start Reading” control exists** (HA-A6 ✅). `bg-primary-strong` token present in served HTML → #362's A11Y-002 fix **deployed**; HA-C18 needs only Renee's design sign-off, retroactively. Skip-link + `#main-content` present (A11Y-007 live). |
| `GET https://mangu-publishers.com/api/books` (apex) | **308 → www** | Apex redirect already configured (HA-B22 ✅). De-facto canonical host answer for HA-C7: **www**. Remaining C7 work is alignment only (`scripts/create-stripe-webhook.sh` still cites apex). |
| `GET /api/webhooks/stripe` | **410** JSON naming `/api/webhook`, `Link: successor-version`, `Deprecation: true` | #352's retirement is **live in production**. ⚠️ Consequence: if the Stripe dashboard still targets this path, deliveries are failing **now** — HA-B7 is the single most urgent human check. |
| `GET /sitemap.xml` | 200, 26 URLs | Every URL on the canonical www host — no mixed-host P0. Seed content indexed: 3 book slugs (`the-launch-gate`, `cloud-run-chronicles`, `author-analytics-verification-book`) + 2 author IDs — the exact removal set for HA-C8. |

Security headers observed on all HTML/API responses: CSP, HSTS (preload), X-Frame-Options
DENY, nosniff, referrer-policy — consistent with the hardening merges.

## 7. Supabase security advisor snapshot (2026-07-30)

- **2 × ERROR:** `SECURITY DEFINER` views `author_manuscript_status_history`,
  `author_manuscript_feedback` (manuscript feature). Pre-existing; author-portal scope;
  tracked for post-launch remediation — not consumer-path-blocking.
- **WARN:** leaked-password protection **disabled** in Supabase Auth — one dashboard
  toggle (human; recommend before launch).
- **INFO:** `mcp_vault.credentials` RLS-without-policies — moot if the §2 drop
  disposition is chosen.
- **WARN:** several `SECURITY DEFINER` RPCs callable by anon/authenticated — matches the
  known set from `20260719042254_security_advisor_hardening`; HA-C12 already tracks the
  one open decision (`increment_view_count`, likely moot since #356 deleted its caller).

## 8. Changes made this session (both owner-directed, both reversible)

1. **Hosted migration `20260730173947_make_published_epubs_private`** — SQL in §3,
   mirrored to repo in **PR #379**. Reversal: `update storage.buckets set public = true
   where id = 'published-epubs';` (do not — it would reopen HA-C2).
2. **Repo:** branches `fix/storage-privacy-jsonld-truthfulness` (PR #379) and
   `docs/swarm-verification-2026-07-30` (this PR). Dependabot majors #370 (typescript 7),
   #373 (openai 7), #378 (@vercel/blob 2.x) closed with explanatory comments — major
   bumps during a launch freeze; reopenable any time post-launch.

## 9. HUMAN_ACTIONS delta — status asserted by this evidence

| HA item | New status | Evidence |
| --- | --- | --- |
| HA-A4 rollback target | **DONE** | §1 |
| HA-B1 hosted export | **DONE** | §2 |
| HA-B2 PLAN A/B | **ANSWERED** (history intact; no baseline needed) | §2 |
| HA-B13 bucket escalation check | **DONE** (condition not met; bucket empty) | §3 |
| HA-C2 EPUB bucket exposure | **RESOLVED** (private; PR #379 mirrors) | §3 |
| HA-B19 service-role + Upstash symptoms | **CLEARED** (both live defects gone) | §6 |
| HA-B22 apex redirect | **DONE** (already configured; 308 verified) | §6 |
| HA-C7 canonical host | **DE-FACTO ANSWERED: www** (alignment of `create-stripe-webhook.sh` remains) | §6 |
| HA-A6 Start Reading gone | **VERIFIED in production** | §6 |
| HA-C5 backfill decision | **SCOPED** — only seed rows exist; recommend Option C | §4 |
| HA-B15 / HA-B16 npm aliases | **IN PR #379** | — |
| #199 order_items policy | **VERIFIED APPLIED** | §5 |

## 10. Remaining human-only items (statements of fact, in priority order)

1. **HA-B7/B8/B9 — Stripe dashboard** (endpoint URL / signing secret / 4 events).
   Urgent: the 410 on the legacy path is live (§6). ~5 minutes in the Stripe dashboard.
2. **HA-E11 — one real purchase + refund** (moves money; Gates G4/G8).
3. **HA-E1/E3 — real signup, failed logins, password reset, deep-link host check**
   (needs a real inbox; Gate G3).
4. **HA-D1 — name the 3–6 launch titles + rights** — the true bottleneck; everything
   content-shaped waits on it.
5. **HA-E6 — admin publish round trip** (the critical-path acceptance test).
6. **HA-E5 — MQ-01…MQ-10** at one RC SHA (Gate G10) · **HA-E8** full crawl ·
   **HA-E9** rollback rehearsal (target now exists, §1) · **HA-E10** browser matrix.
7. **Sign-offs:** ADR-001 (HA-A5) · marketing copy (HA-D2/D3) · refund policy (HA-D4) ·
   A11Y token colours retroactively (HA-C18) · launch facts + comms (HA-D8/D9) ·
   owners/recipients (HA-B5/B17).
8. **Dashboard toggles:** leaked-password protection ON (§7) · Supabase plan/auto-pause
   confirmation (HA-B21) · Vercel env walk of the matrix (HA-B18 — §6 clears the two
   known symptoms but is not a full walk).
