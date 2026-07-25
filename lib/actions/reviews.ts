'use server';

import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';
import { enforceRateLimit } from '@/lib/rate-limit';
import { hasCompletedOrderForBook } from '@/lib/reading/entitlement';
import { AuthorReplySchema } from '@/lib/validations/reviews';
import { isMongoPrimary } from '@/lib/db/provider';
import { deleteReviewMongo, upsertReviewMongo } from '@/lib/mongo-reviews';

/** Throws when the caller has exceeded the shared API rate bucket. */
async function enforceReviewRateLimit(userId: string) {
  const result = await enforceRateLimit('api', `reviews:${userId}`);
  if (!result.success) {
    throw new Error(
      result.reason === 'unavailable'
        ? 'Service temporarily unavailable. Please try again shortly.'
        : 'Too many requests. Please slow down and try again.'
    );
  }
}

/**
 * True when the auth user has a completed order for the book.
 * Best-effort: returns false on any lookup failure so review flows never break.
 */
async function detectVerifiedPurchase(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  bookId: string
): Promise<boolean> {
  try {
    const { data: profile } = await admin
      .from('profiles')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();
    if (!profile) return false;
    return await hasCompletedOrderForBook(admin, profile.id, bookId, userId);
  } catch (error) {
    console.warn('[reviews] verified-purchase lookup failed:', error);
    return false;
  }
}

/** True when the auth user is an author of the given book. */
async function isBookAuthor(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  bookId: string
): Promise<boolean> {
  const { data: profile } = await admin
    .from('profiles')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();
  if (!profile) return false;

  const { data: authorRows } = await admin
    .from('authors')
    .select('id')
    .eq('profile_id', profile.id);
  const authorIds = (authorRows ?? []).map((row) => row.id);
  if (!authorIds.length) return false;

  const { data: book } = await admin
    .from('books')
    .select('author_id')
    .eq('id', bookId)
    .maybeSingle();
  return !!book?.author_id && authorIds.includes(book.author_id);
}

async function updateBookReviewStats(bookId: string) {
  const admin = createAdminClient();
  const { data: reviews, error } = await admin
    .from('reviews')
    .select('rating')
    .eq('book_id', bookId)
    .eq('is_public', true);

  if (error) throw error;

  const total = reviews?.length ?? 0;
  const average = total ? reviews.reduce((sum, review) => sum + review.rating, 0) / total : 0;

  const { error: updateError } = await admin
    .from('books')
    .update({
      average_rating: Number(average.toFixed(2)),
      total_reviews: total,
      review_count: total,
      updated_at: new Date().toISOString(),
    })
    .eq('id', bookId);

  if (updateError) throw updateError;
}

async function updateReviewHelpfulCount(reviewId: string) {
  const admin = createAdminClient();
  const { count, error } = await admin
    .from('review_votes')
    .select('review_id', { count: 'exact', head: true })
    .eq('review_id', reviewId)
    .eq('is_helpful', true);

  if (error) throw error;

  const { error: updateError } = await admin
    .from('reviews')
    .update({ helpful_count: count ?? 0 })
    .eq('id', reviewId);

  if (updateError) throw updateError;
}

export async function voteOnReview(reviewId: string, helpful: boolean | null) {
  const supabase = await createClient();
  const admin = createAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('You must be logged in to vote');
  }

  await enforceReviewRateLimit(user.id);

  const { data: review } = await admin
    .from('reviews')
    .select('id')
    .eq('id', reviewId)
    .maybeSingle();
  if (!review) {
    throw new Error('Review not found');
  }

  const { error } =
    helpful === null
      ? await admin.from('review_votes').delete().eq('review_id', reviewId).eq('user_id', user.id)
      : await admin.from('review_votes').upsert(
          {
            review_id: reviewId,
            user_id: user.id,
            is_helpful: helpful,
          },
          { onConflict: 'review_id,user_id' }
        );

  if (error) {
    throw new Error('Failed to submit vote');
  }

  await updateReviewHelpfulCount(reviewId);
  revalidatePath('/');
  return { success: true };
}

export async function reportReview(reviewId: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('You must be logged in to report reviews');
  }

  // In a real implementation, this would create a moderation report
  console.log(`Review ${reviewId} reported by user ${user.id}`);

  return { success: true };
}

export async function createReview(reviewData: {
  book_id: string;
  rating: number;
  title?: string;
  content: string;
  is_spoiler: boolean;
  is_public: boolean;
}) {
  if (isMongoPrimary()) {
    const { getRequestUser } = await import('@/lib/api/request-user');
    const user = await getRequestUser();
    if (!user) {
      throw new Error('You must be logged in to write reviews');
    }
    await enforceReviewRateLimit(user.id);
    await upsertReviewMongo({
      book_id: reviewData.book_id,
      user_id: user.id,
      rating: reviewData.rating,
      title: reviewData.title,
      content: reviewData.content,
      verified_purchase: false,
    });
    revalidatePath('/');
    revalidatePath('/dashboard/my-reviews');
    revalidatePath(`/books/${reviewData.book_id}`);
    return { success: true };
  }

  const supabase = await createClient();
  const admin = createAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('You must be logged in to write reviews');
  }

  await enforceReviewRateLimit(user.id);

  // Detect verified purchase server-side (never trust the client)
  const verifiedPurchase = await detectVerifiedPurchase(admin, user.id, reviewData.book_id);

  // Check if user already has a review for this book
  const { data: existingReview } = await admin
    .from('reviews')
    .select('id')
    .eq('user_id', user.id)
    .eq('book_id', reviewData.book_id)
    .maybeSingle();

  if (existingReview) {
    // Update existing review
    const { error } = await admin
      .from('reviews')
      .update({
        rating: reviewData.rating,
        title: reviewData.title,
        content: reviewData.content,
        is_spoiler: reviewData.is_spoiler,
        is_public: reviewData.is_public,
        verified_purchase: verifiedPurchase,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existingReview.id);

    if (error) throw error;
  } else {
    // Create new review
    const { error } = await admin.from('reviews').insert({
      user_id: user.id,
      book_id: reviewData.book_id,
      rating: reviewData.rating,
      title: reviewData.title,
      content: reviewData.content,
      is_spoiler: reviewData.is_spoiler,
      is_public: reviewData.is_public,
      verified_purchase: verifiedPurchase,
    });

    if (error) throw error;
  }

  await updateBookReviewStats(reviewData.book_id);
  revalidatePath('/');
  revalidatePath('/dashboard/my-reviews');
  return { success: true };
}

export async function deleteReview(reviewId: string) {
  if (isMongoPrimary()) {
    const { getRequestUser } = await import('@/lib/api/request-user');
    const user = await getRequestUser();
    if (!user) {
      throw new Error('You must be logged in to delete reviews');
    }
    const result = await deleteReviewMongo(reviewId, user.id);
    if (!result.deleted) {
      throw new Error('You can only delete your own reviews');
    }
    revalidatePath('/dashboard/my-reviews');
    if (result.bookId) {
      revalidatePath(`/books/${result.bookId}`);
    }
    return { success: true };
  }

  const supabase = await createClient();
  const admin = createAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('You must be logged in to delete reviews');
  }

  // Check if the review belongs to the user
  const { data: review } = await admin
    .from('reviews')
    .select('user_id, book_id')
    .eq('id', reviewId)
    .single();

  if (!review || review.user_id !== user.id) {
    throw new Error('You can only delete your own reviews');
  }

  const { error } = await admin.from('reviews').delete().eq('id', reviewId);

  if (error) {
    throw new Error('Failed to delete review');
  }

  await updateBookReviewStats(review.book_id);
  revalidatePath('/dashboard/my-reviews');
  return { success: true };
}

/**
 * Post (or replace) the public author reply on a review.
 * Only an author of the reviewed book may reply.
 */
export async function replyToReview(reviewId: string, reply: string) {
  const supabase = await createClient();
  const admin = createAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('You must be logged in to reply');
  }

  await enforceReviewRateLimit(user.id);

  const parsed = AuthorReplySchema.safeParse({ reply });
  if (!parsed.success) {
    throw new Error(parsed.error.errors[0]?.message ?? 'Invalid reply');
  }

  const { data: review } = await admin
    .from('reviews')
    .select('id, book_id')
    .eq('id', reviewId)
    .maybeSingle();
  if (!review) {
    throw new Error('Review not found');
  }

  if (!(await isBookAuthor(admin, user.id, review.book_id))) {
    throw new Error('Only the author of this book can reply to its reviews');
  }

  const { error } = await admin
    .from('reviews')
    .update({
      author_reply: parsed.data.reply,
      author_reply_at: new Date().toISOString(),
    })
    .eq('id', reviewId);

  if (error) {
    throw new Error('Failed to save reply');
  }

  revalidatePath('/');
  return { success: true };
}

/** Remove the author reply from a review (book author only). */
export async function deleteAuthorReply(reviewId: string) {
  const supabase = await createClient();
  const admin = createAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('You must be logged in');
  }

  const { data: review } = await admin
    .from('reviews')
    .select('id, book_id')
    .eq('id', reviewId)
    .maybeSingle();
  if (!review) {
    throw new Error('Review not found');
  }

  if (!(await isBookAuthor(admin, user.id, review.book_id))) {
    throw new Error('Only the author of this book can manage replies');
  }

  const { error } = await admin
    .from('reviews')
    .update({ author_reply: null, author_reply_at: null })
    .eq('id', reviewId);

  if (error) {
    throw new Error('Failed to remove reply');
  }

  revalidatePath('/');
  return { success: true };
}
