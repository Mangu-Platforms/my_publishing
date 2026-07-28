/** @jest-environment node */

/**
 * Task 1.8 — login/registration error rendering must never leak a non-string,
 * an empty serialization, a stack trace, or a provider internal into the
 * user-facing message slot.
 *
 * The reported defect: during a provider outage the login form rendered a
 * literal `{}` because a non-string reached the message slot.
 */

import {
  GENERIC_AUTH_ERROR,
  normalizeAuthErrorMessage,
  redactAuthDiagnostic,
} from '@/lib/auth/error-messages';

describe('normalizeAuthErrorMessage — string shapes', () => {
  it('passes through a clean message', () => {
    expect(normalizeAuthErrorMessage('Invalid email or password. Please try again.')).toBe(
      'Invalid email or password. Please try again.'
    );
  });

  it('collapses whitespace and trims', () => {
    expect(normalizeAuthErrorMessage('  Too many   attempts.\n ')).toBe('Too many attempts.');
  });

  it.each(['', '   ', '{}', '[]', 'null', 'undefined', '[object Object]', 'NaN'])(
    'rejects the empty shape %p',
    (value) => {
      expect(normalizeAuthErrorMessage(value)).toBe(GENERIC_AUTH_ERROR);
    }
  );

  it('rejects a stack trace', () => {
    const stack = 'TypeError: x is not a function\n    at signIn (/app/lib/auth.ts:12:9)';
    expect(normalizeAuthErrorMessage(stack)).toBe(GENERIC_AUTH_ERROR);
  });

  it.each([
    ['a provider URL', 'fetch failed: https://xyz.supabase.co/auth/v1/token'],
    ['an API key', 'bad key sk_live_abcdef0123456789'],
    ['a JWT', 'session eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.sig'],
    ['SQL', 'ERROR: select role from profiles where user_id = $1'],
  ])('rejects %s', (_label, value) => {
    expect(normalizeAuthErrorMessage(value)).toBe(GENERIC_AUTH_ERROR);
  });

  it('rejects an over-long provider dump', () => {
    expect(normalizeAuthErrorMessage('x'.repeat(500))).toBe(GENERIC_AUTH_ERROR);
  });
});

describe('normalizeAuthErrorMessage — object shapes', () => {
  it('never returns "[object Object]" for a bare object', () => {
    const result = normalizeAuthErrorMessage({});
    expect(result).toBe(GENERIC_AUTH_ERROR);
    expect(result).not.toMatch(/object Object/);
    expect(result).not.toBe('{}');
  });

  it('reads Error.message', () => {
    expect(normalizeAuthErrorMessage(new Error('Email not confirmed'))).toBe(
      'Email not confirmed'
    );
  });

  it('reads a Supabase-style AuthError object', () => {
    expect(normalizeAuthErrorMessage({ status: 400, message: 'Invalid login credentials' })).toBe(
      'Invalid login credentials'
    );
  });

  it('reads a Better-Auth-style body wrapper', () => {
    expect(
      normalizeAuthErrorMessage({ body: { code: 'X' }, error: { message: 'Sign in failed' } })
    ).toBe('Sign in failed');
  });

  it('falls back when the object only nests unusable values', () => {
    expect(normalizeAuthErrorMessage({ message: {}, error: [] })).toBe(GENERIC_AUTH_ERROR);
  });

  it('survives a circular object', () => {
    const circular: Record<string, unknown> = { code: 500 };
    circular.error = circular;
    expect(normalizeAuthErrorMessage(circular)).toBe(GENERIC_AUTH_ERROR);
  });

  it('picks the first usable entry of an array', () => {
    expect(normalizeAuthErrorMessage([{}, 'Account is locked.'])).toBe('Account is locked.');
  });
});

describe('normalizeAuthErrorMessage — unknown shapes', () => {
  it.each([[null], [undefined], [42], [true], [Symbol('x')], [() => 'nope']])(
    'falls back for %p',
    (value) => {
      expect(normalizeAuthErrorMessage(value as unknown)).toBe(GENERIC_AUTH_ERROR);
    }
  );

  it('honours a caller-supplied fallback', () => {
    expect(normalizeAuthErrorMessage({}, 'We could not sign you in right now.')).toBe(
      'We could not sign you in right now.'
    );
  });

  it('always returns a non-empty string', () => {
    for (const value of [{}, [], null, undefined, 0, '', new Error('')]) {
      const result = normalizeAuthErrorMessage(value);
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    }
  });
});

describe('redactAuthDiagnostic — server-side logging', () => {
  it('redacts email addresses', () => {
    expect(redactAuthDiagnostic('sign-in failed for renee@example.com')).toBe(
      'sign-in failed for [email]'
    );
  });

  it('redacts JWTs and API keys', () => {
    const out = redactAuthDiagnostic(
      'token=eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.sig key=sk_live_abcdef0123456789'
    );
    expect(out).not.toMatch(/eyJ/);
    expect(out).not.toMatch(/sk_live_abcdef/);
  });

  it('redacts password-like key/value pairs', () => {
    expect(redactAuthDiagnostic('{"password":"hunter2"}')).toContain('[redacted]');
    expect(redactAuthDiagnostic('{"password":"hunter2"}')).not.toContain('hunter2');
  });

  it('serializes objects and Errors without throwing', () => {
    expect(redactAuthDiagnostic(new Error('boom'))).toBe('Error: boom');
    expect(redactAuthDiagnostic({ status: 503 })).toBe('{"status":503}');
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(redactAuthDiagnostic(circular)).toBe('[unserializable error]');
  });

  it('caps the length so a provider dump cannot flood the log', () => {
    expect(redactAuthDiagnostic('y'.repeat(5000)).length).toBeLessThanOrEqual(500);
  });
});
