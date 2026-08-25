import type { Metadata } from 'next';
import Link from 'next/link';
import { Container } from '@/components/layout/Container';
import { Section } from '@/components/layout/Section';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'The terms and conditions for using the Mangu Publishers platform.',
};

export default function TermsPage() {
  return (
    <Section>
      <Container>
        <div className="mx-auto max-w-3xl space-y-8">
          <div>
            <h1 className="mb-2 text-4xl font-bold">Terms of Service</h1>
            <p className="text-secondary">Last updated: January 2026</p>
          </div>

          <div className="space-y-6 text-secondary">
            <section>
              <h2 className="mb-2 text-2xl font-semibold text-foreground">
                1. Acceptance of Terms
              </h2>
              <p>
                By accessing or using Mangu Publishers, you agree to be bound by these Terms of
                Service. If you do not agree to these terms, please do not use the platform.
              </p>
            </section>

            <section>
              <h2 className="mb-2 text-2xl font-semibold text-foreground">2. Accounts</h2>
              <p>
                You are responsible for maintaining the confidentiality of your account credentials
                and for all activity that occurs under your account. You must provide accurate
                information when creating an account.
              </p>
            </section>

            <section>
              <h2 className="mb-2 text-2xl font-semibold text-foreground">
                3. Purchases &amp; Licenses
              </h2>
              <p>
                Purchasing a book grants you a personal, non-transferable license to read the
                content for your own use. You may not redistribute, resell, or share purchased
                content.
              </p>
            </section>

            <section>
              <h2 className="mb-2 text-2xl font-semibold text-foreground">4. Author Content</h2>
              <p>
                Authors retain the rights to their submitted work. By submitting a manuscript,
                authors grant Mangu Publishers a license to distribute the work through the platform
                under the agreed royalty terms.
              </p>
            </section>

            <section>
              <h2 className="mb-2 text-2xl font-semibold text-foreground">5. Prohibited Conduct</h2>
              <p>
                You may not use the platform to distribute unlawful content, infringe intellectual
                property rights, attempt to access other users&apos; accounts, or interfere with the
                operation of the service.
              </p>
            </section>

            <section>
              <h2 className="mb-2 text-2xl font-semibold text-foreground">6. Termination</h2>
              <p>
                We may suspend or terminate accounts that violate these terms. You may close your
                account at any time by contacting support.
              </p>
            </section>

            <section>
              <h2 className="mb-2 text-2xl font-semibold text-foreground">7. Changes</h2>
              <p>
                We may update these terms from time to time. Continued use of the platform after
                changes take effect constitutes acceptance of the revised terms.
              </p>
            </section>

            <section>
              <h2 className="mb-2 text-2xl font-semibold text-foreground">8. Contact</h2>
              <p>
                Questions about these terms? Reach out via our{' '}
                <Link href="/contact" className="text-primary hover:underline">
                  contact page
                </Link>
                .
              </p>
            </section>
          </div>
        </div>
      </Container>
    </Section>
  );
}
