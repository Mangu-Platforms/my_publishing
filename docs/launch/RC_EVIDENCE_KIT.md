# RC Evidence Kit — G10 manual QA + G11 rollback rehearsal

Operator-facing companion to `docs/launch/LAUNCH_GATE_EVIDENCE.md` (the gate
table) and `docs/OPERATOR_QA_LOG.md` (the evidence of record). Those documents
say _what must be true_; this kit says _what to type, what to write down, and
where to write it_.

It pre-pays two gates:

| Gate | Needs | Produced by |
| --- | --- | --- |
| **G10** | Manual QA rows MQ-01…MQ-10 complete, dated, at one RC SHA (issue #193 / P0-008, DoLC A2) | §1–§3, §5 |
| **G11** | Known-good revision recorded; rollback rehearsed and traceable (DoLC E8) | §4 |

G11 covers **deployment** rollback only, never data. The data half — a full,
restore-tested backup (Phoenix P1.8, DoLC B13) — is
[`BACKUP_RESTORE_RUNBOOK.md`](./BACKUP_RESTORE_RUNBOOK.md), and it must be done
**before** the rehearsal in §4 touches production traffic.

**Freeze note (#209):** this kit is class 1 documentation. Executing it changes
no code; the only production-visible moment is the deliberate, announced
traffic shift inside §4.

## 0. Prerequisites

| Need | Where it comes from |
| --- | --- |
| Repo clone, `origin` = `redinc23/my_publishing` | `git remote -v` |
| Vercel dashboard access, project `manguprojectz` | Vercel team membership |
| `vercel` CLI signed in (optional; dashboard suffices) | `vercel whoami` |
| Production URL | `https://www.mangu-publishers.com` (interim canonical, ADR-001) |
| Health probe | `curl -fsS "https://www.mangu-publishers.com/api/health?ready=1"` |
| Test mailbox + Stripe test card | MQ-01/MQ-04/MQ-08 preconditions |
| Somewhere durable for screenshots/HARs | evidence index per `LAUNCH_GATE_EVIDENCE.md` |

No secrets appear in this kit. Real connection strings and tokens live in
`.env.local` (git-ignored) or your shell — never in a table cell, never in a
ticket.

## 1. Designate and freeze the RC SHA

The RC is **one immutable commit on `main`** that is simultaneously (a) what
production serves and (b) what every MQ row cites. Pick it like this:

```bash
git fetch origin --tags
git rev-parse origin/main             # full 40-char SHA — this is the candidate
git rev-parse --short=7 origin/main   # short form of the SAME commit, for narrow cells
```

Confirm production is serving exactly that commit **before** any testing:
Vercel → `manguprojectz` → Deployments → the **Current** Production deployment
(state **READY**) → its **Source** commit. CLI alternative:
`vercel ls manguprojectz --prod`, then `vercel inspect <deployment-url>`.

**Good:** deployed commit = `origin/main` = the SHA you wrote down.
**Stop if** they differ — either an unmerged hotfix is live or the deploy lags
`main`. Do not start the block; testing a SHA production is not serving
produces evidence of nothing.

Freeze it with an annotated tag so the designation cannot drift:

```bash
RC_SHA="$(git rev-parse origin/main)"
RC_TAG="rc/launch-$(date -u +%Y%m%d)"
git tag -a "$RC_TAG" "$RC_SHA" -m "RC frozen for G10 manual QA block"
git push origin "$RC_TAG"
git rev-parse "$RC_TAG^{commit}"      # must print exactly $RC_SHA
```

Record the RC SHA in **all** of:

1. `docs/OPERATOR_QA_LOG.md` → the **Release candidate under test** header
   table (this is the record of record);
2. the `RC SHA` cell of every MQ row as you complete it;
3. the G10 and G11 rows of `docs/launch/LAUNCH_GATE_EVIDENCE.md` when you
   transcribe gate evidence;
4. the pushed tag above.

If **any** commit lands on `main` after this point, the RC is void (the QA
log's own rule): re-designate, re-tag, re-run all ten rows.

## 2. Evidence rules — non-negotiable

1. **Exact SHA only.** Full 40-char SHA in the header table; the 7-char short
   form of the *same commit* is acceptable inside row cells. Never `this
   branch`, `latest`, `main`, or `post-#231`. Older sections of the QA log
   wrote `this branch`; those rows can no longer be tied to any commit — that
   is the failure mode this rule exists to prevent.
2. **Dated, UTC.** `YYYY-MM-DDTHH:MMZ`. No local time, no "today".
3. **Append-only.** A blank cell may be completed once; a non-blank cell is
   history and is never edited. Corrections are a new row or block plus a
   supersession note (the pattern the log already uses for MQ-10).
4. **One SHA per block.** Ten rows, same SHA — or the block is void, not
   evidence.
5. **Durable evidence links.** Committed screenshot path, recording, HAR, or a
   provider-dashboard permalink. Not a localhost URL, not a file that exists
   only on your desktop.
6. **FAIL rows stay.** Add the defect link (mandatory on FAIL), fix, then
   re-run the block against a **new** RC SHA.

## 3. MQ-01…MQ-10 worksheet (G10)

The identical block already exists — every cell blank — in
`docs/OPERATOR_QA_LOG.md`, section **"Manual (operator — browser)"**. The copy
below is byte-identical to it. Fill it here during the session, then move the
results into the log.

**Transcribe by appending — never rewrite history.**

- If the log's block is still entirely blank, completing its blank cells *is*
  the append: blanks are not history.
- If **any** cell there already carries content (a prior RC's attempt), do not
  clear, overwrite, or "fix" anything: append a fresh copy of this whole block
  (header table + ten rows) at the **end** of that section under a dated
  heading, and leave the old block standing.
- Never delete rows, never amend a recorded SHA, never rewrite the log's git
  history.

Links inside the rows are relative to `docs/` (the log's home), not to this
file.

**Release candidate under test**

| Field | Value |
| --- | --- |
| RC SHA (immutable; applies to all ten rows) | |
| Environment (URL + auth/data provider config) | |
| Tester (name / GitHub handle) | |
| Block started (UTC) | |
| Block completed (UTC) | |

| Test ID | Test | RC SHA | Environment | Tester | Date/time (UTC) | Preconditions | Steps | Expected | Actual | Result (PASS/FAIL) | Evidence link | Defect link |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| MQ-01 | Register at `/register` | | | | | Mailbox reachable; address not already registered | 1. Open `/register` 2. Submit name / email / password 3. Open the verification email 4. Complete verification | Account created; verification email received; the verified account can sign in | | | | |
| MQ-02 | Profile row exists for the new account | | | | | MQ-01 completed | Look up the new account in the auth provider and in the `profiles` table | Exactly one profile row exists and its role is `reader` | | | | |
| MQ-03 | Login / logout | | | | | MQ-01 account verified | 1. Sign in at `/login` 2. Confirm the signed-in state 3. Sign out 4. Re-open a protected route | Sign-in succeeds; sign-out clears the session; the protected route sends you back to `/login` | | | | |
| MQ-04 | Password reset | | | | | MQ-01 account exists | 1. Request a reset at `/reset-password` 2. Open the emailed link 3. Set a new password 4. Sign in with it | Reset email arrives; the link opens the confirm page; the new password works and the old one does not | | | | |
| MQ-05 | Non-admin blocked from `/admin` | | | | | Signed in as a non-admin (reader) | 1. Open `/admin/dashboard` 2. Open `/admin/users` 3. POST directly to an admin route from browser devtools | Bounced every time; no admin data appears in any response body | | | | |
| MQ-06 | Admin `/admin/health` | | | | | Signed in as admin | Open `/admin/health` and read every component status | Page renders and the component statuses match the live `/api/health?ready=1` payload | | | | |
| MQ-07 | Browse `/books` | | | | | Launch catalog published (the 3–6 real titles) | 1. Open `/books` 2. Open each launch title 3. Use search and one genre filter | Only real launch titles are listed; every detail page renders; no seeded QA data is visible | | | | |
| MQ-08 | Stripe test checkout | | | | | Stripe test mode; one purchasable launch title | Complete a test-card checkout end to end — see [WEBHOOK_TESTING.md](./WEBHOOK_TESTING.md) | Checkout completes; the success return page is honest; the order is recorded | | | | |
| MQ-09 | Stripe webhook event received | | | | | MQ-08 completed | Check the Stripe dashboard webhook log, then the resulting order and entitlement | Event delivered and acknowledged once; entitlement granted exactly once (no duplicate) | | | | |
| MQ-10 | Purchased title readable from `/library` | | | | | MQ-08 completed as the MQ-01 account | 1. Open `/library` 2. Open the purchased title 3. Confirm an unpurchased title is absent | The purchased title is present and openable; unpurchased titles are absent | | | | |

**Sign-off** (same criterion as the log): the block counts as complete only
when all ten rows carry the same RC SHA, a tester, a UTC timestamp, an
`Actual`, a `Result` and an evidence link. A partially-filled block is
INCOMPLETE, never PASS, and G10 stays FALSE.

## 4. Rollback rehearsal (G11)

G11 wants a recorded known-good revision **and** proof you actually moved
production traffic onto it and back. A deployment ID written down without a
rehearsal is a guess, not a gate.

**This is a real production traffic shift.** Do it in a low-traffic window,
before any launch announcement, after `BACKUP_RESTORE_RUNBOOK.md` has produced
a restore-tested backup. Keep the health probe open in a second terminal.
Target: the whole rehearsal inside 15 minutes.

### 4.1 Identify the rollback target

Vercel → `manguprojectz` → **Deployments** → filter Environment **Production**,
Status **Ready**. CLI: `vercel ls manguprojectz --prod`. Record — for both the
**current** deployment (the RC) and the **most recent previous READY**
production deployment:

- deployment ID (`dpl_…`)
- deployment URL
- source commit SHA
- created (UTC)

**Good:** a previous READY production deployment exists and its source commit
is an ancestor of the RC on `main` (`git merge-base --is-ancestor <old> <rc>`
exits 0). **Stop if** the RC deployment is the only READY one — you have no
rollback target and G11 cannot pass honestly. Create one first (redeploy the
previous `main` commit), then return here.

### 4.2 Baseline

```bash
curl -fsS "https://www.mangu-publishers.com/api/health?ready=1"   # expect 200, ready:true
```

Save the output; it is the "before" edge of the transcript.

### 4.3 Roll back

Dashboard: the previous READY deployment → **⋯** → **Instant Rollback** →
confirm. CLI equivalent:

```bash
vercel rollback <previous-deployment-id-or-url>
```

Note the UTC time. The rehearsal window is now open.

### 4.4 Verify the site while rolled back

Within about two minutes:

```bash
curl -fsS  "https://www.mangu-publishers.com/api/health?ready=1"
curl -fsSo /dev/null -w '%{http_code}\n' "https://www.mangu-publishers.com/"
curl -fsSo /dev/null -w '%{http_code}\n' "https://www.mangu-publishers.com/books"
```

…and confirm the dashboard now shows the previous deployment as **Current**.

**Good:** `ready:true`, both pages 200, dashboard agrees. That deployment is
your **known-good revision** — record its deployment ID and SHA now, while
looking at it working. **Stop if** `ready:false` or any 5xx: the candidate is
*not* known-good. Roll forward immediately (§4.5), then rehearse again against
an older READY deployment. Never record a known-good revision you did not see
serve traffic.

### 4.5 Roll forward

Instant Rollback (or `vercel rollback <rc-deployment-id>`) back onto the RC
deployment, then re-run the §4.4 probes.

**Good:** `ready:true` on the RC again; note the UTC time — the rehearsal
window is closed. **Stop if** the roll-forward itself fails: production is on
the known-good build (safe), but the RC deployment is suspect — treat it as a
launch blocker before designating any new RC.

### 4.6 Record it

Fill this transcript and **append** it (append-only, dated) to
`docs/OPERATOR_QA_LOG.md`; cite it from the G11 row of
`docs/launch/LAUNCH_GATE_EVIDENCE.md`.

| Field | Value |
| --- | --- |
| Rehearsal window (UTC, start–end) | |
| Operator | |
| RC deployment ID / SHA | |
| **Known-good deployment ID** (`dpl_…`) | |
| **Known-good SHA** | |
| Rollback method (dashboard / CLI) | |
| Probes while rolled back (output link) | |
| Roll-forward verified at (UTC) | |
| Evidence (screenshots / terminal transcript) | |

Deployment rollback proven ≠ data safe. If launch day ever needs the rollback
for real, the database keeps moving forward — that asymmetry is why
`BACKUP_RESTORE_RUNBOOK.md` exists.

## 5. Browser matrix (G10 companion)

Run the **full** MQ block once, on the primary row (BM-01). Every other row
re-runs the render-and-money subset — MQ-03 (login), MQ-07 (browse), MQ-08
(checkout), MQ-10 (library) — under the same evidence rules and the same RC
SHA. Transcribe completed rows into the QA log together with the MQ block.

| Row | Browser | OS / device | Viewport | Scope | RC SHA | Tester | Date/time (UTC) | Result (PASS/FAIL) | Evidence link |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| BM-01 | Chrome (latest) | macOS | 1440×900 | Full MQ-01…MQ-10 | | | | | |
| BM-02 | Safari (latest) | macOS | 1440×900 | MQ-03/07/08/10 | | | | | |
| BM-03 | Mobile Safari | iOS (iPhone 15 class) | 390×844 | MQ-03/07/08/10 | | | | | |
| BM-04 | Chrome | Android (Pixel class) | 412×915 | MQ-03/07/08/10 | | | | | |
| BM-05 | Firefox (latest) | Windows 11 | 1536×864 | MQ-03/07/08/10 | | | | | |
| BM-06 | Edge (latest) | Windows 11 | 1536×864 | MQ-03/07/08/10 | | | | | |

**Good:** every row PASS at the one RC SHA. **Stop if** any row fails the money
path (MQ-08 / MQ-10): that platform cannot buy or read — launch-blocking. File
the defect, fix, new RC, re-run.

## 6. Filing map

| Artifact | Lands in |
| --- | --- |
| RC designation (SHA + tag name) | QA log header table + `rc/launch-YYYYMMDD` tag on `origin` |
| Completed MQ block | `docs/OPERATOR_QA_LOG.md` (append; §3 rules) |
| Browser matrix rows | `docs/OPERATOR_QA_LOG.md` (append, with the block) |
| Rollback transcript + known-good ID/SHA | `docs/OPERATOR_QA_LOG.md` (append) → cited by G11 row |
| Gate flips G10/G11 | `docs/launch/LAUNCH_GATE_EVIDENCE.md`, evidence columns |
| Backup + restore-test log | `BACKUP_RESTORE_RUNBOOK.md` §6 → QA log (append) |

Nothing in this kit is ever recorded as "done" without a SHA, a UTC date, and
a durable evidence link. If a line lacks one of the three, it did not happen.
