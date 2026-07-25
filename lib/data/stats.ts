/**
 * Dual-run platform stats (Phoenix WS2d.1).
 * Default: Supabase. Mongo when DATABASE_PROVIDER=mongodb.
 */

import '@/lib/server-only-guard';

import { isMongoPrimary } from '@/lib/db/provider';

export type PlatformStats = { books: number; authors: number };

/**
 * Verifiable homepage counts. Only published+public books; all authors.
 * Throws on hard failure so the UI can hide the band rather than fabricate.
 */
export async function getPlatformStats(): Promise<PlatformStats> {
  if (isMongoPrimary()) {
    const { getDb } = await import('@/lib/mongo');
    const db = await getDb();
    const [books, authors] = await Promise.all([
      db.collection('books').countDocuments({ status: 'published', visibility: 'public' }),
      db.collection('authors').countDocuments({}),
    ]);
    return { books, authors };
  }

  const { getPlatformStats: supabaseStats } = await import('@/lib/supabase/queries');
  return supabaseStats();
}
