/**
 * Phoenix WS1 tail (REPO_AUDIT_2026-08-21 F2): the two new Better Auth
 * server helpers backing the verify-email dual-run leg —
 * betterAuthSendVerificationEmail (resend) and betterAuthGetSessionUser
 * (server-rendered verification status). The pre-existing helpers in this
 * file (betterAuthSignIn/SignUp/RequestPasswordReset/SignOut) are out of
 * scope for this change.
 */
import {
  betterAuthGetSessionUser,
  betterAuthSendVerificationEmail,
} from '@/lib/auth/better-auth-actions';
import { getAuth } from '@/lib/auth';

jest.mock('next/headers', () => ({
  headers: jest.fn().mockResolvedValue(new Headers({ host: 'example.com' })),
  cookies: jest.fn().mockResolvedValue({ set: jest.fn(), delete: jest.fn() }),
}));
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }));
jest.mock('@/lib/auth', () => ({ getAuth: jest.fn() }));

const mockedGetAuth = getAuth as jest.MockedFunction<typeof getAuth>;

describe('betterAuthSendVerificationEmail', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls the Better Auth send-verification-email endpoint with the email only (no callbackURL override)', async () => {
    const sendVerificationEmail = jest.fn().mockResolvedValue(undefined);
    mockedGetAuth.mockResolvedValue({ api: { sendVerificationEmail } } as never);

    const result = await betterAuthSendVerificationEmail('reader@example.com');

    expect(result).toEqual({ success: true });
    expect(sendVerificationEmail).toHaveBeenCalledTimes(1);
    expect(sendVerificationEmail).toHaveBeenCalledWith(
      expect.objectContaining({ body: { email: 'reader@example.com' } })
    );
  });

  it('normalizes a Better Auth rejection into a safe, user-facing message', async () => {
    const sendVerificationEmail = jest
      .fn()
      .mockRejectedValue(new Error('Email is already verified'));
    mockedGetAuth.mockResolvedValue({ api: { sendVerificationEmail } } as never);

    const result = await betterAuthSendVerificationEmail('reader@example.com');

    expect(result).toEqual({ error: 'Email is already verified' });
  });

  it('falls back to a generic message for an unusable/empty error shape', async () => {
    const sendVerificationEmail = jest.fn().mockRejectedValue({});
    mockedGetAuth.mockResolvedValue({ api: { sendVerificationEmail } } as never);

    const result = await betterAuthSendVerificationEmail('reader@example.com');

    expect(result).toEqual({
      error: 'We could not resend the verification email right now. Please try again.',
    });
  });
});

describe('betterAuthGetSessionUser', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns the session email and verified flag', async () => {
    const getSession = jest
      .fn()
      .mockResolvedValue({ user: { email: 'reader@example.com', emailVerified: true } });
    mockedGetAuth.mockResolvedValue({ api: { getSession } } as never);

    expect(await betterAuthGetSessionUser()).toEqual({
      email: 'reader@example.com',
      emailVerified: true,
    });
  });

  it('coerces a missing/falsy emailVerified to false rather than undefined', async () => {
    const getSession = jest.fn().mockResolvedValue({ user: { email: 'reader@example.com' } });
    mockedGetAuth.mockResolvedValue({ api: { getSession } } as never);

    expect(await betterAuthGetSessionUser()).toEqual({
      email: 'reader@example.com',
      emailVerified: false,
    });
  });

  it('returns null when there is no session', async () => {
    const getSession = jest.fn().mockResolvedValue(null);
    mockedGetAuth.mockResolvedValue({ api: { getSession } } as never);

    expect(await betterAuthGetSessionUser()).toBeNull();
  });

  it('returns null (never throws) when the session lookup itself fails', async () => {
    const getSession = jest.fn().mockRejectedValue(new Error('mongo unavailable'));
    mockedGetAuth.mockResolvedValue({ api: { getSession } } as never);

    await expect(betterAuthGetSessionUser()).resolves.toBeNull();
  });
});
