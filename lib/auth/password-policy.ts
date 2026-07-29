/**
 * Single source of truth for the MANGU password policy (Task 1.9).
 *
 * The repo previously carried two minimums — 6 (login/register actions and
 * forms, reset confirm, shared zod schema) and 8 (`lib/auth.ts` Better Auth
 * `minPasswordLength`). 8 wins: it is the stronger of the two and it is the
 * value the Better Auth server already enforces, so choosing 6 would mean
 * accepting a password the auth server then rejects.
 *
 * Scope: this is a password *creation* policy. Sign-in deliberately does NOT
 * apply it — pre-existing accounts may hold 6–7 character credentials, and a
 * length gate on sign-in would lock those users out while leaking policy
 * state to an attacker. Sign-in only requires a non-empty password.
 */

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 100;

export const PASSWORD_MIN_MESSAGE = `Password must be at least ${PASSWORD_MIN_LENGTH} characters`;
export const PASSWORD_MIN_MESSAGE_LONG = `Password must be at least ${PASSWORD_MIN_LENGTH} characters long.`;
export const PASSWORD_HELP_TEXT = `Use at least ${PASSWORD_MIN_LENGTH} characters.`;
export const PASSWORD_REQUIRED_MESSAGE = 'Password is required';

export function isPasswordLongEnough(password: string | null | undefined): boolean {
  return typeof password === 'string' && password.length >= PASSWORD_MIN_LENGTH;
}
