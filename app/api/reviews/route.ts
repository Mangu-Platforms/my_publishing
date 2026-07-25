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
import { listPublicReviewsPage } from '@/lib/data/reviews';
import { isMongoPrimary } from '@/lib/db/provider';

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
    const data = await listPublicReviewsPage({
      bookId,
      sort: sort ?? 'helpful',
      page,
      limit,
    });

    // Current user's votes on this page (best-effort, anonymous-safe).
    // review_votes is Supabase-shaped — skip when Mongo is primary.
    if (!isMongoPrimary() && data.reviews.length) {
      try {
        const admin = createAdminClient();
        const supabase = await createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          const { data: votes } = await admin
            .from('review_votes')
            .select('review_id, is_helpful')
            .eq('user_id', user.id)
            .in(
              'review_id',
              data.reviews.map((r) => r.id)
            );
          const votesByReviewId = new Map(
            (votes ?? []).map((vote) => [vote.review_id, vote.is_helpful] as const)
          );
          for (const review of data.reviews) {
            review.user_vote = votesByReviewId.get(review.id) ?? null;
          }
        }
      } catch (voteErr) {
        console.warn('[api/reviews] vote lookup failed (continuing without votes):', voteErr);
      }
    }

    return NextResponse.json({
      success: true,
      data,
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
