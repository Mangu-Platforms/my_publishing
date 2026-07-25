import Link from 'next/link';
import { listFeaturedBooks } from '@/lib/data/books';
import { BookCard } from '@/components/cards/BookCard';
import { Container } from '@/components/layout/Container';
import { ChevronRight, BookOpen } from 'lucide-react';

export async function FeaturedBooksSection() {
  let books: Awaited<ReturnType<typeof listFeaturedBooks>> = [];
  try {
    books = await listFeaturedBooks(8);
  } catch {
    books = [];
  }

  if (books.length === 0) {
    return (
      <section className="bg-gradient-to-b from-background to-muted/20 py-16">
        <Container>
          <div className="py-12 text-center">
            <BookOpen className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <h2 className="mb-2 text-2xl font-semibold">Featured Books</h2>
            <p className="text-muted-foreground">
              No featured books available at the moment. Check back soon!
            </p>
          </div>
        </Container>
      </section>
    );
  }

  return (
    <section className="bg-gradient-to-b from-background to-muted/20 py-16">
      <Container>
        <div className="mb-8 flex items-center justify-between">
          <h2 className="text-2xl font-light tracking-tight sm:text-3xl">Featured Books</h2>
          <Link
            href="/books"
            className="inline-flex items-center text-sm font-medium text-primary transition-colors hover:text-primary/80"
          >
            View All
            <ChevronRight className="ml-1 h-4 w-4" />
          </Link>
        </div>

        <div className="group relative">
          <div className="pointer-events-none absolute bottom-0 left-0 top-0 z-10 w-8 bg-gradient-to-r from-background/50 to-transparent sm:hidden" />
          <div className="pointer-events-none absolute bottom-0 right-0 top-0 z-10 w-8 bg-gradient-to-l from-background/50 to-transparent sm:hidden" />

          <div
            className="scrollbar-hide flex gap-4 overflow-x-auto pb-4 sm:gap-6"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {books.map((book) => (
              <div key={book.id} className="w-[160px] flex-shrink-0 sm:w-[180px] md:w-[200px]">
                <BookCard book={book} variant="compact" />
              </div>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}
