'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
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

  if (/expired|otp_expired|invalid|token/i.test(message)) {
    return 'This password reset link is invalid or has expired. Please request a new reset email.';
  }

  if (/same password/i.test(message)) {
    return 'Please choose a password you have not used recently.';
  }

  if (/password/i.test(message) && /weak|short|least/i.test(message)) {
    return PASSWORD_MIN_MESSAGE_LONG;
  }

  return message;
}

/**
 * Task 1.9 / REPO_AUDIT_2026-08-21 F2: this is the pre-existing Supabase
 * reset-confirm flow, moved verbatim out of page.tsx so the Better Auth leg
 * can live alongside it without changing this file's behavior at all. Do not
 * "clean up" logic here without also re-verifying against Supabase — this is
 * the flow every production user still depends on until cutover.
 */
export function SupabaseResetPasswordConfirmForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createClient(), []);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUpdated, setIsUpdated] = useState(false);
  const [recoveryUserId, setRecoveryUserId] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    const stripSensitiveUrlState = () => {
      if (!window.location.search && !window.location.hash) {
        return;
      }

      window.history.replaceState({}, document.title, '/reset-password/confirm');
    };

    const handleResetLink = async () => {
      if (isActive) {
        setStatus('loading');
        setError(null);
      }

      try {
        const code = searchParams?.get('code');
        const searchError =
          searchParams?.get('error_description') || searchParams?.get('error') || null;
        const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
        const hashError = hashParams.get('error_description') || hashParams.get('error');

        if (searchError || hashError) {
          throw new Error(searchError || hashError || 'Unable to verify your password reset link.');
        }

        if (code) {
          let recoveryAuthorized = false;
          const {
            data: { subscription },
          } = supabase.auth.onAuthStateChange((event) => {
            if (event === 'PASSWORD_RECOVERY') {
              recoveryAuthorized = true;
            }
          });
          const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          subscription.unsubscribe();

          if (exchangeError) {
            throw exchangeError;
          }

          if (!recoveryAuthorized) {
            await supabase.auth.signOut();
            throw new Error('This link is not authorized for password recovery.');
          }

          stripSensitiveUrlState();
          if (isActive) {
            setRecoveryUserId(data.user.id);
            setStatus('ready');
          }
          return;
        }
      } catch (linkError) {
        if (isActive) {
          setError(toFriendlyResetError(linkError));
          setStatus('error');
        }
        return;
      }

      if (isActive) {
        setError('Invalid or expired password reset link. Please request a new reset email.');
        setStatus('error');
      }
    };

    handleResetLink();

    return () => {
      isActive = false;
    };
  }, [searchParams, supabase]);

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

    setIsSubmitting(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user || user.id !== recoveryUserId) {
      setIsSubmitting(false);
      setStatus('error');
      setError('Your recovery authorization expired. Please request a new reset email.');
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({ password });
    setIsSubmitting(false);

    if (updateError) {
      setError(toFriendlyResetError(updateError));
      return;
    }

    await supabase.auth.signOut();
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
