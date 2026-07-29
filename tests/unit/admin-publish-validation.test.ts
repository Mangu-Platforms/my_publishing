/** @jest-environment node */

/**
 * Task 2.4 — the admin publish checklist.
 *
 * These tests pin the hard-blocker / warning matrix, prove the client and the
 * server run the same rule set, prove money never touches floating-point
 * arithmetic, and prove an incomplete book cannot be made public.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

import {
  COVER_RULES,
  EPUB_RULES,
  EMPTY_BOOK_FORM_VALUES,
  formatPriceFromCents,
  isValidIsbn,
  isValidSlug,
  parsePriceInput,
  priceInputFromStored,
  priceNumberFromCents,
  validateAdminBook,
  validateCoverDimensions,
  validateCoverFile,
  validateEpubFile,
  type AdminBookFormValues,
} from '@/app/admin/books/_lib/book-validation';
import { RETAILER_URL_FIELDS } from '@/lib/books/fields';

jest.mock('@/lib/server-only-guard', () => ({}));

const ROOT = process.cwd();

/** A book with every hard blocker satisfied and every warning still open. */
function readyBook(overrides: Partial<AdminBookFormValues> = {}): AdminBookFormValues {
  return {
    ...EMPTY_BOOK_FORM_VALUES,
    title: 'The Salt Road',
    slug: 'the-salt-road',
    description: 'A caravan novel.',
    genre: 'Fiction',
    author_id: 'author-1',
    price: '12.99',
    cover_url: 'https://cdn.example.com/covers/abc.jpg',
    status: 'published',
    ...overrides,
  };
}

function blockerFields(values: AdminBookFormValues): string[] {
  return validateAdminBook(values).blockers.map((issue) => issue.field);
}

describe('hard blockers', () => {
  it('a complete book can publish', () => {
    const result = validateAdminBook(readyBook());
    expect(result.blockers).toEqual([]);
    expect(result.canPublish).toBe(true);
    expect(result.ok).toBe(true);
  });

  it.each([
    ['title', { title: '' }],
    ['author_id', { author_id: null }],
    ['cover_url', { cover_url: null }],
    ['description', { description: '' }],
    ['genre', { genre: '' }],
    ['price', { price: '' }],
  ])('missing %s blocks publishing', (field, override) => {
    const values = readyBook(override as Partial<AdminBookFormValues>);
    const result = validateAdminBook(values);
    expect(result.canPublish).toBe(false);
    expect(result.ok).toBe(false);
    expect(blockerFields(values)).toContain(field);
  });

  it('an invalid slug blocks publishing', () => {
    const result = validateAdminBook(readyBook({ slug: 'Not A Slug' }));
    expect(result.canPublish).toBe(false);
    expect(result.fieldErrors.slug).toBeDefined();
  });

  it('a broken required asset reference blocks publishing', () => {
    const values = readyBook({ cover_url: 'http://cdn.example.com/covers/abc.jpg' });
    const result = validateAdminBook(values);
    expect(result.canPublish).toBe(false);
    expect(blockerFields(values)).toContain('cover_url');
    expect(result.fieldErrors.cover_url).toContain('https');
  });

  it('a broken optional asset reference still blocks publishing', () => {
    const values = readyBook({ epub_url: 'not-a-url' });
    expect(blockerFields(values)).toContain('epub_url');
  });

  it('a price of zero is a valid price, not a missing one', () => {
    const result = validateAdminBook(readyBook({ price: '0.00' }));
    expect(result.canPublish).toBe(true);
  });
});

describe('warnings never block', () => {
  it('a book with no retailer link, audio, trailer or ISBN can still publish', () => {
    const result = validateAdminBook(readyBook());
    const fields = result.warnings.map((issue) => issue.field);
    expect(fields).toEqual(
      expect.arrayContaining(['amazon_url', 'audio_url', 'trailer_vimeo_id', 'isbn'])
    );
    expect(result.canPublish).toBe(true);
  });

  it('warnings clear once the optional values are supplied', () => {
    const result = validateAdminBook(
      readyBook({
        amazon_url: 'https://amazon.com/dp/123',
        audio_url: 'https://cdn.example.com/sample.mp3',
        trailer_vimeo_id: '76979871',
        isbn: '9781234567897',
      })
    );
    expect(result.warnings).toEqual([]);
    expect(result.ok).toBe(true);
  });
});

describe('an incomplete book cannot become public', () => {
  it('refuses the published status', () => {
    const values = readyBook({ cover_url: null, description: '' });
    expect(validateAdminBook(values).ok).toBe(false);
  });

  it('still saves as a draft without losing anything', () => {
    const values = readyBook({ cover_url: null, description: '', status: 'draft' });
    const result = validateAdminBook(values);
    expect(result.ok).toBe(true);
    expect(result.canPublish).toBe(false);
    expect(result.blockers.length).toBeGreaterThan(0);
  });

  it('archiving a book with gaps is allowed', () => {
    expect(validateAdminBook(readyBook({ status: 'archived', cover_url: null })).ok).toBe(true);
  });
});

describe('server and client run the same rule set', () => {
  const read = (relative: string) => readFileSync(join(ROOT, relative), 'utf8');

  it('the admin form imports the shared validator', () => {
    expect(read('app/admin/books/_lib/BookForm.tsx')).toContain("from './book-validation'");
  });

  it('the server asset writer enforces the same https rule', () => {
    const source = read('lib/data/book-assets.ts');
    expect(source).toContain('isValidExternalUrl');
    expect(source).toContain("from '@/lib/books/fields'");
  });

  it('neither admin form re-declares its own blocker list', () => {
    for (const file of [
      'app/admin/books/new/BookCreateForm.tsx',
      'app/admin/books/[id]/edit/BookEditForm.tsx',
      'app/admin/books/_lib/BookForm.tsx',
    ]) {
      expect(read(file)).not.toMatch(/const\s+(BLOCKERS|REQUIRED_FIELDS)\s*=/);
    }
  });

  /**
   * The seam this guards: the form posts ONE named payload object, and a named
   * object is not a fresh object literal, so TypeScript's excess-property check
   * never fires on it. A field the action's parameter type does not declare
   * therefore compiles cleanly and is dropped between the browser and the
   * database — silently, on both providers. Type-checking cannot catch this;
   * only a field-by-field comparison can.
   */
  it('every field the shared form posts is declared by the write actions', () => {
    const form = read('app/admin/books/_lib/BookForm.tsx');
    const actions = read('lib/actions/books.ts');

    const payload = form.match(/type BookWritePayload = \{([\s\S]*?)\n\};/)?.[1];
    expect(payload).toBeDefined();
    const posted = [...(payload as string).matchAll(/^ {2}(\w+)\??:/gm)].map((m) => m[1]);
    // Sanity check on the extraction itself, not on the field list.
    expect(posted.length).toBeGreaterThan(15);

    const start = actions.indexOf('type AdminBookAssetInput');
    const end = actions.indexOf('function retailerInputFrom');
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const accepted = actions.slice(start, end);

    for (const field of posted) {
      // Retailer URLs are declared once, via Partial<Record<RetailerUrlField>>.
      if ((RETAILER_URL_FIELDS as readonly string[]).includes(field)) continue;
      expect(accepted).toMatch(new RegExp(`\\b${field}\\??:`));
    }
  });

  it('published_at is write-path-owned: never posted, never accepted', () => {
    // It records the FIRST publication. A form that could set it could also
    // erase it, and the read-only input says so to the operator.
    const form = read('app/admin/books/_lib/BookForm.tsx');
    const payload = form.match(/type BookWritePayload = \{([\s\S]*?)\n\};/)?.[1] ?? '';
    expect(payload).not.toMatch(/published_at/);
    expect(form).toMatch(/id="published_at"[\s\S]*?readOnly/);

    const actions = read('lib/actions/books.ts');
    const start = actions.indexOf('type AdminBookAssetInput');
    const end = actions.indexOf('function retailerInputFrom');
    expect(actions.slice(start, end)).not.toMatch(/published_at/);
  });

  it('subtitle is gone from the admin surface', () => {
    for (const file of [
      'app/admin/books/_lib/BookForm.tsx',
      'app/admin/books/new/BookCreateForm.tsx',
      'app/admin/books/[id]/edit/BookEditForm.tsx',
      'app/admin/books/[id]/edit/page.tsx',
      'components/books/BookUploadForm.tsx',
    ]) {
      expect(read(file)).not.toMatch(/['"]subtitle['"]|\bsubtitle:/);
    }
  });

  it('validation is pure — the same input always yields the same verdict', () => {
    const values = readyBook({ price: '3.50' });
    expect(validateAdminBook(values)).toEqual(validateAdminBook({ ...values }));
  });
});

describe('decimal-safe money', () => {
  it('parses to integer cents', () => {
    expect(parsePriceInput('12.99')).toEqual({ ok: true, cents: 1299 });
    expect(parsePriceInput('0.1')).toEqual({ ok: true, cents: 10 });
    expect(parsePriceInput('7')).toEqual({ ok: true, cents: 700 });
    expect(parsePriceInput('$19.99')).toEqual({ ok: true, cents: 1999 });
    expect(parsePriceInput('1234567.89')).toEqual({ ok: true, cents: 123456789 });
  });

  it('never accumulates float error', () => {
    // The bug this guards against: 0.1 + 0.2 !== 0.3 in IEEE-754.
    expect(0.1 + 0.2).not.toBe(0.3);
    const a = parsePriceInput('0.10');
    const b = parsePriceInput('0.20');
    const total = parsePriceInput('0.30');
    if (!a.ok || !b.ok || !total.ok) throw new Error('unexpected parse failure');
    expect(a.cents + b.cents).toBe(total.cents);
  });

  it('rejects malformed amounts', () => {
    for (const bad of ['', 'abc', '-5', '1.999', '12.', '1e3', '12,99,00']) {
      expect(parsePriceInput(bad).ok).toBe(false);
    }
  });

  it('round-trips cents to string and back', () => {
    for (const cents of [0, 5, 99, 100, 1999, 123456789]) {
      const formatted = formatPriceFromCents(cents);
      const reparsed = parsePriceInput(formatted);
      expect(reparsed).toEqual({ ok: true, cents });
    }
  });

  it('hands the write path the exact decimal', () => {
    expect(priceNumberFromCents(1299)).toBe(12.99);
    expect(priceInputFromStored(12.99)).toBe('12.99');
    expect(priceInputFromStored(9)).toBe('9.00');
    expect(priceInputFromStored(null)).toBe('');
  });

  it('flags a malformed price as a field error rather than coercing it', () => {
    const result = validateAdminBook(readyBook({ price: '12.999' }));
    expect(result.fieldErrors.price).toBeDefined();
    expect(result.ok).toBe(false);
  });
});

describe('retailer URLs', () => {
  it('rejects non-https links with a field-level error', () => {
    const result = validateAdminBook(
      readyBook({
        amazon_url: 'http://amazon.com/dp/123',
        kindle_url: 'amazon.com/dp/123',
        apple_books_url: 'ftp://books.apple.com/x',
      })
    );
    expect(result.fieldErrors.amazon_url).toBe('Must be a full https:// URL');
    expect(result.fieldErrors.kindle_url).toBe('Must be a full https:// URL');
    expect(result.fieldErrors.apple_books_url).toBe('Must be a full https:// URL');
    expect(result.ok).toBe(false);
  });

  it('accepts https links', () => {
    const result = validateAdminBook(
      readyBook({ barnes_noble_url: 'https://barnesandnoble.com/w/123' })
    );
    expect(result.fieldErrors.barnes_noble_url).toBeUndefined();
    expect(result.ok).toBe(true);
  });

  it('a blank retailer field is not an error', () => {
    expect(validateAdminBook(readyBook({ audible_url: '   ' })).fieldErrors.audible_url).toBeUndefined();
  });
});

describe('field shapes', () => {
  it('slugs', () => {
    expect(isValidSlug('the-salt-road')).toBe(true);
    expect(isValidSlug('The-Salt-Road')).toBe(false);
    expect(isValidSlug('salt--road')).toBe(false);
    expect(isValidSlug('')).toBe(false);
    expect(isValidSlug('a'.repeat(121))).toBe(false);
  });

  it('ISBNs', () => {
    expect(isValidIsbn('978-1-234-56789-7')).toBe(true);
    expect(isValidIsbn('123456789X')).toBe(true);
    expect(isValidIsbn('12345')).toBe(false);
  });
});

describe('asset file rules match the provisioned buckets', () => {
  it('cover ceiling is the book-covers bucket limit (5MB)', () => {
    expect(COVER_RULES.maxBytes).toBe(5242880);
  });

  it('epub ceiling is the published-epubs bucket limit (50MB)', () => {
    expect(EPUB_RULES.maxBytes).toBe(52428800);
  });

  it('accepts a compliant cover', () => {
    expect(validateCoverFile({ name: 'cover.jpg', type: 'image/jpeg', size: 900_000 })).toEqual({
      ok: true,
    });
    expect(validateCoverDimensions(1600, 2400)).toEqual({ ok: true });
    expect(validateCoverDimensions(2000, 3000)).toEqual({ ok: true });
  });

  it('rejects the wrong format, size or geometry', () => {
    expect(validateCoverFile({ name: 'cover.webp', type: 'image/webp', size: 10 }).ok).toBe(false);
    expect(validateCoverFile({ name: 'cover.jpg', type: 'image/jpeg', size: 6_000_000 }).ok).toBe(
      false
    );
    expect(validateCoverDimensions(800, 1200).ok).toBe(false); // too small
    expect(validateCoverDimensions(2400, 2400).ok).toBe(false); // square, not 2:3
  });

  it('accepts .epub even when the browser reports octet-stream', () => {
    expect(
      validateEpubFile({ name: 'book.epub', type: 'application/octet-stream', size: 1_000 })
    ).toEqual({ ok: true });
    expect(validateEpubFile({ name: 'book.epub', type: 'application/epub+zip', size: 1 }).ok).toBe(
      true
    );
  });

  it('rejects non-epub files and oversized epubs', () => {
    expect(validateEpubFile({ name: 'book.pdf', type: 'application/pdf', size: 10 }).ok).toBe(false);
    expect(
      validateEpubFile({ name: 'book.epub', type: 'application/epub+zip', size: 60_000_000 }).ok
    ).toBe(false);
  });
});

describe('setBookAssets refuses broken references server-side', () => {
  it('rejects a non-https asset URL before any write', async () => {
    const { setBookAssets } = await import('@/lib/data/book-assets');
    const result = await setBookAssets('book-1', { cover_url: 'http://cdn.example.com/a.jpg' });
    expect(result).toEqual({ ok: false, error: 'Cover image must be a full https:// URL' });
  });

  it('rejects a missing book id', async () => {
    const { setBookAssets } = await import('@/lib/data/book-assets');
    expect(await setBookAssets('', { cover_url: null })).toEqual({
      ok: false,
      error: 'A book id is required',
    });
  });

  it('rejects a non-integer audio duration', async () => {
    const { setBookAssets } = await import('@/lib/data/book-assets');
    const result = await setBookAssets('book-1', { audio_duration_seconds: 12.5 });
    expect(result.ok).toBe(false);
  });

  it('is a no-op when the patch carries nothing', async () => {
    const { setBookAssets } = await import('@/lib/data/book-assets');
    expect(await setBookAssets('book-1', {})).toEqual({ ok: true });
  });
});
