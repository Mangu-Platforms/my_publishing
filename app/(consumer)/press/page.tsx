import type { Metadata } from 'next';
import Link from 'next/link';
import { Container } from '@/components/layout/Container';
import { Section } from '@/components/layout/Section';
import { getSiteUrl } from '@/lib/seo/siteUrl';
import { CONTACT_INBOX } from '@/lib/email/send';

const pageUrl = `${getSiteUrl()}/press`;
const description = 'How to refer to MANGU Publishers, what we do, and how to reach us for press.';

export const metadata: Metadata = {
  title: 'Press',
  description,
  alternates: {
    canonical: pageUrl,
  },
};

/**
 * Task 4.6 — this page used to imply a downloadable brand kit. There are no
 * brand assets in /public, so the promise is gone: we now say plainly that
 * logo files are sent on request.
 *
 * TODO(renee): if you want a real press kit (logo SVG/PNG, approved colours,
 * founder headshot, boilerplate paragraph), send the files and we will host
 * them here and turn this section into a download.
 * TODO(renee): confirm whether press should use a dedicated address rather
 * than the general inbox.
 */
export default function PressPage() {
  return (
    <div>
      <Section className="bg-muted">
        <Container>
          <h1 className="mb-2 text-4xl font-bold">Press</h1>
          <p className="max-w-2xl text-secondary">
            The short version of who we are and how to get hold of us.
          </p>
        </Container>
      </Section>

      <Section>
        <Container>
          <div className="mx-auto max-w-3xl space-y-8">
            <section>
              <h2 className="mb-2 text-2xl font-semibold">What MANGU Publishers does</h2>
              <p className="text-secondary">
                MANGU Publishers publishes books and lists them on this site. Each book has its own
                page with the description, the author, and links to the retailers that carry it.
                Authors can send us a manuscript directly and we read every submission.
              </p>
            </section>

            <section>
              <h2 className="mb-2 text-2xl font-semibold">Worth knowing</h2>
              <ul className="list-inside list-disc space-y-1 text-secondary">
                <li>The catalogue is small and chosen deliberately.</li>
                <li>Books are sold through retailers; there is no reader on this site.</li>
                <li>Where a title has audio, the book page carries a sample.</li>
                <li>There is no MANGU mobile app.</li>
              </ul>
            </section>

            <section>
              <h2 className="mb-2 text-2xl font-semibold">Using our name</h2>
              <p className="text-secondary">
                Write it as <strong className="text-foreground">MANGU</strong> or{' '}
                <strong className="text-foreground">MANGU Publishers</strong>. We do not have a
                press kit to download yet. If you need a logo file at a particular size, ask and we
                will send one.
              </p>
            </section>

            <section>
              <h2 className="mb-2 text-2xl font-semibold">Press contact</h2>
              <p className="text-secondary">
                Email{' '}
                <a className="text-primary hover:underline" href={`mailto:${CONTACT_INBOX}`}>
                  {CONTACT_INBOX}
                </a>{' '}
                with &ldquo;Press&rdquo; in the subject line, or use the{' '}
                <Link href="/contact" className="text-primary hover:underline">
                  contact form
                </Link>
                .
              </p>
            </section>
          </div>
        </Container>
      </Section>
    </div>
  );
}
