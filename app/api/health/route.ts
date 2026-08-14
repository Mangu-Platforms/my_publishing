/**
 * Health Check API
 * Production health and readiness endpoints
 *
 * This endpoint validates:
 * - Environment variables are configured
 * - Supabase database connection (requires 'profiles' table from migrations)
 * - Supabase auth service availability
 * - MongoDB Atlas ping when MONGODB_URI is set (ADR-002; additive until cutover)
 *
 * Disclosure policy (F-09):
 * - In production, unauthenticated callers receive a minimal
 *   { status: 'ok' | 'degraded' } body; readiness is conveyed by the HTTP status
 *   code alone. Full per-subsystem diagnostics require an admin session
 *   (isAdmin from lib/middleware/auth) or an x-health-token request header
 *   matching HEALTH_CHECK_TOKEN.
 * - HEALTH_CHECK_TOKEN (OPTIONAL env var; intentionally not part of required
 *   env validation): shared secret for external monitors that need full
 *   diagnostics without a session. When unset, header access is disabled and
 *   only admin sessions see detail.
 * - Non-production environments always return full detail.
 *
 * Migration Order (apply in this sequence):
 * 1. 20260116000000_initial_schema.sql - Creates profiles table and core schema
 * 2. 20260117000000_analytics_events.sql - Analytics tracking
 * 3. 20260117000006_storage_policies.sql - Storage bucket policies
 * 4. 20260117000001_analytics_sessions.sql - Session tracking
 * 5. 20260117000002_book_stats_materialized.sql - Materialized views
 * 6. 20260117000003_revenue_tracking.sql - Revenue tables
 * 7. 20260117000004_author_payouts.sql - Payout system
 * 8. 20260117000005_book_pricing.sql - Pricing logic
 * 9. 20260118000000_critical_fixes.sql - Bug fixes
 * 10. 20260120000006_performance_optimizations.sql - Performance indexes
 * 11. 20260121000000_profile_trigger.sql - Profile trigger consistency
 * 12. 20260122000000_social_features.sql - Social feature tables
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isMongoConfigured } from '@/lib/mongodb-config';
import { pingMongo } from '@/lib/mongodb';
import { isMongoPrimary } from '@/lib/db/provider';
import { validateEnvironment } from '@/lib/utils/env-validation';
import { isAdmin } from '@/lib/middleware/auth';

// PHASE-7 — Health/readiness probes must never be statically cached.
export const dynamic = 'force-dynamic';

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  ready: boolean;
  probe: 'readiness';
  timestamp: string;
  uptime_seconds: number;
  version: string;
  checks: {
    environment: CheckResult;
    database: CheckResult;
    auth: CheckResult;
    migrations?: CheckResult;
    stripe?: CheckResult;
    mongodb?: CheckResult;
  };
}

interface CheckResult {
  status: 'pass' | 'fail' | 'warn';
  latency_ms?: number;
  message?: string;
}

const startTime = Date.now();

// PHASE-7 — Health responses must never be cached by browsers, CDNs, or
// load-balancer probe infrastructure.
const NO_STORE_HEADERS = { 'Cache-Control': 'no-store, max-age=0' };

// F-09 — In production, per-subsystem messages (missing tables, provider
// misconfiguration, latency figures) are a reconnaissance surface. Full
// diagnostics are gated behind an admin session or a shared monitoring token
// (x-health-token === HEALTH_CHECK_TOKEN, when set). Non-production always
// returns full detail for local debugging.
async function canViewDiagnostics(request: Request): Promise<boolean> {
  if (process.env.NODE_ENV !== 'production') {
    return true;
  }

  const healthToken = process.env.HEALTH_CHECK_TOKEN;
  if (healthToken && request.headers.get('x-health-token') === healthToken) {
    return true;
  }

  return isAdmin();
}

function healthResponse(
  health: HealthStatus,
  httpStatus: number,
  showDetail: boolean
): NextResponse {
  if (showDetail) {
    return NextResponse.json(health, { status: httpStatus, headers: NO_STORE_HEADERS });
  }
  // Minimal disclosure (F-09): status word + HTTP status code only.
  return NextResponse.json(
    { status: health.status === 'healthy' ? 'ok' : 'degraded' },
    { status: httpStatus, headers: NO_STORE_HEADERS }
  );
}

function checkEnvironment(): CheckResult {
  const validation = validateEnvironment();

  if (!validation.valid) {
    return {
      status: 'fail',
      message: `Missing required environment variables: ${validation.missing.join(', ')}. See .env.local.example for setup instructions.`,
    };
  }

  if (validation.warnings.length > 0) {
    return {
      status: 'warn',
      message: `Environment warnings: ${validation.warnings.join('; ')}`,
    };
  }

  return { status: 'pass' };
}

async function checkDatabase(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<CheckResult> {
  const start = Date.now();
  try {
    const { error } = await supabase.from('profiles').select('id').limit(1);
    const latency = Date.now() - start;

    if (error) {
      // Provide helpful error messages for common issues
      if (error.message.includes('relation "profiles" does not exist')) {
        return {
          status: 'fail',
          latency_ms: latency,
          message:
            'Database migrations not applied. The "profiles" table is missing. Run migrations in order (see migration comments in this file).',
        };
      }
      if (error.message.includes('permission denied')) {
        return {
          status: 'fail',
          latency_ms: latency,
          message:
            'Database permissions issue. Check Row Level Security (RLS) policies and service role key configuration.',
        };
      }
      return { status: 'fail', latency_ms: latency, message: error.message };
    }

    return { status: latency > 1000 ? 'warn' : 'pass', latency_ms: latency };
  } catch (error) {
    const latency = Date.now() - start;
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Check for common connection errors
    if (errorMessage.includes('fetch failed') || errorMessage.includes('ECONNREFUSED')) {
      return {
        status: 'fail',
        latency_ms: latency,
        message:
          'Cannot connect to Supabase. Check NEXT_PUBLIC_SUPABASE_URL and network connectivity.',
      };
    }

    return { status: 'fail', latency_ms: latency, message: errorMessage };
  }
}

async function checkAuth(supabase: Awaited<ReturnType<typeof createClient>>): Promise<CheckResult> {
  const start = Date.now();
  try {
    const { error } = await supabase.auth.getSession();
    const latency = Date.now() - start;

    if (error) {
      // Provide helpful error messages
      if (error.message.includes('Invalid API key')) {
        return {
          status: 'fail',
          latency_ms: latency,
          message: 'Invalid Supabase API key. Check NEXT_PUBLIC_SUPABASE_ANON_KEY configuration.',
        };
      }
      return { status: 'fail', latency_ms: latency, message: error.message };
    }

    return { status: latency > 500 ? 'warn' : 'pass', latency_ms: latency };
  } catch (error) {
    const latency = Date.now() - start;
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (errorMessage.includes('fetch failed') || errorMessage.includes('ECONNREFUSED')) {
      return {
        status: 'fail',
        latency_ms: latency,
        message: 'Cannot connect to Supabase Auth service. Check NEXT_PUBLIC_SUPABASE_URL.',
      };
    }

    return { status: 'fail', latency_ms: latency, message: errorMessage };
  }
}

async function checkMongo(): Promise<CheckResult> {
  if (!isMongoConfigured()) {
    return {
      status: 'warn',
      message: 'MONGODB_URI not set (ADR-002 migration; Supabase still owns readiness)',
    };
  }

  const result = await pingMongo();
  if (!result.ok) {
    return {
      status: 'fail',
      latency_ms: result.latency_ms,
      message: result.message || 'MongoDB ping failed',
    };
  }

  return {
    status: result.latency_ms > 1000 ? 'warn' : 'pass',
    latency_ms: result.latency_ms,
    message: result.message,
  };
}

// PHASE-7 — Config-only Stripe readiness check. The readiness probe must never
// call the live Stripe API: a Stripe outage or network blip must not flap
// deploys. Stripe is optional for core serving, so this check can at most
// degrade readiness — it never reports 'fail'.
function checkStripe(): CheckResult {
  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (secretKey && secretKey.startsWith('sk_')) {
    return {
      status: 'pass',
      message: 'Stripe configured (config-only check; no live API call)',
    };
  }

  return {
    status: 'warn',
    message: 'Stripe not_configured (payments will not work)',
  };
}

async function checkMigrations(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<CheckResult> {
  const start = Date.now();

  // Key tables that should exist after migrations
  const requiredTables = ['profiles', 'books', 'authors'];

  // Optional tables (may not exist if some migrations haven't run)
  const optionalTables = ['orders', 'analytics_events', 'reading_sessions'];

  try {
    const missingRequired: string[] = [];
    const missingOptional: string[] = [];

    // Check required tables
    const requiredChecks = await Promise.all(
      requiredTables.map(async (table) => {
        const { error } = await supabase.from(table).select('id').limit(1);
        return { table, error };
      })
    );

    const requiredErrors = requiredChecks.filter(({ error }) => error);

    for (const { table, error } of requiredChecks) {
      if (error?.message.includes('does not exist')) {
        missingRequired.push(table);
      }
    }

    // Check optional tables
    const optionalChecks = await Promise.all(
      optionalTables.map(async (table) => {
        const { error } = await supabase.from(table).select('id').limit(1);
        return { table, error };
      })
    );

    for (const { table, error } of optionalChecks) {
      if (error && error.message.includes('does not exist')) {
        missingOptional.push(table);
      }
    }

    const latency = Date.now() - start;

    if (requiredErrors.length > 0 && missingRequired.length === 0) {
      return {
        status: 'fail',
        latency_ms: latency,
        message: `Required table checks failed: ${requiredErrors
          .map(({ table, error }) => `${table}: ${error?.message}`)
          .join('; ')}`,
      };
    }

    if (missingRequired.length > 0) {
      return {
        status: 'fail',
        latency_ms: latency,
        message: `Missing required tables: ${missingRequired.join(', ')}. Run database migrations. See docs/MIGRATIONS.md for instructions.`,
      };
    }

    if (missingOptional.length > 0) {
      return {
        status: 'warn',
        latency_ms: latency,
        message: `Some optional tables are missing: ${missingOptional.join(', ')}. Consider running additional migrations.`,
      };
    }

    return { status: 'pass', latency_ms: latency };
  } catch (error) {
    const latency = Date.now() - start;
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      status: 'warn',
      latency_ms: latency,
      message: `Could not verify migrations: ${errorMessage}`,
    };
  }
}

export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const readyProbe = searchParams.get('ready') === '1';
  const showDetail = await canViewDiagnostics(request);

  // Lightweight probe for load balancers / smoke tests (always 200 if process is up).
  if (!readyProbe) {
    if (!showDetail) {
      return NextResponse.json({ status: 'ok' }, { status: 200, headers: NO_STORE_HEADERS });
    }
    return NextResponse.json(
      {
        status: 'ok',
        probe: 'startup',
        timestamp: new Date().toISOString(),
        uptime_seconds: Math.floor((Date.now() - startTime) / 1000),
      },
      { status: 200, headers: NO_STORE_HEADERS }
    );
  }

  // Full readiness probe (?ready=1) — dependency checks below.
  // First check environment variables before attempting connections
  const envCheck = checkEnvironment();

  // If environment is not configured, return early with helpful message
  if (envCheck.status === 'fail') {
    const health: HealthStatus = {
      status: 'unhealthy',
      ready: false,
      probe: 'readiness',
      timestamp: new Date().toISOString(),
      uptime_seconds: Math.floor((Date.now() - startTime) / 1000),
      version: process.env.npm_package_version || '1.0.0',
      checks: {
        environment: envCheck,
        database: { status: 'fail', message: 'Skipped - environment not configured' },
        auth: { status: 'fail', message: 'Skipped - environment not configured' },
        migrations: { status: 'fail', message: 'Skipped - environment not configured' },
      },
    };
    return healthResponse(health, 503, showDetail);
  }

  const mongoPrimary = isMongoPrimary();

  // Proceed with connection checks
  let supabase: Awaited<ReturnType<typeof createClient>> | null = null;
  let supabaseClientError: string | null = null;
  try {
    supabase = await createClient();
  } catch (error) {
    supabaseClientError = error instanceof Error ? error.message : String(error);
    if (!mongoPrimary) {
      const health: HealthStatus = {
        status: 'unhealthy',
        ready: false,
        probe: 'readiness',
        timestamp: new Date().toISOString(),
        uptime_seconds: Math.floor((Date.now() - startTime) / 1000),
        version: process.env.npm_package_version || '1.0.0',
        checks: {
          environment: envCheck,
          database: {
            status: 'fail',
            message: `Failed to create Supabase client: ${supabaseClientError}`,
          },
          auth: {
            status: 'fail',
            message: `Failed to create Supabase client: ${supabaseClientError}`,
          },
          migrations: {
            status: 'fail',
            message: `Failed to create Supabase client: ${supabaseClientError}`,
          },
          stripe: { status: 'warn', message: 'Skipped - Supabase connection failed' },
        },
      };
      return healthResponse(health, 503, showDetail);
    }
  }

  const skippedSupabase: CheckResult = {
    status: 'warn',
    message: supabaseClientError
      ? `Supabase client unavailable during Mongo primary cutover: ${supabaseClientError}`
      : 'Skipped — DATABASE_PROVIDER=mongodb',
  };

  const [dbCheck, authCheck, migrationsCheck, stripeCheck, mongoCheck] = await Promise.all([
    supabase ? checkDatabase(supabase) : Promise.resolve(skippedSupabase),
    supabase ? checkAuth(supabase) : Promise.resolve(skippedSupabase),
    supabase ? checkMigrations(supabase) : Promise.resolve(skippedSupabase),
    checkStripe(),
    checkMongo(),
  ]);

  const allPassing =
    envCheck.status === 'pass' &&
    dbCheck.status === 'pass' &&
    authCheck.status === 'pass' &&
    migrationsCheck.status === 'pass' &&
    stripeCheck.status === 'pass' &&
    mongoCheck.status === 'pass';

  // Mongo primary: Atlas ping is a hard readiness gate. Supabase fails become non-blocking.
  // Supabase primary: legacy gates; Mongo fail is reported but non-blocking.
  const anyFailing = mongoPrimary
    ? mongoCheck.status === 'fail'
    : dbCheck.status === 'fail' || authCheck.status === 'fail' || migrationsCheck.status === 'fail';

  const health: HealthStatus = {
    status: anyFailing ? 'unhealthy' : allPassing ? 'healthy' : 'degraded',
    ready: !anyFailing,
    probe: 'readiness',
    timestamp: new Date().toISOString(),
    uptime_seconds: Math.floor((Date.now() - startTime) / 1000),
    version: process.env.npm_package_version || '1.0.0',
    checks: {
      environment: envCheck,
      database: dbCheck,
      auth: authCheck,
      migrations: migrationsCheck,
      stripe: stripeCheck,
      mongodb: mongoCheck,
    },
  };

  return healthResponse(health, anyFailing ? 503 : 200, showDetail);
}
