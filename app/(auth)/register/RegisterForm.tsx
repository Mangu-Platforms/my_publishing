'use client';

import { useId, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { registerUser } from './actions';
import { normalizeAuthErrorMessage } from '@/lib/auth/error-messages';
import {
  PASSWORD_HELP_TEXT,
  PASSWORD_MIN_LENGTH,
  PASSWORD_MIN_MESSAGE,
} from '@/lib/auth/password-policy';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';

const registerSchema = z
  .object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(PASSWORD_MIN_LENGTH, PASSWORD_MIN_MESSAGE),
    confirmPassword: z.string(),
    fullName: z.string().min(2, 'Full name is required'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

type RegisterFormData = z.infer<typeof registerSchema>;

export function RegisterForm() {
  const errorId = useId();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data: RegisterFormData) => {
    setIsLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('email', data.email);
      formData.append('password', data.password);
      formData.append('fullName', data.fullName);

      const result = await registerUser(formData);

      if (result?.error) {
        setError(normalizeAuthErrorMessage(result.error));
        setIsLoading(false);
      } else if (result?.needsVerification && result.verificationEmail) {
        // No session yet — the user must confirm their email first.
        window.location.assign(
          `/verify-email?email=${encodeURIComponent(result.verificationEmail)}`
        );
      } else {
        // Full-page navigation so the client-side Supabase session picks up
        // the auth cookies set by the server action.
        window.location.assign('/');
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
      aria-label="Create account form"
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
        <label htmlFor="fullName" className="mb-2 block text-sm font-medium">
          Full Name
        </label>
        <Input
          id="fullName"
          type="text"
          autoComplete="name"
          placeholder="John Doe"
          aria-describedby={errors.fullName ? 'fullName-error' : undefined}
          aria-invalid={!!errors.fullName}
          {...register('fullName')}
          disabled={isLoading}
        />
        {errors.fullName && (
          <p id="fullName-error" role="alert" className="mt-1 text-sm text-red-500">
            {errors.fullName.message}
          </p>
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
          autoComplete="new-password"
          placeholder="••••••••"
          aria-describedby={errors.password ? 'password-error' : 'password-help'}
          aria-invalid={!!errors.password}
          {...register('password')}
          disabled={isLoading}
        />
        {errors.password ? (
          <p id="password-error" role="alert" className="mt-1 text-sm text-red-500">
            {errors.password.message}
          </p>
        ) : (
          <p id="password-help" className="mt-1 text-sm text-secondary">
            {PASSWORD_HELP_TEXT}
          </p>
        )}
      </div>
      <div>
        <label htmlFor="confirmPassword" className="mb-2 block text-sm font-medium">
          Confirm Password
        </label>
        <Input
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          placeholder="••••••••"
          aria-describedby={errors.confirmPassword ? 'confirmPassword-error' : undefined}
          aria-invalid={!!errors.confirmPassword}
          {...register('confirmPassword')}
          disabled={isLoading}
        />
        {errors.confirmPassword && (
          <p id="confirmPassword-error" role="alert" className="mt-1 text-sm text-red-500">
            {errors.confirmPassword.message}
          </p>
        )}
      </div>
      <Button type="submit" className="w-full" disabled={isLoading} aria-busy={isLoading}>
        {isLoading ? <LoadingSpinner size="sm" /> : 'Create account'}
      </Button>
    </form>
  );
}
