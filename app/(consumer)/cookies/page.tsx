import type { Metadata } from 'next';
import Link from 'next/link';
import { Container } from '@/components/layout/Container';
import { Section } from '@/components/layout/Section';
import { getSiteUrl } from '@/lib/seo/siteUrl';

const pageUrl = `${getSiteUrl()}/cookies`;
const description = 'The cookies MANGU Publishers sets, and how to control them in your browser.';

export const metadata: Metadata = {
  title: 'Cookies',
  description,
  alternates: {
    canonical: pageUrl,
  },
};

/**
 * Task 4.6 — this page was called "Cookie Settings" and listed optional
 * categories with on/off badges, but no consent management exists: nothing on
 * the page could be switched, and no analytics or preference cookies are set.
 *
 * What is actually set: the session cookies from our auth provider. The theme
 * preference is kept in localStorage, not a cookie. No analytics or
 * advertising SDK is installed anywhere in the app.
 *
 * TODO(renee): if we ever add analytics, advertising, or embedded third-party
 * players that set cookies, this page needs updating and we will need real
 * consent controls (and a banner) before that ships.
 */
export default function CookiesPage() {
  return (
    <Section>
      <Container>
        <div className="mx-auto max-w-3xl space-y-8">
          <div>
            <h1 className="mb-2 text-4xl font-bold">Cookies</h1>
            <p className="text-secondary">
              We set as few cookies as we can get away with. Here is the full list.
            </p>
          </div>

          <section>
            <h2 className="mb-2 text-2xl font-semibold">Sign-in cookies</h2>
            <p className="text-secondary">
              When you sign in, our authentication provider sets session cookies so the site knows
              it is you on the next page. They are the only cookies we set, and the site cannot keep
              you signed in without them. If you never sign in, you never get one.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-2xl font-semibold">What we do not do</h2>
            <p className="text-secondary">
              We do not run analytics, advertising, or tracking cookies, and we do not share
              browsing data with third parties for advertising. That is also why you will not see a
              cookie banner here. There is nothing optional to turn off, so we are not going to
              pretend there is a switch.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-2xl font-semibold">Turning them off</h2>
            <p className="text-secondary">
              Cookie controls live in your browser settings, where you can block or clear cookies
              for this site. Blocking them means you will not be able to stay signed in, so your
              library and account pages will not work.
            </p>
          </section>

          <p className="text-sm text-secondary">
            For everything else we do with your data, read the{' '}
            <Link href="/privacy" className="text-primary hover:underline">
              Privacy Policy
            </Link>
            .
          </p>
        </div>
      </Container>
    </Section>
  );
}
