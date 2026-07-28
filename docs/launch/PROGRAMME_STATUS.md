# Programme Status — MANGU Publishers launch

**Compiled:** 2026-07-28 · **Compiled at base:** `audit/2026-07-28-fixes` @ `23e50c1`
**Scope:** the eleven open PRs #350–#360 of the parallel execution programme.
**Authority:** this document is *not* a launch authority. `docs/NEXT_GO.md` rules launch and
gates G1–G13. This document records what the programme produced and how far it has been
verified. Where a claim could not be confirmed it is marked **UNCONFIRMED** and attributed.

---

## 1. The one status fact that matters

**Every one of the eleven branches fails CI at `npm test`, and `npm run build` never runs
on any of them.**

Verified against the GitHub Actions API on 2026-07-28. Runs #881–#891, one per branch:

| Run | Branch | `type-check` | `lint` | `npm test` | `npm run build` |
| --- | --- | --- | --- | --- | --- |
| 881 | `audit/2026-07-28-fixes` (#350) | success | success | **failure** | **skipped** |
| 882 | `task/phase1-catalog-data-path` (#356) | success | success | **failure** | **skipped** |
| 883 | `task/phase1-auth-security` (#352) | success | success | **failure** | **skipped** |
| 884 | `task/ops-monitoring-and-launch-tooling` (#353) | success | success | **failure** | **skipped** |
| 885 | `task/architecture-and-governance-docs` (#351) | success | success | **failure** | **skipped** |
| 886 | `task/4.6-marketing-truthfulness` (#354) | success | success | **failure** | **skipped** |
| 887 | `task/qa-automation-and-crawl-regression` (#355) | success | success | **failure** | **skipped** |
| 888 | `task/5.1-5.5-launch-readiness` (#357) | success | success | **failure** | **skipped** |
| 889 | `task/4.2-content-intake-pipeline` (#358) | success | success | **failure** | **skipped** |
| 890 | `task/3.6-migration-drift-and-backfill` (#359) | success | success | **failure** | **skipped** |
| 891 | `task/accessibility-and-browser-matrix` (#360) | success | success | **failure** | **skipped** |

`npm run build` is the step *after* `npm test` in `.github/workflows/ci.yml`. Because
`npm test` fails, the build step is skipped on all eleven. **`next build` has not been
executed against any branch in this programme.** Nothing in these eleven PRs is known to
compile into a deployable application.

### Why CI runs at all now

Until `.github/workflows/ci.yml` was changed to accept `audit/**` and `task/**` as pull
request base branches, **no stacked PR had any checks whatsoever** — every branch in this
programme was unverified and reported "no checks for this commit". That change is present
and byte-identical on all eleven branches (`ci.yml` md5 `1376e91f` on every one), which is
why runs #881–#891 exist. CI running and reporting red is a strict improvement over CI not
running; it is not a regression.

### Where the red comes from — corrected

The brief for this document stated the base branch was *"already failing before this
programme began, so the red is inherited, not introduced."* That is **half right and worth
correcting**, because the correction points at a single fixable cause.

- `main` is **green**. Run #875, `push` event, `7effd55` — the current tip of `main` —
  conclusion `success`.
- `audit/2026-07-28-fixes` was **green** at four successive commits: runs #876 (`559fda5`),
  #877 (`9476728`), #878 (`efc060b`), #879 (`8055b74`).
- It turned **red** at run #880, commit `8e6fa50` — `fix(catalog): make public book lookup
  duplicate-slug proof`. That commit is part of PR #350 itself. It touches exactly one file,
  `lib/data/books.ts`, +14/−6.
- **All ten stacked task branches fork from `8e6fa50`.** They therefore inherit a red base
  and none of them introduced it.

So the accurate statement is: **the red is inherited by the ten stacked PRs and introduced
by PR #350's own final content commit.** It is not a pre-existing condition of `main`.

**Working hypothesis for the failure — UNCONFIRMED.** `8e6fa50` replaces `.maybeSingle()`
with `.order('published_at').limit(1)` on three query paths in `lib/data/books.ts`
(`fetchBookForApi` primary, `fetchBookForApi` service-role fallback, and
`fetchPublishedBookForCheckout`). The Supabase mocks in the unit suite still model
`.maybeSingle()`: `tests/unit/data-catalog-dual-run.test.ts` mocks
`@/lib/supabase/server` as `select().eq().maybeSingle()` with no `.order`/`.limit` on the
chain, and its public-catalog chain is thenable to `{ data: [], error: null }`, so the new
code takes the fallback path and calls a method the mock does not define. Six other unit
specs mock `@/lib/supabase/server` with `maybeSingle` and no `order`
(`admin-portal-hardening`, `api-route-hardening`, `audio-progress-route`, `reviews-api`,
and two others). **This is inference from reading the diff and the mocks. Jest was not run
by the compiler of this document, and GitHub Actions logs for this repository are not
readable without an authenticated token, so the failing spec names could not be retrieved.**
Whoever fixes this should open run #881's log first and confirm before acting.

**Implication for the merge plan:** one fix, in PR #350, plausibly clears all eleven red
runs. Nothing else in the programme should be merged until that is proven.

---

## 2. Verified branch topology

Every base below was read from the GitHub API and confirmed against a clone.

| PR | Head branch | Head SHA | **Actual git base** | Forked at |
| --- | --- | --- | --- | --- |
| #350 | `audit/2026-07-28-fixes` | `23e50c1` | **`main`** | — |
| #351 | `task/architecture-and-governance-docs` | `5080fad` | `audit/2026-07-28-fixes` | `8e6fa50` |
| #352 | `task/phase1-auth-security` | `6f56089` | `audit/2026-07-28-fixes` | `8e6fa50` |
| #353 | `task/ops-monitoring-and-launch-tooling` | `7ec644e` | `audit/2026-07-28-fixes` | `8e6fa50` |
| #354 | `task/4.6-marketing-truthfulness` | `6d99621` | `audit/2026-07-28-fixes` | `8e6fa50` |
| #355 | `task/qa-automation-and-crawl-regression` | `3733af8` | `audit/2026-07-28-fixes` | `8e6fa50` |
| #356 | `task/phase1-catalog-data-path` | `00c6758` | `audit/2026-07-28-fixes` | `8e6fa50` |
| #357 | `task/5.1-5.5-launch-readiness` | `4b4b058` | `audit/2026-07-28-fixes` | `8e6fa50` |
| #358 | `task/4.2-content-intake-pipeline` | `72bead2` | **`task/phase1-catalog-data-path`** | `a43cea0` |
| #359 | `task/3.6-migration-drift-and-backfill` | `69ed6f4` | `audit/2026-07-28-fixes` | `8e6fa50` |
| #360 | `task/accessibility-and-browser-matrix` | `c5e44a0` | **`task/phase1-catalog-data-path`** | `a43cea0` |

### Two topology findings

1. **All ten stacked branches forked at `8e6fa50`, one commit behind
   `audit/2026-07-28-fixes`'s tip `23e50c1`.** The only commit they are missing is the
   `ci.yml` change — and each branch carries its own byte-identical copy of that change, so
   no content is actually absent and the `ci.yml` hunk should merge without conflict.
2. **#358 and #360 forked from `task/phase1-catalog-data-path` at `a43cea0`, seven commits
   behind its tip `00c6758`.** The seven include four substantive fixes to the admin write
   path (`fix(books): stamp featured_at with is_featured on the Mongo write path`,
   `fix(books): stop the admin actions silently dropping form fields`, `fix(admin): stop the
   form posting a publication date nothing accepts`) and three test-pinning commits. **#358
   and #360 must be updated from #356 before merge**, or they will be reviewed against a
   version of the admin form that no longer exists. This is a real gap, not a labelling
   detail.

### Verified merge order

Derived from the actual bases above, and consistent with the analysis in PR #357 §1 of
`docs/launch/RELEASE_CHECKLIST.md`:

```
#350                                    (base: main — must land first, and must go green first)
 ├─ #351  docs only
 ├─ #356  CRITICAL PATH — the data-path fix
 │   ├─ #358   (must be updated from #356 first)
 │   └─ #360   (must be updated from #356 first)
 ├─ #352
 ├─ #354
 ├─ #353
 ├─ #357
 ├─ #355
 └─ #359      (base is #350, not #356 — may land any time after #350)
```

Recommended sequence: **#350 → #351 → #356 → #352 → #354 → #353 → #357 → #355**, with
**#359** anywhere after #350 and **#358 / #360** after #356 *and after being brought up to
`00c6758`*. #355 is deliberately last: its RBAC matrix asserts #352's hardened contract and
its crawl expectations assume #354's copy and #356's catalog.

Eight PRs (#351, #352, #353, #354, #355, #356, #357, #359) currently target
`audit/2026-07-28-fixes`. Each must be retargeted to `main` the moment #350 merges, or it
will silently become unmergeable.

---

## 3. What each PR delivers, and how far it is verified

Verification vocabulary used below, consistently:

- **Statically checked** — a standalone TypeScript compiler ran over the changed files and
  reported no syntax errors. Module resolution errors were expected and excluded because
  `node_modules` was not installed.
- **Executed under `node` against fakes** — the agent compiled a module and ran assertions
  against hand-built stubs, outside jest.
- **Not executed** — jest and Playwright. **No agent in this programme ran either suite.**
- **CI** — runs #881–#891, red at `npm test`, build skipped.

### #350 — Audit fixes *(base: `main`)*

Auth-page SSR via `<Suspense>` on `/login` and `/reset-password/confirm`; the public
draft-book leak closed (`fetchBookForApi` now filters `status='published' AND
visibility='public'` on both providers); a service-role→RLS fallback so book detail pages
render; auth callback honours a sanitised `?next=`; retailer buttons on the PDP; a cleanup
script and manifest. 12 files, +308/−65.

**Verification:** authored via the GitHub API with no local build — the PR body says so
itself and asks for `npm run type-check && npm run build` locally before merge. CI:
type-check and lint green, **`npm test` red**, build skipped. **This PR is the source of the
programme-wide red.** The cleanup script has not been run; the API cannot delete files, so
the ~5.5 MB of obsolete artifacts is still in the tree.

**Genuinely done:** nothing, until the test failure it introduced is fixed.

### #351 — Architecture and governance docs

Eight Markdown files: ADR-001 (catalog and identity data ownership), the data ownership
matrix, seventeen schema-drift dispositions, the book lifecycle, the publishing runbook, the
launch catalog template, the launch gate evidence template, and the definition of launch
complete. No code, no schema, no workflow file.

**Verification:** the agent reports an automated pass confirming all 86 cited source paths
resolve at `8e6fa50` — **UNCONFIRMED by this recorder** (not re-run). Documentation cannot
be "tested"; its correctness is a review activity. CI red for the inherited reason only.

**Genuinely done:** the writing. Not the review, and not the decisions it defers — ADR-001
collides with the already-ACCEPTED `docs/adr/ADR-001-canonical-platform.md`, so two live
ADR-001s exist and the numbering needs Renee.

### #352 — Phase 1 auth and security

28 files, +1326/−229. `/register` SSR investigated and found already correct (no code
change); Stripe webhook duplicate route replaced with a documented 410 Gone; middleware
fails closed on missing Supabase env and no longer reads the unsigned `mangu-role` cookie
for authorization; new `/author` and `/partner` layout gates closing a real gap on
`/author/analytics` and `/author/projects/*`; login error normalisation and redaction; one
password policy at 8 characters; host-header injection removed from auth deep links;
registration profile-creation failure surfaced instead of swallowed.

**Verification:** 27 changed files statically checked, zero syntax errors. A live production
probe of `/register` returned 200 with full server-rendered markup — that is real evidence
for Task 1.3. Four new unit test files with 61 assertions were **written but never run**.
CI red.

**Genuinely done:** Task 1.3 (evidenced by a live probe, and it required no change). Everything
else is written and unverified.

### #353 — Ops, monitoring and launch tooling

14 files, +3003/−6. Health monitor with six checks including `/login` server render and
Supabase `/auth/v1/health`; the hardcoded Supabase project ref removed from
`rotate-supabase-key.yml` and the service-role rotation gap made loud; a dry-run-only
duplicate/seed audit with a two-gate execution guard; incident response runbook; environment
matrix (variable names only, zero values); report-only SEO checker; three `package.json`
script aliases.

**Verification:** the strongest evidence in the programme. `tsc --strict` clean on all six
new scripts; 67 unit assertions executed against a compatible harness outside jest;
`health:check` **run live against production** — 5/5 green, exit 0; simulated-failure and
NXDOMAIN paths exercised; `seo:check` run live — 0 errors, 2 warnings. `catalog-seed-audit`
was **not** executed (needs live credentials). Jest itself not run. CI red.

**Genuinely done:** the health and SEO checks are demonstrably working tools. The seed audit
is unexercised.

### #354 — Marketing truthfulness

20 files, +514/−419. Removed claims of on-site reading, mobile apps, cookie consent
controls, a blog, a press kit and streaming across `/about`, `/blog` (now 404), `/contact`,
`/faqs`, `/help`, `/press`, `/cookies`, `/privacy`, `/discover/book-clubs`, the homepage hero
and metadata, the spotlights, the footer and the newsletter surfaces. App-store badges,
footer blog link, dead language selector and PayPal badge removed.

**Verification:** the PR body records **no** verification section at all — no static check, no
executed assertions, no live probe. Two unit test files were updated but not run. CI red.
Weakest evidence position of the eleven, and it is the PR that changes the most user-visible
surface. **All copy needs Renee's sign-off before merge**, per the PR itself.

**Genuinely done:** nothing verified. Six `TODO(renee):` placeholders remain in source.

### #355 — QA automation and crawl regression

6 files, +2118/−106. RBAC matrix E2E across five roles and every portal surface including
forged-cookie negatives; rate-limit and abuse E2E asserting truthfulness of 429 vs 503; a
full-crawl regression harness with runtime discovery and nothing hardcoded; the operator QA
log rows 1–10 restructured so they are fillable at all.

**Verification:** four new files statically checked clean. This caught one real defect
(TS2454 on an origin variable, fixed). **Playwright was not run — the specs have never
executed against a browser.** CI red, and `ci.yml` has no Playwright job at all, so these
specs are not run by CI either.

**Genuinely done:** the QA log is now fillable, which is a real unblock for issue #193. The
specs are unexecuted code.

### #356 — CRITICAL PATH: admin writes reach the database the site reads

The most consequential PR in the programme. Fixes the defect where `createBookAdmin`,
`updateBookAdmin` and `updateBookStatusAction` wrote to Supabase unconditionally while
production catalog reads run on MongoDB — meaning **a book published through the admin UI
could never appear on the public site**. Admin writes and admin reads are now provider-aware
via the existing `isMongoPrimary()`. Visibility is derived from status. Mongo gained field
parity for the six retailer URLs, audio, EPUB, trailer, ISBN and featured flags, so the
retailer buttons from #350 and the audio tab can render at all. Seventeen schema-drift items
dispositioned code-side. `published_at` is no longer destroyed by unpublish. Audit writes
consolidated onto `recordAudit` and no longer swallowed. A real admin publishing pipeline
with one shared validation rule set.

**Verification:** every changed file statically checked, syntax clean; one agent additionally
compiled and executed the Mongo write helpers against a fake `Db`. **~70 unit cases added
and not one was run.** The PR body states plainly: *"The jest and Playwright suites were NOT
executed locally… do not merge until `validate:gap-ledger`, `type-check`, `lint`, `test` and
`build` are green."* CI red, build skipped.

**Genuinely done:** nothing is proven. The headline acceptance test — create draft → invisible
→ publish → visible → unpublish → invisible, `published_at` survives — is the single most
important assertion in the programme and **it has never executed**.

### #357 — Launch readiness

One offline script and three documents: the gate evidence compiler (which refuses to report
readiness at all when evidence is incomplete, printing `VERDICT WITHHELD` rather than
`NO-GO`), the release checklist with eight rollback triggers and a rollback procedure, the
launch communications drafts, and the author profile spec.

**Verification:** `tsc --noEmit --strict` clean on the compiler; it was **compiled and run**
against the real evidence template from #351's branch (0/13 evidenced, exit 1 — correct for
an empty template), against a doctored copy exercising every failure path, and against a
missing file (exit 2). One real defect was found by running it and fixed. Jest and Playwright
not run. CI red.

**Genuinely done:** the compiler demonstrably works. The three documents are drafts awaiting
Renee's facts — every name, date, title and price is a `TODO(renee):` placeholder.

### #358 — Content intake pipeline *(base: #356, seven commits stale)*

Asset-kit spec, a copyable template, a rule engine that maps a kit onto
`AdminBookFormValues` and calls `validateAdminBook` **unchanged** rather than restating admin
rules, a CLI validator, and unit tests. 35 blockers and 16 warnings, each cited to the file
it came from.

**Verification:** full `tsc` clean; the rule engine compiled and executed against **101
assertions**, 101 passed; the CLI run end-to-end across five scenarios. Jest not run. CI red.
**Base is stale** — see §2 finding 2.

**Genuinely done:** the validator works in the author's hands. It has never been run against
a real asset kit because none exists.

### #359 — Migration drift and backfill *(analysis only)*

Deliberately writes no migration. A read-only SQL export set for an operator with database
access, an offline drift classifier, the reconciliation procedure with a PLAN A / PLAN B
decision tree, a read-only Supabase-vs-Mongo backfill dry run with **no execute mode**, and
the backfill plan.

**Verification:** classifier typechecks clean under `tsc --strict`; compiled and executed
**27/27 assertions** including the real 40-file repository inventory. Jest not run. CI red.

**Genuinely done:** the machinery to understand the drift. **Nothing about the hosted
database is known.** The PR is explicit that everything hosted is UNVERIFIED and that nobody
on the task has or sought credentials. This is the correct outcome — it is also why no
migration can be written anywhere in this programme.

### #360 — Accessibility and browser matrix *(base: #356, seven commits stale)*

Three new files, 2138 insertions, **no application code modified**. A 940-line Playwright
accessibility spec, an 889-line audit with nineteen findings, and a browser/device matrix.

**Headline finding:** `text-secondary` resolves to `--secondary`, a *surface* token, not a
text token. Computed contrast is 1.37:1 on the dark page background, **1.00:1 inside a
`bg-muted` section** — foreground on identical background. Dark is the default theme and the
product-detail hero is `bg-muted`, so the author byline, the strikethrough price and the
"Also available at" heading are invisible to a low-vision reader. 149 usages across 62 files.

**Verification:** `tsc --strict --noEmit` clean on the spec. **Playwright never executed and
no browser ever rendered these pages** — the PR says so in a section titled "I could not run
these specs" and asks that its findings be read as "verified by reading the code", not
"observed". Seven known defects are encoded as `test.fixme()` so CI stays green when it
eventually runs them. CI red. **Base is stale** — see §2 finding 2.

**Genuinely done:** the audit is a credible reading of the code. No accessibility fix has
been made anywhere in the programme.

---

## 4. Task status table

**A task is COMPLETE only when implementation, tests, documentation and evidence all pass.**
Since no branch has a green suite, nothing in this programme is COMPLETE. Statuses below say
so rather than flattering the work.

Status vocabulary:

| Status | Means |
| --- | --- |
| `COMPLETE` | Implementation, tests, docs and evidence all pass. **Zero tasks qualify.** |
| `READY_FOR_REVIEW` | Work is written and pushed; CI is red or unrun; a human must review and CI must go green. |
| `READY_FOR_HUMAN_ACTION` | The remaining work cannot be done by an agent — a decision, an approval, a credential or a manual test. |
| `BLOCKED_EXTERNAL` | Blocked on a system outside this repository (Supabase console, Vercel, Stripe, DNS). |
| `NOT_STARTED` | No PR in this programme carries it. |

### Phase 0 — Stabilise

| Task | Description | Status | PR |
| --- | --- | --- | --- |
| 0.4 | Health monitor auth + Supabase checks | `READY_FOR_HUMAN_ACTION` | #353 |
| 0.7 | Key-rotation workflow truthfulness | `READY_FOR_REVIEW` | #353 |
| 0.1–0.3, 0.5, 0.6 | Not claimed by any PR in this programme | `NOT_STARTED` | — |

Task 0.4 is `READY_FOR_HUMAN_ACTION` rather than `READY_FOR_REVIEW` because the monitor it
extends is **not in this repository** — it is a Cowork scheduled task on Renee's machine at
`mangu-site-health-check`, which no agent can write. The code is reviewable; applying it is
not an agent action.

### Phase 1 — Platform integrity

| Task | Description | Status | PR |
| --- | --- | --- | --- |
| **1.0** | **Dual-database write/read split — admin writes reach the read database** | `READY_FOR_REVIEW` | **#356** |
| 1.1 | ADR-001, data ownership matrix, drift dispositions (documented) | `READY_FOR_REVIEW` | #351 |
| **1.2** | **Schema reconciliation — 17 drift items dispositioned code-side** | `READY_FOR_REVIEW` | #356 (+#351 docs) |
| 1.3 | `/register` SSR | `READY_FOR_REVIEW` | #352 |
| 1.4 | Stripe webhook route consolidation | `READY_FOR_HUMAN_ACTION` | #352 |
| 1.5 | Server-trusted RBAC + fail-closed middleware | `READY_FOR_REVIEW` | #352 |
| 1.6 | Duplicate / seed identification (dry run only) | `READY_FOR_HUMAN_ACTION` | #353 |
| 1.7 | Hide nonfunctional reading controls | `READY_FOR_REVIEW` | #352 + #356 |
| 1.8 | Normalise login error rendering | `READY_FOR_REVIEW` | #352 |
| 1.9 | Unify password policy + safe verification deep links (incl. A.6) | `READY_FOR_REVIEW` | #352 |

Notes. **1.0 and 1.2 are the critical path** and both are unverified — the round-trip
acceptance test has never executed. **1.3** is the closest thing in the programme to a
finished task: the investigation found no defect, no code changed, and a live production
probe of `/register` returned 200 with full server-rendered markup and the server-generated
`<title>`. It is still `READY_FOR_REVIEW` and not `COMPLETE` because the branch carrying that
finding cannot merge while CI is red. **1.4** needs Renee to confirm the Stripe dashboard
endpoint — if the dashboard points at `/api/webhooks/stripe`, deliveries start failing with
410 the moment #352 deploys. **1.6** is dry-run only and must stay that way: production's
catalog is currently 100% seed data (three books, both authors on the known seed list), so
running the cleanup empties the public catalog. **1.7** is split — #352 replaced the fake
reader and repointed every in-app link, but the PDP "Start Reading" button lives in a file
#352 does not own; #356 owns that file. Confirm the button is gone before calling 1.7 done.

### Phase 2 — Admin publishing pipeline

| Task | Description | Status | PR |
| --- | --- | --- | --- |
| 2.0 | Book lifecycle definition | `READY_FOR_REVIEW` | #351 (+#356 code) |
| **2.0b** | **Mongo catalog field parity — retailer, audio, EPUB, trailer, ISBN, featured** | `READY_FOR_REVIEW` | **#356** |
| 2.1 | Admin book create/edit form | `READY_FOR_REVIEW` | #356 |
| 2.2 | Cover / EPUB / audio asset panel | `READY_FOR_REVIEW` | #356 |
| 2.3 | Publish blockers and warnings (one shared rule set) | `READY_FOR_REVIEW` | #356 |
| 2.4 | Status transitions incl. unpublish confirmation | `READY_FOR_REVIEW` | #356 |
| 2.5 | Not claimed by any PR in this programme | `NOT_STARTED` | — |
| 2.6 | Book publishing runbook | `READY_FOR_REVIEW` | #351 |

**2.0b was a blocker**: before it, `fetchBookForApi`'s Mongo branch hardcoded `audio_url:
null` and `trailer_vimeo_id: null` and omitted all six retailer fields, `listAudiobooks()`
returned `[]` and `fetchAudiobookById()` returned `null`. The retailer buttons #350 shipped
and the PDP audio tab **could not render in production** and `/audio` was permanently empty.
The fix is written and unverified.

### Phase 3 — Auth and commerce QA

| Task | Description | Status | PR |
| --- | --- | --- | --- |
| 3.1 | Profile-creation failure recovery | `NOT_STARTED` | — (fed by #352 A.6) |
| 3.2, 3.3 | Not claimed by any PR in this programme | `NOT_STARTED` | — |
| 3.4 | RBAC verification matrix (E2E) | `READY_FOR_HUMAN_ACTION` | #355 |
| 3.5 | Rate-limit / abuse behaviour (E2E) | `READY_FOR_HUMAN_ACTION` | #355 |
| **3.6** | **Hosted migration drift reconciliation + backfill** | `BLOCKED_EXTERNAL` | #359 |
| 3.7 | Operator QA log rows 1–10 made fillable | `READY_FOR_HUMAN_ACTION` | #355 |

3.4 and 3.5 are `READY_FOR_HUMAN_ACTION` because the specs **skip** without
`TEST_{READER,AUTHOR,PARTNER,ADMIN}_EMAIL` / `_PASSWORD` repository secrets, which only
Renee can create, and because `ci.yml` has no Playwright job to run them in. 3.6 is
`BLOCKED_EXTERNAL` — the analysis is complete and correct; the hosted export requires SQL
access nobody on this programme has or sought. **Until 3.6 completes, no Supabase migration
may be written anywhere.** None was, in any of the eleven PRs — verified.

### Phase 4 — Real content

| Task | Description | Status | PR |
| --- | --- | --- | --- |
| 4.1 | Launch catalog template | `READY_FOR_HUMAN_ACTION` | #351 |
| 4.2 | Book asset-kit spec + intake validator | `READY_FOR_REVIEW` | #358 |
| 4.3, 4.4 | Not claimed by any PR in this programme | `NOT_STARTED` | — |
| 4.5 | Author profile spec | `READY_FOR_HUMAN_ACTION` | #357 |
| 4.6 | Marketing page truthfulness | `READY_FOR_HUMAN_ACTION` | #354 |

4.1 is a complete but **empty** template — it needs 3–6 real launch titles, which do not
exist. 4.6 is `READY_FOR_HUMAN_ACTION` because every line of the rewritten copy needs Renee's
sign-off before merge, per the PR itself, and six `TODO(renee):` placeholders sit in the
source.

### Phase 5 — Release

| Task | Description | Status | PR |
| --- | --- | --- | --- |
| 5.1 | Launch gate evidence template + compiler | `READY_FOR_HUMAN_ACTION` | #351 + #357 |
| 5.2 | SEO checks (preparation) | `READY_FOR_REVIEW` | #353 |
| 5.3 | Full-crawl regression harness | `READY_FOR_REVIEW` | #355 |
| 5.4 | Monitoring and incident readiness | `READY_FOR_HUMAN_ACTION` | #353 |
| 5.5 | Release checklist + launch communications | `READY_FOR_HUMAN_ACTION` | #357 |

5.1's compiler currently reports **0 of 13 gates evidenced, 13 blockers, `VERDICT
WITHHELD`** against the real template — correct, and the honest number. 5.4 needs the alert
recipient table filled; it ships with explicit `_TBD_` placeholders.

### Cross-cutting sections

| Section | Description | Status | PR |
| --- | --- | --- | --- |
| G | Environment matrix (variable names only, zero values) | `BLOCKED_EXTERNAL` | #353 |
| H | Accessibility audit + browser/device matrix | `READY_FOR_HUMAN_ACTION` | #360 |
| A.6 | Registration profile-creation failure surfaced | `READY_FOR_REVIEW` | #352 |
| — | Programme evidence packet + human action list | `READY_FOR_REVIEW` | this PR |

Section G is `BLOCKED_EXTERNAL`: the matrix honestly marks production variable presence as
**NOT VERIFIED**, because confirming it requires the Vercel dashboard. Section H is
`READY_FOR_HUMAN_ACTION` because its critical finding (A11Y-001) needs a design decision
before anyone can implement it, and no accessibility fix exists yet in any PR.

### Roll-up

| Status | Count |
| --- | --- |
| `COMPLETE` | **0** |
| `READY_FOR_REVIEW` | 20 |
| `READY_FOR_HUMAN_ACTION` | 14 |
| `BLOCKED_EXTERNAL` | 2 |
| `NOT_STARTED` | 5 groups (0.1–0.3, 0.5, 0.6, 2.5, 3.1, 3.2–3.3, 4.3–4.4) |

---

## 5. Governance gates — verified

Read directly from `docs/NEXT_GO.md` §6, lines 159–171, on `audit/2026-07-28-fixes`:

| Gate | State |
| --- | --- |
| G1 origin/main deployment READY | **FALSE** |
| G2 CI green on exact release SHA | **FALSE** |
| G3 Phase 7A auth evidence complete | **FALSE** |
| G4 Stripe purchase → order → library → reading | **FALSE** |
| G5 RBAC smokes pass | **FALSE** |
| G6 No false-success public forms/claims | **FALSE** |
| G7 Production readiness passes | **FALSE** |
| G8 Production webhook registered + test event | **FALSE** |
| G9 ADR signed; monitors hit real production | **FALSE** |
| G10 Manual QA rows 1–10 complete with dates | **FALSE** |
| G11 Known-good revision recorded; rollback traceable | **FALSE** |
| G12 Master baseline refreshed with release SHA | **PARTIAL** — refreshed to `16dc1d7` (v1.2.0) |
| G13 Authority document committed at `docs/NEXT_GO.md` | **TRUE** — via PR #206, `0f30649` |

**Eleven FALSE, one PARTIAL, one TRUE.** This confirms the brief. It also corrects PR #357's
"Correction 5", which states *"Ten gates are FALSE"* — G1 through G11 is **eleven** gates.

**G2 is unreachable right now by construction**: it requires CI green on the exact release
SHA, and every branch in this programme is red.

Nothing in these eleven PRs moves a gate to TRUE by itself. Gates move when a human runs the
QA, promotes the environment, verifies Stripe end to end and signs off — as
`docs/AGENT_EXECUTION_PACKET.md` §0 Fact 2 already recorded: *"The blocking work is not
code."* That remains true after eleven PRs.

---

## 6. Issue cross-references — verified against the API

| Issue / PR | Title | Actual state |
| --- | --- | --- |
| #186 | [P0-007] Retarget health and Lighthouse monitors to canonical production | **closed** |
| #192 | [P0-004] Reconcile migration history and hosted Supabase state | **open** — blocks all migrations |
| #193 | [P0-008] Complete launch-critical manual QA rows 1–10 | **open** — #355 makes it fillable |
| #204 | [P0-014] Replace/remove contradictory homepage statistics | **closed** |
| #205 | [P0-010] Complete Stripe purchase, webhook, order, library, reading path | **open** |
| #206 | docs(next-go): Phase 1 — execution authority | **closed** (merged) — G13 evidence |
| #209 | 🧊 LAUNCH FREEZE IN EFFECT | **open** — governs every merge |
| #145 | chore(main): release 1.0.0 | **closed** |

**Correction.** PR #357's "Correction 6" states *"Issue #204 (P0-014, G6) — contradictory
homepage statistics — is open"* and asks that it be reconciled against #354 before G6 can be
evidenced. **#204 is closed.** The reconciliation #357 asks for is therefore not required on
those grounds; #354's decision to leave the "0 Books / 0 Authors" band and the genre tile
counts untouched does not conflict with an open issue. G6 still needs its own evidence.

PRs #351 and #357 both describe #145 as "held". It is **closed**.

---

## 7. What is genuinely done versus written-but-unverified

**Genuinely done and demonstrable — a very short list:**

1. **CI now runs on stacked PRs.** Before, nothing in this programme was checked at all.
2. **The health monitor and SEO checker work.** #353 ran both live against production: 5/5
   health checks green, SEO 0 errors / 2 warnings, plus the simulated-failure and NXDOMAIN
   paths. This is the only tooling in the programme proven against the real site.
3. **`/register` server-renders correctly.** #352's live probe returned 200 with the full
   form markup and server-generated `<title>`. Task 1.3 needed no fix.
4. **The gate evidence compiler works.** #357 ran it against the real template and a
   doctored copy, and it correctly withheld a verdict and caught every seeded failure. It
   currently reports 0/13.
5. **The intake validator and the drift classifier run.** 101/101 and 27/27 assertions
   respectively, executed under `node` against fakes.
6. **The operator QA log is fillable.** #355 gave rows 1–10 slots for RC SHA, environment,
   tester, evidence and defect links. Issue #193 stayed open because the table was
   *unfillable*, not merely unfilled.

**Written but unverified — everything else**, including every line of the critical path.
Specifically: the dual-database write/read split, Mongo field parity, all seventeen drift
dispositions, the admin publishing pipeline, RBAC hardening, fail-closed middleware, the
webhook 410, the password policy, every marketing copy change, ~70 + 61 + 24 + 24 + 19 unit
cases, and every Playwright spec in #355 and #360.

**Not attempted anywhere in the programme:** any Supabase migration (correctly — blocked by
Task 3.6 / issue #192); any accessibility fix; any real book content; any production data
change; any environment promotion.

---

## 8. Risks, ranked

1. **`npm run build` has never run.** `next build` is unverified across all eleven branches.
   A build break would be discovered at deploy time, after merge, under launch pressure.
2. **The critical path is unproven.** #356 changes how every admin write reaches the
   database, and its acceptance test has not executed once.
3. **#358 and #360 are seven commits behind #356**, including four substantive fixes. They
   are being reviewed against code that no longer exists.
4. **Eight PRs point at a branch that will disappear.** They must be retargeted the moment
   #350 merges.
5. **Nothing is known about the hosted Supabase database.** Any migration written before the
   3.6 export is a coin flip against live data.
6. **The public catalog is 100% seed data** — three books, both authors on the seed list.
   Any cleanup before real content exists empties the site.
7. **Body copy is unreadable in the default theme** (A11Y-001, contrast 1.00:1 in
   `bg-muted`). It is a launch-quality defect nobody has fixed.
8. **The `published-epubs` bucket is `public = true`.** "Private by default" is app-layer
   only. Paid content may be directly reachable. Blocked behind 3.6.
9. **Marketing copy carries the weakest evidence and the widest blast radius.**
10. **The launch freeze (#209) is in force** and every merge must be classified against it.

---

## 9. How to read this alongside the other two documents

- **`docs/launch/EVIDENCE_PACKET.md`** — one evidence record per task, in a fixed format:
  status, branch, commits, PR, environment, findings, changes, files, validation executed,
  acceptance criteria, risks, rollback, human action.
- **`docs/launch/HUMAN_ACTIONS.md`** — the single, deduplicated list of everything requiring
  Renee, grouped by kind and priority, each naming the task and PR it unblocks.

Read `HUMAN_ACTIONS.md` first. Almost nothing in this programme finishes without it.
