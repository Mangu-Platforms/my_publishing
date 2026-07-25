// PERF-PHASE2-1 · Phoenix WS2d — dual-run data layer
import { listPublishedBooks } from '@/lib/data/books';
import { BookListItem } from './BookListItem';

interface BookListStreamProps {
  contentType: string;
  searchParams: {
    q?: string;
    genre?: string;
    sort?: string;
    page?: string;
  };
  emptyMessage?: string;
}

export async function BookListStream({
  contentType: _contentType,
  searchParams,
  emptyMessage,
}: BookListStreamProps) {
  const page = searchParams.page ? parseInt(searchParams.page, 10) : 1;
  const { books } = await listPublishedBooks({
    genre: searchParams.genre,
    page,
    perPage: 20,
  });

  if (books.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-muted-foreground">
          {emptyMessage || 'No items found. Try adjusting your filters.'}
        </p>
      </div>
    );
  }

  return (
    <div className="mt-8 grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-6">
      {books.map((book) => (
        <BookListItem key={book.id} book={book} />
      ))}
    </div>
  );
}
