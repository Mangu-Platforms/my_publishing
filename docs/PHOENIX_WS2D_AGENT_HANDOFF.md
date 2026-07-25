# Phoenix WS2d Agent Handoff — Status Pack

**Date:** 2026-07-25  
**Owner context:** Student / limited cloud credits — next agents must continue without rediscovering this.  
**Canonical contract:** `docs/PROJECT_PHOENIX.md` (v4.0.3+)  
**Execution brief:** `CLAUDE.md`  
**This PR:** https://github.com/redinc23/my_publishing/pull/349  
**Branch:** `cursor/phoenix-ws2d-query-layer-a030` → base `main`

---

## 1. One-paragraph truth

Project Phoenix is **not cutover-complete**. Public production must stay on `AUTH_PROVIDER=supabase` and `DATABASE_PROVIDER=supabase` until Phase 11–12. PR #349 finishes most of **WS2d.1**: consumer + large admin/portal **reads** go through `lib/data/*` dual-run helpers so flipping `DATABASE_PROVIDER=mongodb` later does not require rewriting every page. **Writes** (admin mutations, wishlist/follows, some APIs) and human gates (Atlas/Vercel/Stripe/Phase 11 run) remain.

---

## 2. Scoreboard (Phoenix North Star — honest)

| #   | North Star item                                 | Status                                                                                  |
| --- | ----------------------------------------------- | --------------------------------------------------------------------------------------- |
| 1   | `npm run build` exit 0                          | Unblocked on main via #348; verify after #349 merge                                     |
| 2   | `/api/health?ready=1` → ready                   | Exists from prior WS; not re-certified this PR                                          |
| 3   | 22-point QA matrix                              | **Human / Phase 14**                                                                    |
| 4   | PRs #1–#6 merged, prod green                    | WS1–2c largely on main; **#349 = WS2d**; WS3 run / WS4 purge / WS5 e2e / WS6 incomplete |
| 5   | mongodump stored                                | **Human gate**                                                                          |
| 6   | Zero supabase in `app/ lib/ components/ types/` | **FAIL until WS4** — dual-run still imports Supabase by design                          |
| 7   | Forced-reset batch executed                     | Scripts on main (#348); **human triggers**                                              |
| 8   | 429s + Sentry + logs                            | Partial WS6; not closed                                                                 |

**Launch ledger:** still **NO-GO** for Better Auth / Mongo cutover.

---

## 3. What PR #349 contains (Task 2d.1)

### Dual-run helpers (`lib/data/*`)

| Module                                                                         | Key exports                                                                                     |
| ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| `books.ts`                                                                     | `listPublishedBooks` (q/sort), featured/trending/genre, `fetchBookForApi`, checkout, audiobooks |
| `genres.ts` / `stats.ts` / `authors.ts`                                        | genre counts, platform stats, featured/directory/author PDP                                     |
| `reading.ts` / `library.ts`                                                    | reading session + progress upsert; library orders+progress                                      |
| `reviews.ts`                                                                   | `getBookReviewPage`, `listPublicReviewsPage`, `listMyReviews`                                   |
| `admin-dashboard.ts` / `admin-books.ts` / `admin-orders.ts` / `admin-users.ts` | admin list/stats reads                                                                          |
| `author-portal.ts`                                                             | author dashboard books (+ empty manuscripts on Mongo)                                           |
| `lib/reading/entitlement.ts`                                                   | dual-run; Mongo uses **auth** `user_id` (Phoenix **A-6**)                                       |
| `lib/utils/genre.ts`                                                           | shared `slugifyGenre`                                                                           |

### Surfaces wired

**Consumer:** home rails, genres, checkout book load, `/books` browse, Author Spotlight, PDP (+ reviews), `/reading`, `/library`, `/authors`, `/authors/[id]`, `/recommendations`, `/discover/recommendations`, `/audio`, `/audio/[id]`  
**API:** `GET /api/reviews`  
**Admin/portal:** dashboard stats, books list, orders list, users list, author portal dashboard, `dashboard/my-reviews`

### Commits on branch (newest first, vs `main`)

```
6630397 feat(phoenix-ws2d): dual-run my-reviews dashboard page (2d.1)
20e29f7 feat(phoenix-ws2d): dual-run admin orders and users lists (2d.1)
67ed04b feat(phoenix-ws2d): dual-run admin dashboard stats (2d.1)
6b02040 feat(phoenix-ws2d): dual-run author portal dashboard (2d.1)
51e0613 feat(phoenix-ws2d): dual-run admin books list (2d.1)
5be80a2 feat(phoenix-ws2d): dual-run GET /api/reviews pagination (2d.1)
81e9f53 feat(phoenix-ws2d): dual-run audio catalog pages (2d.1)
66226c0 feat(phoenix-ws2d): dual-run authors directory (2d.1)
c50be0c feat(phoenix-ws2d): dual-run discover recommendations page (2d.1)
1d5b722 … PDP reviews (E)
d9e7b60 … reading/library/entitlement/author PDP (C/D)
… + earlier A/B commits
```

### Verification commands (run before merge)

```bash
source ~/.nvm/nvm.sh && nvm use   # .nvmrc = 22.22.2; engine-strict
npx tsc --noEmit -p tsconfig.json
npx jest tests/unit/data-catalog-dual-run.test.ts \
  tests/unit/data-reviews-dual-run.test.ts \
  tests/unit/reading-entitlement.test.ts \
  tests/unit/admin-dashboard-dual-run.test.ts \
  tests/unit/data-admin-books-dual-run.test.ts \
  tests/unit/reviews-api.test.ts --no-coverage
# CI on PR #349 should show workflow "ci" SUCCESS
```

**Guardrails:** Do **not** set production `AUTH_PROVIDER=better-auth` or `DATABASE_PROVIDER=mongodb` until Phase 11 readiness. Feature freeze: migration parity only.

---

## 4. What is NOT done (next agents — ordered)

### Still WS2d (code, unblocked)

1. **Admin writes** — `app/admin/actions.ts` (role change, book status, manuscript approve, order status) dual-run + audit.
2. **Admin manuscripts / book edit/new** pages.
3. **Partner portal** (`app/(portals)/partner/…`, `partner-data.ts`).
4. **Engagement APIs** — wishlist, follows, readers-hub (feature-flagged; lower cutover risk).
5. **Resonance** purchased-book signals already call entitlement — pass `authUserId` everywhere on Mongo.
6. Mongo gaps to document/fix later: no `total_reads` / `is_featured` / audio_url / review_votes / manuscripts collection.

### WS3 Storage

- Code mostly exists (`@vercel/blob`, upload, `/api/files`, `migrate-storage.ts`).
- **Human:** run migration with `SUPABASE_SERVICE_ROLE_KEY` + `BLOB_READ_WRITE_TOKEN`; keep report `storage-migration-report.json`.

### WS4 Cleanup

- Purge `@supabase/*` from app/lib/components/types **only after** cutover path proven.
- Keep TEMP service role for migrate/export until Phase 14.

### WS5 Tests

- Expand Better Auth / Mongo e2e; webhook idempotency + avg_rating tests exist partially.

### WS6 Observability

- Rate limit / logger / Sentry — verify completeness vs doc.

### Phase 11–15 (mostly human)

See `HUMAN_TASKS.md` + `docs/PHOENIX_CUTOVER_RUNBOOK.md`:

- P1.8 pg_dump + storage snapshot
- Atlas/Vercel env
- `npm run phoenix:export|transform` → mongoimport → `phoenix:verify`
- `phoenix:forced-resets`
- DNS cutover, QA matrix, mongodump, Supabase pause

---

## 5. Critical architecture rules (do not improvise)

1. **Edge middleware:** cookie-only session (`getSessionCookie`). No Mongo driver on Edge.
2. **Never migrate password hashes.** Locked `!locked:<uuid>` + forced reset only.
3. **Orders user_id:** Supabase = `profiles.id`; Mongo = **auth user id** (A-6). Entitlement helpers take optional `authUserId`.
4. **Stripe webhook:** upsert by `stripe_payment_intent_id`, 200 on duplicate.
5. If doc ≠ repo: amend `docs/PROJECT_PHOENIX.md` in the same PR.
6. Branch naming for this cloud env: `cursor/<slug>-a030`. One PR per workstream.

---

## 6. How next agents should start

```bash
# 1) Load navigator + contract
# 2) Read this file + HUMAN_TASKS.md + docs/PROJECT_PHOENIX.md §5 WS2d/WS3
# 3) Prefer continuing PR #349 if still open; else new branch off main after merge
# 4) Default path Phoenix (B). Do not flip prod provider flags.
# 5) Every PR: Task IDs + verification evidence + CI green
```

**Suggested next PR (after #349 merges):** `cursor/phoenix-ws2d-admin-writes-a030` — dual-run `app/admin/actions.ts` + manuscripts, OR `cursor/phoenix-ws5-tests-a030` if CI/e2e is the bottleneck.

---

## 7. Human-only blockers (do not fake credentials)

Logged in `HUMAN_TASKS.md`. Agents write scripts/docs; humans run consoles:

- Atlas URI / API keys, Vercel env promotion, Stripe webhook endpoint
- Supabase export credentials, production mongoimport, forced-reset send
- DNS / Cloud Run standby

---

_Handoff authored for continuous cowork. Prefer evidence over vibes._
