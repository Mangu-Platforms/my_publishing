# Asset kit template

Copy this whole folder once per book. One folder = one book = one catalog entry.

Everything in `book.json` here is **invented**. "The Lantern of Quiet Harbours"
by "A. N. Example" is not a real book and must never reach the live catalog.

The definitive field-by-field reference is
[`../ASSET_KIT_SPEC.md`](../ASSET_KIT_SPEC.md). This file only covers the folder
layout and how to run the check.

## Folder layout

```
my-book-title/
├─ book.json     <- all the metadata. Required. Comments are allowed.
├─ cover.jpg     <- the final cover. JPG or PNG, portrait 2:3,
│                   at least 1600x2400 px, 5 MB or under.
└─ book.epub     <- the final EPUB. .epub only, 50 MB or under. Optional
                    at launch (there is no on-site reader — this is an
                    internal archive asset, not a customer download).
```

Name the folder after the book, in lowercase with hyphens. The folder name is
only used to identify the kit in the validator's output — the public URL comes
from `slug` (or is derived from `title`).

### Where each asset goes

| Asset | Goes | Field in `book.json` |
| --- | --- | --- |
| Cover | A file in this folder | `assets.cover_file` |
| Cover already hosted by us | Leave the file out | `assets.cover_url` (https) |
| EPUB | A file in this folder | `assets.epub_file` |
| EPUB already hosted by us | Leave the file out | `assets.epub_url` (https) |
| **Audio sample** | **Not in this folder** | `assets.audio_sample_url` (https) |

The audio sample is the one exception. **Do not put an audio file in the kit.**
No audio storage bucket exists — `supabase/migrations/20260117000006_storage_policies.sql`
creates only `book-covers`, `manuscripts` and `published-epubs`, and
`/api/upload/book-assets` accepts `cover` and `epub` only. Host the sample
somewhere with an https URL and paste that URL in. Putting a filename in
`assets.audio_sample_file` is a deliberate blocker with that explanation
attached, so nobody silently loses a file.

## Run the validator

From the repo root:

```bash
# one kit
npx tsx scripts/validate-asset-kit.ts path/to/my-book-title

# a whole handover directory of kits (also checks slug/ISBN collisions
# between them, which is the only place that clash can be caught early)
npx tsx scripts/validate-asset-kit.ts path/to/handover

# machine-readable, for CI or a spreadsheet
npx tsx scripts/validate-asset-kit.ts path/to/handover --json

# operator pre-publish pass: also demands author.admin_author_id
npx tsx scripts/validate-asset-kit.ts path/to/handover --require-author-id
```

Exit codes: `0` no blockers, `1` blockers found, `2` bad arguments or the path
could not be read.

**Blockers** stop the book being created. **Warnings never block** — they are
things the launch is better with, and they are printed so a person decides
rather than a script deciding for them.

The validator runs the *same* rule set as the admin publish screen (it imports
`app/admin/books/_lib/book-validation.ts` directly, rather than keeping a second
copy), so a kit that passes here will not be refused later. Each reported issue
is tagged with its origin: `admin-validation` for a rule shared with the admin
UI, `intake` for the handful of checks the admin UI structurally cannot run
(files on disk, uniqueness across the batch, ISBN check digit, rights sign-off).

## Running it on this template

This template folder deliberately ships **without** `cover.jpg` and
`book.epub` — the repo holds no binary placeholder art. So a fresh run reports
the missing cover as a blocker and the missing EPUB as a warning. That is the
expected output, and it is a useful look at what a failure reads like before
you have real files in the folder.

## Before you send a kit

1. Every file is **final**. No watermark, no "DRAFT"/"PROOF" band, no
   comp-license overlay, no placeholder copy, no "TK".
2. Every retailer URL has been **opened in a browser** and lands on *this* book
   — right title, right author, right edition. Nothing offline can check that,
   which is why `approval.retailer_links_opened` is an attestation you sign.
3. `rights.confirmed` and `approval.final_files_confirmed` are `true` and
   `approval.approved_by` names a real person.
4. `npx tsx scripts/validate-asset-kit.ts <your-folder>` exits `0`.
