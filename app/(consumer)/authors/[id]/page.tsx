import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { fetchAuthorById, listPublishedBooksForAuthor } from '@/lib/data/authors';
import { Container } from '@/components/layout/Container';
import { Section } from '@/components/layout/Section';
import { BookCard } from '@/components/cards/BookCard';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { FollowAuthorButton } from '@/components/reader/FollowAuthorButton';
import type { BookWithAuthor } from '@/types';
import { getSiteUrl } from '@/lib/seo/siteUrl';

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const author = await fetchAuthorById(params.id);

  if (!author) {
    return {
      title: 'Author Not Found',
      description: 'The requested MANGU Publishers author profile could not be found.',
    };
  }

  const displayName = author.profile?.full_name || author.pen_name;
  const description =
    author.bio || `Read books and learn more about ${displayName}, an author on MANGU Publishers.`;
  const pageUrl = `${getSiteUrl()}/authors/${params.id}`;

  return {
    title: `${displayName} - Author`,
    description,
    alternates: {
      canonical: pageUrl,
    },
    openGraph: {
      title: `${displayName} - Author`,
      description,
      url: pageUrl,
    },
  };
}

export default async function AuthorPage({ params }: { params: { id: string } }) {
  const author = await fetchAuthorById(params.id);

  if (!author) {
    notFound();
  }

  const books = (await listPublishedBooksForAuthor({
    authorId: author.id,
    profileId: author.profile_id,
  })) as unknown as BookWithAuthor[];
  const displayName = author.profile?.full_name || author.pen_name;
  const avatarUrl = author.photo_url || '';

  return (
    <div>
      <Section className="bg-muted">
        <Container>
          <div className="flex flex-col items-start gap-6 md:flex-row md:items-center">
            <Avatar className="h-20 w-20">
              <AvatarImage src={avatarUrl} alt={displayName} />
              <AvatarFallback>{displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div>
              <h1 className="mb-2 text-4xl font-bold">{displayName}</h1>
              <p className="max-w-2xl text-secondary">
                {author.bio || 'This author has not shared a bio yet.'}
              </p>
              <div className="mt-4 flex flex-wrap gap-4 text-sm text-secondary">
                <span>{author.total_books} published books</span>
                {author.is_verified && <span className="text-primary">Verified author</span>}
              </div>
              <FollowAuthorButton authorId={author.id} className="mt-4" />
            </div>
          </div>
        </Container>
      </Section>

      <Section>
        <Container>
          <h2 className="mb-6 text-3xl font-bold">Published Books</h2>
          {books.length === 0 ? (
            <p className="text-secondary">No published books yet.</p>
          ) : (
            <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-6">
              {books.map((book) => (
                <BookCard key={book.id} book={book} />
              ))}
            </div>
          )}
        </Container>
      </Section>
    </div>
  );
}
