# Accessibility Audit — MANGU Publishers launch

Owner: accessibility & cross-browser readiness (plan Section H)
Standard: **WCAG 2.1 Level AA**
Status: static audit complete; **automated suite not yet executed; manual
keyboard and screen-reader passes not yet run**

---

## 1. What "launch-blocking" means here

> A launch-blocking accessibility issue is **anything that prevents a keyboard
> user or a screen-reader user from completing a key task.**

The key tasks are:

1. Browse the catalog
2. Open a book page
3. Follow a retailer link to buy
4. Play an audio sample
5. Register
6. Log in
7. Reset a password
8. *(staff)* Publish a book through the admin UI

An issue that makes a task slower, uglier or more annoying is a **must-fix**,
not a blocker. An issue that makes a task *impossible* — or that makes the
information needed to complete it unreadable or unannounced — is a blocker.
Section 6 applies that test to each finding explicitly rather than leaving it to
severity labels.

There is no on-site EPUB reader and no mobile app at launch, so neither is in
scope.

---

## 2. Method

**2.1 Static source review.** Every file on the key-task path was read: the
catalog and product pages, the auth forms, the checkout page, the admin book
form, the audio player and its supporting engine, the shared UI primitives
(`button`, `input`, `label`, `card`, `dialog`), the root layout, the Tailwind
theme and `app/globals.css`. Findings in §6 each cite a file and line.

**2.2 Colour maths.** Contrast ratios in §6 were computed from the HSL design
tokens in `app/globals.css` resolved through `tailwind.config.ts`, using the
WCAG 2.1 relative-luminance formula. They are arithmetic on the declared token
values, not screenshots. They still need confirming against a rendered page —
see §7.

**2.3 Automated specs.** `tests/e2e/accessibility.spec.ts` encodes the checks in
§5 that can be made deterministic. It uses no accessibility testing library (see
§4) and asserts against the accessibility tree and computed styles directly.

**2.4 What has *not* happened yet.** The specs have **not been executed** — this
branch has no runnable install. No screen reader has been used. No real browser
has rendered any of these pages for this audit. Nothing in this document should
be read as "verified working"; §6 is "verified broken by reading the code", and
the absence of a finding for a surface is **not** a clean bill of health for it.

---

## 3. Automated coverage is about a third of the problem

Published comparisons of automated accessibility tooling against expert manual
audits consistently land in the same range: **automated rules detect roughly a
third of real WCAG issues** (commonly quoted as ~30–40%, and axe-core's own
documentation claims "over 57%" only under favourable conditions). The rules
that automate well are the mechanical ones — a missing `alt`, an unlabelled
input, a bad ARIA attribute, a computable contrast ratio. The ones that do not
automate at all are the ones that decide whether a task is completable:

- Is the focus order *sensible*, not merely present?
- Is the alt text *accurate*, not merely non-empty?
- Does the error message tell the user *what to do*?
- Does the announced name of a control match its visible label closely enough
  that a voice-control user can say it?
- Can someone actually finish the purchase with the screen reader on?

**Both of the following are required before launch sign-off and neither is
optional:**

- [ ] A manual keyboard-only pass of all eight key tasks (no mouse, no
      trackpad), on desktop Chrome and desktop Safari.
- [ ] A manual screen-reader pass of all eight key tasks, using at minimum
      VoiceOver on Safari/macOS and NVDA on Firefox/Windows.

Record both in §8.

---

## 4. Tooling: there is no accessibility testing library in this repo

Confirmed by reading `package.json` on `task/phase1-catalog-data-path`: there is
no `axe-core`, no `@axe-core/playwright`, no `jest-axe`, no `pa11y`, no
`eslint-plugin-jsx-a11y` as a direct dependency. This branch is not permitted to
add one, so `tests/e2e/accessibility.spec.ts` implements its own accessible-name
resolution, heading-outline extraction, focus-indicator detection and contrast
computation in-page.

**Recommendation: adopt `@axe-core/playwright`** (dev dependency).

*Why that one:* it is the same engine that powers Chrome DevTools' and Lighthouse's
accessibility audits, so its findings match what reviewers will independently
see; it runs inside an existing Playwright page with no separate runner; it
scopes to a selector, which matters here because a violation in the shared
Header would otherwise fail every page's test; it has an explicit
zero-false-positive design goal, so failures are actionable rather than advisory;
and its rule tags map directly onto `wcag2a`/`wcag2aa`, which is exactly the
scope in §5. The alternative worth knowing about is `pa11y-ci`, which is better
for crawling a deployed site on a schedule and worse as a per-PR gate.

*What it would replace:* the mechanical parts of the spec — image alt, control
labelling, ARIA validity, and contrast. It would **not** replace the keyboard
order, focus-indicator, focus-trap, retailer-link or audio-player-contract
tests, which axe does not attempt. Keep those.

*Also worth doing separately:* `eslint-plugin-jsx-a11y` rules ship inside
`eslint-config-next`, but **26 files under `app/` and `components/` open with a
blanket `/* eslint-disable */`**, including `components/shared/Header.tsx`,
`components/cards/BookCard.tsx`, `app/(consumer)/books/page.tsx` and
`app/(consumer)/books/BookFilters.tsx` — i.e. most of the catalog path. Those
files currently get no lint-level accessibility checking at all. See A11Y-019.

---

## 5. WCAG 2.1 AA criteria in scope

Only criteria that this product can actually violate are listed. Criteria for
media types the site does not ship (live captions, sign language, audio
description of video) are out of scope at launch — but note 1.2.x becomes
relevant the moment a book trailer with speech ships through `VimeoPlayer`.

| Criterion | Level | Scope note |
| --- | --- | --- |
| 1.1.1 Non-text Content | A | Cover images, icon-only buttons, decorative glyphs |
| 1.2.2 Captions (Prerecorded) | A | Applies to book trailers if they contain speech |
| 1.2.3 Audio Description or Media Alternative | A | Trailers only; audiobooks are audio-only and exempt |
| 1.3.1 Info and Relationships | A | Labels, error association, headings, tables, landmarks |
| 1.3.2 Meaningful Sequence | A | DOM order vs. visual order in the two-column layouts |
| 1.3.4 Orientation | AA | No orientation lock is applied — verify on M1/M2 |
| 1.3.5 Identify Input Purpose | AA | `autocomplete` on auth fields |
| 1.4.1 Use of Color | A | Strikethrough pricing; error text colour |
| 1.4.3 Contrast (Minimum) | AA | **Failing — A11Y-001, A11Y-002, A11Y-010** |
| 1.4.4 Resize Text | AA | 200% zoom on all key surfaces |
| 1.4.10 Reflow | AA | 320px width without two-axis scrolling |
| 1.4.11 Non-text Contrast | AA | Focus ring, control borders, player progress bar |
| 1.4.12 Text Spacing | AA | Line-clamped titles are the risk area |
| 1.4.13 Content on Hover or Focus | AA | Sleep-timer popup, tooltips |
| 2.1.1 Keyboard | A | **Failing — A11Y-003, A11Y-005** |
| 2.1.2 No Keyboard Trap | A | Dialogs, sheet nav, sleep-timer popup |
| 2.1.4 Character Key Shortcuts | A | **At risk — A11Y-005** (Space/k/arrows, no opt-out) |
| 2.4.1 Bypass Blocks | A | **Failing — A11Y-007** (no skip link) |
| 2.4.2 Page Titled | A | Per-route `metadata.title` is set |
| 2.4.3 Focus Order | A | Header → main → footer; dialogs |
| 2.4.4 Link Purpose (In Context) | A | Retailer buttons, card links |
| 2.4.5 Multiple Ways | AA | Nav + search + catalog filters |
| 2.4.6 Headings and Labels | AA | **Failing — A11Y-006** (auth pages have no h1) |
| 2.4.7 Focus Visible | AA | Global `:focus-visible` rule exists; verify per control |
| 3.1.1 Language of Page | A | `<html lang="en">` is set |
| 3.2.1 On Focus / 3.2.2 On Input | A | Catalog filters navigate on change — verify |
| 3.2.3 Consistent Navigation | AA | Shared Header/Footer |
| 3.2.4 Consistent Identification | AA | Play/pause naming across player and mini-player |
| 3.3.1 Error Identification | A | **Partly failing — A11Y-008** (admin) |
| 3.3.2 Labels or Instructions | A | Admin required-field marking is `*` only |
| 3.3.3 Error Suggestion | AA | Auth errors are good; admin blockers are good |
| 3.3.4 Error Prevention (Legal, Financial, Data) | AA | Checkout and unpublish confirmation |
| 4.1.2 Name, Role, Value | A | **Failing — A11Y-003, A11Y-008** |
| 4.1.3 Status Messages | AA | `aria-live` on auth; **missing on the publish checklist** |

---

## 6. Findings from static inspection

Severity: **Critical** = blocks a key task outright · **High** = blocks or
severely degrades a key task for one user group · **Medium** = must-fix, task
still completable · **Low** = polish.

All fixes below are in application code, which this branch does not own. Each
one is handed to the agent owning that file. **No application file was modified
by this work.**

---

### A11Y-001 — `text-secondary` is a surface token used as a text colour · **Critical** · 1.4.3

**Where:** token defined at `app/globals.css:15` (light) and `app/globals.css:38`
(dark); mapped to the `text-secondary` utility at `tailwind.config.ts:29-32`.
Used **149 times across 62 files**, including every key-task surface:
`app/(consumer)/books/[slug]/page.tsx:127,163,172,208,215`,
`app/checkout/page.tsx:92,103,107,114,126`,
`components/players/AudioPlayer.tsx:279,476,483`,
`components/audio/MiniPlayer.tsx:74,78`,
`app/(auth)/login/page.tsx:49`.

**What:** `--secondary` is a *background/surface* token (slate-800 in dark,
slate-100 in light). The matching text token is `--secondary-foreground`, which
is almost never used. `text-secondary` therefore paints body text in a surface
colour. Computed ratios:

| Context | Foreground | Background | Ratio | Required |
| --- | --- | --- | --- | --- |
| Dark theme, on page background | `#1e293b` | `#020817` | **1.37:1** | 4.5:1 |
| Dark theme, inside a `bg-muted` section | `#1e293b` | `#1e293b` | **1.00:1** | 4.5:1 |
| Light theme, on page background | `#f1f5f9` | `#ffffff` | **1.09:1** | 4.5:1 |

Dark is the default theme (`app/providers.tsx:11`, `defaultTheme="dark"`), and
the product detail hero is `<Section className="bg-muted">`
(`app/(consumer)/books/[slug]/page.tsx:111`) — so on the book page the author
byline, the strikethrough price and the "Also available at" heading are
foreground-on-identical-background: **literally invisible to everyone**, not
just to low-vision users.

**Why it blocks a key task:** on the product page the author name and the
original price are unreadable; on the audio player the elapsed/total timecodes
and chapter timestamps are unreadable; at checkout the order-summary lines are
unreadable. A sighted low-vision user cannot verify what they are buying.

**Proposed fix (token-level, one place):** stop using `text-secondary` for text.
Two options, in order of preference:

1. Repoint the utility. In `tailwind.config.ts:29-32`, keep
   `secondary.DEFAULT` for backgrounds but introduce a dedicated
   `--text-secondary` token and migrate the 149 usages to it. Suggested values:
   dark `hsl(215 20.2% 65.1%)` (= the existing `--muted-foreground`, **7.80:1**
   on the page background and 4.6:1 on `bg-muted`); light
   `hsl(215.4 16.3% 46.9%)` (**4.75:1** on white).
2. Cheaper interim: global find-and-replace `text-secondary` →
   `text-muted-foreground`, which already resolves to those exact values and is
   AA-compliant in both themes. Verify `bg-muted` sections separately, where the
   ratio drops to ~4.6:1 — still passing, but with no margin.

Do **not** simply darken `--secondary`: it is doing legitimate work as a surface
colour in `bg-secondary`.

**Owner:** design-system / theme owner. **Verified by:** the `Contrast` spec in
`tests/e2e/accessibility.spec.ts` (currently `test.fixme`) plus a manual check.

---

### A11Y-002 — the default button fails contrast · **High** · 1.4.3

**Where:** `components/ui/button.tsx:9` (base class sets `text-sm`) and
`components/ui/button.tsx:13` (`default: 'bg-primary text-white'`); token at
`app/globals.css:13` and `:36`.

**What:** `#ffffff` on `--primary` `#ef4343` is **3.78:1**. The base class pins
`text-sm` (14px) at `font-medium` (500) for every size including `lg`, so this is
normal-size text and needs **4.5:1**. This is the site's primary action colour:
"Sign in", "Create account", "Continue to payment", "Create book",
"Save changes", the mini-player play button (`components/audio/MiniPlayer.tsx:96`)
and the catalog sample-play button (`components/audio/SamplePlayButton.tsx:120`).

**Proposed fix:** darken the primary token. Computed candidates against white:

| Value | Hex | Ratio |
| --- | --- | --- |
| `0 84% 60%` (current) | `#ef4343` | 3.78:1 ✗ |
| `0 84% 52%` | `#eb1e1e` | 4.42:1 ✗ |
| `0 84% 50%` | `#eb1414` | **4.53:1** ✓ |
| `0 84% 48%` | `#e11414` | **4.87:1** ✓ (recommended — leaves margin) |
| `0 84% 45%` | `#d31212` | 5.42:1 ✓ |

Changing `--primary` also affects `text-primary` and the focus ring, both of
which *improve*. If brand pushes back on darkening the whole token, the narrower
fix is to give the `default` button variant its own darker background token and
leave `--primary` alone.

**Owner:** design-system / theme owner.

---

### A11Y-003 — the audio seek bar is not keyboard operable · **High** · 2.1.1, 4.1.2

**Where:** `components/players/AudioPlayer.tsx:250-278` (the `role="slider"`
element is declared at line 256).

**What:** the seek bar is a `<div role="slider">` with a full ARIA value
contract (`aria-label`, `aria-valuemin`, `aria-valuemax`, `aria-valuenow`,
`aria-valuetext`) and a `onPointerDown` handler — but **no `tabIndex` and no
`onKeyDown`**. It is announced to a screen reader as a slider and then cannot be
focused or moved. Announcing a control that does not work is worse than not
announcing it: the user is told the affordance exists.

There is a partial mitigation — document-level `←`/`→` shortcuts at
`AudioPlayer.tsx:147-154` seek ±15s — but they only arm after the listener has
interacted with the player (`interactedRef`, line 134), they are undiscoverable
from the slider itself, and they are the cause of A11Y-005.

**Proposed fix** in `components/players/AudioPlayer.tsx:250-263`:

- Add `tabIndex={isActiveTrack && shownDuration > 0 ? 0 : -1}`.
- Add an `onKeyDown` handler implementing the ARIA slider pattern:
  `ArrowLeft`/`ArrowDown` → `seekBy(-5)`, `ArrowRight`/`ArrowUp` → `seekBy(+5)`,
  `PageDown`/`PageUp` → `seekBy(∓60)`, `Home` → `seekTo(0)`, `End` →
  `seekTo(shownDuration)`; call `event.preventDefault()` only for keys handled.
- Add `aria-orientation="horizontal"`.
- Ensure a visible focus ring — the global `:focus-visible` rule in
  `app/globals.css:125-128` will apply once the element is focusable.

**Owner:** audio player owner. **Do not change the engine contract** — every
operation above already exists on `AudioEngine`.

---

### A11Y-004 — heading levels are skipped on three key surfaces · **Medium** · 1.3.1, 2.4.6

**Where:**

- `components/cards/BookCard.tsx:63` and `:97` — every card title is an `<h3>`.
  On `/books` the only other heading is the page `<h1>`, so the outline reads
  **h1 → h3**.
- `components/players/AudioPlayer.tsx:231` — the player renders its `title` prop
  as a hard-coded `<h3>`. On `/audio/[id]` the page `<h1>` is at
  `app/(consumer)/audio/[id]/page.tsx:57` and there is no intervening `<h2>`, so
  again **h1 → h3**.
- `app/(consumer)/books/[slug]/page.tsx:207` — "About this book" is an `<h3>`.
  The only preceding `<h2>` is "Also available at" at line 172, which renders
  **only when the book has retailer links**. A book with none produces
  **h1 → h3**.

**Why it matters:** screen-reader users navigate long pages by heading level.
A skipped level makes the outline lie about the document's structure.

**Proposed fix:** give both components a `headingLevel` prop (default `h3`,
since both are used in genuinely nested contexts elsewhere) and pass `2` from
`/books` and `/audio/[id]`. For the product page, move the `<h2>` out of the
retailer-links conditional — e.g. make the tab section's "About this book" an
`<h2>` at `app/(consumer)/books/[slug]/page.tsx:207`.

**Owner:** catalog / product-page owner and audio player owner.

---

### A11Y-005 — the player's document-level Space handler swallows other controls · **High** · 2.1.1, 2.1.4

**Where:** `components/players/AudioPlayer.tsx:124-170`; the listener is attached
to `document` at line 168, and the Space branch calls `event.preventDefault()`
at line 143-145.

**What:** the shortcut handler ignores only `INPUT`, `TEXTAREA`, `SELECT` and
`contentEditable` targets (`isEditableTarget`, lines 127-131). **Buttons and
links are not excluded**, and the listener is on `document`, not on the player's
root element. Once `interactedRef.current` is true — which happens as soon as a
keyboard user activates the play button (`handlePrimaryAction`, line 173) —
pressing Space while focused on *any* button anywhere on the page calls
`preventDefault()` and toggles playback instead of activating that button.

On the product detail page that includes the Purchase CTA, the wishlist button,
the tab triggers and the review controls. On `/audio/[id]` it includes the
player's own sleep-timer, speed and chapter buttons.

This is also a 2.1.4 concern in its own right: single-character shortcuts
(`Space`, `k`, arrows) are bound with no mechanism to turn them off or remap
them, and the `enableKeyboard` prop defaults to `true` (line 70).

**Proposed fix** in `components/players/AudioPlayer.tsx:124-170`:

1. Attach the listener to `rootRef.current` instead of `document`, or gate it on
   `rootRef.current?.contains(event.target as Node)`. The player already holds
   `rootRef` (line 85) and does not otherwise use it.
2. Extend the exclusion test to any element that natively consumes the key:
   `if ((event.key === ' ' || event.key === 'Enter') && (event.target as HTMLElement)?.closest('button, a[href], [role="button"], summary')) return;`
3. Keep the arrow-key bindings, but only once A11Y-003 gives the slider its own
   handler, so the two do not both fire.

**Owner:** audio player owner.

---

### A11Y-006 — the auth pages have no `<h1>` · **Medium** · 1.3.1, 2.4.6

**Where:** `components/ui/card.tsx:25-34` — `CardTitle` renders an `<h3>`. Used
as the page title at `app/(auth)/login/page.tsx:23`,
`app/(auth)/register/page.tsx:18` and `app/(auth)/reset-password/page.tsx:18`.
`app/(auth)/layout.tsx` adds no heading.

**What:** "Welcome back", "Create an account" and "Reset Password" are the
primary headings of their pages but are marked up as `<h3>`, so those three
pages have no `<h1>` at all and their outline starts at level 3.

**Proposed fix:** `CardTitle` is used in many non-page contexts, so do not change
it globally. Add an `as` prop to `CardTitle` (`components/ui/card.tsx:25`)
defaulting to `'h3'`, and pass `as="h1"` on the three auth pages. Alternatively
render a visually-hidden `<h1>` in `app/(auth)/layout.tsx` per route — less good,
because the visible title still would not be the h1.

**Owner:** design-system owner + auth owner.

---

### A11Y-007 — there is no skip link · **High** · 2.4.1 (Level A)

**Where:** `components/shared/Header.tsx:10-33` renders the header with no
bypass mechanism; `app/layout.tsx:164` renders `<main className="flex-1">` with
**no `id`** to target.

**What:** every page starts with the mobile-menu trigger, the brand link, the
full primary navigation, the search bar and the user menu. A keyboard user tabs
through all of it on every single page load before reaching content. WCAG 2.1
2.4.1 is Level A.

**Proposed fix:**

1. `app/layout.tsx:164` — `<main id="main-content" className="flex-1">`.
2. `components/shared/Header.tsx` — as the first child of `<header>`, before
   `<Container>`:
   ```tsx
   <a
     href="#main-content"
     className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:ring-2 focus:ring-ring"
   >
     Skip to main content
   </a>
   ```
   `sr-only` and `focus:not-sr-only` are stock Tailwind and need no config
   change. Verify the `z-index` clears the sticky header (`z-50` at
   `Header.tsx:12`) — hence `z-[60]`.

**Note on blocking status:** by the §1 definition this does **not** block a key
task — it makes every task slower. It is nevertheless a Level A failure and the
single cheapest fix in this document.

**Owner:** layout / shell owner.

---

### A11Y-008 — admin field errors are not associated with their fields · **High** · 1.3.1, 3.3.1, 4.1.2

**Where:** `app/admin/books/_lib/BookForm.tsx:122-128` (the `FieldError`
component) and every field between lines 312 and 531.

**What:** `FieldError` renders `<p role="alert">{message}</p>` with **no `id`**,
and no admin input sets `aria-describedby` or `aria-invalid`. A screen-reader
user hears the message announced once when it appears, and then — tabbing back
through roughly twenty fields to fix it — has no way to tell which field it
belongs to. The visual association (the message sits under the input) is
sighted-only.

`app/(auth)/login/LoginForm.tsx:95-104` already implements this correctly and is
the pattern to copy.

**Proposed fix** in `app/admin/books/_lib/BookForm.tsx`:

- Line 122: `function FieldError({ id, message }: { id: string; message?: string })`,
  rendering `<p id={id} role="alert" …>`.
- Every call site: `<FieldError id={`${field}-error`} message={visibleErrors[field]} />`.
- Every control: `aria-invalid={!!visibleErrors[field]}` and
  `aria-describedby={visibleErrors[field] ? `${field}-error` : undefined}`.

`focusFirstError` (lines ~166-176) already moves focus to the offending control
by `id`, so the wiring is half done — the description just needs connecting.

**Owner:** admin surfaces owner.

---

### A11Y-009 — the mini-player overlays content with no layout compensation · **Medium** · 2.4.7 / usability

**Where:** `components/audio/MiniPlayer.tsx:45` (`fixed inset-x-0 bottom-0
z-50`), mounted globally at `app/providers.tsx:15`. The component's own docstring
(lines 21-22) flags this: *"The bar is fixed and overlays content; consider
`pb-20` on the page container while a track is active."* No page does.

**What:** with a track loaded, a 64px bar covers the bottom of every page. A
keyboard user who tabs to a control near the bottom of the viewport can have the
focused element hidden behind it, with no way to scroll it into view because the
bar is fixed. (Focus Not Obscured is 2.4.11 in WCAG **2.2**, not 2.1 AA — so this
is a must-fix on usability grounds rather than a 2.1 AA failure. Stating it
precisely rather than overclaiming.)

**Proposed fix:** have `AudioPlayerProvider` expose whether a track is loaded and
apply `pb-20` to the `<main>` wrapper in `app/layout.tsx:164` when it is; or set
`scroll-padding-bottom: 5rem` on `html` in `app/globals.css` while a track is
active, which fixes the scroll-into-view case with one declaration.

**Owner:** layout / shell owner, with the audio player owner.

---

### A11Y-010 — `text-primary` on `bg-muted` fails contrast · **Medium** · 1.4.3

**Where:** `app/(consumer)/books/[slug]/page.tsx:164` (the discounted price) sits
inside `<Section className="bg-muted">` at line 111.

**What:** `#ef4343` on `#1e293b` is **3.86:1**; normal-size text needs 4.5:1.
The same pairing occurs anywhere `text-primary` is used on a muted surface. Note
`text-primary` on the page background is fine at 5.28:1 — it is specifically the
muted surfaces that fail. Fixed as a side effect of A11Y-002 if `--primary` is
darkened to `0 84% 48%` (which raises this to ~4.9:1); verify after that change
rather than fixing separately.

**Owner:** design-system / theme owner.

---

### A11Y-011 — the product page star rating is announced as a glyph · **Medium** · 1.1.1, 1.3.1

**Where:** `app/(consumer)/books/[slug]/page.tsx:145-148`.

**What:** the rating renders `<span className="text-yellow-400">★</span>`
followed by the numeric value. The star has no `aria-hidden`, so a screen reader
announces something like *"black star 4.5"* with no indication of the scale.
`components/cards/BookCard.tsx:104` already does this correctly with
`aria-hidden="true"` — the two are inconsistent.

**Proposed fix** at `app/(consumer)/books/[slug]/page.tsx:145-148`: add
`aria-hidden="true"` to the star span and wrap the pair in
`<span aria-label={`Rated ${Number(avgRating).toFixed(1)} out of 5`}>`, or add an
`sr-only` "out of 5" suffix.

**Owner:** product-page owner.

---

### A11Y-012 — strikethrough pricing relies on visual styling alone · **Low** · 1.4.1, 1.3.1

**Where:** `app/(consumer)/books/[slug]/page.tsx:163`, `app/checkout/page.tsx:107`,
`components/cards/BookCard.tsx:115`.

**What:** a discounted item announces as *"$29.99 $19.99"*. `line-through` is not
conveyed by default in most screen readers, so which figure is the price payable
is ambiguous — on the checkout page, that is the number the user is about to be
charged.

**Proposed fix:** add `sr-only` qualifiers, e.g.
`<span className="sr-only">Original price </span>` and
`<span className="sr-only">Now </span>`, or wrap the old price in `<s>` with an
explicit `aria-label`.

**Owner:** product-page and checkout owners.

---

### A11Y-013 — retailer links do not announce that they open a new tab · **Low** · 3.2.5 (AAA) / 2.4.4

**Where:** `app/(consumer)/books/[slug]/page.tsx:176-182`.

**What:** the "Also available at" buttons are correct on the important points —
real `<a href>` elements, so keyboard reachable; `rel="noopener noreferrer"`
present at line 178; the retailer label is the accessible name. They give no
warning that activating them opens a new tab, which disorients screen-reader and
switch users who then find "back" does nothing. WCAG 3.2.5 is Level AAA so this
is not an AA failure — it is standard practice (technique G201).

**Proposed fix:** append an `sr-only` "(opens in a new tab)" inside the anchor, or
set `aria-label={`${label} (opens in a new tab)`}`. A small external-link icon
with `aria-hidden="true"` helps sighted users at the same time.

**Owner:** product-page owner.

---

### A11Y-014 — the seek slider reports an invalid range before metadata loads · **Low** · 4.1.2

**Where:** `components/players/AudioPlayer.tsx:259-260`.

**What:** when the track is inactive or its duration is unknown, `shownDuration`
is `0`, so the element reports `aria-valuemin="0" aria-valuemax="0"
aria-valuenow="0"` — a slider with no range. Mobile Safari's conservative
`preload="metadata"` behaviour (see BROWSER_MATRIX.md C4) makes this the *normal*
initial state on iOS, not an edge case.

**Proposed fix:** when `shownDuration <= 0`, omit the value attributes and set
`aria-disabled="true"`, or set `aria-valuetext="Duration not yet known"`.

**Owner:** audio player owner.

---

### A11Y-015 — the sleep-timer popup has no menu semantics and does not manage focus · **Low** · 4.1.2, 2.4.3

**Where:** `components/players/AudioPlayer.tsx:361-418`.

**What:** the trigger sets `aria-expanded` (line 367) but not `aria-haspopup`,
and the popup (lines 378-417) is a plain `<div>` of `<button>`s with no
`role="menu"`/`menuitem`. Escape closes it (lines 111-113) but focus is never
moved into it and never explicitly restored. Because the popup follows the
trigger in DOM order, Tab does reach the items, so this is a quality issue rather
than a blocker.

**Proposed fix:** add `aria-haspopup="menu"` to the trigger; give the popup
`role="menu"` and its children `role="menuitem"`; move focus to the first item on
open and back to the trigger on close or Escape. Alternatively reuse
`@radix-ui/react-dropdown-menu`, which is already a dependency and does all of
this.

**Owner:** audio player owner.

---

### A11Y-016 — admin table headers have no `scope` · **Low** · 1.3.1

**Where:** `app/admin/books/page.tsx:89-93`.

**What:** the five `<th>` cells carry no `scope="col"`. Browsers usually infer
scope correctly for a simple single-header table, so this is defensive rather
than broken.

**Proposed fix:** add `scope="col"` to each `<th>`.

**Owner:** admin surfaces owner.

---

### A11Y-017 — the checkout cover image duplicates the adjacent heading · **Low** · 1.1.1

**Where:** `app/checkout/page.tsx:98` — `alt={book.title}`, immediately followed
by `<h2>{book.title}</h2>` at line 102.

**What:** the title is announced twice in a row. The image adds no information
the heading does not already carry, so it is decorative here.

**Proposed fix:** `alt=""`. (Note this is the *opposite* of the product detail
page, where `alt={`Cover of ${book.title}`}` at line 118 is correct because the
cover is the page's primary content.)

**Owner:** checkout owner.

---

### A11Y-018 — the volume control is absent below the `sm` breakpoint · **Informational**

**Where:** `components/players/AudioPlayer.tsx:421` — the volume row is
`hidden items-center gap-1 sm:flex`.

**What:** on phones there is no in-page volume or mute control. This is a
reasonable product decision (hardware volume keys are the platform affordance)
and is **not** a WCAG failure. Recorded so the browser matrix does not report it
as a mobile bug and so the spec skips rather than fails there.

**Owner:** none — documented as intended behaviour. Revisit if a user-facing
mute becomes necessary.

---

### A11Y-019 — blanket `/* eslint-disable */` removes lint-level a11y checking · **Medium** · process

**Where:** 26 files under `app/` and `components/` begin with
`/* eslint-disable */`, including `components/shared/Header.tsx:1`,
`components/cards/BookCard.tsx:1`, `app/(consumer)/books/page.tsx:3`,
`app/(consumer)/books/BookFilters.tsx:1` and six `app/admin/**` pages.

**What:** `eslint-config-next`'s `core-web-vitals` preset includes the
`jsx-a11y` rules (`alt-text`, `aria-props`, `aria-proptypes`,
`aria-unsupported-elements`, `role-has-required-aria-props`,
`role-supports-aria-props`). A file-wide disable turns them all off. Most of the
catalog key-task path is currently unlinted for accessibility, which is how
A11Y-004 and A11Y-011 could land unnoticed.

**Proposed fix:** replace each blanket disable with a narrow one naming the rule
and the reason, e.g. `/* eslint-disable @typescript-eslint/no-explicit-any --
dual-run book shape, see Phoenix WS2d */`. This is a mechanical change per file
and should be done incrementally, not in one PR.

**Owner:** repo maintainer / tooling owner.

---

### Confirmed good (do not regress)

Recorded so a later refactor does not quietly undo them:

- **Auth forms** (`app/(auth)/login/LoginForm.tsx`,
  `register/RegisterForm.tsx`, `reset-password/ResetPasswordForm.tsx`) are the
  best-implemented forms in the repo: `<label htmlFor>` on every field,
  `aria-invalid`, `aria-describedby` pointing at an `id`'d `role="alert"`
  message, a persistent `aria-live="polite"` wrapper so the error is announced,
  `aria-label` on the `<form>`, `aria-busy` on submit, correct `autocomplete`.
- **A global focus indicator exists**: `app/globals.css:125-128` sets
  `outline: 2px solid hsl(var(--ring))` on `:focus-visible`, `--ring` is defined
  in both themes (`:25`, `:48`), and it computes to **5.28:1** against the dark
  page background — passing 1.4.11. Components that suppress it
  (`components/ui/button.tsx:9`, `components/ui/input.tsx`) replace it with
  `focus-visible:ring-2`.
- **Dialogs use Radix** (`components/ui/dialog.tsx`, `components/ui/sheet.tsx`,
  `components/shared/MobileNav.tsx`), which provides focus trapping, focus
  restoration, Escape handling and `aria-modal` for free. The mobile drawer also
  gets `min-h-[44px]` touch targets and a labelled `<nav>`.
- **`<html lang="en">`** at `app/layout.tsx:144`; per-route `metadata.title`.
- **`MiniPlayer`** names every control, marks itself `role="region"
  aria-label="Now playing"`, and correctly hides its decorative cover with
  `alt="" aria-hidden="true"` (`components/audio/MiniPlayer.tsx:59-71`).
- **Book covers** carry `alt={`Cover of ${title}`}` in `BookCard`, the product
  page and the audio page.
- **Catalog filters** are labelled via `aria-label` on the input and both
  `SelectTrigger`s (`app/(consumer)/books/BookFilters.tsx:62,82,98`).

Each of these was verified **by reading the code only**. None has been observed
rendering in a browser or announced by a screen reader.

---

## 7. Per-surface checklist

`Spec` = asserted by `tests/e2e/accessibility.spec.ts`.
`Spec (fixme)` = the assertion is written but disabled because it pins a known
defect; flipping `test.fixme` → `test` is the regression guard for that fix.
`Manual` = requires a human with a keyboard or a screen reader.

### 7.1 Catalog — `/books`

| # | Check | Criterion | How verified | Status |
| --- | --- | --- | --- | --- |
| C1 | Exactly one `<h1>` | 1.3.1 | Spec | ☐ |
| C2 | No skipped heading levels | 1.3.1 | Spec (fixme, A11Y-004) | ☐ |
| C3 | Search + both filters have accessible names | 1.3.1, 4.1.2 | Spec | ☐ |
| C4 | Every image has alt or is decorative | 1.1.1 | Spec | ☐ |
| C5 | Tab reaches filters and the first card, in DOM order | 2.4.3 | Spec | ☐ |
| C6 | Every focus stop shows a visible indicator | 2.4.7 | Spec | ☐ |
| C7 | Cover alt text is *accurate*, not just present | 1.1.1 | Manual | ☐ |
| C8 | Changing a filter does not steal or lose focus | 3.2.2 | Manual | ☐ |
| C9 | Result count change is announced | 4.1.3 | Manual | ☐ |
| C10 | Usable at 200% zoom and 320px reflow | 1.4.4, 1.4.10 | Manual | ☐ |

### 7.2 Product detail — `/books/[slug]`

| # | Check | Criterion | How verified | Status |
| --- | --- | --- | --- | --- |
| P1 | Exactly one `<h1>`, naming the book | 1.3.1, 2.4.6 | Spec | ☐ |
| P2 | No skipped heading levels | 1.3.1 | Spec (fixme, A11Y-004) | ☐ |
| P3 | Cover image alt references the title | 1.1.1 | Spec | ☐ |
| P4 | Retailer links carry `rel="noopener noreferrer"` | security | Spec | ☐ |
| P5 | Retailer links are keyboard reachable with a discernible name | 2.1.1, 4.1.2 | Spec | ☐ |
| P6 | Retailer `href` is `https:` | — | Spec | ☐ |
| P7 | Purchase CTA reachable with visible focus | 2.1.1, 2.4.7 | Spec | ☐ |
| P8 | Tabs expose `tablist`/`tab`/`tabpanel` + `aria-selected` | 4.1.2 | Spec | ☐ |
| P9 | Arrow keys move tab selection | 2.1.1 | Spec | ☐ |
| P10 | Price and rating are readable | 1.4.3 | Spec (fixme, A11Y-001) | ☐ |
| P11 | Rating announces its scale | 1.1.1 | Manual (A11Y-011) | ☐ |
| P12 | Discounted price is unambiguous when announced | 1.4.1 | Manual (A11Y-012) | ☐ |
| P13 | New-tab behaviour is warned about | 3.2.5 | Manual (A11Y-013) | ☐ |
| P14 | Reviews section is operable by keyboard | 2.1.1 | Manual | ☐ |

### 7.3 Audio player — `/audio/[id]`, Audio Sample tab

| # | Check | Criterion | How verified | Status |
| --- | --- | --- | --- | --- |
| A1 | Play/pause has an accessible name | 4.1.2 | Spec | ☐ |
| A2 | Play/pause state is exposed via its name | 4.1.2 | Spec | ☐ |
| A3 | ±15s controls named and focusable | 2.1.1, 4.1.2 | Spec | ☐ |
| A4 | Every transport control shows visible focus | 2.4.7 | Spec | ☐ |
| A5 | Volume is a named slider that responds to arrows | 2.1.1, 4.1.2 | Spec | ☐ |
| A6 | Mute toggle named and stateful | 4.1.2 | Spec | ☐ |
| A7 | Seek bar exposes a full slider ARIA contract | 4.1.2 | Spec | ☐ |
| A8 | Seek bar is focusable and operable by keyboard | 2.1.1 | Spec (fixme, A11Y-003) | ☐ |
| A9 | Shortcuts do not swallow Space on other controls | 2.1.1, 2.1.4 | Spec (fixme, A11Y-005) | ☐ |
| A10 | Timecodes and chapter times are readable | 1.4.3 | Manual (A11Y-001) | ☐ |
| A11 | Chapter list navigable and current chapter announced | 4.1.2 | Manual | ☐ |
| A12 | Sleep-timer popup does not trap focus | 2.1.2 | Manual (A11Y-015) | ☐ |
| A13 | Buffering / resume prompt announced | 4.1.3 | Manual | ☐ |
| A14 | Mini-player controls reachable and named | 2.1.1 | Manual | ☐ |
| A15 | Progress bar has 3:1 non-text contrast | 1.4.11 | Manual | ☐ |

### 7.4 Auth — `/login`, `/register`, `/reset-password`

| # | Check | Criterion | How verified | Status |
| --- | --- | --- | --- | --- |
| U1 | Form has an accessible name | 1.3.1 | Spec | ☐ |
| U2 | Every input has a programmatic label | 1.3.1, 3.3.2 | Spec | ☐ |
| U3 | Errors are announced (`role="alert"`) | 4.1.3 | Spec | ☐ |
| U4 | Errored input sets `aria-invalid="true"` | 4.1.2 | Spec | ☐ |
| U5 | Error text reachable via `aria-describedby` | 1.3.1, 3.3.1 | Spec | ☐ |
| U6 | Tab order runs email → password → submit | 2.4.3 | Spec | ☐ |
| U7 | Every focus stop shows an indicator | 2.4.7 | Spec | ☐ |
| U8 | Page has an `<h1>` | 2.4.6 | Spec (fixme, A11Y-006) | ☐ |
| U9 | `autocomplete` lets a password manager fill | 1.3.5 | Manual | ☐ |
| U10 | Error text is understandable and actionable | 3.3.3 | Manual | ☐ |
| U11 | Full journey completable with a screen reader | 2.1.1 | Manual | ☐ |

### 7.5 Checkout

| # | Check | Criterion | How verified | Status |
| --- | --- | --- | --- | --- |
| K1 | Exactly one `<h1>` | 1.3.1 | Spec | ☐ |
| K2 | Payment CTA named, reachable, visible focus | 2.1.1, 2.4.7 | Spec | ☐ |
| K3 | Order summary readable | 1.4.3 | Manual (A11Y-001) | ☐ |
| K4 | Price payable unambiguous when announced | 1.4.1 | Manual (A11Y-012) | ☐ |
| K5 | Stripe hosted page usable with a screen reader | 3.3.4 | Manual (third party) | ☐ |
| K6 | Cover image does not duplicate the heading | 1.1.1 | Manual (A11Y-017) | ☐ |

### 7.6 Navigation, dialogs and global chrome

| # | Check | Criterion | How verified | Status |
| --- | --- | --- | --- | --- |
| N1 | banner / main / contentinfo landmarks present | 1.3.1 | Spec | ☐ |
| N2 | Skip link moves focus to `<main>` | 2.4.1 | Spec (fixme, A11Y-007) | ☐ |
| N3 | Mobile drawer traps focus while open | 2.1.2 | Spec | ☐ |
| N4 | Closing the drawer restores focus to its trigger | 2.4.3 | Spec | ☐ |
| N5 | Focus ring is visible on the brand link | 2.4.7 | Spec | ☐ |
| N6 | Mini-player does not obscure focused content | usability | Manual (A11Y-009) | ☐ |
| N7 | Nav order matches visual order | 1.3.2 | Manual | ☐ |
| N8 | Works at 200% zoom / 320px reflow | 1.4.4, 1.4.10 | Manual | ☐ |

### 7.7 Admin publishing (credentialed)

Specs skip with a message naming `NEXT_PUBLIC_SUPABASE_URL`, `TEST_ADMIN_EMAIL`
and `TEST_ADMIN_PASSWORD` when those are unset, so CI stays green without them.

| # | Check | Criterion | How verified | Status |
| --- | --- | --- | --- | --- |
| M1 | Form has an accessible name | 1.3.1 | Spec | ☐ |
| M2 | Every field has a programmatic label | 1.3.1, 3.3.2 | Spec | ☐ |
| M3 | Heading outline well formed (one h1, no skips) | 1.3.1 | Spec | ☐ |
| M4 | Publish blockers are announced on submit | 3.3.1, 4.1.3 | Spec | ☐ |
| M5 | Field errors associated via `aria-describedby`/`aria-invalid` | 1.3.1, 4.1.2 | Spec (fixme, A11Y-008) | ☐ |
| M6 | Every admin control shows visible focus | 2.4.7 | Spec | ☐ |
| M7 | Publish-readiness changes are announced live | 4.1.3 | Manual | ☐ |
| M8 | Unpublish confirmation is announced and cancellable | 3.3.4 | Manual | ☐ |
| M9 | Full publish flow completable with a screen reader | 2.1.1 | Manual | ☐ |
| M10 | File upload fields operable by keyboard | 2.1.1 | Manual | ☐ |

---

## 8. Remediation log

One row per finding. Copy the template; do not overwrite history.

| ID | Summary | Severity | Owner | Files | Status | Fix PR | Verified by | Date | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| A11Y-001 | `text-secondary` unreadable (1.37:1 / 1.00:1) | Critical | theme | `app/globals.css`, `tailwind.config.ts`, 62 files | Open |  |  |  | Blocks reading price/author/timecodes |
| A11Y-002 | Default button 3.78:1 | High | theme | `components/ui/button.tsx`, `app/globals.css` | Open |  |  |  |  |
| A11Y-003 | Seek bar not keyboard operable | High | audio | `components/players/AudioPlayer.tsx` | Open |  |  |  |  |
| A11Y-004 | Heading levels skipped | Medium | catalog + audio | `BookCard.tsx`, `AudioPlayer.tsx`, `books/[slug]/page.tsx` | Open |  |  |  |  |
| A11Y-005 | Document-level Space handler | High | audio | `components/players/AudioPlayer.tsx` | Open |  |  |  |  |
| A11Y-006 | Auth pages have no `<h1>` | Medium | design-system + auth | `components/ui/card.tsx`, 3 auth pages | Open |  |  |  |  |
| A11Y-007 | No skip link | High | shell | `components/shared/Header.tsx`, `app/layout.tsx` | Open |  |  |  | Level A; cheapest fix here |
| A11Y-008 | Admin errors not associated | High | admin | `app/admin/books/_lib/BookForm.tsx` | Open |  |  |  |  |
| A11Y-009 | Mini-player overlays content | Medium | shell + audio | `MiniPlayer.tsx`, `app/layout.tsx` | Open |  |  |  |  |
| A11Y-010 | `text-primary` on `bg-muted` 3.86:1 | Medium | theme | `books/[slug]/page.tsx` | Open |  |  |  | May resolve via A11Y-002 |
| A11Y-011 | Star rating announced as a glyph | Medium | product page | `books/[slug]/page.tsx` | Open |  |  |  |  |
| A11Y-012 | Strikethrough price ambiguous | Low | product + checkout | 3 files | Open |  |  |  |  |
| A11Y-013 | New-tab links unannounced | Low | product page | `books/[slug]/page.tsx` | Open |  |  |  | AAA, not AA |
| A11Y-014 | Slider range invalid pre-metadata | Low | audio | `AudioPlayer.tsx` | Open |  |  |  |  |
| A11Y-015 | Sleep-timer popup semantics | Low | audio | `AudioPlayer.tsx` | Open |  |  |  |  |
| A11Y-016 | `<th>` missing `scope` | Low | admin | `app/admin/books/page.tsx` | Open |  |  |  |  |
| A11Y-017 | Checkout alt duplicates heading | Low | checkout | `app/checkout/page.tsx` | Open |  |  |  |  |
| A11Y-018 | No mobile volume control | Info | — | `AudioPlayer.tsx` | Accepted | — | — |  | Intended behaviour |
| A11Y-019 | Blanket `eslint-disable` (26 files) | Medium | tooling | 26 files | Open |  |  |  | Incremental |

**Template for a new row:**

```
| A11Y-0NN | <one line> | Critical/High/Medium/Low | <owning agent or team> | <file:line> | Open/In review/Fixed/Won't fix | <PR> | <who re-tested> | <date> | <notes> |
```

**Definition of done for a remediation:**

1. The fix is merged.
2. The corresponding `test.fixme` in `tests/e2e/accessibility.spec.ts` is flipped
   to `test` and passes in CI.
3. The relevant §7 checklist row is ticked, dated and initialled.
4. If the finding was Critical or High, it is re-tested manually with a screen
   reader, not only by the spec.

---

## 9. Sign-off

Launch sign-off requires all four:

| Gate | Owner | Date | Result |
| --- | --- | --- | --- |
| No Critical or High finding is Open | Engineering |  |  |
| `tests/e2e/accessibility.spec.ts` green in CI | CI |  |  |
| Manual keyboard-only pass of all eight key tasks | Accessibility |  |  |
| Manual screen-reader pass (VoiceOver + NVDA) of all eight key tasks | Accessibility |  |  |

Cross-browser sign-off is a separate gate — see
`docs/operations/BROWSER_MATRIX.md`.

---

## 10. Caveats on this document

- **Nothing here has been observed in a browser.** Every finding is derived from
  reading source and, for contrast, from arithmetic on declared design tokens.
  Line numbers are accurate as of `task/phase1-catalog-data-path` at the time of
  writing and will drift.
- **A surface with no finding is not a passing surface.** Static review cannot
  detect a wrong focus order, an inaccurate alt text, an unannounced state
  change, a reflow break at 320px, or a control that is technically labelled but
  incomprehensible when announced. The empty checkboxes in §7 are the real state.
- **Contrast ratios assume the declared tokens are what renders.** A runtime
  override, a `style` attribute, or an image behind the text would change them.
  The `Contrast` spec recomputes the same ratios from live computed styles —
  trust that over this document once it has run.
- **Third-party surfaces are out of scope for fixes.** Stripe Checkout and Vimeo
  embeds are audited as pass/fail only; we cannot remediate them.
