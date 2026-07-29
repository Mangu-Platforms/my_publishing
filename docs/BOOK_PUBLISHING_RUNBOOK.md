# Book Publishing Runbook

> **Task 2.6.** Operator procedure for taking a book from finished assets to live on
> `mangu-publishers.com`. Verified against `audit/2026-07-28-fixes` @ `8e6fa50`.
>
> **Read first:** `docs/BOOK_LIFECYCLE.md` (states and transitions) ·
> `docs/architecture/ADR-001-catalog-and-identity-data-ownership.md` (why verification happens on the
> public site, not the admin console). Subordinate to `docs/NEXT_GO.md` (CCR-001).

## ⚠️ Read this before you publish anything

Three defects change how you must work. They are being fixed; until they are, **the manual steps in
this runbook are the only controls.**

1. **Admin writes go to the wrong database.** `createBookAdmin`, `updateBookAdmin` and
   `updateBookStatusAction` write to Supabase; the public site reads MongoDB
   (ADR-001 §1.2). **Until Option A ships, a book published through the admin UI will not appear on
   the public site.** Do not interpret "it's published in `/admin/books`" as "it's live".
2. **Retailer links and audio do not render under MongoDB.** The catalog read path hardcodes
   `audio_url: null` and omits all six retailer URL fields (`lib/data/books.ts:436–476`).
   Task 2.0b fixes this. **Until then, retailer buttons and audio will be missing on the live page
   even when the data is correct.**
3. **The publish transition validates nothing.** `updateBookStatusAction` performs zero checks
   (`app/admin/actions.ts:42–68`). Every item in §7 is on you.

**Rule: verification is always done on the public page in an incognito/logged-out browser.** The
admin console is not evidence.

**Freeze note:** launch freeze is in effect (issue #209). Publishing a real launch book is a content
operation, not a code change, and is permitted. Any *code* fix discovered while following this
runbook goes through the freeze's permitted-change classes.

---

## 1. Roles

| Role | Responsibility |
| --- | --- |
| **Publisher / Operator** (Renee) | Final approval on every launch book. Signs §12. |
| **Editorial** | Description, genre, metadata accuracy, proofreading. |
| **Production** | Cover, EPUB, audio sample asset preparation. |
| **Engineering** | Anything requiring a code change or database access. |

---

## 2. Asset preparation checklist

Complete **before** touching the admin console. A half-prepared book creates a draft that sits in an
inconsistent state.

- [ ] Rights confirmed in writing (contract or signed release on file)
- [ ] Final manuscript approved — no further text changes expected
- [ ] Cover finalised and meeting §3 specs
- [ ] EPUB built and validated (§5)
- [ ] Audio sample cut and normalised, if the book has one (§4)
- [ ] ISBN assigned, if the book has one
- [ ] Retailer listings **live** and their URLs collected (§6.3)
- [ ] Description written, proofread, and approved by Editorial
- [ ] Genre selected from the approved list
- [ ] Price approved by the Publisher
- [ ] Author record exists with a correct `pen_name`
- [ ] Slug agreed (§6.1) — **decide now; changing it later breaks links**

---

## 3. Cover specifications

| Property | Requirement |
| --- | --- |
| **Format** | JPG or PNG |
| **Orientation** | Portrait, aspect ratio **2:3** |
| **Minimum dimensions** | **1600 × 2400 px** |
| **Maximum file size (enforced)** | **5 MB** — uploads above this are rejected |
| **Target file size (editorial)** | **≤ 2 MB** — house guideline, *not* enforced |
| **Colour** | sRGB |
| **Transparency** | None. Flatten PNGs onto a solid background. |

**Enforced ceiling vs editorial target.** The enforced maximum cover size is **5 MB**
(5,242,880 bytes). Four checks across three files set it, and they all agree; nothing in the
platform enforces a lower one:

| Where | What it says |
| --- | --- |
| `supabase/migrations/20260117000006_storage_policies.sql:4` | `book-covers` bucket created with `file_size_limit = 5242880` |
| `supabase/migrations/20260117000006_storage_policies.sql:25` | upload policy re-checks `(metadata->>'size')::BIGINT <= 5242880` |
| `types/upload.ts:68` | `UPLOAD_CONFIGS.cover.maxSize = 5 * 1024 * 1024` |
| `app/admin/books/_lib/book-validation.ts:53` | `COVER_RULES.maxBytes = 5 * 1024 * 1024`, applied by `validateCoverFile` |

`validateCoverFile` is the admin publish gate, and the offline asset-kit validator
(`scripts/lib/asset-kit.ts`) reuses it unchanged — so a cover that passes offline cannot be
refused later, and vice versa.

The bucket additionally permits `image/webp` and `image/gif`; the admin surface narrows to JPG/PNG
because those are the only formats the retailers accept. Narrowing is safe — it is a subset of
what Storage will take.

**Editorial target: aim for ≤ 2 MB.** This is a house guideline for page weight, not a limit the
platform applies. A 4 MB cover will upload, validate and publish without complaint; only the
signoff below will query it. If 2 MB should become the real limit, it has to change in the four
places above — do not restate it here as though it already has.

**Quality checks**

- [ ] Title and author legible at thumbnail size (~150 px wide)
- [ ] No visible compression artefacts at full size
- [ ] Correct edition/title — check against the manuscript, not the brief
- [ ] No placeholder text, watermark, or proof mark
- [ ] Bleed and crop marks removed

**Note:** `book-covers` is a **public** bucket. Never upload an unannounced cover you are not ready to
have discovered.

---

## 4. Audio sample specifications

Launch ships **samples only**. Full audiobook delivery and audio entitlements are post-launch.

| Property | Requirement |
| --- | --- |
| **Format** | MP3 or M4A |
| **Recommended length** | **2–5 minutes** |
| **Content** | Opening of the book, or a self-contained early passage |
| **Loudness** | Normalised; consistent across the catalog |
| **Head/tail** | Clean — no count-ins, no room tone tails |
| **Attribution** | Narrator credited in metadata |

**Checks**

- [ ] Plays start to finish without dropout
- [ ] It is the **correct book** (verify by listening, not by filename)
- [ ] Ends at a natural pause, not mid-sentence
- [ ] No spoilers beyond what the description reveals
- [ ] Narrator name and total runtime recorded for the listing

⚠️ **Blocked until Task 2.0b.** The MongoDB `Book` model has no audio fields (`types/mongo.ts:43–62`)
and `listAudiobooks()` returns `[]` under MongoDB primary (`lib/data/books.ts:691–694`). Prepare the
asset and record its metadata on the signoff; it cannot be surfaced yet.

---

## 5. EPUB handling

**Locked launch decision: there is no on-site EPUB reader.** Readers buy through retailer links.
EPUB is retained for internal asset management.

- [ ] EPUB validates (EPUBCheck clean, or exceptions documented)
- [ ] Metadata inside the file matches the listing (title, author, ISBN)
- [ ] Cover embedded
- [ ] File ≤ 50 MB (bucket limit)
- [ ] **No public "Start Reading" or "Read now" affordance is added anywhere**

> ⚠️ **Open security item.** The `published-epubs` bucket is declared **`public = true`**
> (`supabase/migrations/20260117000006_storage_policies.sql:9`). Anyone holding the object URL can
> download the complete book. **Until Renee decides** (ADR-001 §12), treat every uploaded EPUB as
> publicly reachable and **do not upload a book whose full text must not leak**.
>
> ⚠️ **No application write path for `book_content` exists** (`DATA_OWNERSHIP_MATRIX.md` §1.2).
> Attaching an EPUB requires Engineering. `createBookAdmin` appears to accept `epub_url` but writes it
> to a column that does not exist (drift D-02) — **the create will fail.** Leave the EPUB field
> blank in the admin form.

---

## 6. Metadata definitions

### 6.1 Core fields

| Field | Definition | Example |
| --- | --- | --- |
| **Title** | Exactly as it appears on the cover. No series number, no subtitle appended. | `The Salt Road` |
| **Subtitle** | ⚠️ **Not available.** `books.subtitle` exists in no migration (drift D-01) and naming it breaks the admin edit page. Fold into the title only if essential. | — |
| **Slug** | Lowercase, hyphenated, ASCII. Auto-derived from title (`lib/actions/books.ts:530–533`) but editable. **Permanent once published.** | `the-salt-road` |
| **Description** | 2–4 paragraphs of reader-facing copy. Plain prose. No HTML, no marketing superlatives that cannot be substantiated (CCR-018 / gate G6). | *"A cartographer's daughter walks…"* |
| **Genre** | One value from the approved list. Drives browse and filtering. | `Literary Fiction` |
| **Content type** | `book` \| `comic` \| `paper` (`app/admin/books/new/BookCreateForm.tsx:186–188`). Drives navigation. | `book` |
| **Price** | Decimal, USD. `0` is legitimate but must be a deliberate choice — the default is `0`. | `14.99` |
| **ISBN** | 13-digit, no hyphens. UNIQUE across the catalog. Leave blank if none. | `9781234567897` |
| **Author** | Select an existing author. ⚠️ "No author (assign later)" is offered (`BookCreateForm.tsx:154`) — **do not use it for a launch book** (lifecycle rule R6). | — |
| **Page count / word count** | Optional. ⚠️ **Not carried by MongoDB** — will not render in production (`DATA_OWNERSHIP_MATRIX.md` §2). | `312` |
| **Status** | `draft` at creation. Never create a launch book directly as `published`. | `draft` |

### 6.2 Fields you cannot set through the UI

`visibility` (derived from status — ADR-001 §2.1), `is_featured`, `trailer_vimeo_id`,
`discount_price`, `subgenres`. These require Engineering.

### 6.3 Retailer links

Six fields, all editable in the admin edit form (`lib/actions/books.ts:352–357`): `amazon_url`,
`kindle_url`, `apple_books_url`, `audible_url`, `barnes_noble_url`, `google_play_books_url`
(columns from `supabase/migrations/20260619170000_add_retailer_urls.sql`).

**Requirements — every link, every time:**

- [ ] **`https://` only.** No `http://`, no protocol-relative, no shortener.
- [ ] **Destination verified by opening it** in a logged-out browser. It must land on the product
      page for **this** book, this edition, this format.
- [ ] No affiliate/tracking parameters unless the Publisher has approved the programme.
- [ ] No region-locked URL that 404s outside one market, unless deliberate.
- [ ] Blank rather than wrong. A missing button is fine; a button to the wrong book is a defect.
- [ ] At least **one** working retailer link before publish — retailer links are the only purchase
      path at launch.

⚠️ Retailer **APIs** are post-launch. Launch is manual URLs only.
⚠️ **Task 2.0b blocker:** these will not render on the live page under MongoDB primary until 2.0b
lands (`lib/data/books.ts:436–476`). Record them on the signoff and re-verify after 2.0b.

---

## 7. Admin steps

**Prerequisite:** you are signed in with a `profiles.role = 'admin'` account
(`app/admin/actions.ts:24–32`). Rate limit: 10 book actions per minute
(`lib/actions/books.ts:24–48`).

### 7.1 Create the draft

1. Go to **`/admin/books/new`**.
2. Title, genre (**both required** — `lib/actions/books.ts:522, :525`), description, price,
   content type, author.
3. **Leave EPUB URL blank** (§5 — it will fail).
4. Status: **Draft**.
5. Save. On `DUPLICATE_SLUG`, see §8.

### 7.2 Complete the metadata

6. Go to **`/admin/books`**, find the book, open **Edit** (`/admin/books/<id>/edit`).
7. Fill ISBN, page count, word count, and all applicable retailer URLs (§6.3).
8. Save. On failure, see §8.

### 7.3 Attach assets

9. Cover: upload to the `book-covers` bucket and set `cover_url`.
   ⚠️ **`BookUploadForm` exists in the repo but is mounted on no page** — there is no working admin
   upload UI. **Cover upload currently requires Engineering.**
10. EPUB / audio: Engineering (§5, §4).

### 7.4 Preview

11. Complete the §9 preview checklist.

### 7.5 Publish

12. Complete the §10 publish checklist.
13. Publish via **either** the list Publish button (`/admin/books`) **or** the edit form status
    dropdown. Both set `status='published'` and `published_at=now()`.
14. Complete the §11 post-publish verification **on the public site**.

---

## 8. Validation troubleshooting

| Symptom | Cause | Action |
| --- | --- | --- |
| `Title is required` / `Genre is required` | Empty after trim (`lib/actions/books.ts:522, :525`) | Fill both. |
| `A book with this slug already exists` (`DUPLICATE_SLUG`) | Slug collision (`:542`). ⚠️ Seeded duplicate slugs are known to exist (`lib/data/books.ts:483–486`) | Check whether the colliding book is **seed/QA content** — if so it should be removed (`docs/launch/LAUNCH_CATALOG.md`). Otherwise choose a distinct slug **before publishing**. |
| `Slug could not be derived from title` | Title has no alphanumerics after slugification (`:535`) | Set the slug manually. |
| `Admin access required` (`FORBIDDEN`) | `profiles.role !== 'admin'` | Engineering must grant the role. Note `profiles.user_id` is the auth user id; `profiles.id` is not. |
| `Rate limit exceeded` | >10 actions/min (`:32`) | Wait 60 seconds. |
| **Edit page 404s or errors on load** | The explicit select names `subtitle`, which exists in no migration (drift D-01) | **Engineering.** Cannot be worked around from the UI. |
| **Save fails mentioning `epub_url`** | Drift D-02 | Clear the EPUB field. |
| **Save fails mentioning `deleted_at`** | Drift D-03 — the existence check reads a nonexistent column | **Engineering.** |
| **Unpublish button does nothing** | `updateBookStatusAction` returns silently on an unaccepted status (`app/admin/actions.ts:48–50`) | See `BOOK_LIFECYCLE.md` §2. Use the edit form. |
| **Published but not on the public site** | The Task 1.0 blocker (ADR-001 §1.2), **or** `visibility != 'public'` | Check `GET /api/books` — if it returns `"provider":"mongodb"` and your book was written via the admin UI, this is the known blocker. **Escalate to Engineering; do not retry.** |
| Retailer buttons missing on the live page | Task 2.0b (`lib/data/books.ts:436–476`) | Expected until 2.0b. Record on the signoff. |
| Audio player missing | Task 2.0b (`lib/data/books.ts:467, :691–694`) | Expected until 2.0b. |

---

## 9. Preview checklist (while still `draft`)

Confirm in the admin console:

- [ ] Title, slug, description, genre, price, content type, author all correct
- [ ] ISBN correct, or deliberately blank
- [ ] `cover_url` resolves — open it directly, confirm the right cover
- [ ] Every retailer URL opens the correct product page (§6.3)
- [ ] Description proofread by someone other than its author
- [ ] Price matches the approved price
- [ ] No placeholder text anywhere ("Lorem", "TBD", "Test", "Sample")

And confirm the draft is **not** publicly reachable:

- [ ] In an **incognito** window, `/books/<slug>` returns **not found** — not the book
- [ ] `GET /api/books` does **not** include it
- [ ] It does not appear in `/books`, genre pages, or search

> If a draft **is** publicly visible, **stop**. That is a security defect of the class PR #350 fixed.
> Escalate to Engineering immediately.

---

## 10. Publish checklist

- [ ] §9 preview checklist complete
- [ ] §2 asset preparation complete
- [ ] Rights confirmed **in writing**
- [ ] Publisher has approved: description, genre, price, cover
- [ ] At least one verified retailer link (§6.3)
- [ ] Author record exists with correct `pen_name`
- [ ] Slug is final — **it does not change after this point**
- [ ] Book is on `docs/launch/LAUNCH_CATALOG.md` and marked launch-approved (launch books only)
- [ ] Publishing will not exceed the 3–6 launch-approved limit
- [ ] A rollback decision-maker is reachable for the next hour

Publish → then §11 **immediately**.

---

## 11. Post-publish verification

**All of this in an incognito / logged-out browser.** The admin console is not evidence.

- [ ] `https://mangu-publishers.com/books/<slug>` loads and is **the right book**
- [ ] Cover renders (not a broken image, not a placeholder)
- [ ] Description renders correctly — no raw HTML, no mojibake
- [ ] Price displays and matches the approved price
- [ ] Author name displays and links correctly
- [ ] Retailer buttons render and each opens the correct product page ⚠️ *(expected missing until Task 2.0b)*
- [ ] Audio sample plays, if applicable ⚠️ *(expected missing until Task 2.0b)*
- [ ] **No "Start Reading" / reader affordance appears** (locked launch decision)
- [ ] The book appears in `/books`
- [ ] It appears on its genre page
- [ ] It appears in on-site search, if search is in launch scope
- [ ] `GET /api/books` includes it — **record the `"provider"` value**
- [ ] `published_at` is set and correct
- [ ] No console errors on the book page
- [ ] Mobile viewport renders correctly

**Record the result on the §12 signoff and append a row to `docs/OPERATOR_QA_LOG.md`** (append-only,
CCR-002): UTC timestamp, actor, environment, exact SHA, action, expected, actual, result, artifact.

---

## 12. Update procedure (already-published book)

1. Identify what is changing and why.
2. **Slug changes:** 🚫 default answer is **no**. A slug change breaks every existing link, every
   retailer-side backlink, and every shared URL, with **no redirect implemented**
   (`BOOK_LIFECYCLE.md` R4). If it is unavoidable, it needs Renee's approval and an Engineering plan
   for redirects.
3. Price changes: confirm with the Publisher; check retailer prices for consistency.
4. Cover/description changes: same review as the original approval (§10).
5. Edit via `/admin/books/<id>/edit`, save, then **re-run §11** for the changed fields.
6. Append an evidence row to `docs/OPERATOR_QA_LOG.md`.

---

## 13. Unpublish procedure

**Use `archived`. Never delete.**

1. Record the reason — required for the audit trail (`BOOK_LIFECYCLE.md` §8).
2. Get Publisher approval. Unpublishing a book buyers already own is a customer-facing event.
3. Open `/admin/books/<id>/edit`, set status to **Archived**, save.
   ⚠️ The list's **Unpublish** button sets `draft`, **not** `archived`
   (`app/admin/books/page.tsx:118`) — see `BOOK_LIFECYCLE.md` §2. Use the edit form.
4. ⚠️ **Known defect:** unpublishing **nulls `published_at`** (`app/admin/actions.ts:57`),
   permanently losing the original publication date. **Record the original date on the signoff
   before unpublishing** so it can be restored.
5. Verify in incognito: `/books/<slug>` no longer resolves; the book is gone from `/books`, genre
   pages, and `GET /api/books`.
6. **Confirm existing buyers retain access.** Orders and entitlements must survive
   (`BOOK_LIFECYCLE.md` R3). Verify with a real entitled account.
7. Append to `docs/OPERATOR_QA_LOG.md`.

---

## 14. Rollback

### 14.1 Roll back a publish (published in error)

1. Set status to **Draft** immediately (list Publish/Unpublish toggle is fastest).
2. Verify in incognito that the page is gone.
3. If anyone purchased in the window, **honour the purchase** — do not revoke.
4. Record the incident in `docs/OPERATOR_QA_LOG.md` with the exposure window.
5. Fix, then re-run §9–§11 in full.

### 14.2 Roll back a metadata change

There is **no version history on book records.** Restoring means re-entering the previous values by
hand. **Therefore: capture the before-state (§12 signoff) before every edit to a published book.**

### 14.3 Roll back an unpublish

Set status back to `published`. ⚠️ This writes a **new** `published_at`
(`app/admin/actions.ts:57`) — restore the original date from the signoff, via Engineering.

### 14.4 Platform rollback

Out of scope here. See `docs/ROLLBACK.md` and gate G11.

---

## 15. Emergency correction

Use for: wrong book published, rights problem, defamatory or unlawful content, wrong price causing
real financial exposure, leaked unannounced title.

1. **Take it down first, investigate second.** Set status to `draft` via `/admin/books`. Seconds
   matter more than process.
2. Verify removal in incognito: book page, `/books`, genre pages, `GET /api/books`.
3. Notify Renee immediately — do not wait for a full diagnosis.
4. If the EPUB may have leaked, remember the `published-epubs` bucket is **public** (§5): the object
   URL remains valid until the object is removed. **Engineering must delete the object**, not just
   unpublish the book.
5. If purchases occurred: pause further sales, list affected orders (`/admin/orders`), decide on
   refunds with the Publisher.
6. Contact retailers if the listing is live on their side — retailer takedown is **not** controlled
   from this system.
7. Write the incident up in `docs/OPERATOR_QA_LOG.md`: what, when, exposure window, who was
   affected, what was done.
8. Post-incident: agree which control would have caught it, and add it to §10.

**Escalation:** Publisher (Renee) → Engineering → Legal (rights/content).

---

## 16. Per-book signoff template

Copy per book. Attach to `docs/launch/LAUNCH_CATALOG.md` and reference from
`docs/OPERATOR_QA_LOG.md`.

```
BOOK PUBLISHING SIGNOFF
=======================
Title:                        ______________________________
Slug:                         ______________________________
Book ID:                      ______________________________
Author (pen name):            ______________________________
ISBN:                         ______________________________
Content type:                 book / comic / paper
Launch catalog entry?         YES / NO

RIGHTS
  Rights confirmed in writing        [ ]  Ref: ______________
  Contract/release on file           [ ]  Location: _________
  Confirmed by: ____________________  Date: ______________

METADATA
  Title final                        [ ]
  Slug final (permanent)             [ ]
  Description approved               [ ]  By: ______________
  Genre approved                     [ ]  Value: ___________
  Price approved                     [ ]  Value: $__________
  Content type set                   [ ]
  Author resolves to real record     [ ]

ASSETS
  Cover: JPG/PNG, 2:3, >=1600x2400, <=5MB   [ ]  (5MB = enforced limit)
  Cover <=2MB editorial target               [ ]  advisory, not enforced
  Cover legible at thumbnail                [ ]
  cover_url resolves over HTTPS             [ ]
  EPUB validated (internal only)            [ ]  N/A [ ]
  Audio sample 2-5 min, verified            [ ]  N/A [ ]
    Narrator: ______________  Runtime: __________

RETAILER LINKS  (https only; destination opened and verified)
  amazon_url               [ ] verified   [ ] n/a
  kindle_url               [ ] verified   [ ] n/a
  apple_books_url          [ ] verified   [ ] n/a
  audible_url              [ ] verified   [ ] n/a
  barnes_noble_url         [ ] verified   [ ] n/a
  google_play_books_url    [ ] verified   [ ] n/a
  At least one live link                    [ ]

PRE-PUBLISH
  Preview checklist (§9) complete           [ ]
  Draft confirmed NOT publicly visible      [ ]
  Publish checklist (§10) complete          [ ]

PUBLISH
  Published at (UTC):        ______________________________
  published_at recorded:     ______________________________
  Published by:              ______________________________
  Release/commit SHA:        ______________________________

POST-PUBLISH VERIFICATION  (incognito, public site)
  /books/<slug> loads, correct book          [ ]
  Cover renders                              [ ]
  Description renders correctly              [ ]
  Price correct                              [ ]
  Author displays and links                  [ ]
  Retailer buttons render                    [ ]  BLOCKED-2.0b [ ]
  Audio sample plays                         [ ]  BLOCKED-2.0b [ ]  N/A [ ]
  No "Start Reading" affordance present      [ ]
  Appears in /books                          [ ]
  Appears on genre page                      [ ]
  Appears in GET /api/books                  [ ]
    provider value returned: ________________
  No console errors                          [ ]
  Mobile viewport correct                    [ ]

BEFORE-STATE CAPTURE  (required before any later edit)
  Original published_at:     ______________________________
  Original price:            ______________________________
  Original slug:             ______________________________

KNOWN BLOCKERS ACCEPTED
  Task 1.0 admin-write provider mismatch     [ ] N/A  [ ] accepted
  Task 2.0b retailer/audio not rendering     [ ] N/A  [ ] accepted
  Notes: _______________________________________________

SIGNOFF
  Editorial:   ____________________  Date: ______________
  Production:  ____________________  Date: ______________
  Publisher:   ____________________  Date: ______________

  Evidence row appended to docs/OPERATOR_QA_LOG.md   [ ]
```

---

## 17. Open items requiring Renee

1. **`published-epubs` is a public bucket** (§5) — decide: make private + signed URLs, or accept
   with recorded residual risk.
2. **No admin upload UI** (§7.3) — `BookUploadForm` is mounted nowhere. Accept Engineering-assisted
   cover upload for a 3–6 book launch, or ask for it to be wired up.
3. **No `book_content` write path** (§5) — accept out-of-band EPUB/audio attachment, or ask for it
   to be built.
4. **Publish validation is entirely manual** (§7 preamble) — accept the manual gate for launch, or
   require server-side validation before G10 sign-off.
5. **`published_at` is destroyed on unpublish** (§13.4) — confirm the fix, and confirm whether
   re-publishing should keep the original date.
