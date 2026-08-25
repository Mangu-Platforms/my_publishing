'use server';

import { headers } from 'next/headers';
import { betterAuthSendVerificationEmail } from '@/lib/auth/better-auth-actions';
import { isBetterAuthPrimary } from '@/lib/auth/provider';
import { createClient } from '@/lib/supabase/server';
import {
  authRateLimit,
  emailVerificationRateLimit,
  getAuthIdentifier,
} from '@/lib/utils/auth-rate-limit';

function normalizeOrigin(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  return value.trim().replace(/\/+$/, '');
}

async function resolveAuthOrigin() {
  const headersList = await headers();
  const host = headersList.get('x-forwarded-host') || headersList.get('host');
  const proto = headersList.get('x-forwarded-proto') || 'http';
  const requestOrigin = host ? `${proto}://${host.split(',')[0].trim()}` : null;
  const configuredOrigin = normalizeOrigin(process.env.NEXT_PUBLIC_SITE_URL);
  const vercelUrl = normalizeOrigin(process.env.VERCEL_URL);

  if (requestOrigin) {
    return normalizeOrigin(requestOrigin)!;
  }

  if (configuredOrigin) {
    return configuredOrigin;
  }

  if (vercelUrl) {
    return `https://${vercelUrl.replace(/^https?:\/\//, '')}`;
  }

  return 'http://localhost:3001';
}

function toFriendlyResendError(message: string) {
  if (/too many requests|rate limit|security purposes/i.test(message)) {
    return 'We recently sent a verification email. Please wait a minute before trying again.';
  }

  if (
    /email.*quota|quota.*email|email.*temporarily unavailable|smtp|error sending/i.test(message)
  ) {
    return 'Verification email delivery is temporarily unavailable. Please try again later.';
  }

  return message;
}

export async function resendVerificationEmail(email: string) {
  const normalizedEmail = email?.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!normalizedEmail || !emailRegex.test(normalizedEmail)) {
    return { error: 'Please provide a valid email address.' };
  }

  // IP-keyed rate limiting: the action is callable without a session, so limit
  // per caller IP (not just per target email) to block email-bomb abuse where
  // one client cycles through many victim addresses.
  const headersList = await headers();
  const ip = headersList.get('x-forwarded-for') || headersList.get('x-real-ip') || null;
  const ipIdentifier = getAuthIdentifier(ip);

  if (!(await authRateLimit(ipIdentifier))) {
    return { error: 'Too many verification email requests. Please try again later.' };
  }

  // Per-email rate limiting
  if (!(await emailVerificationRateLimit(normalizedEmail))) {
    return { error: 'Too many verification email requests. Please try again in an hour.' };
  }

  // REPO_AUDIT_2026-08-21 F2 / Phoenix WS1 tail: Better Auth leg. Its own
  // /send-verification-email endpoint already handles "already verified" and
  // "no such user" by silently no-oping (constant-time, no enumeration leak),
  // so we don't duplicate that check here the way the Supabase leg below does.
  if (isBetterAuthPrimary()) {
    const ba = await betterAuthSendVerificationEmail(normalizedEmail);
    if (ba.error) {
      return { error: toFriendlyResendError(ba.error) };
    }
    return { success: true };
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user?.email?.trim().toLowerCase() === normalizedEmail && user.email_confirmed_at) {
      return { error: 'Your email is already verified. You can continue to the app.' };
    }

    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: normalizedEmail,
      options: {
        emailRedirectTo: `${await resolveAuthOrigin()}/callback`,
      },
    });

    if (error) {
      console.error('Error resending verification email:', error);
      return { error: toFriendlyResendError(error.message) };
    }

    return { success: true };
  } catch (error) {
    console.error('Unexpected error resending verification email:', error);
    return { error: 'An unexpected error occurred. Please try again.' };
  }
}
