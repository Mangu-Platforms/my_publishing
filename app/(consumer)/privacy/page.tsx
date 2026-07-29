import type { Metadata } from 'next';
import { Container } from '@/components/layout/Container';
import { Section } from '@/components/layout/Section';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'How Mangu Publishers collects, uses, and protects your personal information.',
};

export default function PrivacyPage() {
  return (
    <Section>
      <Container>
        <div className="mx-auto max-w-3xl space-y-8">
          <div>
            <h1 className="mb-2 text-4xl font-bold">Privacy Policy</h1>
            <p className="text-secondary">Last updated: January 2026</p>
          </div>

          <div className="space-y-6 text-secondary">
            <section>
              <h2 className="mb-2 text-2xl font-semibold text-foreground">
                Information We Collect
              </h2>
              <p>
                We collect the information you provide when creating an account (name, email), your
                reading activity and preferences, and purchase history. Payment details are
                processed securely by our payment provider and are never stored on our servers.
              </p>
            </section>

            <section>
              <h2 className="mb-2 text-2xl font-semibold text-foreground">
                How We Use Your Information
              </h2>
              <p>
                Your information is used to provide the service, personalize recommendations,
                process purchases, pay author royalties, and improve the platform. We do not sell
                your personal data to third parties.
              </p>
            </section>

            <section>
              <h2 className="mb-2 text-2xl font-semibold text-foreground">Cookies</h2>
              <p>
                We use essential cookies to keep you signed in. We do not use analytics or
                advertising cookies. See our{' '}
                <a href="/cookies" className="text-primary hover:underline">
                  cookies page
                </a>{' '}
                for details.
              </p>
            </section>

            <section>
              <h2 className="mb-2 text-2xl font-semibold text-foreground">Data Security</h2>
              <p>
                We use industry-standard encryption in transit and at rest, along with row-level
                security controls, to protect your data from unauthorized access.
              </p>
            </section>

            <section>
              <h2 className="mb-2 text-2xl font-semibold text-foreground">Your Rights</h2>
              <p>
                You can access, update, or delete your personal information at any time from your
                account settings, or by contacting support. You may also request a copy of your
                data.
              </p>
            </section>

            <section>
              <h2 className="mb-2 text-2xl font-semibold text-foreground">Contact</h2>
              <p>
                Privacy questions? Reach out via our{' '}
                <a href="/contact" className="text-primary hover:underline">
                  contact page
                </a>
                .
              </p>
            </section>
          </div>
        </div>
      </Container>
    </Section>
  );
}
