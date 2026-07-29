/**
 * Task 3.5 — rate-limit and abuse behaviour.
 *
 * Source of truth for the numbers asserted here:
 *   lib/rate-limit.ts        BUCKETS.auth = 5 requests / 60s, keyed on client IP
 *   middleware.ts            applies the `auth` bucket to POST /login,
 *                            POST /register, POST /reset-password and /api/auth/*
 *   lib/rate-limit-response.ts  429 = limited, 503 = limiter unavailable
 *   lib/utils/auth-rate-limit.ts  per-email `authAction` bucket (server actions)
 *
 * The property under test is TRUTHFULNESS, not just "did it block":
 *   - a real rate limit answers 429 and never claims an outage;
 *   - a limiter outage answers 503 and never claims protection occurred;
 *   - neither response leaks the probe identity, the limiter backend, or a stack;
 *   - a legitimate user always recovers — no permanent lockout.
 *
 * WHY the whole file is env-gated: it deliberately exhausts a bucket that is
 * shared per IP with every other spec in the suite. Running it alongside the
 * auth and RBAC specs would make THOSE fail, so it is opt-in:
 *
 *   E2E_RATE_LIMIT_TESTS=true            run this file at all
 *   E2E_RATE_LIMIT_COOLDOWN=true         also run the slow recovery scenarios
 *   E2E_RATE_LIMIT_COOLDOWN_SECONDS=70   override the wait (default 70s)
 *   E2E_LIMITER_UNAVAILABLE_BASE_URL     an app instance started with a broken
 *                                        limiter backend, for the 503 scenario
 */

import { test, expect, type APIRequestContext, type APIResponse } from '@playwright/test';

// Mirrors BUCKETS.auth in lib/rate-limit.ts. If that changes, this must too —
// the spec is here to catch drift, not to silently follow it.
const AUTH_BUCKET_LIMIT = 5;
const AUTH_BUCKET_WINDOW_SECONDS = 60;

const RATE_LIMIT_TESTS_ENABLED = process.env.E2E_RATE_LIMIT_TESTS === 'true';
const COOLDOWN_TESTS_ENABLED = process.env.E2E_RATE_LIMIT_COOLDOWN === 'true';
const COOLDOWN_SECONDS = Number(process.env.E2E_RATE_LIMIT_COOLDOWN_SECONDS ?? '') ||
  AUTH_BUCKET_WINDOW_SECONDS + 10;
const LIMITER_OUTAGE_BASE_URL = process.env.E2E_LIMITER_UNAVAILABLE_BASE_URL;
const FRIENDLY_429_ENABLED = process.env.NEXT_PUBLIC_FEATURE_FRIENDLY_429 === 'true';

const DISABLED_REASON =
  'Rate-limit specs are opt-in: they exhaust a shared per-IP bucket and would ' +
  'break the auth and RBAC specs. Set E2E_RATE_LIMIT_TESTS=true to run them.';

// ---------------------------------------------------------------------------
// Probe identities
// ---------------------------------------------------------------------------
//
// NEVER a real account: locking out a genuine user is a destructive action, and
// a hardcoded password in a public repo is a liability even when it is wrong on
// purpose. `.invalid` is reserved by RFC 2606 and can never be registered.

const probeEmail = () =>
  `rate-limit-probe-${Math.random().toString(36).slice(2, 10)}@example.invalid`;
const wrongPassword = () => `not-a-real-password-${Math.random().toString(36).slice(2, 12)}`;

/** Details that must never appear in a throttling response. */
const SENSITIVE_MARKERS = [
  'upstash.io',
  'UPSTASH_REDIS_REST_TOKEN',
  'UPSTASH_REDIS_REST_URL',
  'redis://',
  'x-forwarded-for',
  'at Object.',
  'node_modules',
];

type Verdict = 'allowed' | 'limited' | 'unavailable';

/** Classify a response the way a user would read it — status first, then copy. */
function verdictOf(response: APIResponse, body: string): Verdict {
  if (response.status() === 429) return 'limited';
  if (response.status() === 503) return 'unavailable';
  if (response.status() === 302 || response.status() === 303) {
    // Friendly-429 mode redirects browser navigations to /too-many-requests.
    const location = response.headers()['location'] ?? '';
    if (location.includes('reason=unavailable')) return 'unavailable';
    if (location.includes('/too-many-requests')) return 'limited';
  }
  if (/rate_limiter_unavailable/.test(body)) return 'unavailable';
  if (/rate_limited|Too Many Requests/i.test(body)) return 'limited';
  return 'allowed';
}

async function assertTruthfulThrottle(response: APIResponse, email: string) {
  const body = await response.text();
  const verdict = verdictOf(response, body);

  for (const marker of SENSITIVE_MARKERS) {
    expect(body, `throttle response must not leak "${marker}"`).not.toContain(marker);
  }
  expect(body, 'throttle response must not echo the identity being limited').not.toContain(email);

  if (verdict === 'limited') {
    expect(response.status(), '429 is the only correct status for "you are limited"').not.toBe(503);
    expect(
      body,
      'a real rate limit must not claim the limiter is unavailable'
    ).not.toMatch(/unavailable/i);
    const retryAfter = response.headers()['retry-after'];
    expect(retryAfter, '429 must tell the user when to come back').toBeTruthy();
    expect(Number(retryAfter)).toBeGreaterThan(0);
  }

  if (verdict === 'unavailable') {
    expect(response.status(), '503 is the only correct status for a limiter outage').not.toBe(429);
    expect(
      body,
      'a limiter outage must not claim the user made too many requests'
    ).not.toMatch(/too many requests|rate_limited/i);
  }

  return verdict;
}

/** One throttled-path POST. Deliberately never carries a usable credential. */
function attempt(api: APIRequestContext, pathname: string, email: string): Promise<APIResponse> {
  return api.post(pathname, {
    form: { email, password: wrongPassword() },
    headers: { accept: 'application/json' },
    failOnStatusCode: false,
    maxRedirects: 0,
  });
}

async function exhaustBucket(
  api: APIRequestContext,
  pathname: string,
  email: string
): Promise<Verdict[]> {
  const verdicts: Verdict[] = [];
  // limit + 2 so the transition is observable even if one request is absorbed.
  for (let index = 0; index < AUTH_BUCKET_LIMIT + 2; index += 1) {
    const response = await attempt(api, pathname, email);
    verdicts.push(await assertTruthfulThrottle(response, email));
  }
  return verdicts;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// ---------------------------------------------------------------------------
// 1. N invalid attempts, and the attempt during cooldown
// ---------------------------------------------------------------------------

test.describe('Rate limiting: repeated auth attempts', () => {
  test.describe.configure({ mode: 'serial' });
  test.skip(!RATE_LIMIT_TESTS_ENABLED, DISABLED_REASON);

  test('repeated sign-in attempts are throttled, truthfully', async ({ request }) => {
    const email = probeEmail();
    const verdicts = await exhaustBucket(request, '/login', email);

    expect(verdicts, 'a throttled endpoint must never report success').not.toContain('allowed');

    // Once throttled, stay throttled for the rest of the window. A limiter that
    // flip-flops is worse than none: it teaches attackers to just keep going.
    const firstThrottle = verdicts.findIndex((verdict) => verdict !== 'allowed');
    expect(firstThrottle, `no throttling within ${verdicts.length} attempts`).toBeGreaterThanOrEqual(
      0
    );
    expect(
      verdicts.slice(firstThrottle).every((verdict) => verdict !== 'allowed'),
      'throttling must not flip back to allowed inside the window'
    ).toBeTruthy();
  });

  test('an attempt during cooldown is refused with the same reason', async ({ request }) => {
    const email = probeEmail();
    await exhaustBucket(request, '/login', email);

    const during = await attempt(request, '/login', email);
    const verdict = await assertTruthfulThrottle(during, email);
    expect(verdict, 'a request inside the cooldown window must not be allowed').not.toBe('allowed');
  });

  test('a different account from the same client is also throttled (IP dimension)', async ({
    request,
  }) => {
    // middleware.ts keys the `auth` bucket on the client IP, so switching the
    // email must NOT buy a fresh allowance. The per-email dimension lives in
    // the server actions (`authAction` bucket) and is covered by the unit
    // suite; this asserts the dimension that is observable over HTTP.
    const firstEmail = probeEmail();
    await exhaustBucket(request, '/login', firstEmail);

    const secondEmail = probeEmail();
    const response = await attempt(request, '/login', secondEmail);
    const verdict = await assertTruthfulThrottle(response, secondEmail);
    expect(
      verdict,
      'rotating the email must not reset a per-IP bucket'
    ).not.toBe('allowed');
  });

  test('the auth API path is throttled the same way as the auth pages', async ({ request }) => {
    const email = probeEmail();
    const verdicts = await exhaustBucket(request, '/api/auth/sign-in', email);
    expect(verdicts, '/api/auth/* must be covered by the same bucket').not.toContain('allowed');
  });

  test('throttling never blocks a legitimate user from reaching the sign-in page', async ({
    request,
  }) => {
    await exhaustBucket(request, '/login', probeEmail());

    // Only the POST is throttled. If a GET were blocked too, an attacker could
    // take the login page down for everyone with a handful of requests.
    const page = await request.get('/login', { failOnStatusCode: false });
    expect(page.status(), 'GET /login must stay available while POSTs are throttled').toBe(200);
  });

  test('friendly-429 navigation lands on the honest page', async ({ request }) => {
    test.skip(!FRIENDLY_429_ENABLED, 'NEXT_PUBLIC_FEATURE_FRIENDLY_429 is not enabled');
    const email = probeEmail();
    await exhaustBucket(request, '/login', email);

    const response = await request.post('/login', {
      form: { email, password: wrongPassword() },
      headers: { accept: 'text/html' },
      failOnStatusCode: false,
      maxRedirects: 0,
    });
    expect([302, 303, 429]).toContain(response.status());
    if (response.status() !== 429) {
      expect(response.headers()['location']).toContain('/too-many-requests');
    }
  });
});

// ---------------------------------------------------------------------------
// 2. Recovery after cooldown (slow — separately gated)
// ---------------------------------------------------------------------------

test.describe('Rate limiting: recovery', () => {
  test.describe.configure({ mode: 'serial' });
  test.skip(!RATE_LIMIT_TESTS_ENABLED, DISABLED_REASON);
  test.skip(
    !COOLDOWN_TESTS_ENABLED,
    `Cooldown scenarios wait ~${COOLDOWN_SECONDS}s of real time. Set E2E_RATE_LIMIT_COOLDOWN=true to run them.`
  );

  test('a legitimate user is never locked out permanently', async ({ request }) => {
    test.setTimeout((COOLDOWN_SECONDS + 120) * 1000);

    const email = probeEmail();
    await exhaustBucket(request, '/login', email);

    const blocked = await attempt(request, '/login', email);
    expect(await assertTruthfulThrottle(blocked, email)).not.toBe('allowed');

    await sleep(COOLDOWN_SECONDS * 1000);

    const afterCooldown = await attempt(request, '/login', email);
    const verdict = await assertTruthfulThrottle(afterCooldown, email);
    expect(
      verdict,
      `the window is ${AUTH_BUCKET_WINDOW_SECONDS}s; after ${COOLDOWN_SECONDS}s the user must be able to try again`
    ).toBe('allowed');
  });
});

// ---------------------------------------------------------------------------
// 3. Limiter backend unavailable
// ---------------------------------------------------------------------------
//
// An outage cannot be induced against a healthy deployment, and faking it in
// the test would prove nothing. This block runs against a SEPARATE instance
// started with an unreachable limiter backend, supplied by the operator:
//
//   E2E_LIMITER_UNAVAILABLE_BASE_URL=https://<instance-with-broken-upstash>
//
// Expected behaviour (lib/rate-limit.ts -> unavailableResult, fail-closed):
// requests are DENIED with 503 `rate_limiter_unavailable`, never 429, and
// never silently allowed.

test.describe('Rate limiting: limiter backend unavailable', () => {
  test.skip(
    !LIMITER_OUTAGE_BASE_URL,
    'Set E2E_LIMITER_UNAVAILABLE_BASE_URL to an instance whose limiter backend is deliberately broken.'
  );

  test('a limiter outage fails closed with 503 and does not pretend to be a rate limit', async ({
    playwright,
  }) => {
    const api = await playwright.request.newContext({ baseURL: LIMITER_OUTAGE_BASE_URL });
    try {
      const email = probeEmail();
      const response = await attempt(api, '/login', email);
      const body = await response.text();

      expect(
        response.status(),
        'fail-closed means the request is refused, not served'
      ).not.toBe(200);
      expect(response.status(), 'a limiter outage is 503, not 429').toBe(503);
      expect(body, 'the outage response must not claim the user was rate limited').not.toMatch(
        /too many requests|rate_limited\b/i
      );
      for (const marker of SENSITIVE_MARKERS) {
        expect(body, `outage response must not leak "${marker}"`).not.toContain(marker);
      }
    } finally {
      await api.dispose();
    }
  });

  test('a limiter outage still serves public pages', async ({ playwright }) => {
    // Fail-closed must be scoped to protected buckets. If a limiter outage took
    // the marketing site down too, the blast radius would be the whole launch.
    const api = await playwright.request.newContext({ baseURL: LIMITER_OUTAGE_BASE_URL });
    try {
      const response = await api.get('/', { failOnStatusCode: false });
      expect(response.status(), 'the homepage must survive a limiter outage').toBe(200);
    } finally {
      await api.dispose();
    }
  });
});
