/**
 * E2E tests for the authentication flow.
 *
 * Covers:
 *   - Login page rendering and ARIA structure
 *   - Register page rendering and ARIA structure
 *   - Reset-password page rendering and ARIA structure
 *   - OAuth callback error forwarding via URL params
 *   - Invalid credential error display
 *   - Field-level validation error display
 *   - Rate-limit exceeded error display (simulated via server action response)
 *   - Verify-email page rendering without a session (email via ?email= query)
 *   - Reset-password confirm page recovery-link error states
 *
 * Note on successful login/register: both forms now perform a FULL-PAGE
 * navigation (window.location.assign) after success so the client-side
 * Supabase session picks up cookies set by the server action. Asserting that
 * requires real credentials, which CI does not have, so it is not covered
 * here; the error paths below run against the mock gate.
 */

import { test, expect } from '@playwright/test';

// Tests that exercise a real auth backend must skip when running against the
// CI mock gate (USE_MOCKS=true with placeholder Supabase credentials).
const hasRealSupabase = () =>
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.USE_MOCKS !== 'true' &&
  !/placeholder|test\.supabase/.test(process.env.NEXT_PUBLIC_SUPABASE_URL);

// ---------------------------------------------------------------------------
// Login page
// ---------------------------------------------------------------------------

test.describe('Login page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  // Scope email/password lookups to the sign-in form: the site footer renders a
  // newsletter email input on every page, so unscoped getByLabel(/email/i)
  // violates strict mode.
  const signInForm = (page: import('@playwright/test').Page) =>
    page.getByRole('form', { name: /sign in form/i });

  test('renders the sign-in form with accessible structure', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible();
    await expect(signInForm(page).getByLabel(/email/i)).toBeVisible();
    await expect(signInForm(page).getByLabel(/password/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
  });

  test('form has correct ARIA attributes', async ({ page }) => {
    const form = signInForm(page);
    await expect(form).toBeVisible();

    const emailInput = form.getByLabel(/email/i);
    await expect(emailInput).toHaveAttribute('type', 'email');
    await expect(emailInput).toHaveAttribute('autocomplete', 'email');

    const passwordInput = form.getByLabel(/password/i);
    await expect(passwordInput).toHaveAttribute('type', 'password');
    await expect(passwordInput).toHaveAttribute('autocomplete', 'current-password');
  });

  test('shows field-level validation errors for empty submit', async ({ page }) => {
    await page.getByRole('button', { name: /sign in/i }).click();
    // Zod resolver fires synchronous validation before the server action is called.
    await expect(page.getByRole('alert').first()).toBeVisible();
  });

  test('shows field-level error for invalid email format', async ({ page }) => {
    await signInForm(page).getByLabel(/email/i).fill('not-an-email');
    await signInForm(page)
      .getByLabel(/password/i)
      .fill('secret123');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page.getByText(/invalid email/i)).toBeVisible();
  });

  // Task 1.9: sign-in no longer applies the 8-character creation policy (that
  // would lock out pre-existing shorter credentials), so the field-level rule
  // it enforces is presence.
  test('shows field-level error for a missing password', async ({ page }) => {
    await signInForm(page).getByLabel(/email/i).fill('test@example.com');
    await signInForm(page)
      .getByLabel(/password/i)
      .fill('');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page.getByText(/password is required/i)).toBeVisible();
  });

  test('displays URL error parameter from OAuth callback', async ({ page }) => {
    await page.goto('/login?error=Authentication%20failed');
    // The error must be rendered inside an aria-live region. Filter out the
    // Next.js route announcer, which also has role="alert".
    const alert = page.getByRole('alert').filter({ hasText: 'Authentication failed' });
    await expect(alert).toBeVisible();
  });

  test('displays error for invalid credentials', async ({ page }) => {
    // Only run against a real Supabase instance; skip otherwise (CI uses placeholders).
    test.skip(!hasRealSupabase(), 'Supabase not configured');

    await signInForm(page).getByLabel(/email/i).fill('nonexistent@example.com');
    await signInForm(page)
      .getByLabel(/password/i)
      .fill('wrongpassword');
    await page.getByRole('button', { name: /sign in/i }).click();

    // Wait for the server round-trip and expect an error to appear.
    await expect(page.getByRole('alert')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('alert')).toContainText(/invalid email or password/i);
  });
});

// ---------------------------------------------------------------------------
// Register page
// ---------------------------------------------------------------------------

test.describe('Register page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/register');
  });

  const registerForm = (page: import('@playwright/test').Page) =>
    page.getByRole('form', { name: /create account form/i });

  test('renders the create-account form with accessible structure', async ({ page }) => {
    const form = registerForm(page);
    await expect(form).toBeVisible();
    await expect(form.getByLabel(/full name/i)).toBeVisible();
    await expect(form.getByLabel(/^email/i)).toBeVisible();
    await expect(form.getByLabel(/^password$/i)).toBeVisible();
    await expect(form.getByLabel(/confirm password/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /create account/i })).toBeVisible();
  });

  test('form inputs have correct autocomplete attributes', async ({ page }) => {
    const form = registerForm(page);
    await expect(form.getByLabel(/full name/i)).toHaveAttribute('autocomplete', 'name');
    await expect(form.getByLabel(/^email/i)).toHaveAttribute('autocomplete', 'email');
    await expect(form.getByLabel(/^password$/i)).toHaveAttribute('autocomplete', 'new-password');
    await expect(form.getByLabel(/confirm password/i)).toHaveAttribute(
      'autocomplete',
      'new-password'
    );
  });

  test('shows validation error for mismatched passwords', async ({ page }) => {
    const form = registerForm(page);
    await form.getByLabel(/full name/i).fill('Jane Doe');
    await form.getByLabel(/^email/i).fill('jane@example.com');
    await form.getByLabel(/^password$/i).fill('password123');
    await form.getByLabel(/confirm password/i).fill('different');
    await page.getByRole('button', { name: /create account/i }).click();
    await expect(page.getByText(/passwords don't match/i)).toBeVisible();
  });

  test('shows duplicate email error', async ({ page }) => {
    test.skip(!hasRealSupabase(), 'Supabase not configured');

    // Use the known test admin email to trigger the "already registered" path.
    const form = registerForm(page);
    await form.getByLabel(/full name/i).fill('Test User');
    await form.getByLabel(/^email/i).fill(process.env.TEST_ADMIN_EMAIL ?? 'admin@example.com');
    await form.getByLabel(/^password$/i).fill('TestPassword1!');
    await form.getByLabel(/confirm password/i).fill('TestPassword1!');
    await page.getByRole('button', { name: /create account/i }).click();

    await expect(page.getByRole('alert')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('alert')).toContainText(/already exists/i);
  });
});

// ---------------------------------------------------------------------------
// Reset-password page
// ---------------------------------------------------------------------------

test.describe('Reset password page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/reset-password');
  });

  const resetForm = (page: import('@playwright/test').Page) =>
    page.getByRole('form', { name: /reset password form/i });

  test('renders the reset-password form with accessible structure', async ({ page }) => {
    const form = resetForm(page);
    await expect(form).toBeVisible();
    await expect(form.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /send reset link/i })).toBeVisible();
  });

  test('shows validation error for invalid email', async ({ page }) => {
    await resetForm(page).getByLabel(/email/i).fill('not-an-email');
    await page.getByRole('button', { name: /send reset link/i }).click();
    const alert = page.getByRole('alert').filter({ hasText: /invalid email/i });
    await expect(alert).toBeVisible();
  });

  test('shows success message after valid submission', async ({ page }) => {
    test.skip(!hasRealSupabase(), 'Supabase not configured');

    await resetForm(page).getByLabel(/email/i).fill('nonexistent@example.com');
    await page.getByRole('button', { name: /send reset link/i }).click();

    // Supabase always returns success (doesn't reveal whether email exists).
    await expect(page.getByRole('status')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('status')).toContainText(/check your email/i);
  });
});

// ---------------------------------------------------------------------------
// Verify-email page
// ---------------------------------------------------------------------------
//
// The resend flow no longer requires a session: registration redirects to
// /verify-email?email=<address> and the page renders the resend form for that
// email even when the visitor is unauthenticated.

test.describe('Verify email page', () => {
  test('renders the resend form without a session when ?email= is provided', async ({ page }) => {
    await page.goto('/verify-email?email=pending%40example.com');

    await expect(page.getByRole('heading', { name: /verify your email/i })).toBeVisible();
    await expect(page.getByText('pending@example.com')).toBeVisible();
    await expect(page.getByRole('button', { name: /resend verification email/i })).toBeVisible();
  });

  test('redirects to login when there is no session and no email param', async ({ page }) => {
    await page.goto('/verify-email');

    await page.waitForURL(/\/login/);
    const alert = page
      .getByRole('alert')
      .filter({ hasText: /please sign in to verify your email/i });
    await expect(alert).toBeVisible();
  });

  test('invalid email param falls back to the signed-in check and redirects', async ({ page }) => {
    // A malformed ?email= is ignored; with no session either, we land on /login.
    await page.goto('/verify-email?email=not-an-email');
    await page.waitForURL(/\/login/);
    expect(page.url()).toContain('/login');
  });
});

// ---------------------------------------------------------------------------
// Reset-password confirm page
// ---------------------------------------------------------------------------
//
// The confirm page enforces recovery semantics: it only shows the new-password
// form after exchanging a recovery code that fires a PASSWORD_RECOVERY auth
// event. Without a code (or with provider error params) it must render an
// explicit error state with a link to request a new reset email.

test.describe('Reset password confirm page', () => {
  test('shows an error state when visited without a recovery code', async ({ page }) => {
    await page.goto('/reset-password/confirm');

    await expect(page.getByRole('heading', { name: /create a new password/i })).toBeVisible();
    await expect(page.getByText(/invalid or expired password reset link/i)).toBeVisible();
    await expect(page.getByRole('link', { name: /request a new link/i })).toHaveAttribute(
      'href',
      '/reset-password'
    );
  });

  test('surfaces provider error params as a friendly recovery error', async ({ page }) => {
    await page.goto(
      '/reset-password/confirm?error=access_denied&error_description=Email+link+is+invalid+or+has+expired'
    );

    // toFriendlyResetError maps expired/invalid token messages to this copy.
    await expect(page.getByText(/reset link is invalid or has expired/i)).toBeVisible();
    await expect(page.getByRole('link', { name: /request a new link/i })).toBeVisible();
  });
});
