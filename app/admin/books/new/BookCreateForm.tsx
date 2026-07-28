'use client';

/**
 * Create-book wrapper around the shared admin book form.
 *
 * The whole field set, validation and publish checklist live in
 * `../_lib/BookForm` so create and edit can never drift apart (they previously
 * offered different fields, which is how cover/EPUB/retailer links ended up
 * unreachable at creation time).
 */

import { BookForm } from '../_lib/BookForm';
import { EMPTY_BOOK_FORM_VALUES } from '../_lib/book-validation';
import type { AdminAuthorOption } from '@/lib/data/admin-books';

interface BookCreateFormProps {
  authors: AdminAuthorOption[];
}

export function BookCreateForm({ authors }: BookCreateFormProps) {
  return <BookForm mode="create" authors={authors} initialValues={EMPTY_BOOK_FORM_VALUES} />;
}
