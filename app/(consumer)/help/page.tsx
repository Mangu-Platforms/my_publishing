import type { Metadata } from 'next';
import Link from 'next/link';
import { Container } from '@/components/layout/Container';
import { Section } from '@/components/layout/Section';
import { BookOpen, CreditCard, PenTool, User, Headphones, MessageCircle } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Help Center',
  description: 'Answers about buying a MANGU book, your account, and sending us a manuscript.',
};

/**
 * Task 4.6: the topic blurbs used to promise reading progress tracking,
 * subscriptions, and web audiobook listening. None of those ship. Each line
 * below points at something that works today.
 */

const topics = [
  {
    icon: BookOpen,
    title: 'Your library',
    description: 'Find the orders you placed on this site. Books are read in your own app.',
    href: '/library',
  },
  {
    icon: CreditCard,
    title: 'Buying a book',
    description: 'Where each title is sold, what we charge for, and how refunds work.',
    href: '/faqs',
  },
  {
    icon: PenTool,
    title: 'Publishing with MANGU',
    description: 'Send us a manuscript, follow its review, and see how royalties are reported.',
    href: '/author/submit',
  },
  {
    icon: User,
    title: 'Account',
    description: 'Update your details or reset your password.',
    href: '/reset-password',
  },
  {
    icon: Headphones,
    title: 'Audio samples',
    description: 'Where a book has audio, play the sample on its page. No full audiobooks yet.',
    href: '/audio',
  },
  {
    icon: MessageCircle,
    title: 'Contact us',
    description: 'Still stuck? Send a message and a person will read it.',
    href: '/contact',
  },
];

export default function HelpPage() {
  return (
    <div>
      <Section className="bg-muted">
        <Container>
          <h1 className="mb-2 text-4xl font-bold">Help Center</h1>
          <p className="max-w-2xl text-secondary">
            Browse common topics below, check the{' '}
            <Link href="/faqs" className="text-primary hover:underline">
              FAQs
            </Link>
            , or{' '}
            <Link href="/contact" className="text-primary hover:underline">
              contact us
            </Link>{' '}
            directly.
          </p>
        </Container>
      </Section>

      <Section>
        <Container>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {topics.map((topic) => (
              <Link key={topic.title} href={topic.href} className="group">
                <div className="h-full rounded-lg border border-border bg-card p-6 transition-all hover:border-primary/40 hover:shadow-md">
                  <topic.icon className="mb-4 h-8 w-8 text-primary" />
                  <h2 className="mb-2 text-xl font-semibold group-hover:text-primary">
                    {topic.title}
                  </h2>
                  <p className="text-sm text-secondary">{topic.description}</p>
                </div>
              </Link>
            ))}
          </div>
        </Container>
      </Section>
    </div>
  );
}
