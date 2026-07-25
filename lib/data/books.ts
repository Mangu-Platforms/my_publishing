/**
 * Dual-run book data access for Phoenix WS2b API routes + WS2d catalog UI.
 * Default: Supabase. Mongo when DATABASE_PROVIDER=mongodb.
 */

import '@/lib/server-only-guard';

import { createClient } from '@/lib/supabase/server';
import { isMongoPrimary } from '@/lib/db/provider';
import { slugifyGenre } from '@/lib/utils/genre';
import { createBook, getBookById, getBookBySlug, getBooks, updateBook } from '@/lib/mongo-queries';

export type ApiBook = {
  id: string;
  title: string;
  slug: string;
  description?: string | null;
  genre?: string | null;
  price?: number | null;
  discount_price?: number | null;
  status?: string;
  visibility?: string;
  cover_url?: string | null;
  author_id?: string;
  avg_rating?: number;
  review_count?: number;
  created_at?: string;
  [key: string]: unknown;
};

function slugify(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

export async function listPublishedBooks(opts: {
  page?: number;
  perPage?: number;
  genre?: string;
}): Promise<{ books: ApiBook[]; total: number; page: number; perPage: number }> {
  const page = opts.page ?? 1;
  const perPage = opts.perPage ?? 20;

  if (isMongoPrimary()) {
    const result = await getBooks(
      { status: 'published', visibility: 'public', genre: opts.genre },
      { page, perPage }
    );
    return {
      books: result.items.map((b) => ({
        id: String(b._id),
        title: b.title,
        slug: b.slug,
        description: b.description ?? null,
        genre: b.genre ?? null,
        price: b.price ?? null,
        status: b.status,
        visibility: b.visibility,
        cover_url: b.cover_url ?? null,
        author_id: String(b.author_id),
        avg_rating: b.avg_rating,
        review_count: b.review_count,
        created_at:
          b.created_at instanceof Date ? b.created_at.toISOString() : String(b.created_at ?? ''),
        author: b.author ? { id: String(b.author._id), full_name: b.author.pen_name } : null,
      })),
      total: result.total,
      page: result.page,
      perPage: result.perPage,
    };
  }

  const supabase = await createClient();
  let query = supabase
    .from('books')
    .select('*', { count: 'exact' })
    .eq('status', 'published')
    .eq('visibility', 'public')
    .order('created_at', { ascending: false })
    .range((page - 1) * perPage, page * perPage - 1);
  if (opts.genre) query = query.eq('genre', opts.genre);

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);
  return {
    books: (data || []).map((row) => ({ ...row, id: row.id as string })),
    total: count ?? (data || []).length,
    page,
    perPage,
  };
}

function mapMongoBookCard(b: {
  _id: unknown;
  title: string;
  slug: string;
  description?: string | null;
  genre?: string | null;
  price?: number;
  status: string;
  visibility?: string;
  cover_url?: string | null;
  author_id: unknown;
  avg_rating?: number;
  review_count?: number;
  created_at?: Date | string;
  author?: { _id?: unknown; pen_name?: string | null } | null;
}): ApiBook {
  return {
    id: String(b._id),
    title: b.title,
    slug: b.slug,
    description: b.description ?? null,
    genre: b.genre ?? null,
    price: b.price ?? null,
    status: b.status,
    visibility: b.visibility,
    cover_url: b.cover_url ?? null,
    author_id: String(b.author_id),
    avg_rating: b.avg_rating,
    review_count: b.review_count,
    created_at:
      b.created_at instanceof Date ? b.created_at.toISOString() : String(b.created_at ?? ''),
    author: b.author
      ? {
          id: b.author._id ? String(b.author._id) : undefined,
          pen_name: b.author.pen_name ?? null,
          full_name: b.author.pen_name ?? null,
        }
      : null,
  };
}

/**
 * Featured rail. Supabase uses `is_featured`; Mongo has no featured flag yet, so
 * it falls back to highest-rated published books (parity: a non-empty rail).
 */
export async function listFeaturedBooks(limit = 8): Promise<ApiBook[]> {
  if (isMongoPrimary()) {
    const { getDb } = await import('@/lib/mongo');
    const db = await getDb();
    const rows = await db
      .collection('books')
      .aggregate([
        { $match: { status: 'published', visibility: 'public' } },
        { $sort: { avg_rating: -1, review_count: -1, created_at: -1 } },
        { $limit: limit },
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
      ])
      .toArray();
    return rows.map((b) => mapMongoBookCard(b as Parameters<typeof mapMongoBookCard>[0]));
  }

  const { getFeaturedBooks } = await import('@/lib/supabase/queries');
  const { data, error } = await getFeaturedBooks(limit);
  if (error || !data) return [];
  return data.map((row) => ({ ...row, id: String(row.id) })) as ApiBook[];
}

/**
 * Trending rail. Supabase orders by `total_reads`; Mongo has no reads counter
 * yet, so it falls back to review_count then avg_rating.
 */
export async function listTrendingBooks(limit = 10): Promise<ApiBook[]> {
  if (isMongoPrimary()) {
    const { getDb } = await import('@/lib/mongo');
    const db = await getDb();
    const rows = await db
      .collection('books')
      .aggregate([
        { $match: { status: 'published', visibility: 'public' } },
        { $sort: { review_count: -1, avg_rating: -1, created_at: -1 } },
        { $limit: limit },
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
      ])
      .toArray();
    return rows.map((b) => mapMongoBookCard(b as Parameters<typeof mapMongoBookCard>[0]));
  }

  const { getTrendingBooks } = await import('@/lib/supabase/queries');
  const { data, error } = await getTrendingBooks(limit);
  if (error || !data) return [];
  return data.map((row) => ({ ...row, id: String(row.id) })) as ApiBook[];
}

/**
 * Books for /genres/[genre]. Accepts either a display name ("Sci-Fi") or a
 * route slug ("sci-fi") so GenreCard and GenreExplorer links both resolve.
 */
export async function listBooksByGenreParam(
  genreParam: string,
  opts: { limit?: number } = {}
): Promise<ApiBook[]> {
  const limit = opts.limit ?? 60;
  const param = genreParam.trim();
  const slug = slugifyGenre(param);
  if (!slug) return [];

  if (isMongoPrimary()) {
    const { getDb } = await import('@/lib/mongo');
    const db = await getDb();
    // Fetch a wider window then filter by slug — genre casing varies in legacy data.
    const rows = await db
      .collection('books')
      .aggregate([
        {
          $match: {
            status: 'published',
            visibility: 'public',
            genre: { $type: 'string', $nin: ['', null] },
          },
        },
        { $sort: { created_at: -1 } },
        { $limit: 500 },
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
      ])
      .toArray();

    return rows
      .filter((b) => {
        const g = String((b as { genre?: string }).genre ?? '');
        return slugifyGenre(g) === slug || g.toLowerCase() === param.toLowerCase();
      })
      .slice(0, limit)
      .map((b) => mapMongoBookCard(b as Parameters<typeof mapMongoBookCard>[0]));
  }

  const { createPublicCatalogClient, PUBLIC_BOOK_SELECT } =
    await import('@/lib/supabase/public-queries');
  const supabase = createPublicCatalogClient();
  // Prefer exact match (GenreCard links with the stored display name), then
  // fall back to slug filtering so GenreExplorer's /genres/sci-fi links work.
  const exact = await supabase
    .from('books')
    .select(PUBLIC_BOOK_SELECT)
    .eq('status', 'published')
    .eq('visibility', 'public')
    .eq('genre', param)
    .order('published_at', { ascending: false })
    .limit(limit);

  if (!exact.error && exact.data && exact.data.length > 0) {
    return exact.data.map((row) => ({ ...row, id: String(row.id) })) as ApiBook[];
  }

  const { data } = await supabase
    .from('books')
    .select(PUBLIC_BOOK_SELECT)
    .eq('status', 'published')
    .eq('visibility', 'public')
    .order('published_at', { ascending: false })
    .limit(500);

  return ((data as Array<Record<string, unknown>>) || [])
    .filter((row) => slugifyGenre(String(row.genre ?? '')) === slug)
    .slice(0, limit)
    .map((row) => ({ ...row, id: String(row.id) })) as ApiBook[];
}

export async function fetchBookForApi(idOrSlug: {
  id?: string;
  slug?: string;
}): Promise<ApiBook | null> {
  if (isMongoPrimary()) {
    const book = idOrSlug.id
      ? await getBookById(idOrSlug.id)
      : idOrSlug.slug
        ? await getBookBySlug(idOrSlug.slug)
        : null;
    if (!book) return null;
    return {
      id: String(book._id),
      title: book.title,
      slug: book.slug,
      description: book.description ?? null,
      genre: book.genre ?? null,
      price: book.price ?? 0,
      discount_price: null,
      status: book.status,
      visibility: book.visibility,
      cover_url: book.cover_url ?? null,
      author_id: String(book.author_id),
      avg_rating: book.avg_rating,
      review_count: book.review_count,
    };
  }

  const supabase = await createClient();
  let query = supabase.from('books').select('*');
  if (idOrSlug.id) query = query.eq('id', idOrSlug.id);
  else if (idOrSlug.slug) query = query.eq('slug', idOrSlug.slug);
  else return null;
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(error.message);
  return data as ApiBook | null;
}

/** Checkout summary — published+public only, with author display fields. */
export type CheckoutBookSummary = {
  id: string;
  slug: string | null;
  title: string;
  cover_url: string | null;
  price: number;
  discount_price: number | null;
  author: {
    pen_name: string | null;
    profile: { full_name: string | null } | null;
  } | null;
};

/**
 * Dual-run book load for /checkout (WS2d.1). Auth stays on AUTH_PROVIDER;
 * only the catalog read goes through DATABASE_PROVIDER.
 */
export async function fetchPublishedBookForCheckout(idOrSlug: {
  id?: string;
  slug?: string;
}): Promise<CheckoutBookSummary | null> {
  if (!idOrSlug.id && !idOrSlug.slug) return null;

  if (isMongoPrimary()) {
    const book = idOrSlug.id
      ? await getBookById(idOrSlug.id, { status: 'published', visibility: 'public' })
      : idOrSlug.slug
        ? await getBookBySlug(idOrSlug.slug, { status: 'published' })
        : null;
    if (!book) return null;
    if (book.visibility && book.visibility !== 'public') return null;

    const penName = book.author?.pen_name ?? null;
    return {
      id: String(book._id),
      slug: book.slug ?? null,
      title: book.title,
      cover_url: book.cover_url ?? null,
      price: Number(book.price ?? 0),
      discount_price: null,
      author: penName ? { pen_name: penName, profile: { full_name: penName } } : null,
    };
  }

  const { createPublicCatalogClient } = await import('@/lib/supabase/public-queries');
  const supabase = createPublicCatalogClient();
  let query = supabase
    .from('books')
    .select(
      'id, slug, title, cover_url, price, discount_price, author:authors(pen_name, profile:profiles(full_name))'
    )
    .eq('status', 'published')
    .eq('visibility', 'public');

  if (idOrSlug.id) query = query.eq('id', idOrSlug.id);
  else if (idOrSlug.slug) query = query.eq('slug', idOrSlug.slug);

  const { data } = await query.maybeSingle();
  return (data as CheckoutBookSummary | null) ?? null;
}

export async function createBookForApi(input: {
  title: string;
  author_id: string;
  description?: string;
  genre?: string;
  price?: number;
  status?: 'draft' | 'published' | 'archived';
  visibility?: 'public' | 'private' | 'unlisted';
  slug?: string;
}): Promise<ApiBook> {
  const slug = input.slug?.trim() || slugify(input.title);
  if (!slug) throw new Error('Invalid title for slug');

  if (isMongoPrimary()) {
    const id = await createBook({
      title: input.title,
      slug,
      author_id: input.author_id,
      description: input.description,
      genre: input.genre,
      price: input.price,
      status: input.status ?? 'draft',
      visibility: input.visibility ?? 'private',
    });
    const book = await getBookById(id);
    if (!book) throw new Error('Failed to load created book');
    return {
      id,
      title: book.title,
      slug: book.slug,
      description: book.description ?? null,
      genre: book.genre ?? null,
      price: book.price ?? 0,
      status: book.status,
      visibility: book.visibility,
      author_id: String(book.author_id),
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('books')
    .insert({
      title: input.title,
      slug,
      author_id: input.author_id,
      description: input.description ?? '',
      genre: input.genre,
      price: input.price ?? 0,
      status: input.status ?? 'draft',
      visibility: input.visibility ?? 'private',
    })
    .select('*')
    .single();
  if (error || !data) throw new Error(error?.message || 'Create failed');
  return data as ApiBook;
}

export async function patchBookForApi(
  id: string,
  patch: Partial<{
    title: string;
    slug: string;
    description: string;
    genre: string;
    price: number;
    status: 'draft' | 'published' | 'archived';
    visibility: 'public' | 'private' | 'unlisted';
  }>
): Promise<ApiBook | null> {
  if (isMongoPrimary()) {
    const ok = await updateBook(id, patch);
    if (!ok) return null;
    return fetchBookForApi({ id });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('books')
    .update(patch)
    .eq('id', id)
    .select('*')
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as ApiBook | null) ?? null;
}
