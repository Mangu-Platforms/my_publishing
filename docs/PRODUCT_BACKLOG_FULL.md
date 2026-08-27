# MANGU Publishers — Full product backlog

Repo: `Mangu-Publishing-House/my_publishing`  
Personas: Guest, Reader, Author, Partner, Admin, Operator.  
Status key: **SHIPPED-UNPROVEN** · **FLAGGED** · **MISSING** · **ENHANCE** · **POST-GO** · **OUT OF REPO**

**Rule:** Claude Code does not pull from this file until Epic 0 in `docs/CLAUDE_NOW.md` is evidenced.

---

## Epic 0 — Launch truth
See `docs/CLAUDE_NOW.md`. US-0.1–US-0.9. This is the product until GO.

## Epic 1 — Guest / discovery
- US-1.1 Browse published books without account. SHIPPED-UNPROVEN
- US-1.2 Search title, author, keyword. SHIPPED-UNPROVEN
- US-1.3 Filter genre/category; sort new / price / popular. ENHANCE if sort is incomplete
- US-1.4 Cover, blurb, author, price, format (ebook / audio / both)
- US-1.5 Sample or preview (first chapter or % cap). MISSING if only full-file after purchase
- US-1.6 Retailer links when also sold elsewhere
- US-1.7 Phone usable; focus, contrast, alt text
- US-1.8 404 that is not a crash
- US-1.9 Title, description, canonical, OG image on book pages. ENHANCE
- US-1.10 Shareable book URL opens the same title
- US-1.11 Sitemap excludes unpublished / slug-less books
- US-1.12 Genre pages soft-404 when empty
- US-1.13 Honest empty catalog (no fake counts)
- US-1.14 JSON-LD Book schema
- US-1.15 hreflang only if you actually sell multi-locale
- US-1.16 Price shown in one currency for v1; no silent zero
- US-1.17 Content warning visible before sample if flagged
- US-1.18 Age-gate interstitial for restricted titles
- US-1.19 Series page lists volumes in order. POST-GO
- US-1.20 Author public page: bio, titles, follow CTA

## Epic 2 — Account
- US-2.1 Register email + password
- US-2.2 Email verification; correct host; PKCE callback
- US-2.3 Login / logout; session cookie not in URL
- US-2.4 Password reset; expired token fails honestly
- US-2.5 Edit display name, avatar, timezone
- US-2.6 GDPR data export. MISSING
- US-2.7 Delete account + entitlement rows. MISSING
- US-2.8 Social login (Google). POST-GO
- US-2.9 Magic link. POST-GO
- US-2.10 Session list / revoke other devices. ENHANCE
- US-2.11 Change email with re-verify. ENHANCE
- US-2.12 2FA optional. POST-GO
- US-2.13 Role visible to user (“you are a reader”)
- US-2.14 Ban / suspend shows a real reason page

## Epic 3 — Buy and own
- US-3.1 Single-item checkout for v1
- US-3.2 Pay with Stripe card
- US-3.3 Confirmation: last4, amount, title
- US-3.4 Library item within seconds of webhook
- US-3.5 Free / $0 grant without Stripe. ENHANCE
- US-3.6 Promo code. ENHANCE
- US-3.7 Gift to an email. POST-GO
- US-3.8 Bundle ebook + audio. POST-GO
- US-3.9 Preorder: pay now, unlock on date. POST-GO
- US-3.10 Invoice / VAT receipt. ENHANCE
- US-3.11 Failed payment: real reason + retry
- US-3.12 Self-serve refund request → entitlement off. ENHANCE (admin refund is launch)
- US-3.13 Webhook idempotent; replay safe
- US-3.14 Unsigned webhook 400
- US-3.15 Chargeback / dispute auto-revoke. POST-GO playbook
- US-3.16 Cart of multiple titles. POST-GO
- US-3.17 Saved payment method. POST-GO
- US-3.18 Regional price. POST-GO
- US-3.19 Store credit. POST-GO
- US-3.20 Order history page with status machine

## Epic 4 — Reader (ebook)
- US-4.1 Open entitled EPUB/PDF in web reader
- US-4.2 Resume last position on this device
- US-4.3 Progress sync across devices. ENHANCE
- US-4.4 TOC / chapter jump
- US-4.5 Font size, sepia / dark / light, margins. ENHANCE
- US-4.6 Bookmark
- US-4.7 Highlight + note
- US-4.8 Search inside book. ENHANCE
- US-4.9 Offline download. POST-GO (legal + DRM first)
- US-4.10 Keyboard shortcuts + screen-reader structure
- US-4.11 Cannot hotlink storage object without entitlement
- US-4.12 Page vs scroll mode. ENHANCE
- US-4.13 CFI / locator stable across file replacements
- US-4.14 Reader does not leak title bytes in URL
- US-4.15 Signed short-lived file URL, not public bucket

## Epic 5 — Audiobook
Treat as FLAGGED until a file exists in prod.
- US-5.1 Persistent mini-player for entitled audio
- US-5.2 Speed, sleep timer, ±15s, chapter marks, resume
- US-5.3 Media Session / lock screen. ENHANCE
- US-5.4 Offline download. POST-GO
- US-5.5 Author upload + chapter CSV. MISSING if only consumer player
- US-5.6 Honest “audio coming soon” when file missing (G6)
- US-5.7 Transcript / captions if supplied. POST-GO

## Epic 6 — Library and reading life
- US-6.1 Library lists owned titles + progress
- US-6.2 Wishlist
- US-6.3 Continue-reading rail
- US-6.4 Follow author; new-release signal
- US-6.5 Goal / streak. POST-GO
- US-6.6 Export highlights. ENHANCE
- US-6.7 Hide / archive without losing entitlement
- US-6.8 Sort library by recent / title / author / progress
- US-6.9 Family / household library. POST-GO
- US-6.10 Reading stats private by default

## Epic 7 — Reviews
- US-7.1 Star rating after purchase
- US-7.2 Written review; verified-purchase badge
- US-7.3 Helpful vote
- US-7.4 Author reply
- US-7.5 Sort / paginate
- US-7.6 Report abuse; admin hide. ENHANCE
- US-7.7 Cannot review unpaid (or label unpaid)
- US-7.8 Edit / delete own review
- US-7.9 Rating distribution histogram

## Epic 8 — Recommendations (Resonance)
- US-8.1 “Because you read…” when embeddings exist
- US-8.2 Trending / editorial rails if OpenAI key absent — no empty error
- US-8.3 Impression + click events
- US-8.4 Admin pin editorial rail. ENHANCE
- US-8.5 Hide this recommendation. POST-GO
- US-8.6 Cold-start rail for guests

## Epic 9 — Author portal
- US-9.1 Become an author (apply or admin grant)
- US-9.2 Submit manuscript + cover + metadata + pricing
- US-9.3 Status: draft / submitted / needs changes / scheduled / live
- US-9.4 Replace files before approval
- US-9.5 Sales, reads, refunds on own titles only
- US-9.6 Email on new review (Resend). FLAGGED
- US-9.7 Request payout; see ledger. Schema exists; Connect POST-GO
- US-9.8 Series / universe. POST-GO
- US-9.9 Co-author split. POST-GO
- US-9.10 Schedule publish date. ENHANCE
- US-9.11 Unpublish (hide from catalog; owners keep access)
- US-9.12 Content warnings + age gate fields. ENHANCE
- US-9.13 Author agreement accepted at first submission
- US-9.14 ISBN / ASIN optional fields
- US-9.15 Territory rights field. POST-GO

## Epic 10 — Partner / ARC
- US-10.1 Partner requests ARC
- US-10.2 Time-boxed access after approve
- US-10.3 No download after expiry
- US-10.4 Partner export is partner-only (launch gate)
- US-10.5 Track which ARCs produced a review. ENHANCE
- US-10.6 NDA checkbox. ENHANCE

## Epic 11 — Admin
- US-11.1 Approve / reject / request changes
- US-11.2 Edit metadata; legal takedown
- US-11.3 Impersonation forbidden; view-as read-only if present
- US-11.4 User lookup: role, orders, ban
- US-11.5 Refund + revoke entitlement
- US-11.6 Feature flags without deploy. ENHANCE
- US-11.7 Catalog health: missing cover, zero price, orphan file
- US-11.8 Audit log UI. MISSING as first-class UI
- US-11.9 Ban list / rate-limit visibility
- US-11.10 Grant / revoke author / partner / admin
- US-11.11 Coupon admin. ENHANCE
- US-11.12 Force-unpublish + legal hold

## Epic 12 — Email
- US-12.1 Welcome. FLAGGED on Resend
- US-12.2 Purchase receipt
- US-12.3 Author: received / approved / review / payout
- US-12.4 Newsletter double opt-in + preference center
- US-12.5 One reset template — provider or Resend, not both
- US-12.6 No “check your inbox” if no mailer fired
- US-12.7 Unsubscribe works
- US-12.8 Bounce / complaint handling. POST-GO

## Epic 13 — Money after launch (POST-GO)
- US-13.1 Stripe Connect onboarding; stated split
- US-13.2 Minimum payout + weekly schedule
- US-13.3 Stripe Tax + 1099/W-8 story
- US-13.4 Subscriptions / membership
- US-13.5 Store credit
- US-13.6 Multi-currency display
- US-13.7 Chargeback playbook
- US-13.8 Author withholding / reserve

## Epic 14 — Rights, legal, trust
- US-14.1 Public ToS, privacy, cookies, DMCA
- US-14.2 Author agreement at first submission
- US-14.3 Copyright owner + takedown workflow
- US-14.4 Accessibility statement
- US-14.5 Age-restricted catalog path
- US-14.6 Territory rights enforcement. POST-GO
- US-14.7 Cookie / session audit
- US-14.8 Data processing map for GDPR request
- US-14.9 CSAM / abuse report routing

## Epic 15 — Platform quality
- US-15.1 RLS: buyer sees own order_items only (#199)
- US-15.2 Rate limit fail-closed when Redis dies (#195)
- US-15.3 Sentry release = git SHA
- US-15.4 Uptime check on ready probe
- US-15.5 PITR on + storage versioning + restore drill
- US-15.6 Dependabot majors after GO only
- US-15.7 MCP public transport off unless flagged
- US-15.8 No NEXT_PUBLIC_ secret leaks
- US-15.9 Error pages never render raw `error.message`
- US-15.10 CSP allows only required origins
- US-15.11 www canonical; apex 308
- US-15.12 Backup restore drill logged quarterly

## Epic 16 — Keep out of this repo
OUT OF REPO: native iOS/Android, full social network, in-house SMTP, Foundry as storefront, Mongo cutover as launch blocker, Hathor, twelve parallel product streams.

---

## Enterprise “done” test (stranger, this month)

A stranger can register, buy a book, land in library, and read.  
An author can submit. Admin RBAC holds. Refunds revoke. www is canonical. Rollback rehearsed.

That test is Epic 0. Everything else is after GO.
