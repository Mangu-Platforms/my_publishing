import { getPlatformStats } from '@/lib/data/stats';
import { StatsBar, type Stat } from './StatsBar';

/**
 * Server wrapper for the homepage stats band (P0-014, G6).
 *
 * Fetches real, verifiable counts and passes only non-zero stats to the
 * client counter. When there is nothing truthful to show (empty catalog),
 * StatsBar renders null and the band disappears — no fabricated figures.
 */
export async function StatsBarSection() {
  let stats: Stat[] = [];

  try {
    const { books, authors } = await getPlatformStats();
    const candidates: Stat[] = [
      { value: books, suffix: '', label: 'Books' },
      { value: authors, suffix: '', label: 'Authors' },
    ];
    stats = candidates.filter((s) => s.value > 0);
  } catch {
    // On any data-layer failure, show nothing rather than stale/fake numbers.
    stats = [];
  }

  return <StatsBar stats={stats} />;
}
