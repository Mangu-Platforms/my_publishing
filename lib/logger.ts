/**
 * Phoenix WS6.1 — Structured JSON logger.
 *
 * Emits JSON lines to stdout. Vercel/Cloud Run picks these up via log drain.
 * Sentry is notified automatically for error-level events when the DSN is set.
 *
 * Usage:
 *   import { logger } from '@/lib/logger';
 *   logger.info('checkout.started', { bookId, userId });
 *   logger.error('webhook.failed', err, { paymentIntentId });
 */

import * as Sentry from '@sentry/nextjs';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  level: LogLevel;
  event: string;
  message?: string;
  requestId?: string;
  route?: string;
  userId?: string;
  durationMs?: number;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  [key: string]: unknown;
}

function emit(entry: LogEntry): void {
  // Vercel/Cloud Run structured log format: single JSON line per event.
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(entry));
}

function buildEntry(
  level: LogLevel,
  event: string,
  extra?: Record<string, unknown>,
  err?: unknown
): LogEntry {
  const entry: LogEntry = {
    level,
    event,
    ts: new Date().toISOString(),
    env: process.env.NODE_ENV,
    ...extra,
  };

  if (err instanceof Error) {
    entry.error = {
      name: err.name,
      message: err.message,
      stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined,
    };
  } else if (err != null) {
    entry.error = { name: 'UnknownError', message: String(err) };
  }

  return entry;
}

export const logger = {
  debug(event: string, extra?: Record<string, unknown>): void {
    if (process.env.NODE_ENV === 'production') return; // debug suppressed in prod
    emit(buildEntry('debug', event, extra));
  },

  info(event: string, extra?: Record<string, unknown>): void {
    emit(buildEntry('info', event, extra));
  },

  warn(event: string, extra?: Record<string, unknown>): void {
    emit(buildEntry('warn', event, extra));
  },

  error(event: string, err?: unknown, extra?: Record<string, unknown>): void {
    const entry = buildEntry('error', event, extra, err);
    emit(entry);

    // Forward to Sentry when DSN is configured.
    const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;
    if (dsn && err instanceof Error) {
      Sentry.captureException(err, { extra: { event, ...extra } });
    }
  },
};

/**
 * Middleware-style wrapper for Next.js API route handlers.
 * Logs the request start/end and any thrown errors.
 *
 * Usage:
 *   export const GET = withLogger('books.list', async (req) => { ... });
 */
export function withLogger<T extends unknown[], R>(
  event: string,
  handler: (...args: T) => Promise<R>
): (...args: T) => Promise<R> {
  return async (...args: T): Promise<R> => {
    const start = Date.now();
    try {
      const result = await handler(...args);
      logger.info(`${event}.ok`, { durationMs: Date.now() - start });
      return result;
    } catch (err) {
      logger.error(`${event}.error`, err, { durationMs: Date.now() - start });
      throw err;
    }
  };
}
