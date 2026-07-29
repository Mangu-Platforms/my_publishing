/**
 * Canonical origin for auth deep links — email verification and password
 * reset (Task 1.9).
 *
 * Defect this closes: `resolveAuthOrigin()` used to trust `x-forwarded-host`
 * FIRST, so a forged Host / X-Forwarded-Host header could make Supabase build
 * an `emailRedirectTo` / `redirectTo` link pointing at a host we do not own.
 *
 * Precedence (most trusted first):
 *   1. NEXT_PUBLIC_SITE_URL   — configured, canonical, operator-controlled
 *   2. VERCEL_URL             — set by the platform, not by the client
 *   3. request Host header    — local development only, last resort
 *   4. http://localhost:3000  — matches lib/seo/siteUrl.ts
 */

export const DEFAULT_AUTH_ORIGIN = 'http://localhost:3000';

export function normalizeOrigin(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const trimmed = value.trim().replace(/\/+$/, '');
  return trimmed || null;
}

export interface AuthOriginInput {
  siteUrl?: string | null;
  vercelUrl?: string | null;
  host?: string | null;
  forwardedHost?: string | null;
  forwardedProto?: string | null;
}

/** Pure resolver — unit-testable without Next.js request scope. */
export function resolveAuthOriginFrom(input: AuthOriginInput): string {
  const configured = normalizeOrigin(input.siteUrl);
  if (configured) {
    return configured;
  }

  const vercel = normalizeOrigin(input.vercelUrl);
  if (vercel) {
    return `https://${vercel.replace(/^https?:\/\//, '')}`;
  }

  // Client-influenced values are only consulted when nothing trustworthy is
  // configured (i.e. local dev). `host` is preferred over `x-forwarded-host`.
  const rawHost = input.host || input.forwardedHost;
  const host = rawHost ? rawHost.split(',')[0].trim() : '';
  if (host) {
    const proto = (input.forwardedProto || '').split(',')[0].trim() || 'http';
    return normalizeOrigin(`${proto}://${host}`) ?? DEFAULT_AUTH_ORIGIN;
  }

  return DEFAULT_AUTH_ORIGIN;
}

/** Convenience wrapper for server actions holding a `headers()` result. */
export function resolveAuthOriginFromHeaders(headerList: {
  get(name: string): string | null;
}): string {
  return resolveAuthOriginFrom({
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
    vercelUrl: process.env.VERCEL_URL,
    host: headerList.get('host'),
    forwardedHost: headerList.get('x-forwarded-host'),
    forwardedProto: headerList.get('x-forwarded-proto'),
  });
}
