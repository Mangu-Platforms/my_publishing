/**
 * /reading/[bookId] — intentional terminal state (Task 1.7).
 *
 * Auth + entitlement checks are unchanged and still fail closed: anonymous
 * visitors go to /login (middleware), and anyone without a completed order for
 * the title is bounced to the product page. What changed is the payload: the
 * route no longer pretends to be a reader.
 */
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { fetchBookForApi } from '@/lib/data/books';
import { getReadingSession } from '@/lib/data/reading';
import { ReadingUnavailable } from './ReadingUnavailable';

export default async function ReadingPage({ params }: { params: { bookId: string } }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const catalogBook = await fetchBookForApi({ id: params.bookId });
  if (!catalogBook) {
    redirect('/books');
  }

  const session = await getReadingSession(user.id, params.bookId);
  if (!session) {
    // Fail closed: unpaid / private titles bounce to the PDP (or library).
    redirect(catalogBook.slug ? `/books/${catalogBook.slug}` : '/library');
  }

  return (
    <ReadingUnavailable title={session.book.title} bookSlug={catalogBook.slug ?? null} />
  );
}
