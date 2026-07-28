/**
 * scripts/lib/crawl-report.ts
 *
 * Pure helpers for `scripts/crawl-regression.ts` (Task 5.3 — full-crawl
 * regression harness). Everything here is side-effect free: no network, no
 * filesystem, no process.exit. The runner owns I/O; this module owns rules.
 *
 * CONSTRAINT — no new npm dependencies (launch freeze, issue #209). That is
 * why HTML facts are pulled out with narrow, documented regexes rather than a
 * DOM parser. The regexes are deliberately conservative: they are used to
 * REPORT findings for a human, never to make a security decision, and every
 * "unknown" is reported as unknown rather than guessed.
 */

// ─── Severity model ──────────────────────────────────────────────────────────
//
// P0/P1 make the harness exit non-zero (launch blockers). P2 is reported but
// does not fail the run, so SEO polish never blocks a release on its own.
//
//   P0  public 5xx · launch-book path not reachable · mixed canonical host
//   P1  broken internal link/asset on a public page · discovery failure
//   P2  missing title/description/canonical/lang/viewport · a11y blocker
//
export type Severity = 'OK' | 'P2' | 'P1' | 'P0';

const SEVERITY_ORDER: Record<Severity, number> = { OK: 0, P2: 1, P1: 2, P0: 3 };

export function worstSeverity(values: readonly Severity[]): Severity {
  return values.reduce<Severity>(
    (worst, value) => (SEVERITY_ORDER[value] > SEVERITY_ORDER[worst] ? value : worst),
    'OK'
  );
}

export function failsBuild(severity: Severity): boolean {
  return severity === 'P0' || severity === 'P1';
}

// ─── Route classification ────────────────────────────────────────────────────

export type RouteType =
  | 'home'
  | 'catalog'
  | 'book'
  | 'genre-index'
  | 'genre'
  | 'author-index'
  | 'author'
  | 'audio-index'
  | 'audio-item'
  | 'comics'
  | 'papers'
  | 'discover'
  | 'legal'
  | 'support'
  | 'auth'
  | 'account'
  | 'portal'
  | 'admin'
  | 'api'
  | 'other';

/** Map a pathname to a route type. Used for grouping the report, not for gating. */
export function classifyRoute(pathname: string): RouteType {
  const path = pathname.replace(/\/+$/, '') || '/';
  if (path === '/') return 'home';
  if (path === '/books') return 'catalog';
  if (path.startsWith('/books/')) return 'book';
  if (path === '/genres') return 'genre-index';
  if (path.startsWith('/genres/')) return 'genre';
  if (path === '/authors') return 'author-index';
  if (path.startsWith('/authors/')) return 'author';
  if (path === '/audio') return 'audio-index';
  if (path.startsWith('/audio/')) return 'audio-item';
  if (path.startsWith('/comics')) return 'comics';
  if (path.startsWith('/papers')) return 'papers';
  if (path.startsWith('/discover') || path.startsWith('/recommendations')) return 'discover';
  if (['/terms', '/privacy', '/cookies'].includes(path)) return 'legal';
  if (['/about', '/contact', '/help', '/faqs', '/careers', '/press'].includes(path)) {
    return 'support';
  }
  if (/^\/(login|register|reset-password|verify-email)/.test(path)) return 'auth';
  if (/^\/(library|reading|dashboard|users|checkout)/.test(path)) return 'account';
  if (/^\/(author|partner)(\/|$)/.test(path)) return 'portal';
  if (path.startsWith('/admin')) return 'admin';
  if (path.startsWith('/api')) return 'api';
  return 'other';
}

/**
 * Route types a search engine may index. Only these get SEO findings (title /
 * description / canonical), so gated surfaces are not scored against rules
 * that do not apply to them.
 */
export function isIndexableRouteType(type: RouteType): boolean {
  return !['auth', 'account', 'portal', 'admin', 'api'].includes(type);
}

// ─── robots.txt ──────────────────────────────────────────────────────────────

export interface RobotsRules {
  /** Path prefixes disallowed for user-agent `*`. */
  disallow: string[];
  /** Path prefixes explicitly allowed for user-agent `*` (longest match wins). */
  allow: string[];
  sitemaps: string[];
}

export const EMPTY_ROBOTS: RobotsRules = { disallow: [], allow: [], sitemaps: [] };

/**
 * Parse robots.txt for the `*` group only. We never impersonate Googlebot: the
 * harness is a generic crawler, so it must obey the generic group.
 */
export function parseRobots(text: string): RobotsRules {
  const rules: RobotsRules = { disallow: [], allow: [], sitemaps: [] };
  let inStarGroup = false;
  let sawAgentInCurrentGroup = false;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, '').trim();
    if (!line) continue;
    const separator = line.indexOf(':');
    if (separator <= 0) continue;

    const field = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();

    if (field === 'sitemap') {
      rules.sitemaps.push(value);
      continue;
    }
    if (field === 'user-agent') {
      // A new user-agent line after directives starts a new group.
      if (sawAgentInCurrentGroup === false) {
        inStarGroup = value === '*' || inStarGroup;
      } else {
        inStarGroup = value === '*';
      }
      sawAgentInCurrentGroup = false;
      continue;
    }
    sawAgentInCurrentGroup = true;
    if (!inStarGroup || !value) continue;
    if (field === 'disallow') rules.disallow.push(value);
    if (field === 'allow') rules.allow.push(value);
  }

  return rules;
}

/** Longest-match wins, Allow beats Disallow on a tie (standard robots semantics). */
export function isAllowedByRobots(pathname: string, rules: RobotsRules): boolean {
  const longest = (patterns: string[]): number =>
    patterns
      .filter((pattern) => pathname.startsWith(pattern))
      .reduce((best, pattern) => Math.max(best, pattern.length), -1);

  const disallowed = longest(rules.disallow);
  if (disallowed < 0) return true;
  return longest(rules.allow) >= disallowed;
}

// ─── sitemap.xml ─────────────────────────────────────────────────────────────

/** Extract <loc> values from a sitemap or sitemap index. */
export function parseSitemapUrls(xml: string): string[] {
  const urls: string[] = [];
  const pattern = /<loc>\s*([^<\s][^<]*?)\s*<\/loc>/gi;
  let match = pattern.exec(xml);
  while (match !== null) {
    urls.push(decodeXmlEntities(match[1]));
    match = pattern.exec(xml);
  }
  return urls;
}

export function isSitemapIndex(xml: string): boolean {
  return /<sitemapindex[\s>]/i.test(xml);
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

// ─── HTML facts ──────────────────────────────────────────────────────────────

export interface HtmlFacts {
  title: string | null;
  description: string | null;
  canonical: string | null;
  lang: string | null;
  hasViewportMeta: boolean;
  h1Count: number;
  /** Raw href values found in <a>. Resolution/filtering is the runner's job. */
  links: string[];
  /** Raw src/href values for <img>, <script> and stylesheet <link>. */
  assets: string[];
  imagesMissingAlt: number;
  inputsMissingLabel: number;
  /** Rendered markers that mean the page failed even though HTTP said 200. */
  errorMarkers: string[];
}

/** Markers Next.js renders for 404 / server error / client exception. */
const ERROR_MARKERS: ReadonlyArray<[string, RegExp]> = [
  ['next-404', /This page could not be found/i],
  ['next-error-boundary', /__next_error__/],
  ['client-exception', /Application error: a client-side exception/i],
  ['server-error', /Internal Server Error/i],
];

export function extractHtmlFacts(html: string): HtmlFacts {
  const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  const descriptionTag = /<meta[^>]+name=["']description["'][^>]*>/i.exec(html);
  const canonicalTag = /<link[^>]+rel=["']canonical["'][^>]*>/i.exec(html);
  const langMatch = /<html[^>]*\slang=["']([^"']+)["']/i.exec(html);

  const labelFor = new Set(collectAll(/<label[^>]+for=["']([^"']+)["']/gi, html));
  let inputsMissingLabel = 0;
  for (const tag of collectAll(/(<input\b[^>]*>)/gi, html)) {
    if (/type=["'](hidden|submit|button|image|reset)["']/i.test(tag)) continue;
    if (/aria-label(?:ledby)?=/i.test(tag)) continue;
    const id = /\sid=["']([^"']+)["']/i.exec(tag);
    if (id && labelFor.has(id[1])) continue;
    inputsMissingLabel += 1;
  }

  let imagesMissingAlt = 0;
  for (const tag of collectAll(/(<img\b[^>]*>)/gi, html)) {
    if (!/\salt=/i.test(tag)) imagesMissingAlt += 1;
  }

  return {
    title: titleMatch ? decodeXmlEntities(titleMatch[1]).trim() || null : null,
    description: descriptionTag ? attributeOf(descriptionTag[0], 'content') : null,
    canonical: canonicalTag ? attributeOf(canonicalTag[0], 'href') : null,
    lang: langMatch ? langMatch[1] : null,
    hasViewportMeta: /<meta[^>]+name=["']viewport["']/i.test(html),
    h1Count: collectAll(/(<h1[\s>])/gi, html).length,
    links: collectAll(/<a\b[^>]*\shref=["']([^"'#][^"']*)["']/gi, html),
    assets: [
      ...collectAll(/<(?:img|script)\b[^>]*\ssrc=["']([^"']+)["']/gi, html),
      ...collectAll(/<link\b[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+)["']/gi, html),
    ],
    imagesMissingAlt,
    inputsMissingLabel,
    errorMarkers: ERROR_MARKERS.filter(([, pattern]) => pattern.test(html)).map(([name]) => name),
  };
}

function collectAll(pattern: RegExp, input: string): string[] {
  const found: string[] = [];
  let match = pattern.exec(input);
  while (match !== null) {
    found.push(match[1]);
    match = pattern.exec(input);
  }
  return found;
}

function attributeOf(tag: string, name: string): string | null {
  const match = new RegExp(`\\s${name}=["']([^"']*)["']`, 'i').exec(tag);
  return match ? decodeXmlEntities(match[1]).trim() || null : null;
}

// ─── Canonical host ──────────────────────────────────────────────────────────

/**
 * Derive the sibling host (apex <-> www) of the canonical origin.
 *
 * WHY derive instead of configure: the canonical host must never be hardcoded
 * in the repo (it changes with the deployment target), but "does the OTHER
 * spelling of our own domain behave consistently?" is exactly the P0 this
 * harness has to catch. Returns null for hosts where the question is
 * meaningless (localhost, IPs, bare two-label domains under a public suffix we
 * cannot infer).
 */
export function alternateHostOrigin(origin: string): string | null {
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return null;
  }
  const host = url.hostname;
  if (host === 'localhost' || /^[\d.]+$/.test(host) || host.endsWith('.local')) return null;

  const alternate = host.startsWith('www.') ? host.slice(4) : `www.${host}`;
  // Refuse to build a single-label host (e.g. "www.localhost" -> "localhost").
  if (!alternate.includes('.')) return null;
  const next = new URL(url.toString());
  next.hostname = alternate;
  return next.origin;
}

/** True when `candidate` is the canonical origin, ignoring trailing slashes. */
export function sameOrigin(candidate: string | null, origin: string): boolean {
  if (!candidate) return false;
  try {
    return new URL(candidate, origin).origin === new URL(origin).origin;
  } catch {
    return false;
  }
}

// ─── Report rows ─────────────────────────────────────────────────────────────

export interface CrawlRow {
  url: string;
  routeType: RouteType;
  status: number | null;
  /** Populated when the request itself failed (DNS, TLS, timeout). */
  transportError: string | null;
  canonical: string | null;
  title: string | null;
  description: string | null;
  brokenLinks: string[];
  brokenAssets: string[];
  /** 'not-collected (no browser)' unless a rendered error marker was found. */
  consoleErrors: string;
  mobileIssue: string;
  accessibilityBlocker: string;
  findings: string[];
  severity: Severity;
}

export interface RowInput {
  url: string;
  origin: string;
  status: number | null;
  transportError: string | null;
  facts: HtmlFacts | null;
  brokenLinks: string[];
  brokenAssets: string[];
  /** True for URLs that came from /api/books — a broken one is a launch blocker. */
  isLaunchBook: boolean;
}

/**
 * Turn a fetched page into a report row plus its severity.
 *
 * The rules are intentionally explicit rather than clever: a reviewer must be
 * able to read this function and predict exactly when the harness fails a run.
 */
export function buildRow(input: RowInput): CrawlRow {
  const { url, origin, status, transportError, facts, brokenLinks, brokenAssets } = input;
  const routeType = classifyRoute(new URL(url).pathname);
  const indexable = isIndexableRouteType(routeType);
  const findings: string[] = [];
  const severities: Severity[] = ['OK'];

  const record = (severity: Severity, message: string) => {
    findings.push(`${severity}: ${message}`);
    severities.push(severity);
  };

  if (transportError) {
    record('P0', `request failed (${transportError})`);
  } else if (status === null) {
    record('P1', 'no HTTP status recorded');
  } else if (status >= 500) {
    record('P0', `public ${status}`);
  } else if (input.isLaunchBook && status !== 200) {
    record('P0', `launch-book path returned ${status}`);
  } else if (status === 404) {
    // A 404 that the crawler reached by following a link is a broken path; the
    // deliberate /404 probe is passed in as a non-launch URL and handled by the
    // caller's expectation list.
    record('P1', 'HTTP 404');
  } else if (status >= 400) {
    record('P1', `HTTP ${status}`);
  }

  if (facts?.errorMarkers.length) {
    // 200 + an error marker is worse than an honest 500: monitoring sees green.
    record('P0', `error markers rendered on a ${status ?? '2xx'} page: ${facts.errorMarkers.join(', ')}`);
  }

  if (brokenLinks.length) record('P1', `${brokenLinks.length} broken internal link(s)`);
  if (brokenAssets.length) record('P1', `${brokenAssets.length} broken asset(s)`);

  if (facts && indexable && status === 200) {
    if (!facts.canonical) {
      record('P2', 'missing canonical');
    } else if (!sameOrigin(facts.canonical, origin)) {
      // Split-brain canonical: the page tells crawlers a different host owns it.
      record('P0', `canonical points off the canonical host (${facts.canonical})`);
    }
    if (!facts.title) record('P2', 'missing <title>');
    if (!facts.description) record('P2', 'missing meta description');
    if (!facts.lang) record('P2', 'missing <html lang>');
    if (facts.h1Count === 0) record('P2', 'no <h1>');
    if (facts.h1Count > 1) record('P2', `${facts.h1Count} <h1> elements`);
  }

  const mobileIssue =
    facts === null
      ? 'not-checked'
      : facts.hasViewportMeta
        ? 'none detected (static check)'
        : 'missing viewport meta';
  if (facts && !facts.hasViewportMeta && status === 200) record('P2', 'missing viewport meta');

  const a11yProblems: string[] = [];
  if (facts) {
    if (!facts.lang) a11yProblems.push('no html[lang]');
    if (facts.imagesMissingAlt > 0) a11yProblems.push(`${facts.imagesMissingAlt} img without alt`);
    if (facts.inputsMissingLabel > 0) {
      a11yProblems.push(`${facts.inputsMissingLabel} input without label`);
    }
    if (facts.h1Count === 0) a11yProblems.push('no h1');
  }
  if (a11yProblems.length) record('P2', `a11y: ${a11yProblems.join('; ')}`);

  return {
    url,
    routeType,
    status,
    transportError,
    canonical: facts?.canonical ?? null,
    title: facts?.title ?? null,
    description: facts?.description ?? null,
    brokenLinks,
    brokenAssets,
    consoleErrors: facts?.errorMarkers.length
      ? `rendered error marker: ${facts.errorMarkers.join(', ')}`
      : 'not-collected (fetch-based crawl, no browser)',
    mobileIssue,
    accessibilityBlocker: facts === null ? 'not-checked' : a11yProblems.join('; ') || 'none detected',
    findings,
    severity: worstSeverity(severities),
  };
}

// ─── Rendering ───────────────────────────────────────────────────────────────

function cell(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—';
  return String(value).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ').slice(0, 220);
}

const REPORT_COLUMNS = [
  'URL',
  'Route type',
  'Status',
  'Canonical',
  'Title',
  'Description',
  'Broken links',
  'Broken assets',
  'Console errors',
  'Mobile issue',
  'A11y blocker',
  'Result',
] as const;

export function renderReportTable(rows: readonly CrawlRow[]): string {
  const lines = [
    `| ${REPORT_COLUMNS.join(' | ')} |`,
    `| ${REPORT_COLUMNS.map(() => '---').join(' | ')} |`,
  ];
  for (const row of rows) {
    lines.push(
      `| ${[
        cell(row.url),
        cell(row.routeType),
        cell(row.transportError ? `ERR (${row.transportError})` : row.status),
        cell(row.canonical),
        cell(row.title),
        cell(row.description),
        cell(row.brokenLinks.join(' ')),
        cell(row.brokenAssets.join(' ')),
        cell(row.consoleErrors),
        cell(row.mobileIssue),
        cell(row.accessibilityBlocker),
        cell(row.severity === 'OK' ? 'PASS' : `${row.severity} — ${row.findings.join('; ')}`),
      ].join(' | ')} |`
    );
  }
  return lines.join('\n');
}

export interface ManualChecklistInput {
  origin: string;
  /** Book paths discovered from /api/books + sitemap, e.g. '/books/some-slug'. */
  bookPaths: readonly string[];
  /** Genre paths discovered from the sitemap, e.g. '/genres/Fiction'. */
  genrePaths: readonly string[];
  /** Audio item paths, empty when FEATURE_AUDIO is off on the target. */
  audioPaths: readonly string[];
}

/**
 * The critical route checklist a human must walk before launch.
 *
 * Deliberately emitted with empty result cells: the crawler cannot substitute
 * for operator evidence (CCR-014), and several of these routes are
 * robots-disallowed, so the harness never fetches them at all.
 */
export function renderManualChecklist(input: ManualChecklistInput): string {
  const { origin, bookPaths, genrePaths, audioPaths } = input;
  const abs = (path: string) => `${origin}${path}`;

  const items: Array<{ id: string; route: string; check: string }> = [
    { id: 'M-01', route: abs('/'), check: 'Homepage renders; hero, nav and footer links resolve' },
    { id: 'M-02', route: abs('/books'), check: 'Catalog lists only real launch titles; filters work' },
  ];

  bookPaths.forEach((path, index) => {
    items.push({
      id: `M-03.${index + 1}`,
      route: abs(path),
      check: 'Launch book page: cover, blurb, price, buy CTA, canonical, share preview',
    });
  });
  if (bookPaths.length === 0) {
    items.push({
      id: 'M-03.?',
      route: `${origin}/books/<launch-slug>`,
      check: 'NO BOOKS DISCOVERED — confirm the launch catalog is published before signing off',
    });
  }

  genrePaths.forEach((path, index) => {
    items.push({
      id: `M-04.${index + 1}`,
      route: abs(path),
      check: 'Active genre page lists its books; empty state is honest if none',
    });
  });
  if (genrePaths.length === 0) {
    items.push({
      id: 'M-04.?',
      route: `${origin}/genres/<active-genre>`,
      check: 'NO GENRES DISCOVERED — confirm genre pages exist for the launch catalog',
    });
  }

  items.push({
    id: 'M-05',
    route: abs('/audio'),
    check: 'Audio catalog: honest unavailable page when FEATURE_AUDIO is off, listing when on',
  });
  if (audioPaths.length > 0) {
    audioPaths.forEach((path, index) => {
      items.push({
        id: `M-06.${index + 1}`,
        route: abs(path),
        check: 'Audio detail page: player loads, progress saves, no dead controls',
      });
    });
  } else {
    items.push({
      id: 'M-06',
      route: `${origin}/audio/<id>`,
      check: 'Audio detail — only applicable when FEATURE_AUDIO is on; otherwise record N/A',
    });
  }

  items.push(
    { id: 'M-07', route: abs('/login'), check: 'Login: success, wrong password, unknown email all honest' },
    { id: 'M-08', route: abs('/register'), check: 'Register: validation, duplicate email, verification email arrives' },
    { id: 'M-09', route: abs('/reset-password'), check: 'Password reset: request email, follow link, set new password, sign in' },
    { id: 'M-10', route: `${origin}/books/<purchased-slug>?success=true`, check: 'Checkout SUCCESS return: order recorded, entitlement granted, receipt sent' },
    { id: 'M-11', route: `${origin}/books/<purchased-slug>?canceled=true`, check: 'Checkout CANCEL return: no order, no charge, no misleading success copy' },
    { id: 'M-12', route: abs('/library'), check: 'Library shows purchased titles only; unpurchased titles are absent' },
    { id: 'M-13', route: abs('/admin/dashboard'), check: 'ADMIN DENIAL as a signed-in non-admin: bounced, no admin data in the response' },
    { id: 'M-14', route: `${origin}/this-route-does-not-exist`, check: '404 page renders, returns HTTP 404, and offers a way back' }
  );

  const header = [
    '| # | Route | What to verify | Result (PASS/FAIL) | Tester | UTC | Evidence |',
    '| --- | --- | --- | --- | --- | --- | --- |',
  ];
  const rows = items.map(
    (item) => `| ${item.id} | ${cell(item.route)} | ${cell(item.check)} |  |  |  |  |`
  );
  return [...header, ...rows].join('\n');
}
