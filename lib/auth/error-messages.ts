/**
 * User-facing auth error normalization (Task 1.8).
 *
 * Defect this closes: a non-string value reached the login form's message slot
 * during a provider outage and the UI rendered a literal `{}`. Anything that
 * reaches a user-visible error slot must be a short, human-readable string.
 *
 * Guarantees:
 *  - never returns '[object Object]', '{}', '[]', 'null' or 'undefined'
 *  - never returns a stack trace, a file path, a URL, a JWT or an API key
 *  - always returns a non-empty, single-line, length-capped string
 *
 * Server-side diagnostics go through `redactAuthDiagnostic()` so emails,
 * tokens and keys never reach the log stream.
 *
 * NOTE: this module is imported by client components — keep it dependency-free
 * and free of any server-only import.
 */

export const GENERIC_AUTH_ERROR = 'Something went wrong. Please try again.';

/** Longer than this is almost certainly a provider dump, not a message. */
const MAX_MESSAGE_LENGTH = 200;

/** Serialized shapes that carry no information for a human. */
const EMPTY_SHAPES = new Set(['', '{}', '[]', 'null', 'undefined', '[object object]', 'nan']);

/** Keys, in priority order, that commonly hold a human-readable message. */
const MESSAGE_KEYS = ['message', 'error_description', 'error', 'msg', 'detail', 'statusText'];

function looksLikeStackTrace(value: string): boolean {
  return /\n\s*at\s/.test(value) || /\.(?:t|j)sx?:\d+:\d+/.test(value);
}

function looksLikeProviderInternal(value: string): boolean {
  return (
    /https?:\/\//i.test(value) || // provider endpoints
    /(?:^|\s)[A-Za-z]:\\|(?:^|\s)\/(?:var|home|usr|app|tmp)\//.test(value) || // file paths
    /\b(?:sk|pk|rk|whsec)_(?:live|test)?_?[A-Za-z0-9]{8,}/i.test(value) || // API keys
    /eyJ[A-Za-z0-9_-]{8,}\./.test(value) || // JWTs
    /\b(?:select|insert|update|delete)\b[\s\S]*\bfrom\b/i.test(value) // SQL
  );
}

function fromString(value: string, fallback: string): string | null {
  const collapsed = value.replace(/\s+/g, ' ').trim();
  if (!collapsed || EMPTY_SHAPES.has(collapsed.toLowerCase())) {
    return null;
  }
  if (looksLikeStackTrace(value) || looksLikeProviderInternal(collapsed)) {
    return null;
  }
  return collapsed.length > MAX_MESSAGE_LENGTH ? fallback : collapsed;
}

/**
 * Coerce any thrown/returned value into a message that is safe to render.
 * Falls back to `fallback` whenever the input is unusable.
 */
export function normalizeAuthErrorMessage(input: unknown, fallback = GENERIC_AUTH_ERROR): string {
  const seen = new Set<unknown>();

  const visit = (value: unknown, depth: number): string | null => {
    if (value == null || depth > 3) {
      return null;
    }
    if (typeof value === 'string') {
      return fromString(value, fallback);
    }
    if (typeof value !== 'object') {
      return null;
    }
    if (seen.has(value)) {
      return null;
    }
    seen.add(value);

    if (Array.isArray(value)) {
      for (const entry of value) {
        const found = visit(entry, depth + 1);
        if (found) {
          return found;
        }
      }
      return null;
    }

    const record = value as Record<string, unknown>;
    for (const key of MESSAGE_KEYS) {
      const found = visit(record[key], depth + 1);
      if (found) {
        return found;
      }
    }
    return null;
  };

  return visit(input, 0) ?? fallback;
}

/**
 * Build a redacted, single-line diagnostic string for SERVER-SIDE logs only.
 * Never send the result to a browser.
 */
export function redactAuthDiagnostic(input: unknown): string {
  let raw: string;

  if (input instanceof Error) {
    raw = `${input.name}: ${input.message}`;
  } else if (typeof input === 'string') {
    raw = input;
  } else {
    try {
      raw = JSON.stringify(input) ?? String(input);
    } catch {
      raw = '[unserializable error]';
    }
  }

  return raw
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[email]')
    .replace(/eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]+\.?[A-Za-z0-9_-]*/g, '[jwt]')
    .replace(/\b(?:sk|pk|rk|whsec)_[A-Za-z0-9_-]{6,}/gi, '[key]')
    .replace(
      /("?(?:password|token|secret|api[_-]?key)"?\s*[:=]\s*)("[^"]*"|'[^']*'|[^\s,&}]+)/gi,
      '$1[redacted]'
    )
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 500);
}
