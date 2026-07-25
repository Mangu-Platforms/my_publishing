import type { Metadata } from 'next';
import { listAuthorsForDirectory } from '@/lib/data/authors';
import { Container } from '@/components/layout/Container';
import { Section } from '@/components/layout/Section';
import { AuthorCard } from '@/components/cards/AuthorCard';
import type { Author, Profile } from '@/types';
import { getSiteUrl } from '@/lib/seo/siteUrl';

const pageUrl = `${getSiteUrl()}/authors`;

export const metadata: Metadata = {
  title: 'Authors',
  description: 'Discover the authors publishing on Mangu Publishers.',
  alternates: {
    canonical: pageUrl,
  },
  openGraph: {
    title: 'Authors',
    description: 'Discover the authors publishing on Mangu Publishers.',
    url: pageUrl,
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'MANGU Publishers - Your digital publishing platform',
      },
    ],
  },
};

export const revalidate = 300;

type AuthorWithProfile = Author & { profile: Profile };

export default async function AuthorsPage() {
  const authors = (await listAuthorsForDirectory()) as unknown as AuthorWithProfile[];

  return (
    <div>
      <Section className="bg-muted">
        <Container>
          <h1 className="mb-2 text-4xl font-bold">Authors</h1>
          <p className="max-w-2xl text-secondary">
            Meet the storytellers behind the books on Mangu Publishers.
          </p>
        </Container>
      </Section>

      <Section>
        <Container>
          {authors.length === 0 ? (
            <p className="text-secondary">No authors to show yet. Check back soon.</p>
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {authors.map((author) => (
                <AuthorCard key={author.id} author={author} />
              ))}
            </div>
          )}
        </Container>
      </Section>
    </div>
  );
}
