/* eslint-disable */
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getRequestUser } from '@/lib/api/request-user';
import { listMyReviews } from '@/lib/data/reviews';
import { ReviewCard } from '@/components/books/ReviewCard';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MessageSquare, Star, TrendingUp, Filter, PlusCircle } from 'lucide-react';
import { ReviewActions } from '@/components/books/ReviewActions';

export default async function MyReviewsPage() {
  // Session via AUTH_PROVIDER; review rows via DATABASE_PROVIDER (default supabase).
  const user = await getRequestUser();
  if (!user) {
    redirect('/login');
  }

  const { reviews, profile } = await listMyReviews(user.id);

  const publishedReviews = reviews.filter((r) => r.is_public);
  const draftReviews = reviews.filter((r) => !r.is_public);

  const totalReviews = reviews.length;
  const averageRating = reviews.length
    ? reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length
    : 0;
  const helpfulReviews = reviews.filter((r) => r.helpful_count > 5).length;
  const reviewUser = {
    id: user.id,
    username: profile.full_name || 'Reader',
    full_name: profile.full_name || undefined,
    avatar_url: profile.avatar_url || undefined,
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="mb-2 text-3xl font-bold text-gray-900">My Reviews</h1>
        <p className="text-gray-600">Manage and track all your book reviews in one place</p>
      </div>

      {/* Stats */}
      <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="rounded-lg border bg-white p-6">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">Total Reviews</h3>
            <MessageSquare className="h-5 w-5 text-blue-600" />
          </div>
          <p className="text-3xl font-bold text-gray-900">{totalReviews}</p>
        </div>

        <div className="rounded-lg border bg-white p-6">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">Average Rating</h3>
            <Star className="h-5 w-5 text-yellow-600" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-3xl font-bold text-gray-900">{averageRating.toFixed(1)}</span>
            <span className="text-gray-500">/ 5.0</span>
          </div>
        </div>

        <div className="rounded-lg border bg-white p-6">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">Helpful Reviews</h3>
            <TrendingUp className="h-5 w-5 text-green-600" />
          </div>
          <p className="text-3xl font-bold text-gray-900">{helpfulReviews}</p>
        </div>
      </div>

      {/* Reviews */}
      <div className="rounded-lg border bg-white p-6">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-semibold">All Reviews</h2>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm">
              <Filter className="mr-2 h-4 w-4" />
              Filter
            </Button>
            <Button size="sm" asChild>
              <Link href="/books">
                <PlusCircle className="mr-2 h-4 w-4" />
                Write New Review
              </Link>
            </Button>
          </div>
        </div>

        <Tabs defaultValue="published">
          <TabsList className="mb-6">
            <TabsTrigger value="published">Published ({publishedReviews.length})</TabsTrigger>
            <TabsTrigger value="drafts">Drafts ({draftReviews.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="published">
            {publishedReviews.length > 0 ? (
              <div className="space-y-6">
                {publishedReviews.map((review) => {
                  const book = review.book;
                  return (
                    <div key={review.id} className="group relative">
                      <ReviewCard
                        review={review}
                        user={reviewUser}
                        book={
                          book
                            ? {
                                id: book.slug || book.id,
                                title: book.title,
                                cover_url: book.cover_url ?? undefined,
                              }
                            : undefined
                        }
                        showBookInfo
                      />
                      <div className="absolute right-4 top-4 opacity-0 transition-opacity group-hover:opacity-100">
                        <ReviewActions
                          review={review}
                          isOwnReview
                          editHref={book?.slug ? `/books/${book.slug}#reviews` : undefined}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-12 text-center">
                <MessageSquare className="mx-auto mb-4 h-12 w-12 text-gray-300" />
                <h3 className="mb-2 text-lg font-semibold text-gray-900">
                  No Published Reviews Yet
                </h3>
                <p className="mb-6 text-gray-600">
                  Start sharing your thoughts on the books you've read!
                </p>
                <Button asChild>
                  <Link href="/books">
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Write Your First Review
                  </Link>
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="drafts">
            {draftReviews.length > 0 ? (
              <div className="space-y-6">
                {draftReviews.map((review) => (
                  <div
                    key={review.id}
                    className="rounded-lg border border-yellow-200 bg-yellow-50 p-4"
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold">{review.book?.title}</h3>
                        <p className="text-sm text-gray-600">
                          Last edited: {new Date(review.updated_at).toLocaleDateString()}
                        </p>
                      </div>
                      <span className="rounded-full bg-yellow-100 px-3 py-1 text-sm font-medium text-yellow-800">
                        Draft
                      </span>
                    </div>
                    <p className="line-clamp-2 text-gray-700">{review.content}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center">
                <p className="text-gray-500">No draft reviews</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
