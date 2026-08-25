/**
 * Phoenix WS1 tail (REPO_AUDIT_2026-08-21 F2): the Better Auth leg of
 * /reset-password/confirm.
 *
 * The Supabase leg (SupabaseResetPasswordConfirmForm) is the pre-existing
 * logic, moved verbatim out of page.tsx — it is not re-tested here, and
 * page.tsx itself just picks one of the two Client Components based on
 * isBetterAuthPrimary() (a plain server-side if/else, not worth a render
 * test given this repo doesn't unit-test page.tsx components elsewhere).
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { BetterAuthResetPasswordConfirmForm } from '@/app/(auth)/reset-password/confirm/BetterAuthResetPasswordConfirmForm';
import { authClient } from '@/lib/auth-client';

const pushMock = jest.fn();
let params = new URLSearchParams();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
  useSearchParams: () => params,
}));

jest.mock('@/lib/auth-client', () => ({
  authClient: { resetPassword: jest.fn() },
}));

const mockedResetPassword = authClient.resetPassword as jest.Mock;

function fillAndSubmit(password: string, confirmPassword = password) {
  fireEvent.change(screen.getByLabelText(/^new password$/i), { target: { value: password } });
  fireEvent.change(screen.getByLabelText(/confirm new password/i), {
    target: { value: confirmPassword },
  });
  fireEvent.click(screen.getByRole('button', { name: /update password/i }));
}

describe('BetterAuthResetPasswordConfirmForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    params = new URLSearchParams();
  });

  it("shows the expired/invalid-link error and a fresh-link CTA when Better Auth's own redirect carries ?error=", () => {
    params = new URLSearchParams({ error: 'INVALID_TOKEN' });
    render(<BetterAuthResetPasswordConfirmForm />);

    expect(screen.getByText(/invalid or has expired/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /request a new link/i })).toHaveAttribute(
      'href',
      '/reset-password'
    );
  });

  it('shows an invalid-link error when there is no token in the URL at all', () => {
    render(<BetterAuthResetPasswordConfirmForm />);

    expect(screen.getByText(/invalid or expired password reset link/i)).toBeInTheDocument();
  });

  it('renders the new-password form once a ?token= is present', () => {
    params = new URLSearchParams({ token: 'abc123' });
    render(<BetterAuthResetPasswordConfirmForm />);

    expect(screen.getByLabelText(/^new password$/i)).toBeInTheDocument();
    expect(mockedResetPassword).not.toHaveBeenCalled();
  });

  it('rejects a too-short password locally without calling Better Auth', () => {
    params = new URLSearchParams({ token: 'abc123' });
    render(<BetterAuthResetPasswordConfirmForm />);

    fillAndSubmit('short');

    expect(screen.getByText(/password must be at least 8 characters/i)).toBeInTheDocument();
    expect(mockedResetPassword).not.toHaveBeenCalled();
  });

  it('rejects a mismatched confirmation without calling Better Auth', () => {
    params = new URLSearchParams({ token: 'abc123' });
    render(<BetterAuthResetPasswordConfirmForm />);

    fillAndSubmit('correct-horse-battery', 'different-password');

    expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
    expect(mockedResetPassword).not.toHaveBeenCalled();
  });

  it('posts { newPassword, token } to authClient.resetPassword and confirms on success', async () => {
    params = new URLSearchParams({ token: 'abc123' });
    mockedResetPassword.mockResolvedValue({ error: null });

    render(<BetterAuthResetPasswordConfirmForm />);
    await act(async () => {
      fillAndSubmit('correct-horse-battery');
    });

    expect(mockedResetPassword).toHaveBeenCalledWith({
      newPassword: 'correct-horse-battery',
      token: 'abc123',
    });
    expect(await screen.findByText(/password updated/i)).toBeInTheDocument();
  });

  it('shows a friendly expired-link error and does not redirect when Better Auth rejects the token', async () => {
    params = new URLSearchParams({ token: 'abc123' });
    mockedResetPassword.mockResolvedValue({ error: { message: 'Token expired' } });

    render(<BetterAuthResetPasswordConfirmForm />);
    await act(async () => {
      fillAndSubmit('correct-horse-battery');
    });

    expect(await screen.findByText(/invalid or has expired/i)).toBeInTheDocument();
    // Rejected-token state has no form left to resubmit — only the fresh-link CTA.
    expect(screen.getByRole('link', { name: /request a new link/i })).toBeInTheDocument();
    await waitFor(() => expect(pushMock).not.toHaveBeenCalled());
  });
});
