import { redirect } from 'next/navigation';
import { getRequestUser } from '@/lib/api/request-user';
import { listAuthorDashboardData } from '@/lib/data/author-portal';
import { Container } from '@/components/layout/Container';
import { Section } from '@/components/layout/Section';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

async function getAuthorData() {
  // Session/role via AUTH_PROVIDER; catalog/portal rows via DATABASE_PROVIDER.
  const user = await getRequestUser();

  if (!user) {
    redirect('/login');
  }

  if (user.role !== 'author' && user.role !== 'admin') {
    redirect('/');
  }

  return listAuthorDashboardData(user.id);
}

export default async function AuthorDashboardPage() {
  const { author, books, manuscripts, earnings } = await getAuthorData();

  if (!author) {
    return (
      <Section>
        <Container>
          <div className="text-center">
            <h1 className="mb-4 text-2xl font-bold">Author profile not found</h1>
            <p className="mb-4 text-secondary">Please complete your author profile setup.</p>
          </div>
        </Container>
      </Section>
    );
  }

  return (
    <Section>
      <Container>
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-4xl font-bold">Author Dashboard</h1>
          <Button asChild>
            <Link href="/author/submit">Submit Manuscript</Link>
          </Button>
        </div>

        {/* Stats */}
        <div className="mb-8 grid gap-6 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Total Books</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{books.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Manuscripts</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{manuscripts.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Total Earnings</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">${earnings.toFixed(2)}</p>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity */}
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Recent Books</CardTitle>
            </CardHeader>
            <CardContent>
              {books.length === 0 ? (
                <p className="text-secondary">No books published yet.</p>
              ) : (
                <ul className="space-y-2">
                  {books.slice(0, 5).map((book) => (
                    <li key={book.id}>
                      <Link
                        href={`/books/${book.slug}`}
                        className="transition-colors hover:text-primary"
                      >
                        {book.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Recent Manuscripts</CardTitle>
            </CardHeader>
            <CardContent>
              {manuscripts.length === 0 ? (
                <p className="text-secondary">No manuscripts submitted yet.</p>
              ) : (
                <ul className="space-y-2">
                  {manuscripts.slice(0, 5).map((manuscript) => (
                    <li key={manuscript.id}>
                      <Link
                        href={`/author/projects/${manuscript.id}`}
                        className="transition-colors hover:text-primary"
                      >
                        {manuscript.title} - {manuscript.status}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </Container>
    </Section>
  );
}
