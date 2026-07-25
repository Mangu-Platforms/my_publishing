import { listTrendingBooks } from '@/lib/data/books';
import { BookCard } from '@/components/cards/BookCard';
import { Container } from '@/components/layout/Container';
import { TrendingUp, BookOpen } from 'lucide-react';

export async function TrendingBooksSection() {
  let books: Awaited<ReturnType<typeof listTrendingBooks>> = [];
  try {
    books = await listTrendingBooks(10);
  } catch {
    books = [];
  }

  if (books.length === 0) {
    return (
      <section className="border-y border-border/50 bg-muted/10 py-16">
        <Container>
          <div className="py-12 text-center">
            <BookOpen className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <h2 className="mb-2 text-2xl font-semibold">Trending Now</h2>
            <p className="text-muted-foreground">
              No trending books available at the moment. Check back soon!
            </p>
          </div>
        </Container>
      </section>
    );
  }

  return (
    <section className="border-y border-border/50 bg-muted/10 py-16">
      <Container>
        <div className="mb-8 flex items-center gap-3">
          <TrendingUp className="h-6 w-6 text-primary" />
          <h2 className="text-2xl font-light tracking-tight sm:text-3xl">Trending Now</h2>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-6 md:grid-cols-4 lg:grid-cols-5">
          {books.map((book) => (
            <BookCard key={book.id} book={book} variant="default" />
          ))}
        </div>
      </Container>
    </section>
  );
}
