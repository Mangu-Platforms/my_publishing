/**
 * Task 3.4 — RBAC verification matrix (role x surface).
 *
 * WHY this file exists: /admin, /author and /partner used to be gated at the
 * Edge by the UNSIGNED, client-settable `mangu-role` cookie. PR #352 moved
 * every role decision server-side —
 *   /admin   -> app/admin/layout.tsx                (requireAdmin)
 *   /author  -> app/(portals)/author/layout.tsx     (requireRole)
 *   /partner -> app/(portals)/partner/layout.tsx    (requireRole)
 * — and left middleware.ts enforcing only "must be signed in", fail-closed.
 * These specs assert that HARDENED contract, not the old cookie behaviour.
 *
 * The assertions deliberately go past the UI. A hidden nav link proves
 * nothing, so every privileged surface is also hit directly: page navigations,
 * route handlers, JSON APIs and raw POSTs to server-action routes.
 *
 * CREDENTIALS: read from environment variables only. There are NO defaults —
 * a spec that silently falls back to a well-known password is a spec that
 * teaches people to create that account in production. Blocks that need a
 * session skip with an explicit reason when the variables are absent, so CI
 * stays green and honest without shipping a credential.
 *
 *   TEST_READER_EMAIL   TEST_READER_PASSWORD
 *   TEST_AUTHOR_EMAIL   TEST_AUTHOR_PASSWORD
 *   TEST_PARTNER_EMAIL  TEST_PARTNER_PASSWORD
 *   TEST_ADMIN_EMAIL    TEST_ADMIN_PASSWORD
 *   TEST_USER_PASSWORD  (shared fallback password for all four)
 */

import { test, expect, type Browser, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

type Role = 'reader' | 'author' | 'partner' | 'admin';

const ROLES: readonly Role[] = ['reader', 'author', 'partner', 'admin'];

// ---------------------------------------------------------------------------
// Surfaces under test
// ---------------------------------------------------------------------------

const ADMIN_PAGES = [
  '/admin/dashboard',
  '/admin/users',
  '/admin/books',
  '/admin/manuscripts',
  '/admin/orders',
  '/admin/health',
];
const AUTHOR_PAGES = ['/author/dashboard', '/author/projects', '/author/submit', '/author/analytics'];
const PARTNER_PAGES = [
  '/partner/dashboard',
  '/partner/orders',
  '/partner/catalogs',
  '/partner/arc-requests',
];
const CUSTOMER_PAGES = ['/library', '/dashboard/settings', '/dashboard/my-reviews'];

/**
 * Portal roots with NO index page. Documented finding, not a bug this spec
 * invents a fix for: /dashboard, /author and /partner have no page.tsx, so a
 * correctly-authorised user still lands on a 404. See the PR body — Renee owns
 * the redirect-vs-index decision.
 */
const PORTAL_ROOTS_WITHOUT_INDEX = ['/dashboard', '/author', '/partner'];

/**
 * Server-action route: a POST to the page path. Real action IDs are
 * build-scoped hashes an attacker cannot read without already rendering the
 * admin page, so what is testable — and what actually matters — is that the
 * route refuses the POST outright for the wrong role and performs no effect.
 */
const ADMIN_ACTION_ROUTES = ['/admin/users', '/admin/books', '/admin/orders'];

/** Strings that must never appear in a denial response. */
const LEAK_MARKERS = [
  'order_number',
  'total_amount',
  'stripe_customer_id',
  'manuscript_url',
  'service_role',
  'SUPABASE_SERVICE_ROLE_KEY',
  '"role":"admin"',
];

function assertNoLeak(body: string, context: string) {
  for (const marker of LEAK_MARKERS) {
    expect(body, `${context} must not leak "${marker}"`).not.toContain(marker);
  }
}

// ---------------------------------------------------------------------------
// Credentials (env only, no defaults)
// ---------------------------------------------------------------------------

interface Credentials {
  email: string;
  password: string;
}

function credentialsFor(role: Role): Credentials | null {
  const email = process.env[`TEST_${role.toUpperCase()}_EMAIL`];
  const password =
    process.env[`TEST_${role.toUpperCase()}_PASSWORD`] ?? process.env.TEST_USER_PASSWORD;
  if (!email || !password) return null;
  return { email, password };
}

const missingCredentialsReason = (role: Role) =>
  `No credentials for "${role}". Set TEST_${role.toUpperCase()}_EMAIL and ` +
  `TEST_${role.toUpperCase()}_PASSWORD (or TEST_USER_PASSWORD) to run this block.`;

/**
 * Role enforcement only happens when a real auth backend answers. Under the CI
 * mock gate (USE_MOCKS=true / placeholder Supabase) sessions cannot be created
 * at all, so credentialed blocks would fail for the wrong reason.
 */
const hasRealAuthBackend = () =>
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.USE_MOCKS !== 'true' &&
  !/placeholder|example\.supabase|test\.supabase/.test(process.env.NEXT_PUBLIC_SUPABASE_URL);

// ---------------------------------------------------------------------------
// Storage-state cache
// ---------------------------------------------------------------------------
//
// Middleware rate-limits auth POSTs (5 per 60s per IP), so logging in per test
// would trip the limiter and produce failures that look like RBAC bugs. This
// reuses the SAME gitignored `.auth/<role>.json` cache and lock protocol as
// tests/e2e/role-gating.spec.ts on purpose: shared cache means the whole suite
// performs at most one UI login per role per freshness window.

const AUTH_DIR = path.join(__dirname, '..', '..', '.auth');
const STATE_MAX_AGE_MS = 45 * 60 * 1000; // Supabase access tokens live ~1h.
const LOCK_STALE_MS = 3 * 60 * 1000;

const authFile = (role: Role) => path.join(AUTH_DIR, `${role}.json`);

function isFresh(file: string): boolean {
  try {
    return Date.now() - fs.statSync(file).mtimeMs < STATE_MAX_AGE_MS;
  } catch {
    return false;
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Cross-process lock via atomic mkdir; prevents two workers logging in twice. */
async function withLock<T>(lockDir: string, fn: () => Promise<T>): Promise<T> {
  const deadline = Date.now() + 120_000;
  for (;;) {
    try {
      fs.mkdirSync(lockDir, { recursive: false });
      break;
    } catch {
      try {
        if (Date.now() - fs.statSync(lockDir).mtimeMs > LOCK_STALE_MS) {
          fs.rmdirSync(lockDir);
          continue;
        }
      } catch {
        continue; // Released between check and stat; retry mkdir.
      }
      if (Date.now() > deadline) throw new Error(`Timed out waiting for auth lock: ${lockDir}`);
      await sleep(500);
    }
  }
  try {
    return await fn();
  } finally {
    try {
      fs.rmdirSync(lockDir);
    } catch {
      // Best effort; the staleness check reclaims an orphaned lock.
    }
  }
}

async function loginViaUi(page: Page, role: Role, credentials: Credentials): Promise<void> {
  await page.goto('/login');
  // Scope to the sign-in form: the footer newsletter input also matches /email/i.
  const form = page.getByRole('form', { name: /sign in form/i });
  await form.getByLabel(/email/i).fill(credentials.email);
  await form.getByLabel(/password/i).fill(credentials.password);
  await page.getByRole('button', { name: /sign in/i }).click();

  try {
    await page.waitForURL((url) => url.pathname === '/', { timeout: 20_000 });
  } catch (error) {
    const alert = await page
      .getByRole('alert')
      .first()
      .textContent()
      .catch(() => null);
    // Never echo the password; the email is already operator-supplied config.
    throw new Error(
      `Login failed for role "${role}".` + (alert ? ` Form error: ${alert.trim()}` : ''),
      { cause: error }
    );
  }
}

async function storageStateFor(
  browser: Browser,
  role: Role,
  credentials: Credentials
): Promise<string> {
  const file = authFile(role);
  if (isFresh(file)) return file;

  fs.mkdirSync(AUTH_DIR, { recursive: true });
  return withLock(`${file}.lock`, async () => {
    if (isFresh(file)) return file;
    const context = await browser.newContext();
    try {
      const page = await context.newPage();
      await loginViaUi(page, role, credentials);
      await context.storageState({ path: file });
    } finally {
      await context.close();
    }
    return file;
  });
}

const pathnameOf = (page: Page) => new URL(page.url()).pathname;

// ---------------------------------------------------------------------------
// 1. Anonymous — runs everywhere, needs no credentials
// ---------------------------------------------------------------------------

test.describe('RBAC: anonymous', () => {
  for (const route of [...ADMIN_PAGES, ...AUTHOR_PAGES, ...PARTNER_PAGES, ...CUSTOMER_PAGES]) {
    test(`is sent to /login from ${route}`, async ({ page }) => {
      await page.goto(route);
      await page.waitForURL((url) => url.pathname.startsWith('/login'));
      expect(pathnameOf(page)).toContain('/login');
      assertNoLeak(await page.content(), `anonymous GET ${route}`);
    });
  }

  test('cannot read the partner order CSV export', async ({ request }) => {
    // Route handlers are NOT covered by the portal layout, so this endpoint
    // carries its own check. If that check ever regresses, order data leaks.
    const response = await request.get('/partner/orders/export', { maxRedirects: 0 });
    expect([302, 303, 307, 401, 403]).toContain(response.status());
    assertNoLeak(await response.text(), 'anonymous partner CSV export');
  });

  test('cannot create a book through the public API', async ({ request }) => {
    const response = await request.post('/api/books', {
      data: { title: 'rbac-probe-should-never-be-created' },
      failOnStatusCode: false,
    });
    expect(
      [401, 403],
      'unauthenticated create must be refused before any write'
    ).toContain(response.status());
    assertNoLeak(await response.text(), 'anonymous POST /api/books');
  });

  test('cannot download a manuscript', async ({ request }) => {
    const response = await request.get('/api/files/00000000-0000-0000-0000-000000000000', {
      failOnStatusCode: false,
      maxRedirects: 0,
    });
    expect(response.status()).not.toBe(200);
    assertNoLeak(await response.text(), 'anonymous manuscript download');
  });

  test('session endpoint reports no user and no role', async ({ request }) => {
    const response = await request.get('/api/session');
    expect([200, 401]).toContain(response.status());
    const body = await response.text();
    expect(body).not.toContain('"role":"admin"');
    assertNoLeak(body, 'anonymous GET /api/session');
  });

  for (const route of ADMIN_ACTION_ROUTES) {
    test(`POST ${route} (server-action surface) is refused`, async ({ request }) => {
      const response = await request.post(route, {
        form: { profileId: '00000000-0000-0000-0000-000000000000', role: 'admin' },
        failOnStatusCode: false,
        maxRedirects: 0,
      });
      expect(
        response.status(),
        'an unauthenticated POST to an admin route must never be accepted'
      ).not.toBe(200);
      assertNoLeak(await response.text(), `anonymous POST ${route}`);
    });
  }
});

// ---------------------------------------------------------------------------
// 2. Forged `mangu-role` cookie grants nothing
// ---------------------------------------------------------------------------

test.describe('RBAC: forged mangu-role cookie', () => {
  for (const forgedRole of ['admin', 'author', 'partner'] as const) {
    test(`mangu-role=${forgedRole} does not open the portals for an anonymous visitor`, async ({
      page,
      context,
      baseURL,
    }) => {
      test.skip(!baseURL, 'baseURL is required to scope the forged cookie');
      // The cookie is unsigned and client-settable. Anyone can send this.
      await context.addCookies([{ name: 'mangu-role', value: forgedRole, url: baseURL as string }]);

      for (const route of [ADMIN_PAGES[0], AUTHOR_PAGES[0], PARTNER_PAGES[0]]) {
        await page.goto(route);
        await page.waitForURL((url) => url.pathname.startsWith('/login'));
        expect(pathnameOf(page), `forged ${forgedRole} must not reach ${route}`).toContain('/login');
      }
    });
  }

  test('forged cookie does not change the server-reported role', async ({ request, baseURL }) => {
    test.skip(!baseURL, 'baseURL is required to scope the forged cookie');
    const response = await request.get('/api/session', {
      headers: { cookie: 'mangu-role=admin' },
    });
    const body = await response.text();
    expect(body, 'the session endpoint must derive the role from the session, not a cookie').not.toContain(
      '"role":"admin"'
    );
  });
});

// ---------------------------------------------------------------------------
// 3. Per-role matrix (needs credentials)
// ---------------------------------------------------------------------------
//
//              /admin/*   /author/*  /partner/*  /library, /dashboard/*
//   reader     deny -> /  deny -> /  deny -> /   allow
//   author     deny -> /  allow      deny -> /   allow
//   partner    deny -> /  deny -> /  allow       allow
//   admin      allow      allow      allow       allow
//
// Admin is allowed into the author and partner PORTAL PAGES (requireRole
// includes 'admin'), but NOT into /partner/orders/export, whose handler
// requires role === 'partner' exactly. That asymmetry is asserted below and
// flagged in the PR for a product decision.

const MATRIX: Record<Role, { allowed: string[]; denied: string[] }> = {
  reader: {
    allowed: CUSTOMER_PAGES,
    denied: [...ADMIN_PAGES, ...AUTHOR_PAGES, ...PARTNER_PAGES],
  },
  author: {
    allowed: [...AUTHOR_PAGES, ...CUSTOMER_PAGES],
    denied: [...ADMIN_PAGES, ...PARTNER_PAGES],
  },
  partner: {
    allowed: [...PARTNER_PAGES, ...CUSTOMER_PAGES],
    denied: [...ADMIN_PAGES, ...AUTHOR_PAGES],
  },
  admin: {
    allowed: [...ADMIN_PAGES, ...AUTHOR_PAGES, ...PARTNER_PAGES, ...CUSTOMER_PAGES],
    denied: [],
  },
};

for (const role of ROLES) {
  test.describe(`RBAC: ${role}`, () => {
    // Serial: one UI login feeds the whole block, and parallel logins would
    // trip the 5-per-60s auth limiter and fail for the wrong reason.
    test.describe.configure({ mode: 'serial' });

    const credentials = credentialsFor(role);
    test.skip(!credentials, missingCredentialsReason(role));
    test.skip(!hasRealAuthBackend(), 'No real auth backend configured (mock gate) — RBAC not enforced');

    let statePath: string;

    test.beforeAll(async ({ browser }) => {
      statePath = await storageStateFor(browser, role, credentials as Credentials);
    });

    test.use({ storageState: ({}, use) => use(statePath) });

    for (const route of MATRIX[role].allowed) {
      test(`can open ${route}`, async ({ page }) => {
        const response = await page.goto(route);
        expect(response, `expected a response for ${route}`).not.toBeNull();
        expect(response?.status(), `${role} should get 200 on ${route}`).toBe(200);
        expect(pathnameOf(page), `${role} should stay on ${route}`).toBe(route);
      });
    }

    for (const route of MATRIX[role].denied) {
      test(`is bounced from ${route} without seeing data`, async ({ page }) => {
        await page.goto(route);
        await page.waitForURL((url) => url.pathname === '/');
        expect(pathnameOf(page), `${role} must not reach ${route}`).toBe('/');
        assertNoLeak(await page.content(), `${role} GET ${route}`);
      });
    }

    for (const route of ADMIN_ACTION_ROUTES) {
      if (role === 'admin') continue; // Do not exercise real mutations.
      test(`cannot invoke the admin action surface at ${route}`, async ({ page }) => {
        const response = await page.request.post(route, {
          form: { profileId: '00000000-0000-0000-0000-000000000000', role: 'admin' },
          failOnStatusCode: false,
          maxRedirects: 0,
        });
        expect(response.status(), `${role} POST ${route} must not be accepted`).not.toBe(200);
        assertNoLeak(await response.text(), `${role} POST ${route}`);

        // The effect matters more than the status: the caller must still be
        // whatever they were before the attempt.
        const session = await page.request.get('/api/session');
        expect(await session.text(), 'role escalation must not have occurred').not.toContain(
          '"role":"admin"'
        );
      });
    }

    test('partner CSV export matches the documented permission', async ({ page }) => {
      const response = await page.request.get('/partner/orders/export', {
        failOnStatusCode: false,
        maxRedirects: 0,
      });
      if (role === 'partner') {
        // 404 is legitimate: a partner account with no partner profile row.
        expect([200, 404]).toContain(response.status());
      } else {
        // Includes admin: the handler requires role === 'partner' exactly.
        expect(response.status(), `${role} must not read partner orders`).toBe(403);
        assertNoLeak(await response.text(), `${role} GET /partner/orders/export`);
      }
    });

    test('cannot create a book unless the role allows it', async ({ page }) => {
      const response = await page.request.post('/api/books', {
        data: { title: 'rbac-probe-should-never-be-created' },
        failOnStatusCode: false,
      });
      if (role === 'reader') {
        expect(response.status(), 'reader must be refused with 403').toBe(403);
        assertNoLeak(await response.text(), 'reader POST /api/books');
      } else {
        // author/partner/admin are permitted to create; this spec does not
        // exercise the write path, it only proves the gate is role-derived.
        expect(response.status(), `${role} must not be refused as unauthenticated`).not.toBe(401);
      }
    });

    for (const root of PORTAL_ROOTS_WITHOUT_INDEX) {
      test(`portal root ${root} has no index page (documented gap)`, async ({ page }, testInfo) => {
        const response = await page.goto(root);
        const status = response?.status() ?? 0;
        const landedOn = pathnameOf(page);
        testInfo.annotations.push({
          type: 'portal-root',
          description: `${role} ${root} -> HTTP ${status} at ${landedOn}`,
        });
        // Current behaviour: a bare portal root never renders a portal index.
        // It 404s, or the gate redirects away. Asserting the CURRENT truth
        // keeps this spec honest until Renee picks redirect-vs-index.
        expect(
          status === 404 || landedOn !== root,
          `${root} unexpectedly rendered an index page — update this spec and the PR finding`
        ).toBeTruthy();
      });
    }
  });
}
