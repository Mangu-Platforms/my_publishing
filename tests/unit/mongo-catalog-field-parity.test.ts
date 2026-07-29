/**
 * @jest-environment node
 *
 * Task 2.0b — under DATABASE_PROVIDER=mongodb the catalog read path must
 * project the same fields as the Supabase path.
 *
 * Every case here fails against the pre-fix mappers, which hardcoded
 * `audio_url: null` / `trailer_vimeo_id: null`, dropped all six retailer URLs
 * and returned [] / null for the audiobook routes — so in production the
 * retailer buttons, the PDP "Audio Sample" tab and all of /audio were dead.
 */
import { CATALOG_DETAIL_FIELDS, RETAILER_URL_FIELDS } from '@/lib/books/fields';

jest.mock('mongodb', () => ({
  ObjectId: class ObjectId {
    id: string;
    constructor(id: string = '000000000000000000000000') {
      this.id = id;
    }
    toString() {
      return this.id;
    }
    static isValid(id: string) {
      return /^[a-fA-F0-9]{24}$/.test(id);
    }
  },
}));

const mockIsMongoPrimary = jest.fn(() => true);

jest.mock('@/lib/db/provider', () => ({
  isMongoPrimary: () => mockIsMongoPrimary(),
  getDatabaseProvider: () => (mockIsMongoPrimary() ? 'mongodb' : 'supabase'),
}));

jest.mock('@/lib/server-only-guard', () => ({}));

const mockGetBookById = jest.fn();
const mockGetBookBySlug = jest.fn();

jest.mock('@/lib/mongo-queries', () => ({
  createBook: jest.fn(),
  getBookById: (...args: unknown[]) => mockGetBookById(...args),
  getBookBySlug: (...args: unknown[]) => mockGetBookBySlug(...args),
  getBooks: jest.fn(),
  searchBooks: jest.fn(),
  updateBook: jest.fn(),
}));

/** Captures the aggregation pipeline so the $match filters can be asserted. */
const mockAggregate = jest.fn();
const mockAggregateToArray = jest.fn();

jest.mock('@/lib/mongo', () => ({
  getDb: async () => ({
    collection: () => ({
      aggregate: (...args: unknown[]) => {
        mockAggregate(...args);
        return { toArray: mockAggregateToArray };
      },
    }),
  }),
}));

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({ from: () => ({}) })),
}));

/** Published+public book with the full launch payload attached. */
const AUDIO_BOOK = {
  _id: 'm-audio',
  title: 'The Loud One',
  slug: 'the-loud-one',
  description: 'A sample you can actually hear.',
  cover_url: 'https://cdn.example/cover.jpg',
  author_id: 'a1',
  status: 'published',
  visibility: 'public',
  price: 9.99,
  avg_rating: 4.2,
  review_count: 7,
  content_type: 'book',
  amazon_url: 'https://amazon.example/loud',
  kindle_url: 'https://kindle.example/loud',
  apple_books_url: 'https://books.apple.example/loud',
  google_play_books_url: 'https://play.example/loud',
  barnes_noble_url: 'https://bn.example/loud',
  audible_url: 'https://audible.example/loud',
  audio_url: 'https://cdn.example/sample.mp3',
  audio_toc: [
    { title: 'Chapter One', start: 0 },
    { title: 'Chapter Two', start: '12:30' },
  ],
  audio_narrator: 'Alex Reed',
  audio_duration_seconds: 1800,
  trailer_vimeo_id: '123456789',
  epub_url: 'https://cdn.example/book.epub',
  isbn: '978-1-234-56789-7',
  is_featured: true,
  page_count: 320,
  word_count: 90000,
  created_at: new Date('2026-01-01'),
  updated_at: new Date('2026-01-02'),
  author: { _id: 'a1', pen_name: 'Ada Vox' },
};

/** Same shape, no audio and no retailer links. */
const SILENT_BOOK = {
  _id: 'm-silent',
  title: 'The Quiet One',
  slug: 'the-quiet-one',
  description: 'No sample.',
  cover_url: null,
  author_id: 'a1',
  status: 'published',
  visibility: 'public',
  price: 4.99,
  created_at: new Date('2026-01-03'),
  updated_at: new Date('2026-01-03'),
  author: { _id: 'a1', pen_name: 'Ada Vox' },
};

const DRAFT_BOOK = {
  _id: 'm-draft',
  title: 'Not Yet',
  slug: 'not-yet',
  status: 'draft',
  visibility: 'private',
  author_id: 'a1',
  created_at: new Date('2026-01-04'),
  updated_at: new Date('2026-01-04'),
};

const FIXTURES = [AUDIO_BOOK, SILENT_BOOK, DRAFT_BOOK] as Array<Record<string, unknown>>;

/** Stand in for the `$match` the real mongo-queries helpers apply. */
function findFixture(
  predicate: (doc: Record<string, unknown>) => boolean,
  options: { status?: string; visibility?: string } = {}
) {
  const doc = FIXTURES.find(predicate);
  if (!doc) return null;
  if (options.status && doc.status !== options.status) return null;
  if (options.visibility && doc.visibility !== options.visibility) return null;
  return doc;
}

beforeEach(() => {
  mockIsMongoPrimary.mockReturnValue(true);
  mockGetBookById.mockImplementation(async (id: string, options = {}) =>
    findFixture((doc) => doc._id === id, options)
  );
  mockGetBookBySlug.mockImplementation(async (slug: string, options = {}) =>
    findFixture((doc) => doc.slug === slug, options)
  );
  mockAggregateToArray.mockResolvedValue([]);
});

afterEach(() => {
  mockIsMongoPrimary.mockReset();
  mockGetBookById.mockReset();
  mockGetBookBySlug.mockReset();
  mockAggregate.mockReset();
  mockAggregateToArray.mockReset();
  jest.resetModules();
});

describe('fetchBookForApi (mongo) field parity', () => {
  it('projects every catalog contract field off the document', async () => {
    const { fetchBookForApi } = await import('@/lib/data/books');
    const book = await fetchBookForApi({ slug: 'the-loud-one' });

    expect(book).not.toBeNull();
    for (const field of CATALOG_DETAIL_FIELDS) {
      expect(book).toHaveProperty(field);
    }
    for (const field of RETAILER_URL_FIELDS) {
      expect(book?.[field]).toBe(AUDIO_BOOK[field as keyof typeof AUDIO_BOOK]);
    }
    // The two fields that were hardcoded null before the fix.
    expect(book?.audio_url).toBe('https://cdn.example/sample.mp3');
    expect(book?.trailer_vimeo_id).toBe('123456789');
    expect(book?.content_type).toBe('book');
    expect(book?.isbn).toBe('978-1-234-56789-7');
  });

  it('yields no audio url and no player data for a book without audio', async () => {
    const { fetchBookForApi } = await import('@/lib/data/books');
    const book = await fetchBookForApi({ slug: 'the-quiet-one' });

    expect(book?.audio_url).toBeNull();
    expect(book?.audio_toc).toBeNull();
    expect(book?.audio_duration_seconds).toBeNull();
    expect(book?.trailer_vimeo_id).toBeNull();
    for (const field of RETAILER_URL_FIELDS) {
      expect(book?.[field]).toBeNull();
    }
    // Missing content_type still resolves to the default so cards can group.
    expect(book?.content_type).toBe('book');
  });

  it('keeps the published+public security filter (draft book is not returned)', async () => {
    const { fetchBookForApi } = await import('@/lib/data/books');

    await expect(fetchBookForApi({ slug: 'not-yet' })).resolves.toBeNull();
    expect(mockGetBookBySlug).toHaveBeenCalledWith('not-yet', { status: 'published' });

    await expect(fetchBookForApi({ id: 'm-draft' })).resolves.toBeNull();
    expect(mockGetBookById).toHaveBeenCalledWith('m-draft', {
      status: 'published',
      visibility: 'public',
    });
  });

  it('re-checks visibility for a slug lookup (slug filter is status-only)', async () => {
    mockGetBookBySlug.mockResolvedValue({ ...AUDIO_BOOK, visibility: 'private' });
    const { fetchBookForApi } = await import('@/lib/data/books');
    await expect(fetchBookForApi({ slug: 'the-loud-one' })).resolves.toBeNull();
  });
});

describe('listFeaturedBooks (mongo)', () => {
  it('prefers is_featured, then tops the rail up by rating', async () => {
    mockAggregateToArray
      .mockResolvedValueOnce([AUDIO_BOOK])
      .mockResolvedValueOnce([{ ...SILENT_BOOK, avg_rating: 5 }]);

    const { listFeaturedBooks } = await import('@/lib/data/books');
    const books = await listFeaturedBooks(3);

    const featuredPipeline = mockAggregate.mock.calls[0][0] as Array<Record<string, unknown>>;
    const match = featuredPipeline[0].$match as Record<string, unknown>;
    expect(match).toMatchObject({
      status: 'published',
      visibility: 'public',
      is_featured: true,
    });
    expect(featuredPipeline[1].$sort).toEqual({ featured_at: -1, created_at: -1 });

    // Fewer featured books than the limit → the rating fallback still runs.
    const fillerPipeline = mockAggregate.mock.calls[1][0] as Array<Record<string, unknown>>;
    expect(fillerPipeline[1].$sort).toMatchObject({ avg_rating: -1 });

    expect(books.map((b) => b.id)).toEqual(['m-audio', 'm-silent']);
    // Cards carry the retailer links and content_type too.
    expect(books[0].amazon_url).toBe('https://amazon.example/loud');
    expect(books[0].content_type).toBe('book');
    expect(books[1].amazon_url).toBeNull();
  });

  it('skips the fallback query when the rail is already full', async () => {
    mockAggregateToArray.mockResolvedValueOnce([AUDIO_BOOK]);

    const { listFeaturedBooks } = await import('@/lib/data/books');
    const books = await listFeaturedBooks(1);

    expect(books).toHaveLength(1);
    expect(mockAggregate).toHaveBeenCalledTimes(1);
  });
});

describe('listAudiobooks (mongo)', () => {
  it('filters on published+public and a non-empty audio_url', async () => {
    mockAggregateToArray.mockResolvedValue([AUDIO_BOOK, { ...SILENT_BOOK, audio_url: '  ' }]);

    const { listAudiobooks } = await import('@/lib/data/books');
    const entries = await listAudiobooks();

    const pipeline = mockAggregate.mock.calls[0][0] as Array<Record<string, unknown>>;
    expect(pipeline[0].$match).toMatchObject({
      status: 'published',
      visibility: 'public',
      audio_url: { $type: 'string', $ne: '' },
    });

    // A blank audio_url that slipped past the query is still dropped in code.
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      id: 'm-audio',
      title: 'The Loud One',
      author: 'Ada Vox',
      coverUrl: 'https://cdn.example/cover.jpg',
      audioUrl: 'https://cdn.example/sample.mp3',
      narrator: 'Alex Reed',
      durationSec: 1800,
    });
  });
});

describe('fetchAudiobookById (mongo)', () => {
  it('returns null for a published book with no audio', async () => {
    const { fetchAudiobookById } = await import('@/lib/data/books');
    await expect(fetchAudiobookById('m-silent')).resolves.toBeNull();
  });

  it('returns null for a draft book even if it has audio', async () => {
    const { fetchAudiobookById } = await import('@/lib/data/books');
    await expect(fetchAudiobookById('m-draft')).resolves.toBeNull();
    expect(mockGetBookById).toHaveBeenCalledWith('m-draft', {
      status: 'published',
      visibility: 'public',
    });
  });

  it('returns full detail with chapters parsed from audio_toc', async () => {
    const { fetchAudiobookById } = await import('@/lib/data/books');
    const detail = await fetchAudiobookById('m-audio');

    expect(detail).toMatchObject({
      id: 'm-audio',
      title: 'The Loud One',
      cover_url: 'https://cdn.example/cover.jpg',
      audioUrl: 'https://cdn.example/sample.mp3',
      narrator: 'Alex Reed',
      durationSec: 1800,
    });
    expect(detail?.author?.pen_name).toBe('Ada Vox');
    expect(detail?.chapters).toEqual([
      { id: 'ch-0', title: 'Chapter One', start: 0, end: undefined },
      { id: 'ch-1', title: 'Chapter Two', start: 750, end: undefined },
    ]);
    // The detail's raw content row keeps the Supabase `toc` key so existing
    // consumers of AudiobookDetail.content work unchanged.
    expect(detail?.content.toc).toEqual(AUDIO_BOOK.audio_toc);
  });
});
