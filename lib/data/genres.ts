/**
 * Dual-run genre helpers (Phoenix WS2d.1).
 *
 * Default: Supabase. Mongo when DATABASE_PROVIDER=mongodb.
 * Slug rules match the homepage GenreExplorer tiles and /genres/[genre] routes.
 */

import '@/lib/server-only-guard';

import { isMongoPrimary } from '@/lib/db/provider';
import { slugifyGenre } from '@/lib/utils/genre';

export { slugifyGenre };

/**
 * Real per-genre book counts for the homepage grid and /genres index.
 * Counts only status='published' AND visibility='public'.
 * Returns null on failure so the UI can show "unavailable" vs true zero.
 */
export async function getGenreCounts(): Promise<Record<string, number> | null> {
  if (isMongoPrimary()) {
    try {
      const { getDb } = await import('@/lib/mongo');
      const db = await getDb();
      const rows = await db
        .collection('books')
        .aggregate<{ _id: string; count: number }>([
          {
            $match: {
              status: 'published',
              visibility: 'public',
              genre: { $type: 'string', $nin: ['', null] },
            },
          },
          { $group: { _id: '$genre', count: { $sum: 1 } } },
        ])
        .toArray();

      const counts: Record<string, number> = {};
      for (const row of rows) {
        const slug = slugifyGenre(row._id ?? '');
        if (!slug) continue;
        counts[slug] = (counts[slug] ?? 0) + row.count;
      }
      return counts;
    } catch {
      return null;
    }
  }

  const { getGenreCounts: supabaseCounts } = await import('@/lib/supabase/genre-counts');
  return supabaseCounts();
}

export type GenreBrowseRow = { genre: string; slug: string; count: number };

/** Browse rows for /genres — display name + slug + count, sorted by count desc. */
export async function listGenresForBrowse(): Promise<GenreBrowseRow[]> {
  if (isMongoPrimary()) {
    try {
      const { getDb } = await import('@/lib/mongo');
      const db = await getDb();
      const rows = await db
        .collection('books')
        .aggregate<{ _id: string; count: number }>([
          {
            $match: {
              status: 'published',
              visibility: 'public',
              genre: { $type: 'string', $nin: ['', null] },
            },
          },
          { $group: { _id: '$genre', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ])
        .toArray();

      // Prefer the most common casing of each slug as the display name.
      const bySlug = new Map<string, GenreBrowseRow>();
      for (const row of rows) {
        const name = (row._id ?? '').trim();
        const slug = slugifyGenre(name);
        if (!slug) continue;
        const existing = bySlug.get(slug);
        if (!existing || row.count > existing.count) {
          bySlug.set(slug, { genre: name, slug, count: (existing?.count ?? 0) + row.count });
        } else {
          existing.count += row.count;
        }
      }
      return Array.from(bySlug.values()).sort((a, b) => b.count - a.count);
    } catch {
      return [];
    }
  }

  const { createPublicCatalogClient } = await import('@/lib/supabase/public-queries');
  const supabase = createPublicCatalogClient();
  const { data } = await supabase
    .from('books')
    .select('genre')
    .eq('status', 'published')
    .eq('visibility', 'public');

  const bySlug = new Map<string, GenreBrowseRow>();
  for (const book of data ?? []) {
    const name = (book.genre as string | null)?.trim();
    if (!name) continue;
    const slug = slugifyGenre(name);
    if (!slug) continue;
    const existing = bySlug.get(slug);
    if (existing) existing.count += 1;
    else bySlug.set(slug, { genre: name, slug, count: 1 });
  }
  return Array.from(bySlug.values()).sort((a, b) => b.count - a.count);
}
