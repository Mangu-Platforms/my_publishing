/** @jest-environment node */

/**
 * WS2b.1.4 — Mongo order upsert idempotency (deliver twice → one logical insert).
 * F-01 — Supabase order idempotency (double delivery → one order, one license).
 */

jest.mock('@/lib/server-only-guard', () => ({}));
jest.mock('@/lib/mongo', () => ({
  getDb: jest.fn(() => {
    throw new Error('inject Db in tests');
  }),
}));

// --- Mocks for driving the webhook route's Supabase path (F-01) --------------
jest.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init: { status?: number; headers?: HeadersInit } = {}) => ({
      status: init.status ?? 200,
      headers: new Headers(init.headers),
      json: async () => body,
    }),
  },
}));
jest.mock('@/lib/supabase/admin', () => ({
  createClient: () => {
    if (!mockSupabaseClient) throw new Error('assign mockSupabaseClient in the test');
    return mockSupabaseClient;
  },
}));
jest.mock('@/lib/rate-limit', () => ({
  enforceRateLimit: jest.fn(async () => ({ success: true, headers: {} })),
  getClientIdentifier: () => 'test-client',
}));
jest.mock('@/lib/stripe/server', () => ({
  // Signature verification is covered by stripe-webhook-consolidation.test.ts;
  // here constructEvent just parses the payload we hand in.
  getStripe: () => ({
    webhooks: { constructEvent: (payload: string) => JSON.parse(payload) },
  }),
}));
jest.mock('@/lib/email/triggers', () => ({
  sendPurchaseReceiptForCheckoutSession: jest.fn(async () => undefined),
}));
jest.mock('@/lib/db/provider', () => ({
  isMongoPrimary: () => false,
}));

import { upsertOrderByPaymentIntent } from '@/lib/mongo-queries';

type Row = Record<string, unknown>;

let mockSupabaseClient: ReturnType<typeof createFakeSupabase> | null = null;

/**
 * Minimal stateful stand-in for the admin client, covering exactly the query
 * chains the webhook uses. It enforces the DB-side uniqueness added by
 * 20260814090000 (partial unique index on payment_intent_id, plus the
 * order_number UNIQUE fallback) by answering duplicate order inserts with
 * SQLSTATE 23505, the way PostgREST surfaces it. `raceMode` makes the
 * pre-insert SELECT on orders always miss, simulating two deliveries that both
 * pass the duplicate check before either insert commits.
 */
function createFakeSupabase({ raceMode = false } = {}) {
  const tables: Record<string, Row[]> = {
    webhook_events: [],
    profiles: [{ id: 'profile-1', user_id: 'user-1' }],
    orders: [],
    order_items: [],
    analytics_events: [],
  };

  const thenable = (result: Row) => ({
    then: (resolve: (value: Row) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject),
  });

  const matches = (row: Row, filters: Array<[string, unknown]>) =>
    filters.every(([col, val]) => row[col] === val);

  const from = (table: string) => ({
    select: () => {
      const filters: Array<[string, unknown]> = [];
      const chain = {
        eq(col: string, val: unknown) {
          filters.push([col, val]);
          return chain;
        },
        limit() {
          return chain;
        },
        async single() {
          const row = tables[table].find((r) => matches(r, filters)) ?? null;
          return { data: row, error: row ? null : { code: 'PGRST116', message: 'no rows' } };
        },
        then(resolve: (value: Row) => unknown, reject?: (reason: unknown) => unknown) {
          const rows =
            table === 'orders' && raceMode ? [] : tables[table].filter((r) => matches(r, filters));
          return Promise.resolve({ data: rows, error: null }).then(resolve, reject);
        },
      };
      return chain;
    },
    insert(row: Row) {
      let error: { code: string; message: string } | null = null;
      let inserted: Row | null = null;
      const duplicateOrder =
        table === 'orders' &&
        tables.orders.some(
          (o) =>
            (row.payment_intent_id != null && o.payment_intent_id === row.payment_intent_id) ||
            o.order_number === row.order_number
        );
      if (duplicateOrder) {
        error = {
          code: '23505',
          message:
            'duplicate key value violates unique constraint "orders_payment_intent_id_unique"',
        };
      } else {
        inserted = { id: `${table}-${tables[table].length + 1}`, ...row };
        tables[table].push(inserted);
      }
      return {
        select: () => ({
          single: async () => ({ data: inserted ? { id: inserted.id } : null, error }),
        }),
        ...thenable({ data: null, error }),
      };
    },
    upsert(row: Row) {
      const existing = tables.webhook_events.find((r) => r.event_id === row.event_id);
      if (existing) {
        Object.assign(existing, row);
      } else {
        tables.webhook_events.push({ ...row });
      }
      return thenable({ data: null, error: null });
    },
    update(patch: Row) {
      return {
        eq: (col: string, val: unknown) => {
          tables[table].filter((r) => r[col] === val).forEach((r) => Object.assign(r, patch));
          return thenable({ data: null, error: null });
        },
      };
    },
  });

  return { from, tables };
}

describe('webhook mongo order idempotency', () => {
  it('second upsert with same PI does not insert again', async () => {
    const stored: Record<string, unknown>[] = [];
    const updateOne = jest.fn(
      async (
        filter: { stripe_payment_intent_id: string },
        update: {
          $setOnInsert: Record<string, unknown>;
        }
      ) => {
        const existing = stored.find(
          (o) => o.stripe_payment_intent_id === filter.stripe_payment_intent_id
        );
        if (existing) {
          return { upsertedCount: 0, matchedCount: 1, modifiedCount: 0 };
        }
        const doc = { _id: `ord-${stored.length + 1}`, ...update.$setOnInsert };
        stored.push(doc);
        return { upsertedCount: 1, matchedCount: 0, modifiedCount: 0 };
      }
    );
    const findOne = jest.fn(async (filter: { stripe_payment_intent_id: string }) => {
      return (
        stored.find((o) => o.stripe_payment_intent_id === filter.stripe_payment_intent_id) ?? null
      );
    });

    const db = {
      collection: () => ({ updateOne, findOne }),
    } as unknown as import('mongodb').Db;

    const payload = {
      user_id: 'user-1',
      stripe_payment_intent_id: 'pi_dup',
      stripe_session_id: 'cs_1',
      amount: 12,
      currency: 'usd',
      order_items: [
        {
          book_id: 'book-1',
          title: 'Book',
          quantity: 1,
          unit_amount: 12,
          currency: 'usd',
        },
      ],
    };

    const a = await upsertOrderByPaymentIntent(payload, db);
    const b = await upsertOrderByPaymentIntent(payload, db);

    expect(a.inserted).toBe(true);
    expect(b.inserted).toBe(false);
    expect(stored).toHaveLength(1);
    expect(a.orderId).toBe(b.orderId);
  });
});

describe('webhook supabase order idempotency (F-01)', () => {
  type RouteResponse = { status: number; json: () => Promise<unknown> };
  let webhookPOST: (request: unknown) => Promise<RouteResponse>;
  let logSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  const session = {
    id: 'cs_test_1',
    payment_intent: 'pi_dup_1',
    amount_total: 1200,
    currency: 'usd',
    metadata: { book_id: 'book-1', user_id: 'user-1', book_slug: 'book' },
  };

  const deliver = (eventId: string) =>
    webhookPOST({
      text: async () =>
        JSON.stringify({
          id: eventId,
          type: 'checkout.session.completed',
          data: { object: session },
        }),
      headers: new Headers({ 'stripe-signature': 'sig' }),
    });

  const resultOf = async (response: RouteResponse) =>
    ((await response.json()) as { result: { success: boolean; action_taken?: string } }).result;

  beforeAll(() => {
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
    // Late require: the route reads STRIPE_WEBHOOK_SECRET at module load time.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    webhookPOST = require('@/app/api/webhook/route').POST;
  });

  beforeEach(() => {
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    logSpy.mockRestore();
    errorSpy.mockRestore();
    mockSupabaseClient = null;
  });

  it('double delivery creates one order and one license, acks the second with 200', async () => {
    const supa = createFakeSupabase();
    mockSupabaseClient = supa;

    const first = await deliver('evt_1');
    // Same session/PI under a fresh event id: the webhook_events dedup cannot
    // catch it, so order-level idempotency has to.
    const second = await deliver('evt_2');

    expect(first.status).toBe(200);
    expect((await resultOf(first)).action_taken).toBe('Order created successfully');

    expect(second.status).toBe(200);
    expect(await resultOf(second)).toMatchObject({
      success: true,
      action_taken: 'Order already exists, skipped duplicate fulfillment',
    });

    expect(supa.tables.orders).toHaveLength(1);
    expect(supa.tables.order_items).toHaveLength(1);
  });

  it('license keys are crypto-random (LIC-<uuid>), not timestamp-derived', async () => {
    const supa = createFakeSupabase();
    mockSupabaseClient = supa;

    await deliver('evt_1');

    const [item] = supa.tables.order_items;
    expect(item.license_key).toMatch(
      /^LIC-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
  });

  it('concurrent race loser (unique violation) acks with 200 instead of double-fulfilling', async () => {
    // raceMode: both deliveries pass the pre-insert SELECT, as when two Stripe
    // retries run concurrently; the partial unique index decides the winner.
    const supa = createFakeSupabase({ raceMode: true });
    mockSupabaseClient = supa;

    const first = await deliver('evt_1');
    const second = await deliver('evt_2');

    expect(first.status).toBe(200);
    expect(second.status).toBe(200); // not 500, so Stripe stops retrying
    expect(await resultOf(second)).toMatchObject({
      success: true,
      action_taken: 'Order already exists, skipped duplicate fulfillment',
    });

    expect(supa.tables.orders).toHaveLength(1);
    expect(supa.tables.order_items).toHaveLength(1); // no second license
  });
});
