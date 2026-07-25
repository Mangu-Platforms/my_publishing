import type { Metadata } from 'next';
import { listGenresForBrowse } from '@/lib/data/genres';
import { Container } from '@/components/layout/Container';
import { Section } from '@/components/layout/Section';
import { GenreCard } from '@/components/cards/GenreCard';
import { Grid } from '@/components/layout/Grid';
import { getSiteUrl } from '@/lib/seo/siteUrl';

const pageUrl = `${getSiteUrl()}/genres`;
const description = 'Explore books, comics, audiobooks, and papers by genre on MANGU Publishers.';

export const metadata: Metadata = {
  title: 'Browse Genres',
  description,
  alternates: {
    canonical: pageUrl,
  },
  openGraph: {
    title: 'Browse Genres',
    description,
    url: pageUrl,
  },
};

export default async function GenresPage() {
  const genres = await listGenresForBrowse();

  return (
    <Section>
      <Container>
        <h1 className="mb-8 text-4xl font-bold">Browse by Genre</h1>
        <Grid cols={4}>
          {genres.map(({ genre, slug, count }) => (
            <GenreCard key={slug} genre={genre} bookCount={count} />
          ))}
        </Grid>
      </Container>
    </Section>
  );
}
