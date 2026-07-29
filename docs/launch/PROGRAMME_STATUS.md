# Programme Status — MANGU Publishers launch

**Compiled:** 2026-07-28 · **Compiled at base:** `audit/2026-07-28-fixes` @ `23e50c1`
**Revised:** 2026-07-29 ~00:25 UTC, re-verified against the GitHub API at the SHAs and run
numbers cited below. The original 2026-07-28 text described a programme that was red
everywhere; that is no longer true and this revision records what changed and what did not.
**Scope:** the twelve open PRs #350–#357 and #359–#362, plus #358 (merged into #356 on
2026-07-28).
**Authority:** this document is *not* a launch authority. `docs/NEXT_GO.md` rules launch and
gates G1–G13. This document records what the programme produced and how far it has been
verified. Where a claim could not be confirmed it is marked **UNCONFIRMED** and attributed.

---

## 1. The one status fact that matters

**All eleven branches of the original programme (#350–#360) are now green through
`npm run build` — the first successful builds in the programme's history.** Two branches
added since remain red at `npm test`: `task/evidence-packet` (#361, this document's own
branch) and `task/a11y-remediation` (#362), both because they forked before the test fixes
landed.

Verified against the GitHub Actions API on 2026-07-29 (~00:25 UTC). Latest `ci` run per
branch head (the `ci` job executes, in order: `npm ci` → `validate:gap-ledger` →
`type-check` → `lint` → `npm test` → `npm run build`; a green run means every one of those
steps passed — confirmed at step level for runs #910 and #913):

| Run | Branch (PR) | Head SHA | Conclusion | Link |
| --- | --- | --- | --- | --- |
| #894 | `audit/2026-07-28-fixes` (#350) | `935e7d2` | **success** | <https://github.com/redinc23/my_publishing/actions/runs/30405413119/job/90429631120> |
| #909 | `task/architecture-and-governance-docs` (#351) | `8698adc` | **success** | <https://github.com/redinc23/my_publishing/actions/runs/30405713909/job/90430542931> |
| #913 | `task/phase1-auth-security` (#352) | `339218b` | **success** | <https://github.com/redinc23/my_publishing/actions/runs/30410720809/job/90445935848> |
| #905 | `task/ops-monitoring-and-launch-tooling` (#353) | `73c77f5` | **success** | <https://github.com/redinc23/my_publishing/actions/runs/30405563854/job/90430096426> |
| #901 | `task/4.6-marketing-truthfulness` (#354) | `2cb4ac5` | **success** | <https://github.com/redinc23/my_publishing/actions/runs/30405503044/job/90429907842> |
| #906 | `task/qa-automation-and-crawl-regression` (#355) | `0e38286` | **success** | <https://github.com/redinc23/my_publishing/actions/runs/30405579271/job/90430142404> |
| #910 | `task/phase1-catalog-data-path` (#356) | `9c28293` | **success** | <https://github.com/redinc23/my_publishing/actions/runs/30406910811/job/90434281690> |
| #896 | `task/5.1-5.5-launch-readiness` (#357) | `7e87c56` | **success** | <https://github.com/redinc23/my_publishing/actions/runs/30405434072/job/90429694636> |
| #903 | `task/4.2-content-intake-pipeline` (#358, since merged) | `7fb479d` | **success** | run #903, pre-merge |
| #902 | `task/3.6-migration-drift-and-backfill` (#359) | `9dc0d33` | **success** | <https://github.com/redinc23/my_publishing/actions/runs/30405508752/job/90429925920> |
| #908 | `task/accessibility-and-browser-matrix` (#360) | `8bf70f91` | **success** | <https://github.com/redinc23/my_publishing/actions/runs/30405632003/job/90430301594> |
| #892 | `task/evidence-packet` (#361) | `0585510` | **failure at `npm test`** | <https://github.com/redinc23/my_publishing/actions/runs/30404129382/job/90425591518> |
| #899 | `task/a11y-remediation` (#362) | `437921c` | **failure at `npm test`** | <https://github.com/redinc23/my_publishing/actions/runs/30405475230/job/90429824927> |

**What green means and does not mean.** Green here is the full pipeline through `next build`
under CI's dummy env (`USE_MOCKS='true'`, placeholder Supabase/Stripe values). It is real
evidence that the code compiles, the unit suites pass, and the app builds. It is **not**
evidence that anything works against the live backends, that any E2E has run (there is still
no Playwright job in CI), or that a human has QA'd anything. Every human-QA row in
`docs/OPERATOR_QA_LOG.md` is still empty.

### How the red was cleared — verified

The 2026-07-28 revision of this document recorded every branch red at `npm test` (runs
#881–#891) and hypothesised the cause was commit `8e6fa50` (`fix(catalog): make public book
lookup duplicate-slug proof`) outrunning the Supabase mocks in the unit suite. **The
hypothesis was borne out by the fix that worked.** Between ~22:40 and ~22:48 UTC on
2026-07-28, matching test-fix commits were pushed to each branch — on
`audit/2026-07-28-fixes` it is `935e7d2` (`test(catalog): assert the duplicate-slug-hardened
checkout read path`); `task/accessibility-and-browser-matrix` additionally needed `8bf70f91`
(`test(schema-drift): mock @/lib/data/book-assets for real, not virtually`, removing a
spurious `virtual: true` mock flag). Runs #894–#910 then went green branch by branch.

`task/phase1-auth-security` (#352) was the last holdout: its tests passed after the fix but
**`npm run build` failed** (run #900 on `d897d84`, step-level: every step green, build
failure) — the 410 webhook stub at `app/api/webhooks/stripe/route.ts` exported
`CANONICAL_WEBHOOK_PATH`, which is not a legal Next.js route-module export. Fixed on
2026-07-29 00:17 UTC by `aeade43` / `ec23656` / `339218b` (move the constant to its own
module and import it); run #913 on `339218b` is green through build (00:20:55 UTC).

The two branches still red both fork from pre-fix commits: #361 forks
`audit/2026-07-28-fixes` at `23e50c1` (one commit before the test fix) and #362 forks the
accessibility line before `44cde11`/`8bf70f91`. Both need their base's tip merged in —
see `HUMAN_ACTIONS.md` HA-A9. Nothing in either branch's own content is implicated by the
step-level evidence (both fail at `npm test`, same signature as the fixed failure).

### Why CI runs at all now

Until `.github/workflows/ci.yml` was changed to accept `audit/**` and `task/**` as pull
request base branches, **no stacked PR had any checks whatsoever** — every branch in this
programme was unverified and reported "no checks for this commit". That change is present on
all programme branches, which is why runs #881 onwards exist. CI running red, then being
fixed to green, is exactly what the change was for.

### Two lint notes, retired

The 2026-07-28 text carried two open concerns: that `npm run lint` under ESLint 9 flat
config might mask problems, and that the `BookFilters` `useSearchParams` Suspense pattern
might de-opt or break builds. Both are settled by evidence: `lint` and `build` have now
passed together on eleven real branch heads (runs #894–#913). Neither concern blocked a
build anywhere.

---

## 2. Verified branch topology

Every base below was re-read from the GitHub API on 2026-07-29.

| PR | Head branch | Head SHA | **PR base** | State |
| --- | --- | --- | --- | --- |
| #350 | `audit/2026-07-28-fixes` | `935e7d2` | **`main`** | open, green #894 |
| #351 | `task/architecture-and-governance-docs` | `8698adc` | `audit/2026-07-28-fixes` | open, green #909 |
| #352 | `task/phase1-auth-security` | `339218b` | `audit/2026-07-28-fixes` | open, green #913 |
| #353 | `task/ops-monitoring-and-launch-tooling` | `73c77f5` | `audit/2026-07-28-fixes` | open, green #905 |
| #354 | `task/4.6-marketing-truthfulness` | `2cb4ac5` | `audit/2026-07-28-fixes` | open, green #901 |
| #355 | `task/qa-automation-and-crawl-regression` | `0e38286` | `audit/2026-07-28-fixes` | open, green #906 |
| #356 | `task/phase1-catalog-data-path` | `9c28293` | `audit/2026-07-28-fixes` | open, green #910 |
| #357 | `task/5.1-5.5-launch-readiness` | `7e87c56` | `audit/2026-07-28-fixes` | open, green #896 |
| #358 | `task/4.2-content-intake-pipeline` | — | `task/phase1-catalog-data-path` | **MERGED** 2026-07-28 23:06:20 UTC by `redinc23`; merge commit `9c28293` (= #356's current head, green #910); branch deleted |
| #359 | `task/3.6-migration-drift-and-backfill` | `9dc0d33` | `audit/2026-07-28-fixes` | open, green #902 |
| #360 | `task/accessibility-and-browser-matrix` | `8bf70f91` | `task/phase1-catalog-data-path` | open, green #908 |
| #361 | `task/evidence-packet` | `0585510` + this revision | `audit/2026-07-28-fixes` | open, **red #892** (`npm test`, inherited — forked at `23e50c1`) |
| #362 | `task/a11y-remediation` | `437921c` | `task/accessibility-and-browser-matrix` | open, **red #899** (`npm test`, inherited pre-fix fork) |

### Topology findings — updated

1. **The `8e6fa50` fork-point finding is resolved.** The missing test fix now exists on
   every original branch (that is what turned them green), and the `ci.yml` hunk merged
   without conflict everywhere, as predicted.
2. **#358's stale fork resolved itself in the merge.** Renee (`redinc23`) merged #358 into
   `task/phase1-catalog-data-path` at 23:06:20 UTC; the merge was clean and the resulting
   head `9c28293` is green through build (run #910) **with #358's validator tests executing
   inside it**. A separate reconciliation had already reported the intake validator was
   *not* coded against a stale contract (contract files byte-identical between the fork
   point and tip — reported by the stale-fork reconciliation pass, consistent with the clean
   merge and green run). Task 4.2 now ships via #356.
3. **#360 is still forked from `task/phase1-catalog-data-path` at `a43cea0`** — the seven
   admin-form fixes it is missing are now eight-plus commits including the merged #358. Its
   own CI is green because it carries its own copies of the test fixes, but its audit line
   numbers still reference a version of `BookForm.tsx` that has moved. **Update #360 from
   #356 before relying on its line-level citations.**
4. **#362 forked the accessibility line at a pre-fix commit and edits
   `app/admin/books/_lib/BookForm.tsx`**, which #356 later changed (`published_at`
   handling). The conflict is flagged on #362 itself (attributed — this recorder verified
   the red run and the branch lineage, not the line-level conflict). Resolve when updating
   the branch (HA-A9).

### Verified merge order

```
#350                                    (base: main — gateway; green #894; merge first)
 ├─ #351  docs only                     (green #909)
 ├─ #356  CRITICAL PATH — data path     (green #910; now contains merged #358)
 │   └─ #360   (green #908 — refresh from #356 before review; then)
 │       └─ #362   (red #899 — refresh from #360, resolve BookForm.tsx conflict, design sign-off)
 ├─ #352  (green #913)
 ├─ #354  (green #901)
 ├─ #353  (green #905)
 ├─ #357  (green #896)
 ├─ #355  (green #906)
 ├─ #359  (green #902)
 └─ #361  this packet (red #892 — refresh from audit tip; merge last, it is the record)
```

Recommended sequence: **#350 → #351 → #356 → #352 → #354 → #353 → #357 → #355**, with
**#359** anywhere after #350; **#360** after #356 once refreshed from it; **#362** after
#360 (needs the branch refresh, the `BookForm.tsx` conflict resolved, and Renee's sign-off
on the site-wide contrast token change); **#361** last, refreshed, as the programme record.
#355 stays late deliberately: its RBAC matrix asserts #352's hardened contract and its crawl
expectations assume #354's copy and #356's catalog.

**Retarget steps.** Nine open PRs (#351–#357, #359, #361) target `audit/2026-07-28-fixes`.
The moment #350 merges, retarget each to `main` or they silently become unmergeable. #360
keeps base `task/phase1-catalog-data-path` until #356 lands (then retarget to `main`); #362
keeps base `task/accessibility-and-browser-matrix` until #360 lands.

---

## 3. What each PR delivers, and how far it is verified

Verification vocabulary used below, consistently:

- **Statically checked** — a standalone TypeScript compiler ran over the changed files and
  reported no syntax errors. Module resolution errors were expected and excluded because
  `node_modules` was not installed.
- **Executed under `node` against fakes** — the agent compiled a module and ran assertions
  against hand-built stubs, outside jest.
- **CI-verified** — the branch's latest head passed the full `ci` job: `validate:gap-ledger`,
  `type-check`, `lint`, `npm test` (jest, for real, in CI), `npm run build`. This is new as
  of 2026-07-28/29 and is cited per branch with its run number.
- **Not executed** — Playwright. **No E2E spec has run anywhere: CI has no Playwright job
  and no agent could run a browser.**

### #350 — Audit fixes *(base: `main`)*

Auth-page SSR via `<Suspense>` on `/login` and `/reset-password/confirm`; the public
draft-book leak closed (`fetchBookForApi` now filters `status='published' AND
visibility='public'` on both providers); a service-role→RLS fallback so book detail pages
render; auth callback honours a sanitised `?next=`; retailer buttons on the PDP; a cleanup
script and manifest.

**Verification:** CI-verified at `935e7d2` — run #894 green through build. The `npm test`
failure this PR introduced at `8e6fa50` was fixed on-branch by `935e7d2`
(`test(catalog): assert the duplicate-slug-hardened checkout read path`). The cleanup script
has still not been run (the API cannot delete files), so the ~5.5 MB of obsolete artifacts is
still in the tree, and the two live production defects it documented (book-detail pages,
`/api/books` empty body) still need env attention (HA-B19).

**Genuinely done:** the branch builds and its suite passes. Live-site verification of the
fixed pages remains human QA.

### #351 — Architecture and governance docs

Eight Markdown files: ADR-001 (catalog and identity data ownership), the data ownership
matrix, seventeen schema-drift dispositions, the book lifecycle, the publishing runbook, the
launch catalog template, the launch gate evidence template, and the definition of launch
complete. No code, no schema, no workflow file.

**Verification:** the agent reports an automated pass confirming all 86 cited source paths
resolve at `8e6fa50` — **UNCONFIRMED by this recorder** (not re-run). Documentation cannot
be "tested"; its correctness is a review activity. CI-verified at `8698adc` (run #909).
The runbook's cover-size contradiction with #358 has since been fixed on this branch: it now
states **5 MB enforced** / ≤2 MB editorial target (verified at
`docs/BOOK_PUBLISHING_RUNBOOK.md` on `task/architecture-and-governance-docs`) — closing
HA-D5's original discrepancy in favour of the enforced limit.

**Genuinely done:** the writing, and the cover-limit correction. Not the review, and not the
decisions it defers — ADR-001 still collides with the already-ACCEPTED
`docs/adr/ADR-001-canonical-platform.md`, so two live ADR-001s exist and the numbering needs
Renee.

### #352 — Phase 1 auth and security

29 files, +1345/−239. `/register` SSR investigated and found already correct (no code
change); Stripe webhook duplicate route replaced with a documented 410 Gone; middleware
fails closed on missing Supabase env and no longer reads the unsigned `mangu-role` cookie
for authorization; new `/author` and `/partner` layout gates closing a real gap on
`/author/analytics` and `/author/projects/*`; login error normalisation and redaction; one
password policy at 8 characters; host-header injection removed from auth deep links;
registration profile-creation failure surfaced instead of swallowed.

**Verification:** CI-verified at `339218b` — run #913 green through build (2026-07-29
00:20 UTC). The four new unit test files (61 assertions) now execute in CI and pass. The
branch was the programme's last red: after the test fix, `npm run build` failed (run #900)
because the 410 stub route exported a non-route field (`CANONICAL_WEBHOOK_PATH`); fixed by
`aeade43`/`ec23656`/`339218b`. The live production probe of `/register` (200, full
server-rendered markup) stands as real evidence for Task 1.3.

**Genuinely done:** Task 1.3, and a green suite + build. The manual QA (fail-closed 503s,
forged cookie, verification deep link) and the Stripe dashboard confirmations remain human
actions.

### #353 — Ops, monitoring and launch tooling

15 files, +3022/−16. Health monitor with six checks including `/login` server render and
Supabase `/auth/v1/health`; the hardcoded Supabase project ref removed from
`rotate-supabase-key.yml` and the service-role rotation gap made loud; a dry-run-only
duplicate/seed audit with a two-gate execution guard; incident response runbook; environment
matrix (variable names only, zero values); report-only SEO checker; three `package.json`
script aliases.

**Verification:** the strongest evidence in the programme, now CI-verified on top:
`health:check` **run live against production** — 5/5 green, exit 0; simulated-failure and
NXDOMAIN paths exercised; `seo:check` run live — 0 errors, 2 warnings; 67 unit assertions
now also executing under jest in CI. Run #905 green at `73c77f5`. `catalog-seed-audit` was
**not** executed (needs live credentials).

**Genuinely done:** the health and SEO checks are demonstrably working tools, and the branch
builds. The seed audit is unexercised.

### #354 — Marketing truthfulness

21 files, +533/−429. Removed claims of on-site reading, mobile apps, cookie consent
controls, a blog, a press kit and streaming across `/about`, `/blog` (now 404), `/contact`,
`/faqs`, `/help`, `/press`, `/cookies`, `/privacy`, `/discover/book-clubs`, the homepage hero
and metadata, the spotlights, the footer and the newsletter surfaces. App-store badges,
footer blog link, dead language selector and PayPal badge removed.

**Verification:** previously the weakest evidence position in the programme (no static
check, no probe recorded in the PR body). Now CI-verified at `2cb4ac5` (run #901): it
compiles, its updated unit tests (`form-honesty`, `book-clubs-honesty`) execute and pass,
and the site builds with the new copy. **All copy still needs Renee's line-by-line sign-off
before merge**, per the PR itself; CI cannot vouch for words.

**Genuinely done:** builds and tests pass. Six `TODO(renee):` placeholders remain in source.

### #355 — QA automation and crawl regression

7 files, +2137/−116. RBAC matrix E2E across five roles and every portal surface including
forged-cookie negatives; rate-limit and abuse E2E asserting truthfulness of 429 vs 503; a
full-crawl regression harness with runtime discovery and nothing hardcoded; the operator QA
log rows 1–10 restructured so they are fillable at all.

**Verification:** CI-verified at `0e38286` (run #906) — but note what that covers here:
type-check, lint, build. **Playwright was not run — the specs have never executed against a
browser**, and `ci.yml` still has no Playwright job, so these specs are not run by CI
either. That caveat is unchanged by the green run.

**Genuinely done:** the QA log is now fillable, which is a real unblock for issue #193. The
specs remain unexecuted code until HA-B10/HA-B11 land.

### #356 — CRITICAL PATH: admin writes reach the database the site reads

The most consequential PR in the programme. Fixes the defect where `createBookAdmin`,
`updateBookAdmin` and `updateBookStatusAction` wrote to Supabase unconditionally while
production catalog reads run on MongoDB — meaning **a book published through the admin UI
could never appear on the public site**. Admin writes and admin reads are now provider-aware
via the existing `isMongoPrimary()`. Visibility is derived from status. Mongo gained field
parity for the six retailer URLs, audio, EPUB, trailer, ISBN and featured flags. Seventeen
schema-drift items dispositioned code-side. `published_at` is no longer destroyed by
unpublish. Audit writes consolidated onto `recordAudit`. A real admin publishing pipeline
with one shared validation rule set. **Now also carries #358's intake pipeline** (merged
2026-07-28 23:06 UTC).

**Verification:** CI-verified at `9c28293` (run #910, step-level confirmed: test **and**
build green). The ~70 unit cases — including the unit-level create→publish→unpublish
round-trip and the `published_at` survival pin — **now execute under jest in CI and pass**,
as do #358's validator tests. What has still never happened: the *manual* round-trip against
a real preview with `DATABASE_PROVIDER=mongodb` (HA-E6), which is the acceptance evidence
that counts for launch.

**Genuinely done:** the suite that guards the critical path runs and passes, and the app
builds with the new write path. Production-shaped proof remains human QA.

### #357 — Launch readiness

One offline script and three documents: the gate evidence compiler (which refuses to report
readiness at all when evidence is incomplete, printing `VERDICT WITHHELD` rather than
`NO-GO`), the release checklist with eight rollback triggers and a rollback procedure, the
launch communications drafts, and the author profile spec.

**Verification:** the compiler was already compiled and run against the real evidence
template (0/13 evidenced, exit 1 — correct) and a doctored copy exercising every failure
path. Now also CI-verified at `7e87c56` (run #896).

**Genuinely done:** the compiler demonstrably works. The three documents are drafts awaiting
Renee's facts — every name, date, title and price is a `TODO(renee):` placeholder.

### #358 — Content intake pipeline — **MERGED into #356**

Asset-kit spec, a copyable template, a rule engine that maps a kit onto
`AdminBookFormValues` and calls `validateAdminBook` **unchanged**, a CLI validator, and unit
tests.

**Verification and disposition:** merged by `redinc23` at 2026-07-28 23:06:20 UTC into
`task/phase1-catalog-data-path`; branch deleted. Its last standalone head `7fb479d` was
green (run #903), and the merge commit `9c28293` is green through build (run #910) with the
101-assertion rule-engine suite executing inside it. The earlier stale-contract concern was
checked and cleared before the merge (contract files byte-identical — reconciliation pass,
attributed). Task 4.2 evidence now travels with #356.

**Genuinely done:** the validator works and its tests run in CI. It has never been run
against a real asset kit because none exists (HA-D1).

### #359 — Migration drift and backfill *(analysis only)*

Deliberately writes no migration. A read-only SQL export set for an operator with database
access, an offline drift classifier, the reconciliation procedure with a PLAN A / PLAN B
decision tree, a read-only Supabase-vs-Mongo backfill dry run with **no execute mode**, and
the backfill plan.

**Verification:** classifier compiled and executed **27/27 assertions** including the real
40-file repository inventory; now CI-verified at `9dc0d33` (run #902).

**Genuinely done:** the machinery to understand the drift. **Nothing about the hosted
database is known.** The PR is explicit that everything hosted is UNVERIFIED and that nobody
on the task has or sought credentials. This is the correct outcome — it is also why no
migration can be written anywhere in this programme.

### #360 — Accessibility and browser matrix *(base: #356, still forked at `a43cea0`)*

Three new files, no application code modified. A 940-line Playwright accessibility spec, an
889-line audit with nineteen findings, and a browser/device matrix.

**Headline finding:** `text-secondary` resolves to `--secondary`, a *surface* token, not a
text token. Computed contrast is 1.37:1 on the dark page background, **1.00:1 inside a
`bg-muted` section**. 149 usages across 62 files. **A remediation now exists**: PR #362
implements the token-layer fix plus five other findings — see its own row; it needs Renee's
design sign-off and is currently red for an unrelated, inherited reason.

**Verification:** CI-verified at `8bf70f91` (run #908) — which on this branch also carries
its own test fixes (`44cde11`, `8bf70f91`, the latter removing a spurious `virtual: true`
mock flag). **Playwright never executed and no browser ever rendered these pages** — that
caveat stands. **Base still stale** — see §2 finding 3.

**Genuinely done:** the audit is a credible reading of the code, and the branch builds. Its
line-level citations should be re-checked after the branch is refreshed from #356.

### #361 — Programme evidence packet *(this PR)*

The three documents: `PROGRAMME_STATUS.md`, `EVIDENCE_PACKET.md`, `HUMAN_ACTIONS.md`.

**Verification:** documentation only, but the branch is **red at `npm test` (run #892)** —
it forked `audit/2026-07-28-fixes` at `23e50c1`, one commit before the test fix `935e7d2`.
The failure is the same inherited one that was fixed everywhere else; nothing in these
documents affects tests. **Refresh this branch from the audit tip (HA-A9) and it should go
green like the other eleven.** This revision was written knowing that; honesty about one's
own branch is the least this document owes.

### #362 — Accessibility remediation *(base: #360)*

Seven files: new `--text-secondary` and `--primary-strong` tokens (the A11Y-001/A11Y-002
fix, site-wide by design), audio player keyboard access, a skip link with its
`id="main-content"` target now applied in `app/layout.tsx` (verified on the branch), admin
form error association, and four `test.fixme` → `test` promotions.

**Verification:** **red at `npm test` (run #899)** — inherited pre-fix fork, same signature
as the fixed programme-wide failure (step-level: everything green until `npm test`). Its
`BookForm.tsx` edit conflicts with #356's later `published_at` change — flagged on the PR
(attributed). Needs: branch refresh from #360 (HA-A9), conflict resolution, and **Renee's
design sign-off on the contrast token change, which alters the rendered colour of
`text-secondary` everywhere**.

**Genuinely done:** the code exists and the skip-link target is confirmed on the branch.
Nothing about it is verified beyond that.

---

## 4. Task status table

**A task is COMPLETE only when implementation, tests, documentation and evidence all pass.**
Eleven branches now have green suites and builds, which moves many tasks from
"written-but-unverified" to "written and CI-verified" — but human QA rows, gate evidence and
production verification are still empty, so **zero tasks are COMPLETE** and the statuses
below still say so rather than flattering the work.

Status vocabulary:

| Status | Means |
| --- | --- |
| `COMPLETE` | Implementation, tests, docs and evidence all pass. **Zero tasks qualify.** |
| `READY_FOR_REVIEW` | Work is written and pushed; **CI is green on the carrying branch (cited in §1)**; a human must review and merge. |
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

Notes. **1.0 and 1.2 are the critical path**; their unit-level round-trip suite now executes
green in CI (run #910), but the manual acceptance round-trip (HA-E6) has still never been
performed against a real environment. **1.3** remains the closest thing to a finished task —
live probe evidence, no code change, and its carrying branch is now green (run #913). **1.4**
still needs Renee to confirm the Stripe dashboard endpoint — if the dashboard points at
`/api/webhooks/stripe`, deliveries start failing with 410 the moment #352 deploys. **1.6** is
dry-run only and must stay that way: production's catalog is currently 100% seed data.
**1.7** is split — #352 replaced the fake reader; the PDP "Start Reading" button lives in a
file #356 owns. Confirm the button is gone at merge (HA-A6).

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
The fix is written, unit-covered in a green suite, and awaits manual QA (HA-E6).

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
may be written anywhere.** None was, in any of the programme PRs — verified.

### Phase 4 — Real content

| Task | Description | Status | PR |
| --- | --- | --- | --- |
| 4.1 | Launch catalog template | `READY_FOR_HUMAN_ACTION` | #351 |
| 4.2 | Book asset-kit spec + intake validator | `READY_FOR_REVIEW` | **#356** (via merged #358) |
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
| H | Accessibility audit + browser/device matrix | `READY_FOR_HUMAN_ACTION` | #360 (+#362 remediation) |
| A.6 | Registration profile-creation failure surfaced | `READY_FOR_REVIEW` | #352 |
| — | Programme evidence packet + human action list | `READY_FOR_REVIEW` | #361 (this PR — branch itself red, see §3) |

Section G is `BLOCKED_EXTERNAL`: the matrix honestly marks production variable presence as
**NOT VERIFIED**, because confirming it requires the Vercel dashboard. Section H is
`READY_FOR_HUMAN_ACTION` because A11Y-001 now has an implementation in #362 but still needs
the design decision signed (HA-C18), the branch refresh and the conflict resolution (HA-A9).

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

Read directly from `docs/NEXT_GO.md` §6, lines 159–171, on `audit/2026-07-28-fixes`
(2026-07-28; not re-read in this revision):

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

**G2 is no longer unreachable by construction.** On 2026-07-28 every branch was red, so G2
could not be evidenced at all. Now every mergeable branch is green; once the merge sequence
lands, the release SHA on `main` can carry a green run. G2 stays FALSE until that exact SHA
exists and its run is cited.

Nothing in these PRs moves a gate to TRUE by itself. Gates move when a human runs the QA,
promotes the environment, verifies Stripe end to end and signs off — as
`docs/AGENT_EXECUTION_PACKET.md` §0 Fact 2 already recorded: *"The blocking work is not
code."* Green CI narrows the gap; it does not close it.

---

## 6. Issue cross-references — verified against the API

Verified 2026-07-28; not re-read in this revision.

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

**Genuinely done and demonstrable:**

1. **CI now runs on stacked PRs, and it is green.** The programme-wide `npm test` failure
   was fixed on every branch (commits of 2026-07-28 ~22:40 UTC, e.g. `935e7d2`; plus the
   `virtual: true` mock removal `8bf70f91` where needed), and #352's build failure was fixed
   on 2026-07-29 (`339218b`). **Eleven branches green through `npm run build` — the first
   successful builds in the programme's history** (runs #894–#913, §1 table).
2. **The unit suites actually execute now.** The ~70 cases guarding the critical path
   (#356), the 61 auth/RBAC assertions (#352), #358's 101 validator assertions, and the
   rest run under jest in CI and pass — no longer "written but never run".
3. **The health monitor and SEO checker work.** #353 ran both live against production: 5/5
   health checks green, SEO 0 errors / 2 warnings, plus the simulated-failure and NXDOMAIN
   paths.
4. **`/register` server-renders correctly.** #352's live probe returned 200 with the full
   form markup and server-generated `<title>`. Task 1.3 needed no fix.
5. **The gate evidence compiler works.** #357 ran it against the real template and a
   doctored copy; it correctly withheld a verdict and caught every seeded failure. It
   currently reports 0/13.
6. **The operator QA log is fillable.** #355 gave rows 1–10 slots for RC SHA, environment,
   tester, evidence and defect links.
7. **#358 is merged** — the first programme PR to land anywhere (into #356, cleanly, with a
   green merge commit).

**Written and CI-verified, but not human-verified — most of the code.** Green CI under mock
env proves compilation, unit behaviour and buildability. It does not prove the admin
round-trip against real MongoDB (HA-E6), the fail-closed 503s in a real deployment (HA-E2),
the Stripe path with real money (HA-E11), or a single rendered page in a real browser —
**no Playwright spec has ever executed** (no CI job, no agent browser).

**Not attempted anywhere in the programme:** any Supabase migration (correctly — blocked by
Task 3.6 / issue #192); any real book content; any production data change; any environment
promotion. Accessibility fixes now exist (#362) but are unmerged, red, and awaiting design
sign-off.

---

## 8. Risks, ranked

1. **The critical path is CI-proven but not reality-proven.** #356 changes how every admin
   write reaches the database; its unit round-trip passes in CI, but no human has performed
   HA-E6 against a real environment. Green CI under `USE_MOCKS='true'` can miss
   provider-boundary defects by construction.
2. **Nothing is known about the hosted Supabase database.** Any migration written before
   the 3.6 export is a coin flip against live data. Two live production defects (#350's
   book-detail and `/api/books` findings) still need env attention (HA-B19).
3. **#360 still forks #356 at `a43cea0`** — its audit citations reference moved code; and
   **#362 carries a known `BookForm.tsx` conflict** plus inherited red tests (HA-A9).
4. **Nine PRs point at a branch that will disappear.** #351–#357, #359 and #361 must be
   retargeted to `main` the moment #350 merges.
5. **The public catalog is 100% seed data** — three books, both authors on the seed list.
   Any cleanup before real content exists empties the site (HA-C8/HA-D1).
6. **Body copy is unreadable in the default theme** (A11Y-001, contrast 1.00:1 in
   `bg-muted`). The fix exists in #362 but is unmerged and needs a design decision
   (HA-C18) — until it lands, the launch-quality defect stands.
7. **The `published-epubs` bucket is `public = true`.** "Private by default" is app-layer
   only. Paid content may be directly reachable. Blocked behind 3.6.
8. **Marketing copy has the widest user-visible blast radius and no human sign-off yet**
   (HA-D2) — CI now vouches for the build, not the words.
9. **No E2E has ever run.** The RBAC matrix, rate-limit and accessibility specs are still
   unexecuted code; `ci.yml` has no Playwright job (HA-B10/HA-B11).
10. **The launch freeze (#209) is in force** and every merge must be classified against it.

---

## 9. How to read this alongside the other two documents

- **`docs/launch/EVIDENCE_PACKET.md`** — one evidence record per task, in a fixed format:
  status, branch, commits, PR, environment, findings, changes, files, validation executed,
  acceptance criteria, risks, rollback, human action.
- **`docs/launch/HUMAN_ACTIONS.md`** — the single, deduplicated list of everything requiring
  Renee, grouped by kind and priority, each naming the task and PR it unblocks.

Read `HUMAN_ACTIONS.md` first. Almost nothing in this programme finishes without it.
