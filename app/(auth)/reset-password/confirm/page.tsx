import { Suspense } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { isBetterAuthPrimary } from '@/lib/auth/provider';
import { BetterAuthResetPasswordConfirmForm } from './BetterAuthResetPasswordConfirmForm';
import { SupabaseResetPasswordConfirmForm } from './SupabaseResetPasswordConfirmForm';

/**
 * REPO_AUDIT_2026-08-21 F2 / Phoenix WS1 tail.
 *
 * This page must decide, server-side, which provider's completion flow to
 * mount — a Client Component cannot read `AUTH_PROVIDER` (it's deliberately
 * not a `NEXT_PUBLIC_*` var) so the choice is made here and threaded down by
 * rendering one of two Client Components, not via a boolean prop + branch
 * inside a single client file. `SupabaseResetPasswordConfirmForm` is the
 * pre-existing logic, moved verbatim — its behavior is unchanged.
 */
export default function ResetPasswordConfirmPage() {
  const betterAuthPrimary = isBetterAuthPrimary();

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <Link href="/" className="mb-2 block text-3xl font-bold text-primary">
          MANGU
        </Link>
        <CardTitle className="text-2xl">Create a new password</CardTitle>
        <CardDescription>Enter a new password for your account.</CardDescription>
      </CardHeader>
      <CardContent>
        <Suspense
          fallback={
            <div className="flex items-center justify-center py-8">
              <LoadingSpinner />
            </div>
          }
        >
          {betterAuthPrimary ? (
            <BetterAuthResetPasswordConfirmForm />
          ) : (
            <SupabaseResetPasswordConfirmForm />
          )}
        </Suspense>
      </CardContent>
    </Card>
  );
}
