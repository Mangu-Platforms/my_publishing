import { Container } from '@/components/layout/Container';
import { Section } from '@/components/layout/Section';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { listAdminAuthors } from '@/lib/data/admin-books';
import { BookCreateForm } from './BookCreateForm';

export const dynamic = 'force-dynamic';

export default async function NewBookPage() {
  // Provider-aware: this used to query Supabase directly through the
  // service-role client, so under DATABASE_PROVIDER=mongodb the dropdown listed
  // authors that do not exist in the primary store.
  const authors = await listAdminAuthors();

  return (
    <Section>
      <Container>
        <div className="mb-6">
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/books">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Books
            </Link>
          </Button>
        </div>
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Add New Book</h1>
          <p className="mt-2 text-muted-foreground">
            Fill in the metadata, upload the cover and files, then publish when the readiness
            checklist is clear.
          </p>
        </div>
        <div className="max-w-3xl">
          <BookCreateForm authors={authors} />
        </div>
      </Container>
    </Section>
  );
}
