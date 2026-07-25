/** @jest-environment node */

import { GET as getReviews, POST as postReview } from '@/app/api/reviews/route';
import { POST as postHelpful } from '@/app/api/reviews/[id]/helpful/route';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@/lib/supabase/admin';
import { enforceRateLimit } from '@/lib/rate-limit';
import { listPublicReviewsPage } from '@/lib/data/reviews';
import type { NextRequest } from 'next/server';

jest.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init: { status?: number; headers?: HeadersInit } = {}) => ({
      status: init.status ?? 200,
      headers: new Headers(init.headers),
      json: async () => body,
    }),
  },
}));
jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn() }));
jest.mock('@/lib/supabase/admin', () => ({ createClient: jest.fn() }));
jest.mock('@/lib/rate-limit', () => ({
  enforceRateLimit: jest.fn(),
  getClientIdentifier: jest.fn(() => 'test-client'),
}));
jest.mock('@/lib/db/provider', () => ({
  isMongoPrimary: jest.fn(() => false),
  getDatabaseProvider: jest.fn(() => 'supabase'),
}));
jest.mock('@/lib/server-only-guard', () => ({}));
jest.mock('@/lib/data/reviews', () => ({
  listPublicReviewsPage: jest.fn(),
}));

const mockedListPublicReviewsPage = listPublicReviewsPage as jest.MockedFunction<
  typeof listPublicReviewsPage
>;

const mockedCreateClient = createClient as jest.MockedFunction<typeof createClient>;
const mockedCreateAdminClient = createAdminClient as jest.MockedFunction<typeof createAdminClient>;
const mockedEnforceRateLimit = enforceRateLimit as jest.MockedFunction<typeof enforceRateLimit>;

const BOOK_ID = '550e8400-e29b-41d4-a716-446655440000';
const REVIEW_ID = '660e8400-e29b-41d4-a716-446655440000';
const USER_ID = '11111111-1111-4111-8111-111111111111';

function getRequest(url: string): NextRequest {
  return { headers: new Headers(), nextUrl: new URL(url) } as unknown as NextRequest;
}

function jsonRequest(body: unknown): NextRequest {
  return {
    headers: new Headers(),
    json: jest.fn().mockResolvedValue(body),
  } as unknown as NextRequest;
}

function mockAuthUser(user: { id: string } | null) {
  mockedCreateClient.mockResolvedValue({
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user } }) },
  } as never);
}

/**
 * Chainable-thenable query mock: every builder method returns itself and the
 * chain resolves to `resolved` whether awaited directly or via .single().
 */
function makeQuery(resolved: unknown) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const q: any = {};
  for (const method of [
    'select',
    'eq',
    'neq',
    'in',
    'order',
    'range',
    'limit',
    'insert',
    'update',
    'upsert',
    'delete',
  ]) {
    q[method] = jest.fn(() => q);
  }
  q.single = jest.fn().mockResolvedValue(resolved);
  q.maybeSingle = jest.fn().mockResolvedValue(resolved);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  q.then = (onFulfilled: any, onRejected: any) =>
    Promise.resolve(resolved).then(onFulfilled, onRejected);
  return q;
}

function mockAdminByTable(tables: Record<string, unknown>) {
  mockedCreateAdminClient.mockReturnValue({
    from: jest.fn((table: string) => makeQuery(tables[table] ?? { data: null, error: null })),
  } as never);
}

describe('reviews API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedEnforceRateLimit.mockResolvedValue({
      success: true,
      reason: 'ok',
      limit: 30,
      remaining: 29,
      reset: Date.now() + 60_000,
      headers: {},
    });
    mockAuthUser(null);
  });

  describe('GET /api/reviews', () => {
    it('rejects when the rate limiter says no', async () => {
      mockedEnforceRateLimit.mockResolvedValue({
        success: false,
        reason: 'limited',
        limit: 30,
        remaining: 0,
        reset: Date.now() + 30_000,
        headers: { 'Retry-After': '30' },
      });

      const response = await getReviews(getRequest(`https://x.test/api/reviews?bookId=${BOOK_ID}`));

      expect(response.status).toBe(429);
      expect(mockedListPublicReviewsPage).not.toHaveBeenCalled();
    });

    it('rejects an invalid bookId', async () => {
      const response = await getReviews(getRequest('https://x.test/api/reviews?bookId=nope'));

      expect(response.status).toBe(400);
      expect(mockedListPublicReviewsPage).not.toHaveBeenCalled();
    });

    it('returns paginated reviews with stats via listPublicReviewsPage', async () => {
      const reviewRow = {
        id: REVIEW_ID,
        book_id: BOOK_ID,
        user_id: USER_ID,
        rating: 5,
        title: 'Great',
        content: 'Loved it, highly recommended.',
        is_spoiler: false,
        is_public: true,
        helpful_count: 2,
        verified_purchase: true,
        author_reply: null,
        author_reply_at: null,
        created_at: '2026-07-01T00:00:00Z',
        updated_at: '2026-07-01T00:00:00Z',
        user_vote: null,
        user: { id: USER_ID, username: 'Reader One', full_name: 'Reader One' },
      };
      mockedListPublicReviewsPage.mockResolvedValue({
        reviews: [reviewRow],
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1,
        stats: {
          average: 5,
          total: 1,
          distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 1 },
          verifiedCount: 1,
        },
      });
      mockAdminByTable({
        review_votes: { data: [], error: null },
      });

      const response = await getReviews(
        getRequest(`https://x.test/api/reviews?bookId=${BOOK_ID}&sort=recent&page=1&limit=10`)
      );

      expect(response.status).toBe(200);
      expect(mockedListPublicReviewsPage).toHaveBeenCalledWith({
        bookId: BOOK_ID,
        sort: 'recent',
        page: 1,
        limit: 10,
      });
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.data.reviews).toHaveLength(1);
      expect(body.data.reviews[0].verified_purchase).toBe(true);
      expect(body.data.reviews[0].user.full_name).toBe('Reader One');
      expect(body.data.stats.distribution[5]).toBe(1);
      expect(body.data.stats.verifiedCount).toBe(1);
      expect(body.data.totalPages).toBe(1);
    });

    it('returns 503 when the dual-run helper throws', async () => {
      mockedListPublicReviewsPage.mockRejectedValue(new Error('db down'));

      const response = await getReviews(getRequest(`https://x.test/api/reviews?bookId=${BOOK_ID}`));

      expect(response.status).toBe(503);
      const body = await response.json();
      expect(body.success).toBe(false);
    });
  });

  describe('POST /api/reviews', () => {
    const validBody = {
      book_id: BOOK_ID,
      rating: 4,
      title: 'Solid read',
      content: 'Really enjoyed this one, would read again.',
      is_spoiler: false,
    };

    it('rejects unauthenticated callers', async () => {
      const response = await postReview(jsonRequest(validBody));

      expect(response.status).toBe(401);
      expect(mockedCreateAdminClient).not.toHaveBeenCalled();
    });

    it('rejects invalid payloads before auth/database work', async () => {
      const response = await postReview(jsonRequest({ book_id: 'nope', rating: 9 }));

      expect(response.status).toBe(400);
    });

    it('updates an existing review and flags verified purchases', async () => {
      mockAuthUser({ id: USER_ID });
      mockAdminByTable({
        books: { data: { id: BOOK_ID }, error: null },
        profiles: { data: { id: 'profile-1' }, error: null },
        orders: { data: { id: 'order-1', items: [{ book_id: BOOK_ID }] }, error: null },
        reviews: { data: { id: REVIEW_ID }, error: null },
      });

      const response = await postReview(jsonRequest(validBody));

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.data.verified_purchase).toBe(true);
    });

    it('still posts when the purchase lookup finds no order', async () => {
      mockAuthUser({ id: USER_ID });
      mockAdminByTable({
        books: { data: { id: BOOK_ID }, error: null },
        profiles: { data: { id: 'profile-1' }, error: null },
        orders: { data: null, error: null },
        reviews: { data: { id: REVIEW_ID }, error: null },
      });

      const response = await postReview(jsonRequest(validBody));

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.data.verified_purchase).toBe(false);
    });
  });

  describe('POST /api/reviews/[id]/helpful', () => {
    it('rejects an invalid review id', async () => {
      const response = await postHelpful(jsonRequest({ helpful: true }), {
        params: { id: 'not-a-uuid' },
      });

      expect(response.status).toBe(400);
    });

    it('rejects unauthenticated voters', async () => {
      const response = await postHelpful(jsonRequest({ helpful: true }), {
        params: { id: REVIEW_ID },
      });

      expect(response.status).toBe(401);
      expect(mockedCreateAdminClient).not.toHaveBeenCalled();
    });

    it('records a helpful vote and returns the recount', async () => {
      mockAuthUser({ id: USER_ID });
      mockAdminByTable({
        reviews: { data: { id: REVIEW_ID }, error: null },
        review_votes: { data: null, error: null, count: 3 },
      });

      const response = await postHelpful(jsonRequest({ helpful: true }), {
        params: { id: REVIEW_ID },
      });

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.data.helpful_count).toBe(3);
      expect(body.data.user_vote).toBe(true);
    });
  });
});
