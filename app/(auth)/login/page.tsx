import { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { LoginForm } from './LoginForm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { isBetterAuthPrimary } from '@/lib/auth/provider';

export const metadata: Metadata = {
  title: 'Login',
  description: 'Sign in to your MANGU account',
};

export default function LoginPage() {
  const showLegacyBanner = isBetterAuthPrimary();

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <Link href="/" className="mb-2 block text-3xl font-bold text-primary">
          MANGU
        </Link>
        <CardTitle className="text-2xl">Welcome back</CardTitle>
        <CardDescription>Sign in to your account to continue</CardDescription>
      </CardHeader>
      <CardContent>
        {showLegacyBanner ? (
          <div
            className="mb-4 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-left text-sm text-amber-100"
            role="status"
          >
            Legacy user? Check your inbox to set a new password.
          </div>
        ) : null}
        <Suspense
          fallback={
            <div className="flex items-center justify-center py-8">
              <LoadingSpinner />
            </div>
          }
        >
          <LoginForm />
        </Suspense>
        <div className="mt-4 text-center text-sm">
          <Link href="/reset-password" className="text-primary hover:underline">
            Forgot password?
          </Link>
        </div>
        <div className="mt-4 text-center text-sm text-secondary">
          Don&apos;t have an account?{' '}
          <Link href="/register" className="text-primary hover:underline">
            Sign up
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
