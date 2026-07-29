/** @jest-environment node */

/**
 * Task 1.4 — one Stripe webhook endpoint.
 *
 * `app/api/webhook/route.ts` is the real handler (signature verification +
 * fulfillment). `app/api/webhooks/stripe/route.ts` used to be a silent
 * re-export of it, so two live URLs accepted production payment events and
 * nothing recorded which one Stripe was pointed at. The duplicate now answers
 * 410 Gone and names the canonical path.
 */

import fs from 'node:fs';
import path from 'node:path';

jest.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init: { status?: number; headers?: HeadersInit } = {}) => ({
      status: init.status ?? 200,
      headers: new Headers(init.headers),
      json: async () => body,
    }),
  },
}));

import { GET as deprecatedGET, POST as deprecatedPOST } from '@/app/api/webhooks/stripe/route';
import { CANONICAL_WEBHOOK_PATH } from '@/lib/stripe/webhook-paths';

const ROOT = path.resolve(__dirname, '..', '..');
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

describe('deprecated /api/webhooks/stripe', () => {
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  it('names /api/webhook as canonical', () => {
    expect(CANONICAL_WEBHOOK_PATH).toBe('/api/webhook');
  });

  it('answers POST with 410 Gone and a body naming the canonical path', async () => {
    const res = await deprecatedPOST();
    expect(res.status).toBe(410);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toMatchObject({ error: 'endpoint_gone', canonical_path: '/api/webhook' });
    expect(String(body.message)).toContain('/api/webhook');
  });

  it('answers GET with 410 too', async () => {
    expect((await deprecatedGET()).status).toBe(410);
  });

  it('advertises the successor endpoint in headers', async () => {
    const res = await deprecatedPOST();
    expect(res.headers.get('deprecation')).toBe('true');
    expect(res.headers.get('link')).toContain('/api/webhook');
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('logs the misrouted delivery without echoing the unverified payload', async () => {
    await deprecatedPOST();
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(String(errorSpy.mock.calls[0][0])).toContain('/api/webhook');
  });

  it('no longer re-exports the real handler', () => {
    const src = read('app/api/webhooks/stripe/route.ts');
    expect(src).not.toMatch(/export\s*\{[^}]*\}\s*from\s*'\.\.\/\.\.\/webhook\/route'/);
    expect(src).not.toContain('constructEvent');
    expect(src).not.toContain('STRIPE_WEBHOOK_SECRET');
  });
});

describe('canonical /api/webhook contract (read-only assertions)', () => {
  const src = read('app/api/webhook/route.ts');

  it('verifies the Stripe signature against STRIPE_WEBHOOK_SECRET', () => {
    expect(src).toContain('process.env.STRIPE_WEBHOOK_SECRET');
    expect(src).toContain('stripe.webhooks.constructEvent(payload, signature, webhookSecret)');
  });

  it('refuses to run at all without a configured secret, and without a signature header', () => {
    expect(src).toContain("{ error: 'Webhook secret not configured' }, { status: 503 }");
    expect(src).toContain("{ error: 'Missing signature' }, { status: 400 }");
  });

  it('rejects a bad signature with 400 before any fulfillment work', () => {
    const verifyIndex = src.indexOf('Webhook signature verification failed');
    const fulfillIndex = src.indexOf('handleCheckoutCompleted(supabase, session)');
    expect(verifyIndex).toBeGreaterThan(-1);
    expect(fulfillIndex).toBeGreaterThan(verifyIndex);
  });

  it('is idempotent on duplicate delivery', () => {
    // Event-level: webhook_events lookup short-circuits a replayed event id.
    expect(src).toContain('checkIdempotency(supabase, event.id)');
    expect(src).toContain("message: 'Event already processed'");
    // Order-level (Mongo primary): PI-keyed upsert, covered end-to-end by
    // tests/unit/webhook-order-idempotency.test.ts.
    expect(src).toContain('upsertOrderByPaymentIntent');
  });

  it('handles only the events the current commerce model needs', () => {
    const handled = Array.from(src.matchAll(/case '([a-z_]+\.[a-z_.]+)':/g)).map((m) => m[1]);
    expect(handled.sort()).toEqual([
      'charge.refunded',
      'checkout.session.completed',
      'checkout.session.expired',
      'payment_intent.payment_failed',
    ]);
  });

  it('rejects non-POST verbs', () => {
    expect(src).toContain("{ error: 'Method not allowed' }, { status: 405 }");
  });
});
