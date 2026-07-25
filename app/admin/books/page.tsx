/* eslint-disable */
import { Container } from '@/components/layout/Container';
import { Section } from '@/components/layout/Section';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { updateBookStatusAction } from '../actions';
import { AdminQueryError } from '../_lib/query-error';
import { listAdminBooks } from '@/lib/data/admin-books';

const PAGE_SIZE = 10;

export default async function AdminBooksPage({
  searchParams,
}: {
  searchParams?: { q?: string; status?: string; page?: string };
}) {
  const queryText = searchParams?.q?.trim() || '';
  const status = searchParams?.status || 'all';
  const currentPage = Math.max(Number(searchParams?.page || '1') || 1, 1);

  const { books, total, error } = await listAdminBooks({
    q: queryText || undefined,
    status,
    page: currentPage,
    perPage: PAGE_SIZE,
  });

  if (error) {
    console.error('[admin/books] query failed:', error);
    return (
      <Section>
        <Container>
          <AdminQueryError title="Books Management" />
        </Container>
      </Section>
    );
  }

  const totalPages = Math.max(Math.ceil((total || 0) / PAGE_SIZE), 1);
  const pageHref = (page: number) => {
    const params = new URLSearchParams();
    if (queryText) params.set('q', queryText);
    if (status !== 'all') params.set('status', status);
    params.set('page', String(page));
    return `/admin/books?${params.toString()}`;
  };

  return (
    <Section>
      <Container>
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-3xl font-bold">Books Management</h1>
          <Button asChild>
            <Link href="/admin/books/new">Add New Book</Link>
          </Button>
        </div>

        <form className="mb-6 grid gap-3 md:grid-cols-[1fr_180px_auto]" action="/admin/books">
          <input
            type="search"
            name="q"
            defaultValue={queryText}
            placeholder="Search by title"
            className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <select
            name="status"
            defaultValue={status}
            className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="all">All statuses</option>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </select>
          <Button type="submit" variant="outline">
            Filter
          </Button>
        </form>

        <div className="space-y-4">
          {books && books.length > 0 ? (
            <div className="overflow-hidden rounded-lg border border-border">
              <table className="w-full">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-4 py-3 text-left">Title</th>
                    <th className="px-4 py-3 text-left">Author</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-left">Price</th>
                    <th className="px-4 py-3 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {books.map((book) => (
                    <tr key={book.id} className="border-t border-border">
                      <td className="px-4 py-3">{book.title}</td>
                      <td className="px-4 py-3">{book.author?.pen_name || 'N/A'}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded px-2 py-1 text-xs ${
                            book.status === 'published'
                              ? 'bg-green-500/20 text-green-500'
                              : 'bg-gray-500/20 text-gray-500'
                          }`}
                        >
                          {book.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">${book.price}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <form action={updateBookStatusAction}>
                            <input type="hidden" name="bookId" value={book.id} />
                            <input
                              type="hidden"
                              name="status"
                              value={book.status === 'published' ? 'draft' : 'published'}
                            />
                            <Button variant="outline" size="sm" type="submit">
                              {book.status === 'published' ? 'Unpublish' : 'Publish'}
                            </Button>
                          </form>
                          <Button asChild variant="outline" size="sm">
                            <Link href={`/admin/books/${book.id}/edit`}>Edit</Link>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-secondary">No books found</p>
          )}
        </div>

        <div className="mt-6 flex items-center justify-between text-sm">
          <span>
            Page {currentPage} of {totalPages}
          </span>
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm" disabled={currentPage <= 1}>
              <Link href={pageHref(Math.max(currentPage - 1, 1))}>Previous</Link>
            </Button>
            <Button asChild variant="outline" size="sm" disabled={currentPage >= totalPages}>
              <Link href={pageHref(Math.min(currentPage + 1, totalPages))}>Next</Link>
            </Button>
          </div>
        </div>
      </Container>
    </Section>
  );
}
