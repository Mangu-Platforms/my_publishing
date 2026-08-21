import { cache } from 'react';
import { notFound } from 'next/navigation';
// Phoenix WS2d — dual-run catalog layer
import { fetchBookForApi, listPublishedBooks } from '@/lib/data/books';
import { BookJsonLd } from '@/components/seo';
import { formatPrice } from '@/lib/utils/format-price';
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

// cache() deduplicates the generateMetadata + page-body lookups into one
// request-scoped fetch (the dual-run provider call stays untouched).
const getBook = cache(async (slug: string): Promise<ApiBook | null> => {
  return fetchBookForApi({ slug });
});

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

  const ogImage = book.cover_url
    ? { url: book.cover_url, alt: `Cover of ${book.title}` }
    : {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'MANGU Publishers - Your digital publishing platform',
      };

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
      images: [ogImage],
    },
    // A page-level twitter block replaces the layout's generic site card, so
    // the cover has to be re-declared here or shares fall back to the logo.
    twitter: {
      card: 'summary_large_image',
      title: book.title,
      description,
      images: [ogImage.url],
    },
  };
}

export default async function BookDetailPage({ params }: { params: { slug: string } }) {
  const book = await getBook(params.slug);

  if (!book) {
    notFound();
  }

  // Both depend only on the book — fetch them concurrently.
  const [similarBooks, reviewData] = await Promise.all([
    getSimilarBooks(book.genre ?? undefined, book.id),
    getReviewData(book.id, book.author_id),
  ]);

  // Normalise field names: ApiBook uses avg_rating; legacy Supabase shape uses average_rating
  const avgRating = (book.avg_rating ?? (book as Record<string, unknown>)['average_rating']) as
    | number
    | undefined;
  const trailerVimeoId = (book as Record<string, unknown>)['trailer_vimeo_id'] as
    | string
    | undefined;
  const audioUrl = (book as Record<string, unknown>)['audio_url'] as string | undefined;
  const retailerLinks = retailerLinksFrom(book);
  const penName =
    ((book.author as Record<string, unknown> | undefined)?.['pen_name'] as string) ??
    'Unknown Author';
  // Numeric truthiness on purpose: discount_price 0 means "no discount",
  // matching Stripe-charge semantics (discount_price || price) and the
  // pre-existing display.
  const offerPrice = book.discount_price || book.price;
  const listPrice = formatPrice(book.price);
  const salePrice = book.discount_price ? formatPrice(book.discount_price) : null;

  return (
    <div>
      <BookJsonLd
        title={book.title}
        author={{
          name: penName,
          url: book.author_id ? `${getSiteUrl()}/authors/${book.author_id}` : undefined,
        }}
        description={book.description ?? undefined}
        url={`${getSiteUrl()}/books/${params.slug}`}
        coverUrl={book.cover_url ?? undefined}
        genre={book.genre ?? undefined}
        // aggregateRating is only truthful with actual reviews behind it.
        rating={
          avgRating && reviewData.totalReviews > 0
            ? { value: Number(avgRating), count: reviewData.totalReviews }
            : undefined
        }
        // Offer mirrors the visible price: discount wins when set.
        price={offerPrice != null ? { amount: Number(offerPrice), currency: 'USD' } : undefined}
      />

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
                  sizes="(max-width: 768px) 100vw, 384px"
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
                {salePrice ? (
                  <>
                    {listPrice && (
                      <span className="mr-2 text-secondary line-through">
                        <span className="sr-only">Original price </span>
                        {listPrice}
                      </span>
                    )}
                    <span className="text-primary">
                      <span className="sr-only">Sale price </span>
                      {salePrice}
                    </span>
                  </>
                ) : (
                  listPrice && <span>{listPrice}</span>
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
