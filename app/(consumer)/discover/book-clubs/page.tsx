import type { Metadata } from 'next';
import Link from 'next/link';
import { Container } from '@/components/layout/Container';
import { Section } from '@/components/layout/Section';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'Book Clubs — Not available yet',
  description:
    'Hosted book clubs are not available on MANGU yet. Browse the catalog meanwhile.',
};

/**
 * Discover alias — same honest unavailable status as `/book-clubs` (E-001).
 *
 * Task 4.6: this is a status page, not a placeholder page. The reader-facing
 * copy no longer describes itself as a placeholder; it says what does not
 * exist and sends people somewhere that works.
 */
export default function DiscoverBookClubsPage() {
  return (
    <Section>
      <Container>
        <p
          className="mb-3 text-sm font-medium uppercase tracking-wide text-secondary"
          role="status"
        >
          Not available yet
        </p>
        <h1 className="mb-4 text-4xl font-bold">Book Clubs</h1>
        <p className="mb-8 max-w-2xl text-secondary">
          MANGU does not host book clubs. There is nothing to join or browse here, and no sign-up
          list to add yourself to. If that changes, this page will say so.
        </p>
        <Button asChild variant="secondary">
          <Link href="/books">Browse catalog instead</Link>
        </Button>
      </Container>
    </Section>
  );
}
