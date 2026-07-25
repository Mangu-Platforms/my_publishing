import type { Metadata } from 'next';
import {
  listFeaturedBooks,
  listPublishedBooks,
  listTrendingBooks,
  type ApiBook,
} from '@/lib/data/books';
import { Container } from '@/components/layout/Container';
import { Section } from '@/components/layout/Section';
import { BookCard } from '@/components/cards/BookCard';

export const metadata: Metadata = {
  title: 'Recommended Books',
  description: 'Explore personalized and trending book recommendations from MANGU Publishers.',
};

/**
 * Discover recommendations baseline (Phoenix WS2d / 2d.1).
 * Dual-run via lib/data/books — Supabase by default; Mongo when DATABASE_PROVIDER=mongodb.
 * Editorial rails only; Resonance personalization remains on /recommendations.
 */
async function getRecommendationRails(): Promise<{
  featured: ApiBook[];
  trending: ApiBook[];
  catalog: ApiBook[];
}> {
  const [featured, trending, published] = await Promise.all([
    listFeaturedBooks(8).catch(() => [] as ApiBook[]),
    listTrendingBooks(12).catch(() => [] as ApiBook[]),
    listPublishedBooks({ page: 1, perPage: 12, sort: 'published_at' }).catch(() => ({
      books: [] as ApiBook[],
      total: 0,
      page: 1,
      perPage: 12,
    })),
  ]);

  return {
    featured,
    trending,
    catalog: published.books,
  };
}

function BookGrid({ books }: { books: ApiBook[] }) {
  if (books.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-secondary">No books available in this rail.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-6">
      {books.map((book) => (
        <BookCard key={book.id} book={book} />
      ))}
    </div>
  );
}

export default async function DiscoverRecommendationsPage() {
  const { featured, trending, catalog } = await getRecommendationRails();
  const empty = featured.length === 0 && trending.length === 0 && catalog.length === 0;

  return (
    <Section>
      <Container>
        <h1 className="mb-2 text-4xl font-bold">Recommended for You</h1>
        <p className="mb-10 max-w-2xl text-secondary">
          Featured picks, trending titles, and fresh catalog arrivals from MANGU Publishers.
        </p>

        {empty ? (
          <div className="py-12 text-center">
            <p className="text-secondary">No recommendations available.</p>
          </div>
        ) : (
          <div className="space-y-12">
            <section>
              <h2 className="mb-6 text-2xl font-light tracking-tight">Featured</h2>
              <BookGrid books={featured} />
            </section>
            <section>
              <h2 className="mb-6 text-2xl font-light tracking-tight">Trending</h2>
              <BookGrid books={trending} />
            </section>
            <section>
              <h2 className="mb-6 text-2xl font-light tracking-tight">New on MANGU</h2>
              <BookGrid books={catalog} />
            </section>
          </div>
        )}
      </Container>
    </Section>
  );
}
