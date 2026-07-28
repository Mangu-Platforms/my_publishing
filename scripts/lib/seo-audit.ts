/**
 * Pure SEO / discoverability audit logic (Task 5.2 prep).
 *
 * No I/O — the network layer lives in `scripts/seo-check.ts`. Report-only:
 * nothing here mutates anything, and nothing here knows how to fetch a
 * third-party site.
 *
 * What it proves:
 *   - every sitemap URL is on the canonical origin (this is the check that
 *     catches the `*.vercel.app` canonical regression caused by the
 *     `VERCEL_URL` fallback in lib/seo/siteUrl.ts)
 *   - the sitemap contains only public, indexable routes — no admin, no API,
 *     no auth/account routes, no drafts
 *   - robots.txt points at the canonical sitemap and disallows private areas
 *   - each book page has a self-referencing canonical and a unique
 *     title + meta description
 */

export type Severity = 'error' | 'warning';

export interface Finding {
  severity: Severity;
  code: string;
  message: string;
  url?: string;
}

/**
 * Path prefixes that must never appear in a public sitemap. Mirrors the
 * disallow lists in app/robots.ts plus routes that are private by nature.
 */
export const NON_PUBLIC_PATH_PREFIXES: readonly string[] = [
  '/admin',
  '/api',
  '/author/dashboard',
  '/author/analytics',
  '/author/projects',
  '/author/submit',
  '/partner/dashboard',
  '/partner/arc-requests',
  '/partner/catalogs',
  '/partner/orders',
  '/dashboard',
  '/users',
  '/login',
  '/register',
  '/reset-password',
  '/verify-email',
  '/reading',
  '/library',
  '/checkout',
  '/too-many-requests',
];

/** Extract <loc> values from a sitemap.xml document. */
export function parseSitemapUrls(xml: string): string[] {
  const urls: string[] = [];
  const pattern = /<loc>\s*([^<\s]+)\s*<\/loc>/gi;
  let match = pattern.exec(xml);
  while (match !== null) {
    urls.push(decodeXmlEntities(match[1]));
    match = pattern.exec(xml);
  }
  return urls;
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

/** Normalize an origin for comparison (scheme + host, no trailing slash). */
export function originOf(url: string): string | null {
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return null;
  }
}

export function pathOf(url: string): string | null {
  try {
    return new URL(url).pathname;
  } catch {
    return null;
  }
}

/** Every sitemap URL must be absolute, https, and on the canonical origin. */
export function auditSitemapOrigins(urls: string[], canonicalOrigin: string): Finding[] {
  const findings: Finding[] = [];
  const canonical = canonicalOrigin.replace(/\/+$/, '');
  for (const url of urls) {
    const origin = originOf(url);
    if (origin === null) {
      findings.push({ severity: 'error', code: 'SITEMAP_INVALID_URL', message: 'Not a valid absolute URL', url });
      continue;
    }
    if (!url.startsWith('https://')) {
      findings.push({ severity: 'error', code: 'SITEMAP_NOT_HTTPS', message: 'Sitemap URL is not https', url });
    }
    if (origin !== canonical) {
      findings.push({
        severity: 'error',
        code: 'SITEMAP_WRONG_ORIGIN',
        message:
          `Origin ${origin} is not the canonical ${canonical}. ` +
          'A *.vercel.app origin here means NEXT_PUBLIC_SITE_URL was unset and lib/seo/siteUrl.ts ' +
          'fell back to VERCEL_URL.',
        url,
      });
    }
  }
  return findings;
}

/** The sitemap must not advertise private, admin, API or auth routes. */
export function auditSitemapPublicOnly(
  urls: string[],
  prefixes: readonly string[] = NON_PUBLIC_PATH_PREFIXES
): Finding[] {
  const findings: Finding[] = [];
  for (const url of urls) {
    const path = pathOf(url);
    if (path === null) continue;
    const hit = prefixes.find((prefix) => path === prefix || path.startsWith(`${prefix}/`));
    if (hit) {
      findings.push({
        severity: 'error',
        code: 'SITEMAP_NON_PUBLIC_ROUTE',
        message: `Non-public route "${hit}" is listed in the sitemap`,
        url,
      });
    }
  }
  return findings;
}

/** Duplicate <loc> entries dilute crawl budget and signal a generator bug. */
export function auditSitemapDuplicates(urls: string[]): Finding[] {
  const seen = new Map<string, number>();
  for (const url of urls) {
    const normalized = url.replace(/\/+$/, '');
    seen.set(normalized, (seen.get(normalized) ?? 0) + 1);
  }
  const findings: Finding[] = [];
  for (const [url, count] of seen) {
    if (count > 1) {
      findings.push({
        severity: 'warning',
        code: 'SITEMAP_DUPLICATE_URL',
        message: `Listed ${count} times in the sitemap`,
        url,
      });
    }
  }
  return findings;
}

export interface RobotsAudit {
  sitemapLines: string[];
  disallows: string[];
}

export function parseRobotsTxt(text: string): RobotsAudit {
  const sitemapLines: string[] = [];
  const disallows: string[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    const sitemap = /^sitemap:\s*(\S+)/i.exec(line);
    if (sitemap) sitemapLines.push(sitemap[1]);
    const disallow = /^disallow:\s*(\S*)/i.exec(line);
    if (disallow && disallow[1]) disallows.push(disallow[1]);
  }
  return { sitemapLines, disallows };
}

/** robots.txt must point at the canonical sitemap and protect private areas. */
export function auditRobots(
  robots: RobotsAudit,
  canonicalOrigin: string,
  requiredDisallows: readonly string[] = ['/admin/', '/api/', '/checkout']
): Finding[] {
  const findings: Finding[] = [];
  const canonical = canonicalOrigin.replace(/\/+$/, '');

  if (robots.sitemapLines.length === 0) {
    findings.push({ severity: 'error', code: 'ROBOTS_NO_SITEMAP', message: 'robots.txt declares no Sitemap:' });
  }
  for (const sitemap of robots.sitemapLines) {
    if (originOf(sitemap) !== canonical) {
      findings.push({
        severity: 'error',
        code: 'ROBOTS_SITEMAP_WRONG_ORIGIN',
        message: `robots.txt Sitemap points at ${originOf(sitemap)}, not the canonical ${canonical}`,
        url: sitemap,
      });
    }
  }
  for (const required of requiredDisallows) {
    const covered = robots.disallows.some((d) => required.startsWith(d) || d === required);
    if (!covered) {
      findings.push({
        severity: 'warning',
        code: 'ROBOTS_MISSING_DISALLOW',
        message: `robots.txt does not disallow ${required}`,
      });
    }
  }
  return findings;
}

// ---------------------------------------------------------------------------
// Per-page metadata
// ---------------------------------------------------------------------------

export interface PageMetadata {
  url: string;
  canonical: string | null;
  title: string | null;
  description: string | null;
  robotsMeta: string | null;
}

function firstMatch(html: string, pattern: RegExp): string | null {
  const match = pattern.exec(html);
  return match ? match[1].trim() : null;
}

export function extractPageMetadata(url: string, html: string): PageMetadata {
  return {
    url,
    canonical: firstMatch(html, /<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']+)["']/i),
    title: firstMatch(html, /<title[^>]*>([\s\S]*?)<\/title>/i),
    description: firstMatch(
      html,
      /<meta[^>]+name=["']description["'][^>]*content=["']([^"']*)["']/i
    ),
    robotsMeta: firstMatch(html, /<meta[^>]+name=["']robots["'][^>]*content=["']([^"']*)["']/i),
  };
}

export const TITLE_MAX_LENGTH = 60;
export const DESCRIPTION_MIN_LENGTH = 50;
export const DESCRIPTION_MAX_LENGTH = 160;

/** Per-book title/description must exist, be unique, and be sanely sized. */
export function auditPageMetadata(pages: PageMetadata[], canonicalOrigin: string): Finding[] {
  const findings: Finding[] = [];
  const canonical = canonicalOrigin.replace(/\/+$/, '');
  const titles = new Map<string, string[]>();
  const descriptions = new Map<string, string[]>();

  for (const page of pages) {
    if (!page.canonical) {
      findings.push({ severity: 'error', code: 'PAGE_NO_CANONICAL', message: 'No <link rel="canonical">', url: page.url });
    } else {
      if (originOf(page.canonical) !== canonical) {
        findings.push({
          severity: 'error',
          code: 'PAGE_CANONICAL_WRONG_ORIGIN',
          message: `Canonical points at ${originOf(page.canonical)}, not ${canonical}`,
          url: page.url,
        });
      }
      if (page.canonical.replace(/\/+$/, '') !== page.url.replace(/\/+$/, '')) {
        findings.push({
          severity: 'warning',
          code: 'PAGE_CANONICAL_NOT_SELF',
          message: `Canonical (${page.canonical}) does not self-reference this URL`,
          url: page.url,
        });
      }
    }

    if (!page.title) {
      findings.push({ severity: 'error', code: 'PAGE_NO_TITLE', message: 'Missing <title>', url: page.url });
    } else {
      titles.set(page.title, [...(titles.get(page.title) ?? []), page.url]);
      if (page.title.length > TITLE_MAX_LENGTH) {
        findings.push({
          severity: 'warning',
          code: 'PAGE_TITLE_TOO_LONG',
          message: `Title is ${page.title.length} chars (>${TITLE_MAX_LENGTH} may be truncated in SERPs)`,
          url: page.url,
        });
      }
    }

    if (!page.description) {
      findings.push({ severity: 'error', code: 'PAGE_NO_DESCRIPTION', message: 'Missing meta description', url: page.url });
    } else {
      descriptions.set(page.description, [...(descriptions.get(page.description) ?? []), page.url]);
      if (page.description.length < DESCRIPTION_MIN_LENGTH || page.description.length > DESCRIPTION_MAX_LENGTH) {
        findings.push({
          severity: 'warning',
          code: 'PAGE_DESCRIPTION_LENGTH',
          message: `Description is ${page.description.length} chars (target ${DESCRIPTION_MIN_LENGTH}–${DESCRIPTION_MAX_LENGTH})`,
          url: page.url,
        });
      }
    }

    if (page.robotsMeta && /noindex/i.test(page.robotsMeta)) {
      findings.push({
        severity: 'error',
        code: 'PAGE_NOINDEX_IN_SITEMAP',
        message: `Page is in the sitemap but declares robots "${page.robotsMeta}"`,
        url: page.url,
      });
    }
  }

  for (const [title, urls] of titles) {
    if (urls.length > 1) {
      findings.push({
        severity: 'error',
        code: 'PAGE_DUPLICATE_TITLE',
        message: `Title "${title}" is shared by ${urls.length} pages: ${urls.join(', ')}`,
      });
    }
  }
  for (const [description, urls] of descriptions) {
    if (urls.length > 1) {
      findings.push({
        severity: 'error',
        code: 'PAGE_DUPLICATE_DESCRIPTION',
        message: `Meta description is shared by ${urls.length} pages: ${urls.join(', ')}`,
      });
    }
  }

  return findings;
}

export function summarize(findings: Finding[]): { errors: number; warnings: number } {
  return {
    errors: findings.filter((f) => f.severity === 'error').length,
    warnings: findings.filter((f) => f.severity === 'warning').length,
  };
}
