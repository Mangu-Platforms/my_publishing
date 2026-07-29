/**
 * Pure evaluation + alert-formatting logic for the daily production health
 * monitor (`mangu-site-health-check`, 07:30 America/New_York).
 *
 * This module performs NO I/O so it can be unit-tested under Jest/jsdom.
 * The network layer lives in `scripts/site-health-check.ts`.
 *
 * Background (Task 0.4): on 2026-07-28 the production Supabase project was
 * found paused/removed and its hostname returned DNS_PROBE_FINISHED_NXDOMAIN.
 * Cached/ISR pages masked the outage — /books still listed books while the
 * database was unreachable. The monitor therefore has to check surfaces that
 * CANNOT be served from cache: a server-rendered login page and a live
 * Supabase auth call.
 *
 * Security contract: no secret value, no API key and no customer data may
 * appear in any output. Every body excerpt passes through `redact()`.
 */

export type CheckId =
  | 'homepage'
  | 'api-books'
  | 'book-canary'
  | 'login-render'
  | 'supabase-auth'
  | 'checkout-route';

export type Severity = 'pass' | 'warn' | 'fail';

export interface CheckSpec {
  id: CheckId;
  label: string;
  url: string;
  /** Response-time budget in ms. Exceeding it is a WARN, never a hard FAIL. */
  thresholdMs: number;
  /** HTTP statuses that are acceptable for this check. */
  acceptableStatuses: number[];
  /** Optional body assertion. Returns null when OK, or a failure reason. */
  assertBody?: (body: string) => string | null;
  /** Shown in the alert as the first thing an operator should do. */
  suggestedAction: string;
  /** Set false for advisory checks that must not turn the run red. */
  required: boolean;
}

export interface ProbeResult {
  /** null when the request never produced an HTTP response (DNS/TCP/TLS). */
  status: number | null;
  body: string;
  elapsedMs: number;
  /** Transport-level error message, if any. */
  networkError?: string;
}

export interface CheckOutcome {
  id: CheckId;
  label: string;
  url: string;
  severity: Severity;
  httpStatus: number | null;
  elapsedMs: number;
  thresholdMs: number;
  withinThreshold: boolean;
  reason: string;
  bodyExcerpt: string;
  suggestedAction: string;
}

export interface AlertFailure {
  check: string;
  url: string;
  httpStatus: number | null;
  elapsedMs: number;
  thresholdMs: number;
  /** Human-readable response-time threshold result. */
  responseTime: string;
  reason: string;
  bodyExcerpt: string;
  suggestedAction: string;
}

export interface AlertPayload {
  title: string;
  overall: 'PASS' | 'FAIL';
  timestampUtc: string;
  timestampNewYork: string;
  failures: AlertFailure[];
  warnings: AlertFailure[];
  passed: string[];
}

export const DEFAULT_BASE_URL = 'https://www.mangu-publishers.com';

/** Documented server-render marker on /login (app/(auth)/login/page.tsx). */
export const LOGIN_RENDER_MARKER = 'Welcome back';

/**
 * Patterns that must never survive into an alert. Ordered most-specific first.
 * Deliberately conservative: it is better to over-redact an excerpt than to
 * leak one key.
 */
const REDACTIONS: Array<[RegExp, string]> = [
  [/mongodb(\+srv)?:\/\/[^\s"'<>]+/gi, '[REDACTED_MONGODB_URI]'],
  [/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}/g, '[REDACTED_JWT]'],
  [/\bsb_(publishable|secret)_[A-Za-z0-9_-]{8,}/g, '[REDACTED_SUPABASE_KEY]'],
  [/\b[sr]k_(live|test)_[A-Za-z0-9]{8,}/g, '[REDACTED_STRIPE_KEY]'],
  [/\bpk_(live|test)_[A-Za-z0-9]{8,}/g, '[REDACTED_STRIPE_KEY]'],
  [/\bwhsec_[A-Za-z0-9_-]{8,}/g, '[REDACTED_WEBHOOK_SECRET]'],
  [/\bre_[A-Za-z0-9_-]{16,}/g, '[REDACTED_RESEND_KEY]'],
  [/\b(apikey|api_key|authorization|bearer|token|password|secret)\b\s*[:=]\s*"?[^\s",}]+/gi,
    '$1=[REDACTED]'],
  [/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[REDACTED_EMAIL]'],
];

/** Strip anything that looks like a credential or personal data. */
export function redact(input: string): string {
  let out = input;
  for (const [pattern, replacement] of REDACTIONS) {
    out = out.replace(pattern, replacement);
  }
  return out;
}

/** Collapse whitespace, redact, and truncate to a short alert-safe excerpt. */
export function excerpt(input: string, maxLength = 220): string {
  const collapsed = redact(input ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  if (collapsed.length <= maxLength) return collapsed;
  return `${collapsed.slice(0, maxLength)}… [truncated]`;
}

export interface Timestamps {
  utc: string;
  newYork: string;
}

/** Both timestamps required in every alert payload. */
export function formatTimestamps(now: Date = new Date()): Timestamps {
  const nyFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZoneName: 'short',
  });
  return { utc: now.toISOString(), newYork: nyFormatter.format(now) };
}

/**
 * The catastrophic-failure signature: a paused or deleted Supabase project
 * stops resolving in DNS. Browsers show DNS_PROBE_FINISHED_NXDOMAIN; Node
 * reports ENOTFOUND / EAI_AGAIN from getaddrinfo.
 */
export function isDnsFailure(networkError?: string): boolean {
  if (!networkError) return false;
  return /ENOTFOUND|EAI_AGAIN|getaddrinfo|NXDOMAIN|DNS_PROBE_FINISHED/i.test(networkError);
}

/**
 * Extract the Supabase project ref from a project URL so the monitor can name
 * the project it actually probed WITHOUT the ref ever being hardcoded in the
 * repo. Returns null for anything that is not a hosted Supabase URL.
 */
export function projectRefFromSupabaseUrl(url: string | undefined): string | null {
  if (!url) return null;
  const match = /^https:\/\/([a-z0-9-]+)\.supabase\.(co|in)\b/i.exec(url.trim());
  return match ? match[1] : null;
}

/** Show enough of the ref to identify the project, not enough to be a secret. */
export function maskProjectRef(ref: string | null): string {
  if (!ref) return '(unknown project ref)';
  if (ref.length <= 8) return ref;
  return `${ref.slice(0, 4)}…${ref.slice(-4)}`;
}

/** Evaluate one probe against its spec. Pure. */
export function evaluateCheck(spec: CheckSpec, probe: ProbeResult): CheckOutcome {
  const withinThreshold = probe.elapsedMs <= spec.thresholdMs;
  const base = {
    id: spec.id,
    label: spec.label,
    url: spec.url,
    httpStatus: probe.status,
    elapsedMs: probe.elapsedMs,
    thresholdMs: spec.thresholdMs,
    withinThreshold,
    suggestedAction: spec.suggestedAction,
  };

  if (probe.networkError) {
    const dns = isDnsFailure(probe.networkError);
    return {
      ...base,
      severity: 'fail',
      reason: dns
        ? `DNS resolution failed (NXDOMAIN / ENOTFOUND) — ${redact(probe.networkError)}. ` +
          'This is the paused-or-deleted-project signature.'
        : `Transport error — ${redact(probe.networkError)}`,
      bodyExcerpt: '(no response body — request never completed)',
      suggestedAction: dns
        ? 'Open the Supabase dashboard and confirm the project is ACTIVE (not paused/removed); ' +
          'then re-point NEXT_PUBLIC_SUPABASE_URL if the ref changed.'
        : spec.suggestedAction,
    };
  }

  if (probe.status === null || !spec.acceptableStatuses.includes(probe.status)) {
    return {
      ...base,
      severity: 'fail',
      reason: `Unexpected HTTP status ${probe.status ?? 'none'} (expected one of ${spec.acceptableStatuses.join(', ')})`,
      bodyExcerpt: excerpt(probe.body),
    };
  }

  const bodyFailure = spec.assertBody ? spec.assertBody(probe.body) : null;
  if (bodyFailure) {
    return {
      ...base,
      severity: 'fail',
      reason: bodyFailure,
      bodyExcerpt: excerpt(probe.body),
    };
  }

  if (!withinThreshold) {
    return {
      ...base,
      severity: 'warn',
      reason: `Slow response: ${probe.elapsedMs}ms exceeds the ${spec.thresholdMs}ms budget (content was correct)`,
      bodyExcerpt: excerpt(probe.body, 120),
    };
  }

  return {
    ...base,
    severity: 'pass',
    reason: 'OK',
    bodyExcerpt: '',
  };
}

function toAlertFailure(outcome: CheckOutcome): AlertFailure {
  return {
    check: outcome.label,
    url: outcome.url,
    httpStatus: outcome.httpStatus,
    elapsedMs: outcome.elapsedMs,
    thresholdMs: outcome.thresholdMs,
    responseTime: outcome.withinThreshold
      ? `${outcome.elapsedMs}ms — within ${outcome.thresholdMs}ms budget`
      : `${outcome.elapsedMs}ms — OVER the ${outcome.thresholdMs}ms budget`,
    reason: outcome.reason,
    bodyExcerpt: outcome.bodyExcerpt,
    suggestedAction: outcome.suggestedAction,
  };
}

/**
 * Build the alert payload. `overall` is FAIL only when a REQUIRED check failed
 * — warnings and advisory (non-required) checks never raise a false alarm.
 */
export function buildAlert(
  outcomes: CheckOutcome[],
  specs: CheckSpec[],
  now: Date = new Date()
): AlertPayload {
  const requiredIds = new Set(specs.filter((s) => s.required).map((s) => s.id));
  const { utc, newYork } = formatTimestamps(now);

  const failures = outcomes
    .filter((o) => o.severity === 'fail' && requiredIds.has(o.id))
    .map(toAlertFailure);
  const warnings = outcomes
    .filter((o) => o.severity === 'warn' || (o.severity === 'fail' && !requiredIds.has(o.id)))
    .map(toAlertFailure);
  const passed = outcomes.filter((o) => o.severity === 'pass').map((o) => o.label);

  return {
    title: failures.length > 0 ? 'MANGU SITE PROBLEM' : 'MANGU site healthy',
    overall: failures.length > 0 ? 'FAIL' : 'PASS',
    timestampUtc: utc,
    timestampNewYork: newYork,
    failures,
    warnings,
    passed,
  };
}

/** Render the payload as the short operator-facing report. */
export function renderAlert(payload: AlertPayload): string {
  const stamp = `${payload.timestampUtc} UTC / ${payload.timestampNewYork}`;

  if (payload.overall === 'PASS') {
    const warnNote =
      payload.warnings.length > 0
        ? `\nAdvisory (not an outage): ${payload.warnings.map((w) => `${w.check} — ${w.reason}`).join('; ')}`
        : '';
    return (
      `MANGU site healthy — ${payload.passed.length} check(s) OK ` +
      `(${payload.passed.join(', ')}) at ${stamp}.${warnNote}`
    );
  }

  const lines: string[] = [`⚠️ ${payload.title} — ${payload.failures.length} failing check(s)`, `Time: ${stamp}`, ''];

  for (const failure of payload.failures) {
    lines.push(`FAILED: ${failure.check}`);
    lines.push(`  URL:            ${failure.url}`);
    lines.push(`  HTTP status:    ${failure.httpStatus ?? 'no response'}`);
    lines.push(`  Response time:  ${failure.responseTime}`);
    lines.push(`  Reason:         ${failure.reason}`);
    lines.push(`  Body excerpt:   ${failure.bodyExcerpt || '(empty)'}`);
    lines.push(`  First action:   ${failure.suggestedAction}`);
    lines.push('');
  }

  if (payload.warnings.length > 0) {
    lines.push(`Advisory: ${payload.warnings.map((w) => `${w.check} — ${w.reason}`).join('; ')}`);
  }
  if (payload.passed.length > 0) {
    lines.push(`Still passing: ${payload.passed.join(', ')}`);
  }
  lines.push('Runbook: docs/operations/INCIDENT_RESPONSE.md');

  return lines.join('\n');
}

export interface BuildSpecsOptions {
  baseUrl?: string;
  /** Canary book slug; the runner falls back to the first slug from /api/books. */
  canarySlug?: string;
  /** Full Supabase project URL, read from env — never hardcoded. */
  supabaseUrl?: string;
  /**
   * True when an anon/publishable key is available to send as `apikey`.
   * Without it the Supabase gateway answers 401, which still proves DNS +
   * gateway liveness — so 401 is accepted rather than raised as a false alarm.
   */
  supabaseAuthenticated?: boolean;
  /** Include the advisory /checkout non-500 check. */
  includeCheckout?: boolean;
}

/**
 * The full check list. Checks 1–3 are the pre-existing monitor behaviour;
 * 4–6 are Task 0.4 additions.
 */
export function buildCheckSpecs(options: BuildSpecsOptions = {}): CheckSpec[] {
  const baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
  const canarySlug = options.canarySlug ?? 'cloud-run-chronicles';

  const specs: CheckSpec[] = [
    {
      id: 'homepage',
      label: 'Homepage',
      url: `${baseUrl}/`,
      thresholdMs: 4000,
      acceptableStatuses: [200],
      assertBody: (body) =>
        body.trim().length > 0 ? null : 'Homepage returned an empty body',
      suggestedAction: 'Check the latest Vercel production deployment status and runtime logs.',
      required: true,
    },
    {
      id: 'api-books',
      label: 'Catalog API (/api/books)',
      url: `${baseUrl}/api/books`,
      thresholdMs: 4000,
      acceptableStatuses: [200],
      assertBody: (body) => {
        let parsed: unknown;
        try {
          parsed = JSON.parse(body);
        } catch {
          return '/api/books did not return valid JSON';
        }
        const payload = parsed as { success?: unknown; books?: unknown; data?: unknown };
        if (payload.success !== true) return '/api/books JSON is missing "success": true';
        const books = Array.isArray(payload.books)
          ? payload.books
          : Array.isArray((payload.data as { books?: unknown } | undefined)?.books)
            ? ((payload.data as { books: unknown[] }).books)
            : null;
        if (books === null) return '/api/books JSON has no books array';
        return null;
      },
      suggestedAction:
        'Probe /api/health?ready=1 — a failing mongodb check means the catalog database is unreachable.',
      required: true,
    },
    {
      id: 'book-canary',
      label: `Book detail canary (/books/${canarySlug})`,
      url: `${baseUrl}/books/${canarySlug}`,
      thresholdMs: 5000,
      acceptableStatuses: [200],
      assertBody: (body) =>
        /Book Not Found/i.test(body)
          ? 'Book detail page rendered "Book Not Found" — the dynamic data path is broken'
          : null,
      suggestedAction:
        'Confirm the catalog database is reachable, then confirm the canary slug still exists in the catalog.',
      required: true,
    },
    // ---- Task 0.4 additions: surfaces that cannot be served from cache ----
    {
      id: 'login-render',
      label: 'Login page server render (/login)',
      url: `${baseUrl}/login`,
      thresholdMs: 4000,
      acceptableStatuses: [200],
      assertBody: (body) =>
        body.includes(LOGIN_RENDER_MARKER)
          ? null
          : `Raw HTML of /login does not contain the documented marker "${LOGIN_RENDER_MARKER}" — ` +
            'the auth surface is not rendering.',
      suggestedAction:
        'Open https://www.mangu-publishers.com/login in a private window; if it errors, check the Supabase project state first.',
      required: true,
    },
  ];

  const supabaseRef = projectRefFromSupabaseUrl(options.supabaseUrl);
  if (options.supabaseUrl && supabaseRef) {
    const authenticated = options.supabaseAuthenticated === true;
    specs.push({
      id: 'supabase-auth',
      label: `Supabase auth health (project ${maskProjectRef(supabaseRef)})`,
      url: `${options.supabaseUrl.replace(/\/+$/, '')}/auth/v1/health`,
      thresholdMs: 3000,
      // Unauthenticated: 401 from the API gateway still proves the project
      // resolves and is serving — which is exactly what a paused/deleted
      // project (NXDOMAIN, or a project-not-found error) does NOT do.
      acceptableStatuses: authenticated ? [200] : [200, 401],
      assertBody: (body) =>
        body.trim().length > 0 ? null : 'Supabase auth health returned an empty body',
      suggestedAction:
        'Open the Supabase dashboard for the CURRENT project ref and confirm it is ACTIVE, not paused.',
      required: true,
    });
  }

  if (options.includeCheckout) {
    specs.push({
      id: 'checkout-route',
      label: 'Checkout route non-500 (/checkout)',
      url: `${baseUrl}/checkout`,
      thresholdMs: 5000,
      // Unauthenticated visitors are legitimately redirected or refused.
      acceptableStatuses: [200, 302, 303, 307, 308, 401, 403, 404],
      suggestedAction:
        'Check Vercel runtime logs for the checkout route and confirm STRIPE_SECRET_KEY is present in production.',
      // Advisory: an auth redirect must never page Renee at 07:30.
      required: false,
    });
  }

  return specs;
}

/** Deterministic synthetic failure used by `--simulate-failure`. */
export function simulatedFailureProbe(spec: CheckSpec): ProbeResult {
  if (spec.id === 'supabase-auth') {
    return {
      status: null,
      body: '',
      elapsedMs: 12,
      networkError:
        'getaddrinfo ENOTFOUND simulated-ref.supabase.co (SIMULATED — DNS_PROBE_FINISHED_NXDOMAIN)',
    };
  }
  return {
    status: 503,
    body: '{"error":"SIMULATED FAILURE — injected by --simulate-failure"}',
    elapsedMs: 25,
  };
}
