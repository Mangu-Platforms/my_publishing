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
import { getBookReviewPage } from '@/lib/data/reviews';
import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import type { ApiBook } from '@/lib/data/books';
import { getSiteUrl } from '@/lib/seo/siteUrl';
// External retailer links (populated via /admin/books/[id]/edit) — field list,
// labels and https validation live in the shared book field contract.
import { retailerLinksFrom } from '@/lib/books/fields';

async function getBook(slug: string): Promise<ApiBook | null> {
  return fetchBookForApi({ slug });
}

async function getSimilarBooks(genre: string | undefined, excludeId: string) {
  const { books } = await listPublishedBooks({ genre, perPage: 7 });
  return books.filter((b) => b.id !== excludeId).slice(0, 6);
}

async function getReviewData(bookId: string, bookAuthorId?: string | null) {
  // Auth stays on AUTH_PROVIDER; review docs go through DATABASE_PROVIDER.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return getBookReviewPage(bookId, {
    bookAuthorId,
    authUserId: user?.id ?? null,
  });
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
    `Read ${book.title} by ${((book.author as Record<string, unknown> | undefined)?.['pen_name'] as string) ?? 'Unknown Author'}`;
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
  const avgRating = (book.avg_rating ?? (book as Record<string, unknown>)['average_rating']) as
    | number
    | undefined;
  const trailerVimeoId = (book as Record<string, unknown>)['trailer_vimeo_id'] as
    | string
    | undefined;
  const audioUrl = (book as Record<string, unknown>)['audio_url'] as string | undefined;
  const retailerLinks = retailerLinksFrom(book);

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
                    {((book.author as Record<string, unknown> | undefined)?.[
                      'pen_name'
                    ] as string) ?? 'Unknown Author'}
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
              {retailerLinks.length > 0 && (
                <div className="mt-6">
                  <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-secondary">
                    Also available at
                  </h2>
                  <div className="flex flex-wrap gap-3">
                    {retailerLinks.map(({ label, url }) => (
                      <Button key={label} asChild variant="outline" size="sm">
                        <a href={url} target="_blank" rel="noopener noreferrer">
                          {label}
                        </a>
                      </Button>
                    ))}
                  </div>
                </div>
              )}
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
