'use server';

import { headers } from 'next/headers';
import { betterAuthRequestPasswordReset } from '@/lib/auth/better-auth-actions';
import { isBetterAuthPrimary } from '@/lib/auth/provider';
import { createClient } from '@/lib/supabase/server';
import { passwordResetRateLimit } from '@/lib/utils/auth-rate-limit';
import { normalizeAuthErrorMessage, redactAuthDiagnostic } from '@/lib/auth/error-messages';
import { resolveAuthOriginFromHeaders } from '@/lib/auth/origin';

/** Task 1.9: same host-header-injection fix as the register flow. */
async function resolveAuthOrigin() {
  return resolveAuthOriginFromHeaders(await headers());
}

function toFriendlyResetError(message: string) {
  if (/too many requests|rate limit|security purposes/i.test(message)) {
    return 'We recently sent a reset email. Please wait a minute before trying again.';
  }

  if (
    /email.*quota|quota.*email|email.*temporarily unavailable|smtp|error sending/i.test(message)
  ) {
    return 'Password reset email delivery is temporarily unavailable. Please try again later.';
  }

  return message;
}

export async function resetPassword(formData: FormData) {
  const email = formData.get('email') as string;

  if (!email) {
    return { error: 'Email is required' };
  }

  const normalizedEmail = email.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(normalizedEmail)) {
    return { error: 'Please enter a valid email address' };
  }

  // Rate limiting for password reset
  if (!(await passwordResetRateLimit(normalizedEmail))) {
    return { error: 'Too many password reset requests. Please try again in an hour.' };
  }

  if (isBetterAuthPrimary()) {
    const ba = await betterAuthRequestPasswordReset(normalizedEmail);
    if (ba.error) {
      return { error: toFriendlyResetError(normalizeAuthErrorMessage(ba.error)) };
    }
    return { success: true };
  }

  try {
    const supabase = await createClient();
    const baseUrl = await resolveAuthOrigin();
    const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
      redirectTo: `${baseUrl}/reset-password/confirm`,
    });

    if (error) {
      console.error('[auth] Password reset request rejected:', redactAuthDiagnostic(error));
      return { error: toFriendlyResetError(normalizeAuthErrorMessage(error)) };
    }
  } catch (error) {
    console.error(
      '[auth] Unexpected error requesting password reset:',
      redactAuthDiagnostic(error)
    );
    return { error: 'We could not start the password reset request. Please try again.' };
  }

  return { success: true };
}
