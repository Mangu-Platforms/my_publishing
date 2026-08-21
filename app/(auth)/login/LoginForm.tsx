'use client';

import { useEffect, useId, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { signIn } from './actions';
import { normalizeAuthErrorMessage } from '@/lib/auth/error-messages';
import { sanitizeNextPath } from '@/lib/utils/safe-next';
import { PASSWORD_REQUIRED_MESSAGE } from '@/lib/auth/password-policy';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  // Task 1.9: sign-in checks presence only. The 8-character creation policy
  // is enforced where passwords are SET (register / reset), so existing
  // shorter credentials are not locked out of their own accounts.
  password: z.string().min(1, PASSWORD_REQUIRED_MESSAGE),
});

type LoginFormData = z.infer<typeof loginSchema>;

export function LoginForm() {
  const searchParams = useSearchParams();
  const errorId = useId();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Surface errors forwarded via URL (e.g. from OAuth callback failures).
  useEffect(() => {
    const urlError = searchParams?.get('error');
    if (!urlError) {
      return;
    }
    let decoded = urlError;
    try {
      decoded = decodeURIComponent(urlError);
    } catch {
      // Malformed percent-encoding — fall back to the raw value.
    }
    setError(normalizeAuthErrorMessage(decoded));
  }, [searchParams]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('email', data.email);
      formData.append('password', data.password);

      const result = await signIn(formData);

      if (result && 'error' in result && result.error) {
        // Task 1.8: last line of defence — the message slot only ever renders a
        // safe string, never `{}`, `[object Object]` or a provider internal.
        setError(normalizeAuthErrorMessage(result.error));
        setIsLoading(false);
      } else {
        // Full-page navigation so the client-side Supabase session picks up
        // the auth cookies set by the server action. Honor ?next= (middleware
        // and checkout send users here with their original destination).
        window.location.assign(sanitizeNextPath(searchParams?.get('next')));
      }
    } catch {
      setError('An unexpected error occurred');
      setIsLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-4"
      aria-label="Sign in form"
      noValidate
    >
      {/* Live region announces errors to screen readers without focus change */}
      <div aria-live="polite" aria-atomic="true">
        {error && (
          <div
            id={errorId}
            role="alert"
            className="rounded-md border border-red-500 bg-red-500/10 p-3 text-sm text-red-500"
          >
            {error}
          </div>
        )}
      </div>
      <div>
        <label htmlFor="email" className="mb-2 block text-sm font-medium">
          Email
        </label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          aria-describedby={errors.email ? 'email-error' : undefined}
          aria-invalid={!!errors.email}
          {...register('email')}
          disabled={isLoading}
        />
        {errors.email && (
          <p id="email-error" role="alert" className="mt-1 text-sm text-red-500">
            {errors.email.message}
          </p>
        )}
      </div>
      <div>
        <label htmlFor="password" className="mb-2 block text-sm font-medium">
          Password
        </label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          aria-describedby={errors.password ? 'password-error' : undefined}
          aria-invalid={!!errors.password}
          {...register('password')}
          disabled={isLoading}
        />
        {errors.password && (
          <p id="password-error" role="alert" className="mt-1 text-sm text-red-500">
            {errors.password.message}
          </p>
        )}
      </div>
      <Button type="submit" className="w-full" disabled={isLoading} aria-busy={isLoading}>
        {isLoading ? <LoadingSpinner size="sm" /> : 'Sign in'}
      </Button>
    </form>
  );
}
