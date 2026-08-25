'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { authClient } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { normalizeAuthErrorMessage } from '@/lib/auth/error-messages';
import {
  PASSWORD_HELP_TEXT,
  PASSWORD_MIN_LENGTH,
  PASSWORD_MIN_MESSAGE_LONG,
} from '@/lib/auth/password-policy';

function toFriendlyResetError(error: unknown) {
  const message = normalizeAuthErrorMessage(error, 'We could not verify this reset link.');

  if (/expired|invalid|token/i.test(message)) {
    return 'This password reset link is invalid or has expired. Please request a new reset email.';
  }

  if (/password/i.test(message) && /short|long|least/i.test(message)) {
    return PASSWORD_MIN_MESSAGE_LONG;
  }

  return message;
}

/**
 * REPO_AUDIT_2026-08-21 F2 / Phoenix WS1 tail (Better Auth leg).
 *
 * How the link gets here: `betterAuthRequestPasswordReset` sends
 * `redirectTo: <site>/reset-password/confirm`. Better Auth emails a link to
 * its own `GET /api/auth/reset-password/:token?callbackURL=...` endpoint
 * (already served by the existing `app/api/auth/[...all]/route.ts`
 * catch-all — no new route needed). That endpoint validates the token isn't
 * expired and 302s to `callbackURL` with `?token=<token>` appended, or with
 * `?error=INVALID_TOKEN` if the token is missing/expired. So this page reads
 * `token` (valid link) or `error` (rejected link) from the query string —
 * never a `code`, which is Supabase's shape, not Better Auth's.
 *
 * Submitting posts `{ newPassword, token }` to Better Auth's
 * `POST /api/auth/reset-password`, which one-time-consumes the token and
 * hashes the new password with Better Auth's own hasher (scrypt) — this
 * never reads or compares against the legacy Supabase bcrypt hash (see
 * CLAUDE.md rule 4 / the forced-reset playbook).
 */
export function BetterAuthResetPasswordConfirmForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams?.get('token') ?? null;
  const linkError = searchParams?.get('error') ?? null;

  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUpdated, setIsUpdated] = useState(false);

  useEffect(() => {
    if (linkError) {
      setError(
        'This password reset link is invalid or has expired. Please request a new reset email.'
      );
      setStatus('error');
      return;
    }

    if (!token) {
      setError('Invalid or expired password reset link. Please request a new reset email.');
      setStatus('error');
      return;
    }

    setStatus('ready');
  }, [token, linkError]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!password || !confirmPassword) {
      setError('Please enter and confirm your new password.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (password.length < PASSWORD_MIN_LENGTH) {
      setError(PASSWORD_MIN_MESSAGE_LONG);
      return;
    }

    if (!token) {
      setStatus('error');
      setError('Invalid or expired password reset link. Please request a new reset email.');
      return;
    }

    setIsSubmitting(true);
    const { error: resetError } = await authClient.resetPassword({
      newPassword: password,
      token,
    });
    setIsSubmitting(false);

    if (resetError) {
      // A rejected/expired token can't be retried with the same link.
      const friendly = toFriendlyResetError(resetError);
      setError(friendly);
      if (/expired|invalid/i.test(friendly)) {
        setStatus('error');
      }
      return;
    }

    setIsUpdated(true);
    setTimeout(() => {
      router.push('/login');
    }, 1200);
  };

  return (
    <>
      {status === 'loading' ? (
        <div className="flex items-center justify-center py-8">
          <LoadingSpinner />
        </div>
      ) : status === 'error' ? (
        <div className="space-y-4 text-center">
          <p className="text-sm text-red-500">{error}</p>
          <Button asChild className="w-full">
            <Link href="/reset-password">Request a new link</Link>
          </Button>
        </div>
      ) : isUpdated ? (
        <div className="space-y-2 text-center">
          <p className="text-sm text-green-600">Password updated! Redirecting to sign in...</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">New password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              aria-describedby="password-help"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={isSubmitting}
            />
            <p id="password-help" className="text-sm text-secondary">
              {PASSWORD_HELP_TEXT}
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm new password</Label>
            <Input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              disabled={isSubmitting}
            />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <Button className="w-full" type="submit" disabled={isSubmitting}>
            {isSubmitting ? <LoadingSpinner size="sm" /> : 'Update password'}
          </Button>
        </form>
      )}
    </>
  );
}
