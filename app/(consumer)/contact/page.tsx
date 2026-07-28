import type { Metadata } from 'next';
import { Container } from '@/components/layout/Container';
import { Section } from '@/components/layout/Section';
import { ContactForm } from './ContactForm';
import { getSiteUrl } from '@/lib/seo/siteUrl';
import { isEmailConfigured, CONTACT_INBOX } from '@/lib/email/send';

const pageUrl = `${getSiteUrl()}/contact`;
const description =
  'Contact MANGU Publishers for reader support, publishing questions, and media inquiries.';

export const metadata: Metadata = {
  title: 'Contact',
  description,
  alternates: {
    canonical: pageUrl,
  },
  openGraph: {
    title: 'Contact',
    description,
    url: pageUrl,
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'MANGU Publishers - Your digital publishing platform',
      },
    ],
  },
};

/**
 * Task 4.6 — the reply-time promise ("within two business days") was removed
 * because nobody is measuring it.
 * TODO(renee): if you want to commit to a response time in writing, tell us
 * the number and we will put it back.
 */
export default function ContactPage() {
  const emailEnabled = isEmailConfigured();

  return (
    <Section>
      <Container>
        <h1 className="mb-4 text-4xl font-bold">Contact</h1>
        <p className="max-w-2xl text-secondary">
          Questions about a book, an order, a manuscript, or a press request all come to the same
          place. Email{' '}
          <a className="text-primary hover:underline" href={`mailto:${CONTACT_INBOX}`}>
            {CONTACT_INBOX}
          </a>{' '}
          or use the form below. A person reads every message and replies by email.
        </p>
        <ContactForm enabled={emailEnabled} fallbackEmail={CONTACT_INBOX} />
      </Container>
    </Section>
  );
}
