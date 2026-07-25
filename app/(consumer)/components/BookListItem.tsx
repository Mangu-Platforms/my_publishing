// PERF-PHASE2-1 · Phoenix WS2d
import { BookCard } from '@/components/cards/BookCard';
import type { BookCardBook } from '@/components/cards/BookCard';

function buildHref(book: BookCardBook): string {
  const ct = (book as Record<string, unknown>)['content_type'];
  if (ct === 'comic') return `/comics/${book.slug}`;
  if (ct === 'paper') return `/papers/${book.slug}`;
  return `/books/${book.slug}`;
}

export function BookListItem({ book }: { book: BookCardBook }) {
  return <BookCard book={book} href={buildHref(book)} />;
}
