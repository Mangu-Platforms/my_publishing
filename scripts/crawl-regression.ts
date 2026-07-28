#!/usr/bin/env tsx
/**
 * scripts/crawl-regression.ts — Task 5.3, full-crawl regression harness.
 *
 * Crawls every discoverable public route on ONE canonical host and reports a
 * row per URL, then prints the critical manual route checklist a human still
 * has to walk.
 *
 * Usage:
 *   npx tsx scripts/crawl-regression.ts --base-url https://<canonical-host>
 *   CRAWL_BASE_URL=https://<canonical-host> npx tsx scripts/crawl-regression.ts
 *
 * Options:
 *   --base-url <url>       canonical origin to crawl (also CRAWL_BASE_URL /
 *                          BASE_URL / NEXT_PUBLIC_SITE_URL)
 *   --concurrency <n>      parallel requests (default 4)
 *   --delay <ms>           pause between requests per worker (default 250)
 *   --max-pages <n>        crawl budget (default 300)
 *   --out <file>           also write the markdown report to a file
 *   --include-disallowed   ALSO crawl robots-disallowed first-party routes
 *                          (off by default; only meaningful on your own site)
 *   --strict               treat P2 findings as failures too
 *   --dry-run              print the resolved config and exit 0, no network
 *   --help
 *
 * Exit codes:
 *   0  crawl completed, no P0/P1 findings
 *   1  crawl completed, at least one P0/P1 finding
 *   2  the harness could NOT run (no target, target unreachable, no discovery)
 *      — deliberately distinct from 1 so "we did not check" is never reported
 *      as "we checked and it passed".
 *
 * Design constraints (WHY):
 *   - No hardcoded host and no hardcoded book slug. Production currently holds
 *     seeded QA data that will be replaced by the 3–6 real launch titles, so
 *     the launch catalog is DISCOVERED from /api/books and the sitemap.
 *   - Same-origin only. Third-party hosts are never fetched, not even to check
 *     an outbound link.
 *   - robots.txt is obeyed for the crawl frontier. Robots-disallowed routes
 *     (/login, /library, /admin, …) are covered by the manual checklist
 *     instead, which is where they belong anyway.
 *   - No new npm dependencies (launch freeze, issue #209).
 */

import { writeFileSync } from 'node:fs';
import {
  EMPTY_ROBOTS,
  alternateHostOrigin,
  buildRow,
  classifyRoute,
  extractHtmlFacts,
  failsBuild,
  isAllowedByRobots,
  isSitemapIndex,
  parseRobots,
  parseSitemapUrls,
  renderManualChecklist,
  renderReportTable,
  sameOrigin,
  worstSeverity,
  type CrawlRow,
  type RobotsRules,
  type Severity,
} from './lib/crawl-report';

// ─── CLI ─────────────────────────────────────────────────────────────────────

const USER_AGENT = 'mangu-crawl-regression/1.0 (+first-party QA harness)';
const REQUEST_TIMEOUT_MS = 20_000;

function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function option(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  if (index >= 0 && index + 1 < process.argv.length) return process.argv[index + 1];
  const inline = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  return inline ? inline.slice(name.length + 3) : undefined;
}

function numberOption(name: string, fallback: number): number {
  const raw = option(name);
  const parsed = raw === undefined ? NaN : Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

if (flag('help')) {
  console.log(
    [
      'crawl-regression — full-crawl regression harness for mangu-publishers',
      '',
      '  npx tsx scripts/crawl-regression.ts --base-url https://<canonical-host>',
      '',
      '  --concurrency <n>  --delay <ms>  --max-pages <n>  --out <file>',
      '  --include-disallowed  --strict  --dry-run  --help',
      '',
      '  exit 0 = clean · 1 = P0/P1 found · 2 = harness could not run',
    ].join('\n')
  );
  process.exit(0);
}

const rawBaseUrl =
  option('base-url') ||
  process.env.CRAWL_BASE_URL ||
  process.env.BASE_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  '';

if (!rawBaseUrl) {
  console.error(
    'crawl-regression: no target. Pass --base-url <url> or set CRAWL_BASE_URL / BASE_URL / NEXT_PUBLIC_SITE_URL.\n' +
      'The canonical host is deliberately NOT hardcoded in this repo.'
  );
  process.exit(2);
}

let ORIGIN: string;
try {
  ORIGIN = new URL(rawBaseUrl).origin;
} catch {
  console.error(`crawl-regression: --base-url is not a valid URL: ${rawBaseUrl}`);
  process.exit(2);
}

const CONCURRENCY = numberOption('concurrency', 4);
const DELAY_MS = Number.isFinite(Number(option('delay'))) ? Number(option('delay')) : 250;
const MAX_PAGES = numberOption('max-pages', 300);
const OUT_FILE = option('out');
const INCLUDE_DISALLOWED = flag('include-disallowed');
const STRICT = flag('strict');

if (flag('dry-run')) {
  console.log(
    JSON.stringify(
      {
        origin: ORIGIN,
        concurrency: CONCURRENCY,
        delayMs: DELAY_MS,
        maxPages: MAX_PAGES,
        includeDisallowed: INCLUDE_DISALLOWED,
        strict: STRICT,
        out: OUT_FILE ?? null,
      },
      null,
      2
    )
  );
  process.exit(0);
}

// ─── HTTP ────────────────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

interface FetchOutcome {
  status: number | null;
  contentType: string;
  body: string;
  location: string | null;
  error: string | null;
}

async function request(
  url: string,
  init: { method?: 'GET' | 'HEAD'; redirect?: 'follow' | 'manual'; readBody?: boolean } = {}
): Promise<FetchOutcome> {
  const controller = new AbortController();
  const timer: ReturnType<typeof setTimeout> = setTimeout(
    () => controller.abort(),
    REQUEST_TIMEOUT_MS
  );
  try {
    const response = await fetch(url, {
      method: init.method ?? 'GET',
      redirect: init.redirect ?? 'follow',
      signal: controller.signal,
      headers: { 'user-agent': USER_AGENT, accept: 'text/html,application/xhtml+xml,*/*' },
    });
    const contentType = response.headers.get('content-type') ?? '';
    const body =
      init.readBody === false || init.method === 'HEAD' ? '' : await response.text().catch(() => '');
    return {
      status: response.status,
      contentType,
      body,
      location: response.headers.get('location'),
      error: null,
    };
  } catch (error) {
    return {
      status: null,
      contentType: '',
      body: '',
      location: null,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timer);
  }
}

// ─── Discovery ───────────────────────────────────────────────────────────────

/** Same-origin, http(s), no fragment; returns null for anything we must not fetch. */
function normalizeInternal(candidate: string, from: string): string | null {
  let url: URL;
  try {
    url = new URL(candidate, from);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  if (url.origin !== ORIGIN) return null; // third-party hosts are never fetched
  url.hash = '';
  return url.toString();
}

async function loadRobots(): Promise<RobotsRules> {
  const outcome = await request(`${ORIGIN}/robots.txt`);
  if (outcome.status !== 200 || !outcome.body) {
    console.warn('crawl-regression: robots.txt unavailable — crawling the seed set only.');
    return EMPTY_ROBOTS;
  }
  return parseRobots(outcome.body);
}

async function loadSitemapUrls(robots: RobotsRules): Promise<string[]> {
  const candidates = new Set<string>([`${ORIGIN}/sitemap.xml`]);
  for (const sitemap of robots.sitemaps) {
    const normalized = normalizeInternal(sitemap, ORIGIN);
    if (normalized) candidates.add(normalized);
  }

  const found = new Set<string>();
  const queue = [...candidates];
  let processed = 0;
  while (queue.length > 0 && processed < 10) {
    const sitemapUrl = queue.shift();
    if (!sitemapUrl) break;
    processed += 1;
    const outcome = await request(sitemapUrl);
    if (outcome.status !== 200 || !outcome.body) continue;
    for (const loc of parseSitemapUrls(outcome.body)) {
      const normalized = normalizeInternal(loc, ORIGIN);
      if (!normalized) continue;
      if (isSitemapIndex(outcome.body)) queue.push(normalized);
      else found.add(normalized);
    }
    await sleep(DELAY_MS);
  }
  return [...found];
}

interface DiscoveredBook {
  path: string;
  genre: string | null;
}

/**
 * Discover the launch catalog from /api/books. Shapes are read defensively so
 * a response-envelope change degrades to "no books discovered" (a P1 the
 * operator sees) rather than a crash or a silent pass.
 */
async function loadCatalogBooks(): Promise<DiscoveredBook[]> {
  const books: DiscoveredBook[] = [];
  for (let page = 1; page <= 5; page += 1) {
    const outcome = await request(`${ORIGIN}/api/books?page=${page}&perPage=100`);
    if (outcome.status !== 200 || !outcome.body) break;

    let payload: unknown;
    try {
      payload = JSON.parse(outcome.body);
    } catch {
      break;
    }
    const items = extractArray(payload);
    if (items.length === 0) break;

    for (const item of items) {
      if (typeof item !== 'object' || item === null) continue;
      const record = item as Record<string, unknown>;
      const slug = typeof record.slug === 'string' && record.slug ? record.slug : null;
      const id = typeof record.id === 'string' && record.id ? record.id : null;
      const key = slug ?? id;
      if (!key) continue;
      books.push({
        path: `/books/${encodeURIComponent(key)}`,
        genre: typeof record.genre === 'string' && record.genre ? record.genre : null,
      });
    }
    if (items.length < 100) break;
    await sleep(DELAY_MS);
  }
  return books;
}

function extractArray(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (typeof payload !== 'object' || payload === null) return [];
  const record = payload as Record<string, unknown>;
  for (const key of ['books', 'items', 'data', 'results']) {
    const value = record[key];
    if (Array.isArray(value)) return value;
  }
  return [];
}

// ─── Link and asset checking ─────────────────────────────────────────────────

const targetStatusCache = new Map<string, number | null>();

/** HEAD-check a same-origin target once, falling back to GET when HEAD is refused. */
async function checkTarget(url: string): Promise<number | null> {
  const cached = targetStatusCache.get(url);
  if (cached !== undefined) return cached;

  let outcome = await request(url, { method: 'HEAD', readBody: false });
  if (outcome.status === 405 || outcome.status === 501 || outcome.status === null) {
    outcome = await request(url, { method: 'GET', readBody: false });
  }
  targetStatusCache.set(url, outcome.status);
  await sleep(DELAY_MS);
  return outcome.status;
}

function isBrokenStatus(status: number | null): boolean {
  return status === null || status >= 400;
}

// ─── Crawl ───────────────────────────────────────────────────────────────────

interface QueueEntry {
  url: string;
  isLaunchBook: boolean;
}

async function main(): Promise<number> {
  console.log(`crawl-regression: target ${ORIGIN}`);

  const robots = await loadRobots();
  const sitemapUrls = await loadSitemapUrls(robots);
  const catalogBooks = await loadCatalogBooks();

  const launchBookPaths = new Set(catalogBooks.map((book) => book.path));
  const seeds = new Map<string, QueueEntry>();

  const addSeed = (url: string, isLaunchBook = false) => {
    const normalized = normalizeInternal(url, ORIGIN);
    if (!normalized) return;
    const existing = seeds.get(normalized);
    seeds.set(normalized, { url: normalized, isLaunchBook: isLaunchBook || !!existing?.isLaunchBook });
  };

  addSeed(`${ORIGIN}/`);
  for (const url of sitemapUrls) {
    addSeed(url, launchBookPaths.has(new URL(url).pathname));
  }
  for (const book of catalogBooks) addSeed(`${ORIGIN}${book.path}`, true);

  const discoveryProblems: string[] = [];
  if (sitemapUrls.length === 0) discoveryProblems.push('sitemap produced no URLs');
  if (catalogBooks.length === 0) discoveryProblems.push('/api/books produced no books');

  console.log(
    `crawl-regression: discovered ${sitemapUrls.length} sitemap URL(s), ` +
      `${catalogBooks.length} catalog book(s), ${seeds.size} seed(s)`
  );

  if (seeds.size <= 1 && discoveryProblems.length === 2) {
    console.error(
      `crawl-regression: nothing to crawl (${discoveryProblems.join('; ')}). ` +
        'Refusing to report a pass on an unverified site.'
    );
    return 2;
  }

  const queue: QueueEntry[] = [...seeds.values()];
  const visited = new Set<string>();
  const rows: CrawlRow[] = [];
  const skippedByRobots: string[] = [];

  const crawlOne = async (entry: QueueEntry): Promise<void> => {
    const pathname = new URL(entry.url).pathname;

    if (!INCLUDE_DISALLOWED && !isAllowedByRobots(pathname, robots)) {
      skippedByRobots.push(pathname);
      return;
    }

    const outcome = await request(entry.url);
    const isHtml = outcome.contentType.includes('text/html');
    const facts = isHtml && outcome.body ? extractHtmlFacts(outcome.body) : null;

    const brokenLinks: string[] = [];
    const brokenAssets: string[] = [];

    if (facts) {
      const internalLinks = new Set<string>();
      for (const href of facts.links) {
        const normalized = normalizeInternal(href, entry.url);
        if (normalized) internalLinks.add(normalized);
      }
      for (const link of internalLinks) {
        // Enqueue for crawling (budget-checked below) and verify it resolves.
        if (!visited.has(link) && !queue.some((queued) => queued.url === link)) {
          if (visited.size + queue.length < MAX_PAGES) {
            queue.push({ url: link, isLaunchBook: launchBookPaths.has(new URL(link).pathname) });
          }
        }
        if (isBrokenStatus(await checkTarget(link))) brokenLinks.push(link);
      }

      const internalAssets = new Set<string>();
      for (const src of facts.assets) {
        const normalized = normalizeInternal(src, entry.url);
        if (normalized) internalAssets.add(normalized);
      }
      for (const asset of internalAssets) {
        if (isBrokenStatus(await checkTarget(asset))) brokenAssets.push(asset);
      }
    }

    rows.push(
      buildRow({
        url: entry.url,
        origin: ORIGIN,
        status: outcome.status,
        transportError: outcome.error,
        facts,
        brokenLinks,
        brokenAssets,
        isLaunchBook: entry.isLaunchBook,
      })
    );
  };

  // Polite pool: bounded concurrency plus a per-request delay inside `request`
  // callers, so a launch-day crawl never looks like an attack to the WAF.
  while (queue.length > 0 && visited.size < MAX_PAGES) {
    const batch: QueueEntry[] = [];
    while (batch.length < CONCURRENCY && queue.length > 0 && visited.size + batch.length < MAX_PAGES) {
      const next = queue.shift();
      if (!next) break;
      if (visited.has(next.url)) continue;
      visited.add(next.url);
      batch.push(next);
    }
    if (batch.length === 0) break;
    await Promise.all(batch.map(crawlOne));
    await sleep(DELAY_MS);
  }

  // ── Canonical-host consistency (P0: "mixed canonical host behaviour") ──────
  const hostFindings: string[] = [];
  const alternate = alternateHostOrigin(ORIGIN);
  if (alternate) {
    const probe = await request(`${alternate}/`, { redirect: 'manual' });
    if (probe.error) {
      hostFindings.push(
        `P2: alternate host ${alternate} is not reachable from here (${probe.error}) — verify DNS/TLS manually`
      );
    } else if (probe.status !== null && probe.status >= 300 && probe.status < 400) {
      if (!sameOrigin(probe.location, ORIGIN)) {
        hostFindings.push(
          `P0: ${alternate} redirects to ${probe.location ?? 'an unknown location'} instead of ${ORIGIN}`
        );
      }
    } else if (probe.status === 200) {
      hostFindings.push(
        `P0: ${alternate} serves HTTP 200 instead of redirecting to ${ORIGIN} (split-brain canonical host)`
      );
    } else {
      hostFindings.push(`P2: ${alternate} returned HTTP ${probe.status ?? 'n/a'} — confirm intended`);
    }
  }

  // ── Report ────────────────────────────────────────────────────────────────
  rows.sort((a, b) => a.url.localeCompare(b.url));

  const genrePaths = [
    ...new Set(
      sitemapUrls
        .map((url) => new URL(url).pathname)
        .filter((pathname) => classifyRoute(pathname) === 'genre')
    ),
  ].sort();
  const audioPaths = [
    ...new Set(
      sitemapUrls
        .map((url) => new URL(url).pathname)
        .filter((pathname) => classifyRoute(pathname) === 'audio-item')
    ),
  ].sort();

  const severities: Severity[] = rows.map((row) => row.severity);
  for (const finding of hostFindings) {
    severities.push(finding.startsWith('P0') ? 'P0' : finding.startsWith('P1') ? 'P1' : 'P2');
  }
  for (const problem of discoveryProblems) {
    severities.push('P1');
    hostFindings.push(`P1: discovery — ${problem}`);
  }

  const overall = worstSeverity(severities);
  const counts = {
    P0: rows.filter((row) => row.severity === 'P0').length,
    P1: rows.filter((row) => row.severity === 'P1').length,
    P2: rows.filter((row) => row.severity === 'P2').length,
    OK: rows.filter((row) => row.severity === 'OK').length,
  };

  const report = [
    `# Full-crawl regression report`,
    '',
    `- Target: \`${ORIGIN}\``,
    `- Crawled at: ${new Date().toISOString()}`,
    `- Pages crawled: ${rows.length} (budget ${MAX_PAGES}, concurrency ${CONCURRENCY}, delay ${DELAY_MS}ms)`,
    `- Robots-disallowed routes skipped: ${skippedByRobots.length}${
      INCLUDE_DISALLOWED ? ' (--include-disallowed was set)' : ''
    }`,
    `- Results: P0 ${counts.P0} · P1 ${counts.P1} · P2 ${counts.P2} · PASS ${counts.OK}`,
    '',
    '## Per-URL results',
    '',
    renderReportTable(rows),
    '',
    '## Canonical-host and discovery findings',
    '',
    hostFindings.length ? hostFindings.map((finding) => `- ${finding}`).join('\n') : '- none',
    '',
    '## Routes skipped because robots.txt disallows them',
    '',
    skippedByRobots.length
      ? `${[...new Set(skippedByRobots)].sort().join(', ')}\n\nThese are covered by the manual checklist below.`
      : '- none',
    '',
    '## Critical manual route checklist (human evidence required)',
    '',
    'A crawler cannot sign these off. Fill in tester, UTC timestamp and evidence',
    'link for every row against the release-candidate SHA.',
    '',
    renderManualChecklist({
      origin: ORIGIN,
      bookPaths: catalogBooks.map((book) => book.path),
      genrePaths,
      audioPaths,
    }),
    '',
  ].join('\n');

  console.log(`\n${report}`);

  if (OUT_FILE) {
    writeFileSync(OUT_FILE, report, 'utf8');
    console.log(`crawl-regression: report written to ${OUT_FILE}`);
  }

  if (failsBuild(overall) || (STRICT && overall !== 'OK')) {
    console.error(`crawl-regression: FAIL — worst severity ${overall}`);
    return 1;
  }
  console.log(`crawl-regression: PASS — worst severity ${overall}`);
  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((error) => {
    // An unexpected throw means we did not finish the crawl — exit 2, not 1, so
    // an incomplete run is never mistaken for a clean one.
    console.error('crawl-regression: harness error —', error);
    process.exit(2);
  });
