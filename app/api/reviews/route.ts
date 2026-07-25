/**
 * Public Reviews API
 *
 * GET  /api/reviews?bookId=&sort=&page=&limit=
 *   Paginated public reviews for a book with rating stats. Anonymous-safe.
 *
 * POST /api/reviews
 *   Create (or update) the authenticated user's review for a book.
 *   - one review per user per book (enforced by UNIQUE(book_id, user_id))
 *   - rate-limited
 *   - verified_purchase flag detected server-side from completed orders
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@/lib/supabase/admin';
import { enforceRateLimit, getClientIdentifier } from '@/lib/rate-limit';
import { validateSafe, getFirstError } from '@/lib/validations/schemas';
import { ReviewsQuerySchema, CreateReviewSchema } from '@/lib/validations/reviews';
import { hasCompletedOrderForBook } from '@/lib/reading/entitlement';
import { notifyAuthorOfNewReview } from '@/lib/email/triggers';

export const dynamic = 'force-dynamic';

interface ApiError {
  success: false;
  error: string;
}

function errorResponse(message: string, status: number, headers?: Record<string, string>) {
  return NextResponse.json({ success: false, error: message } satisfies ApiError, {
    status,
    headers,
  });
}

async function applyRateLimit(request: NextRequest) {
  const result = await enforceRateLimit('api', getClientIdentifier(request));
  if (result.success) return null;
  return errorResponse(
    result.reason === 'unavailable'
      ? 'Rate limiter unavailable. Please try again shortly.'
      : 'Rate limit exceeded. Please try again later.',
    result.reason === 'unavailable' ? 503 : 429,
    result.headers
  );
}

// ---------------------------------------------------------------------------
// GET /api/reviews
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  const limited = await applyRateLimit(request);
  if (limited) return limited;

  const parsed = validateSafe(ReviewsQuerySchema, {
    bookId: request.nextUrl.searchParams.get('bookId') ?? undefined,
    sort: request.nextUrl.searchParams.get('sort') ?? undefined,
    page: request.nextUrl.searchParams.get('page') ?? undefined,
    limit: request.nextUrl.searchParams.get('limit') ?? undefined,
  });
  if (!parsed.success) {
    return errorResponse(getFirstError(parsed.error), 400);
  }

  const { bookId, sort, page = 1, limit = 10 } = parsed.data;

  try {
    const admin = createAdminClient();

    let query = admin
      .from('reviews')
      .select(
        `
        id,
        book_id,
        user_id,
        rating,
        title,
        content,
        is_spoiler,
        helpful_count,
        verified_purchase,
        author_reply,
        author_reply_at,
        created_at,
        updated_at
      `,
        { count: 'exact' }
      )
      .eq('book_id', bookId)
      .eq('is_public', true);

    switch (sort) {
      case 'recent':
        query = query.order('created_at', { ascending: false });
        break;
      case 'highest':
        query = query
          .order('rating', { ascending: false })
          .order('created_at', { ascending: false });
        break;
      case 'lowest':
        query = query
          .order('rating', { ascending: true })
          .order('created_at', { ascending: false });
        break;
      case 'helpful':
      default:
        query = query
          .order('helpful_count', { ascending: false })
          .order('created_at', { ascending: false });
        break;
    }

    const from = (page - 1) * limit;
    const { data: reviews, error, count } = await query.range(from, from + limit - 1);

    if (error) throw error;

    // Reviewer display profiles
    const userIds = Array.from(new Set((reviews ?? []).map((r) => r.user_id)));
    const { data: profiles } = userIds.length
      ? await admin.from('profiles').select('user_id, full_name').in('user_id', userIds)
      : { data: [] as Array<{ user_id: string; full_name: string | null }> };

    const profilesByUserId = new Map((profiles ?? []).map((p) => [p.user_id, p]));

    // Current user's votes on this page of reviews (best-effort, anonymous-safe)
    const votesByReviewId = new Map<string, boolean>();
    try {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user && (reviews ?? []).length) {
        const { data: votes } = await admin
          .from('review_votes')
          .select('review_id, is_helpful')
          .eq('user_id', user.id)
          .in(
            'review_id',
            (reviews ?? []).map((r) => r.id)
          );
        for (const vote of votes ?? []) {
          votesByReviewId.set(vote.review_id, vote.is_helpful);
        }
      }
    } catch (voteErr) {
      console.warn('[api/reviews] vote lookup failed (continuing without votes):', voteErr);
    }

    const normalized = (reviews ?? []).map((review) => {
      const profile = profilesByUserId.get(review.user_id);
      return {
        ...review,
        user_vote: votesByReviewId.get(review.id) ?? null,
        user: {
          id: review.user_id,
          username: profile?.full_name || 'Reader',
          full_name: profile?.full_name || undefined,
        },
      };
    });

    // Aggregate stats across ALL public reviews for the book (single cheap column)
    const { data: allRatings } = await admin
      .from('reviews')
      .select('rating, verified_purchase')
      .eq('book_id', bookId)
      .eq('is_public', true);

    const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let sum = 0;
    let verifiedCount = 0;
    for (const row of allRatings ?? []) {
      distribution[row.rating] = (distribution[row.rating] || 0) + 1;
      sum += row.rating;
      if (row.verified_purchase) verifiedCount += 1;
    }
    const total = count ?? allRatings?.length ?? 0;

    return NextResponse.json({
      success: true,
      data: {
        reviews: normalized,
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
        stats: {
          average: total ? Number((sum / (allRatings?.length || 1)).toFixed(2)) : 0,
          total: allRatings?.length ?? 0,
          distribution,
          verifiedCount,
        },
      },
    });
  } catch (err) {
    console.error('[api/reviews] GET failed:', err);
    return errorResponse('Reviews are temporarily unavailable.', 503);
  }
}

// ---------------------------------------------------------------------------
// POST /api/reviews
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  const limited = await applyRateLimit(request);
  if (limited) return limited;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse('Invalid JSON body', 400);
  }

  const parsed = validateSafe(CreateReviewSchema, body);
  if (!parsed.success) {
    return errorResponse(getFirstError(parsed.error), 400);
  }
  const input = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return errorResponse('You must be signed in to write a review.', 401);
  }

  try {
    const admin = createAdminClient();

    // Verify the book exists and is publicly reviewable
    const { data: book } = await admin
      .from('books')
      .select('id')
      .eq('id', input.book_id)
      .eq('status', 'published')
      .maybeSingle();
    if (!book) {
      return errorResponse('Book not found.', 404);
    }

    // Verified purchase: auth user → profile → completed order containing book.
    // Best-effort: detection failure must never block a review.
    let verifiedPurchase = false;
    try {
      const { data: profile } = await admin
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
      if (profile) {
        verifiedPurchase = await hasCompletedOrderForBook(
          admin,
          profile.id,
          input.book_id,
          user.id
        );
      }
    } catch (verifyErr) {
      console.warn('[api/reviews] verified-purchase lookup failed:', verifyErr);
    }

    const now = new Date().toISOString();
    const payload = {
      rating: input.rating,
      title: input.title ?? null,
      content: input.content,
      is_spoiler: input.is_spoiler,
      is_public: true,
      verified_purchase: verifiedPurchase,
      updated_at: now,
    };

    const { data: existing } = await admin
      .from('reviews')
      .select('id')
      .eq('user_id', user.id)
      .eq('book_id', input.book_id)
      .maybeSingle();

    let reviewId: string;
    if (existing) {
      const { error } = await admin.from('reviews').update(payload).eq('id', existing.id);
      if (error) throw error;
      reviewId = existing.id;
    } else {
      const { data: inserted, error } = await admin
        .from('reviews')
        .insert({ user_id: user.id, book_id: input.book_id, ...payload })
        .select('id')
        .single();
      if (!error && inserted) {
        reviewId = inserted.id;
        // Fire-and-forget: alert the author of a newly-created public review.
        // Never awaited on the hot path; trigger itself never throws.
        const reviewerName =
          (user.user_metadata?.full_name as string | undefined) ??
          user.email?.split('@')[0] ??
          'A reader';
        void notifyAuthorOfNewReview({
          bookId: input.book_id,
          rating: input.rating,
          reviewTitle: input.title ?? undefined,
          reviewContent: input.content,
          reviewerName,
        });
      } else if (error?.code === '23505') {
        // Race with a concurrent first review → fall back to update (one review per user/book)
        const { data: raced } = await admin
          .from('reviews')
          .select('id')
          .eq('user_id', user.id)
          .eq('book_id', input.book_id)
          .single();
        if (!raced) throw error;
        const { error: updateError } = await admin
          .from('reviews')
          .update(payload)
          .eq('id', raced.id);
        if (updateError) throw updateError;
        reviewId = raced.id;
      } else {
        throw error ?? new Error('Failed to insert review');
      }
    }

    return NextResponse.json({
      success: true,
      data: { id: reviewId, verified_purchase: verifiedPurchase },
    });
  } catch (err) {
    console.error('[api/reviews] POST failed:', err);
    return errorResponse('Could not save your review right now. Please try again.', 500);
  }
}
