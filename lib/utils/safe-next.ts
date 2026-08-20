/**
 * Same-origin sanitizer for ?next= redirect round-trips (login, OAuth
 * callback). Only relative paths inside this site may pass: absolute URLs,
 * protocol-relative //host forms, and backslash tricks all fall back to '/',
 * so an attacker-supplied next can never bounce a fresh session off-site.
 */
export function sanitizeNextPath(next: string | null | undefined): string {
  if (!next) return '/';
  if (!next.startsWith('/') || next.startsWith('//') || next.includes('\\')) return '/';
  return next;
}
