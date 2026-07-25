// PERF-PHASE2-6 — Server-first reading page (Phoenix WS2d dual-run data)
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { fetchBookForApi } from '@/lib/data/books';
import { getReadingSession } from '@/lib/data/reading';
import ReadingClient from './ReadingClient';

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

  return <ReadingClient book={session.book} initialProgress={session.progress} />;
}
