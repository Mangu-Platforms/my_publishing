/**
 * CORS origin allow-list for browser-facing API routes (F-07).
 *
 * Defect this closes: the analytics-track and resonance-recommend OPTIONS
 * handlers answered preflights with `Access-Control-Allow-Origin: *`, so any
 * website could call these endpoints from a visitor's browser. Responses now
 * echo the request Origin only when it is allow-listed — never a wildcard —
 * and always send `Vary: Origin` so caches never replay one origin's answer
 * to another.
 *
 * `Access-Control-Allow-Headers` deliberately omits `Authorization`: both
 * routes authenticate via the Supabase session cookie and never read the
 * Authorization header.
 */

import { normalizeOrigin } from '@/lib/auth/origin';

const CANONICAL_ORIGINS = ['https://www.mangu-publishers.com', 'https://mangu-publishers.com'];
const DEV_ORIGIN = 'http://localhost:3000';

/** Origins allowed to call our browser-facing API routes cross-origin. */
export function allowedCorsOrigins(): string[] {
  const origins = new Set(CANONICAL_ORIGINS);
  const siteUrl = normalizeOrigin(process.env.NEXT_PUBLIC_SITE_URL);
  if (siteUrl) {
    origins.add(siteUrl);
  }
  if (process.env.NODE_ENV !== 'production') {
    origins.add(DEV_ORIGIN);
  }
  return [...origins];
}

/**
 * CORS headers for any response: echoes the request Origin only when it is
 * allow-listed (no `Access-Control-Allow-Origin` otherwise), always with
 * `Vary: Origin`.
 */
export function corsHeadersFor(request: Request): Record<string, string> {
  const headers: Record<string, string> = { Vary: 'Origin' };
  const origin = normalizeOrigin(request.headers.get('origin'));
  if (origin && allowedCorsOrigins().includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
  }
  return headers;
}

/** Full preflight (OPTIONS) header set for a route's supported methods. */
export function corsPreflightHeadersFor(
  request: Request,
  methods: string
): Record<string, string> {
  return {
    ...corsHeadersFor(request),
    'Access-Control-Allow-Methods': methods,
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}
