# Author Profile & Homepage Spotlight Specification

> **Task 4.5.** What a complete public author profile requires before an author may appear
> publicly at launch, and what the homepage spotlight must satisfy.
>
> This is a specification, not a change. It does not modify `components/` or `app/`.
> Every claim about current behaviour below was read from the repository at `8e6fa50`
> (branch `audit/2026-07-28-fixes`, head of PR #350) and is cited.

An incomplete author profile on a public page is a **false-success surface** under CCR-018
and blocks **G6** ("No false-success public forms/claims"). A profile that fills its gaps
with generic filler is worse than one that shows nothing, because the filler reads as fact.

---

## 1. What exists today (verified)

| Surface | Path |
| --- | --- |
| Author directory | `app/(consumer)/authors/page.tsx` → `/authors` |
| Author profile | `app/(consumer)/authors/[id]/page.tsx` → `/authors/<id>` |
| Homepage spotlight | `components/home/AuthorSpotlight.tsx` |
| Data access | `lib/data/authors.ts` (dual-run: Supabase by default, Mongo when `DATABASE_PROVIDER=mongodb`) |

Fields the author record actually carries (`lib/data/authors.ts`):
`id` · `profile_id` · `pen_name` · `bio` · `photo_url` · `is_verified` · `total_books` ·
`created_at` · `profile.full_name`.

**There is no field for an author's website or social links anywhere in the model.** That is
a gap, not an oversight to be papered over — see §3.

---

## 2. A complete public author profile

An author profile is **complete** only when every REQUIRED row is satisfied. Anything less
means the author is not published publicly at launch.

| # | Requirement | Level | Detail |
| --- | --- | --- | --- |
| 1 | **Name** | REQUIRED | The name the author has approved for publication, spelled as they wish. `pen_name` is what the site renders; `profile.full_name` is shown separately only when it differs. Never derive a display name from an email, a username or a filename. |
| 2 | **Approved headshot** | REQUIRED | A real photograph or approved likeness in `photo_url`, hosted over https, with publication rights confirmed. If no approved image exists, the profile shows the initials fallback — it must never show a stock photo, a generated face, or another person's image. |
| 3 | **Image alt text** | REQUIRED | Meaningful alternative text on the headshot. The profile page currently passes the display name as `alt`, which is acceptable but minimal. Alt text is never empty and never "image" or "photo". Accessibility of critical states is a control (CCR-019). |
| 4 | **Biography** | REQUIRED | Written or approved by the author, factual, and specific to that person. **No generated, templated or placeholder biography may be published.** If no bio exists, the page must say so plainly rather than invent one. |
| 5 | **Associated books** | REQUIRED | At least one **published, public** book actually attributed to this author and reachable from the profile. An author page listing zero books is a dead end and must not be linked from any public surface at launch. |
| 6 | **Approved links only** | REQUIRED-IF-PRESENT | Any outbound link is https, resolves, and is one the author has explicitly approved. No inferred handles, no guessed personal sites, no unverified retailer author pages. **No link field exists in the model today** — see §3. |
| 7 | **No placeholder content** | REQUIRED | No "Coming soon", no lorem text, no test/QA identity, no `TODO`. |
| 8 | **Consistency across surfaces** | REQUIRED | The name, headshot and book list are the same on `/authors`, `/authors/<id>` and the homepage spotlight. A different bio in two places means at least one is wrong. |
| 9 | **Verification flag is accurate** | REQUIRED | `is_verified` gates the homepage spotlight (`listFeaturedAuthors` filters `is_verified = true`). It must reflect a real editorial decision, not be set to make a card appear. |
| 10 | **No PII beyond what was approved** | REQUIRED | No personal address, phone number or private email in a bio or a link (CCR-015). |

### Honest empty states

Where an optional element is absent, the page states the absence or omits the element. It
never substitutes filler. The profile page's existing `'This author has not shared a bio
yet.'` is the correct pattern; the spotlight's `'An amazing author contributing to our
platform.'` (see §5) is the incorrect one.

---

## 3. Gap: approved links have nowhere to live

`lib/data/authors.ts` exposes no website, social or external-profile field on either
provider, and neither `/authors/<id>` nor the spotlight renders one. So requirement 6 is
currently satisfiable only by having **no links at all**, which is an acceptable launch
state — but it must be a decision, not a discovery.

`TODO(renee):` decide one of:

1. **Launch with no author links.** Cheapest, fully honest, nothing to build. Recommended if no author has asked for one.
2. **Add an approved-links field** (an allow-listed, https-only list, validated at write time the way `lib/books/fields.ts` normalises retailer URLs in PR #356). This is a schema change, and **no new migration may be created until Task 3.6 / issue #192 is resolved** — so it is post-launch unless that unblocks first.

Whichever is chosen, the rule stands: a link is published only if the author approved that
exact destination.

---

## 4. Homepage spotlight requirements

The spotlight is the highest-traffic author surface. It must satisfy all of:

| # | Requirement |
| --- | --- |
| S1 | **A real launch book and a real launch author.** Every author shown has at least one published, public book that is part of the approved launch catalog (`docs/launch/LAUNCH_CATALOG.md`). No seed or QA identity. |
| S2 | **An active destination.** Every card links to a profile that returns **200** and is complete per §2. A card linking to a 404 is a broken promise on the homepage. |
| S3 | **A responsive image.** The headshot renders correctly at mobile, tablet and desktop widths, is not distorted, and carries alt text. Where no approved image exists, the initials fallback is used — the card must not break, stretch or show a broken-image icon. |
| S4 | **No placeholder claims.** No invented bio, no "featured soon", no fabricated counts, no superlative the site cannot support. Book counts shown are the real published count. |
| S5 | **Degrade to nothing.** When there is no real content to show, the section renders **nothing** — not an empty-state teaser. A heading with an apology under it still occupies the homepage claiming a feature exists. |
| S6 | **Consistent with the catalog.** Spotlight authors and their book counts agree with `/books` and `/authors`. |

---

## 5. Current behaviour — and a correction to the brief

**Correction.** It is commonly stated that "the spotlight component degrades to nothing when
there is no real content." **That is not true on `audit/2026-07-28-fixes` (`8e6fa50`).**
At that commit `components/home/AuthorSpotlight.tsx` does the opposite in two places:

1. When `listFeaturedAuthors(4)` returns an empty array (including when it **throws** — the
   error is caught and flattened to `[]`), the component renders a full section with the
   heading "Author Spotlight" and the copy **"Our authors will be featured here soon. Stay
   tuned!"**. That violates **S5**, and it renders identically whether there are genuinely
   no authors or the database is down — an outage presented as a content state.
2. Per card, when `author.bio` is null it substitutes **"An amazing author contributing to
   our platform."** That is a fabricated biography published under a real person's name.
   It violates **S4** and requirement 4.

**The correct statement is:** PR **#354** ("Task 4.6: make marketing pages truthful")
changes `AuthorSpotlight` so it requires at least one published book, never invents a bio,
and renders nothing when empty. **The degrade-to-nothing behaviour arrives with #354; it
does not exist on the base branch.** Until #354 merges, S4 and S5 are unmet.

**A second, separate finding.** The spotlight cannot show a headshot at all today. The
`FeaturedAuthor` type in `lib/data/authors.ts` does **not** include `photo_url` (only
`DirectoryAuthor` and `AuthorDetail` do), and the card renders the first letter of
`pen_name` in a circle instead of an image. So **S3 is unmet by construction**, independently
of #354. `TODO(renee):` decide whether launch requires real headshots in the spotlight — if
yes, `listFeaturedAuthors` must select `photo_url` and the card must render it. That is a
change to `lib/` and `components/`, owned elsewhere, and is **not** made by this document.

**Third finding — QA identities are live.** The production catalog is currently 100% seed
data (PR #353, probed 2026-07-28), and PR #350 recorded that a QA author profile 404s while
a "Test Author" profile works. Both are S1 and S2 violations that will be visible on the
homepage until the launch catalog replaces the seed records.

---

## 6. Acceptance rule

> **Every author whose profile is publicly reachable at launch has a complete profile per
> §2, and the homepage contains no QA or test content.**

Checked as follows, by a human, against the release candidate SHA (CCR-005, CCR-014):

- [ ] Enumerate every author reachable from `/authors`, from any launch book page, and from the homepage spotlight.
- [ ] For each: name, approved headshot (or the initials fallback), alt text, real biography, at least one published public book, only approved links, no placeholder text.
- [ ] Every spotlight card's destination returns 200 and the profile is complete.
- [ ] The spotlight renders nothing rather than an empty-state teaser when there is no real content (requires #354).
- [ ] No seed or QA author, book or identity appears anywhere on the homepage, `/authors`, or `/books`.
- [ ] Headshots render correctly at mobile, tablet and desktop widths.
- [ ] Author names, bios and book counts agree across `/`, `/authors` and `/authors/<id>`.
- [ ] `npx tsx scripts/crawl-regression.ts` (after PR #355) reports no broken internal link or asset on any author route.

**Any unchecked box means an author is not published publicly at launch.** Removing an
author from the public surface is always available and is always preferable to publishing an
incomplete profile.

Record the result as a row in `docs/OPERATOR_QA_LOG.md` (append-only, CCR-002) citing the RC
SHA, the environment, the tester and evidence. This document is not evidence.

---

## 7. Decisions requiring Renee

1. **Author links** — launch with none, or wait for a schema change post-Task 3.6 (§3).
2. **Headshots in the spotlight** — required at launch, or accept the initials fallback (§5, second finding).
3. **Which authors are launch authors**, and confirmation that each has approved their name, headshot and biography for publication.
4. **Seed/QA author removal order** — the seed authors back the current catalog; removing them before the real books exist empties the homepage (PR #353 finding).
5. **Homepage statistics** — issue **#204** (P0-014, G6, "Replace/remove contradictory homepage statistics") is open, while PR #354 states the "0 Books / 0 Authors" band and the genre tile counts were confirmed non-bugs and left untouched. These need reconciling before G6 can be evidenced; a homepage stat that contradicts a 3–6 book catalog is a false claim.
