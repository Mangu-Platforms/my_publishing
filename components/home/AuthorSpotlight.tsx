import Link from 'next/link';
import { listFeaturedAuthors } from '@/lib/data/authors';
import { Container } from '@/components/layout/Container';

/**
 * Task 4.6 — spotlight only real authors.
 *
 * Rules: an author needs at least one published book to appear (otherwise the
 * card reads "0 books published"), we never invent a bio, and when there is
 * nobody to show the section renders nothing rather than "stay tuned".
 */
export async function AuthorSpotlight() {
  let authors: Awaited<ReturnType<typeof listFeaturedAuthors>> = [];
  try {
    authors = await listFeaturedAuthors(4);
  } catch (error) {
    console.error('Error fetching featured authors:', error);
    authors = [];
  }

  // Only authors with something published are worth spotlighting. Empty pen
  // names are dropped too — the avatar renders pen_name[0] during SSR.
  const featured = authors.filter((author) => author.total_books > 0 && author.pen_name?.trim());

  if (featured.length === 0) {
    return null;
  }

  return (
    <section className="bg-gradient-to-b from-muted/10 to-background py-16">
      <Container>
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h2 className="mb-1 text-2xl font-light tracking-tight sm:text-3xl">
              Author Spotlight
            </h2>
            <p className="text-sm text-muted-foreground">The people behind the books we publish</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {featured.map((author) => (
            <Link key={author.id} href={`/authors/${author.id}`} className="group">
              <div className="relative overflow-hidden rounded-xl border border-border/60 bg-card p-6 transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5">
                <div className="mb-4 flex justify-center">
                  <div className="relative h-20 w-20 overflow-hidden rounded-full bg-primary/10 ring-2 ring-border transition-all duration-300 group-hover:ring-primary/30">
                    <div className="flex h-full w-full items-center justify-center text-2xl font-bold text-primary/60">
                      {author.pen_name.trim()[0].toUpperCase()}
                    </div>
                  </div>
                </div>

                <div className="text-center">
                  <h3 className="mb-1 text-lg font-semibold transition-colors group-hover:text-primary">
                    {author.pen_name}
                  </h3>
                  {author.profile?.full_name && author.profile.full_name !== author.pen_name && (
                    <p className="mb-2 text-sm text-muted-foreground">{author.profile.full_name}</p>
                  )}
                  {author.bio && (
                    <p className="mb-3 line-clamp-2 text-sm text-muted-foreground">{author.bio}</p>
                  )}
                  <p className="text-xs font-medium text-primary/80">
                    {author.total_books} {author.total_books === 1 ? 'book' : 'books'} published
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </Container>
    </section>
  );
}
