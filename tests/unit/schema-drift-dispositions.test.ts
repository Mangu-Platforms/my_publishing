/**
 * @jest-environment node
 *
 * Task 1.2 — schema-drift dispositions must hold at the write boundary.
 *
 * Every field asserted here is referenced by code but exists in NO migration
 * under supabase/migrations/. PostgREST rejects the whole statement when one
 * column is unknown, so a single drifted field silently broke the entire write.
 * Adding the columns is blocked until hosted migration drift is reconciled
 * (Task 3.6), so the disposition is always code-side: drop it, or remap it onto
 * a column that really exists.
 *
 * These tests run the Supabase branch (DATABASE_PROVIDER unset/supabase), which
 * is still the default for local and preview.
 */
import { AUDIT_LOG_COLUMNS, recordAudit } from '@/lib/audit';

jest.mock('@/lib/server-only-guard', () => ({}));

jest.mock('@/lib/db/provider', () => ({
  isMongoPrimary: () => false,
  getDatabaseProvider: () => 'supabase',
}));

jest.mock('@/lib/mongo', () => ({ getDb: jest.fn() }));

jest.mock('@/lib/mongo-books', () => ({
  createBookAdminMongo: jest.fn(),
  updateBookAdminMongo: jest.fn(),
  setBookStatusMongo: jest.fn(),
  createBookMongo: jest.fn(),
  updateBookMongo: jest.fn(),
}));

jest.mock('@/lib/mongo-queries', () => ({ getBookById: jest.fn() }));

jest.mock('@/lib/supabase/queries', () => ({ revalidateBooks: jest.fn() }));

jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
  revalidateTag: jest.fn(),
}));

const mockSetBookAssets = jest.fn(async () => ({ ok: true }));
// NOT `{ virtual: true }`: @/lib/data/book-assets is a real module, and a
// virtual mock is keyed to the declaring file, so lib/actions/books.ts would
// import the real implementation and these assertions would see zero calls.
jest.mock('@/lib/data/book-assets', () => ({
  setBookAssets: (...args: unknown[]) => mockSetBookAssets(...(args as [])),
}));

// --------------------------------------------------------------------------
// Recording Supabase client (both the session and the service-role client).
// Helpers are `mock`-prefixed because jest.mock factories may not reference
// out-of-scope identifiers otherwise.
// --------------------------------------------------------------------------
type Write = {
  client: 'session' | 'service';
  table: string;
  op: 'insert' | 'update' | 'delete';
  payload?: Record<string, unknown>;
};

const writes: Write[] = [];
const isFilters: Array<{ column: string; value: unknown }> = [];
const resultQueue: Array<{ data: unknown; error: unknown }> = [];
let auditInsertError: { message: string } | null = null;

function nextResult() {
  return resultQueue.shift() ?? { data: null, error: null };
}

function mockMakeChain(client: Write['client'], table: string): Record<string, unknown> {
  const chain: Record<string, unknown> = {};
  chain.select = () => chain;
  chain.eq = () => chain;
  chain.neq = () => chain;
  chain.limit = () => chain;
  chain.range = () => chain;
  chain.order = () => chain;
  chain.is = (column: string, value: unknown) => {
    isFilters.push({ column, value });
    return chain;
  };
  chain.insert = (payload: Record<string, unknown>) => {
    writes.push({ client, table, op: 'insert', payload });
    return chain;
  };
  chain.update = (payload: Record<string, unknown>) => {
    writes.push({ client, table, op: 'update', payload });
    return chain;
  };
  chain.delete = () => {
    writes.push({ client, table, op: 'delete' });
    return chain;
  };
  chain.single = async () => nextResult();
  chain.maybeSingle = async () => nextResult();
  // `audit_logs` inserts are awaited directly on the builder.
  chain.then = (onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
    Promise.resolve(
      table === 'audit_logs' ? { data: null, error: auditInsertError } : nextResult()
    ).then(onFulfilled, onRejected);
  return chain;
}

function mockProfileChain(): Record<string, unknown> {
  const chain: Record<string, unknown> = {};
  chain.select = () => chain;
  chain.eq = () => chain;
  chain.single = async () => ({
    data: { id: 'p1', user_id: 'admin-user', role: 'admin' },
    error: null,
  });
  chain.maybeSingle = chain.single;
  return chain;
}

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({
    auth: {
      getUser: jest.fn(async () => ({ data: { user: { id: 'admin-user' } }, error: null })),
    },
    from: (table: string) =>
      table === 'profiles' ? mockProfileChain() : mockMakeChain('session', table),
  })),
}));

jest.mock('@/lib/supabase/admin', () => ({
  createClient: () => ({
    from: (table: string) => mockMakeChain('service', table),
  }),
}));

/** Referenced by code, present in no migration. Never write these to `books`. */
const DRIFTED_BOOK_COLUMNS = [
  'subtitle',
  'epub_url',
  'manuscript_url',
  'deleted_at',
  'author_name',
  'metadata',
  'tags',
  'categories',
  'view_count',
  'download_count',
];

function expectNoDriftedColumns(payload: Record<string, unknown> | undefined) {
  expect(payload).toBeDefined();
  const keys = Object.keys(payload ?? {});
  for (const column of DRIFTED_BOOK_COLUMNS) {
    expect(keys).not.toContain(column);
  }
}

function bookWrite(op: Write['op']): Record<string, unknown> | undefined {
  return writes.find((w) => w.table === 'books' && w.op === op)?.payload;
}

describe('schema drift — admin book write payloads', () => {
  beforeEach(() => {
    writes.length = 0;
    isFilters.length = 0;
    resultQueue.length = 0;
    auditInsertError = null;
    jest.clearAllMocks();
  });

  it('createBookAdmin writes only real books columns and routes epub to book_content', async () => {
    resultQueue.push(
      { data: null, error: null }, // slug duplicate check
      { data: { id: 'b1', title: 'Drift Free', slug: 'drift-free', status: 'draft' }, error: null }
    );

    const { createBookAdmin } = await import('@/lib/actions/books');
    const result = (await createBookAdmin({
      title: 'Drift Free',
      genre: 'Fiction',
      status: 'draft',
      epub_url: 'https://cdn.example.com/drift-free.epub',
    })) as unknown as { success: boolean; code?: string };

    expect(result.success).toBe(true);
    const payload = bookWrite('insert');
    expectNoDriftedColumns(payload);
    // Visibility is derived from status, so a draft can never leak publicly.
    expect(payload?.visibility).toBe('private');

    // epub_url is an asset, not a books column.
    expect(mockSetBookAssets).toHaveBeenCalledWith('b1', {
      epub_url: 'https://cdn.example.com/drift-free.epub',
    });
  });

  it('updateBookAdmin drops drifted columns and keeps published_at on unpublish', async () => {
    resultQueue.push(
      {
        data: { id: 'b1', status: 'published', published_at: '2026-01-01T00:00:00.000Z' },
        error: null,
      },
      { data: { id: 'b1', slug: 'drift-free', title: 'Renamed' }, error: null }
    );

    const { updateBookAdmin } = await import('@/lib/actions/books');
    const result = (await updateBookAdmin('b1', {
      title: 'Renamed',
      status: 'draft',
      epub_url: 'https://cdn.example.com/renamed.epub',
      amazon_url: 'https://www.amazon.com/dp/123',
    })) as unknown as { success: boolean; code?: string };

    expect(result.success).toBe(true);
    expect(result.code).toBe('BOOK_UPDATED');

    const payload = bookWrite('update');
    expectNoDriftedColumns(payload);
    // Unpublishing must leave the original publication date intact.
    expect(Object.keys(payload ?? {})).not.toContain('published_at');
    expect(payload?.status).toBe('draft');
    expect(payload?.visibility).toBe('private');
    expect(payload?.amazon_url).toBe('https://www.amazon.com/dp/123');

    // Soft delete is gone: no query filters on the non-existent deleted_at.
    expect(isFilters.filter((f) => f.column === 'deleted_at')).toHaveLength(0);
    expect(mockSetBookAssets).toHaveBeenCalledWith('b1', {
      epub_url: 'https://cdn.example.com/renamed.epub',
    });
  });

  it('author-scoped createBook drops author_name / metadata / tags / categories', async () => {
    resultQueue.push(
      { data: null, error: null }, // duplicate check
      { data: { id: 'b2', title: 'Author Book', status: 'draft' }, error: null }
    );

    const { createBook } = await import('@/lib/actions/books');
    const result = (await createBook({
      title: 'Author Book',
      subtitle: 'A subtitle that has no column',
      description: 'Body',
      categories: ['fiction'],
      tags: ['debut'],
      metadata: { chapters: 3 },
      epub_url: 'https://cdn.example.com/author-book.epub',
    })) as unknown as { success: boolean; code?: string };

    expect(result.success).toBe(true);
    expectNoDriftedColumns(bookWrite('insert'));
    expect(isFilters.filter((f) => f.column === 'deleted_at')).toHaveLength(0);
  });

  it('drops the actions whose tables/RPCs exist in no migration', async () => {
    const actions = await import('@/lib/actions/books');
    // books_search RPC + a raw SQL string that was never executed.
    expect('searchBooks' in actions).toBe(false);
    // books.view_count / books.download_count / table book_stats.
    expect('getBookStats' in actions).toBe(false);
    // book_view_cache / book_views / increment_view_count RPC.
    expect('incrementViewCount' in actions).toBe(false);
  });
});

describe('schema drift — audit_logs', () => {
  beforeEach(() => {
    writes.length = 0;
    resultQueue.length = 0;
    auditInsertError = null;
    jest.clearAllMocks();
  });

  it('writes only columns that exist on audit_logs', async () => {
    const result = await recordAudit('admin-user', 'UPDATE', 'b1', {
      resource_type: 'books',
      changes: ['title'],
    });

    expect(result).toEqual({ ok: true });
    const audited = writes.find((w) => w.table === 'audit_logs');
    expect(audited).toBeDefined();
    // The service-role client is mandatory: audit_logs has an admin SELECT
    // policy and NO INSERT policy, so a session client would be denied by RLS.
    expect(audited?.client).toBe('service');

    const payload = audited?.payload ?? {};
    for (const key of Object.keys(payload)) {
      expect(AUDIT_LOG_COLUMNS as readonly string[]).toContain(key);
    }
    // The old column names never existed.
    expect(payload).not.toHaveProperty('resource_type');
    expect(payload).not.toHaveProperty('resource_id');
    expect(payload).not.toHaveProperty('details');
    // ...they are remapped onto the real ones.
    expect(payload.table_name).toBe('books');
    expect(payload.record_id).toBe('b1');
    expect(payload.new_data).toEqual({ changes: ['title'] });
  });

  it('never persists tokens, passwords or private file URLs', async () => {
    await recordAudit('admin-user', 'UPDATE', 'b1', {
      resource_type: 'books',
      access_token: 'super-secret',
      password: 'hunter2',
      manuscript_url: 'https://private.example.com/signed?sig=abc',
    });

    const payload = writes.find((w) => w.table === 'audit_logs')?.payload ?? {};
    const newData = payload.new_data as Record<string, unknown>;
    expect(newData.access_token).toBe('[redacted]');
    expect(newData.password).toBe('[redacted]');
    expect(newData.manuscript_url).toBe('[redacted-url]');
    expect(JSON.stringify(newData)).not.toContain('super-secret');
    expect(JSON.stringify(newData)).not.toContain('sig=abc');
  });

  it('surfaces audit failures instead of swallowing them', async () => {
    auditInsertError = { message: 'column "details" of relation "audit_logs" does not exist' };
    const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    const result = await recordAudit('admin-user', 'UPDATE', 'b1', { resource_type: 'books' });
    expect(result).toEqual({
      ok: false,
      error: 'column "details" of relation "audit_logs" does not exist',
    });
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
