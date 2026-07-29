/**
 * Server-side Better Auth wrappers used by auth page actions when
 * AUTH_PROVIDER=better-auth.
 */

'use server';

import { cookies, headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { getAuth } from '@/lib/auth';
import { MANGU_ROLE_COOKIE, normalizeManguRole } from '@/lib/auth/roles';
import { normalizeAuthErrorMessage, redactAuthDiagnostic } from '@/lib/auth/error-messages';

async function setRoleCookie(role: string) {
  const jar = await cookies();
  jar.set(MANGU_ROLE_COOKIE, normalizeManguRole(role), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function betterAuthSignIn(email: string, password: string) {
  const auth = await getAuth();
  const hdrs = await headers();

  try {
    const result = await auth.api.signInEmail({
      body: { email, password },
      headers: hdrs,
    });

    const role = normalizeManguRole(
      (result as { user?: { role?: unknown } } | null)?.user?.role
    );
    await setRoleCookie(role);
    revalidatePath('/', 'layout');
    return { success: true as const };
  } catch (error) {
    // Task 1.8: Better Auth throws APIError objects whose `message` is not
    // always a usable string — normalize before it can reach the form.
    console.error('[auth] Better Auth sign-in rejected:', redactAuthDiagnostic(error));
    const message = normalizeAuthErrorMessage(
      error,
      'We could not sign you in right now. Please try again.'
    );
    if (/verif/i.test(message)) {
      return { error: 'Please verify your email address before signing in.' };
    }
    if (/invalid|credential|password|email/i.test(message)) {
      return { error: 'Invalid email or password. Please try again.' };
    }
    return { error: message };
  }
}

export async function betterAuthSignUp(input: {
  email: string;
  password: string;
  name: string;
}) {
  const auth = await getAuth();
  const hdrs = await headers();

  try {
    await auth.api.signUpEmail({
      body: {
        email: input.email,
        password: input.password,
        name: input.name,
      },
      headers: hdrs,
    });
    revalidatePath('/', 'layout');
    return {
      success: true as const,
      message: 'Check your email to verify your account before signing in.',
    };
  } catch (error) {
    console.error('[auth] Better Auth sign-up rejected:', redactAuthDiagnostic(error));
    const message = normalizeAuthErrorMessage(
      error,
      'We could not create your account right now. Please try again.'
    );
    if (/already|exists|unique/i.test(message)) {
      return { error: 'An account with this email already exists.' };
    }
    return { error: message };
  }
}

export async function betterAuthRequestPasswordReset(email: string) {
  const auth = await getAuth();
  const base = (
    process.env.BETTER_AUTH_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    'http://localhost:3000'
  ).replace(/\/+$/, '');

  try {
    await auth.api.requestPasswordReset({
      body: {
        email,
        redirectTo: `${base}/reset-password/confirm`,
      },
      headers: await headers(),
    });
    return { success: true as const };
  } catch (error) {
    console.error('[auth] Better Auth reset request rejected:', redactAuthDiagnostic(error));
    return {
      error: normalizeAuthErrorMessage(
        error,
        'We could not start the password reset request. Please try again.'
      ),
    };
  }
}

export async function betterAuthSignOut() {
  const auth = await getAuth();
  try {
    await auth.api.signOut({ headers: await headers() });
  } catch {
    // ignore — clear role cookie anyway
  }
  const jar = await cookies();
  jar.delete(MANGU_ROLE_COOKIE);
  revalidatePath('/', 'layout');
  return { success: true as const };
}
