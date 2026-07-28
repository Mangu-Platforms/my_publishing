import type { Metadata } from 'next';
import Link from 'next/link';
import { Container } from '@/components/layout/Container';
import { Section } from '@/components/layout/Section';
import { getSiteUrl } from '@/lib/seo/siteUrl';

const pageUrl = `${getSiteUrl()}/about`;
const description =
  'What MANGU Publishers does, how buying a book works, and how to reach us.';

export const metadata: Metadata = {
  title: 'About MANGU',
  description,
  alternates: {
    canonical: pageUrl,
  },
  openGraph: {
    title: 'About MANGU',
    description,
    url: pageUrl,
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'MANGU Publishers',
      },
    ],
  },
};

/**
 * Task 4.6 — truthful marketing copy.
 *
 * Every claim on this page is checkable against what the site actually does:
 * a catalogue, book pages with retailer links, audio samples where they exist,
 * and an author submission route. Nothing here promises on-site reading,
 * mobile apps, or a catalogue larger than the one we have.
 *
 * TODO(renee): if you want a short "who we are" paragraph (who founded MANGU,
 * where it is based, when it started), send the wording and we will add it.
 * We are deliberately not inventing one.
 */
export default function AboutPage() {
  return (
    <div>
      <Section className="bg-muted">
        <Container>
          <h1 className="mb-2 text-4xl font-bold">About MANGU</h1>
          <p className="max-w-2xl text-secondary">
            MANGU Publishers publishes books and puts them in front of readers. This page explains
            what you can do here and what you cannot.
          </p>
        </Container>
      </Section>

      <Section>
        <Container>
          <div className="max-w-2xl space-y-10">
            <section>
              <h2 className="mb-3 text-2xl font-semibold">What we publish</h2>
              <p className="text-secondary">
                Our catalogue is small and we like it that way. Each title gets real attention
                rather than a slot on an endless shelf. You can see everything we have published on
                the{' '}
                <Link href="/books" className="text-primary hover:underline">
                  books page
                </Link>
                .
              </p>
            </section>

            <section>
              <h2 className="mb-3 text-2xl font-semibold">How you get a book</h2>
              <p className="text-secondary">
                Every book has its own page with the description, the author, and the places you can
                buy it. Where we have retailer links, they are listed there.
              </p>
              <p className="mt-3 text-secondary">
                There is no reader built into this site. You read the book in whatever app or device
                you already use, so nothing you buy is tied to MANGU.
              </p>
            </section>

            <section>
              <h2 className="mb-3 text-2xl font-semibold">Audio</h2>
              <p className="text-secondary">
                Where a title has audio, you can play a sample on the book page. We do not sell or
                deliver full audiobooks here yet.
              </p>
            </section>

            <section>
              <h2 className="mb-3 text-2xl font-semibold">If you write</h2>
              <p className="text-secondary">
                Authors can send us a manuscript through the{' '}
                <Link href="/author/submit" className="text-primary hover:underline">
                  submission form
                </Link>
                . We read what comes in and reply by email.
              </p>
            </section>

            <section>
              <h2 className="mb-3 text-2xl font-semibold">Talk to us</h2>
              <p className="text-secondary">
                Questions, corrections, or press requests all go to the{' '}
                <Link href="/contact" className="text-primary hover:underline">
                  contact page
                </Link>
                . A person reads every message.
              </p>
            </section>
          </div>
        </Container>
      </Section>
    </div>
  );
}
