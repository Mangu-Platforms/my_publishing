/**
 * Environment Variable Validation
 * Validates required environment variables at startup
 */

interface EnvValidationResult {
  valid: boolean;
  missing: string[];
  warnings: string[];
}

interface EnvConfig {
  name: string;
  required: boolean;
  /**
   * Required for launch, but may be omitted when USE_MOCKS=true
   * (local dev / CI without live Stripe or Upstash credentials). Fix C9.
   */
  requiredUnlessMocks?: boolean;
  description: string;
  validate?: (value: string) => boolean | string;
}

const envConfigs: EnvConfig[] = [
  {
    name: 'NEXT_PUBLIC_SUPABASE_URL',
    required: true,
    description: 'Supabase project URL',
    validate: (value) => {
      if (!value.startsWith('https://') || !value.includes('.supabase.co')) {
        return 'Must be a valid Supabase URL (https://*.supabase.co)';
      }
      return true;
    },
  },
  {
    name: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    required: true,
    description: 'Supabase anonymous key',
    validate: (value) => {
      if (value.length < 20) {
        return 'Supabase anon key appears invalid';
      }
      return true;
    },
  },
  {
    name: 'SUPABASE_SERVICE_ROLE_KEY',
    required: true,
    description: 'Supabase service role key (for admin operations)',
    validate: (value) => {
      if (value.length < 20) {
        return 'Supabase service role key appears invalid';
      }
      return true;
    },
  },
  {
    name: 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
    required: false,
    requiredUnlessMocks: true,
    description: 'Stripe publishable key (required for payments)',
    validate: (value) => {
      if (value && !value.startsWith('pk_')) {
        return 'Stripe publishable key must start with pk_';
      }
      return true;
    },
  },
  {
    name: 'STRIPE_SECRET_KEY',
    required: false,
    requiredUnlessMocks: true,
    description: 'Stripe secret key (required for payments)',
    validate: (value) => {
      if (value && !value.startsWith('sk_')) {
        return 'Stripe secret key must start with sk_';
      }
      return true;
    },
  },
  {
    name: 'STRIPE_WEBHOOK_SECRET',
    required: false,
    description: 'Stripe webhook secret (required for webhook verification)',
    validate: (value) => {
      if (value && !value.startsWith('whsec_')) {
        return 'Stripe webhook secret must start with whsec_';
      }
      return true;
    },
  },
  {
    name: 'OPENAI_API_KEY',
    required: false,
    description: 'OpenAI API key (required for AI recommendations)',
    validate: (value) => {
      if (value && !value.startsWith('sk-')) {
        return 'OpenAI API key must start with sk-';
      }
      return true;
    },
  },
  {
    name: 'RESEND_API_KEY',
    required: false,
    description: 'Resend API key (required for sending emails)',
    validate: (value) => {
      if (value && !value.startsWith('re_')) {
        return 'Resend API key must start with re_';
      }
      return true;
    },
  },
  {
    name: 'UPSTASH_REDIS_REST_URL',
    required: false,
    requiredUnlessMocks: true,
    description: 'Upstash Redis REST URL (required for distributed rate limiting)',
    validate: (value) => {
      if (value && !value.startsWith('https://')) {
        return 'Upstash REST URL must start with https://';
      }
      return true;
    },
  },
  {
    name: 'UPSTASH_REDIS_REST_TOKEN',
    required: false,
    requiredUnlessMocks: true,
    description: 'Upstash Redis REST token (required for distributed rate limiting)',
    validate: (value) => {
      if (value && value.length < 10) {
        return 'Upstash REST token appears invalid';
      }
      return true;
    },
  },
  {
    name: 'NEXT_PUBLIC_SITE_URL',
    required: false,
    description: 'Base URL of the application',
    validate: (value) => {
      if (value && !value.match(/^https?:\/\//)) {
        return 'Site URL must start with http:// or https://';
      }
      return true;
    },
  },
  {
    name: 'MONGODB_URI',
    required: false,
    description:
      'MongoDB Atlas connection string (ADR-002; optional until Supabase cutover). Format: mongodb+srv://...)',
    validate: (value) => {
      if (!value.startsWith('mongodb://') && !value.startsWith('mongodb+srv://')) {
        return 'Must start with mongodb:// or mongodb+srv://';
      }
      if (value.includes('<password>') || value.includes('<db_password>')) {
        return 'Replace <password> with the Atlas database user password';
      }
      return true;
    },
  },
  {
    name: 'MONGODB_DB',
    required: false,
    description: 'MongoDB database name (default: mangu)',
  },
  {
    name: 'AUTH_PROVIDER',
    required: false,
    description: 'Auth provider switch: supabase (default/public) or better-auth (Phoenix cutover)',
    validate: (value) => {
      const normalized = value.toLowerCase();
      if (!['supabase', 'better-auth', 'betterauth', 'ba'].includes(normalized)) {
        return 'Must be supabase or better-auth';
      }
      return true;
    },
  },
  {
    name: 'BETTER_AUTH_SECRET',
    required: false,
    description: 'Better Auth signing secret (required when AUTH_PROVIDER=better-auth)',
    validate: (value) => {
      if (value.length < 32) {
        return 'Must be at least 32 characters';
      }
      return true;
    },
  },
  {
    name: 'BETTER_AUTH_URL',
    required: false,
    description: 'Better Auth base URL (usually same as NEXT_PUBLIC_SITE_URL)',
    validate: (value) => {
      if (value && !value.match(/^https?:\/\//)) {
        return 'BETTER_AUTH_URL must start with http:// or https://';
      }
      return true;
    },
  },
  {
    name: 'NEXT_PUBLIC_SENTRY_DSN',
    required: false,
    description: 'Sentry DSN for client and server error tracking (optional)',
    validate: (value) => {
      if (value && !value.startsWith('https://')) {
        return 'Sentry DSN must be an https:// ingest URL';
      }
      return true;
    },
  },
  {
    name: 'SENTRY_DSN',
    required: false,
    description: 'Server-only Sentry DSN (optional; defaults to NEXT_PUBLIC_SENTRY_DSN)',
  },
  // Phoenix WS3 — Vercel Blob
  {
    name: 'BLOB_READ_WRITE_TOKEN',
    required: false,
    description: 'Vercel Blob read/write token (required when STORAGE_PROVIDER=vercel-blob)',
    validate: (value) => {
      if (value && value.length < 20) {
        return 'BLOB_READ_WRITE_TOKEN appears too short';
      }
      return true;
    },
  },
  {
    name: 'STORAGE_PROVIDER',
    required: false,
    description: 'Storage provider: supabase (default) or vercel-blob (Phoenix WS3)',
    validate: (value) => {
      if (!['supabase', 'vercel-blob', 'blob'].includes(value.toLowerCase())) {
        return 'Must be supabase or vercel-blob';
      }
      return true;
    },
  },
  {
    name: 'DATABASE_PROVIDER',
    required: false,
    description: 'Database provider: supabase (default) or mongodb (Phoenix cutover)',
    validate: (value) => {
      if (!['supabase', 'mongodb', 'mongo'].includes(value.toLowerCase())) {
        return 'Must be supabase or mongodb';
      }
      return true;
    },
  },
];

/**
 * Validate all environment variables
 */
export function validateEnvironment(): EnvValidationResult {
  const missing: string[] = [];
  const warnings: string[] = [];
  const mocksEnabled = process.env.USE_MOCKS === 'true';

  for (const config of envConfigs) {
    const value = process.env[config.name];
    const isRequired = config.required || (config.requiredUnlessMocks === true && !mocksEnabled);

    if (isRequired && !value) {
      missing.push(config.name);
      continue;
    }

    if (value && config.validate) {
      const validationResult = config.validate(value);
      if (validationResult !== true) {
        warnings.push(`${config.name}: ${validationResult}`);
      }
    }
  }

  // Phoenix dual-run: Better Auth secrets required when that provider is active.
  const authProvider = (process.env.AUTH_PROVIDER || 'supabase').toLowerCase();
  if (authProvider === 'better-auth' || authProvider === 'betterauth' || authProvider === 'ba') {
    if (!process.env.BETTER_AUTH_SECRET || process.env.BETTER_AUTH_SECRET.length < 32) {
      missing.push('BETTER_AUTH_SECRET');
    }
    if (!process.env.BETTER_AUTH_URL && !process.env.NEXT_PUBLIC_SITE_URL) {
      missing.push('BETTER_AUTH_URL');
    }
    if (!process.env.MONGODB_URI) {
      missing.push('MONGODB_URI');
    }
  }

  // Check for Stripe configuration completeness
  const hasStripePublishable = !!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  const hasStripeSecret = !!process.env.STRIPE_SECRET_KEY;
  const hasStripeWebhook = !!process.env.STRIPE_WEBHOOK_SECRET;

  if (hasStripePublishable || hasStripeSecret || hasStripeWebhook) {
    if (!hasStripePublishable) {
      warnings.push('Stripe publishable key missing (required if using Stripe)');
    }
    if (!hasStripeSecret) {
      warnings.push('Stripe secret key missing (required if using Stripe)');
    }
    if (!hasStripeWebhook) {
      warnings.push('Stripe webhook secret missing (required for webhook verification)');
    }
  }

  const hasUpstashUrl = !!process.env.UPSTASH_REDIS_REST_URL;
  const hasUpstashToken = !!process.env.UPSTASH_REDIS_REST_TOKEN;
  if (hasUpstashUrl !== hasUpstashToken) {
    warnings.push(
      'Upstash rate limiting requires both UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN'
    );
  } else if (
    !hasUpstashUrl &&
    process.env.NODE_ENV === 'production' &&
    process.env.USE_MOCKS !== 'true'
  ) {
    warnings.push(
      'Upstash Redis not configured — distributed rate limiting disabled in production'
    );
  }

  // Phoenix WS3: Blob token required when storage provider is vercel-blob.
  const storageProvider = (process.env.STORAGE_PROVIDER || 'supabase').toLowerCase();
  if (storageProvider === 'vercel-blob' || storageProvider === 'blob') {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      missing.push('BLOB_READ_WRITE_TOKEN');
    }
  }

  // ADR-002: Mongo is additive until cutover; warn in production if unset.
  if (
    !process.env.MONGODB_URI &&
    process.env.NODE_ENV === 'production' &&
    process.env.USE_MOCKS !== 'true'
  ) {
    warnings.push(
      'MONGODB_URI not set — MongoDB Atlas not connected (ADR-002 migration in progress; Supabase still required)'
    );
  }

  return {
    valid: missing.length === 0,
    missing,
    warnings,
  };
}

/**
 * Get environment variable with validation
 */
export function getEnvVar(name: string, defaultValue?: string): string {
  const value = process.env[name] || defaultValue;

  if (!value) {
    throw new Error(`Environment variable ${name} is not set`);
  }

  return value;
}

/**
 * Check if running in development mode
 */
export function isDevelopment(): boolean {
  return process.env.NODE_ENV === 'development';
}

/**
 * Check if mock mode is enabled
 */
export function useMocks(): boolean {
  return (
    process.env.USE_MOCKS === 'true' || (isDevelopment() && !process.env.NEXT_PUBLIC_SUPABASE_URL)
  );
}

/**
 * Check if emails should be skipped
 */
export function skipEmails(): boolean {
  return process.env.SKIP_EMAILS === 'true' || (isDevelopment() && !process.env.RESEND_API_KEY);
}

/**
 * Print environment validation results (for CLI usage)
 */
export function printValidationResults(result: EnvValidationResult): void {
  if (result.valid && result.warnings.length === 0) {
    console.log('✅ All environment variables are valid');
    return;
  }

  if (result.missing.length > 0) {
    console.error('\n❌ Missing required environment variables:');
    result.missing.forEach((name) => {
      const config = envConfigs.find((c) => c.name === name);
      console.error(`   - ${name}: ${config?.description || 'Required'}`);
    });
  }

  if (result.warnings.length > 0) {
    console.warn('\n⚠️  Environment variable warnings:');
    result.warnings.forEach((warning) => {
      console.warn(`   - ${warning}`);
    });
  }
}
