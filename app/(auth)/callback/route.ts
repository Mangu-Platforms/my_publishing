import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { type NextRequest } from 'next/server';

/** Only allow same-origin path redirects (never absolute/protocol-relative URLs). */
function sanitizeNextPath(next: string | null): string {
  if (!next) return '/';
  if (!next.startsWith('/') || next.startsWith('//') || next.includes('\\')) return '/';
  return next;
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const error = requestUrl.searchParams.get('error');
  const errorDescription = requestUrl.searchParams.get('error_description');
  const nextPath = sanitizeNextPath(requestUrl.searchParams.get('next'));

  // Handle OAuth errors
  if (error) {
    console.error('OAuth error:', error, errorDescription);
    const errorMessage = errorDescription || error || 'Authentication failed';
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(errorMessage)}`, requestUrl.origin)
    );
  }

  // Validate code parameter
  if (!code) {
    return NextResponse.redirect(
      new URL(
        '/login?error=' + encodeURIComponent('Missing authentication code'),
        requestUrl.origin
      )
    );
  }

  try {
    const supabase = await createClient();
    const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

    if (exchangeError) {
      console.error('Code exchange error:', exchangeError);
      return NextResponse.redirect(
        new URL(
          `/login?error=${encodeURIComponent(exchangeError.message || 'Authentication failed')}`,
          requestUrl.origin
        )
      );
    }

    if (!data.session) {
      return NextResponse.redirect(
        new URL('/login?error=' + encodeURIComponent('Failed to create session'), requestUrl.origin)
      );
    }

    // Success - redirect to the requested destination (or home)
    return NextResponse.redirect(new URL(nextPath, requestUrl.origin));
  } catch (error) {
    console.error('Unexpected error in OAuth callback:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(errorMessage)}`, requestUrl.origin)
    );
  }
}
