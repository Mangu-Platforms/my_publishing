/**
 * Same-origin sanitizer for ?next= redirect round-trips (login, OAuth
 * callback). Only relative paths inside this site may pass: absolute URLs,
 * protocol-relative //host forms, and backslash tricks all fall back to '/',
 * so an attacker-supplied next can never bounce a fresh session off-site.
 */
export function sanitizeNextPath(next: string | null | undefined): string {
  if (!next) return '/';
  if (!next.startsWith('/') || next.startsWith('//') || next.includes('\\')) return '/';
  // WHATWG URL parsing strips tab/CR/LF before resolving, so "/\t/evil.com"
  // would collapse to protocol-relative "//evil.com" at the redirect sink.
  // Reject every C0 control character outright.
  if (/[\x00-\x1f]/.test(next)) return '/';
  return next;
}
