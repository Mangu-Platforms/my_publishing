'use server';

import { revalidatePath } from 'next/cache';
import { betterAuthSignUp } from '@/lib/auth/better-auth-actions';
import { isBetterAuthPrimary } from '@/lib/auth/provider';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@/lib/supabase/admin';
import { authRateLimitCheck, getAuthIdentifier } from '@/lib/utils/auth-rate-limit';
import { toFriendlyRegisterError } from '@/lib/auth/register-errors';
import { normalizeAuthErrorMessage, redactAuthDiagnostic } from '@/lib/auth/error-messages';
import { resolveAuthOriginFromHeaders } from '@/lib/auth/origin';
import { PASSWORD_MIN_LENGTH, PASSWORD_MIN_MESSAGE_LONG } from '@/lib/auth/password-policy';
import { sendWelcomeEmail } from '@/lib/email/messages';
import { headers } from 'next/headers';

/**
 * Task 1.9: verification deep links are built from the CONFIGURED origin.
 * The previous implementation trusted `x-forwarded-host` first, so a forged
 * host header could steer `emailRedirectTo` at a host we do not control.
 */
async function resolveAuthOrigin() {
  return resolveAuthOriginFromHeaders(await headers());
}

export async function registerUser(formData: FormData) {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;
  const fullName = formData.get('fullName') as string;

  const normalizedEmail = email ? email.trim().toLowerCase() : '';

  // Rate limiting
  const headersList = await headers();
  const ip = headersList.get('x-forwarded-for') || headersList.get('x-real-ip') || null;
  const identifier = getAuthIdentifier(ip, normalizedEmail);

  const rate = await authRateLimitCheck(identifier);
  if (!rate.success) {
    if (rate.reason === 'unavailable') {
      console.error(
        '[auth] Rate limiter unavailable — registration blocked for ALL users. ' +
          'Check UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN in this environment.'
      );
      return {
        error: 'Registration is temporarily unavailable. Please try again in a few minutes.',
      };
    }
    return { error: 'Too many registration attempts. Please try again in 15 minutes.' };
  }

  // Validate inputs
  if (!email || !password || !fullName) {
    return { error: 'All fields are required' };
  }

  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(normalizedEmail)) {
    return { error: 'Please enter a valid email address' };
  }

  if (password.length < PASSWORD_MIN_LENGTH) {
    return { error: PASSWORD_MIN_MESSAGE_LONG };
  }

  if (fullName.trim().length < 2) {
    return { error: 'Full name must be at least 2 characters long' };
  }

  if (isBetterAuthPrimary()) {
    // Length already enforced above from the single policy source.
    const ba = await betterAuthSignUp({
      email: normalizedEmail,
      password,
      name: fullName.trim(),
    });
    if (ba.error) {
      return { error: toFriendlyRegisterError(normalizeAuthErrorMessage(ba.error)) };
    }
    try {
      await sendWelcomeEmail({ to: normalizedEmail, userName: fullName.trim() });
    } catch (welcomeError) {
      console.error('Welcome email failed (registration unaffected):', welcomeError);
    }
    return {
      success: true,
      needsVerification: true,
      verificationEmail: normalizedEmail,
    };
  }

  try {
    const supabase = await createClient();

    // Check if profiles table exists by attempting a simple query
    const { error: tableCheckError } = await supabase.from('profiles').select('id').limit(1);

    if (tableCheckError) {
      if (tableCheckError.message.includes('relation "profiles" does not exist')) {
        return {
          error:
            'Database not set up. Please run migrations first. See README.md for migration instructions.',
        };
      }
      // Other database errors
      console.error('Database error during registration:', tableCheckError);
      return {
        error: 'Database connection error. Please check your configuration and try again.',
      };
    }

    // Create auth user with metadata for profile creation trigger
    // The trigger will automatically create the profile
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        emailRedirectTo: `${await resolveAuthOrigin()}/callback`,
        data: {
          full_name: fullName.trim(),
          name: fullName.trim(), // Some OAuth providers use 'name'
          role: 'reader',
        },
      },
    });

    if (authError) {
      console.error('[auth] Supabase sign-up rejected:', redactAuthDiagnostic(authError));
      return { error: toFriendlyRegisterError(normalizeAuthErrorMessage(authError)) };
    }

    if (!authData.user) {
      return { error: 'Failed to create user account. Please try again.' };
    }

    // When Supabase requires email confirmation there is no session yet, so
    // the browser gets no auth cookies — surface that to the client.
    const needsVerification = !authData.session;

    // Profile will be created automatically by the trigger
    // Verify it was created (with a small delay to allow trigger to run)
    await new Promise((resolve) => setTimeout(resolve, 500));

    const { data: profile, error: profileCheckError } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', authData.user.id)
      .single();

    if (profileCheckError || !profile) {
      console.warn('Profile not created by trigger, attempting manual creation...');
      // Fallback: use admin client to bypass RLS (session client has no auth when
      // email confirmation is required and authData.session is null).
      const admin = createAdminClient();
      const { error: profileError } = await admin.from('profiles').insert({
        user_id: authData.user.id,
        email: normalizedEmail,
        full_name: fullName.trim(),
        role: 'reader',
        subscription_tier: 'free',
      });

      if (profileError && !profileError.message.includes('duplicate key')) {
        // A.6 (Task 1.9): this used to be swallowed with "user can complete
        // setup later", which produced auth users with no profile row and
        // therefore no role — they silently lost every role-gated surface.
        // Surface it instead. The auth user already exists, so the copy tells
        // the user their account was created but setup did not finish.
        console.error(
          '[auth] Profile creation failed after sign-up:',
          redactAuthDiagnostic(profileError)
        );
        return {
          error:
            'Your account was created, but we could not finish setting up your profile. ' +
            'Please try signing in — if the problem continues, contact us from the Contact page.',
          profileSetupFailed: true,
        };
      }
    }

    // Welcome email (feat/topdog-comms): best-effort, no-ops when RESEND_API_KEY
    // is absent, and never fails registration.
    try {
      await sendWelcomeEmail({ to: normalizedEmail, userName: fullName.trim() });
    } catch (welcomeError) {
      console.error('Welcome email failed (registration unaffected):', welcomeError);
    }

    revalidatePath('/', 'layout');

    return {
      success: true,
      needsVerification,
      verificationEmail: needsVerification ? normalizedEmail : undefined,
    };
  } catch (error) {
    console.error('[auth] Unexpected error during registration:', redactAuthDiagnostic(error));
    return { error: 'An unexpected error occurred. Please try again.' };
  }
}
