import type { Metadata } from 'next';
import Link from 'next/link';
import { Container } from '@/components/layout/Container';
import { Section } from '@/components/layout/Section';
import { getSiteUrl } from '@/lib/seo/siteUrl';
import { CONTACT_INBOX } from '@/lib/email/send';

const pageUrl = `${getSiteUrl()}/faqs`;
const description =
  'How to buy a MANGU book, where audio samples live, and what the site does not do yet.';

export const metadata: Metadata = {
  title: 'FAQs',
  description,
  alternates: {
    canonical: pageUrl,
  },
};

/**
 * Task 4.6 — every answer below matches what ships.
 *
 * Removed as untrue at launch: "start reading right away", cross-device
 * reading progress, and a 14-day refund window that no policy backs.
 *
 * TODO(renee): we need a written refund policy (window, what qualifies,
 * direct sales vs retailer sales) for the Terms page. The answer below says
 * only what we can stand behind until that exists.
 */
const faqs: Array<{ question: string; answer: React.ReactNode }> = [
  {
    question: 'Where can I buy a MANGU book?',
    answer: (
      <>
        Open the book&apos;s page from the{' '}
        <Link href="/books" className="text-primary hover:underline">
          books
        </Link>{' '}
        list. Each page shows where that title is sold, and the links take you to the retailer. If a
        book has no links yet, it is not on sale yet.
      </>
    ),
  },
  {
    question: 'Can I read books on this site?',
    answer:
      'No. There is no reader built into the site. You read the book in whatever app or device you already use, so nothing you buy is locked to us.',
  },
  {
    question: 'Is there a MANGU app for iPhone or Android?',
    answer:
      'No. We have not built one. The site works in a phone browser, and that is the whole mobile experience for now.',
  },
  {
    question: 'Can I listen to audiobooks here?',
    answer:
      'Where a title has audio, you can play a sample on its book page. We do not sell or deliver full audiobooks on the site yet.',
  },
  {
    question: 'Where do I find something I bought through this site?',
    answer: (
      <>
        Sign in and open your{' '}
        <Link href="/library" className="text-primary hover:underline">
          Library
        </Link>
        . It lists the orders placed on this site. Anything you bought from a retailer stays in that
        retailer&apos;s account, not here.
      </>
    ),
  },
  {
    question: 'How do I submit a manuscript?',
    answer: (
      <>
        Create an account, then open the{' '}
        <Link href="/author/submit" className="text-primary hover:underline">
          submission form
        </Link>{' '}
        and fill in the details of your manuscript. We read what comes in and reply by email.
      </>
    ),
  },
  {
    question: 'How are author royalties calculated?',
    answer:
      'Your rate is set in your publishing agreement with us. Sales figures for your titles appear in the author dashboard once you are signed in.',
  },
  {
    question: 'How do I reset my password?',
    answer:
      'Use the "Forgot password?" link on the sign-in page. We email you a one-time link to set a new one.',
  },
  {
    question: 'Do you offer refunds?',
    answer: (
      <>
        If you bought from a retailer, their refund policy applies, so start with them. If you
        bought directly from this site, email{' '}
        <a className="text-primary hover:underline" href={`mailto:${CONTACT_INBOX}`}>
          {CONTACT_INBOX}
        </a>{' '}
        and tell us what happened.
      </>
    ),
  },
];

export default function FaqsPage() {
  return (
    <Section>
      <Container>
        <div className="mx-auto max-w-3xl">
          <h1 className="mb-2 text-4xl font-bold">Frequently Asked Questions</h1>
          <p className="mb-8 text-secondary">
            Can&apos;t find what you&apos;re looking for? Visit the{' '}
            <Link href="/help" className="text-primary hover:underline">
              Help Center
            </Link>{' '}
            or{' '}
            <Link href="/contact" className="text-primary hover:underline">
              contact us
            </Link>
            .
          </p>

          <div className="space-y-3">
            {faqs.map((faq) => (
              <details
                key={faq.question}
                className="group rounded-lg border border-border bg-card px-6 py-4"
              >
                <summary className="cursor-pointer list-none text-base font-semibold marker:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                  {faq.question}
                </summary>
                <p className="mt-3 text-secondary">{faq.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </Container>
    </Section>
  );
}
