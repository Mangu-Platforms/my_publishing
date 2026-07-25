import { notFound } from 'next/navigation';
// Phoenix WS2d — dual-run catalog layer
import { fetchBookForApi, listPublishedBooks } from '@/lib/data/books';
import { Container } from '@/components/layout/Container';
import { Section } from '@/components/layout/Section';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BookCard } from '@/components/cards/BookCard';
import { ReviewSection } from '@/components/books/ReviewSection';
import { WishlistButton } from '@/components/reader/WishlistButton';
import { FollowAuthorButton } from '@/components/reader/FollowAuthorButton';
import { VimeoPlayer } from '@/components/players/VimeoPlayer';
import { AudioPlayer } from '@/components/players/AudioPlayer';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@/lib/supabase/admin';
import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import type { ApiBook } from '@/lib/data/books';
import { getSiteUrl } from '@/lib/seo/siteUrl';

async function getBook(slug: string): Promise<ApiBook | null> {
  return fetchBookForApi({ slug });
}

async function getSimilarBooks(genre: string | undefined, excludeId: string) {
  const { books } = await listPublishedBooks({ genre, perPage: 7 });
  return books.filter((b) => b.id !== excludeId).slice(0, 6);
}

const REVIEWS_PAGE_SIZE = 10;

interface ReviewUser {
  id: string;
  username: string;
  full_name?: string;
}

interface BookReview {
  id: string;
  book_id: string;
  user_id: string;
  rating: number;
  title?: string | null;
  content: string;
  is_spoiler: boolean;
  is_public: boolean;
  helpful_count: number;
  verified_purchase?: boolean;
  author_reply?: string | null;
  author_reply_at?: string | null;
  created_at: string;
  updated_at: string;
  user_vote?: boolean | null;
  user: ReviewUser;
}

interface ReviewDataResult {
  reviews: BookReview[];
  averageRating: number;
  totalReviews: number;
  ratingDistribution: Record<number, number>;
  userReview?: BookReview;
  isAuthenticated: boolean;
  canReply: boolean;
}

function emptyReviewData(isAuthenticated = false): ReviewDataResult {
  return {
    reviews: [],
    averageRating: 0,
    totalReviews: 0,
    ratingDistribution: {},
    isAuthenticated,
    canReply: false,
  };
}

async function getReviewData(
  bookId: string,
  bookAuthorId?: string | null
): Promise<ReviewDataResult> {
  const emptyStats = { sum: 0, total: 0, distribution: {} as Record<number, number> };

  try {
    const supabase = await createClient();
    const admin = createAdminClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // First page of reviews (sorted "most helpful"; further pages via /api/reviews)
    const { data: reviews, error: reviewsError } = await admin
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
        is_public,
        helpful_count,
        verified_purchase,
        author_reply,
        author_reply_at,
        created_at,
        updated_at
      `
      )
      .eq('book_id', bookId)
      .eq('is_public', true)
      .order('helpful_count', { ascending: false })
      .order('created_at', { ascending: false })
      .range(0, REVIEWS_PAGE_SIZE - 1);

    // Aggregate stats over ALL public reviews (single cheap column fetch)
    const { data: allRatings, error: statsError } = await admin
      .from('reviews')
      .select('rating')
      .eq('book_id', bookId)
      .eq('is_public', true);

    if (reviewsError || statsError) {
      // Table/columns missing (migration not applied yet) → degrade, never 500 the page
      console.warn('[book-page] reviews query failed; rendering without reviews', {
        reviewsError,
        statsError,
      });
      return emptyReviewData(!!user);
    }

    const stats = (allRatings || []).reduce((acc, row) => {
      acc.sum += row.rating;
      acc.total += 1;
      acc.distribution[row.rating] = (acc.distribution[row.rating] || 0) + 1;
      return acc;
    }, emptyStats);

    // Reviewer display profiles
    const userIds = Array.from(new Set((reviews || []).map((review) => review.user_id)));
    const { data: profiles } = userIds.length
      ? await admin.from('profiles').select('user_id, full_name').in('user_id', userIds)
      : { data: [] };

    const profilesByUserId = new Map(
      (profiles || []).map((profile) => [
        profile.user_id,
        {
          id: profile.user_id,
          username: profile.full_name || 'Reader',
          full_name: profile.full_name || undefined,
        },
      ])
    );

    // Current user's votes on this page of reviews
    const votesByReviewId = new Map<string, boolean>();
    if (user && (reviews || []).length) {
      const { data: votes } = await admin
        .from('review_votes')
        .select('review_id, is_helpful')
        .eq('user_id', user.id)
        .in(
          'review_id',
          (reviews || []).map((review) => review.id)
        );
      for (const vote of votes || []) {
        votesByReviewId.set(vote.review_id, vote.is_helpful);
      }
    }

    // Author-reply permission: user → profile → authors → book.author_id
    let canReply = false;
    if (user && bookAuthorId) {
      const { data: profile } = await admin
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
      if (profile) {
        const { data: authorRows } = await admin
          .from('authors')
          .select('id')
          .eq('profile_id', profile.id);
        canReply = (authorRows || []).some((row) => row.id === bookAuthorId);
      }
    }

    const normalizedReviews = (reviews || []).map((review) => ({
      ...review,
      user_vote: votesByReviewId.get(review.id) ?? null,
      user: profilesByUserId.get(review.user_id) || {
        id: review.user_id,
        username: 'Reader',
      },
    }));

    const totalReviews = stats.total;
    const averageRating = totalReviews ? stats.sum / totalReviews : 0;

    // The signed-in user's own review may live outside the first page
    let userReview = normalizedReviews.find((review) => review.user_id === user?.id);
    if (user && !userReview) {
      const { data: ownReview } = await admin
        .from('reviews')
        .select(
          'id, book_id, user_id, rating, title, content, is_spoiler, is_public, helpful_count, verified_purchase, author_reply, author_reply_at, created_at, updated_at'
        )
        .eq('book_id', bookId)
        .eq('user_id', user.id)
        .maybeSingle();
      if (ownReview) {
        userReview = {
          ...ownReview,
          user_vote: null,
          user: profilesByUserId.get(ownReview.user_id) || {
            id: ownReview.user_id,
            username: 'You',
          },
        };
      }
    }

    return {
      reviews: normalizedReviews,
      averageRating,
      totalReviews,
      ratingDistribution: stats.distribution,
      userReview,
      isAuthenticated: !!user,
      canReply,
    };
  } catch (error) {
    console.error('[book-page] getReviewData failed; rendering without reviews', error);
    return emptyReviewData(false);
  }
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const book = await getBook(params.slug);

  if (!book) {
    return {
      title: 'Book Not Found',
    };
  }

  const description =
    book.description ||
    `Read ${book.title} by ${(book.author as Record<string, unknown> | undefined)?.['pen_name'] as string ?? 'Unknown Author'}`;
  const pageUrl = `${getSiteUrl()}/books/${params.slug}`;

  return {
    title: book.title,
    description,
    alternates: {
      canonical: pageUrl,
    },
    openGraph: {
      title: book.title,
      description,
      url: pageUrl,
      images: [
        book.cover_url
          ? { url: book.cover_url, alt: `Cover of ${book.title}` }
          : {
              url: '/og-image.png',
              width: 1200,
              height: 630,
              alt: 'MANGU Publishers - Your digital publishing platform',
            },
      ],
    },
  };
}

export default async function BookDetailPage({ params }: { params: { slug: string } }) {
  const book = await getBook(params.slug);

  if (!book) {
    notFound();
  }

  const similarBooks = await getSimilarBooks(book.genre ?? undefined, book.id);
  const reviewData = await getReviewData(book.id, book.author_id);

  // Normalise field names: ApiBook uses avg_rating; legacy Supabase shape uses average_rating
  const avgRating = (book.avg_rating ?? (book as Record<string, unknown>)['average_rating']) as number | undefined;
  const trailerVimeoId = (book as Record<string, unknown>)['trailer_vimeo_id'] as string | undefined;
  const audioUrl = (book as Record<string, unknown>)['audio_url'] as string | undefined;

  return (
    <div>
      {/* Hero Section */}
      <Section className="bg-muted">
        <Container>
          <div className="grid gap-8 md:grid-cols-2">
            <div className="relative mx-auto aspect-[2/3] max-w-sm">
              {book.cover_url && (
                <Image
                  src={book.cover_url}
                  alt={`Cover of ${book.title}`}
                  fill
                  className="rounded-lg object-cover"
                  priority
                />
              )}
            </div>
            <div>
              <h1 className="mb-4 text-4xl font-bold">{book.title}</h1>
              <p className="mb-4 text-xl text-secondary">
                by{' '}
                {book.author_id ? (
                  <Link href={`/authors/${book.author_id}`} className="hover:text-primary">
                    {(book.author as Record<string, unknown> | undefined)?.['pen_name'] as string ?? 'Unknown Author'}
                  </Link>
                ) : (
                  <span>Unknown Author</span>
                )}
                {book.author_id && (
                  <FollowAuthorButton authorId={book.author_id} className="ml-3" />
                )}
              </p>
              <div className="mb-6 flex items-center gap-4">
                {avgRating ? (
                  <>
                    <div className="flex items-center gap-1">
                      <span className="text-yellow-400">★</span>
                      <span>{Number(avgRating).toFixed(1)}</span>
                    </div>
                    <span className="text-secondary">•</span>
                  </>
                ) : null}
              </div>
              <p className="mb-6 text-lg">{book.description}</p>
              <div className="mb-6 flex gap-4">
                <Button asChild size="lg">
                  <Link href={`/reading/${book.id}`}>Start Reading</Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link href={`/checkout?book_id=${book.id}`}>Purchase</Link>
                </Button>
                <WishlistButton bookId={book.id} />
              </div>
              <div className="text-2xl font-bold">
                {book.discount_price ? (
                  <>
                    <span className="mr-2 text-secondary line-through">${book.price}</span>
                    <span className="text-primary">${book.discount_price}</span>
                  </>
                ) : (
                  <span>${book.price}</span>
                )}
              </div>
            </div>
          </div>
        </Container>
      </Section>

      {/* Tabs Section */}
      <Section>
        <Container>
          <Tabs defaultValue="overview" className="w-full">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="audio">Audio Sample</TabsTrigger>
              <TabsTrigger value="reviews">Reviews</TabsTrigger>
            </TabsList>
            <TabsContent value="overview" className="mt-6">
              {trailerVimeoId && (
                <div className="mb-8">
                  <VimeoPlayer videoId={trailerVimeoId} />
                </div>
              )}
              <div>
                <h3 className="mb-4 text-2xl font-bold">About this book</h3>
                <p className="whitespace-pre-line text-lg text-secondary">{book.description}</p>
              </div>
            </TabsContent>
            <TabsContent value="audio" className="mt-6">
              {audioUrl ? (
                <AudioPlayer src={audioUrl} title="Audio Sample" />
              ) : (
                <p className="text-secondary">No audio sample available.</p>
              )}
            </TabsContent>
            <TabsContent value="reviews" className="mt-6" id="reviews">
              <ReviewSection
                bookId={book.id}
                initialReviews={reviewData.reviews}
                averageRating={reviewData.averageRating}
                totalReviews={reviewData.totalReviews}
                ratingDistribution={reviewData.ratingDistribution}
                userReview={reviewData.userReview}
                isAuthenticated={reviewData.isAuthenticated}
                canReply={reviewData.canReply}
              />
            </TabsContent>
          </Tabs>
        </Container>
      </Section>

      {/* Similar Books */}
      {similarBooks.length > 0 && (
        <Section className="bg-muted">
          <Container>
            <h2 className="mb-8 text-3xl font-bold">Similar Books</h2>
            <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-6">
              {similarBooks.map((similarBook) => (
                <BookCard key={similarBook.id} book={similarBook as never} />
              ))}
            </div>
          </Container>
        </Section>
      )}
    </div>
  );
}
