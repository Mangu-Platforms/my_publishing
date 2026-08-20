import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import { Providers } from './providers';
import { Header } from '@/components/shared/Header';
import { Footer } from '@/components/shared/Footer';
import { OrganizationJsonLd, WebSiteJsonLd } from '@/components/seo';
import { getSiteUrl } from '@/lib/seo/siteUrl';
import { isEmailConfigured } from '@/lib/email/send';

const inter = localFont({
  src: [
    {
      path: '../node_modules/@fontsource/inter/files/inter-latin-400-normal.woff2',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../node_modules/@fontsource/inter/files/inter-latin-700-normal.woff2',
      weight: '700',
      style: 'normal',
    },
  ],
  variable: '--font-inter',
  display: 'swap',
  fallback: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
});

const SITE_URL = getSiteUrl();
const SITE_NAME = 'MANGU Publishers';
// Task 4.6: no streaming, no unlimited reading, no video. Say what is true.
const SITE_DESCRIPTION =
  'Browse the books MANGU Publishers has released and find out where to buy each one.';

export const metadata: Metadata = {
  title: {
    default: `${SITE_NAME} - Digital Publishing Platform`,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  keywords: [
    'books',
    'publishing',
    'ebooks',
    'authors',
    'MANGU',
    'MANGU Publishers',
    'independent publisher',
    'book discovery',
    'literary fiction',
    'non-fiction',
  ],
  authors: [{ name: SITE_NAME }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  metadataBase: new URL(SITE_URL),
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
    nocache: false,
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: SITE_URL,
    siteName: SITE_NAME,
    title: `${SITE_NAME} - Digital Publishing Platform`,
    description: SITE_DESCRIPTION,
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: `${SITE_NAME} - Your digital publishing platform`,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${SITE_NAME} - Digital Publishing Platform`,
    description: SITE_DESCRIPTION,
    images: ['/og-image.png'],
    // TODO(renee): confirm @mangupublishers is an account we actually control.
    // If it is not ours, these two lines should be removed before launch.
    creator: '@mangupublishers',
    site: '@mangupublishers',
  },
  // No alternates here: Next metadata inheritance would stamp the homepage
  // as canonical on every page without its own alternates block — a
  // de-indexing signal. Each page declares its own canonical instead.
  verification: {},
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/icon.png', type: 'image/png', sizes: '32x32' },
    ],
    apple: [{ url: '/apple-icon.png', sizes: '180x180', type: 'image/png' }],
    shortcut: ['/shortcut-icon.png'],
  },
  manifest: '/site.webmanifest',
  category: 'books',
  classification: 'Digital Publishing Platform',
  other: {
    'msapplication-TileColor': '#ef4444',
    'theme-color': '#0a0a0a',
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'black-translucent',
    'apple-mobile-web-app-title': SITE_NAME,
    'mobile-web-app-capable': 'yes',
    'application-name': SITE_NAME,
  },
};

export const viewport: Viewport = {
  themeColor: '#0a0a0a',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  colorScheme: 'dark',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Honest gating (P0-013, Task 4.6): the footer newsletter form only exists
  // when the email provider is configured. When it isn't, the whole band is
  // absent — no form, and no promise of one later.
  const newsletterEnabled = isEmailConfigured();

  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://api.supabase.co" />
        <link rel="dns-prefetch" href="https://vimeo.com" />

        <OrganizationJsonLd name={SITE_NAME} url={SITE_URL} description={SITE_DESCRIPTION} />

        <WebSiteJsonLd
          name={SITE_NAME}
          url={SITE_URL}
          description="Books published by MANGU Publishers, and where to buy them"
          searchUrl={`${SITE_URL}/books?search={search_term_string}`}
        />
      </head>
      <body>
        <Providers>
          <div className="flex min-h-screen flex-col">
            <Header />
            {/*
              id + tabIndex complete the A11Y-007 skip link. Header.tsx renders a
              "Skip to main content" anchor targeting #main-content; without the
              id here the fragment resolves to nothing, and without tabIndex={-1}
              following it moves the scroll position but not keyboard focus. With
              both, the skip link is a working WCAG 2.4.1 (Level A) bypass block.
            */}
            <main id="main-content" tabIndex={-1} className="flex-1">
              {children}
            </main>
            <Footer newsletterEnabled={newsletterEnabled} />
          </div>
        </Providers>
      </body>
    </html>
  );
}
