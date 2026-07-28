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
const SITE_DESCRIPTION =
  'Discover a universe of stories. Stream unlimited books, audiobooks, and exclusive videos anywhere, anytime.';

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
    'reading',
    'authors',
    'digital library',
    'MANGU',
    'audiobooks',
    'book platform',
    'self-publishing',
    'independent authors',
    'online reading',
    'book discovery',
    'literary fiction',
    'non-fiction',
    'comics',
    'manga',
    'academic papers',
    'digital content',
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
    creator: '@mangupublishers',
    site: '@mangupublishers',
  },
  alternates: {
    canonical: SITE_URL,
    languages: { 'en-US': SITE_URL },
  },
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
  // Honest gating (P0-013): the footer newsletter form is only interactive
  // when the email provider is configured; otherwise it shows an honest
  // "coming soon" state instead of faking subscriptions.
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
          description="Discover, read, and publish books on the MANGU platform"
          searchUrl={`${SITE_URL}/books?search={search_term_string}`}
        />
      </head>
      <body>
        <Providers>
          <div className="flex min-h-screen flex-col">
            <Header />
            {/*
              `id` is the skip link's target (Header.tsx: href="#main-content").
              `tabIndex={-1}` makes this non-interactive landmark programmatically
              focusable, so activating the link moves FOCUS here and not just the
              scroll position — without it focus stays on <body> and the next Tab
              lands back in the header. WCAG 2.4.1.
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
