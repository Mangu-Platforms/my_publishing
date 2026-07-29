/** @jest-environment node */

/**
 * Task 4.2 — the book asset-kit intake validator.
 *
 * What these tests exist to hold down:
 *  - the intake rule set IS the admin publish rule set (no drift, proven by
 *    comparing the issue stream against `validateAdminBook` directly);
 *  - ISBN check digits, both formats, both outcomes;
 *  - money never touches floating-point arithmetic — including the
 *    `0.1 + 0.2` case that motivates the whole integer-cent path;
 *  - a slug clash inside one handover is caught before the UNIQUE index does;
 *  - non-https is refused everywhere a URL is accepted;
 *  - warnings never become blockers, no matter how many of them there are.
 */

import { validateAdminBook } from '@/app/admin/books/_lib/book-validation';
import {
  isbnCheckDigitValid,
  normalizeIsbn,
  parseKitJson,
  readImageDimensions,
  stripJsonComments,
  toAdminFormValues,
  validateAssetKit,
  validateAssetKitBatch,
  type AssetKitInput,
  type LocalFileFacts,
  type RawKit,
} from '@/scripts/lib/asset-kit';

jest.mock('@/lib/server-only-guard', () => ({}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** A kit with every blocker cleared. Deliberately fictional throughout. */
function readyKit(overrides: RawKit = {}): RawKit {
  return {
    kit_format_version: 1,
    title: 'The Lantern of Quiet Harbours',
    slug: '',
    author: { pen_name: 'A. N. Example', legal_name: '', admin_author_id: '' },
    genre: 'Literary Fiction',
    content_type: 'book',
    description: 'A lighthouse keeper on a coast the mapmakers gave up on.',
    short_description: 'A lighthouse keeper learns what her light has been guiding.',
    price: '12.99',
    currency: 'USD',
    isbn: '9780306406157',
    published_at: '2026-09-15',
    trailer_vimeo_id: '',
    retailers: { amazon_url: 'https://www.amazon.com/dp/EXAMPLE' },
    assets: {
      cover_url: 'https://cdn.example.com/covers/lantern.jpg',
      audio_sample_url: 'https://cdn.example.com/audio/lantern.mp3',
      audio_duration_seconds: 180,
    },
    seo: {
      title: 'The Lantern of Quiet Harbours',
      description: 'A lighthouse keeper learns what her light has really been guiding.',
      cover_alt: 'Book cover: a lantern burning on a dark stone jetty.',
    },
    rights: { confirmed: true, holder: 'Example Author Ltd', territory: 'World' },
    approval: {
      approved_by: 'Publisher Name',
      approved_on: '2026-07-20',
      final_files_confirmed: true,
      retailer_links_opened: true,
    },
    ...overrides,
  };
}

function input(kit: RawKit, kitName = 'kit-a'): AssetKitInput {
  return { kitName, kit, files: {} };
}

function run(kit: RawKit) {
  return validateAssetKit(input(kit));
}

function codes(issues: Array<{ code: string }>): string[] {
  return issues.map((issue) => issue.code);
}

function fields(issues: Array<{ field: string }>): string[] {
  return issues.map((issue) => issue.field);
}

function fileFacts(overrides: Partial<LocalFileFacts> = {}): LocalFileFacts {
  return {
    declaredPath: 'cover.jpg',
    exists: true,
    size: 1_200_000,
    sniffedMime: 'image/jpeg',
    dimensions: { width: 1600, height: 2400 },
    isZipContainer: false,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------

describe('the baseline kit', () => {
  it('a complete kit has no blockers', () => {
    const result = run(readyKit());
    expect(result.blockers).toEqual([]);
    expect(result.ok).toBe(true);
    expect(result.slug).toBe('the-lantern-of-quiet-harbours');
    expect(result.priceCents).toBe(1299);
  });
});

describe('rule-set parity with the admin publish gate', () => {
  it('every admin-sourced issue is exactly what validateAdminBook produced', () => {
    // If intake ever grows a private copy of an admin rule, the two sides drift
    // and this comparison is what notices.
    const kit = readyKit({ title: '', genre: '', price: '' });
    const result = run(kit);
    const admin = validateAdminBook(toAdminFormValues(kit, {}));

    const fromAdmin = result.blockers
      .filter((issue) => issue.source === 'admin-validation')
      .map((issue) => issue.message)
      .sort();
    const expected = Array.from(
      new Set([
        ...Object.values(admin.fieldErrors),
        ...admin.blockers.map((issue) => issue.message),
      ])
    ).sort();

    expect(fromAdmin).toEqual(expected);
  });

  it('admin warnings arrive as warnings, not blockers', () => {
    const result = run(readyKit({ isbn: '', retailers: {}, trailer_vimeo_id: '' }));
    expect(fields(result.warnings)).toEqual(expect.arrayContaining(['isbn', 'amazon_url']));
    expect(fields(result.blockers)).not.toEqual(expect.arrayContaining(['isbn', 'amazon_url']));
  });
});

describe('required-field blockers', () => {
  it.each([
    ['title', { title: '' }],
    ['genre', { genre: '' }],
    ['description', { description: '' }],
    ['price', { price: '' }],
  ])('a missing %s blocks the kit', (field, override) => {
    const result = run(readyKit(override));
    expect(result.ok).toBe(false);
    expect(fields(result.blockers)).toContain(field);
  });

  it('a missing author blocks the kit', () => {
    const result = run(readyKit({ author: { pen_name: '' } }));
    expect(result.ok).toBe(false);
    expect(fields(result.blockers)).toContain('author_id');
  });

  it('no cover at all blocks the kit', () => {
    const result = run(readyKit({ assets: { audio_sample_url: 'https://cdn.example.com/a.mp3' } }));
    expect(result.ok).toBe(false);
    expect(fields(result.blockers)).toContain('cover_url');
  });

  it.each([
    ['rights.confirmed', { rights: { confirmed: false, holder: 'Example Ltd' } }],
    ['rights.holder', { rights: { confirmed: true, holder: '' } }],
  ])('an unsigned %s blocks the kit', (field, override) => {
    expect(fields(run(readyKit(override)).blockers)).toContain(field);
  });

  it.each([
    'approval.approved_by',
    'approval.approved_on',
    'approval.final_files_confirmed',
    'approval.retailer_links_opened',
  ])('an incomplete approval record blocks the kit (%s)', (field) => {
    const result = run(readyKit({ approval: {} }));
    expect(result.ok).toBe(false);
    expect(fields(result.blockers)).toContain(field);
  });

  it('a subtitle is refused with the reason attached', () => {
    const result = run(readyKit({ subtitle: 'A Novel' }));
    expect(codes(result.blockers)).toContain('kit.subtitle_unsupported');
    expect(result.blockers.find((i) => i.field === 'subtitle')?.message).toMatch(/no migration/);
  });
});

describe('ISBN check digits', () => {
  it.each([
    ['ISBN-13', '9780306406157'],
    ['ISBN-13 hyphenated', '978-0-306-40615-7'],
    ['ISBN-10', '0306406152'],
    ['ISBN-10 ending in X', '043942089X'],
    ['ISBN-10 lowercase x', '043942089x'],
  ])('accepts a valid %s', (_label, value) => {
    expect(isbnCheckDigitValid(value)).toBe(true);
  });

  it.each([
    ['ISBN-13 with a wrong final digit', '9780306406158'],
    ['ISBN-13 with two digits transposed', '9780306046157'],
    ['ISBN-10 with a wrong final digit', '0306406153'],
    ['ISBN-10 with X in the wrong place', '04394X0892'],
    ['not an ISBN at all', '12345'],
    ['empty', ''],
  ])('rejects %s', (_label, value) => {
    expect(isbnCheckDigitValid(value)).toBe(false);
  });

  it('normalises separators and case before checking', () => {
    expect(normalizeIsbn(' 043-942 089x ')).toBe('043942089X');
  });

  it('a bad check digit blocks the kit even though the shape is legal', () => {
    const result = run(readyKit({ isbn: '9780306406158' }));
    expect(result.ok).toBe(false);
    expect(codes(result.blockers)).toContain('kit.isbn_check_digit');
  });

  it('a malformed ISBN is reported once, by the admin shape rule', () => {
    // The shape rule already fired, so the check-digit rule must stay quiet
    // rather than pile a second message onto the same field.
    const result = run(readyKit({ isbn: 'not-an-isbn' }));
    expect(codes(result.blockers)).toContain('admin.field.isbn');
    expect(codes(result.blockers)).not.toContain('kit.isbn_check_digit');
  });
});

describe('money is integer cents, never a float', () => {
  it('the 0.1 + 0.2 trap: the two halves sum to exactly 30 cents', () => {
    // The premise, restated so a future reader sees why this path exists.
    expect(0.1 + 0.2).not.toBe(0.3);

    const tenCents = run(readyKit({ price: '0.1' })).priceCents;
    const twentyCents = run(readyKit({ price: '0.2' })).priceCents;
    expect(tenCents).toBe(10);
    expect(twentyCents).toBe(20);
    expect((tenCents as number) + (twentyCents as number)).toBe(30);
  });

  it('rejects the float artefact itself rather than rounding it away', () => {
    const result = run(readyKit({ price: String(0.1 + 0.2) }));
    expect(result.priceCents).toBeNull();
    expect(result.ok).toBe(false);
    expect(fields(result.blockers)).toContain('price');
  });

  it.each([
    ['12.99', 1299],
    ['19.99', 1999],
    ['0.00', 0],
    ['7', 700],
    ['7.5', 750],
    ['1234567.89', 123456789],
  ])('parses %s to %i cents exactly', (price, cents) => {
    expect(run(readyKit({ price })).priceCents).toBe(cents);
  });

  it.each(['12.999', '12,99.5', 'twelve', '-1.00', '1e3'])('refuses %s', (price) => {
    const result = run(readyKit({ price }));
    expect(result.ok).toBe(false);
    expect(result.priceCents).toBeNull();
  });

  it('a free book is a warning, not a blocker', () => {
    const result = run(readyKit({ price: '0.00' }));
    expect(result.ok).toBe(true);
    expect(codes(result.warnings)).toContain('kit.price_zero');
  });

  it('warns when the price arrives as a JSON number', () => {
    const result = run(readyKit({ price: 12.99 }));
    expect(result.priceCents).toBe(1299);
    expect(codes(result.warnings)).toContain('kit.price_not_string');
    expect(codes(result.blockers)).not.toContain('kit.price_not_string');
  });

  it('a non-USD currency is refused — there is no currency column', () => {
    const result = run(readyKit({ currency: 'GBP' }));
    expect(result.ok).toBe(false);
    expect(codes(result.blockers)).toContain('kit.currency_unsupported');
  });
});

describe('https is required everywhere a URL is accepted', () => {
  it.each([
    ['a retailer link', { retailers: { amazon_url: 'http://www.amazon.com/dp/X' } }, 'amazon_url'],
    [
      'the cover',
      { assets: { cover_url: 'http://cdn.example.com/c.jpg' } },
      'cover_url',
    ],
    [
      'the audio sample',
      {
        assets: {
          cover_url: 'https://cdn.example.com/c.jpg',
          audio_sample_url: 'http://cdn.example.com/a.mp3',
        },
      },
      'audio_url',
    ],
    [
      'the EPUB',
      {
        assets: {
          cover_url: 'https://cdn.example.com/c.jpg',
          epub_url: 'ftp://files.example.com/b.epub',
        },
      },
      'epub_url',
    ],
  ])('refuses %s over a non-https scheme', (_label, override, field) => {
    const result = run(readyKit(override));
    expect(result.ok).toBe(false);
    expect(fields(result.blockers)).toContain(field);
  });

  it('refuses a URL that is not a URL at all', () => {
    const result = run(readyKit({ retailers: { kindle_url: 'amazon.com/dp/X' } }));
    expect(result.ok).toBe(false);
    expect(fields(result.blockers)).toContain('kindle_url');
  });
});

describe('slug and ISBN collisions inside one batch', () => {
  it('two kits deriving the same slug block each other', () => {
    const batch = validateAssetKitBatch([
      input(readyKit({ isbn: '' }), 'kit-a'),
      input(readyKit({ isbn: '' }), 'kit-b'),
    ]);

    expect(batch.ok).toBe(false);
    for (const result of batch.results) {
      expect(result.ok).toBe(false);
      expect(codes(result.blockers)).toContain('batch.slug_collision');
      expect(result.blockers.find((i) => i.code === 'batch.slug_collision')?.message).toMatch(
        /kit-a, kit-b/
      );
    }
  });

  it('an explicit slug clashing with a derived one is still caught', () => {
    const batch = validateAssetKitBatch([
      input(readyKit({ isbn: '' }), 'kit-a'),
      input(readyKit({ title: 'Something Else', slug: 'the-lantern-of-quiet-harbours', isbn: '' }), 'kit-b'),
    ]);
    expect(batch.ok).toBe(false);
    expect(codes(batch.results[1].blockers)).toContain('batch.slug_collision');
  });

  it('two kits sharing an ISBN block each other', () => {
    const batch = validateAssetKitBatch([
      input(readyKit(), 'kit-a'),
      input(readyKit({ title: 'A Different Book' }), 'kit-b'),
    ]);
    expect(codes(batch.results[0].blockers)).toContain('batch.isbn_collision');
    expect(codes(batch.results[1].blockers)).toContain('batch.isbn_collision');
  });

  it('distinct kits pass as a batch', () => {
    const batch = validateAssetKitBatch([
      input(readyKit(), 'kit-a'),
      input(readyKit({ title: 'A Different Book', isbn: '0306406152' }), 'kit-b'),
    ]);
    expect(batch.ok).toBe(true);
    expect(batch.blockerCount).toBe(0);
  });
});

describe('warnings never become blockers', () => {
  it('a kit with every optional field empty still passes', () => {
    const bare: RawKit = {
      title: 'A Bare Minimum Book',
      author: { pen_name: 'A. N. Example' },
      genre: 'Fiction',
      description: 'The shortest complete description that is still real copy.',
      price: '9.99',
      currency: 'USD',
      assets: { cover_url: 'https://cdn.example.com/covers/bare.jpg' },
      rights: { confirmed: true, holder: 'Example Author Ltd' },
      approval: {
        approved_by: 'Publisher Name',
        approved_on: '2026-07-20',
        final_files_confirmed: true,
        retailer_links_opened: true,
      },
    };

    const result = run(bare);
    expect(result.blockers).toEqual([]);
    expect(result.ok).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(5);
    expect(result.warnings.every((issue) => issue.severity === 'warning')).toBe(true);
  });

  it('no warning code is ever also emitted as a blocker', () => {
    const result = run(
      readyKit({
        isbn: '',
        retailers: {},
        published_at: '',
        short_description: '',
        seo: {},
        assets: { cover_url: 'https://cdn.example.com/c.jpg' },
        rights: { confirmed: true, holder: 'Example Author Ltd' },
      })
    );
    const blockerCodes = new Set(codes(result.blockers));
    for (const code of codes(result.warnings)) {
      expect(blockerCodes.has(code)).toBe(false);
    }
  });

  it('an unrecognised key is a typo warning, not a failure', () => {
    const result = run(readyKit({ pubished_at: '2026-09-15' }));
    expect(result.ok).toBe(true);
    expect(codes(result.warnings)).toContain('kit.unknown_key');
  });
});

describe('SEO and alt text', () => {
  it('over-length SEO copy blocks, because zod refuses it at write time', () => {
    const result = run(
      readyKit({
        seo: { title: 'x'.repeat(61), description: 'y'.repeat(161), cover_alt: 'A cover.' },
      })
    );
    expect(codes(result.blockers)).toEqual(
      expect.arrayContaining(['kit.seo_title_too_long', 'kit.seo_description_too_long'])
    );
  });

  it('missing SEO copy and alt text only warns', () => {
    const result = run(readyKit({ seo: {} }));
    expect(result.ok).toBe(true);
    expect(codes(result.warnings)).toEqual(
      expect.arrayContaining([
        'kit.seo_title_missing',
        'kit.seo_description_missing',
        'kit.cover_alt_missing',
      ])
    );
  });

  it('over-long alt text warns only — no column exists to enforce against', () => {
    const result = run(readyKit({ seo: { title: 'T', description: 'D', cover_alt: 'a'.repeat(200) } }));
    expect(result.ok).toBe(true);
    expect(codes(result.warnings)).toContain('kit.cover_alt_long');
  });
});

describe('on-disk assets', () => {
  it('accepts a compliant cover file', () => {
    const result = validateAssetKit({
      kitName: 'kit-a',
      kit: readyKit({ assets: { cover_file: 'cover.jpg' } }),
      files: { cover: fileFacts() },
    });
    expect(result.blockers).toEqual([]);
  });

  it('blocks a cover the kit names but does not contain', () => {
    const result = validateAssetKit({
      kitName: 'kit-a',
      kit: readyKit({ assets: { cover_file: 'cover.jpg' } }),
      files: { cover: fileFacts({ exists: false, size: 0, sniffedMime: null, dimensions: null }) },
    });
    expect(codes(result.blockers)).toContain('kit.cover_missing_file');
  });

  it.each([
    ['too small', { dimensions: { width: 800, height: 1200 } }],
    ['the wrong aspect ratio', { dimensions: { width: 2400, height: 2400 } }],
    ['landscape', { dimensions: { width: 2400, height: 1600 } }],
  ])('blocks a cover that is %s', (_label, override) => {
    const result = validateAssetKit({
      kitName: 'kit-a',
      kit: readyKit({ assets: { cover_file: 'cover.jpg' } }),
      files: { cover: fileFacts(override) },
    });
    expect(codes(result.blockers)).toContain('kit.cover_dimensions');
  });

  it('blocks a cover over the 5 MB bucket limit', () => {
    const result = validateAssetKit({
      kitName: 'kit-a',
      kit: readyKit({ assets: { cover_file: 'cover.jpg' } }),
      files: { cover: fileFacts({ size: 6 * 1024 * 1024 }) },
    });
    expect(codes(result.blockers)).toContain('kit.cover_file_rejected');
  });

  it('blocks a PNG that has been renamed to .jpg', () => {
    const result = validateAssetKit({
      kitName: 'kit-a',
      kit: readyKit({ assets: { cover_file: 'cover.jpg' } }),
      files: { cover: fileFacts({ sniffedMime: 'image/png' }) },
    });
    expect(codes(result.blockers)).toContain('kit.cover_extension_mismatch');
  });

  it('warns rather than blocks when the dimensions cannot be read', () => {
    const result = validateAssetKit({
      kitName: 'kit-a',
      kit: readyKit({ assets: { cover_file: 'cover.jpg' } }),
      files: { cover: fileFacts({ dimensions: null }) },
    });
    expect(result.ok).toBe(true);
    expect(codes(result.warnings)).toContain('kit.cover_dimensions_unreadable');
  });

  it('blocks an EPUB over 50 MB and one that is not a container', () => {
    const oversize = validateAssetKit({
      kitName: 'kit-a',
      kit: readyKit({ assets: { cover_url: 'https://cdn.example.com/c.jpg', epub_file: 'b.epub' } }),
      files: {
        epub: fileFacts({
          declaredPath: 'b.epub',
          size: 60 * 1024 * 1024,
          sniffedMime: null,
          dimensions: null,
          isZipContainer: true,
        }),
      },
    });
    expect(codes(oversize.blockers)).toContain('kit.epub_file_rejected');

    const notAZip = validateAssetKit({
      kitName: 'kit-a',
      kit: readyKit({ assets: { cover_url: 'https://cdn.example.com/c.jpg', epub_file: 'b.epub' } }),
      files: {
        epub: fileFacts({
          declaredPath: 'b.epub',
          size: 1024,
          sniffedMime: null,
          dimensions: null,
          isZipContainer: false,
        }),
      },
    });
    expect(codes(notAZip.blockers)).toContain('kit.epub_not_a_container');
  });

  it('a missing EPUB is only a warning — there is no reader at launch', () => {
    const result = run(readyKit());
    expect(result.ok).toBe(true);
    expect(codes(result.warnings)).toContain('kit.epub_missing');
  });

  it('an audio file in the kit is blocked, with the missing bucket named', () => {
    const result = run(
      readyKit({
        assets: {
          cover_url: 'https://cdn.example.com/c.jpg',
          audio_sample_file: 'sample.mp3',
        },
      })
    );
    expect(result.ok).toBe(false);
    const issue = result.blockers.find((i) => i.code === 'kit.audio_no_bucket');
    expect(issue?.message).toMatch(/no audio bucket is provisioned/);
    expect(issue?.message).toMatch(/audio_sample_url/);
  });
});

describe('image headers are read without a dependency', () => {
  function pngBytes(width: number, height: number): Uint8Array {
    const bytes = new Uint8Array(24);
    bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
    bytes.set([0x00, 0x00, 0x00, 0x0d], 8); // IHDR chunk length
    bytes.set([0x49, 0x48, 0x44, 0x52], 12); // "IHDR"
    const dv = new DataView(bytes.buffer);
    dv.setUint32(16, width);
    dv.setUint32(20, height);
    return bytes;
  }

  function jpegBytes(width: number, height: number): Uint8Array {
    const bytes = new Uint8Array(24);
    const dv = new DataView(bytes.buffer);
    bytes.set([0xff, 0xd8], 0); // SOI
    bytes.set([0xff, 0xe0], 2); // APP0, which the walker must skip over
    dv.setUint16(4, 6);
    bytes.set([0xff, 0xc0], 10); // SOF0
    dv.setUint16(12, 11);
    bytes[14] = 8; // sample precision
    dv.setUint16(15, height);
    dv.setUint16(17, width);
    bytes[19] = 3; // component count
    return bytes;
  }

  it('reads PNG geometry from IHDR', () => {
    expect(readImageDimensions(pngBytes(1600, 2400))).toEqual({ width: 1600, height: 2400 });
  });

  it('reads JPEG geometry from the first SOF frame', () => {
    expect(readImageDimensions(jpegBytes(1600, 2400))).toEqual({ width: 1600, height: 2400 });
  });

  it('returns null for anything it does not recognise', () => {
    expect(readImageDimensions(new Uint8Array([1, 2, 3, 4]))).toBeNull();
  });
});

describe('book.json parsing', () => {
  it('strips comments but leaves URLs intact', () => {
    const source = `{
      // the title
      "title": "A Book", /* inline */
      "retailers": { "amazon_url": "https://www.amazon.com/dp/X" }
    }`;
    const kit = parseKitJson(source);
    expect(kit.title).toBe('A Book');
    expect((kit.retailers as Record<string, string>).amazon_url).toBe(
      'https://www.amazon.com/dp/X'
    );
  });

  it('leaves a // inside a string completely alone', () => {
    expect(stripJsonComments('{"u":"https://a.example/b//c"}')).toBe(
      '{"u":"https://a.example/b//c"}'
    );
  });

  it('refuses anything that is not a single object', () => {
    expect(() => parseKitJson('[1, 2]')).toThrow(/single JSON object/);
  });
});
