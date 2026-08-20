import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getLibraryForAuthUser, type LibraryData } from '@/lib/data/library';
import { LibraryExperience } from '@/components/library/LibraryExperience';
import { LibraryError } from '@/components/library/LibraryError';
import type { LibraryItem } from '@/components/library/types';

function buildLibraryItems({ orders, progress }: LibraryData): LibraryItem[] {
  const progressByBookId = new Map(progress.map((row) => [row.book_id, row]));

  return orders.flatMap((order) =>
    (order.items || []).reduce<LibraryItem[]>((acc, item) => {
      const book = item.book;
      if (!book) return acc;
      const progressRow = progressByBookId.get(book.id);
      acc.push({
        book,
        orderNumber: order.order_number,
        purchasedAt: order.created_at,
        ...(progressRow
          ? {
              progress: {
                currentPosition: progressRow.current_position,
                isFinished: progressRow.is_finished,
                ...(progressRow.last_accessed ? { lastAccessed: progressRow.last_accessed } : {}),
              },
            }
          : {}),
      });
      return acc;
    }, [])
  );
}

export default async function LibraryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  let libraryData: LibraryData;
  try {
    libraryData = await getLibraryForAuthUser(user.id);
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'digest' in error &&
      typeof (error as { digest?: unknown }).digest === 'string' &&
      (error as { digest: string }).digest.startsWith('NEXT_REDIRECT')
    ) {
      throw error;
    }
    // Log the real error server-side; show the user a static message. The
    // page runs server-side, so error.message here would flow verbatim to the
    // HTML with no Next.js redaction (unlike client error boundaries).
    console.error('Library: fetch failed', error);
    return (
      <div className="min-h-screen bg-[#12100e] text-[#f5f1ea]">
        <h1 className="sr-only">Your Library</h1>
        <LibraryError message="We hit a problem loading your library. Please try again in a moment." />
      </div>
    );
  }

  const items = buildLibraryItems(libraryData);

  return <LibraryExperience items={items} />;
}
