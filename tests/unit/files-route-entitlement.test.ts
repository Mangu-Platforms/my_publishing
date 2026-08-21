/** @jest-environment node */

/**
 * GET /api/files/[id] — authorization domain regression tests.
 *
 * Supabase mode (live prod): orders.user_id stores profiles.id and
 * books.author_id stores authors.id. Neither is the auth user id, so the
 * route must resolve profiles/authors rows before comparing — matching the
 * auth uid directly can never succeed (the pre-fix 403-for-every-purchaser bug).
 */

import { GET } from '@/app/api/files/[id]/route';
import { createClient as createAdminClient } from '@/lib/supabase/admin';
import { createClient as createServerClient } from '@/lib/supabase/server';

jest.mock('next/server', () => {
  class MockNextResponse {
    status: number;
    headers: Headers;
    body: unknown;
    private jsonBody: unknown;

    constructor(body: unknown, init: { status?: number; headers?: HeadersInit } = {}) {
      this.body = body;
      this.status = init.status ?? 200;
      this.headers = new Headers(init.headers);
    }

    static json(body: unknown, init: { status?: number; headers?: HeadersInit } = {}) {
      const response = new MockNextResponse(null, init);
      response.jsonBody = body;
      return response;
    }

    async json() {
      return this.jsonBody;
    }
  }
  return { NextResponse: MockNextResponse };
});
jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn() }));
jest.mock('@/lib/supabase/admin', () => ({ createClient: jest.fn() }));

const mockedAdmin = createAdminClient as jest.MockedFunction<typeof createAdminClient>;
const mockedServer = createServerClient as jest.MockedFunction<typeof createServerClient>;

const AUTH_UID = 'auth-uid-1111';
const PROFILE_ID = 'profile-2222';
const AUTHOR_ID = 'author-3333';
const BOOK_ID = 'book-4444';

type TableResult = { data: unknown; error?: unknown };

/** FIFO of results per table; each from(table) call consumes one entry. */
function adminWithQueues(queues: Record<string, TableResult[]>) {
  const from = jest.fn((table: string) => {
    const result = queues[table]?.shift() ?? { data: null, error: null };
    const chain: Record<string, unknown> = {};
    for (const method of ['select', 'eq', 'limit']) {
      chain[method] = jest.fn(() => chain);
    }
    chain.maybeSingle = jest.fn(async () => ({ error: null, ...result }));
    return chain;
  });
  return { client: { from } as never, from };
}

function signedInAs(userId: string | null) {
  mockedServer.mockResolvedValue({
    auth: {
      getUser: jest.fn(async () => ({ data: { user: userId ? { id: userId } : null } })),
    },
  } as never);
}

function request(): Request {
  return { headers: new Headers() } as Request;
}

const params = { params: { id: BOOK_ID } };

const bookRow: TableResult = { data: { author_id: AUTHOR_ID } };
const contentRow: TableResult = {
  data: { epub_url: 'https://files.example/manuscript.epub', pdf_url: null },
};

describe('GET /api/files/[id] authorization (Supabase mode)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn(async () => ({
      ok: true,
      headers: new Headers({ 'content-type': 'application/epub+zip' }),
      body: 'stream',
    })) as never;
  });

  it('streams the file to a purchaser whose order is keyed by profiles.id', async () => {
    signedInAs(AUTH_UID);
    const { client } = adminWithQueues({
      books: [bookRow],
      book_content: [contentRow],
      // 1: role lookup, 2: author-owner resolution, 3: purchase resolution
      profiles: [
        { data: { role: 'reader' } },
        { data: { id: PROFILE_ID } },
        { data: { id: PROFILE_ID } },
      ],
      authors: [{ data: null }],
      orders: [{ data: { id: 'order-1', items: [{ book_id: BOOK_ID }] } }],
    });
    mockedAdmin.mockReturnValue(client);

    const response = await GET(request(), params);

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Disposition')).toContain('attachment');
  });

  it('403s a signed-in reader with no completed order', async () => {
    signedInAs(AUTH_UID);
    const { client } = adminWithQueues({
      books: [bookRow],
      book_content: [contentRow],
      profiles: [
        { data: { role: 'reader' } },
        { data: { id: PROFILE_ID } },
        { data: { id: PROFILE_ID } },
      ],
      authors: [{ data: null }],
      orders: [{ data: null }],
    });
    mockedAdmin.mockReturnValue(client);

    const response = await GET(request(), params);

    expect(response.status).toBe(403);
  });

  it('streams to the author-owner resolved through authors.profile_id', async () => {
    signedInAs(AUTH_UID);
    const { client } = adminWithQueues({
      books: [bookRow],
      book_content: [contentRow],
      profiles: [{ data: { role: 'author' } }, { data: { id: PROFILE_ID } }],
      authors: [{ data: { id: AUTHOR_ID } }],
    });
    mockedAdmin.mockReturnValue(client);

    const response = await GET(request(), params);

    expect(response.status).toBe(200);
  });

  it('does not treat an auth uid matching books.author_id as ownership', async () => {
    // Regression: the old check compared book.author_id === auth uid directly.
    signedInAs(AUTHOR_ID);
    const { client } = adminWithQueues({
      books: [bookRow],
      book_content: [contentRow],
      profiles: [{ data: { role: 'reader' } }, { data: null }, { data: null }],
      authors: [],
      orders: [],
    });
    mockedAdmin.mockReturnValue(client);

    const response = await GET(request(), params);

    expect(response.status).toBe(403);
  });

  it('401s when unauthenticated', async () => {
    signedInAs(null);
    mockedAdmin.mockReturnValue(adminWithQueues({}).client);

    const response = await GET(request(), params);

    expect(response.status).toBe(401);
  });
});
