/**
 * Dual-run admin books list (Phoenix WS2d.1).
 * Default: Supabase admin client. Mongo when DATABASE_PROVIDER=mongodb.
 */

import '@/lib/server-only-guard';

import { isMongoPrimary } from '@/lib/db/provider';
import { RETAILER_URL_FIELDS, type RetailerUrlField } from '@/lib/books/fields';

export type AdminBookListItem = {
  id: string;
  title: string;
  status: string;
  price: number | null;
  author: { pen_name: string | null } | null;
};

export type ListAdminBooksResult = {
  books: AdminBookListItem[];
  total: number;
  page: number;
  perPage: number;
  error: { message: string } | null;
};

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Admin books table — optional title search, status filter, pagination.
 * Preserves Supabase shape: `author.pen_name` from authors join.
 */
export async function listAdminBooks(opts: {
  q?: string;
  status?: string;
  page?: number;
  perPage?: number;
}): Promise<ListAdminBooksResult> {
  const page = Math.max(1, Math.floor(opts.page ?? 1));
  const perPage = Math.min(100, Math.max(1, Math.floor(opts.perPage ?? 10)));
  const queryText = opts.q?.trim() || '';
  const status = opts.status && opts.status !== 'all' ? opts.status : undefined;

  if (isMongoPrimary()) {
    try {
      const { getDb } = await import('@/lib/mongo');
      const db = await getDb();
      const match: Record<string, unknown> = {};
      if (queryText) {
        match.title = { $regex: escapeRegex(queryText), $options: 'i' };
      }
      if (status) match.status = status;

      const skip = (page - 1) * perPage;
      const [facet] = await db
        .collection('books')
        .aggregate([
          { $match: match },
          {
            $facet: {
              items: [
                { $sort: { created_at: -1, _id: 1 } },
                { $skip: skip },
                { $limit: perPage },
                {
                  $lookup: {
                    from: 'authors',
                    localField: 'author_id',
                    foreignField: '_id',
                    as: '_authors',
                  },
                },
                {
                  $addFields: {
                    author: { $ifNull: [{ $arrayElemAt: ['$_authors', 0] }, null] },
                  },
                },
                { $project: { _authors: 0 } },
              ],
              total: [{ $count: 'count' }],
            },
          },
        ])
        .toArray();

      const items = (facet?.items ?? []) as Array<{
        _id: unknown;
        title?: string;
        status?: string;
        price?: number | null;
        author?: { pen_name?: string | null } | null;
      }>;
      const total = Number(facet?.total?.[0]?.count ?? 0);

      return {
        books: items.map((b) => ({
          id: String(b._id),
          title: String(b.title ?? ''),
          status: String(b.status ?? 'draft'),
          price: b.price ?? null,
          author: b.author ? { pen_name: b.author.pen_name ?? null } : null,
        })),
        total,
        page,
        perPage,
        error: null,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Mongo admin books query failed';
      return { books: [], total: 0, page, perPage, error: { message } };
    }
  }

  const { createClient } = await import('@/lib/supabase/admin');
  const supabase = createClient();
  const from = (page - 1) * perPage;
  const to = from + perPage - 1;

  let query = supabase
    .from('books')
    .select('id, title, status, price, author:authors(pen_name)', { count: 'exact' })
    .order('created_at', { ascending: false });

  if (queryText) query = query.ilike('title', `%${queryText}%`);
  if (status) query = query.eq('status', status);

  const { data, count, error } = await query.range(from, to);
  if (error) {
    return {
      books: [],
      total: 0,
      page,
      perPage,
      error: { message: error.message },
    };
  }

  const books: AdminBookListItem[] = (
    (data as unknown as Array<{
      id: string;
      title: string;
      status: string;
      price: number | null;
      author: { pen_name: string | null } | { pen_name: string | null }[] | null;
    }> | null) || []
  ).map((row) => {
    const author = Array.isArray(row.author) ? (row.author[0] ?? null) : row.author;
    return {
      id: String(row.id),
      title: row.title,
      status: row.status,
      price: row.price ?? null,
      author: author ? { pen_name: author.pen_name ?? null } : null,
    };
  });

  return {
    books,
    total: count ?? books.length,
    page,
    perPage,
    error: null,
  };
}

// ---------------------------------------------------------------------------
// Admin detail read + author picker (Task 2.3)
//
// Both admin pages used to import `@/lib/supabase/admin` directly, so under
// DATABASE_PROVIDER=mongodb the edit page could not load a Mongo book at all
// and the author dropdown listed Supabase authors that do not exist in the
// primary store. They now go through this module, exactly like the list above.
// ---------------------------------------------------------------------------

export type AdminAuthorOption = { id: string; pen_name: string };

export type AdminBookDetail = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  genre: string | null;
  author_id: string | null;
  author: { pen_name: string | null } | null;
  price: number | null;
  currency: string | null;
  isbn: string | null;
  content_type: 'book' | 'comic' | 'paper' | null;
  status: string;
  is_featured: boolean;
  published_at: string | null;
  page_count: number | null;
  word_count: number | null;
  trailer_vimeo_id: string | null;
  cover_url: string | null;
} & Record<RetailerUrlField, string | null>;

/** Columns the edit form round-trips. NOTE: no `subtitle` — see lib/books/fields.ts. */
const ADMIN_BOOK_DETAIL_COLUMNS = [
  'id',
  'title',
  'slug',
  'description',
  'genre',
  'author_id',
  'price',
  'isbn',
  'content_type',
  'status',
  'is_featured',
  'published_at',
  'page_count',
  'word_count',
  'trailer_vimeo_id',
  'cover_url',
  ...RETAILER_URL_FIELDS,
].join(', ');

function toIsoDate(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const parsed = Date.parse(String(value));
  return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
}

function retailerUrlsFrom(row: Record<string, unknown>): Record<RetailerUrlField, string | null> {
  const urls = {} as Record<RetailerUrlField, string | null>;
  for (const field of RETAILER_URL_FIELDS) {
    const value = row[field];
    urls[field] = typeof value === 'string' && value.trim() !== '' ? value : null;
  }
  return urls;
}

/**
 * Single book for the admin edit form.
 *
 * Deliberately NOT filtered on status or visibility: an admin must be able to
 * open a draft (that is the whole point of the create -> edit -> publish loop).
 */
export async function getAdminBook(id: string): Promise<AdminBookDetail | null> {
  const bookId = String(id ?? '').trim();
  if (!bookId) return null;

  if (isMongoPrimary()) {
    try {
      const { getAdminBookMongo } = await import('@/lib/mongo-books');
      const book = (await getAdminBookMongo(bookId)) as Record<string, unknown> | null;
      if (!book) return null;

      const author = book.author as { pen_name?: string | null } | null | undefined;
      const price = book.price;
      return {
        id: String(book._id ?? bookId),
        title: String(book.title ?? ''),
        slug: String(book.slug ?? ''),
        description: (book.description as string | null | undefined) ?? null,
        genre: (book.genre as string | null | undefined) ?? null,
        author_id: book.author_id != null ? String(book.author_id) : null,
        author: author ? { pen_name: author.pen_name ?? null } : null,
        price: typeof price === 'number' ? price : null,
        currency: (book.currency as string | null | undefined) ?? null,
        isbn: (book.isbn as string | null | undefined) ?? null,
        content_type: (book.content_type as AdminBookDetail['content_type']) ?? null,
        status: String(book.status ?? 'draft'),
        is_featured: Boolean(book.is_featured),
        published_at: toIsoDate(book.published_at),
        page_count: typeof book.page_count === 'number' ? book.page_count : null,
        word_count: typeof book.word_count === 'number' ? book.word_count : null,
        trailer_vimeo_id: (book.trailer_vimeo_id as string | null | undefined) ?? null,
        cover_url: (book.cover_url as string | null | undefined) ?? null,
        ...retailerUrlsFrom(book),
      };
    } catch {
      return null;
    }
  }

  const { createClient } = await import('@/lib/supabase/admin');
  const supabase = createClient();
  const { data, error } = await supabase
    .from('books')
    .select(`${ADMIN_BOOK_DETAIL_COLUMNS}, author:authors(pen_name)`)
    .eq('id', bookId)
    .maybeSingle();

  if (error || !data) return null;

  const row = data as unknown as Record<string, unknown>;
  const rawAuthor = row.author as
    | { pen_name: string | null }
    | { pen_name: string | null }[]
    | null
    | undefined;
  const author = Array.isArray(rawAuthor) ? (rawAuthor[0] ?? null) : (rawAuthor ?? null);

  return {
    id: String(row.id),
    title: String(row.title ?? ''),
    slug: String(row.slug ?? ''),
    description: (row.description as string | null | undefined) ?? null,
    genre: (row.genre as string | null | undefined) ?? null,
    author_id: row.author_id != null ? String(row.author_id) : null,
    author: author ? { pen_name: author.pen_name ?? null } : null,
    price: typeof row.price === 'number' ? row.price : null,
    // No `books.currency` column exists on Supabase — see CURRENCY_IS_FIXED.
    currency: null,
    isbn: (row.isbn as string | null | undefined) ?? null,
    content_type: (row.content_type as AdminBookDetail['content_type']) ?? null,
    status: String(row.status ?? 'draft'),
    is_featured: Boolean(row.is_featured),
    published_at: toIsoDate(row.published_at),
    page_count: typeof row.page_count === 'number' ? row.page_count : null,
    word_count: typeof row.word_count === 'number' ? row.word_count : null,
    trailer_vimeo_id: (row.trailer_vimeo_id as string | null | undefined) ?? null,
    cover_url: (row.cover_url as string | null | undefined) ?? null,
    ...retailerUrlsFrom(row),
  };
}

/**
 * Authors for the admin book form's dropdown, ordered by pen name.
 *
 * Supabase path keeps the service-role client: `authors` has RLS with no public
 * SELECT policy, and access to /admin is already gated by the admin layout.
 */
export async function listAdminAuthors(): Promise<AdminAuthorOption[]> {
  if (isMongoPrimary()) {
    try {
      const { listAdminAuthorsMongo } = await import('@/lib/mongo-books');
      return await listAdminAuthorsMongo();
    } catch {
      return [];
    }
  }

  const { createClient } = await import('@/lib/supabase/admin');
  const supabase = createClient();
  const { data } = await supabase
    .from('authors')
    .select('id, pen_name')
    .order('pen_name', { ascending: true });

  return ((data as Array<{ id: string; pen_name: string | null }> | null) ?? []).map((row) => ({
    id: String(row.id),
    pen_name: row.pen_name ?? 'Unnamed author',
  }));
}
