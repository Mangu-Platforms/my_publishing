import { notFound } from 'next/navigation';
import { FEATURE_COMICS } from '@/lib/flags';
import { Container } from '@/components/layout/Container';
import { Section } from '@/components/layout/Section';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import type { Metadata } from 'next';

export async function generateMetadata({
  params: _params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  if (!FEATURE_COMICS) {
    return {
      title: 'Comics — Not available yet',
      robots: { index: false },
    };
  }
  // When FEATURE_COMICS is enabled, fetch real metadata here.
  return { title: `Comic — MANGU` };
}

export default async function ComicDetailPage({ params: _params }: { params: { slug: string } }) {
  if (!FEATURE_COMICS) {
    // Flag-off contract: honest unavailable, not 404 or broken page.
    return (
      <Section>
        <Container>
          <p
            className="mb-3 text-sm font-medium uppercase tracking-wide text-secondary"
            role="status"
          >
            Not available yet
          </p>
          <h1 className="mb-4 text-4xl font-bold">Comics</h1>
          <p className="mb-8 max-w-2xl text-secondary">
            MANGU does not offer comics today. When they ship, this page will say so clearly.
          </p>
          <Button asChild variant="secondary">
            <Link href="/books">Browse ebooks instead</Link>
          </Button>
        </Container>
      </Section>
    );
  }

  // FEATURE_COMICS=true path — full detail page (built when flag is enabled).
  notFound();
}
