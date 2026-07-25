/**
 * Dual-run author helpers (Phoenix WS2d.1 Slice B).
 * Default: Supabase. Mongo when DATABASE_PROVIDER=mongodb.
 */

import '@/lib/server-only-guard';

import { isMongoPrimary } from '@/lib/db/provider';

export type FeaturedAuthor = {
  id: string;
  pen_name: string;
  bio: string | null;
  total_books: number;
  is_verified: boolean;
  profile: { full_name: string | null } | null;
};

/**
 * Homepage Author Spotlight — verified authors ordered by total_books.
 */
export async function listFeaturedAuthors(limit = 4): Promise<FeaturedAuthor[]> {
  if (isMongoPrimary()) {
    try {
      const { getDb } = await import('@/lib/mongo');
      const db = await getDb();
      const rows = await db
        .collection('authors')
        .find({ is_verified: true })
        .sort({ total_books: -1 })
        .limit(limit)
        .toArray();

      return rows.map((row) => ({
        id: String(row._id),
        pen_name: String(row.pen_name ?? 'Author'),
        bio: (row.bio as string | null | undefined) ?? null,
        total_books: Number(row.total_books ?? 0),
        is_verified: Boolean(row.is_verified),
        profile: {
          full_name: (row.pen_name as string | undefined) ?? null,
        },
      }));
    } catch {
      return [];
    }
  }

  const { createPublicCatalogClient } = await import('@/lib/supabase/public-queries');
  const supabase = createPublicCatalogClient();
  const { data, error } = await supabase
    .from('authors')
    .select('id, pen_name, bio, total_books, is_verified, profile:profiles(full_name)')
    .eq('is_verified', true)
    .order('total_books', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data as unknown as FeaturedAuthor[]) || [];
}
