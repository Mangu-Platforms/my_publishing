import { NextResponse, type NextRequest } from 'next/server';
import { getSessionCookie } from 'better-auth/cookies';
import { getAuthProvider } from '@/lib/auth/provider';
import { enforceRateLimit, getRateLimitIdentity } from '@/lib/rate-limit';
import { buildRateLimitResponse } from '@/lib/rate-limit-response';
import { getEdgeAuthUser, getEdgeUserRole } from '@/lib/supabase/edge-auth';

/** Reject a request per rate-limit result: 429 when limited, 503 when the limiter is unavailable (fail-closed). */
function rateLimitRejection(
  request: NextRequest,
  result: { reason: string; headers: Record<string, string> }
) {
  return buildRateLimitResponse(request, result);
}

/**
 * Fail-closed response for when authentication CANNOT be verified at the Edge
 * (Task 1.5). Returned instead of silently allowing a protected request
 * through unauthenticated.
 */
function authUnavailableResponse(request: NextRequest) {
  const isApi = request.nextUrl.pathname.startsWith('/api/');
  const body = isApi
    ? JSON.stringify({
        error: 'auth_unavailable',
        message: 'Authentication is temporarily unavailable.',
      })
    : 'Authentication is temporarily unavailable. Please try again shortly.';

  return new NextResponse(body, {
    status: 503,
    headers: {
      'Content-Type': isApi ? 'application/json' : 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

function loginRedirect(request: NextRequest, pathname: string) {
  const url = new URL('/login', request.url);
  url.searchParams.set('next', pathname);
  return NextResponse.redirect(url);
}

function isProtectedPath(pathname: string): boolean {
  const isReadingRoute = pathname.startsWith('/reading');
  const isLibraryRoute = pathname.startsWith('/library');
  // Note: '/author/...' (portal) must not match public '/authors' pages.
  const isAuthorRoute = pathname === '/author' || pathname.startsWith('/author/');
  const isPartnerRoute = pathname === '/partner' || pathname.startsWith('/partner/');
  const isAdminRoute = pathname.startsWith('/admin');
  const isDashboardRoute = pathname.startsWith('/dashboard');
  const isFilesApi = pathname.startsWith('/api/files');
  return (
    isReadingRoute ||
    isLibraryRoute ||
    isAuthorRoute ||
    isPartnerRoute ||
    isAdminRoute ||
    isDashboardRoute ||
    isFilesApi
  );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const method = request.method;

  // ── Rate limiting (fail-closed, Fix C8) ────────────────────────────────────
  const isAuthApiPath = pathname.startsWith('/api/auth/');
  const isAuthPageAction =
    method === 'POST' &&
    (pathname.startsWith('/login') ||
      pathname.startsWith('/register') ||
      pathname.startsWith('/reset-password') ||
      pathname.startsWith('/verify-email'));

  if (isAuthApiPath || isAuthPageAction) {
    const ip = request.ip ?? getRateLimitIdentity(request);
    const result = await enforceRateLimit('auth', ip);

    if (!result.success) {
      return rateLimitRejection(request, result);
    }
  }

  if (pathname.startsWith('/api/upload')) {
    const ip = request.ip ?? getRateLimitIdentity(request);
    const result = await enforceRateLimit('upload', ip);

    if (!result.success) {
      return rateLimitRejection(request, result);
    }
  }

  const isAbusablePublicPost =
    method === 'POST' &&
    (pathname.startsWith('/api/newsletter') || pathname.startsWith('/api/checkout'));

  if (isAbusablePublicPost) {
    const ip = request.ip ?? getRateLimitIdentity(request);
    const result = await enforceRateLimit('api', ip);

    if (!result.success) {
      return rateLimitRejection(request, result);
    }
  }

  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const isPasswordRecoveryConfirm = pathname === '/reset-password/confirm';
  const authRoutes = ['/login', '/register', '/reset-password'];
  const isAuthRoute =
    !isPasswordRecoveryConfirm && authRoutes.some((route) => pathname.startsWith(route));

  const isAuthorRoute = pathname === '/author' || pathname.startsWith('/author/');
  const isPartnerRoute = pathname === '/partner' || pathname.startsWith('/partner/');
  const isAdminRoute = pathname.startsWith('/admin');

  try {
    // ── Phoenix WS1: Better Auth cookie-only Edge path ───────────────────────
    // RBAC strategy: session-cookie presence gates protected paths at the Edge;
    // every ROLE decision is made server-side in the layouts/actions.
    if (getAuthProvider() === 'better-auth') {
      const sessionCookie = getSessionCookie(request);
      const userId = sessionCookie ? 'session' : null;

      if (userId && isAuthRoute) {
        return NextResponse.redirect(new URL('/', request.url));
      }

      if (!userId && isProtectedPath(pathname)) {
        return loginRedirect(request, pathname);
      }

      // Task 1.5: the `mangu-role` cookie is UNSIGNED and client-settable, so it
      // is presentation state only and MUST NOT be read as an authorization
      // decision here. Role enforcement is server-side, derived from the
      // authenticated session + trusted profile/claims:
      //   /admin   -> app/admin/layout.tsx           (requireAdmin)
      //   /author  -> app/(portals)/author/layout.tsx  (requireRole)
      //   /partner -> app/(portals)/partner/layout.tsx (requireRole)
      // Middleware here only enforces "must be signed in" for protected paths.
      return response;
    }

    // ── Legacy Supabase Edge path (public production until cutover) ──────────
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      // Task 1.5 — FAIL CLOSED. This branch used to log and continue, which
      // served every protected route (/admin, /author, /partner, /dashboard,
      // /library, /reading, /api/files) completely ungated whenever the
      // Supabase env vars were absent. Public marketing/catalog routes still
      // render; anything protected is refused with 503.
      console.error(
        'Missing Supabase environment variables — Edge auth cannot be verified. ' +
          'Protected routes are denied (fail-closed). See .env.local.example.'
      );

      if (isProtectedPath(pathname)) {
        return authUnavailableResponse(request);
      }

      return response;
    }

    const authUser = await getEdgeAuthUser(request);
    const userId = authUser.userId;

    if (userId && isAuthRoute) {
      return NextResponse.redirect(new URL('/', request.url));
    }

    if (!userId && isProtectedPath(pathname)) {
      return loginRedirect(request, pathname);
    }

    if (userId && authUser.accessToken && (isAdminRoute || isAuthorRoute || isPartnerRoute)) {
      let role: string | undefined;

      try {
        role = await getEdgeUserRole(authUser.accessToken, userId);
        if (!role) {
          console.error('Error fetching profile for role check: missing role');
          return NextResponse.redirect(new URL('/', request.url));
        }
      } catch (error) {
        console.error('Error in role-based route protection:', error);
        return NextResponse.redirect(new URL('/', request.url));
      }

      if (isAdminRoute && role !== 'admin') {
        return NextResponse.redirect(new URL('/', request.url));
      }

      if (isAuthorRoute && role !== 'author' && role !== 'admin') {
        return NextResponse.redirect(new URL('/', request.url));
      }

      if (isPartnerRoute && role !== 'partner' && role !== 'admin') {
        return NextResponse.redirect(new URL('/', request.url));
      }
    }

    return response;
  } catch (error) {
    // If middleware fails completely, allow public routes to proceed
    const publicRoutes = [
      '/',
      '/books',
      '/genres',
      '/authors',
      '/about',
      '/audio',
      '/comics',
      '/contact',
      '/discover',
      '/papers',
      '/readers-hub',
      '/login',
      '/register',
      '/reset-password',
      '/verify-email',
      '/api',
    ];
    const isPublicRoute = publicRoutes.some((route) => pathname.startsWith(route));

    if (isPublicRoute) {
      return response;
    }

    return loginRedirect(request, pathname);
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
