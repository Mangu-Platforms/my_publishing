/** @jest-environment node */

/**
 * Task 1.5 — server-trusted RBAC + fail-closed middleware.
 *
 * Two defects are pinned here so they cannot come back:
 *   1. the legacy Supabase branch logged and CONTINUED when
 *      NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY were missing,
 *      serving every protected route unauthenticated;
 *   2. the Better Auth branch gated /admin, /author and /partner on the
 *      unsigned, client-settable `mangu-role` cookie.
 */

import fs from 'node:fs';
import path from 'node:path';

jest.mock('next/server', () => {
  class MockNextResponse {
    status: number;
    headers: Headers;
    body: string | null;

    constructor(
      body?: string | null,
      init: { status?: number; headers?: Record<string, string> } = {}
    ) {
      this.body = body ?? null;
      this.status = init.status ?? 200;
      this.headers = new Headers(init.headers);
    }

    static next() {
      return new MockNextResponse(null, { status: 200 });
    }

    static redirect(url: URL | string, status = 307) {
      const res = new MockNextResponse(null, { status });
      res.headers.set('location', String(url));
      return res;
    }

    static json(body: unknown, init: { status?: number; headers?: Record<string, string> } = {}) {
      return new MockNextResponse(JSON.stringify(body), init);
    }
  }

  return { NextResponse: MockNextResponse };
});

jest.mock('@/lib/rate-limit', () => ({
  enforceRateLimit: jest.fn(async () => ({ success: true, reason: 'ok', headers: {} })),
  getRateLimitIdentity: jest.fn(() => 'test-ip'),
}));

jest.mock('better-auth/cookies', () => ({
  getSessionCookie: jest.fn(() => null),
}));

jest.mock('@/lib/supabase/edge-auth', () => ({
  getEdgeAuthUser: jest.fn(async () => ({ userId: null, accessToken: null })),
  getEdgeUserRole: jest.fn(async () => undefined),
}));

import type { NextRequest } from 'next/server';
import { middleware } from '@/middleware';
import { MANGU_ROLE_COOKIE } from '@/lib/auth/roles';
import { getSessionCookie } from 'better-auth/cookies';
import { getEdgeAuthUser, getEdgeUserRole } from '@/lib/supabase/edge-auth';

const mockedSessionCookie = getSessionCookie as jest.MockedFunction<typeof getSessionCookie>;
const mockedEdgeUser = getEdgeAuthUser as jest.MockedFunction<typeof getEdgeAuthUser>;
const mockedEdgeRole = getEdgeUserRole as jest.MockedFunction<typeof getEdgeUserRole>;

const ORIGINAL_ENV = process.env;
const ROOT = path.resolve(__dirname, '..', '..');

function makeRequest(
  pathname: string,
  options: { cookies?: Record<string, string>; method?: string } = {}
): NextRequest {
  const url = new URL(`https://www.mangu-publishers.com${pathname}`);
  const jar = new Map(Object.entries(options.cookies ?? {}));

  return {
    method: options.method ?? 'GET',
    url: url.toString(),
    nextUrl: url,
    ip: '203.0.113.10',
    headers: new Headers(),
    cookies: {
      get(name: string) {
        const value = jar.get(name);
        return value === undefined ? undefined : { name, value };
      },
    },
  } as unknown as NextRequest;
}

/** Signs the caller in as `role` on the legacy Supabase (production) branch. */
function signedInAs(role: string | undefined) {
  mockedEdgeUser.mockResolvedValue({ userId: 'user-1', accessToken: 'token-1' });
  mockedEdgeRole.mockResolvedValue(role as never);
}

function anonymous() {
  mockedEdgeUser.mockResolvedValue({ userId: null, accessToken: null });
  mockedEdgeRole.mockResolvedValue(undefined as never);
}

const PORTAL_PATHS = {
  admin: '/admin/dashboard',
  author: '/author/dashboard',
  partner: '/partner/dashboard',
} as const;

beforeEach(() => {
  jest.clearAllMocks();
  process.env = { ...ORIGINAL_ENV };
  process.env.AUTH_PROVIDER = 'supabase';
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://project.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
  mockedSessionCookie.mockReturnValue(null);
  anonymous();
});

afterAll(() => {
  process.env = ORIGINAL_ENV;
});

function location(res: { headers: Headers }) {
  return res.headers.get('location');
}

describe('legacy Supabase branch — role comes from the server, not a cookie', () => {
  it('anonymous is redirected to /login for every portal', async () => {
    anonymous();
    for (const target of Object.values(PORTAL_PATHS)) {
      const res = await middleware(makeRequest(target));
      expect(location(res)).toBe(
        `https://www.mangu-publishers.com/login?next=${encodeURIComponent(target)}`
      );
    }
  });

  it('a customer (reader) is bounced home from admin, author and partner', async () => {
    for (const target of Object.values(PORTAL_PATHS)) {
      signedInAs('reader');
      const res = await middleware(makeRequest(target));
      expect(location(res)).toBe('https://www.mangu-publishers.com/');
    }
  });

  it('an author reaches /author only', async () => {
    signedInAs('author');
    expect(location(await middleware(makeRequest(PORTAL_PATHS.author)))).toBeNull();
    expect(location(await middleware(makeRequest(PORTAL_PATHS.admin)))).toBe(
      'https://www.mangu-publishers.com/'
    );
    expect(location(await middleware(makeRequest(PORTAL_PATHS.partner)))).toBe(
      'https://www.mangu-publishers.com/'
    );
  });

  it('a partner reaches /partner only', async () => {
    signedInAs('partner');
    expect(location(await middleware(makeRequest(PORTAL_PATHS.partner)))).toBeNull();
    expect(location(await middleware(makeRequest(PORTAL_PATHS.admin)))).toBe(
      'https://www.mangu-publishers.com/'
    );
    expect(location(await middleware(makeRequest(PORTAL_PATHS.author)))).toBe(
      'https://www.mangu-publishers.com/'
    );
  });

  it('an admin reaches all three portals', async () => {
    signedInAs('admin');
    for (const target of Object.values(PORTAL_PATHS)) {
      expect(location(await middleware(makeRequest(target)))).toBeNull();
    }
  });

  it('a forged mangu-role cookie grants nothing', async () => {
    for (const target of Object.values(PORTAL_PATHS)) {
      signedInAs('reader');
      const res = await middleware(
        makeRequest(target, { cookies: { [MANGU_ROLE_COOKIE]: 'admin' } })
      );
      expect(location(res)).toBe('https://www.mangu-publishers.com/');
    }
  });

  it('a missing profile role denies rather than allows', async () => {
    signedInAs(undefined);
    expect(location(await middleware(makeRequest(PORTAL_PATHS.admin)))).toBe(
      'https://www.mangu-publishers.com/'
    );
  });
});

describe('legacy Supabase branch — fail closed when Supabase env is missing', () => {
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  it.each(Object.values(PORTAL_PATHS))('refuses %s with 503 instead of serving it', async (p) => {
    const res = await middleware(makeRequest(p));
    expect(res.status).toBe(503);
    expect(location(res)).toBeNull();
  });

  it.each(['/dashboard', '/library', '/reading/abc', '/api/files/x'])(
    'refuses %s with 503',
    async (p) => {
      expect((await middleware(makeRequest(p))).status).toBe(503);
    }
  );

  it('answers /api/* with JSON so callers are not handed HTML', async () => {
    const res = await middleware(makeRequest('/api/files/x'));
    expect(res.headers.get('content-type')).toContain('application/json');
    expect(JSON.parse(res.body as unknown as string)).toMatchObject({ error: 'auth_unavailable' });
  });

  it('still serves public marketing and catalog routes', async () => {
    for (const p of ['/', '/books', '/about', '/login']) {
      const res = await middleware(makeRequest(p));
      expect(res.status).toBe(200);
      expect(location(res)).toBeNull();
    }
  });
});

describe('Better Auth branch — the unsigned mangu-role cookie is not an authz decision', () => {
  beforeEach(() => {
    process.env.AUTH_PROVIDER = 'better-auth';
  });

  it('anonymous is still redirected to /login for every portal', async () => {
    mockedSessionCookie.mockReturnValue(null);
    for (const target of Object.values(PORTAL_PATHS)) {
      const res = await middleware(makeRequest(target));
      expect(location(res)).toBe(
        `https://www.mangu-publishers.com/login?next=${encodeURIComponent(target)}`
      );
    }
  });

  it('a forged mangu-role=admin cookie is ignored by middleware (no grant, no gate)', async () => {
    mockedSessionCookie.mockReturnValue('session-value' as never);
    const res = await middleware(
      makeRequest(PORTAL_PATHS.admin, { cookies: { [MANGU_ROLE_COOKIE]: 'admin' } })
    );
    // Middleware neither grants nor denies on the cookie — it defers to the
    // server layout, which is asserted below.
    expect(location(res)).toBeNull();
    expect(mockedEdgeRole).not.toHaveBeenCalled();
  });

  it('middleware source no longer reads the role cookie', () => {
    const src = fs.readFileSync(path.join(ROOT, 'middleware.ts'), 'utf8');
    expect(src).not.toContain('MANGU_ROLE_COOKIE');
    expect(src).not.toContain('normalizeManguRole');
  });
});

describe('the real gate is enforced server-side in the portal layouts', () => {
  const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

  it('/admin is gated by requireAdmin in its layout', () => {
    const src = read('app/admin/layout.tsx');
    expect(src).toContain('requireAdmin');
    expect(src).toContain("profile.role !== 'admin'");
  });

  it.each([
    ['app/(portals)/author/layout.tsx', "'author', 'admin'"],
    ['app/(portals)/partner/layout.tsx', "'partner', 'admin'"],
  ])('%s enforces the role server-side', (rel, allowed) => {
    const src = read(rel);
    expect(src).toContain('requireRole');
    expect(src).toContain(allowed);
    // The layout must not read any cookie to make its decision.
    expect(src).not.toMatch(/cookies\(\)/);
    expect(src).not.toContain('MANGU_ROLE_COOKIE');
  });

  it('requireRole derives the role from the session, never from a cookie', () => {
    const src = read('lib/auth/require-role.ts');
    expect(src).toContain('getRequestUser');
    expect(src).not.toMatch(/from 'next\/headers'/);
    expect(src).not.toMatch(/cookies\(\)/);
  });
});
