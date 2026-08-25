import { MetadataRoute } from 'next';
import { getSiteUrl } from '@/lib/seo/siteUrl';

export default function robots(): MetadataRoute.Robots {
  // getSiteUrl adds a VERCEL_URL fallback and trims trailing slashes, matching
  // sitemap.ts, layout.tsx, and the JSON-LD helpers. Sitemap and robots.host
  // must never disagree with each other or with the canonical URLs pages emit.
  const baseUrl = getSiteUrl();

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/admin/',
          '/api/',
          '/author/dashboard',
          '/author/analytics',
          '/author/projects/',
          '/author/submit',
          '/partner/dashboard',
          '/partner/arc-requests',
          '/partner/catalogs',
          '/partner/orders/',
          '/dashboard/',
          '/users/',
          '/login',
          '/register',
          '/reset-password',
          '/verify-email',
          '/reading/',
          '/library',
          '/checkout',
        ],
      },
      {
        userAgent: 'Googlebot',
        allow: '/',
        disallow: [
          '/admin/',
          '/api/',
          '/author/',
          '/partner/',
          '/dashboard/',
          '/users/',
          '/login',
          '/register',
          '/reset-password',
          '/verify-email',
          '/reading/',
          '/library',
          '/checkout',
        ],
      },
      {
        userAgent: 'Bingbot',
        allow: '/',
        disallow: [
          '/admin/',
          '/api/',
          '/author/',
          '/partner/',
          '/dashboard/',
          '/users/',
          '/login',
          '/register',
          '/reset-password',
          '/verify-email',
          '/reading/',
          '/library',
          '/checkout',
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
