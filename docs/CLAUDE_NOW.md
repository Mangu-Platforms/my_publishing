# CLAUDE NOW — MANGU Publishers (`my_publishing`)

**Repo:** https://github.com/Mangu-Publishing-House/my_publishing  
**Live:** https://www.mangu-publishers.com (canonical) · Vercel project `manguprojectz`  
**Authority:** `docs/NEXT_GO.md` wins every conflict. README / FEATURE_PHASES / Phoenix briefing lose.  
**Status:** **NO-GO**. G1–G12 FALSE. G13 TRUE. 11 open P0 issues. QA rows MQ-01–MQ-10 blank.  
**Owner grant:** You have full authority to code, commit, open PRs, and loop until Epic 0 evidence exists. You do not have authority to invent product surface.

---

## LOOP CONTRACT (read this every session)

You work in a loop:

```
pick next open US-0.x → implement or evidence → PR → append OPERATOR_QA_LOG row → next
```

Rules:

1. **Epic 0 only.** US-0.1 … US-0.9. Stop when those nine have exact-SHA evidence in `docs/OPERATOR_QA_LOG.md`.
2. **Do not add features.** Do not “improve the homepage.” Do not start Phoenix cutover. Do not flip `AUTH_PROVIDER`, `DATABASE_PROVIDER`, or `STORAGE_PROVIDER` defaults off `supabase`.
3. **Do not claim a gate TRUE** without a QA-log row: UTC, tester, SHA, expected, actual, artifact.
4. **One SHA.** All Epic 0 evidence rows must cite the same release-candidate SHA. If main moves, restart the evidence block.
5. **No mocks in prod evidence.** `USE_MOCKS` and `SKIP_EMAILS` must be absent from Vercel Production. CCR-010.
6. **No secrets in git.** If a console click is required, write the exact click-path into `HUMAN_TASKS.md` AND into `public/operator-walkthrough.html`. Do not stall the loop on that — keep coding the unblocked story.
7. **Launch freeze (#209):** permitted classes only — evidence, hardening that unblocks a gate, CI wiring, security fixes, docs that record truth. New catalog/social/payout/UI work goes to `docs/ENHANCEMENT_LEDGER.md` and waits.
8. **Close leftover autofix / dependabot majors / Phoenix mega-PRs** that are not required for Epic 0. Do not merge them “while you’re in there.”
9. **Production stays Vercel.** Cloud Run / Amplify / Foundry / Mongo cutover are not this loop.
10. When Epic 0 is green, stop and wait. Do not auto-start Epic 1–16.

---

## PASTE THIS TO START A SESSION

```text
Repo: Mangu-Publishing-House/my_publishing
Authority: docs/NEXT_GO.md. If README disagrees, NEXT_GO wins.
Work ONLY Epic 0 stories in docs/CLAUDE_NOW.md (US-0.1 … US-0.9).
Do not add features. Do not improve the homepage. Do not flip AUTH_PROVIDER.
Every gate claim appends a row to docs/OPERATOR_QA_LOG.md
with UTC, SHA, expected, actual, artifact. One SHA for the whole pack.
Loop until US-0.1–US-0.9 are evidenced or you are blocked on a named HUMAN_TASK
that is already in public/operator-walkthrough.html.
Then stop and report: SHA, stories closed, stories blocked, next story.
```

---

## CURRENT GROUND TRUTH (verified 2026-08-27)

| Fact | Value |
| --- | --- |
| Default branch SHA at packet write | `a2d07a15b7571d269c812675e1467e799aca4dd5` |
| Open issues | 11 P0s (#187, #191, #192, #193, #194, #195, #198, #199, #203, #205, #209) |
| Open PRs | Mix of Phoenix dual-run drafts + dependabot. Freeze: do not merge unless it unblocks a G-gate. |
| Canonical URL | https://www.mangu-publishers.com |
| Health gate | `/api/health?ready=1` must return `ready: true` on www |
| Auth / payments / catalog | Code exists. Gates false because evidence packs were never signed. |
| QA log MQ-01–MQ-10 | Blank |
| Phoenix | Dual-run behind flags. Public prod stays Supabase Auth until Phase 11. Not this loop. |

---

## EPIC 0 — LAUNCH TRUTH (the only work)

### US-0.1 Production secrets are real
**As** operator **I want** production secrets validated and mocks absent **so** a buyer is not walking a fake path.  
**Issues:** #203, #195. **Gate:** G7 / Phase 11.  
**Do:**
- Audit Vercel Production env against `.env.production.example` and `docs/SECRET_INVENTORY.md`.
- Prove `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `NEXT_PUBLIC_SITE_URL=https://www.mangu-publishers.com` are present.
- Prove `USE_MOCKS` and `SKIP_EMAILS` are **unset** in Production.
- Make `validate-env` / health ready-check fail-closed if mocks leak.
- If a value is missing, log the exact Vercel click-path in HUMAN_TASKS + operator-walkthrough. Do not invent keys.

**Acceptance:** health JSON on www shows ready subsystems; no mock flags; QA row with SHA + redacted health payload.

### US-0.2 Auth pack on www
**As** a new user **I can** register, verify, log in, log out, reset a password on www.  
**Issue:** #191. **Gate:** G3. **Status:** SHIPPED-UNPROVEN.  
**Do:**
- Fix any broken PKCE / Site URL / redirect allow-list so callbacks land on `https://www.mangu-publishers.com`.
- Duplicate email fails honestly. Expired/bad reset token fails honestly.
- Session cookie not in URL.
- Prepare MQ-01–MQ-04 evidence template; if you cannot click the mailbox, leave Actual blank and write the exact steps into the walkthrough.

**Acceptance:** six behaviors evidenced on one SHA, or code defects fixed and re-queued for operator click.

### US-0.3 Stripe test → order → library → reader
**As** a buyer **when** I pay with a test card **I get** an order row, a library item, and the reader opens.  
**Issue:** #205. **Gate:** G4 / G8. **Status:** SHIPPED-UNPROVEN.  
**Do:**
- Checkout session creates; webhook verifies signature; signed event 2xx; unsigned 400.
- Replay does not double-grant entitlement.
- Refund revokes access.
- Webhook endpoint registered for www `/api/webhook` (or the live route name — verify in code, do not assume).
- Idempotency ledger actually used.

**Acceptance:** correlation pack: Stripe event id, order id, entitlement row, library render, reader open. Same SHA.

### US-0.4 Non-buyer cannot read a paid book
**As** a non-buyer **I cannot** open the reader for a paid book.  
**Status:** SHIPPED-UNPROVEN.  
**Do:** honest denial (403/paywall), not a blank page, not a storage 404, not a hotlinked public object.

**Acceptance:** screenshot or HAR of denial + proof the storage object is not anonymously fetchable.

### US-0.5 Non-admin cannot open admin or partner export
**As** a non-admin **I cannot** open admin or partner export.  
**Issue:** #193. **Gate:** G5. **Status:** SHIPPED-UNPROVEN.  
**Do:** 403 or redirect evidenced for reader hitting `/admin` and partner export route.

**Acceptance:** two denial artifacts on the release SHA.

### US-0.6 No fake success
**As** a visitor **I never** see contact / newsletter / homepage stats claim success they did not earn.  
**Gate:** G6.  
**Do:** forms work or are disabled. No fake “subscribed”. Catalog counts are real published rows. Missing audio says “coming soon”, not a player that lies.

**Acceptance:** G6 package: contact, newsletter, homepage stats, empty-audio honesty.

### US-0.7 Ready probe on www
**As** operator **I want** `GET https://www.mangu-publishers.com/api/health?ready=1` → `ready: true`.  
**Gate:** G7.  
**Do:** fix the ready checker so missing Stripe/Upstash/site URL fail closed. Paste curl JSON into the QA log.

**Acceptance:** curl JSON committed (no secrets).

### US-0.8 Rollback rehearsal
**As** operator **I can** roll back to a known-good Vercel deployment in one rehearsed step.  
**Gate:** G11. **Doc:** `docs/ROLLBACK.md`.  
**Do:** write the exact Vercel Instant Rollback click-path + `vercel rollback` command into the walkthrough. Record revision id of current READY deploy. Do not actually roll prod unless owner asks; prepare the transcript template.

**Acceptance:** transcript template + current READY revision id in QA log.

### US-0.9 QA rows 1–10 on one SHA
**As** release manager **I want** MQ-01–MQ-10 filled: tester, UTC, SHA, artifact.  
**Issue:** #193. **Gate:** G10.  
**Do:** freeze one RC SHA. Fill every row you can from automation. Leave operator-only Actual cells blank and drive them from `public/operator-walkthrough.html`. No row from a different SHA.

**Acceptance:** ten rows, one SHA, no blank Actual next to PASS.

---

## AFTER EPIC 0 (do not start)

When G1–G13 are TRUE and v1.0.0 is cut from that SHA, the next Claude loop is:

1. Epic 3 leftovers that are ENHANCE (free title grant, promo codes, invoice, self-serve refund request)
2. Epic 9 author payouts (Connect is POST-GO — schema/ledger first)
3. Then growth epics in `docs/PRODUCT_BACKLOG_FULL.md`

Never Hathor. Never Foundry-as-storefront. Never native apps in this repo.

---

## DEFINITION OF DONE FOR THIS LOOP

- [ ] USE_MOCKS / SKIP_EMAILS absent in Vercel Production
- [ ] Auth pack evidenced or defects fixed + walkthrough queued
- [ ] Stripe signed webhook 2xx, unsigned 400, no double-grant, refund revokes
- [ ] Non-buyer / non-admin denials honest
- [ ] Public forms do not lie
- [ ] www `/api/health?ready=1` → `ready: true`
- [ ] Rollback revision id recorded
- [ ] OPERATOR_QA_LOG MQ-01–MQ-10 same SHA
- [ ] Stop. Tag only when owner cuts v1.0.0.
