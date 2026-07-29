#!/usr/bin/env tsx
/**
 * Daily production health monitor — network runner (Task 0.4).
 *
 * This is the deterministic, testable implementation of the scheduled monitor
 * `mangu-site-health-check` (07:30 America/New_York). All evaluation and alert
 * formatting lives in `scripts/lib/site-health.ts` and is unit-tested in
 * `tests/unit/site-health.test.ts`.
 *
 * Checks
 *   1. Homepage                                        (pre-existing)
 *   2. /api/books returns JSON with "success": true     (pre-existing)
 *   3. Book detail canary page                          (pre-existing)
 *   4. /login raw HTML contains "Welcome back"          (NEW — server render)
 *   5. Supabase auth health for the CURRENT project     (NEW — uncacheable)
 *   6. /checkout returns non-5xx                        (NEW — advisory, opt-in)
 *
 * The Supabase project ref is NEVER hardcoded: it is derived at runtime from
 * NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL). Check 5 is skipped with a notice
 * when that variable is absent. No key material is ever printed — the anon key
 * is sent as a request header only, and every body excerpt is redacted.
 *
 * Usage:
 *   npm run health:check
 *   npm run health:check -- --base-url https://staging.example.com
 *   npm run health:check -- --with-checkout
 *   npm run health:check -- --json
 *   npm run health:check -- --simulate-failure            # all checks fail
 *   npm run health:check -- --simulate-failure=login-render
 *
 * Exit codes: 0 = healthy (or advisory warnings only), 1 = alert raised.
 */

import {
  buildAlert,
  buildCheckSpecs,
  DEFAULT_BASE_URL,
  evaluateCheck,
  projectRefFromSupabaseUrl,
  maskProjectRef,
  renderAlert,
  simulatedFailureProbe,
  type CheckId,
  type CheckOutcome,
  type CheckSpec,
  type ProbeResult,
} from './lib/site-health';

const REQUEST_TIMEOUT_MS = 15000;

function flag(name: string): string | undefined {
  const prefixed = `--${name}`;
  const argv = process.argv.slice(2);
  const exact = argv.indexOf(prefixed);
  if (exact >= 0) {
    const next = argv[exact + 1];
    return next && !next.startsWith('--') ? next : '';
  }
  const inline = argv.find((a) => a.startsWith(`${prefixed}=`));
  return inline ? inline.slice(prefixed.length + 1) : undefined;
}

function hasFlag(name: string): boolean {
  return flag(name) !== undefined;
}

/** Fetch a URL, capturing transport errors instead of throwing. */
async function probe(url: string, headers: Record<string, string> = {}): Promise<ProbeResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const started = Date.now();
  try {
    const response = await fetch(url, {
      redirect: 'manual',
      headers: { 'User-Agent': 'mangu-site-health-check/1.0', ...headers },
      signal: controller.signal,
    });
    const body = await response.text().catch(() => '');
    return { status: response.status, body, elapsedMs: Date.now() - started };
  } catch (error) {
    // Node surfaces DNS failures as a cause chain; flatten it for the matcher.
    const err = error as { message?: string; cause?: { message?: string; code?: string } };
    const detail = [err?.message, err?.cause?.code, err?.cause?.message]
      .filter(Boolean)
      .join(' | ');
    return {
      status: null,
      body: '',
      elapsedMs: Date.now() - started,
      networkError: detail || String(error),
    };
  }
}

/** Resolve the canary slug, falling back to the first slug from /api/books. */
async function resolveCanarySlug(baseUrl: string, preferred: string): Promise<string> {
  const candidate = await probe(`${baseUrl}/books/${preferred}`);
  if (candidate.status === 200 && !/Book Not Found/i.test(candidate.body)) return preferred;

  const list = await probe(`${baseUrl}/api/books`);
  try {
    const parsed = JSON.parse(list.body) as {
      books?: Array<{ slug?: string }>;
      data?: { books?: Array<{ slug?: string }> };
    };
    const books = parsed.books ?? parsed.data?.books ?? [];
    const first = books.find((b) => typeof b.slug === 'string' && b.slug.length > 0);
    if (first?.slug) return first.slug;
  } catch {
    // Fall through — keep the preferred slug so the canary check fails loudly.
  }
  return preferred;
}

async function main(): Promise<void> {
  const baseUrl = (flag('base-url') || DEFAULT_BASE_URL).replace(/\/+$/, '');
  const jsonOutput = hasFlag('json');
  const includeCheckout = hasFlag('with-checkout');
  const simulate = flag('simulate-failure');
  const simulateAll = simulate === '';
  const simulateId = simulate ? (simulate as CheckId) : undefined;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  const supabaseRef = projectRefFromSupabaseUrl(supabaseUrl);

  const canarySlug = simulate
    ? 'cloud-run-chronicles'
    : await resolveCanarySlug(baseUrl, flag('canary-slug') || 'cloud-run-chronicles');

  const specs: CheckSpec[] = buildCheckSpecs({
    baseUrl,
    canarySlug,
    supabaseUrl,
    supabaseAuthenticated: Boolean(supabaseAnonKey),
    includeCheckout,
  });

  const notices: string[] = [];
  if (!supabaseUrl) {
    notices.push(
      'Supabase auth check SKIPPED — NEXT_PUBLIC_SUPABASE_URL is not set in this environment. ' +
        'Set it (name only; the value stays in the secret store) to enable check 5.'
    );
  } else if (!supabaseRef) {
    notices.push(
      'Supabase auth check SKIPPED — NEXT_PUBLIC_SUPABASE_URL is not a hosted https://<ref>.supabase.co URL.'
    );
  } else if (!supabaseAnonKey) {
    notices.push(
      `Supabase auth check will run unauthenticated against project ${maskProjectRef(supabaseRef)} — ` +
        'set NEXT_PUBLIC_SUPABASE_ANON_KEY for a full-fidelity probe.'
    );
  }

  const outcomes: CheckOutcome[] = [];
  for (const spec of specs) {
    const shouldSimulate = simulateAll || (simulateId !== undefined && simulateId === spec.id);
    const result = shouldSimulate
      ? simulatedFailureProbe(spec)
      : await probe(
          spec.url,
          spec.id === 'supabase-auth' && supabaseAnonKey
            ? { apikey: supabaseAnonKey, Authorization: `Bearer ${supabaseAnonKey}` }
            : {}
        );
    outcomes.push(evaluateCheck(spec, result));
  }

  const payload = buildAlert(outcomes, specs);

  if (jsonOutput) {
    console.log(JSON.stringify({ ...payload, notices, baseUrl }, null, 2));
  } else {
    console.log(renderAlert(payload));
    for (const notice of notices) console.log(`Note: ${notice}`);
  }

  process.exit(payload.overall === 'FAIL' ? 1 : 0);
}

main().catch((error) => {
  console.error('health check runner crashed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
