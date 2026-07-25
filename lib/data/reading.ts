/**
 * Dual-run reading session helpers (Phoenix WS2d.1 Slice C/D).
 * Auth stays on AUTH_PROVIDER; data gated by DATABASE_PROVIDER.
 *
 * Mongo reading_progress.user_id / orders.user_id = auth user id (A-6).
 * Supabase uses profiles.id on those tables.
 */

import '@/lib/server-only-guard';

import { isMongoPrimary } from '@/lib/db/provider';
import { fetchBookForApi, type ApiBook } from '@/lib/data/books';
import { hasCompletedOrderForBook } from '@/lib/reading/entitlement';
import type { Book, ReadingProgress } from '@/types';

export type ReadingSession = {
  book: Book;
  progress: ReadingProgress | null;
};

function apiBookToClientBook(book: ApiBook): Book {
  return {
    id: book.id,
    title: book.title,
    slug: book.slug,
    description: book.description ?? undefined,
    cover_url: book.cover_url ?? undefined,
    author_id: String(book.author_id ?? ''),
    status: (book.status as Book['status']) ?? 'published',
    visibility: (book.visibility as Book['visibility']) ?? 'public',
    price: typeof book.price === 'number' ? book.price : undefined,
    genre: book.genre ?? undefined,
    content_type: (book.content_type as Book['content_type']) ?? 'book',
    published_at: typeof book.published_at === 'string' ? book.published_at : undefined,
    created_at: typeof book.created_at === 'string' ? book.created_at : new Date().toISOString(),
    updated_at: typeof book.updated_at === 'string' ? book.updated_at : new Date().toISOString(),
  };
}

async function resolveSupabaseProfileId(
  authUserId: string
): Promise<{
  profileId: string;
  admin: Awaited<ReturnType<typeof import('@/lib/supabase/admin').createClient>>;
} | null> {
  const { createClient: createAdminClient } = await import('@/lib/supabase/admin');
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from('profiles')
    .select('id')
    .eq('user_id', authUserId)
    .maybeSingle();
  if (!profile) return null;
  return { profileId: profile.id, admin };
}

/**
 * Load book + entitlement + progress for the reading page.
 * Returns null when the book is missing or the user is not entitled.
 */
export async function getReadingSession(
  authUserId: string,
  bookId: string
): Promise<ReadingSession | null> {
  const apiBook = await fetchBookForApi({ id: bookId });
  if (!apiBook) return null;
  const book = apiBookToClientBook(apiBook);

  if (isMongoPrimary()) {
    const entitled = await hasCompletedOrderForBook(null as never, authUserId, bookId, authUserId);
    if (!entitled) return null;

    const { getDb } = await import('@/lib/mongo');
    const db = await getDb();
    const row = await db.collection('reading_progress').findOne({
      user_id: authUserId,
      book_id: bookId,
    });

    if (!row) return { book, progress: null };

    const progress: ReadingProgress = {
      id: String(row._id),
      user_id: String(row.user_id),
      book_id: String(row.book_id),
      current_position: Number(row.current_position ?? 0),
      is_finished: Boolean(row.is_finished),
      rating: (row.rating as number | null | undefined) ?? null,
      finished_at:
        row.finished_at instanceof Date
          ? row.finished_at.toISOString()
          : ((row.finished_at as string | null | undefined) ?? null),
      last_accessed:
        row.last_accessed instanceof Date
          ? row.last_accessed.toISOString()
          : (row.last_accessed as string | undefined),
      created_at:
        row.created_at instanceof Date
          ? row.created_at.toISOString()
          : String(row.created_at ?? ''),
      updated_at:
        row.updated_at instanceof Date
          ? row.updated_at.toISOString()
          : String(row.updated_at ?? ''),
    };
    return { book, progress };
  }

  const resolved = await resolveSupabaseProfileId(authUserId);
  if (!resolved) return null;
  const { profileId, admin } = resolved;

  const entitled = await hasCompletedOrderForBook(admin, profileId, bookId, authUserId);
  if (!entitled) return null;

  const { data: progress } = await admin
    .from('reading_progress')
    .select('*')
    .eq('user_id', profileId)
    .eq('book_id', bookId)
    .maybeSingle();

  return { book, progress: (progress as ReadingProgress) || null };
}

/** Entitlement-gated progress upsert used by the reading autosave action. */
export async function upsertReadingProgress(
  authUserId: string,
  bookId: string,
  position: number
): Promise<void> {
  if (isMongoPrimary()) {
    const entitled = await hasCompletedOrderForBook(null as never, authUserId, bookId, authUserId);
    if (!entitled) return;

    const { getDb } = await import('@/lib/mongo');
    const db = await getDb();
    const now = new Date();
    await db.collection('reading_progress').updateOne(
      { user_id: authUserId, book_id: bookId },
      {
        $set: {
          user_id: authUserId,
          book_id: bookId,
          current_position: position,
          is_finished: false,
          last_accessed: now,
          updated_at: now,
        },
        $setOnInsert: { created_at: now },
      },
      { upsert: true }
    );
    return;
  }

  const resolved = await resolveSupabaseProfileId(authUserId);
  if (!resolved) return;
  const { profileId, admin } = resolved;

  let entitled = false;
  try {
    entitled = await hasCompletedOrderForBook(admin, profileId, bookId, authUserId);
  } catch {
    return;
  }
  if (!entitled) return;

  await admin.from('reading_progress').upsert(
    {
      user_id: profileId,
      book_id: bookId,
      current_position: position,
      is_finished: false,
      last_accessed: new Date().toISOString(),
    },
    { onConflict: 'user_id,book_id' }
  );
}
