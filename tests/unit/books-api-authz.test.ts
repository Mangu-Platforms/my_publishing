/** @jest-environment node */

/**
 * Books API attribution/ownership hardening.
 *
 * books.author_id references authors.id (never profiles.id, never the auth
 * uid). POST must not accept arbitrary attribution from non-admins, and
 * PATCH must not let the NULL-owner truthiness short-circuit skip the
 * ownership check on orphaned books.
 */

import { POST as createBook } from '@/app/api/books/route';
import { PATCH as patchBook } from '@/app/api/books/[id]/route';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { resolveCallerAuthorIds } from '@/lib/api/author-scope';
import { createBookForApi, fetchBookForApi, patchBookForApi } from '@/lib/data/books';
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
jest.mock('@/lib/api/author-scope', () => ({ resolveCallerAuthorIds: jest.fn() }));
jest.mock('@/lib/data/books', () => ({
  createBookForApi: jest.fn(),
  fetchBookForApi: jest.fn(),
  patchBookForApi: jest.fn(),
  listPublishedBooks: jest.fn(),
}));
jest.mock('@/lib/rate-limit', () => ({
  enforceRateLimit: jest.fn(async () => ({ success: true, headers: {} })),
  getClientIdentifier: jest.fn(() => 'test-client'),
}));

const mockedServer = createServerClient as jest.MockedFunction<typeof createServerClient>;
const mockedResolveAuthorIds = resolveCallerAuthorIds as jest.MockedFunction<
  typeof resolveCallerAuthorIds
>;
const mockedCreate = createBookForApi as jest.MockedFunction<typeof createBookForApi>;
const mockedFetch = fetchBookForApi as jest.MockedFunction<typeof fetchBookForApi>;
const mockedPatch = patchBookForApi as jest.MockedFunction<typeof patchBookForApi>;

const OWN_AUTHOR_ID = 'author-own';
const FOREIGN_AUTHOR_ID = 'author-foreign';

function sessionAs(role: string | null) {
  mockedServer.mockResolvedValue({
    auth: {
      getUser: jest.fn(async () => ({ data: { user: role ? { id: 'auth-uid' } : null } })),
    },
    from: jest.fn(() => {
      const chain: Record<string, unknown> = {};
      for (const method of ['select', 'eq']) chain[method] = jest.fn(() => chain);
      chain.maybeSingle = jest.fn(async () => ({
        data: role ? { id: 'profile-1', role } : null,
      }));
      return chain;
    }),
  } as never);
}

function jsonRequest(body: unknown): NextRequest {
  return {
    headers: new Headers(),
    json: jest.fn().mockResolvedValue(body),
  } as unknown as NextRequest;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockedCreate.mockResolvedValue({ id: 'book-1' } as never);
  mockedPatch.mockResolvedValue({ id: 'book-1' } as never);
});

describe('POST /api/books attribution', () => {
  it('rejects a non-admin naming a foreign author_id', async () => {
    sessionAs('author');
    mockedResolveAuthorIds.mockResolvedValue([OWN_AUTHOR_ID]);

    const response = await createBook(jsonRequest({ title: 'Book', author_id: FOREIGN_AUTHOR_ID }));

    expect(response.status).toBe(403);
    expect(mockedCreate).not.toHaveBeenCalled();
  });

  it('attributes a non-admin create to their own authors row', async () => {
    sessionAs('author');
    mockedResolveAuthorIds.mockResolvedValue([OWN_AUTHOR_ID]);

    const response = await createBook(jsonRequest({ title: 'Book' }));

    expect(response.status).toBe(201);
    expect(mockedCreate).toHaveBeenCalledWith(
      expect.objectContaining({ author_id: OWN_AUTHOR_ID })
    );
  });

  it('403s a non-admin with no authors row', async () => {
    sessionAs('partner');
    mockedResolveAuthorIds.mockResolvedValue([]);

    const response = await createBook(jsonRequest({ title: 'Book' }));

    expect(response.status).toBe(403);
    expect(mockedCreate).not.toHaveBeenCalled();
  });

  it('requires author_id from admins instead of a wrong-domain fallback', async () => {
    sessionAs('admin');

    const response = await createBook(jsonRequest({ title: 'Book' }));

    expect(response.status).toBe(400);
    expect(mockedCreate).not.toHaveBeenCalled();
  });

  it('lets an admin attribute explicitly', async () => {
    sessionAs('admin');

    const response = await createBook(jsonRequest({ title: 'Book', author_id: FOREIGN_AUTHOR_ID }));

    expect(response.status).toBe(201);
    expect(mockedCreate).toHaveBeenCalledWith(
      expect.objectContaining({ author_id: FOREIGN_AUTHOR_ID })
    );
  });
});

describe('PATCH /api/books/[id] ownership', () => {
  const context = { params: { id: 'book-1' } };

  it('403s a non-admin patching an orphaned (NULL author_id) book', async () => {
    sessionAs('author');
    mockedResolveAuthorIds.mockResolvedValue([OWN_AUTHOR_ID]);
    mockedFetch.mockResolvedValue({ id: 'book-1', author_id: undefined } as never);

    const response = await patchBook(jsonRequest({ title: 'New' }), context);

    expect(response.status).toBe(403);
    expect(mockedPatch).not.toHaveBeenCalled();
  });

  it("403s a non-admin patching another author's book", async () => {
    sessionAs('author');
    mockedResolveAuthorIds.mockResolvedValue([OWN_AUTHOR_ID]);
    mockedFetch.mockResolvedValue({ id: 'book-1', author_id: FOREIGN_AUTHOR_ID } as never);

    const response = await patchBook(jsonRequest({ title: 'New' }), context);

    expect(response.status).toBe(403);
    expect(mockedPatch).not.toHaveBeenCalled();
  });

  it('lets an author patch their own book via resolved authors.id', async () => {
    sessionAs('author');
    mockedResolveAuthorIds.mockResolvedValue([OWN_AUTHOR_ID]);
    mockedFetch.mockResolvedValue({ id: 'book-1', author_id: OWN_AUTHOR_ID } as never);

    const response = await patchBook(jsonRequest({ title: 'New' }), context);

    expect(response.status).toBe(200);
    expect(mockedPatch).toHaveBeenCalled();
  });

  it('lets an admin patch an orphaned book', async () => {
    sessionAs('admin');
    mockedFetch.mockResolvedValue({ id: 'book-1', author_id: undefined } as never);

    const response = await patchBook(jsonRequest({ title: 'New' }), context);

    expect(response.status).toBe(200);
    expect(mockedResolveAuthorIds).not.toHaveBeenCalled();
  });
});
