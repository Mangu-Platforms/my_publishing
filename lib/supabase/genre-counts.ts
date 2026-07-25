import { unstable_cache } from 'next/cache';
import { createClient as createAdminClient } from '@/lib/supabase/admin';
import { slugifyGenre } from '@/lib/utils/genre';

export { slugifyGenre };

/**
 * Supabase implementation of per-genre book counts (Phase 10).
 *
 * Prefer `getGenreCounts` from `@/lib/data/genres` in UI code — that dual-run
 * helper delegates here when DATABASE_PROVIDER=supabase and uses Mongo when
 * DATABASE_PROVIDER=mongodb.
 *
 * Cached for 1h; tagged for invalidation with book lists. Returns null when
 * the query fails so the UI can render its unavailable state.
 */
export const getGenreCounts = unstable_cache(
  async (): Promise<Record<string, number> | null> => {
    try {
      const admin = createAdminClient();
      const { data, error } = await admin
        .from('books')
        .select('genre')
        .eq('status', 'published')
        .eq('visibility', 'public');

      if (error || !data) return null;

      const counts: Record<string, number> = {};
      for (const row of data as { genre: string | null }[]) {
        const slug = slugifyGenre(row.genre ?? '');
        if (slug) counts[slug] = (counts[slug] ?? 0) + 1;
      }
      return counts;
    } catch {
      return null;
    }
  },
  ['genre-counts'],
  { tags: ['genre-counts', 'books-list'], revalidate: 3600 }
);
