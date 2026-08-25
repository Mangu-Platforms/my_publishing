import { toFriendlyRegisterError } from '@/lib/auth/register-errors';
import { resendVerificationEmail } from '@/app/(auth)/verify-email/actions';
import { createClient } from '@/lib/supabase/server';
import { authRateLimit, emailVerificationRateLimit } from '@/lib/utils/auth-rate-limit';

jest.mock('next/headers', () => ({
  headers: jest
    .fn()
    .mockResolvedValue(new Headers({ host: 'example.com', 'x-forwarded-proto': 'https' })),
}));
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }));
jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn() }));
jest.mock('@/lib/supabase/admin', () => ({ createClient: jest.fn() }));
// REPO_AUDIT_2026-08-21 F2: actions.ts now also imports the Better Auth leg.
// This suite only exercises the (default, untouched) Supabase branch, so the
// real lib/auth/better-auth-actions.ts — which pulls in lib/auth.ts and the
// better-auth package's ESM build — must never load here.
jest.mock('@/lib/auth/better-auth-actions', () => ({
  betterAuthSendVerificationEmail: jest.fn(),
}));
jest.mock('@/lib/utils/auth-rate-limit', () => ({
  authRateLimit: jest.fn(),
  getAuthIdentifier: jest.fn(),
  emailVerificationRateLimit: jest.fn(),
}));

const mockedCreateClient = createClient as jest.MockedFunction<typeof createClient>;
const mockedAuthRateLimit = authRateLimit as jest.MockedFunction<typeof authRateLimit>;
const mockedEmailVerificationRateLimit = emailVerificationRateLimit as jest.MockedFunction<
  typeof emailVerificationRateLimit
>;

describe('auth flow fixes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedAuthRateLimit.mockResolvedValue(true);
    mockedEmailVerificationRateLimit.mockResolvedValue(true);
  });

  it('identifies provider email throttling separately from registration attempt limits', () => {
    expect(toFriendlyRegisterError('email rate limit exceeded')).toMatch(/email provider/);
    expect(toFriendlyRegisterError('Too many requests')).toMatch(/registration attempts/);
  });

  it('resends signup verification without requiring an authenticated session', async () => {
    const resend = jest.fn().mockResolvedValue({ error: null });
    mockedCreateClient.mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: null } }),
        resend,
      },
    } as never);

    const result = await resendVerificationEmail(' Pending@Example.COM ');

    expect(result).toEqual({ success: true });
    expect(mockedEmailVerificationRateLimit).toHaveBeenCalledWith('pending@example.com');
    expect(resend).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'signup', email: 'pending@example.com' })
    );
  });

  it('rejects invalid resend email input before rate limiting', async () => {
    const result = await resendVerificationEmail('not-an-email');

    expect(result).toEqual({ error: 'Please provide a valid email address.' });
    expect(mockedAuthRateLimit).not.toHaveBeenCalled();
    expect(mockedEmailVerificationRateLimit).not.toHaveBeenCalled();
    expect(mockedCreateClient).not.toHaveBeenCalled();
  });

  it('blocks resend by caller identity before the per-email limiter runs', async () => {
    mockedAuthRateLimit.mockResolvedValue(false);

    const result = await resendVerificationEmail('victim@example.com');

    expect(result).toEqual({
      error: 'Too many verification email requests. Please try again later.',
    });
    expect(mockedEmailVerificationRateLimit).not.toHaveBeenCalled();
    expect(mockedCreateClient).not.toHaveBeenCalled();
  });
});
