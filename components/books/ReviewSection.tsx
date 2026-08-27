/* eslint-disable */
'use client';

import { useCallback, useState } from 'react';
import { ReviewCard } from './ReviewCard';
import { ReviewForm } from './ReviewForm';
import { ReviewFilters } from './ReviewFilters';
import { ReviewStats } from './ReviewStats';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MessageSquare, BarChart3, TrendingUp, Filter, PlusCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

type ReviewSort = 'recent' | 'helpful' | 'highest' | 'lowest';

const PAGE_SIZE = 10;

interface ReviewSectionProps {
  bookId: string;
  initialReviews: any[];
  averageRating: number;
  totalReviews: number;
  ratingDistribution: Record<number, number>;
  userReview?: any;
  isAuthenticated?: boolean;
  /** True when the viewer is an author of this book (enables author replies). */
  canReply?: boolean;
}

export function ReviewSection({
  bookId,
  initialReviews,
  averageRating,
  totalReviews,
  ratingDistribution,
  userReview,
  isAuthenticated = false,
  canReply = false,
}: ReviewSectionProps) {
  const [reviews, setReviews] = useState(initialReviews);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [sortBy, setSortBy] = useState<ReviewSort>('helpful');
  const [filterSpoilers, setFilterSpoilers] = useState(true);
  const [page, setPage] = useState(1);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const hasUserReviewed = !!userReview;
  const hasMore = reviews.length < totalReviews;

  const fetchPage = useCallback(
    async (targetPage: number, sort: ReviewSort) => {
      const params = new URLSearchParams({
        bookId,
        sort,
        page: String(targetPage),
        limit: String(PAGE_SIZE),
      });
      const response = await fetch(`/api/reviews?${params.toString()}`, {
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) {
        throw new Error(`Reviews request failed (${response.status})`);
      }
      const json = await response.json();
      return (json?.data?.reviews ?? []) as any[];
    },
    [bookId]
  );

  const handleSortChange = async (nextSort: ReviewSort) => {
    setSortBy(nextSort);
    try {
      const firstPage = await fetchPage(1, nextSort);
      setReviews(firstPage);
      setPage(1);
    } catch {
      // Degrade gracefully: keep already-loaded reviews, sorted client-side
    }
  };

  const handleLoadMore = async () => {
    if (isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);
    try {
      const nextPage = page + 1;
      const more = await fetchPage(nextPage, sortBy);
      setReviews((prev) => {
        const seen = new Set(prev.map((review) => review.id));
        return [...prev, ...more.filter((review) => !seen.has(review.id))];
      });
      setPage(nextPage);
    } catch {
      toast.error('Could not load more reviews right now.');
    } finally {
      setIsLoadingMore(false);
    }
  };

  const visibleReviews = reviews
    .filter((review) => !filterSpoilers || !review.is_spoiler)
    .sort((a, b) => {
      switch (sortBy) {
        case 'recent':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'highest':
          return b.rating - a.rating;
        case 'lowest':
          return a.rating - b.rating;
        case 'helpful':
        default:
          return (b.helpful_count || 0) - (a.helpful_count || 0);
      }
    });

  const renderEmptyState = () => (
    <div className="py-12 text-center">
      <MessageSquare className="mx-auto mb-4 h-12 w-12 text-muted-foreground/40" />
      <h3 className="mb-2 text-lg font-semibold text-foreground">No Reviews Yet</h3>
      <p className="mx-auto mb-6 max-w-md text-muted-foreground">
        Be the first to share your thoughts about this book!
      </p>
      {isAuthenticated && !hasUserReviewed ? (
        <Button onClick={() => setShowReviewForm(true)}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Write First Review
        </Button>
      ) : !isAuthenticated ? (
        <p className="text-sm text-muted-foreground">Sign in to write the first review.</p>
      ) : null}
    </div>
  );

  const renderReviewStats = () => (
    <div className="mb-8">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-2xl font-bold text-foreground">Reviews</h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setFilterSpoilers(!filterSpoilers)}>
            <Filter className="mr-2 h-4 w-4" />
            {filterSpoilers ? 'Show Spoilers' : 'Hide Spoilers'}
          </Button>
          {isAuthenticated && (
            <Button
              variant={hasUserReviewed ? 'outline' : 'default'}
              size="sm"
              onClick={() => setShowReviewForm(true)}
            >
              {hasUserReviewed ? 'Edit Your Review' : 'Write a Review'}
            </Button>
          )}
        </div>
      </div>

      <ReviewStats
        averageRating={averageRating}
        totalReviews={totalReviews}
        ratingDistribution={ratingDistribution}
      />
    </div>
  );

  return (
    <section className="py-8">
      {renderReviewStats()}

      <Tabs defaultValue="reviews" className="mb-8">
        <TabsList className="mb-6">
          <TabsTrigger value="reviews" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            All Reviews ({totalReviews})
          </TabsTrigger>
          <TabsTrigger value="helpful" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Most Helpful
          </TabsTrigger>
          <TabsTrigger value="stats" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Statistics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="reviews" className="space-y-6">
          <ReviewFilters
            sortBy={sortBy}
            onSortChange={handleSortChange}
            filterSpoilers={filterSpoilers}
            onFilterSpoilersChange={setFilterSpoilers}
          />

          {showReviewForm && (
            <div className="mb-6">
              <ReviewForm
                bookId={bookId}
                existingReview={userReview}
                onClose={() => setShowReviewForm(false)}
              />
            </div>
          )}

          {visibleReviews.length === 0 ? (
            renderEmptyState()
          ) : (
            <>
              <div className="space-y-6">
                {visibleReviews.map((review) => (
                  <ReviewCard
                    key={review.id}
                    review={review}
                    user={review.user}
                    book={{ id: bookId, title: '', cover_url: '' }}
                    canReply={canReply}
                  />
                ))}
              </div>

              {hasMore && (
                <div className="pt-2 text-center">
                  <Button variant="outline" onClick={handleLoadMore} disabled={isLoadingMore}>
                    {isLoadingMore ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Loading…
                      </>
                    ) : (
                      `Load More Reviews (${reviews.length} of ${totalReviews})`
                    )}
                  </Button>
                </div>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="helpful">
          {(() => {
            const top = [...reviews]
              .filter((review) => (review.helpful_count || 0) > 0)
              .sort((a, b) => (b.helpful_count || 0) - (a.helpful_count || 0))
              .slice(0, 5);
            return top.length ? (
              <div className="space-y-6">
                <p className="text-sm text-muted-foreground">
                  The reviews readers found most helpful.
                </p>
                {top.map((review) => (
                  <ReviewCard
                    key={`helpful-${review.id}`}
                    review={review}
                    user={review.user}
                    book={{ id: bookId, title: '', cover_url: '' }}
                    canReply={canReply}
                    compact
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-primary/30 bg-primary/10 p-6">
                <h3 className="mb-2 text-lg font-semibold text-foreground">Most Helpful Reviews</h3>
                <p className="text-primary">
                  No reviews have been marked helpful yet. Vote on reviews you find useful and they
                  will appear here.
                </p>
              </div>
            );
          })()}
        </TabsContent>

        <TabsContent value="stats">
          <div className="rounded-lg bg-muted p-6">
            <h4 className="mb-4 font-semibold">Rating Distribution</h4>
            <ReviewStats
              averageRating={averageRating}
              totalReviews={totalReviews}
              ratingDistribution={ratingDistribution}
            />
          </div>
        </TabsContent>
      </Tabs>
    </section>
  );
}
