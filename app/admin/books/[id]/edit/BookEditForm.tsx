'use client';

/**
 * Edit-book wrapper around the shared admin book form.
 *
 * `subtitle` is intentionally absent: `books.subtitle` exists in no Supabase
 * migration and new migrations are blocked until Task 3.6, so the field has
 * been removed from the admin surface on both providers rather than left
 * half-working on one (see lib/books/fields.ts).
 */

import { BookForm } from '../../_lib/BookForm';
import type { AdminBookFormValues } from '../../_lib/book-validation';
import type { AdminAuthorOption } from '@/lib/data/admin-books';

interface BookEditFormProps {
  bookId: string;
  authors: AdminAuthorOption[];
  initialValues: AdminBookFormValues;
}

export function BookEditForm({ bookId, authors, initialValues }: BookEditFormProps) {
  return (
    <BookForm mode="edit" bookId={bookId} authors={authors} initialValues={initialValues} />
  );
}
