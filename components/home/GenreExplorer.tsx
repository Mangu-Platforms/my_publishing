import Link from 'next/link';
import { Container } from '@/components/layout/Container';
import { cn } from '@/lib/utils/cn';
import { getGenreCounts } from '@/lib/data/genres';

interface Genre {
  name: string;
  slug: string;
  gradient: string;
}

const genres: Genre[] = [
  {
    name: 'Fiction',
    slug: 'fiction',
    gradient: 'from-rose-500/20 to-pink-600/20 hover:from-rose-500/30 hover:to-pink-600/30',
  },
  {
    name: 'Non-Fiction',
    slug: 'non-fiction',
    gradient: 'from-amber-500/20 to-orange-600/20 hover:from-amber-500/30 hover:to-orange-600/30',
  },
  {
    name: 'Mystery',
    slug: 'mystery',
    gradient: 'from-violet-500/20 to-purple-600/20 hover:from-violet-500/30 hover:to-purple-600/30',
  },
  {
    name: 'Romance',
    slug: 'romance',
    gradient: 'from-pink-500/20 to-rose-600/20 hover:from-pink-500/30 hover:to-rose-600/30',
  },
  {
    name: 'Sci-Fi',
    slug: 'sci-fi',
    gradient: 'from-cyan-500/20 to-blue-600/20 hover:from-cyan-500/30 hover:to-blue-600/30',
  },
  {
    name: 'Fantasy',
    slug: 'fantasy',
    gradient: 'from-emerald-500/20 to-teal-600/20 hover:from-emerald-500/30 hover:to-teal-600/30',
  },
  {
    name: 'Thriller',
    slug: 'thriller',
    gradient: 'from-red-500/20 to-orange-700/20 hover:from-red-500/30 hover:to-orange-700/30',
  },
  {
    name: 'Biography',
    slug: 'biography',
    gradient: 'from-yellow-500/20 to-amber-600/20 hover:from-yellow-500/30 hover:to-amber-600/30',
  },
  {
    name: 'Self-Help',
    slug: 'self-help',
    gradient: 'from-green-500/20 to-emerald-600/20 hover:from-green-500/30 hover:to-emerald-600/30',
  },
  {
    name: 'Poetry',
    slug: 'poetry',
    gradient:
      'from-fuchsia-500/20 to-purple-500/20 hover:from-fuchsia-500/30 hover:to-purple-500/30',
  },
  {
    name: 'History',
    slug: 'history',
    gradient: 'from-stone-500/20 to-amber-700/20 hover:from-stone-500/30 hover:to-amber-700/30',
  },
  {
    name: "Children's",
    slug: 'childrens',
    gradient: 'from-sky-400/20 to-indigo-500/20 hover:from-sky-400/30 hover:to-indigo-500/30',
  },
];

export async function GenreExplorer() {
  // Real published+public counts (Phase 10). null = query failed: show the
  // unavailable state rather than misleading zeros.
  const counts = await getGenreCounts();

  return (
    <section className="bg-background py-16">
      <Container>
        <div className="mb-10 text-center">
          <h2 className="mb-3 text-2xl font-light tracking-tight sm:text-3xl">Explore by Genre</h2>
          <p className="mx-auto max-w-lg text-muted-foreground">
            Dive into your favorite genres and discover new worlds waiting to be explored.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {genres.map((genre) => {
            const count = counts?.[genre.slug] ?? 0;
            const label =
              counts === null
                ? 'Browse the catalog'
                : count > 0
                  ? `${count.toLocaleString()} ${count === 1 ? 'book' : 'books'}`
                  : 'No books yet';

            return (
              <Link
                key={genre.slug}
                href={`/genres/${genre.slug}`}
                className={cn(
                  'group relative overflow-hidden rounded-xl bg-gradient-to-br p-6 transition-all duration-300',
                  'hover:scale-[1.03] hover:shadow-lg hover:shadow-primary/10',
                  'border border-border/50 hover:border-primary/30',
                  'hover:ring-2 hover:ring-primary/20',
                  genre.gradient
                )}
              >
                <div className="relative z-10">
                  <h3 className="mb-1 text-lg font-semibold transition-colors group-hover:text-primary">
                    {genre.name}
                  </h3>
                  <p className="text-sm text-muted-foreground">{label}</p>
                </div>

                <div className="absolute -bottom-4 -right-4 h-20 w-20 rounded-full bg-gradient-to-br from-primary/10 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
              </Link>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
