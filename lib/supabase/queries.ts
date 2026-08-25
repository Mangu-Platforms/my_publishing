// PERF-PHASE2-2
import { cache } from 'react';
import { randomUUID } from 'crypto';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@/lib/supabase/admin';
import {
  createPublicCatalogClient,
  PUBLIC_AUTHOR_COLUMNS,
  PUBLIC_BOOK_SELECT,
  PUBLIC_BOOK_WITH_CONTENT_SELECT,
} from '@/lib/supabase/public-queries';
import { unstable_cache, revalidateTag } from 'next/cache';
import type { Database } from '@/types/database';
import type { BookWithAuthor } from '@/types';

type Tables = Database['public']['Tables'];

// PERF-PHASE2-2 — Invalidation helpers
export const revalidateBooks = () => revalidateTag('books-list');
export const revalidateAuthors = () => revalidateTag('authors');
export const revalidateResonance = () => revalidateTag('resonance');

// PERF-PHASE2-2 — Cached book listing query (60s TTL, tag: books-list)
export const getBooksPage = cache(
  async (params: {
    contentType: string;
    q?: string;
    genre?: string;
    sort?: string;
    page?: string;
  }): Promise<BookWithAuthor[]> => {
    return unstable_cache(
      async () => {
        // Admin client: the cookie-based server client cannot be used inside
        // unstable_cache (Next.js forbids dynamic data sources in cache scope).
        // RLS is bypassed, so filter explicitly to published + public books.
        const supabase = createAdminClient();
        let query = supabase
          .from('books')
          .select(PUBLIC_BOOK_SELECT)
          .eq('status', 'published')
          .eq('visibility', 'public')
          .eq('content_type', params.contentType);

        if (params.q) {
          query = query.textSearch('title', params.q, { type: 'websearch' });
        }
        if (params.genre) {
          query = query.eq('genre', params.genre);
        }

        const VALID_SORT_KEYS = new Set([
          'published_at',
          'total_reads',
          'average_rating',
          'price',
          'title',
        ]);
        const sort = VALID_SORT_KEYS.has(params.sort ?? '')
          ? (params.sort as string)
          : 'published_at';
        const ascending = sort === 'price' || sort === 'title';
        query = query.order(sort, { ascending });

        const page = parseInt(params.page || '0');
        const pageSize = 20;
        query = query.range(page * pageSize, (page + 1) * pageSize - 1);

        const { data } = await query;
        return (data as BookWithAuthor[]) || [];
      },
      [
        'books-page',
        params.contentType,
        params.q ?? '',
        params.genre ?? '',
        params.sort ?? '',
        params.page ?? '0',
      ],
      { tags: ['books-list'], revalidate: 60 }
    )();
  }
);

// PERF-PHASE2-2 — Cached author summary query (10min TTL, tag: authors)
export const getAuthorSummary = unstable_cache(
  async (authorId: string) => {
    // Admin client: cookie-based client is not allowed inside unstable_cache.
    const supabase = createAdminClient();
    const { data } = await supabase
      .from('authors')
      .select(PUBLIC_AUTHOR_COLUMNS)
      .eq('id', authorId)
      .single();
    return data;
  },
  ['author-summary'],
  { tags: ['authors'], revalidate: 600 }
);

// ============================================================================
// BOOKS QUERIES
// ============================================================================

export async function getPublishedBooks(filters?: {
  genre?: string;
  search?: string;
  sort?: 'newest' | 'oldest' | 'rating' | 'popular' | 'price';
  page?: number;
  limit?: number;
}) {
  // Admin client with explicit published+public filters: RLS blocks anon
  // reads of authors/profiles, which would strip author info from results.
  const supabase = createPublicCatalogClient();
  const page = filters?.page || 0;
  const limit = filters?.limit || 20;

  let query = supabase
    .from('books')
    .select(PUBLIC_BOOK_SELECT)
    .eq('status', 'published')
    .eq('visibility', 'public')
    .range(page * limit, (page + 1) * limit - 1);

  if (filters?.genre) {
    query = query.eq('genre', filters.genre);
  }

  if (filters?.search) {
    query = query.textSearch('search_vector', filters.search, {
      type: 'websearch',
    });
  }

  switch (filters?.sort) {
    case 'newest':
      query = query.order('published_at', { ascending: false });
      break;
    case 'oldest':
      query = query.order('published_at', { ascending: true });
      break;
    case 'rating':
      query = query.order('average_rating', { ascending: false });
      break;
    case 'popular':
      query = query.order('total_reads', { ascending: false });
      break;
    case 'price':
      query = query.order('price', { ascending: true });
      break;
    default:
      query = query.order('published_at', { ascending: false });
  }

  return query;
}

export async function getBookBySlug(slug: string) {
  const supabase = createPublicCatalogClient();

  return supabase
    .from('books')
    .select(PUBLIC_BOOK_WITH_CONTENT_SELECT)
    .eq('slug', slug)
    .eq('status', 'published')
    .eq('visibility', 'public')
    .single();
}

export async function getBookById(id: string) {
  const supabase = createPublicCatalogClient();

  return supabase
    .from('books')
    .select(PUBLIC_BOOK_WITH_CONTENT_SELECT)
    .eq('id', id)
    .eq('status', 'published')
    .eq('visibility', 'public')
    .single();
}

export async function getFeaturedBooks(limit = 6) {
  try {
    const data = await unstable_cache(
      async (limit) => {
        // Use admin client to bypass RLS and avoid cookie dependency for static cache
        const supabase = createAdminClient();
        const { data, error } = await supabase
          .from('books')
          .select(PUBLIC_BOOK_SELECT)
          .eq('is_featured', true)
          .eq('status', 'published')
          .eq('visibility', 'public')
          .order('featured_at', { ascending: false })
          .limit(limit);

        if (error) throw error;
        return data;
      },
      ['featured-books'],
      { tags: ['featured-books'], revalidate: 3600 }
    )(limit);

    return { data, error: null };
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error fetching featured books:', error);
    // Return error in a format compatible with Supabase response
    return {
      data: null,
      error: error instanceof Error ? error : new Error('Unknown error'),
    };
  }
}

export async function getTrendingBooks(limit = 12) {
  const supabase = createPublicCatalogClient();

  return supabase
    .from('books')
    .select(PUBLIC_BOOK_SELECT)
    .eq('status', 'published')
    .eq('visibility', 'public')
    .order('total_reads', { ascending: false })
    .limit(limit);
}

export async function searchBooks(query: string, limit = 20) {
  const supabase = createPublicCatalogClient();

  return supabase
    .from('books')
    .select(PUBLIC_BOOK_SELECT)
    .textSearch('search_vector', query, {
      type: 'websearch',
    })
    .eq('status', 'published')
    .eq('visibility', 'public')
    .limit(limit);
}

export async function getBooksByGenre(genre: string, limit = 20) {
  const supabase = createPublicCatalogClient();

  return supabase
    .from('books')
    .select(PUBLIC_BOOK_SELECT)
    .eq('genre', genre)
    .eq('status', 'published')
    .eq('visibility', 'public')
    .order('published_at', { ascending: false })
    .limit(limit);
}

// ============================================================================
// AUTHORS QUERIES
// ============================================================================

export async function getAuthorById(id: string) {
  const supabase = createPublicCatalogClient();

  return supabase.from('authors').select(PUBLIC_AUTHOR_COLUMNS).eq('id', id).single();
}

export async function getAuthorBySlug(slug: string) {
  const supabase = createPublicCatalogClient();

  return supabase.from('authors').select(PUBLIC_AUTHOR_COLUMNS).eq('pen_name', slug).single();
}

export async function getAuthorBooks(authorId: string) {
  const supabase = createPublicCatalogClient();

  return supabase
    .from('books')
    .select('*')
    .eq('author_id', authorId)
    .eq('status', 'published')
    .eq('visibility', 'public')
    .order('published_at', { ascending: false });
}

// ============================================================================
// READING PROGRESS QUERIES
// ============================================================================

export async function getUserReadingProgress(userId: string) {
  // Admin client so the nested author join resolves (authors has no anon/user
  // SELECT policy); safe because results are filtered to the given user id.
  const supabase = createPublicCatalogClient();

  return supabase
    .from('reading_progress')
    .select(`*, book:books(${PUBLIC_BOOK_SELECT})`)
    .eq('user_id', userId)
    .order('last_accessed', { ascending: false });
}

export async function getReadingProgress(userId: string, bookId: string) {
  const supabase = await createClient();

  return supabase
    .from('reading_progress')
    .select('*')
    .eq('user_id', userId)
    .eq('book_id', bookId)
    .single();
}

export async function updateReadingProgress(userId: string, bookId: string, position: number) {
  const supabase = await createClient();

  return supabase.rpc('update_reading_progress', {
    target_user_id: userId,
    target_book_id: bookId,
    new_position: position,
  });
}

export async function markBookAsFinished(userId: string, bookId: string, rating?: number) {
  const supabase = await createClient();

  return supabase.from('reading_progress').upsert({
    user_id: userId,
    book_id: bookId,
    current_position: 100,
    is_finished: true,
    finished_at: new Date().toISOString(),
    rating: rating || null,
  });
}

// ============================================================================
// RECOMMENDATIONS QUERIES
// ============================================================================

export async function getPersonalizedRecommendations(userId: string, limit = 12) {
  const supabase = await createClient();

  return supabase.rpc('get_recommendations', {
    target_user_id: userId,
    recommendation_limit: limit,
  });
}

export async function getSimilarBooks(bookId: string, limit = 6) {
  const supabase = await createClient();

  return supabase.rpc('get_similar_books', {
    target_book_id: bookId,
    match_count: limit,
  });
}

// ============================================================================
// MANUSCRIPTS QUERIES
// ============================================================================

export async function getAuthorManuscripts(authorId: string) {
  const supabase = await createClient();

  return supabase
    .from('manuscripts')
    .select('*')
    .eq('author_id', authorId)
    .order('created_at', { ascending: false });
}

export async function getManuscriptById(id: string) {
  const supabase = await createClient();

  return supabase.from('manuscripts').select('*').eq('id', id).single();
}

export async function submitManuscript(data: {
  author_id: string;
  title: string;
  working_title?: string;
  synopsis?: string;
  genre: string;
  word_count?: number;
  target_audience?: string;
  manuscript_file_url?: string;
  sample_chapters_url?: string;
  cover_draft_url?: string;
}) {
  const supabase = await createClient();

  return supabase
    .from('manuscripts')
    .insert({
      ...data,
      status: 'submitted',
      submission_date: new Date().toISOString(),
    })
    .select()
    .single();
}

export async function updateManuscriptStatus(id: string, status: string, editorial_notes?: string) {
  const supabase = await createClient();

  return supabase
    .from('manuscripts')
    .update({
      status,
      editorial_notes,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();
}

// ============================================================================
// ORDERS QUERIES
//
// orders.user_id stores profiles.id (FK → profiles.id), NOT the auth user id.
// ============================================================================

/**
 * Orders for the given auth user. Resolves the auth user id to the profile id
 * before filtering, since orders.user_id stores profiles.id.
 */
export async function getUserOrders(authUserId: string) {
  const supabase = await createClient();

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id')
    .eq('user_id', authUserId)
    .maybeSingle();

  if (profileError) {
    return { data: null, error: profileError };
  }

  if (!profile) {
    return { data: [], error: null };
  }

  return supabase
    .from('orders')
    .select('*, items:order_items(*, book:books(*))')
    .eq('user_id', profile.id)
    .order('created_at', { ascending: false });
}

export async function getOrderById(orderId: string) {
  const supabase = await createClient();

  return supabase
    .from('orders')
    .select('*, items:order_items(*, book:books(*))')
    .eq('id', orderId)
    .single();
}

/**
 * Creates an order with items. `user_id` must be a profiles.id (not an auth
 * user id) — orders.user_id references profiles(id).
 */
export async function createOrder(data: {
  /** profiles.id of the purchaser */
  user_id: string;
  order_number: string;
  total_amount: number;
  payment_intent_id?: string;
  items: Array<{
    book_id: string;
    unit_price: number;
  }>;
}) {
  const supabase = await createClient();

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({
      user_id: data.user_id,
      order_number: data.order_number,
      total_amount: data.total_amount,
      payment_intent_id: data.payment_intent_id,
      status: 'pending',
    })
    .select()
    .single();

  if (orderError || !order) {
    return { error: orderError };
  }

  const orderItems = data.items.map((item) => ({
    order_id: order.id,
    book_id: item.book_id,
    unit_price: item.unit_price,
    license_key: `LIC-${randomUUID()}`,
  }));

  const { error: itemsError } = await supabase.from('order_items').insert(orderItems);

  if (itemsError) {
    return { error: itemsError };
  }

  return { data: order };
}

// ============================================================================
// ENGAGEMENT QUERIES
// ============================================================================

export async function trackEngagement(data: {
  user_id?: string;
  book_id: string;
  event_type: 'view' | 'purchase' | 'read' | 'rating' | 'share' | 'wishlist';
  event_value?: Record<string, unknown>;
}) {
  const supabase = await createClient();

  return supabase.from('engagement_events').insert({
    user_id: data.user_id || null,
    book_id: data.book_id,
    event_type: data.event_type,
    event_value: data.event_value || null,
  });
}

// ============================================================================
// PROFILE QUERIES
// ============================================================================

export async function getProfile(userId: string) {
  const supabase = await createClient();

  return supabase.from('profiles').select('*').eq('user_id', userId).single();
}

export async function updateProfile(
  userId: string,
  updates: Partial<Tables['profiles']['Update']>
) {
  const supabase = await createClient();

  return supabase.from('profiles').update(updates).eq('user_id', userId).select().single();
}

/**
 * Real, verifiable platform counts for the homepage StatsBar (P0-014, G6).
 * Uses the admin client with the same published+public filter the public
 * catalog enforces, so we never advertise draft/private inventory. Returns
 * only counts that are truthfully derivable; the UI hides any zero stat and
 * omits the whole section when there is nothing real to show.
 */
export async function getPlatformStats(): Promise<{ books: number; authors: number }> {
  // PHASE-10 — Cached platform stats (1h TTL, tag: platform-stats), using the
  // same unstable_cache calling convention as getFeaturedBooks above.
  return unstable_cache(
    async () => {
      // Admin client: the cookie-based server client cannot be used inside
      // unstable_cache (Next.js forbids dynamic data sources in cache scope).
      const admin = createAdminClient();

      const [booksRes, authorsRes] = await Promise.all([
        admin
          .from('books')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'published')
          .eq('visibility', 'public'),
        // PHASE-10.5 metric semantics — Books = published+public head-count.
        // Authors = ALL author rows (unfiltered — includes zero-book/unverified
        // authors); change here requires a StatsBar label update.
        admin.from('authors').select('*', { count: 'exact', head: true }),
      ]);

      return {
        books: booksRes.count ?? 0,
        authors: authorsRes.count ?? 0,
      };
    },
    ['platform-stats'],
    { tags: ['platform-stats'], revalidate: 3600 }
  )();
}
