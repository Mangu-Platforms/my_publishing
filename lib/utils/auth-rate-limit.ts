/**
 * Authentication Rate Limiting
 * Thin async wrappers over the unified Upstash-backed limiter (Fix C8).
 * Fail-closed: when the limiter is unavailable in production, requests are denied.
 */

import { enforceRateLimit, type RateLimitResult } from '@/lib/rate-limit';

/**
 * Rate limit check for authentication actions (login, register) with full
 * result, so callers can distinguish 'limited' (too many attempts) from
 * 'unavailable' (limiter infrastructure down — still denied, fail-closed,
 * but the user-facing message and server logs should differ).
 * Limits: 5 attempts per 15 minutes per IP/email
 */
export async function authRateLimitCheck(identifier: string): Promise<RateLimitResult> {
  return enforceRateLimit('authAction', `auth:${identifier}`);
}

/**
 * Rate limit for authentication actions (login, register)
 * Limits: 5 attempts per 15 minutes per IP/email
 */
export async function authRateLimit(identifier: string): Promise<boolean> {
  const result = await authRateLimitCheck(identifier);
  return result.success;
}

/**
 * Rate limit for password reset requests
 * Limits: 3 attempts per hour per email
 */
export async function passwordResetRateLimit(email: string): Promise<boolean> {
  const result = await enforceRateLimit('passwordReset', `password-reset:${email.toLowerCase()}`);
  return result.success;
}

/**
 * Rate limit for email verification resend
 * Limits: 3 attempts per hour per email
 */
export async function emailVerificationRateLimit(email: string): Promise<boolean> {
  const result = await enforceRateLimit('emailVerification', `email-verify:${email.toLowerCase()}`);
  return result.success;
}

/**
 * Get client identifier from request (IP address or email)
 */
export function getAuthIdentifier(ip: string | null, email?: string): string {
  // Use email if available, otherwise fall back to IP
  return email ? email.toLowerCase() : ip || 'unknown';
}
