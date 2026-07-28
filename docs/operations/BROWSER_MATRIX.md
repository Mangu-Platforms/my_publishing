# Browser and Device Matrix — MANGU Publishers launch

Owner: accessibility & cross-browser readiness (plan Section H)
Status: **template — cells are deliberately blank for the tester to fill**

This is the sign-off artefact for cross-browser readiness. One tester fills one
copy per release candidate, dates it, and attaches it to the launch checklist.
Do not pre-fill cells. An empty cell means "not yet tested" and blocks sign-off
for any combination marked **Blocking**.

---

## 1. How to use this document

1. Copy this file to `docs/operations/browser-matrix-runs/<YYYY-MM-DD>-<rc>.md`.
2. Record the exact browser builds under [Environment](#2-environment-record).
3. Work through §4 surface by surface, on each device class in §3.
4. Mark each cell: `P` (pass), `F` (fail), `N/A` (surface not reachable on that
   device), or leave blank for not tested.
5. Every `F` gets a row in §7 with a reproduction and an issue link.
6. Sign off in §8. A release cannot ship with an unresolved `F` or a blank cell
   in a **Blocking** combination.

Legend: `P` pass · `F` fail · `N/A` not applicable · *(blank)* not tested

---

## 2. Environment record

| Field | Value |
| --- | --- |
| Release candidate / commit |  |
| Base URL under test |  |
| Date tested |  |
| Tester |  |
| Chrome version |  |
| Edge version |  |
| Safari version (and macOS) |  |
| Safari version (and iOS) |  |
| Firefox version |  |
| Android browser + version |  |
| Screen reader used (if any) |  |

---

## 3. Device classes

Viewport widths are the ones the layout actually branches on. The codebase uses
Tailwind's default breakpoints, and the audio player's volume row is
`hidden sm:flex` (`components/players/AudioPlayer.tsx`), so the 390px and 360px
classes genuinely exercise a different control set from desktop.

| Class | Reference device | Viewport (CSS px) | Notes |
| --- | --- | --- | --- |
| D1 Desktop large | 1440×900 laptop | 1440 × 900 | Full nav, volume slider visible |
| D2 Desktop small | 1280×720 | 1280 × 720 | Playwright's default project size |
| M1 iPhone-class | iPhone 14/15 | 390 × 844 | Drawer nav, no volume slider |
| M2 Android common | Pixel 7/8 | 412 × 915 | Drawer nav, no volume slider |
| M3 Android small | budget 6" device | 360 × 800 | Tightest layout; watch for clipping |
| T1 Tablet (best effort) | iPad 10th gen | 820 × 1180 | Between breakpoints |

---

## 4. Matrix

### 4.1 Catalog — `/books`, `/comics`, `/papers`

Pass = the page renders the filter row and a grid of covers; the search box and
both filter selects change the result set; every cover shows or degrades to an
empty tile without layout collapse; Tab reaches the search box, both selects and
the first card, each with a visible focus ring; a card opens its book page.

| Browser | D1 | D2 | M1 | M2 | M3 | T1 |
| --- | --- | --- | --- | --- | --- | --- |
| Chrome (current) |  |  |  |  |  |  |
| Edge (current) |  |  |  |  |  |  |
| Safari / WebKit (current) |  |  |  |  |  |  |
| Firefox (current) |  |  |  |  |  |  |

Blocking: Chrome, Edge, Safari, Firefox on D1/D2; Safari on M1; Chrome on M2.
Best effort: M3, T1, Firefox on mobile.

### 4.2 Product detail — `/books/[slug]`

Pass = cover, title, author, description and price render; the Purchase button
reaches `/checkout`; the Overview / Audio Sample / Reviews tabs switch with both
mouse and arrow keys; every "Also available at" retailer button opens the
retailer in a new tab and carries `rel="noopener noreferrer"`; nothing overlaps
at the tested width.

| Browser | D1 | D2 | M1 | M2 | M3 | T1 |
| --- | --- | --- | --- | --- | --- | --- |
| Chrome (current) |  |  |  |  |  |  |
| Edge (current) |  |  |  |  |  |  |
| Safari / WebKit (current) |  |  |  |  |  |  |
| Firefox (current) |  |  |  |  |  |  |

Blocking: all four browsers on D1/D2; Safari on M1; Chrome on M2.
Best effort: M3, T1, Firefox on mobile.

### 4.3 Auth — `/login`, `/register`, `/reset-password`

Pass = each form submits; a bad email shows an inline error next to the field;
the password manager can fill the fields (`autocomplete` is set on all three);
a successful login lands on `/` with the session applied; "Forgot password?"
reaches the reset form and a reset email is requested without error.

| Browser | D1 | D2 | M1 | M2 | M3 | T1 |
| --- | --- | --- | --- | --- | --- | --- |
| Chrome (current) |  |  |  |  |  |  |
| Edge (current) |  |  |  |  |  |  |
| Safari / WebKit (current) |  |  |  |  |  |  |
| Firefox (current) |  |  |  |  |  |  |

Blocking: all four browsers on D1/D2 and on M1 and M2. Auth is the narrowest
funnel on the site; a browser that cannot log in is a launch stop.
Best effort: M3, T1.

Safari note to verify explicitly: login finishes with a full-page
`window.location.assign('/')` so the client picks up the cookies set by the
server action (`app/(auth)/login/LoginForm.tsx`). Confirm on Safari with
"Prevent cross-site tracking" **on**, which is the default.

### 4.4 Audio player — `/audio/[id]` and the Audio Sample tab

Pass = the sample starts within ~3s of pressing play; elapsed time advances;
±15s moves the position; the seek bar reflects and accepts a drag; the chapter
list (when present) jumps to a chapter; the mini-player appears and keeps
playing across an in-app navigation; Stop clears it. On desktop the volume
slider and mute button also work. See §5 for format caveats.

| Browser | D1 | D2 | M1 | M2 | M3 | T1 |
| --- | --- | --- | --- | --- | --- | --- |
| Chrome (current) |  |  |  |  |  |  |
| Edge (current) |  |  |  |  |  |  |
| Safari / WebKit (current) |  |  |  |  |  |  |
| Firefox (current) |  |  |  |  |  |  |

Blocking: all four browsers on D1/D2; Safari on M1; Chrome on M2.
Best effort: M3, T1, Firefox on mobile.

Additional audio checks (tick per browser, desktop only unless noted):

| Check | Chrome | Edge | Safari | Firefox |
| --- | --- | --- | --- | --- |
| `.mp3` sample plays |  |  |  |  |
| `.m4a` sample plays |  |  |  |  |
| Duration appears before pressing play |  |  |  |  |
| Playback survives an in-app route change |  |  |  |  |
| Mini-player play/pause/±15s work |  |  |  |  |
| Sleep timer fires |  |  |  |  |
| Playback rate change takes effect |  |  |  |  |
| Progress resumes on return (signed in) |  |  |  |  |
| Lock-screen / OS media controls (M1, M2) |  |  |  |  |

### 4.5 Checkout — `/checkout?book_id=…`

Pass = the order summary shows the right title and price; "Continue to payment"
reaches Stripe Checkout; the browser back button returns to a usable page; the
cancel path returns to the book. Test with third-party cookie blocking at its
default setting for each browser.

| Browser | D1 | D2 | M1 | M2 | M3 | T1 |
| --- | --- | --- | --- | --- | --- | --- |
| Chrome (current) |  |  |  |  |  |  |
| Edge (current) |  |  |  |  |  |  |
| Safari / WebKit (current) |  |  |  |  |  |  |
| Firefox (current) |  |  |  |  |  |  |

Blocking: all four browsers on D1/D2; Safari on M1; Chrome on M2. Money path.
Best effort: M3, T1, Firefox on mobile.

### 4.6 Admin publishing — `/admin/books`, `/admin/books/new`, `/admin/books/[id]/edit`

Pass = the book list loads; a new book can be created as a draft; the publish
checklist blocks publishing until its requirements are met and explains why; a
published book appears in the public catalog; unpublish asks for confirmation
(`window.confirm`) and removes it. Requires admin credentials.

| Browser | D1 | D2 | M1 | M2 | M3 | T1 |
| --- | --- | --- | --- | --- | --- | --- |
| Chrome (current) |  |  |  |  |  |  |
| Edge (current) |  |  |  |  |  |  |
| Safari / WebKit (current) |  |  |  |  |  |  |
| Firefox (current) |  |  |  |  |  |  |

Blocking: Chrome and Safari on D1/D2 only. Staff use desktop; the admin forms
are not laid out for a phone.
Best effort: Edge and Firefox on desktop; everything on M1–M3 and T1.

---

## 5. Audio format caveats

These are grounded in what the repo actually accepts, not in general folklore.
The admin validator restricts audio uploads to three MIME types and two
extensions (`app/admin/books/_lib/book-validation.ts`):

```
mimeTypes: ['audio/mpeg', 'audio/mp4', 'audio/x-m4a']
extensions: ['.mp3', '.m4a']
```

**C1 — MP3 (`audio/mpeg`, `.mp3`) is the safe default.** Every browser in the
matrix decodes MP3. If a title only has to work everywhere, ship the sample as
MP3. Nothing below applies to it.

**C2 — `.m4a`/AAC support in Firefox depends on the operating system.** Firefox
does not ship its own AAC decoder; it hands AAC off to a platform decoder. On
current Windows and macOS that decoder is present, so `.m4a` normally plays. On
Linux builds without the relevant system codecs installed it can fail. Verify
`.m4a` playback on Firefox explicitly rather than assuming it from a Chrome
pass, and note the host OS in §2.

**C3 — `audio/x-m4a` is a non-standard MIME type.** The validator accepts it, so
a file can enter the system labelled that way, and whatever the storage layer
stores is likely what it serves back. Browsers use the served `Content-Type`
alongside content sniffing, and a non-standard type is the kind of thing a
strict source check rejects. **Action:** confirm the storage/CDN serves `.m4a`
as `audio/mp4`, and record the observed response header here:

| File tested | Served `Content-Type` | Plays in Chrome | Edge | Safari | Firefox |
| --- | --- | --- | --- | --- | --- |
|  |  |  |  |  |  |

**C4 — duration may be unknown until playback starts.** Both `<audio>` elements
are `preload="metadata"` (`components/audio/AudioContext.tsx`,
`components/players/AudioPlayer.tsx`). Mobile Safari in particular is
conservative about preloading over a cellular connection, so the total time can
read `--:--` and the seek bar can sit at zero length until the listener presses
play. That is expected, not a bug — but confirm it *recovers* once playback
starts, because the seek bar's `aria-valuemax` is derived from the duration.

**C5 — playback stops on a full page load, by design.** The single `<audio>`
element lives in the React tree (`app/providers.tsx`), so it survives client-side
navigation but not a full document load. Login deliberately does a full-page
`window.location.assign`, so audio started before signing in will stop. Confirm
this behaves the same in all four browsers rather than throwing an error.

**C6 — range requests.** Seeking in a long audiobook needs HTTP range request
support from wherever the file is served. Safari is the strictest about this and
may refuse to play at all if ranges are unsupported. If seeking fails on Safari
but works elsewhere, suspect the storage response headers, not the player.

**C7 — autoplay is not used and must not be introduced.** Every play call is
behind a user gesture. If a future change autoplays, Safari and Firefox will
block it silently and the player will look broken.

---

## 6. Blocking vs. best-effort summary

**Blocking — must be `P` before launch**

| Surface | Combinations |
| --- | --- |
| Catalog | Chrome/Edge/Safari/Firefox on D1, D2; Safari M1; Chrome M2 |
| Product detail | Chrome/Edge/Safari/Firefox on D1, D2; Safari M1; Chrome M2 |
| Auth | Chrome/Edge/Safari/Firefox on D1, D2, M1, M2 |
| Audio player | Chrome/Edge/Safari/Firefox on D1, D2; Safari M1; Chrome M2 |
| Checkout | Chrome/Edge/Safari/Firefox on D1, D2; Safari M1; Chrome M2 |
| Admin publishing | Chrome, Safari on D1, D2 |

**Best effort — record the result, do not block the release**

- Android small (M3) and tablet (T1) on every surface.
- Firefox on any mobile viewport.
- Edge and Firefox on the admin surfaces.
- Everything on M1–M3/T1 for admin publishing.

There is no on-site EPUB reader and no mobile app at launch, so neither appears
in this matrix. If either ships later, add a surface section rather than
stretching an existing one.

---

## 7. Failures found

| # | Surface | Browser | Device | What happened | Repro steps | Issue link | Blocking? |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 |  |  |  |  |  |  |  |
| 2 |  |  |  |  |  |  |  |
| 3 |  |  |  |  |  |  |  |

---

## 8. Sign-off

| Role | Name | Date | Verdict |
| --- | --- | --- | --- |
| Tester |  |  |  |
| Engineering owner |  |  |  |
| Launch owner |  |  |  |

Verdict is one of: **Go**, **Go with known issues** (list them), **No go**.

---

## 9. Relationship to the automated suite

`playwright.config.ts` runs chromium, firefox and webkit locally and **chromium
only in CI**. That means Firefox and WebKit regressions are not caught by CI at
all, and no automated project uses a mobile viewport. This matrix is therefore
the only Firefox, Safari and mobile coverage the launch has. Fill it in.

`tests/e2e/accessibility.spec.ts` covers the keyboard and ARIA half of the
"pass" definitions above on whatever project it runs under. It does not replace
this document: it cannot judge layout, media playback, OS-level media controls,
or third-party cookie behaviour.
