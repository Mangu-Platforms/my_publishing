export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Fail fast at production boot when launch-critical environment is missing.
    // Validation previously only ran for `next dev` (audit finding F6); F-03
    // widens the boot contract from the Supabase trio to the full production
    // set enforced by scripts/validate-env.ts --production.
    // The build phase is exempt: `next build` runs with NODE_ENV=production
    // but may legitimately lack the full contract (CI builds with dummy env);
    // build-time enforcement is scripts/prebuild-env-gate.js instead.
    if (
      process.env.NODE_ENV === 'production' &&
      process.env.NEXT_PHASE !== 'phase-production-build'
    ) {
      // Keep in sync with the required list in scripts/validate-env.ts (F-03).
      const LAUNCH_CRITICAL = [
        'NEXT_PUBLIC_SUPABASE_URL',
        'NEXT_PUBLIC_SUPABASE_ANON_KEY',
        'SUPABASE_SERVICE_ROLE_KEY',
        'MONGODB_URI',
        'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
        'STRIPE_SECRET_KEY',
        'STRIPE_WEBHOOK_SECRET',
        'NEXT_PUBLIC_SITE_URL',
        'UPSTASH_REDIS_REST_URL',
        'UPSTASH_REDIS_REST_TOKEN',
      ] as const;
      const missing = LAUNCH_CRITICAL.filter((name) => !process.env[name]);
      if (missing.length > 0) {
        throw new Error(
          `Missing launch-critical environment variables: ${missing.join(', ')}. ` +
            'Refusing to boot — see .env.production.example and scripts/validate-env.ts.'
        );
      }

      // Non-fatal surface: log validator warnings (format issues, optional
      // integrations) without taking down an otherwise functional deployment.
      const { validateEnvironment, printValidationResults } =
        await import('./lib/utils/env-validation');
      const result = validateEnvironment();
      if (result.warnings.length > 0) {
        printValidationResults(result);
      }
    }

    await import('./sentry.server.config');
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}
