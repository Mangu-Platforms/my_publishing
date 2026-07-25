# Phoenix Phase 11 — Data Migration Runbook

Operator-facing companion to `docs/PROJECT_PHOENIX.md` §5.5. The contract explains
_what_ and _why_; this explains _what to type_ and _what "good" looks like_.

**Everything here is read-only against production Supabase.** Nothing in Phase 11
writes to Supabase or changes what the public site serves. `AUTH_PROVIDER` and
`DATABASE_PROVIDER` stay `supabase` throughout — the flip happens in Phase 12,
after P11.6 sign-off.

## 0. Prerequisites

| Need                                   | Where it comes from                                              |
| -------------------------------------- | ---------------------------------------------------------------- |
| `SUPABASE_DB_URL`                      | Supabase → Project Settings → Database → Connection string → URI |
| `MONGODB_URI`                          | Atlas → Connect → Drivers (P1.4 / `npm run db:atlas:bootstrap`)  |
| `BETTER_AUTH_SECRET`                   | 32+ random chars; must match Vercel                              |
| `RESEND_API_KEY`                       | Resend dashboard — only needed for step 7 (forced resets)        |
| `BLOB_READ_WRITE_TOKEN`                | Vercel → Storage → Blob — only needed for step 5                 |
| `psql`, `jq`, `mongosh`, `mongoimport` | Postgres client + MongoDB Database Tools                         |

Put the values in `.env.local` (git-ignored) or export them. `export/` is
git-ignored: it will contain real user emails and order history, so **never commit
it and never paste its contents into a ticket**.

**Do not start until P1.8 is done** — a full `pg_dump` plus storage snapshot,
restore-tested. That backup is the only thing standing between a bad transform and
data loss.

## 1. P11.1 — Export

```bash
export SUPABASE_DB_URL='postgresql://postgres:<pw>@db.<ref>.supabase.co:5432/postgres'
npm run phoenix:export
```

Note the UTC timestamp when this finishes — step 8 needs it as the delta window
start.

**Good:** every file lists a row count, and the script ends with
`P11.1 complete`. **Stop if** any file reports `FAIL — does not parse`.

## 2. P11.2 — Transform

```bash
npm run phoenix:transform
```

Writes `export/*_transformed.json`, `export/_id_map.json` and
`export/transform-report.json`.

**Good:** `P11.2 gate PASSED — zero unmapped foreign keys`.

**Stop if** you see `P11.2 GATE FAILED`. The listed orphan ids are real referential
damage in the source data; fix it in Supabase (or accept and document the loss)
and re-export. Do not proceed to import.

Read the report before continuing, even on success:

| Line                          | What it means                                                                              |
| ----------------------------- | ------------------------------------------------------------------------------------------ |
| `locked credential accounts`  | Must equal your user count. Every one of these people needs step 7 before they can log in. |
| `slug collisions resolved`    | These books' URLs changed. If any is high-traffic, add a redirect.                         |
| `book statuses remapped`      | `submitted`/`review`/`accepted` → `draft`. Confirm no author expects those to be live.     |
| `synthesized payment intents` | Pre-Stripe orders. Expected to be >0 on an older dataset.                                  |
| `books with no author`        | Imported with `author_id: null` — invisible in the author portal until reassigned.         |

## 3. P11.3 — Dry run (staging). **Do not skip.**

Import into a _staging_ database first, never production:

```bash
STAGING_URI='mongodb+srv://…/mangu_staging'
for c in user account profiles authors books orders reviews reading_progress; do
  mongoimport --uri "$STAGING_URI" --db mangu_staging --collection "$c" \
    --file "export/${c}_transformed.json" --jsonArray
done

MONGODB_URI="$STAGING_URI" MONGODB_DB=mangu_staging npm run db:mongo:indexes
MONGODB_DB=mangu_staging npm run phoenix:verify
```

Then point a Vercel **preview** deployment at staging and run the smoke suite from
§5.5 P11.3: sign-up, forced reset for one imported user, catalog render, checkout
in Stripe test mode, webhook insert, file proxy.

**Good:** 6/6 smoke green and the verify script `PASSED`. **No production import
without this gate.**

## 4. P11.4 — Production import

```bash
for c in user account profiles authors books orders reviews reading_progress; do
  mongoimport --uri "$MONGODB_URI" --db mangu --collection "$c" \
    --file "export/${c}_transformed.json" --jsonArray
done
npm run db:mongo:indexes
```

`session` and `verification` are deliberately **not** imported: sessions are wiped
by design, and Better Auth issues fresh tokens.

If `db:mongo:indexes` fails on a duplicate key, the import is not safe — the
uniqueness invariant is violated. Drop the collections, fix the transform, restart
from step 2.

## 5. WS3.4 — Storage migration

Must run before step 6, or the verify script will fail on leftover Supabase URLs.

```bash
DRY_RUN=1 npm run phoenix:migrate-storage   # preview
npm run phoenix:migrate-storage             # live
```

**Good:** `Migration complete — 0 failures`. Re-running is safe; already-migrated
URLs are skipped.

## 6. P11.5 — Verify

```bash
EXPECTED_COUNTS="$(jq -c '[.counts|to_entries[]|{(.key):.value.out}]|add' export/transform-report.json)" \
  npm run phoenix:verify
```

Exits non-zero if any check fails. Interpreting the output:

- **`FAIL` on `no bcrypt hashes present`** — abort the cutover immediately. A
  password hash reached Better Auth; that is North Star #4 violated and users will
  be locked out in a way that looks like working auth.
- **`FAIL` on any `→ user` / `→ books` reference** — the import is incomplete.
  Drop, fix, re-import.
- **`FAIL` on `orders.stripe_payment_intent_id unique`** — webhook idempotency is
  broken; a Stripe retry will double-charge-record. Fix before Phase 12.
- **`WARN` on `books with no author`** — expected if step 2 reported it.
- **`WARN` on `session`/`verification` not empty** — fine on staging after smoke
  tests; investigate on a fresh production import.

## 7. Forced resets — how legacy users get back in

Every migrated account is locked. Until this runs, **no legacy user can log in**,
by design. Do this _after_ Phase 12/13 so the reset links point at the live site.

```bash
npm run phoenix:forced-resets                          # dry run, prints the plan
npm run phoenix:forced-resets -- --send --limit 25      # small batch first
npm run phoenix:forced-resets -- --send                 # the rest
```

Progress is written to `forced-reset-progress.json` after **every** send, so a
crash or a re-run never double-mails anyone. Re-running retries only failures.
Start with `--limit 25` and confirm delivery in Resend before the full batch —
a few hundred reset emails at once is a deliverability risk.

Verify completion:

```javascript
// mongosh — should trend toward 0 as users set passwords
db.account.countDocuments({ providerId: 'credential', password: /^!locked:/ });
```

## 8. Delta capture — the rollback safety net

Supabase keeps serving traffic between step 1 and DNS cutover, so rows written in
that window exist in Postgres but not in Mongo.

```bash
# what Supabase gained since the step 1 snapshot
npm run phoenix:delta -- --since '<step 1 UTC timestamp>' --source supabase

# what Mongo gained after cutover (needed if you roll back)
npm run phoenix:delta -- --since '<cutover UTC timestamp>' --source mongo
```

**Good:** `No divergence in the window`. Otherwise replay the captured rows before
declaring cutover complete, and attach `delta-report.json` to the P11.6 record.

## 9. P11.6 — Sign-off

Attach to the reconciliation record, then get the Data Owner's written sign-off:

1. `export/transform-report.json`
2. Full `npm run phoenix:verify` output
3. `storage-migration-report.json`
4. Both `delta-report.json` files
5. P11.3 staging smoke results (6/6)

Only then proceed to Phase 12.

## If it goes wrong

Nothing in Phase 11 is destructive to Supabase, so the rollback is simply: stop,
leave `AUTH_PROVIDER=supabase`, and the public site is unaffected. To retry from
scratch, drop the Mongo collections and restart at step 1 — the transform is
deterministic apart from freshly generated ObjectIds, and `_id_map.json` records
the mapping each run produced.

Escalation path and Sev definitions: `.claude/skills/mangu-ops-runbook/SKILL.md`.
