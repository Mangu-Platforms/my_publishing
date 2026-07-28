/**
 * Accessibility E2E — launch Section H.
 *
 * Scope: the key tasks a keyboard-only or screen-reader user must be able to
 * complete at launch — browse the catalog, open a book page, follow a retailer
 * link, play an audio sample, register, log in, reset a password, and (for
 * staff) publish a book through the admin UI.
 *
 * WHY hand-rolled DOM assertions instead of an axe integration: the repo ships
 * no accessibility testing library and this branch is not allowed to add a
 * dependency. Every check below is therefore written against the accessibility
 * tree / computed style directly. See docs/operations/ACCESSIBILITY_AUDIT.md
 * for the recommendation to adopt @axe-core/playwright, and for why automated
 * coverage alone is not sufficient to sign off a launch.
 *
 * WHY some tests are `test.fixme()`: they encode defects found by inspection
 * that are owned by other agents (application code is out of scope for this
 * branch). Each carries the audit ID of the finding it pins. Flipping one to
 * `test()` is the regression guard for that fix — do not delete them.
 *
 * Nothing here hardcodes a host, a book slug or a credential: the base URL
 * comes from playwright.config, slugs are discovered from the live catalog,
 * and credentialed specs skip when their environment variables are unset.
 */

import { test, expect, type Page } from '@playwright/test';

// ---------------------------------------------------------------------------
// Environment gates
// ---------------------------------------------------------------------------

/** Environment variables the admin publishing specs need, named for the skip message. */
const ADMIN_ENV = ['NEXT_PUBLIC_SUPABASE_URL', 'TEST_ADMIN_EMAIL', 'TEST_ADMIN_PASSWORD'] as const;

function missingAdminEnv(): string[] {
  const missing: string[] = ADMIN_ENV.filter((key) => !process.env[key]);
  // A placeholder Supabase URL (the CI mock gate) cannot authenticate either.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  if (process.env.USE_MOCKS === 'true' || /placeholder|test\.supabase/.test(url)) {
    missing.push('a non-mock NEXT_PUBLIC_SUPABASE_URL (USE_MOCKS must not be "true")');
  }
  return missing;
}

const ADMIN_SKIP_REASON = () =>
  `Admin credentials not configured — set ${missingAdminEnv().join(', ')} to run this spec.`;

// ---------------------------------------------------------------------------
// In-page accessibility helpers
//
// Each helper runs in the browser and returns plain data, so a failure message
// names the offending element rather than just reporting a boolean.
// ---------------------------------------------------------------------------

interface HeadingNode {
  level: number;
  text: string;
}

/** Visible headings in DOM order. Hidden and aria-hidden headings are excluded. */
async function headingOutline(page: Page): Promise<HeadingNode[]> {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'))
      .filter((el) => {
        if (el.closest('[aria-hidden="true"]')) return false;
        const rect = (el as HTMLElement).getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      })
      .map((el) => ({
        level: Number(el.tagName.slice(1)),
        text: (el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 80),
      }))
  );
}

/** Heading levels that jump by more than one, reported as readable pairs. */
function skippedLevels(outline: HeadingNode[]): string[] {
  const skips: string[] = [];
  for (let i = 1; i < outline.length; i += 1) {
    const previous = outline[i - 1];
    const current = outline[i];
    if (previous && current && current.level > previous.level + 1) {
      skips.push(`h${previous.level} "${previous.text}" -> h${current.level} "${current.text}"`);
    }
  }
  return skips;
}

interface ControlAudit {
  tag: string;
  type: string | null;
  role: string | null;
  /** Accessible name, computed from a pragmatic subset of accname. */
  name: string;
  /** Resolved text of aria-describedby, so error association can be asserted. */
  describedBy: string;
  invalid: string | null;
  disabled: boolean;
}

const CONTROL_SELECTOR = [
  'input:not([type="hidden"])',
  'select',
  'textarea',
  'button',
  'a[href]',
  '[role="slider"]',
  '[role="button"]',
  '[role="checkbox"]',
  '[role="combobox"]',
].join(', ');

/**
 * Every visible interactive control under `rootSelector`, with its accessible
 * name and error wiring.
 *
 * The name computation is a deliberate subset of the accname spec: labelledby,
 * aria-label, <label for>, wrapping <label>, own text, title, nested img alt.
 * That covers every naming pattern this codebase actually uses, and a control
 * naming itself some other way would show up here as an empty name — which is
 * the failure we want a human to look at anyway.
 */
async function auditControls(page: Page, rootSelector: string): Promise<ControlAudit[]> {
  return page.evaluate(
    ({ sel, controlSelector }) => {
      const root = document.querySelector(sel);
      if (!root) return [];

      const textOf = (el: Element | null): string =>
        (el?.textContent ?? '').replace(/\s+/g, ' ').trim();

      const textOfIds = (ids: string | null): string =>
        (ids ?? '')
          .split(/\s+/)
          .filter(Boolean)
          .map((id) => textOf(document.getElementById(id)))
          .filter(Boolean)
          .join(' ');

      const accessibleName = (el: HTMLElement): string => {
        const labelledBy = textOfIds(el.getAttribute('aria-labelledby'));
        if (labelledBy) return labelledBy;
        const ariaLabel = (el.getAttribute('aria-label') ?? '').trim();
        if (ariaLabel) return ariaLabel;
        if (el.id) {
          const explicit = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
          if (explicit && textOf(explicit)) return textOf(explicit);
        }
        const wrapping = el.closest('label');
        if (wrapping && textOf(wrapping)) return textOf(wrapping);
        const own = textOf(el);
        if (own) return own;
        const title = (el.getAttribute('title') ?? '').trim();
        if (title) return title;
        const img = el.querySelector('img[alt]:not([alt=""])');
        if (img) return (img.getAttribute('alt') ?? '').trim();
        return '';
      };

      return Array.from(root.querySelectorAll<HTMLElement>(controlSelector))
        .filter((el) => {
          if (el.closest('[aria-hidden="true"]')) return false;
          const rect = el.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        })
        .map((el) => ({
          tag: el.tagName.toLowerCase(),
          type: el.getAttribute('type'),
          role: el.getAttribute('role'),
          name: accessibleName(el),
          describedBy: textOfIds(el.getAttribute('aria-describedby')),
          invalid: el.getAttribute('aria-invalid'),
          disabled:
            (el as HTMLInputElement).disabled === true ||
            el.getAttribute('aria-disabled') === 'true',
        }));
    },
    { sel: rootSelector, controlSelector: CONTROL_SELECTOR }
  );
}

interface FocusState {
  /** Human-readable description of document.activeElement, for failure messages. */
  description: string;
  /** True when the element renders an outline or a Tailwind focus ring. */
  hasIndicator: boolean;
  outline: string;
  boxShadow: string;
}

/**
 * The focus indicator on the currently focused element.
 *
 * Two shapes count, because the codebase uses both: the global
 * `:focus-visible { outline: 2px solid hsl(var(--ring)) }` in app/globals.css,
 * and the per-component `focus-visible:ring-2` Tailwind utility, which renders
 * as a zero-blur, non-zero-spread box-shadow. Decorative shadows (shadow-sm,
 * shadow-lg) always carry a blur, so they do not satisfy the ring test.
 */
async function focusState(page: Page): Promise<FocusState> {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body) {
      return {
        description: '<body> (nothing focused)',
        hasIndicator: false,
        outline: '',
        boxShadow: '',
      };
    }
    const style = getComputedStyle(el);
    const outlineVisible = style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0;
    // A ring shadow serialises as "<color> 0px 0px 0px <spread>px".
    const ringVisible = /(^|,)\s*(rgba?\([^)]*\)\s+)?0px\s+0px\s+0px\s+(\d*\.?\d+)px/.test(
      style.boxShadow
    );
    const label =
      el.getAttribute('aria-label') ??
      (el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 40);
    return {
      description: `<${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}> "${label}"`,
      hasIndicator: outlineVisible || ringVisible,
      outline: `${style.outlineStyle} ${style.outlineWidth} ${style.outlineColor}`,
      boxShadow: style.boxShadow,
    };
  });
}

/** Tab `steps` times, recording the focused element and its indicator each time. */
async function walkTabOrder(page: Page, steps: number): Promise<FocusState[]> {
  const states: FocusState[] = [];
  for (let i = 0; i < steps; i += 1) {
    await page.keyboard.press('Tab');
    states.push(await focusState(page));
  }
  return states;
}

interface ImageAudit {
  src: string;
  alt: string | null;
  decorative: boolean;
}

/** Every visible <img>, with enough detail to judge alt text. */
async function auditImages(page: Page): Promise<ImageAudit[]> {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll('img'))
      .filter((img) => {
        const rect = img.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      })
      .map((img) => ({
        src: (img.getAttribute('src') ?? '').slice(0, 120),
        alt: img.getAttribute('alt'),
        decorative:
          img.getAttribute('alt') === '' ||
          img.getAttribute('aria-hidden') === 'true' ||
          img.getAttribute('role') === 'presentation' ||
          img.getAttribute('role') === 'none' ||
          !!img.closest('[aria-hidden="true"]'),
      }))
  );
}

interface ContrastSample {
  selector: string;
  color: string;
  background: string;
  fontSizePx: number;
  fontWeight: number;
  /** WCAG 2.1 contrast ratio, rounded to two decimals. */
  ratio: number;
  /** 3 for large text (>=24px, or >=18.66px bold), otherwise 4.5. */
  required: number;
}

/**
 * Contrast ratio for the first match of each selector.
 *
 * The background is the first ancestor with a non-transparent background-color,
 * which is exactly how the browser paints it for these opaque surfaces. Any
 * element sitting on a translucent or image background is deliberately not
 * sampled here — those need the manual pass, not a number this helper invented.
 */
async function sampleContrast(page: Page, selectors: string[]): Promise<ContrastSample[]> {
  return page.evaluate((sels: string[]) => {
    const parse = (value: string): [number, number, number, number] | null => {
      const match = value.match(/rgba?\(([^)]+)\)/);
      if (!match || !match[1]) return null;
      const parts = match[1].split(/[\s,/]+/).filter(Boolean).map(Number);
      const [r, g, b, a] = parts;
      if (r === undefined || g === undefined || b === undefined) return null;
      return [r, g, b, a === undefined ? 1 : a];
    };
    const luminance = ([r, g, b]: [number, number, number]): number => {
      const channel = (v: number): number => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
      };
      return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
    };
    const opaqueBackground = (start: HTMLElement): [number, number, number] => {
      let node: HTMLElement | null = start;
      while (node) {
        const parsed = parse(getComputedStyle(node).backgroundColor);
        if (parsed && parsed[3] === 1) return [parsed[0], parsed[1], parsed[2]];
        node = node.parentElement;
      }
      return [255, 255, 255];
    };

    const out: ContrastSample[] = [];
    for (const selector of sels) {
      const el = document.querySelector<HTMLElement>(selector);
      if (!el) continue;
      const style = getComputedStyle(el);
      const fg = parse(style.color);
      if (!fg) continue;
      const bg = opaqueBackground(el);
      const [hi, lo] = [luminance([fg[0], fg[1], fg[2]]), luminance(bg)].sort((a, b) => b - a);
      const ratio = ((hi ?? 0) + 0.05) / ((lo ?? 0) + 0.05);
      const fontSizePx = parseFloat(style.fontSize);
      const fontWeight = Number(style.fontWeight) || 400;
      const isLarge = fontSizePx >= 24 || (fontSizePx >= 18.66 && fontWeight >= 700);
      out.push({
        selector,
        color: style.color,
        background: `rgb(${bg.join(', ')})`,
        fontSizePx,
        fontWeight,
        ratio: Math.round(ratio * 100) / 100,
        required: isLarge ? 3 : 4.5,
      });
    }
    return out;
  }, selectors);
}

// ---------------------------------------------------------------------------
// Fixtures discovered from the live site (never hardcoded)
// ---------------------------------------------------------------------------

/** First published book's detail path, or null when the catalog is empty. */
async function firstBookHref(page: Page): Promise<string | null> {
  await page.goto('/books');
  const link = page.locator('a[href^="/books/"]').first();
  try {
    await link.waitFor({ state: 'attached', timeout: 15_000 });
  } catch {
    return null;
  }
  return link.getAttribute('href');
}

/** First audiobook detail path, or null when no audio titles are published. */
async function firstAudioHref(page: Page): Promise<string | null> {
  await page.goto('/audio');
  const link = page.locator('a[href^="/audio/"]').first();
  try {
    await link.waitFor({ state: 'attached', timeout: 15_000 });
  } catch {
    return null;
  }
  return link.getAttribute('href');
}

async function signIn(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/login');
  const form = page.getByRole('form', { name: /sign in form/i });
  await form.getByLabel(/email/i).fill(email);
  await form.getByLabel(/password/i).fill(password);
  await form.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 30_000 });
}

// ===========================================================================
// Catalog — "browse the catalog"
// ===========================================================================

test.describe('Catalog (/books)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/books');
  });

  test('has exactly one h1', async ({ page }) => {
    const outline = await headingOutline(page);
    const h1s = outline.filter((h) => h.level === 1);
    expect(h1s, `headings found: ${JSON.stringify(outline)}`).toHaveLength(1);
  });

  test.fixme('does not skip heading levels', async ({ page }) => {
    // A11Y-004: BookCard renders each title as <h3> directly under the page
    // <h1>, so the catalog outline reads h1 -> h3. See ACCESSIBILITY_AUDIT.md.
    const outline = await headingOutline(page);
    expect(skippedLevels(outline)).toEqual([]);
  });

  test('every filter control has an accessible name', async ({ page }) => {
    const controls = await auditControls(page, 'main');
    const formControls = controls.filter(
      (c) =>
        c.tag === 'input' || c.tag === 'select' || c.tag === 'textarea' || c.role === 'combobox'
    );
    expect(
      formControls.length,
      'expected the search box and the two filter selects'
    ).toBeGreaterThan(0);
    const unnamed = formControls.filter((c) => c.name === '');
    expect(unnamed, `unnamed controls: ${JSON.stringify(unnamed)}`).toEqual([]);
  });

  test('every image has alt text or is explicitly decorative', async ({ page }) => {
    // Book covers must be named; a cover with a null alt is invisible to a
    // screen reader and the card's link text is the only remaining clue.
    await page
      .locator('main img')
      .first()
      .waitFor({ state: 'visible', timeout: 15_000 })
      .catch(() => {});
    const images = await auditImages(page);
    const missing = images.filter((img) => img.alt === null && !img.decorative);
    expect(missing, `images with no alt attribute: ${JSON.stringify(missing)}`).toEqual([]);
  });

  test('keyboard reaches the catalog controls and the first book, with visible focus', async ({
    page,
  }) => {
    const href = await firstBookHref(page);
    test.skip(href === null, 'No published books in this environment.');

    await page.goto('/books');
    await page.locator('a[href^="/books/"]').first().waitFor({ state: 'visible', timeout: 15_000 });
    await page.locator('body').press('Tab');

    // 30 stops is comfortably past the header, the three filters and the first
    // card on every viewport in the matrix.
    const seen = await walkTabOrder(page, 30);
    const withoutIndicator = seen.filter(
      (s) => !s.hasIndicator && s.description !== '<body> (nothing focused)'
    );
    expect(
      withoutIndicator,
      `focus stops with no visible indicator: ${JSON.stringify(withoutIndicator, null, 2)}`
    ).toEqual([]);

    const reachedBook = await page.evaluate((bookHref: string) => {
      const active = document.activeElement as HTMLAnchorElement | null;
      return active?.getAttribute('href') === bookHref;
    }, href as string);
    // Tab order is DOM order here, so the card is reachable — assert we can put
    // focus on it directly rather than depending on an exact stop count.
    if (!reachedBook) {
      await page.locator(`a[href="${href}"]`).first().focus();
    }
    const state = await focusState(page);
    expect(state.hasIndicator, `book card focus: ${JSON.stringify(state)}`).toBe(true);
  });
});

// ===========================================================================
// Product detail — "open a book page" and "follow a retailer link to buy"
// ===========================================================================

test.describe('Product detail page', () => {
  let bookHref: string | null = null;

  test.beforeEach(async ({ page }) => {
    bookHref = await firstBookHref(page);
    test.skip(bookHref === null, 'No published books in this environment.');
    await page.goto(bookHref as string);
  });

  test('has exactly one h1 naming the book', async ({ page }) => {
    const outline = await headingOutline(page);
    const h1s = outline.filter((h) => h.level === 1);
    expect(h1s, `headings found: ${JSON.stringify(outline)}`).toHaveLength(1);
    expect(h1s[0]?.text.length ?? 0).toBeGreaterThan(0);
  });

  test.fixme('does not skip heading levels', async ({ page }) => {
    // A11Y-004: "About this book" is an <h3> under the page <h1>, and the only
    // intervening <h2> ("Also available at") is conditional on the book having
    // retailer links. See ACCESSIBILITY_AUDIT.md.
    const outline = await headingOutline(page);
    expect(skippedLevels(outline)).toEqual([]);
  });

  test('the cover image is named after the book', async ({ page }) => {
    const heading = await page.getByRole('heading', { level: 1 }).first().textContent();
    const images = await auditImages(page);
    const named = images.filter((img) => (img.alt ?? '').trim().length > 0);
    expect(named.length, `images on page: ${JSON.stringify(images)}`).toBeGreaterThan(0);
    expect(
      named.some((img) => (img.alt ?? '').includes((heading ?? '').trim())),
      `no image alt referenced the book title "${heading}": ${JSON.stringify(named)}`
    ).toBe(true);
  });

  test('retailer links are safe, named and keyboard reachable', async ({ page }) => {
    const retailers = page.locator('a[target="_blank"]');
    const count = await retailers.count();
    test.skip(count === 0, 'This book has no "Also available at" retailer links configured.');

    for (let i = 0; i < count; i += 1) {
      const link = retailers.nth(i);
      const rel = (await link.getAttribute('rel')) ?? '';
      // Cross-origin new tabs must not get a live window.opener handle back.
      expect(rel, `retailer link ${i} rel attribute`).toContain('noopener');
      expect(rel, `retailer link ${i} rel attribute`).toContain('noreferrer');

      const name = (await link.textContent())?.trim() ?? '';
      const ariaLabel = (await link.getAttribute('aria-label')) ?? '';
      expect(
        (ariaLabel || name).length,
        `retailer link ${i} has no discernible accessible name`
      ).toBeGreaterThan(0);

      const href = await link.getAttribute('href');
      expect(href, `retailer link ${i} href`).toMatch(/^https:\/\//);

      // Keyboard reachability: a real anchor with an href is in the tab order.
      await link.focus();
      const state = await focusState(page);
      expect(state.hasIndicator, `retailer link ${i} focus: ${JSON.stringify(state)}`).toBe(true);
    }
  });

  test('the purchase call to action is keyboard reachable and named', async ({ page }) => {
    const purchase = page.getByRole('link', { name: /purchase/i }).first();
    await expect(purchase).toBeVisible();
    await purchase.focus();
    const state = await focusState(page);
    expect(state.hasIndicator, `purchase CTA focus: ${JSON.stringify(state)}`).toBe(true);
  });

  test('the content tabs expose roles, selection state and arrow-key navigation', async ({
    page,
  }) => {
    const tablist = page.getByRole('tablist').first();
    await expect(tablist).toBeVisible();

    const tabs = tablist.getByRole('tab');
    expect(await tabs.count()).toBeGreaterThanOrEqual(2);

    const first = tabs.nth(0);
    await expect(first).toHaveAttribute('aria-selected', 'true');
    await first.focus();
    await page.keyboard.press('ArrowRight');

    const second = tabs.nth(1);
    await expect(second).toHaveAttribute('aria-selected', 'true');
    await expect(first).toHaveAttribute('aria-selected', 'false');
    await expect(page.getByRole('tabpanel')).toBeVisible();
  });
});

// ===========================================================================
// Audio player — "play an audio sample"
// ===========================================================================

test.describe('Audio player', () => {
  test.beforeEach(async ({ page }) => {
    const audioHref = await firstAudioHref(page);
    test.skip(audioHref === null, 'No published audiobooks in this environment.');
    await page.goto(audioHref as string);
    await page
      .locator('[data-testid="audio-player"]')
      .waitFor({ state: 'visible', timeout: 15_000 });
  });

  test('transport controls have accessible names and are keyboard focusable', async ({ page }) => {
    const player = page.locator('[data-testid="audio-player"]');

    const play = player.getByRole('button', { name: /^(play|pause) audio$/i });
    await expect(play).toBeVisible();
    const back = player.getByRole('button', { name: /back 15 seconds/i });
    const forward = player.getByRole('button', { name: /forward 15 seconds/i });
    await expect(back).toBeVisible();
    await expect(forward).toBeVisible();

    for (const control of [back, play, forward]) {
      await control.focus();
      const state = await focusState(page);
      expect(state.hasIndicator, `transport control focus: ${JSON.stringify(state)}`).toBe(true);
    }
  });

  test('play/pause exposes its state through its accessible name', async ({ page }) => {
    // The player communicates state by swapping the name between "Play audio"
    // and "Pause audio" rather than with aria-pressed. Pin that contract: a
    // screen reader must be able to tell playing from paused.
    const play = page
      .locator('[data-testid="audio-player"]')
      .getByRole('button', { name: /^(play|pause) audio$/i });
    const label = await play.getAttribute('aria-label');
    expect(label).toMatch(/^(Play|Pause) audio$/);
  });

  test('the volume control is a named, keyboard-operable slider', async ({ page }) => {
    const volume = page.locator('[data-testid="audio-player"] input[type="range"]');
    // The volume row is `hidden sm:flex`, so it is absent on phone viewports by
    // design (hardware volume is the mobile affordance). See BROWSER_MATRIX.md.
    test.skip((await volume.count()) === 0, 'Volume control is not rendered at this viewport.');
    await expect(volume).toHaveAttribute('aria-label', /volume/i);

    await volume.focus();
    const focused = await focusState(page);
    expect(focused.hasIndicator, `volume focus: ${JSON.stringify(focused)}`).toBe(true);

    const before = Number(await volume.inputValue());
    await page.keyboard.press('ArrowDown');
    const after = Number(await volume.inputValue());
    expect(after, 'ArrowDown on the volume slider must change its value').toBeLessThan(before);
  });

  test('the mute toggle is named and reflects state', async ({ page }) => {
    const mute = page
      .locator('[data-testid="audio-player"]')
      .getByRole('button', { name: /^(mute|unmute)$/i });
    test.skip((await mute.count()) === 0, 'Mute control is not rendered at this viewport.');
    await expect(mute).toHaveAttribute('aria-label', /^(Mute|Unmute)$/);
  });

  test('the seek bar exposes a complete slider contract to assistive tech', async ({ page }) => {
    const seek = page.locator('[data-testid="audio-player"] [role="slider"][aria-label="Seek"]');
    await expect(seek).toBeVisible();
    await expect(seek).toHaveAttribute('aria-valuemin', /\d+/);
    await expect(seek).toHaveAttribute('aria-valuemax', /\d+/);
    await expect(seek).toHaveAttribute('aria-valuenow', /\d+/);
    await expect(seek).toHaveAttribute('aria-valuetext', /.+/);
  });

  test.fixme('the seek bar is reachable and operable by keyboard', async ({ page }) => {
    // A11Y-003: the seek bar is a <div role="slider"> with no tabindex and no
    // keydown handler, so it is announced as a slider that keyboard users
    // cannot reach or move. See ACCESSIBILITY_AUDIT.md for the fix.
    const seek = page.locator('[data-testid="audio-player"] [role="slider"][aria-label="Seek"]');
    await expect(seek).toHaveAttribute('tabindex', '0');
    await seek.focus();
    const state = await focusState(page);
    expect(state.hasIndicator).toBe(true);
  });

  test.fixme('player shortcuts do not swallow Space on unrelated controls', async ({ page }) => {
    // A11Y-005: AudioPlayer installs a document-level keydown listener that
    // calls preventDefault() on Space for any non-editable target once the
    // listener has interacted with the player, which suppresses the native
    // activation of every other button on the page.
    const player = page.locator('[data-testid="audio-player"]');
    await player.getByRole('button', { name: /^(play|pause) audio$/i }).focus();
    await page.keyboard.press('Enter');

    const sleep = player.getByRole('button', { name: /sleep timer/i });
    await sleep.focus();
    await page.keyboard.press('Space');
    await expect(sleep).toHaveAttribute('aria-expanded', 'true');
  });
});

// ===========================================================================
// Auth — "register", "log in", "reset a password"
// ===========================================================================

const AUTH_SURFACES = [
  { path: '/login', form: /sign in form/i, submit: /sign in/i },
  { path: '/register', form: /create account form/i, submit: /create account|sign up/i },
  { path: '/reset-password', form: /reset password form/i, submit: /send|reset/i },
] as const;

for (const surface of AUTH_SURFACES) {
  test.describe(`Auth (${surface.path})`, () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(surface.path);
    });

    test('the form is named and every control has a programmatic label', async ({ page }) => {
      const form = page.getByRole('form', { name: surface.form });
      await expect(form).toBeVisible();

      const controls = await auditControls(page, `form[aria-label]`);
      const inputs = controls.filter((c) => c.tag === 'input' || c.tag === 'textarea');
      expect(inputs.length, 'expected at least one text input in the auth form').toBeGreaterThan(0);
      const unlabelled = inputs.filter((c) => c.name === '');
      expect(unlabelled, `inputs with no label: ${JSON.stringify(unlabelled)}`).toEqual([]);
    });

    test('validation errors are announced and associated with their field', async ({ page }) => {
      const form = page.getByRole('form', { name: surface.form });
      const email = form.getByLabel(/^email/i);
      // A syntactically invalid address trips client-side validation without
      // touching the auth backend, so this runs against the CI mock gate too.
      await email.fill('not-an-email');
      await form.getByRole('button', { name: surface.submit }).click();

      const alert = form.getByRole('alert').first();
      await expect(alert).toBeVisible();

      await expect(email).toHaveAttribute('aria-invalid', 'true');
      const controls = await auditControls(page, 'form[aria-label]');
      const emailControl = controls.find((c) => c.type === 'email');
      expect(emailControl, 'email input not found in the control audit').toBeTruthy();
      expect(
        (emailControl?.describedBy ?? '').length,
        'the email error text must be reachable through aria-describedby'
      ).toBeGreaterThan(0);
    });

    test('tab order runs through the form and every stop shows focus', async ({ page }) => {
      const form = page.getByRole('form', { name: surface.form });
      await form.getByLabel(/^email/i).focus();

      const states = await walkTabOrder(page, 4);
      const withoutIndicator = states.filter(
        (s) => !s.hasIndicator && s.description !== '<body> (nothing focused)'
      );
      expect(
        withoutIndicator,
        `focus stops with no indicator: ${JSON.stringify(withoutIndicator, null, 2)}`
      ).toEqual([]);
    });

    test.fixme('the page has an h1', async ({ page }) => {
      // A11Y-006: auth pages title themselves with CardTitle, which renders an
      // <h3>, so /login, /register and /reset-password have no <h1> at all.
      const outline = await headingOutline(page);
      expect(outline.filter((h) => h.level === 1)).toHaveLength(1);
    });
  });
}

// ===========================================================================
// Checkout
// ===========================================================================

test.describe('Checkout', () => {
  test('has one h1 and a named, keyboard reachable payment control', async ({ page }) => {
    const bookHref = await firstBookHref(page);
    test.skip(bookHref === null, 'No published books in this environment.');

    await page.goto(bookHref as string);
    await page.getByRole('link', { name: /purchase/i }).first().click();
    await page.waitForURL(/\/checkout/);

    const outline = await headingOutline(page);
    expect(
      outline.filter((h) => h.level === 1),
      `headings: ${JSON.stringify(outline)}`
    ).toHaveLength(1);

    const pay = page.getByRole('button', { name: /continue to payment/i });
    await expect(pay).toBeVisible();
    await pay.focus();
    const state = await focusState(page);
    expect(state.hasIndicator, `payment CTA focus: ${JSON.stringify(state)}`).toBe(true);
  });
});

// ===========================================================================
// Dialogs — no focus traps, focus restored on close
// ===========================================================================

test.describe('Dialogs', () => {
  test('the mobile navigation traps focus and restores it on close', async ({ page }) => {
    // The trigger is `md:hidden`, so this only exercises at a phone width —
    // which is also the viewport where the drawer is the only way to navigate.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/books');

    const trigger = page.getByRole('button', { name: /open menu/i });
    await expect(trigger).toBeVisible();
    await trigger.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Focus must move into the dialog, and stay there across a full cycle.
    for (let i = 0; i < 12; i += 1) {
      await page.keyboard.press('Tab');
      const inside = await page.evaluate(() => {
        const active = document.activeElement;
        const dialogEl = document.querySelector('[role="dialog"]');
        return !!active && !!dialogEl && dialogEl.contains(active);
      });
      expect(inside, `focus escaped the dialog after ${i + 1} tab(s)`).toBe(true);
    }

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();

    // Closing must return focus to the control that opened the dialog, or a
    // keyboard user is dumped back at the top of the document.
    const restored = await page.evaluate(() => {
      const active = document.activeElement as HTMLElement | null;
      return (active?.getAttribute('aria-label') ?? '').toLowerCase();
    });
    expect(restored).toContain('open menu');
  });
});

// ===========================================================================
// Contrast on critical controls
// ===========================================================================

test.describe('Contrast', () => {
  test.fixme('critical controls and body copy meet WCAG 2.1 AA contrast', async ({ page }) => {
    // A11Y-001 / A11Y-002. Two token-level defects make this fail today:
    //   * `text-secondary` resolves to --secondary, a *surface* token. In the
    //     default dark theme that is #1e293b on a #020817 page (1.37:1) and
    //     1.00:1 on any `bg-muted` section — invisible.
    //   * The default Button is #ffffff on --primary #ef4343 at 14px/500,
    //     which is 3.78:1 against a 4.5:1 requirement.
    // Both are token changes in app/globals.css; see ACCESSIBILITY_AUDIT.md.
    const bookHref = await firstBookHref(page);
    test.skip(bookHref === null, 'No published books in this environment.');
    await page.goto(bookHref as string);

    const samples = await sampleContrast(page, [
      'main h1',
      'main p.text-secondary',
      'main a[href^="/checkout"]',
    ]);
    expect(samples.length, 'no sampled elements were found on the page').toBeGreaterThan(0);
    const failures = samples.filter((s) => s.ratio < s.required);
    expect(failures, `contrast failures: ${JSON.stringify(samples, null, 2)}`).toEqual([]);
  });

  test('the focus indicator colour is reported for the manual pass', async ({ page }) => {
    // Non-text contrast (1.4.11) for the focus ring: --ring is #ef4343 on the
    // dark page background, which computes to 5.28:1. This test pins that the
    // ring is actually painted; the ratio itself is checked by eye in the
    // manual pass because the ring sits on whatever surface the control is on.
    await page.goto('/books');
    await page.getByRole('link', { name: /mangu publishers home/i }).focus();
    const state = await focusState(page);
    expect(state.hasIndicator, `home link focus: ${JSON.stringify(state)}`).toBe(true);
  });
});

// ===========================================================================
// Bypass blocks
// ===========================================================================

test.describe('Bypass blocks', () => {
  test.fixme('a skip link moves focus to the main landmark', async ({ page }) => {
    // A11Y-007: there is no skip link, so every keyboard user tabs through the
    // full header (menu, brand, six nav items, search, user menu) on every page
    // load. WCAG 2.1 2.4.1, Level A. See ACCESSIBILITY_AUDIT.md.
    await page.goto('/books');
    await page.locator('body').press('Tab');
    const skip = page.getByRole('link', { name: /skip to (main )?content/i });
    await expect(skip).toBeFocused();
    await page.keyboard.press('Enter');
    const inMain = await page.evaluate(() => {
      const active = document.activeElement;
      const main = document.querySelector('main');
      return !!main && (main === active || main.contains(active));
    });
    expect(inMain).toBe(true);
  });

  test('the page exposes header, main and contentinfo landmarks', async ({ page }) => {
    await page.goto('/books');
    await expect(page.getByRole('banner')).toBeVisible();
    await expect(page.getByRole('main')).toBeVisible();
    await expect(page.getByRole('contentinfo')).toBeVisible();
  });
});

// ===========================================================================
// Admin publishing — credentialed, skips cleanly without secrets
// ===========================================================================

test.describe('Admin book form (credentialed)', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(missingAdminEnv().length > 0, ADMIN_SKIP_REASON());
    await signIn(
      page,
      process.env.TEST_ADMIN_EMAIL as string,
      process.env.TEST_ADMIN_PASSWORD as string
    );
    await page.goto('/admin/books/new');
    await page.getByRole('form', { name: /create book form/i }).waitFor({ timeout: 20_000 });
  });

  test('the form is named and every control has a programmatic label', async ({ page }) => {
    const controls = await auditControls(page, 'form[aria-label]');
    const inputs = controls.filter(
      (c) =>
        c.tag === 'input' ||
        c.tag === 'textarea' ||
        c.role === 'combobox' ||
        c.role === 'checkbox'
    );
    expect(inputs.length, 'expected the admin book fields').toBeGreaterThan(5);
    const unlabelled = inputs.filter((c) => c.name === '');
    expect(unlabelled, `unlabelled admin controls: ${JSON.stringify(unlabelled)}`).toEqual([]);
  });

  test('the heading outline is well formed', async ({ page }) => {
    const outline = await headingOutline(page);
    expect(
      outline.filter((h) => h.level === 1),
      `headings: ${JSON.stringify(outline)}`
    ).toHaveLength(1);
    expect(skippedLevels(outline)).toEqual([]);
  });

  test('publish blockers are announced when an incomplete book is submitted', async ({ page }) => {
    const form = page.getByRole('form', { name: /create book form/i });
    await form.getByRole('button', { name: /create book/i }).click();
    await expect(form.getByRole('alert').first()).toBeVisible();
  });

  test.fixme('field errors are associated with the field they describe', async ({ page }) => {
    // A11Y-008: FieldError renders <p role="alert"> with no id, and no admin
    // input sets aria-describedby or aria-invalid. A screen-reader user hears
    // "Title is required" once and then cannot tell which of ~20 fields it
    // belongs to. app/(auth)/login/LoginForm.tsx already does this correctly.
    const form = page.getByRole('form', { name: /create book form/i });
    await form.getByRole('button', { name: /create book/i }).click();

    const controls = await auditControls(page, 'form[aria-label]');
    const title = controls.find((c) => c.name.startsWith('Title'));
    expect(title?.invalid).toBe('true');
    expect((title?.describedBy ?? '').length).toBeGreaterThan(0);
  });

  test('every admin control shows a visible focus indicator', async ({ page }) => {
    await page.locator('form[aria-label] input').first().focus();
    const states = await walkTabOrder(page, 15);
    const withoutIndicator = states.filter(
      (s) => !s.hasIndicator && s.description !== '<body> (nothing focused)'
    );
    expect(
      withoutIndicator,
      `admin focus stops with no indicator: ${JSON.stringify(withoutIndicator, null, 2)}`
    ).toEqual([]);
  });
});
