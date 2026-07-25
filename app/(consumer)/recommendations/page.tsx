import type { Metadata } from 'next';
import { listTrendingBooks } from '@/lib/data/books';
import { Container } from '@/components/layout/Container';
import { Section } from '@/components/layout/Section';
import { BookCard } from '@/components/cards/BookCard';
import { RecommendationsRail, BecauseYouReadRail } from '@/components/home';
import type { BookWithAuthor } from '@/types';

export const metadata: Metadata = {
  title: 'Recommended Books',
  description:
    'Personalized picks, trending titles, and reader favorites from the MANGU catalog — powered by the Resonance Engine.',
};

/**
 * Server-rendered editorial baseline: always available, even with JS disabled
 * or when the Resonance API is unreachable. The client rails above layer
 * personalization on top and suppress themselves on any failure.
 *
 * Dual-run via listTrendingBooks (Mongo falls back to review_count/avg_rating).
 */
async function getPopularBooks(): Promise<BookWithAuthor[]> {
  const books = await listTrendingBooks(12);
  return books as unknown as BookWithAuthor[];
}

export default async function RecommendationsPage() {
  const popularBooks = await getPopularBooks();

  return (
    <>
      <Section className="pb-6">
        <Container>
          <h1 className="mb-4 text-4xl font-bold">Recommended for You</h1>
          <p className="max-w-2xl text-secondary">
            Picks tuned to your reading taste by the Resonance Engine — plus what the rest of MANGU
            is loving right now.
          </p>
        </Container>
      </Section>

      {/* Personalized rail (falls back to trending/editorial for cold start;
          renders nothing if the API cannot answer). */}
      <RecommendationsRail
        title="For You"
        subtitle="Picked by the Resonance Engine"
        endpoint="/api/resonance/recommend?mode=auto&limit=18"
        railId="recs-for-you"
        className="pt-2"
      />

      {/* Only renders for signed-in readers with history. */}
      <BecauseYouReadRail
        railId="recs-because-you-read"
        limit={18}
        className="border-y border-border/50 bg-muted/10"
      />

      <RecommendationsRail
        title="Trending Now"
        subtitle="What MANGU readers love this week"
        endpoint="/api/resonance/recommend?mode=trending&limit=18"
        railId="recs-trending"
      />

      <Section className="bg-gradient-to-b from-background to-muted/20">
        <Container>
          <h2 className="mb-2 text-2xl font-light tracking-tight sm:text-3xl">Popular on MANGU</h2>
          <p className="mb-8 max-w-2xl text-secondary">
            Public catalog favorites, ranked by reader activity.
          </p>
          {popularBooks.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-secondary">No recommendations available.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-6">
              {popularBooks.map((book) => (
                <BookCard key={book.id} book={book} />
              ))}
            </div>
          )}
        </Container>
      </Section>
    </>
  );
}
