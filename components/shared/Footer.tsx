'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Mail } from 'lucide-react';
import { Container } from '@/components/layout/Container';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const footerLinkVariants = { rest: { x: 0 }, hover: { x: 4 } };

const footerColumns = [
  {
    heading: 'Discover',
    links: [
      { label: 'Browse Books', href: '/books' },
      { label: 'Genres', href: '/genres' },
      { label: 'New Releases', href: '/books?sort=published_at' },
      { label: 'Trending', href: '/discover' },
      { label: 'Authors', href: '/authors' },
      { label: 'Audiobooks', href: '/audio' },
    ],
  },
  {
    heading: 'For Authors',
    links: [
      { label: 'Submit Manuscript', href: '/author/submit' },
      { label: 'Author Dashboard', href: '/author/dashboard' },
      { label: 'Royalty Reports', href: '/author/analytics' },
      { label: 'Help Center', href: '/help' },
      { label: 'Community', href: '/readers-hub' },
    ],
  },
  {
    heading: 'Company',
    links: [
      { label: 'About Us', href: '/about' },
      { label: 'Contact', href: '/contact' },
      { label: 'Careers', href: '/careers' },
      { label: 'Press', href: '/press' },
    ],
  },
  {
    heading: 'Support',
    links: [
      { label: 'Help Center', href: '/help' },
      { label: 'FAQs', href: '/faqs' },
      { label: 'Terms of Service', href: '/terms' },
      { label: 'Privacy Policy', href: '/privacy' },
      { label: 'Cookies', href: '/cookies' },
    ],
  },
];

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <motion.div
      initial="rest"
      whileHover="hover"
      animate="rest"
      variants={footerLinkVariants}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
    >
      <Link
        href={href}
        className="inline-block text-sm text-muted-foreground transition-colors duration-200 hover:text-primary"
      >
        {children}
      </Link>
    </motion.div>
  );
}

/** Task 4.6: PayPal was removed — Stripe checkout is card-only. */
function PaymentIcon({ name }: { name: string }) {
  return (
    <div
      className="flex h-8 items-center justify-center rounded-md border border-border bg-secondary/60 px-3 text-xs font-medium text-muted-foreground"
      role="img"
      aria-label={`${name} accepted`}
    >
      {name === 'Stripe' && (
        <span className="tracking-wide">
          <span className="text-[#635BFF]">Stripe</span>
        </span>
      )}
      {name === 'Visa' && (
        <span className="font-bold italic tracking-wider text-foreground">VISA</span>
      )}
      {name === 'Mastercard' && (
        <div className="flex items-center gap-0.5">
          <span className="h-3 w-3 rounded-full bg-red-500/90" aria-hidden="true" />
          <span className="-ml-1.5 h-3 w-3 rounded-full bg-yellow-500/90" aria-hidden="true" />
        </div>
      )}
    </div>
  );
}

export function Footer({ newsletterEnabled = false }: { newsletterEnabled?: boolean }) {
  const currentYear = new Date().getFullYear();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [feedback, setFeedback] = useState('');

  // P0-013 / CCR-006: never fake a subscription. The footer form posts to the
  // same double opt-in endpoint as the homepage CTA and only shows success
  // after the backend has persisted the signup and sent the confirm email.
  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    setFeedback('');

    try {
      const res = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        setStatus('success');
        setFeedback(data?.message || 'Check your inbox to confirm your subscription.');
        setEmail('');
        return;
      }

      setStatus('error');
      setFeedback(data?.message || 'Something went wrong. Please try again.');
    } catch {
      setStatus('error');
      setFeedback('Network error. Please try again.');
    }
  };

  return (
    <footer className="border-t border-border bg-background">
      <Container>
        <div className="grid grid-cols-1 gap-10 py-16 sm:grid-cols-2 lg:grid-cols-12 lg:gap-8">
          <div className="space-y-6 lg:col-span-4">
            <Link href="/" className="inline-block">
              <h2 className="text-3xl font-extrabold tracking-tight">
                <span className="bg-gradient-to-r from-primary via-red-400 to-orange-400 bg-clip-text text-transparent">
                  MANGU
                </span>
              </h2>
            </Link>
            <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
              Books we publish, and where to buy them.
            </p>
          </div>

          {footerColumns.map((col) => (
            <div key={col.heading} className="lg:col-span-2">
              <h3 className="mb-5 text-sm font-semibold uppercase tracking-wider text-foreground">
                {col.heading}
              </h3>
              <ul className="space-y-3">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <FooterLink href={link.href}>{link.label}</FooterLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Container>

      {/* Task 4.6: when signups are off there is no band at all. We do not
          announce a newsletter we cannot deliver. */}
      {newsletterEnabled && (
        <div className="border-y border-border bg-muted/30">
          <Container>
            <div className="flex flex-col items-start justify-between gap-6 py-10 md:flex-row md:items-center">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Mail className="h-5 w-5 text-primary" aria-hidden="true" />
                  <h3 className="text-base font-semibold text-foreground">
                    Get an email when we publish something
                  </h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  New titles and the occasional note from us. Leave any time.
                </p>
              </div>
              {status === 'success' ? (
                <p className="text-sm font-medium text-primary" role="status">
                  {feedback}
                </p>
              ) : (
                <div className="w-full md:w-auto">
                  <form className="flex w-full items-center gap-3" onSubmit={handleSubscribe}>
                    <Input
                      type="email"
                      required
                      placeholder="Enter your email"
                      className="w-full border-border bg-background md:w-72"
                      aria-label="Email address for newsletter"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={status === 'loading'}
                    />
                    <Button type="submit" className="shrink-0" disabled={status === 'loading'}>
                      {status === 'loading' ? 'Subscribing…' : 'Subscribe'}
                    </Button>
                  </form>
                  {status === 'error' && (
                    <p role="alert" className="mt-2 text-sm text-red-500">
                      {feedback}
                    </p>
                  )}
                </div>
              )}
            </div>
          </Container>
        </div>
      )}

      <div className="bg-muted/20">
        <Container>
          <div className="flex flex-col items-center justify-between gap-4 py-6 md:flex-row">
            <p className="text-center text-xs text-muted-foreground md:text-left">
              &copy; {currentYear} MANGU Publishers. All rights reserved.
            </p>
            <div className="flex items-center gap-2">
              <PaymentIcon name="Visa" />
              <PaymentIcon name="Mastercard" />
              <PaymentIcon name="Stripe" />
            </div>
            <div className="flex items-center gap-4">
              <span className="text-xs text-muted-foreground">
                Made with{' '}
                <span className="text-primary" aria-label="love">
                  &#9829;
                </span>{' '}
                for book lovers
              </span>
            </div>
          </div>
        </Container>
      </div>
    </footer>
  );
}
