#!/usr/bin/env tsx
/**
 * Repeatable SEO / discoverability check (Task 5.2 prep) — REPORT ONLY.
 *
 * Verifies, against a single origin you control:
 *   1. sitemap.xml parses and every <loc> is on the canonical origin
 *      (catches the `*.vercel.app` canonical regression from the VERCEL_URL
 *      fallback in lib/seo/siteUrl.ts)
 *   2. the sitemap lists only public routes — no admin / API / auth / checkout
 *      and no duplicate entries
 *   3. robots.txt points at the canonical sitemap and disallows private areas
 *   4. a sample of book detail pages each have a self-referencing canonical and
 *      a unique, sanely-sized title + meta description
 *
 * It NEVER crawls a third-party site: any sitemap URL whose origin differs from
 * --base-url is reported and skipped, not fetched.
 *
 * Usage:
 *   npm run seo:check
 *   npm run seo:check -- --base-url https://www.mangu-publishers.com --sample 10
 *   npm run seo:check -- --json
 *
 * Exit codes: 0 = no errors (warnings allowed), 1 = at least one error.
 */

import {
  auditPageMetadata,
  auditRobots,
  auditSitemapDuplicates,
  auditSitemapOrigins,
  auditSitemapPublicOnly,
  extractPageMetadata,
  originOf,
  parseRobotsTxt,
  parseSitemapUrls,
  pathOf,
  summarize,
  type Finding,
  type PageMetadata,
} from './lib/seo-audit';

const DEFAULT_BASE_URL = 'https://www.mangu-publishers.com';
const REQUEST_TIMEOUT_MS = 15000;

function flag(name: string): string | undefined {
  const prefixed = `--${name}`;
  const argv = process.argv.slice(2);
  const exact = argv.indexOf(prefixed);
  if (exact >= 0) {
    const next = argv[exact + 1];
    return next && !next.startsWith('--') ? next : '';
  }
  const inline = argv.find((a) => a.startsWith(`${prefixed}=`));
  return inline ? inline.slice(prefixed.length + 1) : undefined;
}

async function get(url: string): Promise<{ status: number | null; body: string; error?: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'mangu-seo-check/1.0' },
      signal: controller.signal,
    });
    return { status: response.status, body: await response.text() };
  } catch (error) {
    return { status: null, body: '', error: error instanceof Error ? error.message : String(error) };
  } finally {
    clearTimeout(timer);
  }
}

async function main(): Promise<void> {
  const baseUrl = (flag('base-url') || DEFAULT_BASE_URL).replace(/\/+$/, '');
  const canonicalOrigin = originOf(baseUrl);
  const sampleSize = Number.parseInt(flag('sample') || '8', 10);
  const jsonOutput = flag('json') !== undefined;

  if (!canonicalOrigin) {
    console.error(`Invalid --base-url: ${baseUrl}`);
    process.exit(1);
  }

  const findings: Finding[] = [];

  // 1–2. Sitemap.
  const sitemapResponse = await get(`${baseUrl}/sitemap.xml`);
  let sitemapUrls: string[] = [];
  if (sitemapResponse.status !== 200) {
    findings.push({
      severity: 'error',
      code: 'SITEMAP_UNREACHABLE',
      message: `sitemap.xml returned ${sitemapResponse.status ?? sitemapResponse.error}`,
      url: `${baseUrl}/sitemap.xml`,
    });
  } else {
    sitemapUrls = parseSitemapUrls(sitemapResponse.body);
    if (sitemapUrls.length === 0) {
      findings.push({ severity: 'error', code: 'SITEMAP_EMPTY', message: 'sitemap.xml contains no <loc> entries' });
    }
    findings.push(...auditSitemapOrigins(sitemapUrls, canonicalOrigin));
    findings.push(...auditSitemapPublicOnly(sitemapUrls));
    findings.push(...auditSitemapDuplicates(sitemapUrls));
  }

  // 3. robots.txt.
  const robotsResponse = await get(`${baseUrl}/robots.txt`);
  if (robotsResponse.status !== 200) {
    findings.push({
      severity: 'error',
      code: 'ROBOTS_UNREACHABLE',
      message: `robots.txt returned ${robotsResponse.status ?? robotsResponse.error}`,
      url: `${baseUrl}/robots.txt`,
    });
  } else {
    findings.push(...auditRobots(parseRobotsTxt(robotsResponse.body), canonicalOrigin));
  }

  // 4. Sample book detail pages — same-origin only.
  const bookUrls = sitemapUrls
    .filter((url) => originOf(url) === canonicalOrigin)
    .filter((url) => (pathOf(url) ?? '').startsWith('/books/'))
    .slice(0, Number.isFinite(sampleSize) && sampleSize > 0 ? sampleSize : 8);

  const pages: PageMetadata[] = [];
  for (const url of bookUrls) {
    const response = await get(url);
    if (response.status !== 200) {
      findings.push({
        severity: 'error',
        code: 'PAGE_UNREACHABLE',
        message: `Book page returned ${response.status ?? response.error}`,
        url,
      });
      continue;
    }
    pages.push(extractPageMetadata(url, response.body));
  }
  findings.push(...auditPageMetadata(pages, canonicalOrigin));

  const { errors, warnings } = summarize(findings);

  if (jsonOutput) {
    console.log(JSON.stringify({ baseUrl, sitemapUrlCount: sitemapUrls.length, sampledBookPages: pages.length, errors, warnings, findings }, null, 2));
  } else {
    console.log(`SEO / discoverability check — ${baseUrl}`);
    console.log(`  sitemap entries: ${sitemapUrls.length}`);
    console.log(`  book pages sampled: ${pages.length}\n`);
    if (findings.length === 0) {
      console.log('  No findings. Canonical URLs, sitemap scope, robots directives and per-book metadata all check out.');
    }
    for (const finding of findings) {
      const marker = finding.severity === 'error' ? 'ERROR  ' : 'WARN   ';
      console.log(`  ${marker} [${finding.code}] ${finding.message}${finding.url ? `\n           ${finding.url}` : ''}`);
    }
    console.log(`\n  ${errors} error(s), ${warnings} warning(s). Report only — nothing was changed.`);
  }

  process.exit(errors > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error('seo-check crashed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
