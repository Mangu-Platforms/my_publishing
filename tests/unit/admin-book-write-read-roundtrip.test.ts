/**
 * @jest-environment node
 *
 * Task 1.0 acceptance test — the admin write path and the public read path must
 * talk to the SAME database.
 *
 * Production runs DATABASE_PROVIDER=mongodb, so `lib/data/books.ts` reads
 * MongoDB. Before this change `createBookAdmin` / `updateBookAdmin` /
 * `updateBookStatusAction` called the Supabase service-role client
 * unconditionally, so a book published through the admin UI could never appear
 * on the site. This test drives the real server actions against an in-memory
 * Mongo store that BOTH the write mocks and the read mocks share: if a write
 * ever goes somewhere the reads do not look, the round trip fails.
 *
 * Mocking style follows tests/unit/data-catalog-dual-run.test.ts.
 */
import { slugifyBookTitle, visibilityForStatus } from '@/lib/books/fields';

jest.mock('mongodb', () => ({
  ObjectId: class ObjectId {
    id: string;
    constructor(id: string = '000000000000000000000000') {
      this.id = id;
    }
    toString() {
      return this.id;
    }
    static isValid(id: string) {
      return /^[a-fA-F0-9]{24}$/.test(id);
    }
  },
}));

jest.mock('@/lib/server-only-guard', () => ({}));

// --------------------------------------------------------------------------
// Provider: production setting.
// --------------------------------------------------------------------------
const mockIsMongoPrimary = jest.fn(() => true);

jest.mock('@/lib/db/provider', () => ({
  isMongoPrimary: () => mockIsMongoPrimary(),
  getDatabaseProvider: () => (mockIsMongoPrimary() ? 'mongodb' : 'supabase'),
}));

// --------------------------------------------------------------------------
// The one shared "database".
// --------------------------------------------------------------------------
type BookDoc = {
  _id: string;
  title: string;
  slug: string;
  description: string | null;
  genre: string | null;
  price: number;
  content_type: string;
  author_id: string;
  cover_url: string | null;
  status: string;
  visibility: string;
  published_at: Date | null;
  created_at: Date;
  updated_at: Date;
  avg_rating: number;
  review_count: number;
};

const bookStore = new Map<string, BookDoc>();
let idCounter = 0;

function matches(doc: BookDoc, filter?: Record<string, unknown>): boolean {
  if (!filter) return true;
  return Object.entries(filter).every(
    ([key, value]) => (doc as unknown as Record<string, unknown>)[key] === value
  );
}

// --------------------------------------------------------------------------
// Write side (@/lib/mongo-books) — Agent E's helpers, faked over bookStore.
// --------------------------------------------------------------------------
const mockCreateBookAdminMongo = jest.fn(
  (input: Partial<BookDoc> & { title: string; status?: string }) => {
    const now = new Date();
    const status = input.status ?? 'draft';
    const _id = `book-${++idCounter}`;
    const doc: BookDoc = {
      _id,
      title: input.title,
      slug: input.slug ?? slugifyBookTitle(input.title),
      description: input.description ?? null,
      genre: input.genre ?? null,
      price: input.price ?? 0,
      content_type: input.content_type ?? 'book',
      author_id: input.author_id ?? 'author-1',
      cover_url: input.cover_url ?? null,
      status,
      // The helpers derive visibility from status — without it a published book
      // stays `private` and never reaches the catalog.
      visibility: visibilityForStatus(status as 'draft' | 'published' | 'archived'),
      published_at: status === 'published' ? now : null,
      created_at: now,
      updated_at: now,
      avg_rating: 0,
      review_count: 0,
    };
    bookStore.set(_id, doc);
    return Promise.resolve({ book: doc });
  }
);

const mockUpdateBookAdminMongo = jest.fn((id: string, patch: Record<string, unknown>) => {
  const doc = bookStore.get(id);
  if (!doc) return Promise.resolve({ error: 'Book not found', code: 'NOT_FOUND' });
  Object.assign(doc, patch);
  if (typeof patch.status === 'string') {
    doc.visibility = visibilityForStatus(patch.status as 'draft' | 'published' | 'archived');
    if (patch.status === 'published' && !doc.published_at) doc.published_at = new Date();
  }
  doc.updated_at = new Date();
  return Promise.resolve({ book: doc });
});

const mockSetBookStatusMongo = jest.fn((id: string, status: string) => {
  const doc = bookStore.get(id);
  if (!doc) return Promise.resolve({ error: 'Book not found', code: 'NOT_FOUND' });
  doc.status = status;
  doc.visibility = visibilityForStatus(status as 'draft' | 'published' | 'archived');
  // Never nulls published_at on unpublish.
  if (status === 'published' && !doc.published_at) doc.published_at = new Date();
  doc.updated_at = new Date();
  return Promise.resolve({ book: doc });
});

jest.mock('@/lib/mongo-books', () => ({
  createBookAdminMongo: (...args: unknown[]) =>
    mockCreateBookAdminMongo(...(args as [BookDoc & { title: string }])),
  updateBookAdminMongo: (...args: unknown[]) =>
    mockUpdateBookAdminMongo(...(args as [string, Record<string, unknown>])),
  setBookStatusMongo: (...args: unknown[]) =>
    mockSetBookStatusMongo(...(args as [string, string])),
  createBookMongo: jest.fn(),
  updateBookMongo: jest.fn(),
}));

// --------------------------------------------------------------------------
// Read side (@/lib/mongo-queries + @/lib/mongo) — same store.
// --------------------------------------------------------------------------
jest.mock('@/lib/mongo-queries', () => ({
  createBook: jest.fn(),
  updateBook: jest.fn(),
  getBooks: jest.fn(),
  searchBooks: jest.fn(async () => ({ items: [], total: 0, page: 1, perPage: 20 })),
  getBookById: jest.fn(async (id: string, filter?: Record<string, unknown>) => {
    const doc = bookStore.get(id);
    return doc && matches(doc, filter) ? doc : null;
  }),
  getBookBySlug: jest.fn(async (slug: string, filter?: Record<string, unknown>) => {
    const doc = [...bookStore.values()].find((b) => b.slug === slug);
    return doc && matches(doc, filter) ? doc : null;
  }),
}));

jest.mock('@/lib/mongo', () => ({
  getDb: jest.fn(async () => ({
    collection: () => ({
      aggregate: (pipeline: Array<Record<string, Record<string, unknown>>>) => ({
        toArray: async () => {
          const match = (pipeline[0]?.$match ?? {}) as Record<string, unknown>;
          const items = [...bookStore.values()].filter((doc) => matches(doc, match));
          return [{ items, total: [{ count: items.length }] }];
        },
      }),
      countDocuments: jest.fn(),
    }),
  })),
}));

// --------------------------------------------------------------------------
// Auth stays on Supabase (locked architecture) — the WRITE must not.
// --------------------------------------------------------------------------
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({
    auth: {
      getUser: jest.fn(async () => ({ data: { user: { id: 'admin-user' } }, error: null })),
    },
    from: () => {
      const chain: Record<string, unknown> = {};
      chain.select = () => chain;
      chain.eq = () => chain;
      chain.single = async () => ({
        data: { id: 'p1', user_id: 'admin-user', role: 'admin' },
        error: null,
      });
      chain.maybeSingle = chain.single;
      return chain;
    },
  })),
}));

/** Any use of the Supabase service-role client under Mongo primary is the bug. */
const mockCreateSupabaseAdminClient = jest.fn(() => {
  throw new Error('Supabase service-role client used while DATABASE_PROVIDER=mongodb');
});

jest.mock('@/lib/supabase/admin', () => ({
  createClient: () => mockCreateSupabaseAdminClient(),
}));

jest.mock('@/lib/supabase/queries', () => ({ revalidateBooks: jest.fn() }));

jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
  revalidateTag: jest.fn(),
}));

const mockRecordAudit = jest.fn(async () => ({ ok: true }));
jest.mock('@/lib/audit', () => ({
  recordAudit: (...args: unknown[]) => mockRecordAudit(...(args as [])),
}));

const mockSetBookAssets = jest.fn(async () => ({ ok: true }));
jest.mock(
  '@/lib/data/book-assets',
  () => ({ setBookAssets: (...args: unknown[]) => mockSetBookAssets(...(args as [])) }),
  { virtual: true }
);

type ActionResult = { success: boolean; code?: string; error?: string; data?: BookDoc };

function statusForm(bookId: string, status: string): FormData {
  const form = new FormData();
  form.set('bookId', bookId);
  form.set('status', status);
  return form;
}

describe('Task 1.0 — admin write ↔ public read round trip (DATABASE_PROVIDER=mongodb)', () => {
  beforeEach(() => {
    bookStore.clear();
    jest.clearAllMocks();
    mockIsMongoPrimary.mockReturnValue(true);
  });

  it('draft is invisible, publish makes it visible, unpublish hides it again', async () => {
    const { createBookAdmin } = await import('@/lib/actions/books');
    const { updateBookStatusAction } = await import('@/app/admin/actions');
    const { listPublishedBooks, fetchBookForApi } = await import('@/lib/data/books');

    // 1. Create a draft through the admin action.
    const created = (await createBookAdmin({
      title: 'Round Trip Book',
      genre: 'Fiction',
      status: 'draft',
    })) as unknown as ActionResult;

    expect(created.success).toBe(true);
    expect(created.code).toBe('BOOK_CREATED');
    expect(mockCreateBookAdminMongo).toHaveBeenCalledTimes(1);
    const bookId = String(created.data?._id);
    const slug = String(created.data?.slug);

    // ... and the public read path must NOT see it.
    const draftList = await listPublishedBooks({});
    expect(draftList.books.map((b) => b.id)).not.toContain(bookId);
    await expect(fetchBookForApi({ id: bookId })).resolves.toBeNull();
    await expect(fetchBookForApi({ slug })).resolves.toBeNull();

    // 2. Publish it from the admin list view.
    await updateBookStatusAction(statusForm(bookId, 'published'));
    expect(mockSetBookStatusMongo).toHaveBeenCalledWith(bookId, 'published');

    const publishedList = await listPublishedBooks({});
    expect(publishedList.books.map((b) => b.id)).toContain(bookId);
    expect(publishedList.total).toBe(1);

    const detail = await fetchBookForApi({ id: bookId });
    expect(detail?.id).toBe(bookId);
    expect(detail?.title).toBe('Round Trip Book');
    await expect(fetchBookForApi({ slug })).resolves.not.toBeNull();

    // 3. Unpublish — it must disappear from both read paths.
    await updateBookStatusAction(statusForm(bookId, 'draft'));

    const unpublishedList = await listPublishedBooks({});
    expect(unpublishedList.books.map((b) => b.id)).not.toContain(bookId);
    await expect(fetchBookForApi({ id: bookId })).resolves.toBeNull();
  });

  it('unpublishing preserves the original published_at', async () => {
    const { createBookAdmin } = await import('@/lib/actions/books');
    const { updateBookStatusAction } = await import('@/app/admin/actions');

    const created = (await createBookAdmin({
      title: 'Publication Date Survives',
      genre: 'Fiction',
      status: 'published',
    })) as unknown as ActionResult;
    const bookId = String(created.data?._id);
    const firstPublishedAt = bookStore.get(bookId)?.published_at;
    expect(firstPublishedAt).toBeInstanceOf(Date);

    await updateBookStatusAction(statusForm(bookId, 'draft'));
    expect(bookStore.get(bookId)?.published_at).toEqual(firstPublishedAt);

    await updateBookStatusAction(statusForm(bookId, 'published'));
    expect(bookStore.get(bookId)?.published_at).toEqual(firstPublishedAt);
  });

  it('accepts archived — the third status the edit form offers', async () => {
    const { createBookAdmin } = await import('@/lib/actions/books');
    const { updateBookStatusAction } = await import('@/app/admin/actions');
    const { fetchBookForApi } = await import('@/lib/data/books');

    const created = (await createBookAdmin({
      title: 'Archivable',
      genre: 'Fiction',
      status: 'published',
    })) as unknown as ActionResult;
    const bookId = String(created.data?._id);

    await updateBookStatusAction(statusForm(bookId, 'archived'));
    expect(mockSetBookStatusMongo).toHaveBeenCalledWith(bookId, 'archived');
    expect(bookStore.get(bookId)?.status).toBe('archived');
    expect(bookStore.get(bookId)?.visibility).not.toBe('public');
    await expect(fetchBookForApi({ id: bookId })).resolves.toBeNull();
  });

  it('no admin write path targets a database no read path consults', async () => {
    const { createBookAdmin, updateBookAdmin } = await import('@/lib/actions/books');
    const { updateBookStatusAction } = await import('@/app/admin/actions');
    const { fetchBookForApi } = await import('@/lib/data/books');

    const created = (await createBookAdmin({
      title: 'Single Source Of Truth',
      genre: 'Fiction',
      status: 'published',
    })) as unknown as ActionResult;
    const bookId = String(created.data?._id);

    await updateBookAdmin(bookId, { title: 'Renamed In Mongo' });
    await updateBookStatusAction(statusForm(bookId, 'published'));

    // Every write landed on the Mongo helpers...
    expect(mockCreateBookAdminMongo).toHaveBeenCalled();
    expect(mockUpdateBookAdminMongo).toHaveBeenCalled();
    expect(mockSetBookStatusMongo).toHaveBeenCalled();
    // ...and the Supabase service-role client was never even constructed.
    expect(mockCreateSupabaseAdminClient).not.toHaveBeenCalled();
    // ...and the read path sees exactly what the writes produced.
    const detail = await fetchBookForApi({ id: bookId });
    expect(detail?.title).toBe('Renamed In Mongo');
  });
});
