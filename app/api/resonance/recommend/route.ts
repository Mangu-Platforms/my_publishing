/**
 * Resonance Recommendation API
 * AI-powered book recommendations with validation and rate limiting
 */

import { NextRequest, NextResponse } from 'next/server';
import { corsHeadersFor, corsPreflightHeadersFor } from '@/lib/api/cors';
import { createClient } from '@/lib/supabase/server';
import { enforceRateLimit, getClientIdentifier } from '@/lib/rate-limit';
import { RecommendRequestSchema, validateSafe, getFirstError } from '@/lib/validations/schemas';
import { getCompletedOrderBookIds } from '@/lib/reading/entitlement';
import { getResonanceRecommendations } from '@/lib/resonance/recommendations';
import type { RecommendationMode } from '@/lib/resonance/recommendations';
import type { BookWithStats, BookWithAuthor, ApiResponse } from '@/types';

// Personalized responses must never be cached across users.
export const dynamic = 'force-dynamic';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RECOMMEND_MODES: ReadonlyArray<RecommendationMode> = [
  'auto',
  'personal',
  'trending',
  'editorial',
];

interface RecommendationItemPayload {
  book: BookWithAuthor;
  reason: string;
  score: number;
  algorithm: string;
}

interface GetRecommendationResult {
  books: BookWithStats[];
  items: RecommendationItemPayload[];
  total: number;
  algorithm: string;
  anchor: { id: string; title: string } | null;
}

interface RecommendationResult {
  books: BookWithStats[];
  total: number;
  algorithm: string;
}

/**
 * Get personalized book recommendations
 * POST /api/resonance/recommend
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();

  // Rate limiting (fail-closed, Fix C8)
  const clientId = getClientIdentifier(request);
  const rateLimitResult = await enforceRateLimit('api', clientId);
  const rateLimitHeaders = rateLimitResult.headers;
  const corsHeaders = corsHeadersFor(request);

  if (!rateLimitResult.success) {
    return NextResponse.json(
      {
        success: false,
        error:
          rateLimitResult.reason === 'unavailable'
            ? 'Rate limiter unavailable. Please try again shortly.'
            : 'Rate limit exceeded. Please try again later.',
      } satisfies ApiResponse,
      {
        status: rateLimitResult.reason === 'unavailable' ? 503 : 429,
        headers: rateLimitHeaders,
      }
    );
  }

  try {
    // Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid JSON body',
        } satisfies ApiResponse,
        { status: 400, headers: rateLimitHeaders }
      );
    }

    // Validate input
    const validation = validateSafe(RecommendRequestSchema, body);
    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: getFirstError(validation.error),
        } satisfies ApiResponse,
        { status: 400, headers: rateLimitHeaders }
      );
    }

    const { user_id, limit: limitValue, genre, exclude_book_ids } = validation.data;
    const limit = limitValue || 10;

    // Initialize Supabase client
    const supabase = await createClient();

    // Get current user if not specified
    let targetUserId = user_id;
    if (!targetUserId) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      targetUserId = user?.id;
    }

    // Build recommendation query
    let query = supabase
      .from('books')
      .select('*')
      .eq('status', 'published')
      .eq('visibility', 'public')
      .order('created_at', { ascending: false })
      .limit(limit);

    // Filter by genre if specified
    if (genre) {
      query = query.eq('genre', genre);
    }

    // Exclude specified books
    if (exclude_book_ids && exclude_book_ids.length > 0) {
      query = query.not('id', 'in', `(${exclude_book_ids.join(',')})`);
    }

    // If user is authenticated, exclude their own books and purchased books.
    // targetUserId is an auth user id; orders.user_id and authors.profile_id
    // store profiles.id, so resolve the profile first.
    if (targetUserId) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', targetUserId)
        .maybeSingle();

      if (profile) {
        // Exclude books authored by this user (books.author_id → authors.id)
        const { data: authorRecords } = await supabase
          .from('authors')
          .select('id')
          .eq('profile_id', profile.id);

        if (authorRecords && authorRecords.length > 0) {
          query = query.not('author_id', 'in', `(${authorRecords.map((a) => a.id).join(',')})`);
        }

        // Exclude already-purchased books (best-effort; recommendations
        // should not fail outright if the exclusion lookup errors)
        try {
          const purchasedIds = await getCompletedOrderBookIds(supabase, profile.id);
          if (purchasedIds.length > 0) {
            query = query.not('id', 'in', `(${purchasedIds.join(',')})`);
          }
        } catch (exclusionError) {
          console.warn('[Recommend] Failed to load purchased-book exclusions:', exclusionError);
        }
      }
    }

    // Execute query
    const { data: books, error: queryError } = await query;

    if (queryError) {
      console.error('[Recommend] Query error:', queryError);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to fetch recommendations',
        } satisfies ApiResponse,
        { status: 500, headers: rateLimitHeaders }
      );
    }

    // Transform results
    const transformedBooks: BookWithStats[] = (books || []).map((book) => ({
      ...book,
      stats: {
        views: book.total_reads || 0,
        purchases: 0,
        revenue: 0,
      },
    }));

    // Apply scoring algorithm (basic implementation)
    const scoredBooks = transformedBooks.map((book) => {
      // Simple scoring: views + (purchases * 10) + recency bonus
      const recencyDays = Math.floor(
        (Date.now() - new Date(book.created_at).getTime()) / (1000 * 60 * 60 * 24)
      );
      const recencyBonus = Math.max(0, 30 - recencyDays) * 5;

      const score = (book.stats?.views || 0) + (book.stats?.purchases || 0) * 10 + recencyBonus;

      return { ...book, _score: score };
    });

    // Sort by score
    scoredBooks.sort((a, b) => (b._score || 0) - (a._score || 0));

    // Remove internal score from response
    const finalBooks = scoredBooks.map(({ _score, ...book }) => book);

    const duration = Date.now() - startTime;
    console.log(`[Recommend] Returned ${finalBooks.length} recommendations in ${duration}ms`);

    const result: RecommendationResult = {
      books: finalBooks,
      total: finalBooks.length,
      algorithm: 'popularity_recency_v1',
    };

    return NextResponse.json(
      {
        success: true,
        data: result,
      } satisfies ApiResponse<RecommendationResult>,
      {
        status: 200,
        headers: { ...rateLimitHeaders, ...corsHeaders },
      }
    );
  } catch (error) {
    console.error('[Recommend] Unexpected error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      } satisfies ApiResponse,
      { status: 500, headers: rateLimitHeaders }
    );
  }
}

/**
 * Personalized recommendations via the Resonance Engine fallback chain:
 * user_vector → similar_to_recent → trending → editorial.
 *
 * GET /api/resonance/recommend?limit=10&mode=auto&genre=...&exclude=id1,id2
 *
 * Identity always comes from the session cookie — client-sent user ids are
 * never trusted. Works without OPENAI_API_KEY (vector stages no-op and the
 * SQL trending/editorial stages answer instead). Never crashes: on failure
 * the chain degrades to an empty cold_start result.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  // Rate limiting (fail-closed, Fix C8)
  const clientId = getClientIdentifier(request);
  const rateLimitResult = await enforceRateLimit('api', clientId);
  const rateLimitHeaders = rateLimitResult.headers;
  const corsHeaders = corsHeadersFor(request);

  if (!rateLimitResult.success) {
    return NextResponse.json(
      {
        success: false,
        error:
          rateLimitResult.reason === 'unavailable'
            ? 'Rate limiter unavailable. Please try again shortly.'
            : 'Rate limit exceeded. Please try again later.',
      } satisfies ApiResponse,
      {
        status: rateLimitResult.reason === 'unavailable' ? 503 : 429,
        headers: rateLimitHeaders,
      }
    );
  }

  try {
    const { searchParams } = new URL(request.url);

    const limitParam = Number.parseInt(searchParams.get('limit') ?? '', 10);
    const limit = Number.isFinite(limitParam) ? limitParam : undefined;

    const modeParam = searchParams.get('mode');
    const mode: RecommendationMode = RECOMMEND_MODES.includes(modeParam as RecommendationMode)
      ? (modeParam as RecommendationMode)
      : 'auto';

    const genreRaw = searchParams.get('genre');
    const genre = genreRaw && genreRaw.length <= 50 ? genreRaw : undefined;

    const excludeBookIds = (searchParams.get('exclude')?.split(',') ?? [])
      .map((id) => id.trim())
      .filter((id) => UUID_PATTERN.test(id))
      .slice(0, 100);

    // Resolve session → profile id (profiles.id, not auth.users.id).
    let profileId: string | null = null;
    let cacheControl = 'public, s-maxage=60, stale-while-revalidate=300';
    try {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle();
        profileId = profile?.id ?? null;
        // Any signed-in request may receive personalized content.
        cacheControl = 'private, no-store';
      }
    } catch (authError) {
      // Auth hiccup → serve anonymous fallbacks rather than failing.
      console.warn('[Recommend GET] session resolution failed:', authError);
    }

    const result = await getResonanceRecommendations({
      profileId,
      limit,
      genre,
      excludeBookIds,
      mode,
    });

    const items: RecommendationItemPayload[] = result.items.map((item) => ({
      book: item.book,
      reason: item.reason,
      score: item.score,
      algorithm: item.algorithm,
    }));

    // Back-compat: BookWithStats[] shape previously returned by this route.
    const books: BookWithStats[] = result.items.map((item) => ({
      ...item.book,
      stats: {
        views: (item.book as { total_reads?: number }).total_reads ?? 0,
        purchases: 0,
        revenue: 0,
      },
    }));

    const payload: GetRecommendationResult = {
      books,
      items,
      total: items.length,
      algorithm: result.algorithm,
      anchor: result.anchor,
    };

    return NextResponse.json(
      {
        success: true,
        data: payload,
      } satisfies ApiResponse<GetRecommendationResult>,
      {
        status: 200,
        headers: {
          ...rateLimitHeaders,
          ...corsHeaders,
          'Cache-Control': cacheControl,
        },
      }
    );
  } catch (error) {
    console.error('[Recommend GET] Unexpected error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      } satisfies ApiResponse,
      { status: 500, headers: rateLimitHeaders }
    );
  }
}

/**
 * Handle OPTIONS for CORS preflight
 */
export async function OPTIONS(request: NextRequest): Promise<NextResponse> {
  return new NextResponse(null, {
    status: 204,
    headers: corsPreflightHeadersFor(request, 'GET, POST, OPTIONS'),
  });
}
