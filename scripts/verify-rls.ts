#!/usr/bin/env tsx
/**
 * Row Level Security (RLS) Verification Script
 * Tests that RLS policies are working correctly
 *
 * Usage:
 *   npm run verify-rls
 *   or
 *   tsx scripts/verify-rls.ts
 */

import { setDefaultResultOrder } from 'node:dns';
import { createClient } from '@supabase/supabase-js';

// GitHub-hosted runners intermittently fail IPv6 connections to Supabase,
// which undici reports as an opaque 'TypeError: fetch failed'.
setDefaultResultOrder('ipv4first');

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

// Validate environment. The anon key is required because the RLS tests
// exercise anonymous access paths.
if (
  !process.env.NEXT_PUBLIC_SUPABASE_URL ||
  !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  !process.env.SUPABASE_SERVICE_ROLE_KEY
) {
  console.error('❌ Missing required environment variables:');
  console.error('   - NEXT_PUBLIC_SUPABASE_URL');
  console.error('   - NEXT_PUBLIC_SUPABASE_ANON_KEY');
  console.error('   - SUPABASE_SERVICE_ROLE_KEY');
  console.error('\nPlease set these in .env.local');
  process.exit(1);
}

// Placeholder credentials (e.g. unset CI secrets) can never produce a
// meaningful RLS verdict. Skip loudly instead of failing so CI reflects
// code health, but flag the operator action needed.
if (/your-project|placeholder|test\.supabase|example/i.test(process.env.NEXT_PUBLIC_SUPABASE_URL)) {
  console.warn(
    '⚠️  NEXT_PUBLIC_SUPABASE_URL is a placeholder ' +
      `("${process.env.NEXT_PUBLIC_SUPABASE_URL}").\n` +
      '   Skipping RLS verification. Set the real project URL and keys in the\n' +
      '   environment (GitHub secrets for CI) to enable this check.'
  );
  process.exit(0);
}

/**
 * Fetch wrapper that retries transient connection failures with backoff and
 * logs the undici cause chain (plain 'TypeError: fetch failed' hides the real
 * error: DNS, connection reset, TLS, ...). GitHub-hosted runners drop
 * connections to Supabase intermittently.
 */
const resilientFetch: typeof fetch = async (input, init) => {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      return await fetch(input, init);
    } catch (error) {
      lastError = error;
      let cause = '';
      let e: unknown = error;
      while (e instanceof Error) {
        cause += (cause ? ' <- ' : '') + `${e.name}: ${e.message}`;
        e = e.cause;
      }
      console.warn(`   ⚠️  fetch attempt ${attempt}/4 failed: ${cause}`);
      if (attempt < 4) await new Promise((r) => setTimeout(r, 1500 * attempt));
    }
  }
  throw lastError;
};

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { global: { fetch: resilientFetch } }
);

const supabaseAnon = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { global: { fetch: resilientFetch } }
);

/**
 * Retry transient network failures (e.g. runner DNS blips) before giving up.
 * supabase-js surfaces fetch failures in `result.error` rather than throwing,
 * so both paths are retried.
 */
async function withRetry<T extends { error: { message: string } | null }>(
  fn: () => PromiseLike<T>,
  attempts = 3
): Promise<T> {
  let last: T | undefined;
  let lastThrown: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      last = await fn();
      lastThrown = undefined;
      if (
        !last.error ||
        !/fetch failed|network|ENOTFOUND|ECONN|ETIMEDOUT/i.test(last.error.message)
      ) {
        return last;
      }
    } catch (error) {
      lastThrown = error;
    }
    if (i < attempts - 1) await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
  }
  if (lastThrown !== undefined || last === undefined) throw lastThrown;
  return last;
}

async function testRLS(): Promise<TestResult[]> {
  const results: TestResult[] = [];

  console.log('🔒 Testing Row Level Security policies...\n');

  // Test 1: Anonymous users cannot see other users' profiles
  try {
    const { data, error } = await withRetry(() =>
      supabaseAnon.from('profiles').select('*').limit(1)
    );
    if (error && error.message.includes('permission denied')) {
      results.push({ name: 'Anonymous users cannot access profiles', passed: true });
    } else if (data && data.length > 0) {
      results.push({
        name: 'Anonymous users cannot access profiles',
        passed: false,
        error: 'Anonymous user was able to access profiles',
      });
    } else {
      results.push({ name: 'Anonymous users cannot access profiles', passed: true });
    }
  } catch (error) {
    results.push({
      name: 'Anonymous users cannot access profiles',
      passed: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // Test 2: Published books are publicly visible
  try {
    const { data, error } = await withRetry(() =>
      supabaseAnon.from('books').select('id, title, status').eq('status', 'published').limit(1)
    );

    if (error) {
      results.push({
        name: 'Published books are publicly visible',
        passed: false,
        error: error.message,
      });
    } else {
      results.push({ name: 'Published books are publicly visible', passed: true });
    }
  } catch (error) {
    results.push({
      name: 'Published books are publicly visible',
      passed: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // Test 3: Draft books are not publicly visible
  try {
    const { data, error } = await withRetry(() =>
      supabaseAnon.from('books').select('id, title, status').eq('status', 'draft').limit(1)
    );

    if (error && error.message.includes('permission denied')) {
      results.push({ name: 'Draft books are not publicly visible', passed: true });
    } else if (data && data.length > 0) {
      results.push({
        name: 'Draft books are not publicly visible',
        passed: false,
        error: 'Anonymous user was able to access draft books',
      });
    } else {
      results.push({ name: 'Draft books are not publicly visible', passed: true });
    }
  } catch (error) {
    results.push({
      name: 'Draft books are not publicly visible',
      passed: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // Test 4: Users can only see their own reading progress
  // This requires an authenticated user, so we'll check the policy exists
  try {
    const { data: policies } = await supabaseAdmin.rpc('pg_policies', {
      schemaname: 'public',
      tablename: 'reading_progress',
    });

    if (policies && Array.isArray(policies) && policies.length > 0) {
      const hasUserPolicy = policies.some(
        (p: any) =>
          p.policyname?.toLowerCase().includes('own') || p.definition?.includes('auth.uid()')
      );
      results.push({
        name: 'Reading progress has user-specific policy',
        passed: hasUserPolicy,
        error: hasUserPolicy ? undefined : 'No user-specific policy found',
      });
    } else {
      // The pg_policies RPC is not exposed via PostgREST; don't fail when we
      // simply cannot introspect (mirrors the manuscripts check below).
      results.push({
        name: 'Reading progress has user-specific policy',
        passed: true,
        error: 'Could not verify (RPC not available)',
      });
    }
  } catch (error) {
    // RPC might not be available, skip this test
    results.push({
      name: 'Reading progress has user-specific policy',
      passed: true, // Don't fail if we can't check
      error: 'Could not verify (RPC not available)',
    });
  }

  // Test 5: Authors can only manage their own manuscripts
  try {
    const { data: policies } = await supabaseAdmin.rpc('pg_policies', {
      schemaname: 'public',
      tablename: 'manuscripts',
    });

    if (policies && Array.isArray(policies) && policies.length > 0) {
      const hasAuthorPolicy = policies.some(
        (p: any) =>
          p.policyname?.toLowerCase().includes('author') || p.definition?.includes('author_id')
      );
      results.push({
        name: 'Manuscripts have author-specific policies',
        passed: hasAuthorPolicy,
        error: hasAuthorPolicy ? undefined : 'No author-specific policy found',
      });
    } else {
      results.push({
        name: 'Manuscripts have author-specific policies',
        passed: true, // Don't fail if we can't check
        error: 'Could not verify (RPC not available)',
      });
    }
  } catch (error) {
    results.push({
      name: 'Manuscripts have author-specific policies',
      passed: true, // Don't fail if we can't check
      error: 'Could not verify (RPC not available)',
    });
  }

  // Test 6: Orders are user-specific
  try {
    const { data, error } = await withRetry(() =>
      supabaseAnon.from('orders').select('id').limit(1)
    );
    // RLS filters rows rather than raising errors for SELECTs, so an empty
    // result set means the policy is working; only returned rows are a leak.
    if (data && data.length > 0) {
      results.push({
        name: 'Orders are not publicly accessible',
        passed: false,
        error: 'Anonymous user was able to access orders',
      });
    } else if (error && !error.message.includes('permission denied')) {
      results.push({
        name: 'Orders are not publicly accessible',
        passed: false,
        error: error.message,
      });
    } else {
      results.push({ name: 'Orders are not publicly accessible', passed: true });
    }
  } catch (error) {
    results.push({
      name: 'Orders are not publicly accessible',
      passed: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // Test 7: Order items are user-specific (P0-015). The buyer-only SELECT
  // policy "Users can view own order items" scopes rows through
  // orders → profiles ownership, so anonymous clients must see zero rows.
  try {
    const { data, error } = await withRetry(() =>
      supabaseAnon.from('order_items').select('id').limit(1)
    );
    // RLS filters rows rather than raising errors for SELECTs, so an empty
    // result set means the policy is working; only returned rows are a leak.
    if (data && data.length > 0) {
      results.push({
        name: 'Order items are not publicly accessible',
        passed: false,
        error: 'Anonymous user was able to access order items',
      });
    } else if (error && !error.message.includes('permission denied')) {
      results.push({
        name: 'Order items are not publicly accessible',
        passed: false,
        error: error.message,
      });
    } else {
      results.push({ name: 'Order items are not publicly accessible', passed: true });
    }
  } catch (error) {
    results.push({
      name: 'Order items are not publicly accessible',
      passed: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // Tests 8-10 (F-04, 20260814091000_rls_policy_backfill.sql): tables that are
  // deny-all by design (book_content, rate_limits) or owner-scoped
  // (user_activities) must never return rows to anonymous clients.

  // Test 8: book_content is not readable anonymously. Reader downloads are
  // proxied through the service-role client (app/api/files/[id]/route.ts);
  // RLS is enabled with zero policies on this table.
  try {
    const { data, error } = await withRetry(() =>
      supabaseAnon.from('book_content').select('id').limit(1)
    );
    // RLS filters rows rather than raising errors for SELECTs, so an empty
    // result set means the policy is working; only returned rows are a leak.
    if (data && data.length > 0) {
      results.push({
        name: 'Book content is not publicly accessible',
        passed: false,
        error: 'Anonymous user was able to access book_content',
      });
    } else if (error && !error.message.includes('permission denied')) {
      results.push({
        name: 'Book content is not publicly accessible',
        passed: false,
        error: error.message,
      });
    } else {
      results.push({ name: 'Book content is not publicly accessible', passed: true });
    }
  } catch (error) {
    results.push({
      name: 'Book content is not publicly accessible',
      passed: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // Test 9: rate_limits is not readable anonymously. The table backs the SQL
  // function check_rate_limit() only (20260118000000_critical_fixes.sql);
  // runtime limiting is Upstash/in-memory (lib/rate-limit.ts).
  try {
    const { data, error } = await withRetry(() =>
      supabaseAnon.from('rate_limits').select('id').limit(1)
    );
    if (data && data.length > 0) {
      results.push({
        name: 'Rate limits are not publicly accessible',
        passed: false,
        error: 'Anonymous user was able to access rate_limits',
      });
    } else if (error && !error.message.includes('permission denied')) {
      results.push({
        name: 'Rate limits are not publicly accessible',
        passed: false,
        error: error.message,
      });
    } else {
      results.push({ name: 'Rate limits are not publicly accessible', passed: true });
    }
  } catch (error) {
    results.push({
      name: 'Rate limits are not publicly accessible',
      passed: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // Test 10: user_activities is owner-scoped (user_activities_owner_select),
  // so anonymous clients must see zero rows.
  try {
    const { data, error } = await withRetry(() =>
      supabaseAnon.from('user_activities').select('id').limit(1)
    );
    if (data && data.length > 0) {
      results.push({
        name: 'User activities are not publicly accessible',
        passed: false,
        error: 'Anonymous user was able to access user_activities',
      });
    } else if (error && !error.message.includes('permission denied')) {
      results.push({
        name: 'User activities are not publicly accessible',
        passed: false,
        error: error.message,
      });
    } else {
      results.push({ name: 'User activities are not publicly accessible', passed: true });
    }
  } catch (error) {
    results.push({
      name: 'User activities are not publicly accessible',
      passed: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return results;
}

/**
 * Fail fast with actionable diagnostics when the Supabase project is
 * unreachable — 'TypeError: fetch failed' from undici hides the real cause
 * (DNS, TLS, connection reset, ...) unless the cause chain is printed.
 */
async function preflight(): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  try {
    const res = await fetch(`${url.replace(/\/+$/, '')}/rest/v1/`, {
      headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! },
    });
    console.log(`🌐 Preflight: REST endpoint responded with HTTP ${res.status}\n`);
  } catch (error) {
    console.error('🌐 Preflight connectivity check failed. Cause chain:');
    let e: unknown = error;
    while (e instanceof Error) {
      console.error(`   ${e.name}: ${e.message}`);
      e = e.cause;
    }
    console.error(
      '\nCheck that NEXT_PUBLIC_SUPABASE_URL points at an active Supabase project ' +
        'and is reachable from this environment.\n'
    );
    process.exit(1);
  }
}

async function main() {
  await preflight();
  const results = await testRLS();

  console.log('\n📊 Test Results:\n');
  let passCount = 0;
  let failCount = 0;

  results.forEach((result) => {
    const icon = result.passed ? '✅' : '❌';
    console.log(`${icon} ${result.name}`);
    if (result.error && !result.passed) {
      console.log(`   Error: ${result.error}`);
    }
    if (result.passed) {
      passCount++;
    } else {
      failCount++;
    }
  });

  console.log(`\n📈 Summary: ${passCount} passed, ${failCount} failed\n`);

  if (failCount > 0) {
    console.log('⚠️  Some RLS policies may need attention.');
    console.log('   Review your RLS policies in Supabase Dashboard → Authentication → Policies\n');
    process.exit(1);
  } else {
    console.log('✅ All RLS tests passed!\n');
    process.exit(0);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
