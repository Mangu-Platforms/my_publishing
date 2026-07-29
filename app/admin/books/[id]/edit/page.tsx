import { notFound } from 'next/navigation';
import { Container } from '@/components/layout/Container';
import { Section } from '@/components/layout/Section';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getAdminBook, listAdminAuthors } from '@/lib/data/admin-books';
import { getBookAssets } from '@/lib/data/book-assets';
import { RETAILER_URL_FIELDS } from '@/lib/books/fields';
import {
  EMPTY_BOOK_FORM_VALUES,
  coerceAdminStatus,
  priceInputFromStored,
  type AdminBookFormValues,
} from '../../_lib/book-validation';
import { BookEditForm } from './BookEditForm';

export const dynamic = 'force-dynamic';

export default async function EditBookPage({ params }: { params: { id: string } }) {
  // Provider-aware and NOT status-filtered: an admin has to be able to open a
  // draft. This page previously read Supabase directly, so under
  // DATABASE_PROVIDER=mongodb it could not load a book at all.
  const [book, authors] = await Promise.all([getAdminBook(params.id), listAdminAuthors()]);
  if (!book) notFound();

  // Assets live in different places per provider (books.cover_url +
  // book_content on Supabase, the document itself on Mongo) — one read.
  const assets = await getBookAssets(book.id);

  const retailerValues = {} as Record<(typeof RETAILER_URL_FIELDS)[number], string>;
  for (const field of RETAILER_URL_FIELDS) {
    retailerValues[field] = book[field] ?? '';
  }

  const initialValues: AdminBookFormValues = {
    ...EMPTY_BOOK_FORM_VALUES,
    ...retailerValues,
    title: book.title,
    slug: book.slug,
    description: book.description ?? '',
    genre: book.genre ?? '',
    author_id: book.author_id,
    price: priceInputFromStored(book.price),
    isbn: book.isbn ?? '',
    content_type: book.content_type ?? 'book',
    published_at: book.published_at ? book.published_at.slice(0, 10) : '',
    status: coerceAdminStatus(book.status),
    is_featured: book.is_featured,
    page_count: book.page_count != null ? String(book.page_count) : '',
    word_count: book.word_count != null ? String(book.word_count) : '',
    trailer_vimeo_id: book.trailer_vimeo_id ?? '',
    cover_url: assets.cover_url ?? book.cover_url ?? null,
    epub_url: assets.epub_url ?? null,
    audio_url: assets.audio_url ?? null,
    audio_narrator: assets.audio_narrator ?? '',
    audio_duration_seconds:
      assets.audio_duration_seconds != null ? String(assets.audio_duration_seconds) : '',
  };

  return (
    <Section>
      <Container>
        <div className="mb-6">
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/books">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Books
            </Link>
          </Button>
        </div>
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Edit Book</h1>
          <p className="mt-2 text-muted-foreground">
            Editing &ldquo;{book.title}&rdquo; by {book.author?.pen_name || 'Unknown Author'}
          </p>
        </div>
        <div className="max-w-3xl">
          <BookEditForm bookId={book.id} authors={authors} initialValues={initialValues} />
        </div>
      </Container>
    </Section>
  );
}
