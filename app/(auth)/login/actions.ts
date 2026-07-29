'use server';

import { revalidatePath } from 'next/cache';
import { betterAuthSignIn } from '@/lib/auth/better-auth-actions';
import { isBetterAuthPrimary } from '@/lib/auth/provider';
import { createClient } from '@/lib/supabase/server';
import { authRateLimitCheck, getAuthIdentifier } from '@/lib/utils/auth-rate-limit';
import { normalizeAuthErrorMessage, redactAuthDiagnostic } from '@/lib/auth/error-messages';
import { headers } from 'next/headers';

export async function signIn(formData: FormData) {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  // Rate limiting
  const headersList = await headers();
  const ip = headersList.get('x-forwarded-for') || headersList.get('x-real-ip') || null;
  const identifier = getAuthIdentifier(ip, email);

  const rate = await authRateLimitCheck(identifier);
  if (!rate.success) {
    if (rate.reason === 'unavailable') {
      console.error(
        '[auth] Rate limiter unavailable — sign-in blocked for ALL users. ' +
          'Check UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN in this environment.'
      );
      return {
        error: 'Sign-in is temporarily unavailable. Please try again in a few minutes.',
      };
    }
    return { error: 'Too many login attempts. Please try again in 15 minutes.' };
  }

  // Validate inputs
  if (!email || !password) {
    return { error: 'Email and password are required' };
  }

  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { error: 'Please enter a valid email address' };
  }

  // Task 1.9: sign-in intentionally applies NO password-length policy. The
  // creation policy (8 chars, lib/auth/password-policy.ts) is enforced where a
  // password is SET. Gating sign-in on length would lock out pre-existing
  // 6-7 character credentials and leak the policy to an attacker.

  const normalizedEmail = email.trim().toLowerCase();

  if (isBetterAuthPrimary()) {
    return betterAuthSignIn(normalizedEmail, password);
  }

  try {
    const supabase = await createClient();

    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (error) {
      // Diagnostics stay server-side and redacted (Task 1.8).
      console.error('[auth] Supabase sign-in rejected:', redactAuthDiagnostic(error));

      const raw = typeof error.message === 'string' ? error.message : '';

      // Provide user-friendly error messages
      if (raw.includes('Invalid login credentials')) {
        return { error: 'Invalid email or password. Please try again.' };
      }
      if (raw.includes('Email not confirmed')) {
        return { error: 'Please verify your email address before signing in.' };
      }
      if (raw.includes('Too many requests')) {
        return { error: 'Too many login attempts. Please try again later.' };
      }

      // Anything else is normalized: never surface `{}`, `[object Object]`,
      // a stack trace or a provider internal to the sign-in form.
      return {
        error: normalizeAuthErrorMessage(
          error,
          'We could not sign you in right now. Please try again.'
        ),
      };
    }

    if (!data.user) {
      return { error: 'Failed to sign in. Please try again.' };
    }

    // Revalidate paths
    revalidatePath('/', 'layout');
  } catch (error) {
    console.error('[auth] Unexpected error during sign in:', redactAuthDiagnostic(error));
    return { error: 'An unexpected error occurred. Please try again.' };
  }

  // Success: the client performs a full-page navigation so the browser
  // Supabase client picks up the freshly set auth cookies.
  return { success: true };
}
