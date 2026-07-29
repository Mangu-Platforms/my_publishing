# Launch Communications

> **Task 5.5.** Draft copy for launch day plus the execution checklist that surrounds it.
>
> Nothing here is approved. Every draft needs Renee's sign-off before it is published.

---

## 0. Rules these drafts obey

These are not style preferences. A public claim that the product cannot back is a **defect**
under CCR-018 and blocks **G6** ("No false-success public forms/claims").

| Rule | Why |
| --- | --- |
| **No on-site reading.** There is no EPUB reader at launch. Readers buy through external retailer links. `/reading/<id>` renders an honest unavailable page. | PR #352 Task 1.7; locked launch decision |
| **No mobile apps.** App Store / Google Play badges were removed because there are no apps. | PR #354 |
| **Audio: samples only.** Full audiobooks are post-launch. Never write "listen to the audiobook". | Locked launch decision; `docs/NEXT_GO.md` §7 |
| **Small catalog.** 3–6 real books. Never "thousands of titles", "unlimited", "streaming", or a stat band. | `docs/launch/LAUNCH_CATALOG.md` |
| **No invented facts.** No book title, author name, date, price, quote, endorsement, subscriber count or metric appears here unless it was verified. Everything else is a `TODO(renee):` placeholder. | CCR-006 |
| **No secrets, no PII** in any draft, screenshot or attachment. | CCR-009, CCR-015 |
| **Nothing publishes before the gates.** No "production ready" or launch claim until G1–G13 are TRUE. | CCR-003, `docs/NEXT_GO.md` §7 |

**Placeholders you must fill before anything ships.** Each is a fact this document
deliberately refuses to guess:

| Placeholder | Fact needed |
| --- | --- |
| `TODO(renee): launch date` | The public launch date, and the timezone it is stated in |
| `TODO(renee): launch titles` | The 3–6 real book titles, exactly as they appear in the catalog |
| `TODO(renee): author names` | The real author names for those books, spelled as they wish |
| `TODO(renee): retailer list` | Which retailers actually carry each title on launch day |
| `TODO(renee): price` | Whether prices appear in the copy at all, and what they are |
| `TODO(renee): social handles` | The accounts MANGU controls. PR #354 flagged that `@mangupublishers` in `app/layout.tsx` is **unconfirmed** |
| `TODO(renee): press contact` | Whether press gets a dedicated address, and what it is |
| `TODO(renee): newsletter list state` | Size of the confirmed-opt-in list and the consent basis — see §2 |
| `TODO(renee): launch owner` | Name of the person who owns the launch window |
| `TODO(renee): incident owner` | Name of the person who owns an incident during the window |

---

## 1. Website announcement

**Placement:** `TODO(renee):` decide — homepage banner, `/about`, or a standalone page.
Do **not** reintroduce `/blog`; PR #354 404s it because no posts exist.

> ### MANGU Publishers is open
>
> Our first books are available now.
>
> MANGU Publishers is an independent publisher. We work with a small number of authors and
> we publish carefully, which is why we are opening with `TODO(renee): launch titles` rather
> than a catalogue of thousands.
>
> **How to get a book.** Browse the catalogue, open a book's page, and buy it from the
> retailer of your choice. We link directly to the retailers that carry each title.
> `TODO(renee): retailer list`
>
> **Audio.** Where a book has an audio sample, you can listen to it on that book's page.
> Full audiobooks are not available yet.
>
> **An account is optional.** You can browse and follow retailer links without one. An
> account lets you keep track of what you have bought here.
>
> Questions: [Contact](/contact).

**What this draft deliberately does not say:** "start reading now", "read on any device",
"download the app", "listen to the audiobook", "unlimited", "thousands of titles", or any
number of books, authors or readers.

---

## 2. Announcement email — CONDITIONAL, DO NOT SEND YET

> ### ⚠️ Send condition
>
> **This email may only be sent if the newsletter list and its consent state genuinely
> support it.** The provider is wired end to end — `/api/newsletter` → double opt-in →
> confirm/unsubscribe — and that is exactly why this needs a deliberate decision rather than
> a default: the send button works.
>
> All of the following must be true, verified by a human, before a send:
>
> - [ ] The list contains only addresses that **completed double opt-in**. Pending, bounced and unsubscribed addresses are excluded.
> - [ ] Every recipient opted in to **this kind of message** (a launch announcement), not only to a different purpose.
> - [ ] The list is large enough and current enough that sending is worth the sender-reputation risk. `TODO(renee): newsletter list state`
> - [ ] `RESEND_API_KEY` is configured in production, and a test send to an internal address arrived and rendered.
> - [ ] The unsubscribe link works, and was clicked and verified.
> - [ ] A physical sender address / postal identifier is present if required for your jurisdiction. `TODO(renee):`
> - [ ] No PII beyond the recipient's own address appears in the message (CCR-015).
>
> **If any box is unticked, do not send.** Publish the website announcement and the social
> posts instead. An announcement nobody consented to receive is worse than no announcement.

**Subject:** `TODO(renee):` — suggestions, none approved: "MANGU Publishers is open" /
"Our first books are here".

> Hello,
>
> MANGU Publishers is open, and our first books are available now.
>
> `TODO(renee): launch titles` — with `TODO(renee): author names`.
>
> Each book has its own page on our site with a description and links to the retailers that
> carry it. Where a book has an audio sample, you can listen to it there.
>
> **Browse the books:** https://www.mangu-publishers.com/books
>
> Thank you for being on this list from the start.
>
> — The MANGU Publishers team
>
> *You are receiving this because you confirmed a subscription at mangu-publishers.com.
> [Unsubscribe]({{unsubscribe_url}}).*

**Not permitted in this email:** a "read now" or "open in the app" call to action, a
subscription/membership offer, an audiobook claim, a discount code that does not exist, or a
catalogue-size number.

---

## 3. Social posts

`TODO(renee): social handles` — confirm which accounts MANGU actually controls before
posting or before printing a handle anywhere on the site.

**Post A — announcement**

> MANGU Publishers is open. Our first books are available now — browse the catalogue and buy
> from your preferred retailer. https://www.mangu-publishers.com/books

**Post B — one per book** (repeat for each launch title)

> New from MANGU Publishers: *`TODO(renee): title`* by `TODO(renee): author`.
> `TODO(renee): one honest sentence drawn from the book's own description — not a review, not a quote, not an endorsement.`
> Read more and find retailers: https://www.mangu-publishers.com/books/`TODO(renee): slug`

**Post C — audio sample** (only for books that actually have a sample)

> There is an audio sample for *`TODO(renee): title`* on its book page.
> https://www.mangu-publishers.com/books/`TODO(renee): slug`

**Rules for every post:** no invented praise, no review quotes unless the review exists and
is quotable, no "download our app", no "start reading", no "audiobook out now", no
engagement-bait metrics. Link only to pages that exist and return 200.

---

## 4. Press / partner note (optional)

Send only if there is a real recipient. `/press` exists but was minimally published by
PR #354 — it no longer implies a brand-asset kit, because there are no assets in `/public`.
`TODO(renee):` decide whether to produce real press assets before pointing anyone at it.

> **For editors and partners**
>
> MANGU Publishers has launched at https://www.mangu-publishers.com with its first
> `TODO(renee): number` titles: `TODO(renee): launch titles`.
>
> We are an independent publisher working with a small list of authors. Each title's page
> carries its description, metadata and links to the retailers that stock it.
>
> Available on request: cover images, author biographies and metadata for the launch titles.
> `TODO(renee): confirm what can actually be supplied, and to whom requests should go.`
>
> Contact: `TODO(renee): press contact`

**Do not include:** a boilerplate paragraph with a founding date, headquarters, staff count
or funding history unless Renee supplies those facts. PR #354 left the same gap open in
`/about` for the same reason.

---

## 5. Internal launch note

Send to everyone involved before the window opens.

> **Subject: MANGU launch window — `TODO(renee): launch date`**
>
> We are promoting the release candidate to production on `TODO(renee): date/time` and
> publishing the announcement immediately after the production smoke test passes.
>
> - **Release candidate SHA:** `TODO(renee): RC SHA` — one immutable commit. If code changes, the RC changes and the affected QA re-runs (CCR-005).
> - **Launch owner:** `TODO(renee):`
> - **Incident owner:** `TODO(renee):` — reachable for the whole window; owns the rollback decision.
> - **Rollback target:** `TODO(renee): previous known-good Vercel deployment ID + SHA`
> - **Procedure:** `docs/launch/RELEASE_CHECKLIST.md`. **Rollback triggers and the rollback procedure are in §3 and §4 of that file — read them before the window, not during it.**
> - **Incident handling:** `docs/operations/INCIDENT_RESPONSE.md`.
>
> **What we are and are not claiming.** Readers buy through retailer links; there is no
> reading on our site. There are no mobile apps. Audio is samples only. The catalogue is
> small on purpose. If you are asked, those are the honest answers — please do not soften them.
>
> **If something breaks,** tell the incident owner first and do not post a correction
> publicly until they have decided. Public communication is Renee's.

---

## 6. Launch execution checklist

Run top to bottom on launch day. Nothing below "publish the announcement" happens until
everything above it is ticked.

**Before the window**

- [ ] **Confirm the release SHA.** One immutable commit; it matches the deployed production build and every gate evidence row and QA row (CCR-005).
- [ ] **Backups verified and rollback rehearsed.** Backup exists and is restorable; the previous known-good deployment ID + SHA is written down (G11, CCR-012).
- [ ] **Monitoring green.** `/api/health?ready=1` → `ready:true`; error sink receiving; scheduled health monitor pointed at the canonical production host.
- [ ] **Launch books and pricing confirmed.** 3–6 real books live, no seed/QA content, each with cover, description, genre, price and verified retailer links.
- [ ] **Stripe mode confirmed.** Test or live — decided deliberately. Endpoint URL, signing secret and the four enabled events verified in the dashboard.
- [ ] **Canonical domain confirmed.** `NEXT_PUBLIC_SITE_URL` and every canonical tag point at `https://www.mangu-publishers.com`. The apex either redirects there or is deliberately accepted as-is. No preview host appears in a canonical tag.
- [ ] **Gate evidence compiled.** `npx tsx scripts/compile-gate-evidence.ts` — read the output. It will not report readiness while a gate is unevidenced.
- [ ] **Freeze lifted** (or explicitly held) per issue #209. The freeze lifts only via controlled thaw after Release 1.0.0.

**The window**

- [ ] **Deploy / promote** the RC to production.
- [ ] **Immediate smoke test** — Step 9 of `docs/launch/RELEASE_CHECKLIST.md`. Homepage, catalog, every launch book page, login, register, `/api/health?ready=1`, one Stripe test event, admin denial as a non-admin. **Do not announce before this passes.**
- [ ] **Publish the website announcement.**
- [ ] **Post the social posts** (only to confirmed accounts).
- [ ] **Send the email** — only if every box in §2 is ticked.
- [ ] **Send the press/partner note** — only if there is a real recipient.

**After**

- [ ] **Monitor errors** — continuously for the first hour, hourly for 24 hours.
- [ ] **Monitor payments** — every Stripe event delivered and 2xx; no duplicate or incorrect charge; every paid order produced an entitlement.
- [ ] **Record the launch timestamp (UTC)** in `docs/OPERATOR_QA_LOG.md` (append-only).
- [ ] **Refresh the baseline** in `docs/NEXT_GO.md` §3 to the release SHA (G12, CCR-020).
- [ ] **Watch for a rollback trigger.** Any of the eight triggers in `docs/launch/RELEASE_CHECKLIST.md` §3 means the incident owner decides immediately.

---

## 7. Consolidated decisions requiring Renee

1. **Launch date and window**, and the timezone it is announced in.
2. **The launch titles and authors** — exact spellings, and which retailers carry each.
3. **Whether prices appear** in any public copy, and what they are.
4. **Whether the announcement email is sent at all** — this is a consent decision, not a marketing one (§2).
5. **Which social accounts MANGU controls.** PR #354 could not confirm `@mangupublishers`; an unconfirmed handle must not be printed on the site.
6. **Whether a press note goes out**, to whom, and whether real press assets exist to back it.
7. **Launch owner and incident owner** by name.
8. **Sign-off on every draft in this file.** None of it is approved copy.
