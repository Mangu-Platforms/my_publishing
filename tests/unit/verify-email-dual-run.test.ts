/**
 * Phoenix WS1 tail (REPO_AUDIT_2026-08-21 F2): dual-run coverage for the
 * verify-email resend server action. The Supabase leg is covered by
 * tests/unit/auth-flow-fixes.test.ts and is intentionally left untouched —
 * the assertions below confirm this change doesn't disturb it either
 * (last test in this file).
 */
import { resendVerificationEmail } from '@/app/(auth)/verify-email/actions';
import { betterAuthSendVerificationEmail } from '@/lib/auth/better-auth-actions';
import { isBetterAuthPrimary } from '@/lib/auth/provider';
import { createClient } from '@/lib/supabase/server';
import { authRateLimit, emailVerificationRateLimit } from '@/lib/utils/auth-rate-limit';

jest.mock('next/headers', () => ({
  headers: jest
    .fn()
    .mockResolvedValue(new Headers({ host: 'example.com', 'x-forwarded-proto': 'https' })),
}));
jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn() }));
jest.mock('@/lib/utils/auth-rate-limit', () => ({
  authRateLimit: jest.fn(),
  getAuthIdentifier: jest.fn(),
  emailVerificationRateLimit: jest.fn(),
}));
jest.mock('@/lib/auth/provider', () => ({ isBetterAuthPrimary: jest.fn() }));
jest.mock('@/lib/auth/better-auth-actions', () => ({
  betterAuthSendVerificationEmail: jest.fn(),
}));

const mockedIsBetterAuthPrimary = isBetterAuthPrimary as jest.MockedFunction<
  typeof isBetterAuthPrimary
>;
const mockedBetterAuthSend = betterAuthSendVerificationEmail as jest.MockedFunction<
  typeof betterAuthSendVerificationEmail
>;
const mockedCreateClient = createClient as jest.MockedFunction<typeof createClient>;
const mockedAuthRateLimit = authRateLimit as jest.MockedFunction<typeof authRateLimit>;
const mockedEmailVerificationRateLimit = emailVerificationRateLimit as jest.MockedFunction<
  typeof emailVerificationRateLimit
>;

describe('resendVerificationEmail — Better Auth dual-run leg', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedAuthRateLimit.mockResolvedValue(true);
    mockedEmailVerificationRateLimit.mockResolvedValue(true);
  });

  it('routes to the Better Auth helper and never touches Supabase when AUTH_PROVIDER=better-auth', async () => {
    mockedIsBetterAuthPrimary.mockReturnValue(true);
    mockedBetterAuthSend.mockResolvedValue({ success: true });

    const result = await resendVerificationEmail(' Reader@Example.COM ');

    expect(result).toEqual({ success: true });
    expect(mockedBetterAuthSend).toHaveBeenCalledWith('reader@example.com');
    expect(mockedCreateClient).not.toHaveBeenCalled();
  });

  it('surfaces a friendly rate-limit message when Better Auth rejects the resend', async () => {
    mockedIsBetterAuthPrimary.mockReturnValue(true);
    mockedBetterAuthSend.mockResolvedValue({ error: 'Too many requests' });

    const result = await resendVerificationEmail('reader@example.com');

    expect(result).toEqual({
      error: 'We recently sent a verification email. Please wait a minute before trying again.',
    });
  });

  it('passes through an unrecognized Better Auth error message as-is', async () => {
    mockedIsBetterAuthPrimary.mockReturnValue(true);
    mockedBetterAuthSend.mockResolvedValue({ error: 'Verification email is not enabled' });

    const result = await resendVerificationEmail('reader@example.com');

    expect(result).toEqual({ error: 'Verification email is not enabled' });
  });

  it('still enforces per-email rate limiting before calling the Better Auth helper', async () => {
    mockedIsBetterAuthPrimary.mockReturnValue(true);
    mockedEmailVerificationRateLimit.mockResolvedValue(false);

    const result = await resendVerificationEmail('reader@example.com');

    expect(result).toEqual({
      error: 'Too many verification email requests. Please try again in an hour.',
    });
    expect(mockedBetterAuthSend).not.toHaveBeenCalled();
  });

  it('still rejects invalid email input before rate limiting or dispatching to either provider', async () => {
    mockedIsBetterAuthPrimary.mockReturnValue(true);

    const result = await resendVerificationEmail('not-an-email');

    expect(result).toEqual({ error: 'Please provide a valid email address.' });
    expect(mockedAuthRateLimit).not.toHaveBeenCalled();
    expect(mockedBetterAuthSend).not.toHaveBeenCalled();
  });

  it('falls through to the unmodified Supabase leg when the provider is not better-auth', async () => {
    mockedIsBetterAuthPrimary.mockReturnValue(false);
    const resend = jest.fn().mockResolvedValue({ error: null });
    mockedCreateClient.mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: null } }),
        resend,
      },
    } as never);

    const result = await resendVerificationEmail('reader@example.com');

    expect(result).toEqual({ success: true });
    expect(mockedBetterAuthSend).not.toHaveBeenCalled();
    expect(resend).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'signup', email: 'reader@example.com' })
    );
  });
});
