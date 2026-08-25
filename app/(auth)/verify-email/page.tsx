import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { Container } from '@/components/layout/Container';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { betterAuthGetSessionUser } from '@/lib/auth/better-auth-actions';
import { isBetterAuthPrimary } from '@/lib/auth/provider';
import { createClient } from '@/lib/supabase/server';
import { ResendVerificationForm } from './ResendVerificationForm';

export const metadata: Metadata = {
  title: 'Verify Email',
  description: 'Verify your email address to activate your MANGU Publishers account.',
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function checkVerificationStatus(requestedEmail?: string) {
  const normalizedRequestedEmail = requestedEmail?.trim().toLowerCase();

  // REPO_AUDIT_2026-08-21 F2 / Phoenix WS1 tail: Better Auth leg, additive —
  // the Supabase branch below is untouched.
  if (isBetterAuthPrimary()) {
    const sessionUser = await betterAuthGetSessionUser();
    const email =
      normalizedRequestedEmail && EMAIL_PATTERN.test(normalizedRequestedEmail)
        ? normalizedRequestedEmail
        : sessionUser?.email?.trim().toLowerCase();

    if (!email) {
      redirect('/login?error=' + encodeURIComponent('Please sign in to verify your email.'));
    }

    return {
      email,
      emailConfirmed:
        sessionUser?.email?.trim().toLowerCase() === email && sessionUser.emailVerified === true,
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const email =
    normalizedRequestedEmail && EMAIL_PATTERN.test(normalizedRequestedEmail)
      ? normalizedRequestedEmail
      : user?.email?.trim().toLowerCase();

  if (!email) {
    redirect('/login?error=' + encodeURIComponent('Please sign in to verify your email.'));
  }

  return {
    email,
    emailConfirmed: user?.email?.trim().toLowerCase() === email && user.email_confirmed_at !== null,
  };
}

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams?: { email?: string };
}) {
  const { email, emailConfirmed } = await checkVerificationStatus(searchParams?.email);

  if (emailConfirmed) {
    redirect('/');
  }

  return (
    <Container className="flex min-h-screen items-center justify-center py-12">
      <Card className="w-full max-w-md">
        <CardHeader>
          <h1 className="text-2xl font-semibold leading-none tracking-tight">Verify Your Email</h1>
          <CardDescription>
            We&apos;ve sent a verification email to <strong>{email}</strong>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg bg-muted p-4">
            <p className="text-sm text-muted-foreground">
              Please check your email and click the verification link to activate your account.
            </p>
          </div>

          <Suspense fallback={<div>Loading...</div>}>
            <ResendVerificationForm email={email} />
          </Suspense>

          <div className="pt-4">
            <Button variant="outline" className="w-full" asChild>
              <Link href="/">Go to Homepage</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </Container>
  );
}
