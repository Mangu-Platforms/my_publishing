/**
 * CORS origin allow-list tests (F-07): wildcard `Access-Control-Allow-Origin`
 * replaced with an allow-listed origin echo in @/lib/api/cors.
 */
import { allowedCorsOrigins, corsHeadersFor, corsPreflightHeadersFor } from '@/lib/api/cors';

function req(origin?: string): Request {
  // jsdom lacks the fetch-API Request global; the helper only needs headers.get().
  return {
    headers: {
      get: (name: string) => (name.toLowerCase() === 'origin' ? (origin ?? null) : null),
    },
  } as unknown as Request;
}

const env = process.env as Record<string, string | undefined>;

describe('allowedCorsOrigins', () => {
  it('never contains a wildcard', () => {
    expect(allowedCorsOrigins()).not.toContain('*');
  });
});

describe('corsHeadersFor', () => {
  it('echoes the canonical www origin with Vary: Origin', () => {
    const headers = corsHeadersFor(req('https://www.mangu-publishers.com'));
    expect(headers['Access-Control-Allow-Origin']).toBe('https://www.mangu-publishers.com');
    expect(headers['Vary']).toBe('Origin');
  });

  it('echoes the apex origin', () => {
    const headers = corsHeadersFor(req('https://mangu-publishers.com'));
    expect(headers['Access-Control-Allow-Origin']).toBe('https://mangu-publishers.com');
  });

  it('echoes the configured NEXT_PUBLIC_SITE_URL origin (trailing slash tolerated)', () => {
    const prev = env.NEXT_PUBLIC_SITE_URL;
    env.NEXT_PUBLIC_SITE_URL = 'https://staging.mangu-publishers.com/';
    try {
      const headers = corsHeadersFor(req('https://staging.mangu-publishers.com'));
      expect(headers['Access-Control-Allow-Origin']).toBe('https://staging.mangu-publishers.com');
    } finally {
      if (prev === undefined) delete env.NEXT_PUBLIC_SITE_URL;
      else env.NEXT_PUBLIC_SITE_URL = prev;
    }
  });

  it('sends no Access-Control-Allow-Origin for an unknown origin (and never a wildcard)', () => {
    const headers = corsHeadersFor(req('https://evil.example.com'));
    expect(headers['Access-Control-Allow-Origin']).toBeUndefined();
    expect(Object.values(headers)).not.toContain('*');
    // Vary stays so caches never replay one origin's answer to another.
    expect(headers['Vary']).toBe('Origin');
  });

  it('sends no Access-Control-Allow-Origin when the request has no Origin header', () => {
    const headers = corsHeadersFor(req());
    expect(headers['Access-Control-Allow-Origin']).toBeUndefined();
  });

  it('allows http://localhost:3000 outside production (jest runs NODE_ENV=test)', () => {
    const headers = corsHeadersFor(req('http://localhost:3000'));
    expect(headers['Access-Control-Allow-Origin']).toBe('http://localhost:3000');
  });

  it('rejects http://localhost:3000 in production', () => {
    const prevNodeEnv = env.NODE_ENV;
    env.NODE_ENV = 'production';
    try {
      const headers = corsHeadersFor(req('http://localhost:3000'));
      expect(headers['Access-Control-Allow-Origin']).toBeUndefined();
    } finally {
      env.NODE_ENV = prevNodeEnv;
    }
  });

  it('still allows the canonical origins in production', () => {
    const prevNodeEnv = env.NODE_ENV;
    env.NODE_ENV = 'production';
    try {
      const headers = corsHeadersFor(req('https://www.mangu-publishers.com'));
      expect(headers['Access-Control-Allow-Origin']).toBe('https://www.mangu-publishers.com');
    } finally {
      env.NODE_ENV = prevNodeEnv;
    }
  });
});

describe('corsPreflightHeadersFor', () => {
  it('advertises only Content-Type — neither route reads the Authorization header', () => {
    const headers = corsPreflightHeadersFor(
      req('https://www.mangu-publishers.com'),
      'POST, OPTIONS'
    );
    expect(headers['Access-Control-Allow-Headers']).toBe('Content-Type');
    expect(headers['Access-Control-Allow-Headers']).not.toMatch(/authorization/i);
    expect(headers['Access-Control-Allow-Methods']).toBe('POST, OPTIONS');
    expect(headers['Access-Control-Allow-Origin']).toBe('https://www.mangu-publishers.com');
    expect(headers['Access-Control-Max-Age']).toBe('86400');
    expect(headers['Vary']).toBe('Origin');
  });

  it('omits Access-Control-Allow-Origin for unknown origins on preflight too', () => {
    const headers = corsPreflightHeadersFor(req('https://evil.example.com'), 'GET, POST, OPTIONS');
    expect(headers['Access-Control-Allow-Origin']).toBeUndefined();
    expect(Object.values(headers)).not.toContain('*');
  });
});
