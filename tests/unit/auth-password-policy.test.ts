/** @jest-environment node */

/**
 * Task 1.9 — one password minimum (8) plus host-safe verification deep links.
 */

import fs from 'node:fs';
import path from 'node:path';

import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  PASSWORD_MIN_MESSAGE,
  PASSWORD_MIN_MESSAGE_LONG,
  isPasswordLongEnough,
} from '@/lib/auth/password-policy';
import { passwordSchema } from '@/lib/utils/validation';
import { DEFAULT_AUTH_ORIGIN, resolveAuthOriginFrom } from '@/lib/auth/origin';

const ROOT = path.resolve(__dirname, '..', '..');
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

describe('password policy constants', () => {
  it('is 8 — the stronger of the two former minimums, and the value Better Auth enforces', () => {
    expect(PASSWORD_MIN_LENGTH).toBe(8);
    expect(PASSWORD_MIN_MESSAGE).toBe('Password must be at least 8 characters');
    expect(PASSWORD_MIN_MESSAGE_LONG).toBe('Password must be at least 8 characters long.');
  });

  it('matches lib/auth.ts minPasswordLength', () => {
    expect(read('lib/auth.ts')).toContain(`minPasswordLength: ${PASSWORD_MIN_LENGTH}`);
  });

  it('accepts/rejects at the boundary', () => {
    expect(isPasswordLongEnough('1234567')).toBe(false);
    expect(isPasswordLongEnough('12345678')).toBe(true);
    expect(isPasswordLongEnough(undefined)).toBe(false);
  });

  it('is the minimum used by the shared zod schema', () => {
    expect(passwordSchema.safeParse('1234567').success).toBe(false);
    expect(passwordSchema.safeParse('12345678').success).toBe(true);
    expect(passwordSchema.safeParse('z'.repeat(PASSWORD_MAX_LENGTH + 1)).success).toBe(false);
  });
});

describe('no stale 6-character policy survives anywhere', () => {
  const files = [
    'app/(auth)/login/LoginForm.tsx',
    'app/(auth)/login/actions.ts',
    'app/(auth)/register/RegisterForm.tsx',
    'app/(auth)/register/actions.ts',
    // REPO_AUDIT_2026-08-21 F2: the reset-confirm form logic (Supabase leg
    // unchanged, Better Auth leg new) now lives in these two files, not
    // page.tsx — page.tsx is just the server-side provider switch.
    'app/(auth)/reset-password/confirm/SupabaseResetPasswordConfirmForm.tsx',
    'app/(auth)/reset-password/confirm/BetterAuthResetPasswordConfirmForm.tsx',
    'lib/utils/validation.ts',
    'tests/e2e/auth-flow.spec.ts',
  ];

  it.each(files)('%s does not mention a 6-character minimum', (rel) => {
    const src = read(rel);
    expect(src).not.toMatch(/at least 6 characters/i);
    expect(src).not.toMatch(/min\(6[,)]/);
  });
});

describe('password creation surfaces enforce the policy; sign-in does not', () => {
  it('register (server action) enforces the shared minimum', () => {
    const src = read('app/(auth)/register/actions.ts');
    expect(src).toContain('password.length < PASSWORD_MIN_LENGTH');
  });

  it('register form and both reset-confirm dual-run legs show the help text', () => {
    expect(read('app/(auth)/register/RegisterForm.tsx')).toContain('PASSWORD_HELP_TEXT');
    expect(
      read('app/(auth)/reset-password/confirm/SupabaseResetPasswordConfirmForm.tsx')
    ).toContain('PASSWORD_HELP_TEXT');
    expect(
      read('app/(auth)/reset-password/confirm/BetterAuthResetPasswordConfirmForm.tsx')
    ).toContain('PASSWORD_HELP_TEXT');
  });

  it('sign-in only requires presence, so existing shorter credentials still work', () => {
    const form = read('app/(auth)/login/LoginForm.tsx');
    const action = read('app/(auth)/login/actions.ts');
    expect(form).toContain('PASSWORD_REQUIRED_MESSAGE');
    expect(action).not.toMatch(/password\.length\s*<\s*\d/);
  });
});

describe('resolveAuthOriginFrom — verification deep links (host-header safety)', () => {
  it('prefers the configured site URL over any request header', () => {
    expect(
      resolveAuthOriginFrom({
        siteUrl: 'https://www.mangu-publishers.com/',
        vercelUrl: 'preview.vercel.app',
        host: 'attacker.example',
        forwardedHost: 'attacker.example',
        forwardedProto: 'https',
      })
    ).toBe('https://www.mangu-publishers.com');
  });

  it('ignores a forged x-forwarded-host entirely when configured', () => {
    const origin = resolveAuthOriginFrom({
      siteUrl: 'https://www.mangu-publishers.com',
      forwardedHost: 'evil.test, www.mangu-publishers.com',
    });
    expect(origin).not.toContain('evil.test');
  });

  it('falls back to VERCEL_URL before any client-supplied header', () => {
    expect(
      resolveAuthOriginFrom({ vercelUrl: 'my-app.vercel.app', host: 'attacker.example' })
    ).toBe('https://my-app.vercel.app');
  });

  it('uses the request host only as a local-development last resort', () => {
    expect(resolveAuthOriginFrom({ host: 'localhost:3000' })).toBe('http://localhost:3000');
    expect(resolveAuthOriginFrom({})).toBe(DEFAULT_AUTH_ORIGIN);
  });

  it('is wired into both auth flows that build email deep links', () => {
    for (const rel of ['app/(auth)/register/actions.ts', 'app/(auth)/reset-password/actions.ts']) {
      const src = read(rel);
      expect(src).toContain('resolveAuthOriginFromHeaders');
      // The old, header-trusting implementation must be gone.
      expect(src).not.toMatch(/const host = headersList\.get\('x-forwarded-host'\)/);
    }
  });
});

describe('A.6 — registration no longer swallows profile-creation failure', () => {
  it('returns an error instead of continuing', () => {
    const src = read('app/(auth)/register/actions.ts');
    expect(src).not.toContain("Don't fail registration if profile creation fails");
    expect(src).toContain('profileSetupFailed: true');
  });
});
