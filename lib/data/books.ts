/**
 * Dual-run book data access for Phoenix WS2b API routes + WS2d catalog UI.
 * Default: Supabase. Mongo when DATABASE_PROVIDER=mongodb.
 */

import '@/lib/server-only-guard';

import { createClient } from '@/lib/supabase/server';
import { isMongoPrimary } from '@/lib/db/provider';
import { slugifyGenre } from '@/lib/utils/genre';
import {
  createBook,
  getBookById,
  getBookBySlug,
  searchBooks,
  updateBook,
} from '@/lib/mongo-queries';

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

const BROWSE_SORT_KEYS = new Set([
  'published_at',
  'total_reads',
  'average_rating',
  'price',
  'title',
]);

function slugify(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

function mapBookWithAuthor(b: {
  _id: unknown;
  title: string;
  slug: string;
  description?: string | null;
  genre?: string | null;
  price?: number | null;
  status?: string;
  visibility?: string;
  cover_url?: string | null;
  author_id?: unknown;
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
    author_id: b.author_id != null ? String(b.author_id) : undefined,
    avg_rating: b.avg_rating,
    review_count: b.review_count,
    created_at:
      b.created_at instanceof Date ? b.created_at.toISOString() : String(b.created_at ?? ''),
    author: b.author ? { id: String(b.author._id), full_name: b.author.pen_name } : null,
  };
}

/** Map UI sort keys (Supabase columns) onto Mongo Book fields. */
function mongoSortForBrowse(sort: string): { field: string; ascending: boolean } {
  switch (sort) {
    case 'price':
      return { field: 'price', ascending: true };
    case 'title':
      return { field: 'title', ascending: true };
    case 'average_rating':
      return { field: 'avg_rating', ascending: false };
    case 'total_reads':
      // Mongo has no total_reads yet — review_count is the closest signal.
      return { field: 'review_count', ascending: false };
    case 'published_at':
    default:
      return { field: 'created_at', ascending: false };
  }
}

export async function listPublishedBooks(opts: {
  page?: number;
  perPage?: number;
  genre?: string;
  q?: string;
  sort?: string;
}): Promise<{ books: ApiBook[]; total: number; page: number; perPage: number }> {
  const page = opts.page ?? 1;
  const perPage = opts.perPage ?? 20;
  const q = opts.q?.trim() || undefined;
  const sort = BROWSE_SORT_KEYS.has(opts.sort ?? '') ? (opts.sort as string) : 'published_at';

  if (isMongoPrimary()) {
    if (q) {
      const result = await searchBooks(q, {
        status: 'published',
        visibility: 'public',
        page,
        perPage,
      });
      // searchBooks sorts by text score; genre filter applied in-memory for parity.
      let items = result.items;
      if (opts.genre) {
        items = items.filter((b) => b.genre === opts.genre);
      }
      return {
        books: items.map(mapBookWithAuthor),
        total: opts.genre ? items.length : result.total,
        page: result.page,
        perPage: result.perPage,
      };
    }

    const { field, ascending } = mongoSortForBrowse(sort);
    const { getDb } = await import('@/lib/mongo');
    const db = await getDb();
    const match: Record<string, unknown> = {
      status: 'published',
      visibility: 'public',
    };
    if (opts.genre) match.genre = opts.genre;

    const skip = (page - 1) * perPage;
    const [facet] = await db
      .collection('books')
      .aggregate([
        { $match: match },
        {
          $facet: {
            items: [
              { $sort: { [field]: ascending ? 1 : -1, _id: 1 } },
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

    const items = (facet?.items ?? []) as Parameters<typeof mapBookWithAuthor>[0][];
    const total = Number(facet?.total?.[0]?.count ?? 0);
    return {
      books: items.map(mapBookWithAuthor),
      total,
      page,
      perPage,
    };
  }

  const supabase = await createClient();
  let query = supabase
    .from('books')
    .select('*', { count: 'exact' })
    .eq('status', 'published')
    .eq('visibility', 'public')
    .range((page - 1) * perPage, page * perPage - 1);
  if (opts.genre) query = query.eq('genre', opts.genre);
  if (q) query = query.textSearch('title', q, { type: 'websearch' });

  const ascending = sort === 'price' || sort === 'title';
  // Prefer published_at (catalog UX); fall back to created_at if column missing at runtime.
  query = query.order(sort === 'published_at' ? 'published_at' : sort, {
    ascending: sort === 'published_at' ? false : ascending,
  });

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
      ? await getBookById(idOrSlug.id, { status: 'published', visibility: 'public' })
      : idOrSlug.slug
        ? await getBookBySlug(idOrSlug.slug, { status: 'published' })
        : null;
    if (!book) return null;
    if (book.visibility && book.visibility !== 'public') return null;
    const penName = book.author?.pen_name ?? null;
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
      manuscript_url: book.manuscript_url ?? null,
      author_id: book.author_id != null ? String(book.author_id) : undefined,
      avg_rating: book.avg_rating,
      review_count: book.review_count,
      average_rating: book.avg_rating,
      content_type: book.content_type ?? 'book',
      published_at:
        book.published_at instanceof Date
          ? book.published_at.toISOString()
          : (book.published_at ?? null),
      created_at:
        book.created_at instanceof Date
          ? book.created_at.toISOString()
          : String(book.created_at ?? ''),
      updated_at:
        book.updated_at instanceof Date
          ? book.updated_at.toISOString()
          : String(book.updated_at ?? ''),
      // Mongo Book has no trailer/audio columns yet — leave undefined for UI guards.
      trailer_vimeo_id: null,
      audio_url: null,
      author: penName
        ? {
            id: book.author?._id ? String(book.author._id) : undefined,
            pen_name: penName,
            full_name: penName,
            profile: { full_name: penName },
          }
        : null,
    };
  }

  if (!idOrSlug.id && !idOrSlug.slug) return null;

  // Public catalog client joins author under RLS-safe columns (PDP needs pen_name).
  // SECURITY: this is a public read path — only ever expose published+public books.
  // NOTE: .limit(1) + first-row take, NOT .maybeSingle() — duplicate slugs exist
  // in seeded data (the same QA book under two test authors) and maybeSingle()
  // errors on multiple rows, which 404'd every book page. Prefer the most
  // recently published match deterministically.
  const { createPublicCatalogClient, PUBLIC_BOOK_SELECT } =
    await import('@/lib/supabase/public-queries');
  const supabase = createPublicCatalogClient();
  let query = supabase
    .from('books')
    .select(PUBLIC_BOOK_SELECT)
    .eq('status', 'published')
    .eq('visibility', 'public');
  if (idOrSlug.id) query = query.eq('id', idOrSlug.id);
  else if (idOrSlug.slug) query = query.eq('slug', idOrSlug.slug);
  const { data, error } = await query.order('published_at', { ascending: false }).limit(1);
  const primaryRow = (data?.[0] as ApiBook | undefined) ?? null;
  if (!error && primaryRow) return primaryRow;

  // Resilience fallback: the admin (service-role) client is the only consumer
  // path that depends on SUPABASE_SERVICE_ROLE_KEY. If it errors or finds
  // nothing while the RLS catalog can see the row (as observed in production,
  // where /books lists books whose detail pages 404), retry with the standard
  // server client. The author join may be RLS-restricted here — the PDP then
  // shows 'Unknown Author' — but the page renders instead of 404ing.
  try {
    const rlsClient = await createClient();
    let fallback = rlsClient
      .from('books')
      .select('*')
      .eq('status', 'published')
      .eq('visibility', 'public');
    if (idOrSlug.id) fallback = fallback.eq('id', idOrSlug.id);
    else fallback = fallback.eq('slug', idOrSlug.slug as string);
    const { data: fallbackData, error: fallbackError } = await fallback
      .order('published_at', { ascending: false })
      .limit(1);
    if (fallbackError) {
      if (error) throw new Error(error.message);
      return null;
    }
    return (fallbackData?.[0] as ApiBook | undefined) ?? null;
  } catch (fallbackThrow) {
    if (error) throw new Error(error.message);
    throw fallbackThrow;
  }
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

  // Same duplicate-slug hardening as fetchBookForApi.
  const { data } = await query.order('published_at', { ascending: false }).limit(1);
  return (data?.[0] as CheckoutBookSummary | undefined) ?? null;
}

// ---------------------------------------------------------------------------
// Audiobooks (/audio, /audio/[id]) — WS2d.1
//
// Live audio lives on Supabase `book_content.audio_url` (joined onto books).
// Mongo `Book` has `content_type?: 'book'|'comic'|'paper'` but NO audio_url /
// book_content equivalent yet (see fetchBookForApi: audio_url: null). Until
// that schema lands, Mongo primary returns [] / null; Supabase path stays
// authoritative for the default DATABASE_PROVIDER=supabase dual-run.
// ---------------------------------------------------------------------------

export type AudiobookCatalogEntry = {
  id: string;
  title: string;
  author: string;
  coverUrl?: string;
  audioUrl: string;
  narrator?: string;
  durationSec?: number;
};

export type AudiobookDetail = {
  id: string;
  title: string;
  description?: string | null;
  cover_url?: string | null;
  author: {
    pen_name?: string | null;
    profile?: { full_name?: string | null } | null;
  } | null;
  audioUrl: string;
  chapters: Array<{ id: string; title: string; start: number; end?: number }>;
  narrator?: string;
  durationSec?: number;
  /** Raw content row for callers that need toc / extras. */
  content: Record<string, unknown>;
};

function contentRowsFromBook(book: { content?: unknown }): Record<string, unknown>[] {
  const contentRows = book.content;
  if (Array.isArray(contentRows)) {
    return contentRows.filter((r): r is Record<string, unknown> => !!r && typeof r === 'object');
  }
  if (contentRows && typeof contentRows === 'object') {
    return [contentRows as Record<string, unknown>];
  }
  return [];
}

function pickAudioContentRow(book: { content?: unknown }): Record<string, unknown> | null {
  return (
    contentRowsFromBook(book).find(
      (r) => typeof r.audio_url === 'string' && (r.audio_url as string).length > 0
    ) ?? null
  );
}

function pickNarrator(
  row: Record<string, unknown>,
  book?: Record<string, unknown>
): string | undefined {
  if (typeof row.narrator === 'string' && row.narrator.trim() !== '') {
    return row.narrator;
  }
  if (book && typeof book.narrator === 'string' && book.narrator.trim() !== '') {
    return book.narrator as string;
  }
  return undefined;
}

function pickDurationSec(
  row: Record<string, unknown>,
  chapters: Array<{ end?: number }>
): number | undefined {
  for (const key of ['audio_duration', 'duration_seconds', 'duration']) {
    const value = row[key];
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
      return value;
    }
  }
  const last = chapters[chapters.length - 1];
  if (last?.end) return last.end;
  return undefined;
}

function authorDisplayName(book: {
  author?: {
    pen_name?: string | null;
    profile?: { full_name?: string | null } | null;
  } | null;
}): string {
  return book.author?.profile?.full_name || book.author?.pen_name || 'Unknown Author';
}

/**
 * Published+public books that have a non-null `book_content.audio_url`.
 * Mongo: empty until Book gains audio fields (documented above).
 */
export async function listAudiobooks(): Promise<AudiobookCatalogEntry[]> {
  if (isMongoPrimary()) {
    // Fallback: Mongo Book has no audio_url / book_content join yet.
    return [];
  }

  const { createPublicCatalogClient, PUBLIC_BOOK_SELECT } =
    await import('@/lib/supabase/public-queries');
  const supabase = createPublicCatalogClient();
  const { data } = await supabase
    .from('books')
    .select(`${PUBLIC_BOOK_SELECT}, content:book_content!inner(*)`)
    .eq('status', 'published')
    .eq('visibility', 'public')
    .not('content.audio_url', 'is', null);

  const { parseChapters } = await import('@/components/audio/parse-chapters');

  const entries: AudiobookCatalogEntry[] = [];
  for (const book of (data as Array<Record<string, unknown>>) || []) {
    const row = pickAudioContentRow(book);
    if (!row) continue;
    const chapters = parseChapters(row.toc);
    const cover = book.cover_url;
    entries.push({
      id: String(book.id),
      title: String(book.title ?? ''),
      author: authorDisplayName(
        book as {
          author?: {
            pen_name?: string | null;
            profile?: { full_name?: string | null } | null;
          } | null;
        }
      ),
      ...(typeof cover === 'string' && cover ? { coverUrl: cover } : {}),
      audioUrl: row.audio_url as string,
      narrator: pickNarrator(row, book),
      durationSec: pickDurationSec(row, chapters),
    });
  }
  return entries;
}

/**
 * Single published+public audiobook by id (requires audio_url on book_content).
 * Mongo: null until Book gains audio fields (documented above).
 */
export async function fetchAudiobookById(id: string): Promise<AudiobookDetail | null> {
  if (!id) return null;

  if (isMongoPrimary()) {
    // Fallback: Mongo Book has no audio_url / book_content join yet.
    return null;
  }

  const { createPublicCatalogClient, PUBLIC_BOOK_WITH_CONTENT_SELECT } =
    await import('@/lib/supabase/public-queries');
  const supabase = createPublicCatalogClient();
  const { data } = await supabase
    .from('books')
    .select(PUBLIC_BOOK_WITH_CONTENT_SELECT)
    .eq('id', id)
    .eq('status', 'published')
    .eq('visibility', 'public')
    .single();

  if (!data) return null;

  const book = data as Record<string, unknown>;
  const row = pickAudioContentRow(book);
  if (!row) return null;

  const { parseChapters } = await import('@/components/audio/parse-chapters');
  const chapters = parseChapters(row.toc);
  const author = (book.author as AudiobookDetail['author']) ?? null;

  return {
    id: String(book.id),
    title: String(book.title ?? ''),
    description: (book.description as string | null | undefined) ?? null,
    cover_url: (book.cover_url as string | null | undefined) ?? null,
    author,
    audioUrl: row.audio_url as string,
    chapters,
    narrator: pickNarrator(row, book),
    durationSec: pickDurationSec(row, chapters),
    content: row,
  };
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
