import {
  auditPageMetadata,
  auditRobots,
  auditSitemapDuplicates,
  auditSitemapOrigins,
  auditSitemapPublicOnly,
  extractPageMetadata,
  parseRobotsTxt,
  parseSitemapUrls,
  summarize,
} from '../../scripts/lib/seo-audit';

const CANONICAL = 'https://www.mangu-publishers.com';

describe('sitemap parsing and canonical origin', () => {
  it('extracts <loc> values', () => {
    const xml = `<urlset><url><loc>${CANONICAL}/</loc></url><url><loc>${CANONICAL}/books/a</loc></url></urlset>`;
    expect(parseSitemapUrls(xml)).toEqual([`${CANONICAL}/`, `${CANONICAL}/books/a`]);
  });

  it('flags the *.vercel.app canonical regression', () => {
    const findings = auditSitemapOrigins(['https://my-publishing-abc123.vercel.app/books/a'], CANONICAL);
    expect(findings).toHaveLength(1);
    expect(findings[0].code).toBe('SITEMAP_WRONG_ORIGIN');
    expect(findings[0].message).toContain('VERCEL_URL');
  });

  it('accepts canonical-origin URLs', () => {
    expect(auditSitemapOrigins([`${CANONICAL}/books/a`], CANONICAL)).toEqual([]);
  });

  it('flags non-https and unparseable URLs', () => {
    expect(auditSitemapOrigins(['not a url'], CANONICAL)[0].code).toBe('SITEMAP_INVALID_URL');
    expect(auditSitemapOrigins([CANONICAL.replace('https', 'http') + '/books/a'], CANONICAL).map((f) => f.code)).toContain(
      'SITEMAP_NOT_HTTPS'
    );
  });
});

describe('sitemap scope', () => {
  it('rejects admin, api, auth and checkout routes', () => {
    const urls = [
      `${CANONICAL}/admin/books`,
      `${CANONICAL}/api/books`,
      `${CANONICAL}/login`,
      `${CANONICAL}/checkout`,
      `${CANONICAL}/author/dashboard`,
    ];
    expect(auditSitemapPublicOnly(urls)).toHaveLength(5);
  });

  it('keeps the audiobook route — /audio is a kept feature', () => {
    expect(auditSitemapPublicOnly([`${CANONICAL}/audio`])).toEqual([]);
  });

  it('allows normal public routes', () => {
    expect(auditSitemapPublicOnly([`${CANONICAL}/books/a`, `${CANONICAL}/authors/x`, `${CANONICAL}/genres`])).toEqual([]);
  });

  it('does not match a public route that merely starts with the same letters', () => {
    expect(auditSitemapPublicOnly([`${CANONICAL}/administrivia`])).toEqual([]);
  });

  it('flags duplicate entries', () => {
    const findings = auditSitemapDuplicates([`${CANONICAL}/books/a`, `${CANONICAL}/books/a/`]);
    expect(findings[0].code).toBe('SITEMAP_DUPLICATE_URL');
  });
});

describe('robots.txt', () => {
  it('parses sitemap and disallow directives', () => {
    const parsed = parseRobotsTxt(`User-agent: *\nDisallow: /admin/\nDisallow: /api/\nSitemap: ${CANONICAL}/sitemap.xml`);
    expect(parsed.sitemapLines).toEqual([`${CANONICAL}/sitemap.xml`]);
    expect(parsed.disallows).toContain('/admin/');
  });

  it('flags a sitemap on the wrong origin', () => {
    const parsed = parseRobotsTxt(`Sitemap: https://preview.vercel.app/sitemap.xml\nDisallow: /admin/\nDisallow: /api/\nDisallow: /checkout`);
    expect(auditRobots(parsed, CANONICAL).map((f) => f.code)).toContain('ROBOTS_SITEMAP_WRONG_ORIGIN');
  });

  it('flags a missing sitemap declaration', () => {
    expect(auditRobots(parseRobotsTxt('User-agent: *'), CANONICAL).map((f) => f.code)).toContain('ROBOTS_NO_SITEMAP');
  });

  it('passes a correct robots.txt', () => {
    const parsed = parseRobotsTxt(
      `User-agent: *\nDisallow: /admin/\nDisallow: /api/\nDisallow: /checkout\nSitemap: ${CANONICAL}/sitemap.xml`
    );
    expect(auditRobots(parsed, CANONICAL)).toEqual([]);
  });
});

describe('per-page metadata', () => {
  const html = (title: string, description: string, canonical: string) =>
    `<html><head><title>${title}</title><meta name="description" content="${description}"/><link rel="canonical" href="${canonical}"/></head></html>`;

  it('extracts canonical, title and description', () => {
    const page = extractPageMetadata(`${CANONICAL}/books/a`, html('A', 'desc', `${CANONICAL}/books/a`));
    expect(page.title).toBe('A');
    expect(page.description).toBe('desc');
    expect(page.canonical).toBe(`${CANONICAL}/books/a`);
  });

  it('flags duplicate titles and descriptions across books', () => {
    const description = 'x'.repeat(80);
    const pages = [
      extractPageMetadata(`${CANONICAL}/books/a`, html('Same Title', description, `${CANONICAL}/books/a`)),
      extractPageMetadata(`${CANONICAL}/books/b`, html('Same Title', description, `${CANONICAL}/books/b`)),
    ];
    const codes = auditPageMetadata(pages, CANONICAL).map((f) => f.code);
    expect(codes).toContain('PAGE_DUPLICATE_TITLE');
    expect(codes).toContain('PAGE_DUPLICATE_DESCRIPTION');
  });

  it('flags a missing canonical and a cross-origin canonical', () => {
    const missing = extractPageMetadata(`${CANONICAL}/books/a`, '<html><head><title>A</title></head></html>');
    expect(auditPageMetadata([missing], CANONICAL).map((f) => f.code)).toContain('PAGE_NO_CANONICAL');

    const wrong = extractPageMetadata(`${CANONICAL}/books/a`, html('A', 'x'.repeat(80), 'https://preview.vercel.app/books/a'));
    expect(auditPageMetadata([wrong], CANONICAL).map((f) => f.code)).toContain('PAGE_CANONICAL_WRONG_ORIGIN');
  });

  it('flags a noindex page that is listed in the sitemap', () => {
    const page = extractPageMetadata(
      `${CANONICAL}/books/a`,
      `<html><head><title>A</title><meta name="robots" content="noindex"/><meta name="description" content="${'x'.repeat(80)}"/><link rel="canonical" href="${CANONICAL}/books/a"/></head></html>`
    );
    expect(auditPageMetadata([page], CANONICAL).map((f) => f.code)).toContain('PAGE_NOINDEX_IN_SITEMAP');
  });

  it('passes a well-formed unique page', () => {
    const page = extractPageMetadata(`${CANONICAL}/books/a`, html('A Good Title', 'x'.repeat(80), `${CANONICAL}/books/a`));
    expect(auditPageMetadata([page], CANONICAL)).toEqual([]);
  });
});

describe('summarize', () => {
  it('counts errors and warnings separately', () => {
    expect(summarize([{ severity: 'error', code: 'E', message: '' }, { severity: 'warning', code: 'W', message: '' }])).toEqual({
      errors: 1,
      warnings: 1,
    });
  });
});
