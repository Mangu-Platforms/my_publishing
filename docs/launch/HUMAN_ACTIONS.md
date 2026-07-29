# Human Actions — MANGU Publishers launch

**For:** Renee · **Compiled:** 2026-07-28 · **Base:** `audit/2026-07-28-fixes` @ `23e50c1`
**Revised:** 2026-07-29 after the CI verification pass — every original programme branch is
now green through `npm run build` (runs #894–#913, `PROGRAMME_STATUS.md` §1), #358 is merged
into #356, and PR #362 (accessibility remediation) exists. Done items are kept and marked
**DONE** with evidence rather than deleted; IDs are stable and nothing is renumbered.
**Source:** every "Needs Renee" / "Needs a decision" / "Requires human" section across PRs
#350–#362, deduplicated into one entry each.
**Companions:** `docs/launch/PROGRAMME_STATUS.md` · `docs/launch/EVIDENCE_PACKET.md`

**69 actions — 2 DONE (HA-A1, HA-D5), 67 open.** A: 9 · B: 22 · C: 18 · D: 9 · E: 11.

Every entry names the task and PR it unblocks. Priorities:

| | |
| --- | --- |
| **P0** | Blocks the merge sequence, a governance gate, or launch itself. Nothing downstream moves. |
| **P1** | Blocks a task from being called done, or carries a real risk if skipped. |
| **P2** | Should be settled before launch but does not block the sequence. |

---

## Start here — the five that block everything

*(2026-07-29: the old #1 — HA-A1, the `npm test` failure — is **DONE**; see its entry for
evidence. The test-suite blocker is gone. What blocks launch now is merging, hosted-Supabase
evidence, real content, and human QA.)*

| # | Action | Priority |
| --- | --- | --- |
| **HA-A2** | Merge in the verified order, starting with #350 — every open programme PR is green through build, so the sequence is unblocked — then retarget per HA-A8. | **P0** |
| **HA-B1** | Run the hosted Supabase migration-history export. Task 3.6 blocks every migration, the backfill and the EPUB bucket question. | **P0** |
| **HA-D1** | Name the 3–6 launch titles and confirm rights. There is no real content anywhere; the catalog, the intake pipeline and the launch copy are all empty templates. | **P0** |
| **HA-E5** | Fill manual QA rows 1–10 with an RC SHA, an environment, a tester and ten sets of evidence. Ten blank rows keep **G10 FALSE** and issue #193 open. | **P0** |
| **HA-B7** | Confirm the Stripe dashboard webhook endpoint URL. If it points at `/api/webhooks/stripe`, **payment deliveries start failing with 410 the moment #352 deploys.** | **P0** |

---

## Group A — Unblocks everything: merges, retargets, production config

### HA-A1 — Fix the `npm test` failure that PR #350 introduced
**✅ DONE — 2026-07-28/29.** The diagnosis held: the mocks were behind `8e6fa50`'s
`.order('published_at').limit(1)` change. Fix commits landed on every branch (~22:40 UTC;
on `audit/2026-07-28-fixes` it is `935e7d2` — `test(catalog): assert the
duplicate-slug-hardened checkout read path`; `task/accessibility-and-browser-matrix` also
needed `8bf70f91`, removing a spurious `virtual: true` mock flag). One straggler followed:
#352's `npm run build` failed on a non-route export from the 410 webhook stub, fixed
2026-07-29 00:17 UTC (`aeade43`/`ec23656`/`339218b`).
**Evidence:** run #894 green on `935e7d2`
(<https://github.com/redinc23/my_publishing/actions/runs/30405413119/job/90429631120>);
run #913 green on `339218b`
(<https://github.com/redinc23/my_publishing/actions/runs/30410720809/job/90445935848>);
full per-branch table in `PROGRAMME_STATUS.md` §1. `npm run build` has now executed
successfully on all eleven original branches — the first builds in the programme's history.
**Still open nearby:** #361 and #362 remain red at `npm test` only because they forked
before these fixes — that is HA-A9, not a re-open of this item.
**Priority:** ~~P0~~ **DONE**

### HA-A2 — Merge in the verified order, starting with #350
**Do:** `#350 → #351 → #356 → #352 → #354 → #353 → #357 → #355`, with **#359** anywhere after
#350; **#360** after #356 *and after HA-A3's refresh*; **#362** after #360 (needs HA-A9 +
HA-C18 sign-off); **#361** last, refreshed. #358 is gone from the sequence — Renee merged it
into #356 on 2026-07-28 (23:06:20 UTC). Verified against the actual git bases — see
`PROGRAMME_STATUS.md` §2. Merge nothing before its branch is green — **now satisfied for
every open programme PR except #361/#362** (runs #894–#913).
**Why a human:** merge authority, and the launch freeze (issue #209) requires each merge to be
classified against a permitted change class.
**Expected result:** eight PRs land on `main` in order, each with a green run on its own head
SHA. #356 is the critical path — it is the PR that makes an admin-published book appear on the
public site at all.
**Unblocks:** Tasks 1.0, 1.2, 2.0b, 2.1–2.4 (#356); 1.3–1.5, 1.7–1.9 (#352); everything else.
**Priority:** **P0**

### HA-A3 — Update PRs #358 and #360 from #356 before reviewing them
**½ DONE.** The **#358 half is DONE** — Renee merged #358 into
`task/phase1-catalog-data-path` at 2026-07-28 23:06:20 UTC; the merge was clean and the
resulting head `9c28293` is green through build (run #910,
<https://github.com/redinc23/my_publishing/actions/runs/30406910811/job/90434281690>), with
#358's validator tests executing inside it. The branch is deleted.
**Still to do — the #360 half:** `task/accessibility-and-browser-matrix` still forks
`task/phase1-catalog-data-path` at `a43cea0`, now even further behind (the missing commits
include the admin-form fixes *and* the merged #358). Merge #356's tip into it so the audit's
line-number citations for `app/admin/books/_lib/BookForm.tsx` resolve to the current file.
**Why a human:** no agent can rebase; pushes are API-only in this programme.
**Expected result:** #360's branch contains `9c28293`; its CI stays green.
**Unblocks:** Section H (#360), and transitively #362.
**Priority:** **P1** (was P0; the merged half removed the review-integrity risk for 4.2)

### HA-A4 — Record the known-good rollback target at cut time
**Do:** At the moment you freeze the release candidate, capture the previous known-good
**Vercel deployment ID + commit SHA** and write them into
`docs/launch/RELEASE_CHECKLIST.md`.
**Why a human:** it exists only in the Vercel dashboard, and **it cannot be reconstructed
later.** This is the one item on the whole list that becomes impossible if missed.
**Expected result:** a deployment ID and a SHA recorded, and a rehearsed rollback (see HA-E9).
**Unblocks:** Task 5.5 (#357). **Gate G11.**
**Priority:** **P0**

### HA-A5 — Sign ADR-001
**Do:** Review `docs/architecture/ADR-001-catalog-and-identity-data-ownership.md` §2 (Option A)
and §5 (rejected Options B and C) and sign it.
**Why a human:** an ADR is an authority document; a bot cannot accept one, and G9 requires a
signature.
**Expected result:** ADR status ACCEPTED with a named signer and a date.
**Unblocks:** Task 1.1 (#351). **Gate G9.**
**Priority:** **P0**

### HA-A6 — At merge, confirm the PDP "Start Reading" button is gone
**Do:** After #352 and #356 both land, confirm the block at
`app/(consumer)/books/[slug]/page.tsx:172–174` — `<Button asChild size="lg"><Link
href={\`/reading/${book.id}\`}>Start Reading</Link></Button>` — no longer exists. #352 owns
Task 1.7 but does not own that file; #356 does.
**Why a human:** it is a cross-PR handoff between two agents' file ownership. No CI check
covers it, and each PR passes its own review without it.
**Expected result:** no "Start Reading" control anywhere on the site. The Purchase button,
WishlistButton and the "Also available at" retailer links become the primary CTAs.
**Unblocks:** Task 1.7 (#352 + #356).
**Priority:** **P1**

### HA-A7 — Approve any corrective migration before it is written
**Do:** After the Task 3.6 export lands, review the proposed corrective migrations in
`docs/operations/MIGRATION_DRIFT_RECONCILIATION.md` and approve or refuse each **before** any
SQL is authored.
**Why a human:** writing a migration against an unknown live schema is how you drop a live
column. The reconciliation doc's stated highest risk is mistaking PLAN B (schema exists,
created outside the migration system) for PLAN A (genuinely blank project) — **never resolve
an empty history with `supabase db push`.**
**Expected result:** an explicit written approval per migration, or an explicit refusal.
**Unblocks:** Task 3.6 (#359), and Task 1.2's deferred items (#356).
**Priority:** **P0**

### HA-A8 — Retarget eight PRs to `main` the moment #350 merges
**Do:** Now **nine**, not eight: #351, #352, #353, #354, #355, #356, #357, #359 **and
#361** all target `audit/2026-07-28-fixes`. Retarget each to `main`. (#360 targets
`task/phase1-catalog-data-path` — retarget when #356 lands. #362 targets
`task/accessibility-and-browser-matrix` — retarget when #360 lands. #358 is merged; nothing
to do. Heading kept as "eight PRs" for stable links.)
**Why a human:** only a repository maintainer can change a PR base.
**Expected result:** eight PRs showing base `main`, each still mergeable.
**Unblocks:** the merge sequence. Every one of the eight PR bodies asks for this explicitly.
**Priority:** **P0**

### HA-A9 — Refresh the two red branches: #361 and #362
**Do:** (1) Merge `audit/2026-07-28-fixes` tip (`935e7d2` or later) into
`task/evidence-packet` (#361). (2) Merge `task/accessibility-and-browser-matrix` tip
(`8bf70f91` or later) into `task/a11y-remediation` (#362), resolving the flagged
`app/admin/books/_lib/BookForm.tsx` conflict — #362 edited it from a pre-`published_at`
version of the file (conflict is flagged on #362; line-level resolution not verified by this
recorder).
**Why a human:** no agent in this programme can rebase or resolve merge conflicts; pushes
are API-only.
**Expected result:** both branches go green at `npm test` like the other eleven — their
failures (runs #892 and #899) carry the same inherited signature the programme-wide fix
cleared, and step-level evidence shows everything green up to `npm test` on both.
**Unblocks:** the merge of #361 (this packet) and #362 (with HA-C18).
**Priority:** **P1**

---

## Group B — External accounts and dashboards

### HA-B1 — Run the hosted Supabase migration-history export
**Do:** Run `scripts/sql/export-migration-history.sql` against the hosted database, or delegate
SQL access to someone who can, and paste the output into
`scripts/migration-drift-report.ts`.
**Why a human:** it needs database credentials. No agent on this programme has, or sought,
them — deliberately. What the hosted database contains is currently **unknown**: the project
was paused/deleted and later restored, and nobody has exported the migration history since.
**Expected result:** a complete export covering every section the SQL requests. An unexported
section is reported as an explicit **evidence gap** and must never read as "clean".
**Unblocks:** Task 3.6 (#359) — and through it Task 1.2's deferred items (#356), the
`published-epubs` bucket question, the backfill, and every future migration.
**Priority:** **P0**

### HA-B2 — Confirm whether the restore produced a new Supabase project
**Do:** Confirm in the Supabase dashboard whether the current project is the original or a new
one created by the restore. This is the PLAN A vs PLAN B branch in the reconciliation doc.
**Why a human:** dashboard access. One investigator saw the configured ref return `401 "No API
key found"` (so a project exists), contradicting an earlier NXDOMAIN observation. Neither
observation says what is inside the database.
**Expected result:** a written PLAN A or PLAN B determination.
**Unblocks:** Task 3.6 (#359).
**Priority:** **P0**

### HA-B3 — Confirm a verified, restore-tested backup
**Do:** Confirm a backup exists **and has been restore-tested**, before any corrective action
or backfill.
**Why a human:** dashboard access, and it is a judgement about acceptable data loss.
**Expected result:** a backup identifier, a timestamp, and a record of a successful test
restore.
**Unblocks:** Task 3.6 (#359), Task 1.0 backfill (#356).
**Priority:** **P0**

### HA-B4 — Apply the updated health-monitor prompt
**Do:** Update the Cowork scheduled task `mangu-site-health-check` (daily, cron `30 7 * * *`,
America/New_York) with the six-check prompt delivered alongside #353.
**Why a human:** **the monitor is not in this repository.** It is a scheduled task on your
machine, and no agent can write that file. #353 flagged this as a contradiction against its
brief rather than inventing a repo file.
**Expected result:** the 07:30 run exercises all six checks — homepage, `/api/books`,
book-detail canary, `/login` server render, Supabase `/auth/v1/health`, and (opt-in)
`/checkout`.
**Unblocks:** Task 0.4 (#353). **Gate G9** (monitors hit real production).
**Priority:** **P1**

### HA-B5 — Name the alert recipients
**Do:** Replace every `_TBD_` in the alert-recipient table of
`docs/operations/INCIDENT_RESPONSE.md`.
**Why a human:** you are the only person who knows who should be paged.
**Expected result:** a named recipient and channel per severity level.
**Unblocks:** Tasks 0.4 and 5.4 (#353).
**Priority:** **P1**

### HA-B6 — Run the key-rotation workflow in dry-run mode
**Do:** *Actions → Rotate Supabase Anon Key → Run workflow* with `dry_run: true`.
**Why a human:** it is a manually-dispatched workflow that touches secrets.
**Expected result:** the summary shows the **⛔ READ BEFORE DISABLING ANY KEY** block, and the
dashboard link uses the ref you supplied (or the `_` picker) — never a hardcoded one. Confirm
you understand that a bulk "disable all legacy JWT keys" action also disables the
`service_role` JWT, which nothing re-provisions.
**Unblocks:** Task 0.7 (#353).
**Priority:** **P2**

### HA-B7 — Confirm the Stripe dashboard webhook endpoint URL
**Do:** Stripe Dashboard → Developers → Webhooks.
**Why a human:** the endpoint URL is external configuration this repository cannot read.
**Expected result:** exactly **one** enabled endpoint, `https://www.mangu-publishers.com/api/webhook`.
**If it currently reads `/api/webhooks/stripe`, deliveries start failing with 410 the moment
#352 deploys — repoint it first.** If it reads the apex host, settle HA-C7 and align
`scripts/create-stripe-webhook.sh` and `docs/reports/deployment/deployment_status.md`.
**Unblocks:** Task 1.4 (#352). **Gate G8.**
**Priority:** **P0**

### HA-B8 — Confirm the Stripe signing secret matches production
**Do:** Confirm the endpoint's signing secret equals `STRIPE_WEBHOOK_SECRET` in Vercel
production.
**Why a human:** two dashboards, and the value must never leave them.
**Expected result:** signature verification passes, and the D8 check
(`POST /api/webhook` unsigned → 400) still holds.
**Unblocks:** Task 1.4 (#352). **Gate G8.**
**Priority:** **P0**

### HA-B9 — Confirm the enabled Stripe event list
**Do:** Confirm the enabled events are exactly `checkout.session.completed`,
`checkout.session.expired`, `charge.refunded`, `payment_intent.payment_failed`.
**Why a human:** dashboard configuration.
**Expected result:** no other event type is enabled — anything else is silently no-op'd by the
handler.
**Unblocks:** Task 1.4 (#352). **Gate G8.**
**Priority:** **P1**

### HA-B10 — Create disposable test accounts as repository secrets
**Do:** Create **disposable, non-production** accounts, one per role, and add
`TEST_READER_EMAIL` / `TEST_AUTHOR_EMAIL` / `TEST_PARTNER_EMAIL` / `TEST_ADMIN_EMAIL` and their
`_PASSWORD` counterparts as repository or CI secrets.
**Why a human:** account creation and secret management. The specs deliberately ship with **no
default credentials** — a spec that falls back to a well-known password teaches people to
create that account in production.
**Expected result:** #355's credentialed RBAC blocks and #360's admin accessibility block stop
skipping.
**Unblocks:** Tasks 3.4 and 3.5 (#355), Section H's admin block (#360), and evidence for
Task 1.5 (#352). **Gate G5.**
**Priority:** **P1**

### HA-B11 — Decide where the E2E specs run
**Do:** `ci.yml` has **no Playwright job at all**. Decide: RBAC matrix on preview E2E;
rate-limit specs on a scheduled or manual job against a dedicated target.
**Why a human:** a CI topology decision with a cost.
**Expected result:** **the rate-limit specs must NOT run on PR CI** — they deliberately exhaust
a shared per-IP bucket and would make the auth and RBAC specs fail in ways that look like RBAC
bugs.
**Unblocks:** Tasks 3.4, 3.5 (#355), Section H (#360).
**Priority:** **P1**

### HA-B12 — Decide whether to stand up a broken-limiter instance
**Do:** Decide whether to provide `E2E_LIMITER_UNAVAILABLE_BASE_URL` — an instance started with
a deliberately broken limiter backend.
**Why a human:** it costs an environment. An outage cannot be induced against a healthy
deployment, and faking it would prove nothing, so the block skips without one.
**Expected result:** either a target URL, or an accepted gap covered only by unit tests.
**Unblocks:** Task 3.5 (#355).
**Priority:** **P2**

### HA-B13 — Escalate immediately if storage buckets are public
**Do:** When the Task 3.6 export lands, check whether `published-epubs` or `manuscripts` show
`public = true`.
**Why a human:** it is a live paid-content exposure, not a migration to schedule.
**Expected result:** if either is public, stop and treat it as a security incident under
`docs/operations/INCIDENT_RESPONSE.md`. Note: `published-epubs` **is** `public = true` in
`supabase/migrations/20260117000006_storage_policies.sql`, so "private by default" is currently
app-layer only.
**Unblocks:** Task 3.6 (#359). Related decision: HA-C2.
**Priority:** **P0**

### HA-B14 — Confirm which social accounts MANGU controls
**Do:** Confirm `@mangupublishers` (referenced in `app/layout.tsx`) is an account you control,
and list every other handle that should appear in launch copy.
**Why a human:** account ownership. #354 could not confirm it and left a `TODO(renee):`.
**Expected result:** a confirmed handle in `app/layout.tsx`, or the reference removed.
**Unblocks:** Task 4.6 (#354), Task 5.5 (#357).
**Priority:** **P1**

### HA-B15 — Add the npm alias `gates:compile`
**Do:** Add `"gates:compile": "tsx scripts/compile-gate-evidence.ts"` to `package.json`.
**Why a human:** #357 deliberately did not edit `package.json` (PR hygiene — another PR owns
it).
**Expected result:** `npm run gates:compile` works. Until then: `npx tsx
scripts/compile-gate-evidence.ts`.
**Unblocks:** Task 5.1 (#357).
**Priority:** **P2**

### HA-B16 — Add the npm alias `qa:crawl`
**Do:** Add `"qa:crawl": "tsx scripts/crawl-regression.ts"` to `package.json`. Optionally
`"test:e2e:rbac"` and `"test:e2e:rate-limit"` (the latter still needs
`E2E_RATE_LIMIT_TESTS=true` set by the caller — a cross-platform inline env prefix does not
work in a Windows shell).
**Why a human:** #355 deliberately did not edit `package.json`.
**Expected result:** a monitor, runbook or checklist can call one stable name rather than a
path plus `npx tsx`.
**Unblocks:** Task 5.3 (#355).
**Priority:** **P2**

### HA-B17 — Name the launch owner and the incident owner
**Do:** Fill the launch owner and incident owner fields in
`docs/launch/LAUNCH_COMMUNICATIONS.md` and `docs/operations/INCIDENT_RESPONSE.md`.
**Why a human:** they are people, and the documents deliberately ship them as fields to fill
rather than invented names.
**Expected result:** a named owner in both documents.
**Unblocks:** Tasks 5.4 (#353) and 5.5 (#357).
**Priority:** **P1**

### HA-B18 — Verify every production environment variable in Vercel
**Do:** Walk `docs/operations/ENVIRONMENT_MATRIX.md` in the Vercel dashboard and mark each
production variable verified.
**Why a human:** dashboard access. The matrix honestly marks production presence as **NOT
VERIFIED** because it cannot be checked from outside.
**Expected result:** a completed "last verified" table with a date.
**Unblocks:** Section G (#353). **Gates G1 and G7.**
**Priority:** **P0**

### HA-B19 — Confirm `SUPABASE_SERVICE_ROLE_KEY` and the Upstash variables in production
**Do:** Specifically confirm these are present and current. PR #350 documented two live
production defects it could not fix from the repo: **every book detail page rendered "Book Not
Found"** (verified for all three live books) while `/books` listed them — most likely a missing
or rotated `SUPABASE_SERVICE_ROLE_KEY` — and **`GET /api/books` returned an empty body**, most
likely Upstash rate-limit env, because the limiter is fail-closed.
**Why a human:** dashboard access, and a rotated key value can only come from Supabase.
**Expected result:** both live defects clear on production without a code change. If they do
not, the diagnosis in #350 was wrong and needs re-opening.
**Unblocks:** #350's known issues; Section G (#353). **Gates G1 and G7.**
**Priority:** **P0**

### HA-B20 — Approve `@axe-core/playwright` as a dev dependency
**Do:** Approve or refuse adding it. There is currently **no** accessibility library in
`package.json` — no `axe-core`, `@axe-core/playwright`, `jest-axe` or `pa11y` — so #360's spec
implements its own accessible-name resolution, heading-outline extraction, focus-indicator
detection and WCAG contrast maths in-page.
**Why a human:** a dependency decision during a launch freeze.
**Expected result:** either approved (it would replace the mechanical parts of the spec — alt
text, labelling, ARIA validity, contrast — and **not** the keyboard-order, focus-trap,
retailer-link or audio-contract tests), or an explicit "not before launch".
**Unblocks:** Section H (#360).
**Priority:** **P2**

### HA-B21 — Confirm the Supabase project plan and auto-pause behaviour
**Do:** Confirm the current project's plan tier and whether it can auto-pause.
**Why a human:** billing and dashboard access.
**Expected result:** a project that cannot pause under the launch plan. The project has already
been paused/deleted once — `docs/operations/INCIDENT_RESPONSE.md` documents the
`DNS_PROBE_FINISHED_NXDOMAIN` / `ENOTFOUND` signature precisely because of it, and the health
monitor now detects it.
**Unblocks:** Tasks 0.4 and 5.4 (#353), Task 3.6 (#359). **Gates G1 and G7.**
**Priority:** **P0**

### HA-B22 — Configure the apex → www redirect in Vercel and DNS
**Do:** Once HA-C7 is decided, configure the redirect and confirm it.
**Why a human:** DNS and Vercel domain configuration.
**Expected result:** the sibling host redirects rather than serving 200. #355's crawl harness
treats "the sibling host (apex↔www, derived, never hardcoded) serving 200 instead of
redirecting, or redirecting elsewhere" as a **P0 failure**, so this will be caught the first
time the crawl runs.
**Unblocks:** Task 5.2 (#353), Task 5.3 (#355), Task 1.4 (#352). **Gate G9.**
**Priority:** **P1**

---

## Group C — Decisions

### HA-C1 — `subtitle`: bring it back, or drop it?
**Do:** `books.subtitle` exists in **no migration**. #356 removed it from the admin form,
action inputs and payloads. Decide whether it returns via a post-3.6 forward migration.
**Why a human:** a product decision about the book model.
**Expected result:** either "add `books.subtitle` after 3.6" or "drop it permanently".
**Unblocks:** Task 1.2 (#356), and #358's intake spec, which currently treats a `subtitle` key
as a blocker.
**Priority:** **P2**

### HA-C2 — `published-epubs` bucket exposure
**Do:** The bucket is `public = true` in `supabase/migrations/20260117000006_storage_policies.sql`,
which is inconsistent with the "no public EPUB access" launch decision. **Right now "private by
default" is app-layer only.** Decide whether to make it private.
**Why a human:** it needs a console or migration change, and changing it may break existing
signed-URL assumptions. #351 escalated it rather than resolving it.
**Expected result:** either the bucket is made private (blocked until Task 3.6) or a written,
signed acceptance that paid EPUBs are directly reachable at launch.
**Unblocks:** Task 2.2 (#356), Task 3.6 (#359). Related: HA-B13.
**Priority:** **P0**

### HA-C3 — Audio hosting
**Do:** **No audio storage bucket exists.** The migration creates only `book-covers`,
`manuscripts` and `published-epubs`; `types/upload.ts` names an `audiobooks` bucket nothing
creates; `/api/upload/book-assets` accepts `cover|epub` only. Decide where audio samples are
hosted at launch, and who owns that hosting.
**Why a human:** infrastructure and cost.
**Expected result:** a named host and owner. Until then the audio field accepts a hosted https
URL rather than a direct upload, and #358's validator **blocks** an audio file in an asset kit
with an explanation.
**Unblocks:** Tasks 2.0b and 2.2 (#356), Task 4.2 (#358).
**Priority:** **P1**

### HA-C4 — Add the 13 drifted `books` columns, or retire the Supabase read path?
**Do:** Code references `books.{subtitle, epub_url, deleted_at, author_name, metadata, tags,
categories, view_count, download_count, manuscript_url, language, seo_title, seo_description}`,
none of which any migration creates. Decide.
**Why a human:** an architecture decision with real cost either way.
**Expected result:** a decision. **#359 flags that adding thirteen columns may be the wrong fix
entirely** — production reads the catalog from MongoDB, so they would be added to a database
the read path no longer uses.
**Unblocks:** Task 3.6 (#359), Task 1.2 (#356).
**Priority:** **P1**

### HA-C5 — Approve the backfill of stranded Supabase book rows, and decide every conflict
**Do:** Provider-aware admin writes (#356) mean books published through the admin UI go to
MongoDB, so **Supabase-only rows are invisible to the production read path**. Run the dry run
(`scripts/backfill-books-dry-run.ts`, read-only, no execute mode), then approve an option and
decide each conflicting row.
**Why a human:** it is a production data action. **Stop condition:** if both stores hold
non-identical live book rows, that needs your explicit approval and a verified backup (HA-B3)
before any reconciliation.
**Expected result:** a written decision per bucket — Supabase-only, Mongo-only, identical,
conflicting — with a field-by-field decision for every conflict.
**Unblocks:** Task 1.0 follow-up (#356), Task 3.6 (#359).
**Priority:** **P0**

### HA-C6 — Resolve the ADR-001 numbering collision
**Do:** `docs/adr/ADR-001-canonical-platform.md` already exists and is **ACCEPTED**. #351 added
`docs/architecture/ADR-001-catalog-and-identity-data-ownership.md`. **Two live ADR-001s.**
Decide which keeps the number.
**Why a human:** a governance decision. #351 filed under the requested name so work was not
blocked and escalated rather than renumbering unilaterally.
**Expected result:** one ADR-001; the other renumbered, with cross-references updated.
**Unblocks:** Task 1.1 (#351). Related: HA-A5. **Gate G9.**
**Priority:** **P1**

### HA-C7 — Apex or www as the canonical host?
**Do:** Decide, then align every reference. `scripts/create-stripe-webhook.sh` targets the
**apex** `https://mangu-publishers.com/api/webhook` while the canonical host is
`https://www.mangu-publishers.com`. #352 did not change it because the repo does not say
whether the apex redirect is intentional.
**Why a human:** DNS ownership and a branding decision.
**Expected result:** one canonical host, with `scripts/create-stripe-webhook.sh`,
`docs/reports/deployment/deployment_status.md`, the Stripe endpoint and the monitors all
agreeing.
**Unblocks:** Task 1.4 (#352), Task 5.2 (#353), Task 5.3 (#355). Enables HA-B22.
**Priority:** **P1**

### HA-C8 — Seed and QA content removal order
**Do:** **The production catalog is currently 100% seed data** — `/api/books` returns exactly
three books, all on the known seed slug list, both authors are known seed author ids, and all
five are published in `sitemap.xml`. Decide the order: real content in first, or seed content
out first.
**Why a human:** **removing the seed records before real books exist empties the public
catalog.** This is not a tidy-up.
**Expected result:** a written sequence, tied to HA-D1.
**Unblocks:** Task 1.6 (#353), Task 4.1 (#351).
**Priority:** **P0**

### HA-C9 — Sign off the sign-in password exception
**Do:** #352 unified the password policy at **8 characters** for *creation*, but deliberately
does **not** enforce it at sign-in — sign-in validates presence only.
**Why a human:** a security-vs-lockout trade-off. Enforcing 8 at sign-in would permanently lock
out any pre-existing account holding a 6–7 character credential (Supabase's own default minimum
is 6) and leaks policy state to an attacker.
**Expected result:** either sign off the presence-only rule, or accept the lockout and raise it.
**Unblocks:** Task 1.9 (#352).
**Priority:** **P1**

### HA-C10 — `/dashboard`, `/author`, `/partner`: index page or redirect?
**Do:** None of the three roots has a `page.tsx`, so **a correctly-authorised user who passes
the gate still lands on a 404.** Decide: redirect each root to that role's dashboard, or add an
index page.
**Why a human:** a product decision. #355 did not invent a page; its specs assert the current
404 and will fail loudly the moment it changes — which is the signal you want.
**Expected result:** a decision, and #355's spec updated to assert the new behaviour.
**Unblocks:** Task 3.4 (#355).
**Priority:** **P1**

### HA-C11 — Should admins be allowed the partner CSV export?
**Do:** `GET /partner/orders/export` requires `role === 'partner'` **exactly**, so it refuses
admins — while admins *are* allowed into every partner portal *page*. Intentional
least-privilege, or a gap?
**Why a human:** an authorization policy decision.
**Expected result:** a decision. #355's spec currently encodes 403-for-admin as the documented
behaviour, so changing it means changing the spec deliberately.
**Unblocks:** Task 3.4 (#355). **Gate G5.**
**Priority:** **P2**

### HA-C12 — Approve `increment_view_count` as `SECURITY DEFINER`
**Do:** Approve or refuse.
**Why a human:** `SECURITY DEFINER` runs with the definer's privileges — it is
security-sensitive and needs an explicit owner decision.
**Expected result:** a written approval or refusal.
**Unblocks:** Task 3.6 (#359). Note: #356 **deleted** the calling code (`incrementViewCount`
had no callers and failed silently), so this may now be moot — confirm before approving.
**Priority:** **P2**

### HA-C13 — `books.short_description`: add the column, or drop the field?
**Do:** No such column exists. The ~200-character cap in #358's asset-kit spec is intake
guidance only.
**Why a human:** a schema decision, blocked behind Task 3.6.
**Expected result:** either "add the column after 3.6" or "drop the field from the kit".
**Unblocks:** Task 4.2 (#358).
**Priority:** **P2**

### HA-C14 — Cover alt-text column
**Do:** No cover alt-text column exists; covers render a hardcoded `Cover of <title>`. Decide
whether to add one, and confirm the ~125-character cap.
**Why a human:** a schema decision plus an accessibility judgement.
**Expected result:** a decision from the accessibility owner.
**Unblocks:** Task 4.2 (#358), Section H (#360).
**Priority:** **P2**

### HA-C15 — `seo_title` / `seo_description`: add columns, or accept derived metadata?
**Do:** Both are capped (60 / 160) in `types/books.ts` but exist in **no migration**;
`generateMetadata` derives them today.
**Why a human:** a schema decision, blocked behind Task 3.6.
**Expected result:** either add the columns after 3.6, or accept derived metadata at launch.
**Unblocks:** Task 4.2 (#358), Task 1.2 (#356).
**Priority:** **P2**

### HA-C16 — Headshots in the author spotlight: required, or accept initials?
**Do:** **The spotlight cannot render a headshot at all** — `FeaturedAuthor` in
`lib/data/authors.ts` has no `photo_url` field (only `DirectoryAuthor` and `AuthorDetail` do);
the card renders an initial letter.
**Why a human:** a product and brand decision, and adding the field is a code change #357 does
not own.
**Expected result:** either "headshots required at launch" (which needs a code change) or
"accept the initials fallback".
**Unblocks:** Task 4.5 (#357).
**Priority:** **P1**

### HA-C17 — Author links: launch with none, or wait for a schema change?
**Do:** **There is no author links field anywhere in the model.** "Approved links only" is
currently satisfiable only by having no links.
**Why a human:** adding one is a schema change, blocked until Task 3.6.
**Expected result:** either "launch with no author links" or "wait for a post-3.6 schema
change".
**Unblocks:** Task 4.5 (#357).
**Priority:** **P2**

### HA-C18 — Decide the accessibility colour change (A11Y-001)
**Do:** `text-secondary` resolves to `--secondary`, which is a **surface** token, not a text
token. Computed contrast: **1.37:1** on the dark page background, **1.00:1** inside a
`bg-muted` section, 1.09:1 in light — against a required 4.5:1. Dark is the default theme and
the product-detail hero is `bg-muted`, so **the author byline, the strikethrough price and the
"Also available at" heading are foreground on identical background.** 149 usages across 62
files, also covering audio timecodes and the checkout order summary. Separately **A11Y-002**:
the default `Button` is `#ffffff` on `#ef4343` at 14px/500 → 3.78:1; `--primary: 0 84% 48%`
would give 4.87:1.
**Why a human:** it is a brand and design decision. The fix touches 62 files, or one token plus
a rename — and no agent should pick a brand colour.
**Update (2026-07-29):** PR #362 now implements the token-layer option — new
`--text-secondary` and `--primary-strong` tokens with `text-secondary` repointed at the
former — plus the four `test.fixme()` → `test()` promotions. **This changes the rendered
colour of `text-secondary` site-wide (149 usages / 62 files), so it needs your design
sign-off before merge.** It also needs HA-A9 (branch refresh + `BookForm.tsx` conflict).
**Expected result:** a chosen fix, and the corresponding `test.fixme()` in
`tests/e2e/accessibility.spec.ts` flipped to `test()` as the regression guard. **This should be
resolved before launch, not after** — it is the difference between a low-vision reader being
able to see the price and author of a book and not.
**Unblocks:** Section H (#360), PR #362. **Gate G6** (truthful, usable public surfaces).
**Priority:** **P0**

---

## Group D — Content and copy approvals

### HA-D1 — Name the 3–6 launch titles and confirm rights
**Do:** Fill `docs/launch/LAUNCH_CATALOG.md`: title, author, publication status, rights, cover,
description, genre, price, ISBN, retailer links, EPUB, audio sample, inclusion decision. The
template enforces **exactly 3–6 launch-approved** titles.
**Why a human:** only you know which books launch and whether the rights are clear.
**Expected result:** 3–6 rows complete and signed, and the seed/QA removal table filled.
**Unblocks:** Task 4.1 (#351) — and everything downstream that has nothing to operate on
without it: Task 4.2 intake (#358), Task 5.5 communications (#357), Task 5.3's launch-book
checks (#355), Task 1.6's removal order (#353).
**Priority:** **P0**

### HA-D2 — Sign off every line of the rewritten marketing copy
**Do:** Review all 20 files in PR #354 — `/about`, `/blog` (now 404), `/contact`, `/faqs`,
`/help`, `/press`, `/cookies`, `/privacy`, `/discover/book-clubs`, the homepage hero and
metadata, the spotlights, the footer and both newsletter surfaces.
**Why a human:** **the PR itself states all copy needs your sign-off before merge.** It is also
the widest user-visible change in the programme (+514/−419 across nine public pages) and the
one with the weakest verification evidence — #354's body records no static check, no executed
assertions and no live probe. (Update 2026-07-29: its branch is now green through build —
run #901 — so it compiles and its unit tests pass; the words themselves still need you.)
**Expected result:** written approval, or line edits. Note what was deliberately **not**
changed: the "0 Books / 0 Authors" stat band and the genre tile counts were confirmed non-bugs
and left untouched.
**Unblocks:** Task 4.6 (#354). **Gate G6.**
**Priority:** **P0**

### HA-D3 — Resolve the six `TODO(renee):` placeholders in source
**Do:** (1) `app/(consumer)/about/page.tsx` — an optional "who we are" paragraph (founder,
location, start date). (2) `app/(consumer)/contact/page.tsx` — whether to commit to a stated
reply time. (3) `app/(consumer)/faqs/page.tsx` — a written refund policy (see HA-D4).
(4) `app/(consumer)/press/page.tsx` — real brand assets to host, and whether press gets a
dedicated address. (5) `app/(consumer)/cookies/page.tsx` — re-check if analytics or third-party
embeds are ever added. (6) `app/layout.tsx` — confirm `@mangupublishers` (see HA-B14).
**Why a human:** each is a company fact no agent may invent.
**Expected result:** six placeholders replaced or explicitly deleted.
**Unblocks:** Task 4.6 (#354).
**Priority:** **P1**

### HA-D4 — Write a refund policy for the Terms page
**Do:** #354 removed an **unbacked 14-day refund window** from `/faqs`. There is currently no
written refund policy anywhere.
**Why a human:** a commercial and legal commitment.
**Expected result:** a policy on the Terms page that `/faqs` can point at, consistent with what
the Stripe `charge.refunded` handler actually does.
**Unblocks:** Task 4.6 (#354). **Gates G4 and G6.**
**Priority:** **P1**

### HA-D5 — Reconcile the cover size limit: 2 MB or 5 MB?
**✅ DONE — 2026-07-29, resolved in favour of the enforced 5 MB.** The runbook was corrected
on `task/architecture-and-governance-docs`: it now states **"Maximum file size (enforced):
5 MB — uploads above this are rejected"** and **"Target file size (editorial): ≤ 2 MB —
house guideline, *not* enforced"**, with the same split repeated in the per-book signoff
template. Verified by this recorder in
[`docs/BOOK_PUBLISHING_RUNBOOK.md` on that branch](https://github.com/redinc23/my_publishing/blob/task/architecture-and-governance-docs/docs/BOOK_PUBLISHING_RUNBOOK.md)
(cover-spec table and §"Enforced ceiling vs editorial target"). The enforced source of truth
remains `file_size_limit = 5242880` in
`supabase/migrations/20260117000006_storage_policies.sql`, mirrored by
`UPLOAD_CONFIGS.cover`.
**Priority:** ~~P2~~ **DONE**

### HA-D6 — Attest that retailer link destinations are correct
**Do:** Open each retailer link for each launch book and confirm it reaches the right product
page.
**Why a human:** **nothing can machine-verify a retailer destination without networked CI.** It
stays a human attestation, recorded as `approval.retailer_links_opened` in the asset kit.
**Expected result:** every retailer link opened and attested, per book. Note: the retailer
buttons are the **primary purchase path at launch** — there is no on-site reader — so a wrong
link is a lost sale, not a cosmetic defect.
**Unblocks:** Task 4.2 (#358), Task 2.0b (#356).
**Priority:** **P1**

### HA-D7 — Decide whether the announcement email is sent at all
**Do:** Work through the send-condition block in `docs/launch/LAUNCH_COMMUNICATIONS.md` §2:
double opt-in completed · consent covers *this* kind of message · `RESEND_API_KEY` configured
and a test send verified · unsubscribe clicked and working.
**Why a human:** it is a consent decision with legal weight. **The provider is wired end to
end, which is precisely why this must be deliberate — the send button works.**
**Expected result:** every condition ticked and the email sent, or an explicit "not sending".
**Unblocks:** Task 5.5 (#357).
**Priority:** **P1**

### HA-D8 — Sign off all launch communications copy
**Do:** Approve the website announcement, announcement email, social posts, optional
press/partner note and internal launch note.
**Why a human:** **none of it is approved**, and every fact in it is a placeholder.
**Expected result:** approved copy with no `TODO(renee):` remaining.
**Unblocks:** Task 5.5 (#357).
**Priority:** **P1**

### HA-D9 — Supply the launch facts
**Do:** Launch date and window; launch titles and authors; retailers; and whether prices appear
in public copy.
**Why a human:** **no book title, author name, date, price, quote, endorsement or metric was
invented anywhere in this programme** — every one is a `TODO(renee):` placeholder, deliberately.
**Expected result:** every placeholder in `LAUNCH_COMMUNICATIONS.md` and `RELEASE_CHECKLIST.md`
replaced with a real value.
**Unblocks:** Task 5.5 (#357), Task 4.1 (#351).
**Priority:** **P0**

---

## Group E — QA only a human can perform

Everything in this group requires a real browser, a real account, or real money. CI cannot
sign off any of it — `docs/OPERATOR_QA_LOG.md` now states this explicitly (CCR-014).

### HA-E1 — Real signup, login failure and password reset on a preview
**Do:** Register a genuine account. Fail a login three ways: wrong password, rate-limited, and
limiter-unavailable if you can induce it. Request a password reset and complete it.
**Why a human:** it needs a real inbox and a real browser. **Playwright has never executed,
and the jest suites run in CI only under `USE_MOCKS='true'`**, so no automated evidence
covers the live auth path.
**Expected result:** no error message ever renders as `{}`, `[object Object]`, a stack trace, a
URL, a file path, a JWT or a key. "Too many attempts, try again in 15 minutes" (429) reads
differently from "temporarily unavailable" (503), and neither is confused with an invalid
password. A 429 carries `Retry-After` and does not claim an outage.
**Unblocks:** Tasks 1.8 and 1.9 (#352), Task 3.5 (#355). **Gate G3.**
**Priority:** **P0**

### HA-E2 — Fail-closed and forged-cookie manual QA
**Do:** In a preview deployment, unset `NEXT_PUBLIC_SUPABASE_URL`, then: `GET /admin/dashboard`,
`GET /api/files/x`, `GET /`, `GET /books`. Restore it. Signed in as a reader, run
`document.cookie = 'mangu-role=admin'` then visit `/admin`, `/author`, `/partner`. As a reader,
visit `/author/analytics` and `/author/projects`.
**Why a human:** it requires deliberately breaking an environment.
**Expected result:** 503 for `/admin/dashboard`; 503 with `{"error":"auth_unavailable"}` for
`/api/files/x`; **200 for `/` and `/books`** — an env misconfiguration must not black out the
site. The forged cookie grants nothing on all three portals. `/author/analytics` and
`/author/projects` both redirect to `/` — **before #352 they rendered.**
**Unblocks:** Task 1.5 (#352), Task 3.4 (#355). **Gate G5.**
**Priority:** **P0**

### HA-E3 — Verify the email verification deep link
**Do:** Register on a preview deployment and inspect the verification link in the email.
**Why a human:** it needs a real inbox.
**Expected result:** the link points at `NEXT_PUBLIC_SITE_URL`, **not the preview host** —
that is the fix for the host-header injection #352 removed.
**Unblocks:** Task 1.9 (#352). **Gate G3.**
**Priority:** **P0**

### HA-E4 — Produce evidence for gates G1–G11
**Do:** Fill `docs/launch/LAUNCH_GATE_EVIDENCE.md`. Then run the compiler
(`npx tsx scripts/compile-gate-evidence.ts`, or `npm run gates:compile` after HA-B15).
**Why a human:** every one of the eleven FALSE gates is human-gated — environment promotion,
live-backend QA, Stripe end-to-end verification, DNS cutover, legal approval. As
`docs/AGENT_EXECUTION_PACKET.md` §0 already recorded: *"The blocking work is not code. Adding
agent throughput does not move them."* **Eleven PRs later, that is still true.**
**Expected result:** the compiler currently reports **0/13 evidenced, 13 blockers, VERDICT
WITHHELD, exit 1**. It must report **GO, exit 0** — 13/13 PASSED, every evidence cell an
openable link at one release-candidate SHA, a real environment, and a named human approver.
Bot, CI and agent names are rejected on human gates; `WAIVED` is rejected outright;
`localhost`/`mock` environments are rejected on G3, G5 and G10.
**Unblocks:** Task 5.1 (#351 + #357). **All thirteen gates.**
**Priority:** **P0**

### HA-E5 — Fill manual QA rows 1–10
**Do:** Complete MQ-01 through MQ-10 in `docs/OPERATOR_QA_LOG.md` — test ID, RC SHA,
environment, tester, UTC date/time, preconditions, steps, expected, actual, PASS/FAIL, evidence
link, defect link.
**Why a human:** **CI cannot sign off any row (CCR-014).** #355 restructured the table because
it was *unfillable*, not merely unfilled — that is why issue #193 has stayed open.
**Expected result:** ten complete rows citing **one immutable release-candidate SHA**. If the
RC changes, the block is void and all ten re-run. A blank `Actual` next to a `PASS` is not
evidence; a partial block reports INCOMPLETE, never PASS.
**Unblocks:** Task 3.7 (#355), issue #193. **Gate G10.**
**Priority:** **P0**

### HA-E6 — Manual QA of the full admin publish round trip
**Do:** In a preview with `DATABASE_PROVIDER=mongodb`: (1) `/admin/books/new` → create a draft
with title, author, genre, description, price, cover and ≥1 retailer URL; confirm it does
**not** appear at `/books`. (2) Edit it — confirm every field round-trips and the edit form
loads a draft. (3) Attempt to publish with a required field missing. (4) Publish. (5) Unpublish.
(6) Republish. (7) Look for a "Start Reading" control anywhere.
**Why a human:** **this is the critical path of the entire programme and its acceptance test
has never executed.** #356 changes how every admin write reaches the database.
**Expected result:** (3) a field-level error with **no data loss**; (4) it appears at `/books`,
its PDP renders, "Also available at" shows **only** the retailer links you set, and the Audio
Sample tab appears **only** if a sample exists; (5) it disappears publicly and `published_at`
is **retained**; (6) the original publication date is **not restamped**; (7) **no "Start
Reading" control exists** (see HA-A6).
**Unblocks:** Tasks 1.0, 2.0b, 2.1, 2.2, 2.3, 2.4 (#356), Task 1.7 (#352). **Gate G6.**
**Priority:** **P0**

### HA-E7 — Run the seed audit dry run and read the report
**Do:** `npm run catalog:seed-audit`.
**Why a human:** it needs live credentials, and the decision that follows is yours.
**Expected result:** *"DRY RUN (default) — no records were modified."* plus before/after counts
across both providers. Confirm `npm run catalog:seed-audit -- --execute` **refuses** with
`REFUSED: --execute requires --confirm=CONFIRM-…`. **Do not execute anything** until HA-C8 and
HA-D1 are settled — removing the seed records empties the public catalog.
**Unblocks:** Task 1.6 (#353).
**Priority:** **P1**

### HA-E8 — Run one full crawl against the release candidate
**Do:** `npx tsx scripts/crawl-regression.ts --base-url <rc-url>` (or `npm run qa:crawl` after
HA-B16), then complete the **critical manual route checklist** the report emits — homepage,
catalog, each discovered launch book, each active genre page, audio catalog, `/audio/<id>`,
login, register, password reset, checkout success `?success=true` and cancel `?canceled=true`,
library, admin-denial-as-non-admin, and 404.
**Why a human:** **the harness has never been run**, and the checklist rows are for a human by
design — the crawler narrows what a human must check, it never replaces the human.
**Expected result:** exit **0** (no P0/P1). Exit **1** means a public 5xx, an unreachable
launch-book path, a canonical pointing off the canonical host, the sibling host serving 200
instead of redirecting, or a 200 page that rendered an error marker. Exit **2** means the
harness could not run — deliberately distinct from 1, so "we did not check" is never reported
as "we checked and it passed".
**Unblocks:** Task 5.3 (#355). **Gates G1 and G6.**
**Priority:** **P0**

### HA-E9 — Rehearse a rollback and record the transcript
**Do:** Perform a real Vercel Instant Rollback / promote against the known-good target from
HA-A4, and record the transcript and revision id.
**Why a human:** it changes what production serves. Before doing it, work through the
**database-compatibility check** in `docs/launch/RELEASE_CHECKLIST.md` — including the data
effects of #356 that **survive a revert** (books published through the admin UI while it was
live remain Mongo documents with `visibility:'public'`) and Stripe endpoint compatibility
across #352's 410 change.
**Why it matters:** a runbook nobody has rehearsed is a document, not a capability.
**Expected result:** a successful rehearsal, a transcript, and a revision id recorded.
**Unblocks:** Task 5.4 (#353), Task 5.5 (#357). **Gate G11.**
**Priority:** **P0**

### HA-E10 — Fill the browser and device matrix
**Do:** Complete `docs/operations/BROWSER_MATRIX.md` — Chrome / Edge / Safari-WebKit / Firefox
× six device classes (1440, 1280, 390 iPhone-class, 412 and 360 Android, 820 tablet) × six
surfaces.
**Why a human:** **`playwright.config.ts` runs chromium only in CI and no project uses a mobile
viewport, so this matrix is currently the launch's only Firefox, WebKit and mobile coverage.**
It ships with blank pass/fail cells.
**Expected result:** every blocking cell filled. Pay particular attention to audio: MP3 is the
safe baseline; Firefox delegates AAC to a platform decoder so `.m4a` needs verifying per-OS;
`audio/x-m4a` is non-standard and the CDN's served `Content-Type` should be checked;
`preload="metadata"` means duration can be unknown on mobile Safari; and Safari is strict about
HTTP range requests.
**Unblocks:** Section H (#360). **Gate G6.**
**Priority:** **P1**

### HA-E11 — Complete one real Stripe purchase, fulfilment and refund
**Do:** Buy a book end to end with a real card, confirm the order row, the entitlement and the
library appearance, then refund it and confirm the reversal.
**Why a human:** it moves money. No agent may do it, and no automated test in this repository
covers the live path.
**Expected result:** a signed webhook delivers 2xx; an order row is created; the entitlement
grants library access; `charge.refunded` reverses it. Confirm idempotency by replaying an
event id — `checkIdempotency()` against `webhook_events` should short-circuit with "Event
already processed". Confirm `POST /api/webhook` unsigned returns **400** and
`POST /api/webhooks/stripe` returns **410** naming the canonical path.
**Unblocks:** Task 1.4 (#352), issue #205 (P0-010). **Gates G4 and G8.**
**Priority:** **P0**

---

## Appendix — coverage map

Every "Needs Renee" item across the programme PRs, and where it landed here.

| PR | Its asks | Consolidated as |
| --- | --- | --- |
| #350 | run type-check/build locally; run the cleanup script; service-role key and Upstash env in prod | HA-A1, HA-B19 |
| #351 | ADR numbering; ADR sign-off; `published-epubs` public; lifecycle/runbook/DoLC open items | HA-C6, HA-A5, HA-C2, HA-D5 |
| #352 | Stripe endpoint URL, signing secret, event list; sign-in password exception; retarget | HA-B7, HA-B8, HA-B9, HA-C9, HA-A8 |
| #353 | monitor prompt; alert recipients; rotation dry run; seed removal order; env matrix | HA-B4, HA-B5, HA-B6, HA-C8, HA-B18 |
| #354 | copy sign-off; six `TODO(renee):`; refund policy; social handles | HA-D2, HA-D3, HA-D4, HA-B14 |
| #355 | portal index-vs-redirect; partner export for admins; QA rows; `TEST_*` secrets; limiter target; where specs run; `qa:crawl` alias; retarget | HA-C10, HA-C11, HA-E5, HA-B10, HA-B12, HA-B11, HA-B16, HA-A8 |
| #356 | backfill approval; `published-epubs`; audio bucket; `subtitle`; manual QA; retarget | HA-C5, HA-C2, HA-C3, HA-C1, HA-E6, HA-A8 |
| #357 | launch/incident owner; launch facts; email consent; social accounts; rollback target; Stripe host; author links; headshots; seed removal; copy sign-off; retarget; `gates:compile` | HA-B17, HA-D9, HA-D7, HA-B14, HA-A4, HA-C7, HA-C17, HA-C16, HA-C8, HA-D8, HA-A8, HA-B15 |
| #358 | audio hosting; `short_description`; cover alt text; SEO columns; retailer attestation; author id pass | HA-C3, HA-C13, HA-C14, HA-C15, HA-D6, HA-D1 |
| #359 | hosted export; PLAN A/B; corrective migration approval; backup; 13 columns; `SECURITY DEFINER`; backfill; bucket escalation | HA-B1, HA-B2, HA-A7, HA-B3, HA-C4, HA-C12, HA-C5, HA-B13 |
| #360 | A11Y-001 decision; `@axe-core/playwright`; browser matrix | HA-C18, HA-B20, HA-E10 |
| #362 | contrast-token design sign-off; branch refresh + `BookForm.tsx` conflict | HA-C18, HA-A9 |
| — | found by this recorder | HA-A1, HA-A2, HA-A3, HA-A6, HA-A9, HA-B21, HA-B22, HA-D5, HA-E11 |
