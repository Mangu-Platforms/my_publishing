import {
  buildAlert,
  buildCheckSpecs,
  evaluateCheck,
  excerpt,
  formatTimestamps,
  isDnsFailure,
  LOGIN_RENDER_MARKER,
  maskProjectRef,
  projectRefFromSupabaseUrl,
  redact,
  renderAlert,
  simulatedFailureProbe,
  type CheckSpec,
  type ProbeResult,
} from '../../scripts/lib/site-health';

const AT = new Date('2026-07-28T11:30:00.000Z');

function specById(specs: CheckSpec[], id: string): CheckSpec {
  const spec = specs.find((s) => s.id === id);
  if (!spec) throw new Error(`spec ${id} not built`);
  return spec;
}

function ok(body: string, elapsedMs = 100): ProbeResult {
  return { status: 200, body, elapsedMs };
}

describe('redaction (no secrets or customer data in output)', () => {
  it('redacts JWTs, Supabase keys, Stripe keys, webhook secrets and Mongo URIs', () => {
    const dirty = [
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.abcdefghij.signature123',
      'sb_publishable_AbCdEf123456',
      'sb_secret_AbCdEf123456',
      'sk_live_ABCDEFGH12345678',
      'whsec_ABCDEFGH12345678',
      'mongodb+srv://user:pa55word@cluster0.abcde.mongodb.net/mangu',
    ].join(' ');
    const clean = redact(dirty);

    expect(clean).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
    expect(clean).not.toContain('sb_publishable_AbCdEf123456');
    expect(clean).not.toContain('sb_secret_AbCdEf123456');
    expect(clean).not.toContain('sk_live_ABCDEFGH12345678');
    expect(clean).not.toContain('whsec_ABCDEFGH12345678');
    expect(clean).not.toContain('pa55word');
    expect(clean).toContain('[REDACTED_JWT]');
    expect(clean).toContain('[REDACTED_MONGODB_URI]');
  });

  it('redacts customer email addresses', () => {
    expect(redact('order for reader@example.com failed')).not.toContain('reader@example.com');
  });

  it('truncates long excerpts and still redacts', () => {
    const body = `${'x'.repeat(500)} sk_test_ABCDEFGH12345678`;
    const short = excerpt(body, 50);
    expect(short.length).toBeLessThanOrEqual(70);
    expect(short).not.toContain('sk_test_ABCDEFGH12345678');
  });
});

describe('timestamps', () => {
  it('emits both UTC and America/New_York', () => {
    const stamps = formatTimestamps(AT);
    expect(stamps.utc).toBe('2026-07-28T11:30:00.000Z');
    expect(stamps.newYork).toContain('07:30:00');
    expect(stamps.newYork).toMatch(/EDT|EST/);
  });
});

describe('Supabase project ref handling', () => {
  it('derives the ref from the URL instead of hardcoding one', () => {
    expect(projectRefFromSupabaseUrl('https://abcdefghijklmnop.supabase.co')).toBe('abcdefghijklmnop');
    expect(projectRefFromSupabaseUrl('https://example.com')).toBeNull();
    expect(projectRefFromSupabaseUrl(undefined)).toBeNull();
  });

  it('masks the ref when displaying it', () => {
    expect(maskProjectRef('abcdefghijklmnop')).toBe('abcd…mnop');
    expect(maskProjectRef(null)).toBe('(unknown project ref)');
  });

  it('recognises the paused/deleted-project DNS signature', () => {
    expect(isDnsFailure('getaddrinfo ENOTFOUND some-ref.supabase.co')).toBe(true);
    expect(isDnsFailure('DNS_PROBE_FINISHED_NXDOMAIN')).toBe(true);
    expect(isDnsFailure('EAI_AGAIN')).toBe(true);
    expect(isDnsFailure('socket hang up')).toBe(false);
    expect(isDnsFailure(undefined)).toBe(false);
  });
});

describe('check specs', () => {
  it('includes the login server-render check with the documented marker', () => {
    const specs = buildCheckSpecs({ baseUrl: 'https://www.mangu-publishers.com' });
    const login = specById(specs, 'login-render');
    expect(login.url).toBe('https://www.mangu-publishers.com/login');
    expect(login.assertBody?.(`<h1>${LOGIN_RENDER_MARKER}</h1>`)).toBeNull();
    expect(login.assertBody?.('<h1>Something else</h1>')).toContain(LOGIN_RENDER_MARKER);
  });

  it('omits the Supabase check when no project URL is configured', () => {
    const specs = buildCheckSpecs({});
    expect(specs.some((s) => s.id === 'supabase-auth')).toBe(false);
  });

  it('accepts a 401 from the Supabase gateway when unauthenticated (no false alarm)', () => {
    const specs = buildCheckSpecs({ supabaseUrl: 'https://abcdefghijklmnop.supabase.co' });
    expect(specById(specs, 'supabase-auth').acceptableStatuses).toContain(401);
  });

  it('requires a 200 from the Supabase gateway when an anon key is available', () => {
    const specs = buildCheckSpecs({
      supabaseUrl: 'https://abcdefghijklmnop.supabase.co',
      supabaseAuthenticated: true,
    });
    expect(specById(specs, 'supabase-auth').acceptableStatuses).toEqual([200]);
  });

  it('treats the checkout check as advisory so an auth redirect never pages anyone', () => {
    const specs = buildCheckSpecs({ includeCheckout: true });
    const checkout = specById(specs, 'checkout-route');
    expect(checkout.required).toBe(false);
    expect(checkout.acceptableStatuses).toContain(302);
  });

  it('flags /api/books responses without success:true', () => {
    const api = specById(buildCheckSpecs({}), 'api-books');
    expect(api.assertBody?.('{"success":true,"books":[]}')).toBeNull();
    expect(api.assertBody?.('{"success":false,"books":[]}')).toContain('success');
    expect(api.assertBody?.('not json')).toContain('valid JSON');
  });
});

describe('evaluateCheck', () => {
  const specs = buildCheckSpecs({ baseUrl: 'https://example.com' });
  const homepage = specById(specs, 'homepage');

  it('passes a healthy response', () => {
    const outcome = evaluateCheck(homepage, ok('<html>MANGU</html>'));
    expect(outcome.severity).toBe('pass');
    expect(outcome.withinThreshold).toBe(true);
  });

  it('warns — never fails — on a slow but correct response', () => {
    const outcome = evaluateCheck(homepage, ok('<html>MANGU</html>', 999999));
    expect(outcome.severity).toBe('warn');
    expect(outcome.withinThreshold).toBe(false);
  });

  it('fails on an unexpected status and records the status', () => {
    const outcome = evaluateCheck(homepage, { status: 500, body: 'boom', elapsedMs: 10 });
    expect(outcome.severity).toBe('fail');
    expect(outcome.httpStatus).toBe(500);
  });

  it('fails with the NXDOMAIN diagnosis on a DNS error', () => {
    const outcome = evaluateCheck(homepage, {
      status: null,
      body: '',
      elapsedMs: 5,
      networkError: 'getaddrinfo ENOTFOUND dead-ref.supabase.co',
    });
    expect(outcome.severity).toBe('fail');
    expect(outcome.reason).toContain('NXDOMAIN');
    expect(outcome.suggestedAction).toContain('Supabase dashboard');
  });
});

describe('alerts', () => {
  const specs = buildCheckSpecs({ baseUrl: 'https://example.com', includeCheckout: true });

  it('produces no alarm when everything passes', () => {
    const outcomes = specs.map((spec) =>
      evaluateCheck(spec, ok(spec.id === 'api-books' ? '{"success":true,"books":[{"slug":"a"}]}' : `<html>${LOGIN_RENDER_MARKER}</html>`))
    );
    const payload = buildAlert(outcomes, specs, AT);
    expect(payload.overall).toBe('PASS');
    expect(payload.failures).toHaveLength(0);
    expect(renderAlert(payload)).toContain('MANGU site healthy');
  });

  it('does not raise an alarm for an advisory (non-required) failure', () => {
    const checkout = specById(specs, 'checkout-route');
    const outcomes = [evaluateCheck(checkout, { status: 500, body: 'boom', elapsedMs: 10 })];
    const payload = buildAlert(outcomes, specs, AT);
    expect(payload.overall).toBe('PASS');
    expect(payload.warnings).toHaveLength(1);
  });

  it('a simulated failure produces a complete alert payload', () => {
    const login = specById(specs, 'login-render');
    const outcomes = [evaluateCheck(login, simulatedFailureProbe(login))];
    const payload = buildAlert(outcomes, specs, AT);

    expect(payload.overall).toBe('FAIL');
    expect(payload.timestampUtc).toBe('2026-07-28T11:30:00.000Z');
    expect(payload.timestampNewYork).toContain('07:30:00');

    const [failure] = payload.failures;
    expect(failure.url).toBe('https://example.com/login');
    expect(failure.httpStatus).toBe(503);
    expect(failure.responseTime).toContain('budget');
    expect(failure.bodyExcerpt).toContain('SIMULATED FAILURE');
    expect(failure.suggestedAction.length).toBeGreaterThan(0);

    const rendered = renderAlert(payload);
    expect(rendered).toContain('MANGU SITE PROBLEM');
    expect(rendered).toContain('First action:');
    expect(rendered).toContain('docs/operations/INCIDENT_RESPONSE.md');
  });

  it('simulates the Supabase outage as an NXDOMAIN transport failure', () => {
    const supabaseSpecs = buildCheckSpecs({ supabaseUrl: 'https://abcdefghijklmnop.supabase.co' });
    const spec = specById(supabaseSpecs, 'supabase-auth');
    const outcome = evaluateCheck(spec, simulatedFailureProbe(spec));
    expect(outcome.severity).toBe('fail');
    expect(outcome.reason).toContain('NXDOMAIN');
  });

  it('never leaks a key present in a failing response body', () => {
    const homepage = specById(specs, 'homepage');
    const outcome = evaluateCheck(homepage, {
      status: 500,
      body: 'Error: invalid apikey eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.leaked.value for reader@example.com',
      elapsedMs: 10,
    });
    const rendered = renderAlert(buildAlert([outcome], specs, AT));
    expect(rendered).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.leaked.value');
    expect(rendered).not.toContain('reader@example.com');
  });
});
