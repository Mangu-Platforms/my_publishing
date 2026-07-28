# Book asset kit — handover specification

**Status:** definitive for launch. One asset kit per book, 3–6 books at launch.
**Template to copy:** [`asset-kit-template/`](./asset-kit-template/)
**Machine check:** `npx tsx scripts/validate-asset-kit.ts <kit-folder>`

---

## 1. What an asset kit is

One folder per book, containing everything needed to create that book's catalog
entry and product page in a single pass. If a kit is complete, an operator can
create the book in `/admin/books` without asking the publisher a single
question. If a kit is incomplete, the validator says exactly what is missing
before anyone's time is spent.

```
the-lantern-of-quiet-harbours/
├─ book.json     all metadata (comments allowed — they are stripped on parse)
├─ cover.jpg     the final cover
└─ book.epub     the final EPUB (internal asset — see §4.2)
```

Books are sold through **external retailer links** (Amazon, Kindle, Apple Books,
Google Play Books, Barnes & Noble, Audible). There is **no on-site reader at
launch**, so the EPUB is an internal archive asset and not a customer
deliverable. Audiobook **samples** ship at launch; full audiobooks do not.

### Two rules that override everything else

1. **Nothing draft may enter a kit.** Every file is the final approved version:
   no watermark, no "DRAFT"/"PROOF"/"UNCORRECTED" band, no comp-license or
   stock-photo overlay, no placeholder copy, no "TK", no lorem ipsum, no
   temporary pricing, no "coming soon" text. A watermark that reaches the
   catalog is visible to every visitor and to every retailer that scrapes us.
2. **Every retailer URL must be opened and confirmed before submission.** Open
   each link in a browser and check it lands on *this* book — correct title,
   correct author, correct edition, correct format. No offline tool can verify
   where a URL points, which is why `approval.retailer_links_opened` is an
   attestation a person signs rather than a check a script runs.

### Where the rules come from

The validator does not have its own opinions. It imports
`app/admin/books/_lib/book-validation.ts` — the exact module the admin publish
screen and the server write path use — and runs it unchanged. Anything it adds
on top is tagged `intake` in its output and is listed in §6.

Field-level constraints below cite the file that defines them. Nothing in this
document is an invented limit; where a limit genuinely does not exist in the
codebase it is called out in §8 as needing a decision rather than guessed at.

---

## 2. Identity and copy

| Field | Type | Required | Max length | Validation rule | Where it appears publicly | Example |
| --- | --- | --- | --- | --- | --- | --- |
| `title` | string | **Required** | 200 (`CreateBookSchema`, `types/books.ts`) | Non-empty after trim. Blocker if absent. | PDP `<h1>`, browser tab, every card, OG/Twitter title, search results | `The Lantern of Quiet Harbours` |
| `slug` | string | Optional | 120 (`isValidSlug`, `book-validation.ts`) | Lowercase letters, digits, single hyphens (`/^[a-z0-9]+(?:-[a-z0-9]+)*$/`). Blank ⇒ derived from `title` by `slugifyBookTitle` in `lib/books/fields.ts`. **UNIQUE** across the catalog (`books.slug TEXT UNIQUE NOT NULL`, `supabase/migrations/20260116000000_initial_schema.sql`). | The public URL: `/books/<slug>`, and the canonical link tag | `""` (derived: `the-lantern-of-quiet-harbours`) |
| `author.pen_name` | string | **Required** | — | Non-empty. Drives the author blocker. | PDP byline, cards, OG description fallback | `A. N. Example` |
| `author.legal_name` | string | Optional | — | — | Never public. Rights record only. | `Example Author Ltd` |
| `author.admin_author_id` | string | Operator | — | The `authors` row id. Publisher leaves it blank; the operator fills it in after creating the author. Warning by default, blocker under `--require-author-id`. | Not public | `""` |
| `genre` | string | **Required** | — | Non-empty. `books.genre TEXT NOT NULL`. Blocker if absent. | PDP genre line, genre filters, "similar books" | `Literary Fiction` |
| `content_type` | enum | **Required** | — | One of `book`, `comic`, `paper` (`CONTENT_TYPES`, `lib/books/fields.ts`). | Determines which product surface the title uses | `book` |
| `description` | string | **Required** | 5000 (`CreateBookSchema`, `types/books.ts`) | Non-empty. Blocker if absent. Final sales copy. | PDP description block; the fallback meta description if `seo.description` is blank | *(full jacket copy)* |
| `short_description` | string | Recommended | ~200 (**guidance only — see §8**) | Warning if absent or long. | Cards and share previews *(no column yet — §8)* | `A lighthouse keeper on a forgotten coast learns what her light has really been guiding.` |

> **There is no `subtitle` field.** `books.subtitle` exists in no migration and
> was deliberately removed from the admin surface (`lib/books/fields.ts`,
> `MONGO_BOOK_EXTRA_WRITE_FIELDS`). A `subtitle` key in `book.json` is a
> blocker. Fold it into the title or the opening line of the description.

---

## 3. Commercial

| Field | Type | Required | Max length | Validation rule | Where it appears publicly | Example |
| --- | --- | --- | --- | --- | --- | --- |
| `price` | **string** | **Required** | 7 whole digits + 2 decimals (`books.price DECIMAL(10,2)`) | Quoted decimal, no currency symbol, max 2 decimal places (`parsePriceInput`, `book-validation.ts`). Parsed to **integer cents by string surgery** — never `Number(x) * 100`. `"0.00"` is legal and means free (warned, not blocked). Blocker if absent or unparseable. | PDP price, cards, checkout | `"12.99"` |
| `currency` | string | **Required** | 3 | Must be `USD`. There is no `books.currency` column in any migration, so a per-book currency cannot round-trip (`CURRENCY_IS_FIXED` / `FIXED_CURRENCY`, `book-validation.ts`). Anything else is a blocker. | Alongside the price | `USD` |
| `isbn` | string | Recommended | ISBN-10 or ISBN-13 | Hyphens and spaces are stripped. Shape checked by `isValidIsbn` (`book-validation.ts`); the **check digit is then verified** (mod-11 for ISBN-10, EAN-13 mod-10 for ISBN-13) — see §6. **UNIQUE** (`books.isbn TEXT UNIQUE`). Absent ⇒ warning; present-but-wrong ⇒ blocker. | PDP details | `978-0-00-000000-2` |
| `published_at` | string | Recommended | — | `yyyy-mm-dd`, must parse. Absent ⇒ warning (listings fall back to `created_at`). | PDP publication date, date-ordered listings | `2026-09-15` |
| `page_count` | integer | Optional | 9 digits | Whole number. | PDP details | `312` |
| `word_count` | integer | Optional | 9 digits | Whole number. | PDP details | `88000` |

**Why `price` is a quoted string.** A bare JSON number is an IEEE-754 double.
`19.99` has no exact binary representation, and `0.1 + 0.2 === 0.30000000000000004`,
so any tool that does arithmetic on the way out can hand us a value that is a
fraction of a cent wrong. The string is split on the decimal point and both
halves are handled as integers, so the amount that leaves the publisher's
spreadsheet is the amount that reaches the database. Supplying a JSON number
still works but raises a warning.

---

## 4. Assets

### 4.1 Cover

| Property | Requirement | Source of the constraint |
| --- | --- | --- |
| Format | JPG or PNG | `COVER_RULES.mimeTypes`, `book-validation.ts` (the `book-covers` bucket also allows webp/gif; we narrow to what retailers accept) |
| Extension | `.jpg`, `.jpeg`, `.png`, matching the actual file header | `COVER_RULES.extensions` + intake header sniff (§6) |
| Aspect ratio | Portrait **2:3** (±2%) | `COVER_RULES.aspectRatio` / `aspectTolerance`; the PDP hero is laid out `aspect-[2/3]` |
| Minimum size | **1600 × 2400 px** | `COVER_RULES.minWidth` / `minHeight` |
| Maximum file size | **5 MB** | `book-covers` bucket `file_size_limit = 5242880`, `supabase/migrations/20260117000006_storage_policies.sql`, mirrored by `UPLOAD_CONFIGS.cover` in `types/upload.ts`. Storage itself rejects anything larger. |
| Field | `assets.cover_file` (in the kit) **or** `assets.cover_url` (already hosted, https) | |
| Public appearance | PDP hero, every card, OG/Twitter share image, library and wishlist rows | |
| Blocker? | **Yes.** No cover ⇒ cannot publish. | `validateAdminBook` |

Larger than 1600×2400 is fine and encouraged, as long as it stays under 5 MB and
holds 2:3. The cover must carry no watermark, no comp-license band, no series
sticker that is not on the retail edition, and no "not final" mark.

### 4.2 EPUB

| Property | Requirement | Source |
| --- | --- | --- |
| Format | `.epub` only | `EPUB_RULES.extensions`; the `published-epubs` bucket's `allowed_mime_types` is exactly `{application/epub+zip}` |
| Maximum file size | **50 MB** | bucket `file_size_limit = 52428800`, `supabase/migrations/20260117000006_storage_policies.sql`; `UPLOAD_CONFIGS.epub` in `types/upload.ts` |
| Field | `assets.epub_file` or `assets.epub_url` | |
| Public appearance | **None at launch.** There is no on-site reader; this is an internal archive asset. | |
| Blocker? | Absent ⇒ **warning**. Present but wrong extension, oversized, or not a ZIP/OCF container ⇒ **blocker**. | |

### 4.3 Audio sample

| Property | Requirement | Source |
| --- | --- | --- |
| Delivery | **Hosted https URL only** — `assets.audio_sample_url` | See below |
| Format | MP3 or M4A | `AUDIO_SAMPLE_RULES.mimeTypes` / `.extensions`, `book-validation.ts` (both play through the existing `<audio>` element) |
| Length | 120–300 seconds (2–5 minutes) recommended | `AUDIO_SAMPLE_RULES.recommendedMinSeconds` / `recommendedMaxSeconds` — editorial guidance, **not** a storage limit. Outside the range ⇒ warning. |
| Maximum file size | **Not specified — we do not host it.** | `AUDIO_SAMPLE_RULES.maxBytes` is `null` on purpose |
| Narrator | `assets.audio_narrator`, optional | |
| Public appearance | PDP audio tab and player. Absent ⇒ the audio tab stays hidden. | |
| Blocker? | Absent ⇒ **warning**. Non-https URL ⇒ **blocker**. A local audio **file** in the kit ⇒ **blocker**. | |

**Why a URL and not a file.** No audio storage bucket is provisioned.
`supabase/migrations/20260117000006_storage_policies.sql` creates exactly three
buckets — `book-covers`, `manuscripts`, `published-epubs`. `types/upload.ts`
names an `audiobooks` bucket that no migration ever creates, and
`/api/upload/book-assets` accepts `asset=cover|epub` only. Accepting an audio
file would mean inventing a bucket and a size limit, so instead the kit takes an
already-hosted URL and the missing bucket is escalated (§8) rather than papered
over. Full audiobooks are post-launch and are out of scope for this spec.

### 4.4 Trailer

| Field | Type | Required | Validation rule | Where it appears publicly | Example |
| --- | --- | --- | --- | --- | --- |
| `trailer_vimeo_id` | string | Optional | **Numeric Vimeo id only, 6–12 digits** — not a URL, not an embed snippet (`isValidVimeoId`, `book-validation.ts`; the player builds `player.vimeo.com/video/<id>`). Absent ⇒ warning. | PDP trailer player | `76979871` |

---

## 5. Retailer links, SEO, rights and approval

### 5.1 Retailer links

All six live under `retailers` and are named exactly as in
`RETAILER_URL_FIELDS` (`lib/books/fields.ts`), which is the single source of
truth for both the names and the display order.

| Field | Label on the PDP | Required | Validation rule | Example |
| --- | --- | --- | --- | --- |
| `amazon_url` | Amazon | Optional | Absolute **https** URL (`isValidExternalUrl`, `lib/books/fields.ts`). The PDP renders `https://` destinations only, so anything else is a blocker. | `https://www.amazon.com/dp/EXAMPLE` |
| `kindle_url` | Kindle | Optional | as above | `https://www.amazon.com/dp/EXAMPLE-KINDLE` |
| `apple_books_url` | Apple Books | Optional | as above | `https://books.apple.com/us/book/example` |
| `google_play_books_url` | Google Play Books | Optional | as above | `https://play.google.com/store/books/details?id=EXAMPLE` |
| `barnes_noble_url` | Barnes & Noble | Optional | as above | `https://www.barnesandnoble.com/w/example` |
| `audible_url` | Audible | Optional | as above | `https://www.audible.com/pd/EXAMPLE` |

Each link is individually optional. Supplying **none** is a warning: the "Also
available at" section on the PDP stays hidden, which for a launch title means
there is no way to buy the book. Supply every storefront where the book is
actually listed, and only those.

### 5.2 SEO and accessibility

| Field | Type | Required | Max length | Validation rule | Where it appears publicly | Example |
| --- | --- | --- | --- | --- | --- | --- |
| `seo.title` | string | Recommended | **60** (`UpdateBookSchema.seo_title`, `types/books.ts`) | Absent ⇒ warning (`generateMetadata` falls back to `title`). Over length ⇒ blocker. | `<title>`, search result headline, OG/Twitter title | `The Lantern of Quiet Harbours \| Example` |
| `seo.description` | string | Recommended | **160** (`UpdateBookSchema.seo_description`, `types/books.ts`) | Absent ⇒ warning (falls back to the 5000-char description, which no search engine will show). Over length ⇒ blocker. | `<meta name="description">`, search snippet, OG/Twitter description | *(one-sentence hook)* |
| `seo.cover_alt` | string | Recommended | ~125 (**guidance only — §8**) | Absent ⇒ warning. Describe the cover; do not start with "Image of". | Screen readers, and the OG image `alt` *(no column yet — §8)* | `Book cover: a single lantern burning on a dark stone jetty above a grey winter sea.` |

### 5.3 Rights

| Field | Type | Required | Validation rule | Public? | Example |
| --- | --- | --- | --- | --- | --- |
| `rights.confirmed` | boolean | **Required** | Must be `true` — the publisher confirms they hold the rights to publish and distribute this title. Blocker otherwise. | No | `true` |
| `rights.holder` | string | **Required** | Non-empty. Blocker otherwise. | No | `Example Author Ltd` |
| `rights.territory` | string | Recommended | Absent ⇒ warning. | No | `World, all languages` |
| `rights.notes` | string | Optional | Anything the operator needs to know (excerpt permissions, lyric clearances, cover art licence). | No | `""` |

### 5.4 Approval record

| Field | Type | Required | Validation rule | Public? | Example |
| --- | --- | --- | --- | --- | --- |
| `approval.approved_by` | string | **Required** | Names the person who signed the book off. Blocker if absent. | No | `Publisher Name, MANGU Publishers` |
| `approval.approved_on` | string | **Required** | `yyyy-mm-dd`, must parse. Blocker otherwise. | No | `2026-07-20` |
| `approval.final_files_confirmed` | boolean | **Required** | Must be `true`: these are the final files — no watermark, no draft label, no proof stamp, no placeholder copy. Blocker otherwise. | No | `true` |
| `approval.retailer_links_opened` | boolean | **Required** | Must be `true`: every retailer URL was opened in a browser and confirmed to land on this book. Blocker otherwise. | No | `true` |

Rights and approval have no database columns and are not proposed to get any.
They are the handover record: the point of intake is that a human signed the
book off, and an unsigned kit is not ready regardless of how clean its metadata
is.

---

## 6. Blocker / warning matrix

**Blockers** stop the book being created or published. **Warnings never block**
— they are printed so a person decides.

`source` shows where the rule comes from: `admin-validation` means it is the
identical rule the admin publish screen runs (imported, not copied), so anything
that passes here cannot be refused there.

### Blockers

| # | Condition | Source |
| --- | --- | --- |
| 1 | `title` missing | admin-validation |
| 2 | `author.pen_name` missing | admin-validation |
| 3 | `description` missing | admin-validation |
| 4 | `genre` missing | admin-validation |
| 5 | No cover at all | admin-validation |
| 6 | `price` missing or unparseable (>2 decimals, non-numeric, negative) | admin-validation |
| 7 | Slug invalid, or derives to empty from the title | admin-validation |
| 8 | Any retailer URL present but not absolute https | admin-validation |
| 9 | Any asset URL (cover / EPUB / audio) present but not absolute https | admin-validation |
| 10 | `isbn` present but wrong shape | admin-validation |
| 11 | `trailer_vimeo_id` present but not 6–12 digits | admin-validation |
| 12 | `page_count` / `word_count` / `audio_duration_seconds` not whole numbers | admin-validation |
| 13 | `published_at` present but unparseable | admin-validation |
| 14 | Cover over 5 MB, or not JPG/PNG | admin-validation (`validateCoverFile`) |
| 15 | Cover not portrait 2:3, or under 1600×2400 | admin-validation (`validateCoverDimensions`) |
| 16 | EPUB over 50 MB, or not `.epub` | admin-validation (`validateEpubFile`) |
| 17 | `isbn` shape is right but the **check digit fails** | intake |
| 18 | Slug collides with another kit in the same batch | intake |
| 19 | ISBN collides with another kit in the same batch | intake |
| 20 | Cover file named in `book.json` is not in the folder | intake |
| 21 | Cover file header disagrees with its extension (a renamed file) | intake |
| 22 | EPUB file named in `book.json` is not in the folder | intake |
| 23 | EPUB is not a ZIP/OCF container whatever its extension says | intake |
| 24 | An audio **file** is supplied (no audio bucket exists) | intake |
| 25 | `currency` is not `USD` | intake |
| 26 | `title` over 200 or `description` over 5000 characters | intake |
| 27 | `seo.title` over 60 or `seo.description` over 160 characters | intake |
| 28 | `content_type` is not `book` / `comic` / `paper` | intake |
| 29 | A `subtitle` key is present | intake |
| 30 | `rights.confirmed` not `true`, or `rights.holder` missing | intake |
| 31 | `approval.approved_by` / `approved_on` missing or invalid | intake |
| 32 | `approval.final_files_confirmed` not `true` | intake |
| 33 | `approval.retailer_links_opened` not `true` | intake |
| 34 | `book.json` will not parse | intake |
| 35 | `author.admin_author_id` missing — **only** under `--require-author-id` | intake |

### Warnings

| # | Condition | Source |
| --- | --- | --- |
| 1 | No retailer links at all ("Also available at" stays hidden) | admin-validation |
| 2 | No audio sample (the audio tab stays hidden) | admin-validation |
| 3 | No trailer | admin-validation |
| 4 | No ISBN | admin-validation |
| 5 | `author.admin_author_id` not yet linked (default mode) | intake |
| 6 | No EPUB | intake |
| 7 | No `published_at` | intake |
| 8 | Cover dimensions could not be read from the header — check by hand | intake |
| 9 | Audio sample outside the 120–300 s guidance | intake |
| 10 | `seo.title` / `seo.description` / `seo.cover_alt` absent | intake |
| 11 | `seo.cover_alt` past the ~125-character guideline | intake |
| 12 | `short_description` absent or past the ~200-character guideline | intake |
| 13 | `price` supplied as a JSON number rather than a quoted string | intake |
| 14 | `price` is `0.00` (the book will be free) | intake |
| 15 | No `rights.territory` | intake |
| 16 | An unrecognised top-level key (likely a typo) | intake |

### The one place intake is stricter than the admin UI

**ISBN check digit** (blocker 17). `isValidIsbn` in `book-validation.ts` is
documented as a *shape* check — `books.isbn` is `UNIQUE TEXT` with no format
constraint — so the admin UI accepts `978-0-00-000000-3`. A failing check digit
is a guaranteed typo, and intake is the last moment it can be corrected for
free instead of being sent to six retailers. The strictness runs the safe way
round: nothing that passes intake can be refused by the admin UI.

Blockers 18–24, 34 and 35 are not additions to the rule set — they are things
the admin UI *structurally cannot* check. It sees one book at a time (no batch
uniqueness), it has no filesystem (no on-disk file), and it has no author table
loaded at validation time.

---

## 7. Submission checklist

- [ ] One folder per book, named in lowercase-with-hyphens.
- [ ] `book.json` complete, copied from `asset-kit-template/book.json`.
- [ ] Cover is the final art: JPG/PNG, portrait 2:3, ≥1600×2400, ≤5 MB, **no watermark or draft mark**.
- [ ] EPUB is the final file: `.epub`, ≤50 MB.
- [ ] Audio sample is hosted and its https URL is in `assets.audio_sample_url` (2–5 minutes).
- [ ] Every retailer URL **opened in a browser** and confirmed to land on this book.
- [ ] `price` is a quoted string in USD; `currency` is `"USD"`.
- [ ] ISBN entered from the source record, not retyped from memory.
- [ ] `seo.title` ≤60, `seo.description` ≤160, `seo.cover_alt` written.
- [ ] `rights.confirmed` is `true` and `rights.holder` is named.
- [ ] `approval.*` complete and signed by a named person.
- [ ] `npx tsx scripts/validate-asset-kit.ts <folder>` exits `0`.
- [ ] Warnings reviewed and consciously accepted.

---

## 8. Open — needs the publisher's or engineering's decision

These are gaps in the codebase, not gaps in this document. They are listed here
rather than resolved with an invented value.

1. **No audio storage bucket.** `types/upload.ts` names an `audiobooks` bucket
   that no migration creates, and `/api/upload/book-assets` handles `cover` and
   `epub` only. Until a bucket is provisioned, audio samples must be hosted
   externally and referenced by URL. *Decision needed: where are the samples
   hosted at launch, and who owns that hosting?*
2. **No `books.short_description` column.** The field is collected because
   cards and share previews need it, but nothing persists it today, so its
   length cap is intake guidance (~200) and it can only ever raise a warning.
   *Decision needed: add the column, or drop the field from the kit.*
3. **No cover alt-text column.** Every cover currently renders with a hardcoded
   `alt="Cover of <title>"` (`app/(consumer)/books/[slug]/page.tsx`,
   `components/cards/BookCard.tsx`, and others). Alt text is collected so it
   exists when a field does, and the ~125-character cap is intake guidance.
   *Decision needed: accessibility owner to confirm the cap and request the
   column.*
4. **`seo_title` / `seo_description` do not persist.** They exist in
   `types/books.ts` (`UpdateBookSchema`, capped 60/160) but in no migration, and
   `generateMetadata` derives the page title and meta description from `title`
   and `description`. The caps are real and enforced by the schema; the storage
   is not there. *Decision needed: add the columns, or accept derived metadata
   at launch and note it in the SEO plan.*
5. **No `books.currency` column.** Currency is fixed at USD
   (`CURRENCY_IS_FIXED`). *Decision needed only if a non-USD title is planned.*
6. **Retailer link destinations cannot be machine-verified.** The validator
   confirms a URL is https and well-formed; it cannot confirm it points at the
   right book. This stays a human attestation
   (`approval.retailer_links_opened`) unless someone funds link-checking with
   network access in CI.
7. **`author.admin_author_id`** cannot be supplied by the publisher. Confirm
   who runs the `--require-author-id` pass and when, relative to the publish
   window.
