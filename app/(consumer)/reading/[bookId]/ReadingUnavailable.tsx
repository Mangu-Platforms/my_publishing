/**
 * Honest terminal state for /reading/[bookId] (Task 1.7).
 *
 * Locked launch decision: MANGU ships NO on-site EPUB reader. Readers buy
 * through the retailer links on the product page. This replaces the previous
 * stub, which rendered a fake reader chrome ("Reading interface coming soon")
 * with non-functional Previous/Next controls and a progress bar that wrote
 * fabricated reading-position rows every 30 seconds.
 *
 * Server component on purpose — nothing here is interactive.
 */
import Link from 'next/link';
import { Container } from '@/components/layout/Container';
import { Section } from '@/components/layout/Section';
import { Button } from '@/components/ui/button';

interface ReadingUnavailableProps {
  title: string;
  bookSlug: string | null;
}

export function ReadingUnavailable({ title, bookSlug }: ReadingUnavailableProps) {
  const bookHref = bookSlug ? `/books/${bookSlug}` : '/books';

  return (
    <Section>
      <Container>
        <div className="mx-auto max-w-2xl py-12 text-center">
          <h1 className="mb-4 text-2xl font-bold">Reading on MANGU isn&apos;t available</h1>
          <p className="mb-2 text-secondary">
            MANGU does not host an in-browser reader. Your purchase of{' '}
            <span className="font-medium">{title}</span> is recorded in your library, and the book
            itself is read through the retailer you buy it from.
          </p>
          <p className="mb-8 text-secondary">
            Open the book&apos;s page to see where it is available.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button asChild>
              <Link href={bookHref}>View book &amp; retailers</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/library">Back to library</Link>
            </Button>
          </div>
        </div>
      </Container>
    </Section>
  );
}

export default ReadingUnavailable;
