/**
 * Genre slug normalization shared by the dual-run data layer and the
 * Supabase genre-counts cache (Phoenix WS2d.1 / Phase 10).
 *
 * ('Sci-Fi' → 'sci-fi', "Children's" → 'childrens', 'Non Fiction' → 'non-fiction')
 */
export function slugifyGenre(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/&/g, 'and')
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
