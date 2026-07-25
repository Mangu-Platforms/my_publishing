import { notFound } from 'next/navigation';
import { FEATURE_PAPERS } from '@/lib/flags';
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
  if (!FEATURE_PAPERS) {
    return {
      title: 'Papers — Not available yet',
      robots: { index: false },
    };
  }
  // When FEATURE_PAPERS is enabled, fetch real metadata here.
  return { title: `Paper — MANGU` };
}

export default async function PaperDetailPage({ params: _params }: { params: { slug: string } }) {
  if (!FEATURE_PAPERS) {
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
          <h1 className="mb-4 text-4xl font-bold">Papers</h1>
          <p className="mb-8 max-w-2xl text-secondary">
            MANGU does not offer academic papers today. When they ship, this page will say so
            clearly.
          </p>
          <Button asChild variant="secondary">
            <Link href="/books">Browse ebooks instead</Link>
          </Button>
        </Container>
      </Section>
    );
  }

  // FEATURE_PAPERS=true path — full detail page (built when flag is enabled).
  notFound();
}
