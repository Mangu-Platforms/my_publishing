/**
 * @jest-environment node
 *
 * Phoenix WS2d.1 — dual-run catalog helpers route on DATABASE_PROVIDER.
 */
import { slugifyGenre } from '@/lib/utils/genre';

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

const mockIsMongoPrimary = jest.fn(() => false);

jest.mock('@/lib/db/provider', () => ({
  isMongoPrimary: () => mockIsMongoPrimary(),
  getDatabaseProvider: () => (mockIsMongoPrimary() ? 'mongodb' : 'supabase'),
}));

jest.mock('@/lib/server-only-guard', () => ({}));

const mockGetFeaturedBooks = jest.fn();
const mockGetTrendingBooks = jest.fn();
const mockGetPlatformStats = jest.fn();
const mockSupabaseGenreCounts = jest.fn();

jest.mock('@/lib/supabase/queries', () => ({
  getFeaturedBooks: (...args: unknown[]) => mockGetFeaturedBooks(...args),
  getTrendingBooks: (...args: unknown[]) => mockGetTrendingBooks(...args),
  getPlatformStats: (...args: unknown[]) => mockGetPlatformStats(...args),
}));

jest.mock('@/lib/supabase/genre-counts', () => ({
  getGenreCounts: (...args: unknown[]) => mockSupabaseGenreCounts(...args),
  slugifyGenre,
}));

const mockGetBookById = jest.fn();
const mockGetBookBySlug = jest.fn();
const mockSearchBooks = jest.fn();

jest.mock('@/lib/mongo-queries', () => ({
  createBook: jest.fn(),
  getBookById: (...args: unknown[]) => mockGetBookById(...args),
  getBookBySlug: (...args: unknown[]) => mockGetBookBySlug(...args),
  getBooks: jest.fn(),
  searchBooks: (...args: unknown[]) => mockSearchBooks(...args),
  updateBook: jest.fn(),
}));

const mockAggregateToArray = jest.fn();
const mockCountDocuments = jest.fn();
const mockGetDb = jest.fn(async () => ({
  collection: jest.fn(() => ({
    aggregate: jest.fn(() => ({ toArray: mockAggregateToArray })),
    countDocuments: mockCountDocuments,
  })),
}));

jest.mock('@/lib/mongo', () => ({
  getDb: (...args: unknown[]) => mockGetDb(...args),
}));

const mockMaybeSingle = jest.fn();
const mockEq = jest.fn();
const mockSelect = jest.fn();
/** Resolves when a list/query chain is awaited (e.g. listAudiobooks `.not(...)`). */
const mockListResult = jest.fn(async () => ({ data: [] as unknown[], error: null }));

jest.mock('@/lib/supabase/public-queries', () => ({
  createPublicCatalogClient: () => ({
    from: () => ({
      select: (...args: unknown[]) => {
        mockSelect(...args);
        const chain: Record<string, unknown> = {};
        chain.eq = (...eqArgs: unknown[]) => {
          mockEq(...eqArgs);
          return chain;
        };
        chain.not = () => chain;
        chain.order = () => chain;
        chain.limit = () => chain;
        chain.maybeSingle = () => mockMaybeSingle();
        chain.single = () => mockMaybeSingle();
        // Thenable so `await supabase.from(...).eq(...).not(...)` resolves.
        chain.then = (onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
          mockListResult().then(onFulfilled, onRejected);
        return chain;
      },
    }),
  }),
  PUBLIC_BOOK_SELECT: '*',
  PUBLIC_BOOK_WITH_CONTENT_SELECT: '*, content:book_content(*)',
  PUBLIC_AUTHOR_COLUMNS:
    'id, profile_id, pen_name, bio, is_verified, total_books, photo_url, created_at, profile:profiles(full_name)',
}));

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    }),
  })),
}));

describe('slugifyGenre (shared util)', () => {
  it('normalizes display names to route slugs', () => {
    expect(slugifyGenre('Sci-Fi')).toBe('sci-fi');
    expect(slugifyGenre("Children's")).toBe('childrens');
    expect(slugifyGenre('Non Fiction')).toBe('non-fiction');
  });
});

describe('listFeaturedBooks dual-run', () => {
  const original = process.env.DATABASE_PROVIDER;

  afterEach(() => {
    mockIsMongoPrimary.mockReset();
    mockIsMongoPrimary.mockReturnValue(false);
    mockGetFeaturedBooks.mockReset();
    mockAggregateToArray.mockReset();
    if (original === undefined) delete process.env.DATABASE_PROVIDER;
    else process.env.DATABASE_PROVIDER = original;
    jest.resetModules();
  });

  it('uses Supabase getFeaturedBooks by default', async () => {
    mockIsMongoPrimary.mockReturnValue(false);
    mockGetFeaturedBooks.mockResolvedValue({
      data: [{ id: '1', title: 'A', slug: 'a', cover_url: null }],
      error: null,
    });

    const { listFeaturedBooks } = await import('@/lib/data/books');
    const books = await listFeaturedBooks(8);
    expect(mockGetFeaturedBooks).toHaveBeenCalledWith(8);
    expect(books).toHaveLength(1);
    expect(books[0].id).toBe('1');
    expect(mockAggregateToArray).not.toHaveBeenCalled();
  });

  it('queries Mongo when DATABASE_PROVIDER=mongodb', async () => {
    mockIsMongoPrimary.mockReturnValue(true);
    mockAggregateToArray.mockResolvedValue([
      {
        _id: 'mongo1',
        title: 'Mongo Book',
        slug: 'mongo-book',
        author_id: 'a1',
        status: 'published',
        visibility: 'public',
        avg_rating: 4.5,
        review_count: 3,
        author: { _id: 'a1', pen_name: 'Ada' },
      },
    ]);

    const { listFeaturedBooks } = await import('@/lib/data/books');
    const books = await listFeaturedBooks(5);
    expect(mockGetFeaturedBooks).not.toHaveBeenCalled();
    expect(mockAggregateToArray).toHaveBeenCalled();
    expect(books).toHaveLength(1);
    expect(books[0].title).toBe('Mongo Book');
    expect(books[0].id).toBe('mongo1');
  });
});

describe('getGenreCounts dual-run', () => {
  afterEach(() => {
    mockIsMongoPrimary.mockReset();
    mockIsMongoPrimary.mockReturnValue(false);
    mockSupabaseGenreCounts.mockReset();
    mockAggregateToArray.mockReset();
    jest.resetModules();
  });

  it('delegates to supabase genre-counts when not mongo', async () => {
    mockIsMongoPrimary.mockReturnValue(false);
    mockSupabaseGenreCounts.mockResolvedValue({ fiction: 2 });
    const { getGenreCounts } = await import('@/lib/data/genres');
    await expect(getGenreCounts()).resolves.toEqual({ fiction: 2 });
    expect(mockSupabaseGenreCounts).toHaveBeenCalled();
  });

  it('aggregates Mongo genres by slug', async () => {
    mockIsMongoPrimary.mockReturnValue(true);
    mockAggregateToArray.mockResolvedValue([
      { _id: 'Fiction', count: 2 },
      { _id: 'Sci-Fi', count: 1 },
    ]);
    const { getGenreCounts } = await import('@/lib/data/genres');
    await expect(getGenreCounts()).resolves.toEqual({ fiction: 2, 'sci-fi': 1 });
  });
});

describe('getPlatformStats dual-run', () => {
  afterEach(() => {
    mockIsMongoPrimary.mockReset();
    mockIsMongoPrimary.mockReturnValue(false);
    mockGetPlatformStats.mockReset();
    mockCountDocuments.mockReset();
    jest.resetModules();
  });

  it('uses supabase stats by default', async () => {
    mockIsMongoPrimary.mockReturnValue(false);
    mockGetPlatformStats.mockResolvedValue({ books: 10, authors: 3 });
    const { getPlatformStats } = await import('@/lib/data/stats');
    await expect(getPlatformStats()).resolves.toEqual({ books: 10, authors: 3 });
  });

  it('counts Mongo collections when primary', async () => {
    mockIsMongoPrimary.mockReturnValue(true);
    mockCountDocuments.mockResolvedValueOnce(7).mockResolvedValueOnce(2);
    const { getPlatformStats } = await import('@/lib/data/stats');
    await expect(getPlatformStats()).resolves.toEqual({ books: 7, authors: 2 });
  });
});

describe('listPublishedBooks search + sort', () => {
  afterEach(() => {
    mockIsMongoPrimary.mockReset();
    mockIsMongoPrimary.mockReturnValue(false);
    mockSearchBooks.mockReset();
    mockAggregateToArray.mockReset();
    jest.resetModules();
  });

  it('uses Mongo searchBooks when q is set', async () => {
    mockIsMongoPrimary.mockReturnValue(true);
    mockSearchBooks.mockResolvedValue({
      items: [
        {
          _id: 's1',
          title: 'Search Hit',
          slug: 'search-hit',
          author_id: 'a1',
          status: 'published',
          visibility: 'public',
          genre: 'Fiction',
        },
      ],
      total: 1,
      page: 1,
      perPage: 20,
    });

    const { listPublishedBooks } = await import('@/lib/data/books');
    const result = await listPublishedBooks({ q: 'Search', page: 1 });
    expect(mockSearchBooks).toHaveBeenCalledWith(
      'Search',
      expect.objectContaining({ status: 'published', visibility: 'public' })
    );
    expect(result.books[0].title).toBe('Search Hit');
  });
});

describe('listFeaturedAuthors dual-run', () => {
  afterEach(() => {
    mockIsMongoPrimary.mockReset();
    mockIsMongoPrimary.mockReturnValue(false);
    jest.resetModules();
  });

  it('queries verified authors from Mongo when primary', async () => {
    mockIsMongoPrimary.mockReturnValue(true);
    const mockFind = jest.fn(() => ({
      sort: jest.fn(() => ({
        limit: jest.fn(() => ({
          toArray: jest.fn(async () => [
            {
              _id: 'a1',
              pen_name: 'Ada',
              bio: null,
              total_books: 3,
              is_verified: true,
            },
          ]),
        })),
      })),
    }));
    mockGetDb.mockResolvedValueOnce({
      collection: jest.fn(() => ({ find: mockFind })),
    });

    const { listFeaturedAuthors } = await import('@/lib/data/authors');
    const authors = await listFeaturedAuthors(4);
    expect(authors).toHaveLength(1);
    expect(authors[0].pen_name).toBe('Ada');
  });
});

describe('listAuthorsForDirectory dual-run', () => {
  afterEach(() => {
    mockIsMongoPrimary.mockReset();
    mockIsMongoPrimary.mockReturnValue(false);
    jest.resetModules();
  });

  it('lists authors from Mongo sorted by total_books when primary', async () => {
    mockIsMongoPrimary.mockReturnValue(true);
    const mockSort = jest.fn(() => ({
      toArray: jest.fn(async () => [
        {
          _id: 'a2',
          profile_id: 'p2',
          pen_name: 'Zed',
          bio: 'Writer',
          total_books: 10,
          is_verified: true,
          photo_url: null,
          created_at: new Date('2026-01-02'),
        },
        {
          _id: 'a1',
          profile_id: 'p1',
          pen_name: 'Ada',
          bio: null,
          total_books: 3,
          is_verified: false,
          photo_url: null,
          created_at: new Date('2026-01-01'),
        },
      ]),
    }));
    const mockFind = jest.fn(() => ({ sort: mockSort }));
    mockGetDb.mockResolvedValueOnce({
      collection: jest.fn(() => ({ find: mockFind })),
    });

    const { listAuthorsForDirectory } = await import('@/lib/data/authors');
    const authors = await listAuthorsForDirectory();
    expect(mockFind).toHaveBeenCalledWith({});
    expect(mockSort).toHaveBeenCalledWith({ total_books: -1 });
    expect(authors).toHaveLength(2);
    expect(authors[0].pen_name).toBe('Zed');
    expect(authors[0].id).toBe('a2');
    expect(authors[0].total_books).toBe(10);
  });
});

describe('getLibraryForAuthUser dual-run', () => {
  afterEach(() => {
    mockIsMongoPrimary.mockReset();
    mockIsMongoPrimary.mockReturnValue(false);
    jest.resetModules();
  });

  it('loads completed mongo orders with embedded items', async () => {
    mockIsMongoPrimary.mockReturnValue(true);
    const orders = [
      {
        _id: 'o1',
        created_at: new Date('2026-01-01'),
        order_items: [{ book_id: 'b1', unit_amount: 9.99, title: 'T' }],
      },
    ];
    const books = [
      {
        _id: 'b1',
        title: 'T',
        slug: 't',
        author_id: 'a1',
        status: 'published',
        visibility: 'public',
        created_at: new Date(),
        updated_at: new Date(),
      },
    ];
    const authors = [{ _id: 'a1', pen_name: 'Ada' }];
    const progress: unknown[] = [];

    mockGetDb.mockResolvedValueOnce({
      collection: jest.fn((name: string) => {
        if (name === 'orders') {
          return {
            find: jest.fn(() => ({
              sort: jest.fn(() => ({
                toArray: jest.fn(async () => orders),
              })),
            })),
          };
        }
        if (name === 'books') {
          return { find: jest.fn(() => ({ toArray: jest.fn(async () => books) })) };
        }
        if (name === 'authors') {
          return { find: jest.fn(() => ({ toArray: jest.fn(async () => authors) })) };
        }
        return {
          find: jest.fn(() => ({
            project: jest.fn(() => ({ toArray: jest.fn(async () => progress) })),
          })),
        };
      }),
    });

    const { getLibraryForAuthUser } = await import('@/lib/data/library');
    const data = await getLibraryForAuthUser('auth-1');
    expect(data.orders).toHaveLength(1);
    expect(data.orders[0].items[0].book?.title).toBe('T');
  });
});

describe('fetchPublishedBookForCheckout dual-run', () => {
  afterEach(() => {
    mockIsMongoPrimary.mockReset();
    mockIsMongoPrimary.mockReturnValue(false);
    mockGetBookById.mockReset();
    mockMaybeSingle.mockReset();
    jest.resetModules();
  });

  it('returns null when neither id nor slug provided', async () => {
    const { fetchPublishedBookForCheckout } = await import('@/lib/data/books');
    await expect(fetchPublishedBookForCheckout({})).resolves.toBeNull();
  });

  it('loads published book from supabase public catalog', async () => {
    mockIsMongoPrimary.mockReturnValue(false);
    mockMaybeSingle.mockResolvedValue({
      data: {
        id: 'b1',
        slug: 'title',
        title: 'Title',
        cover_url: null,
        price: 9.99,
        discount_price: null,
        author: { pen_name: 'Pat', profile: { full_name: 'Pat Lee' } },
      },
      error: null,
    });

    const { fetchPublishedBookForCheckout } = await import('@/lib/data/books');
    const book = await fetchPublishedBookForCheckout({ id: 'b1' });
    expect(book?.title).toBe('Title');
    expect(book?.author?.profile?.full_name).toBe('Pat Lee');
  });

  it('loads published book from mongo with author pen_name', async () => {
    mockIsMongoPrimary.mockReturnValue(true);
    mockGetBookById.mockResolvedValue({
      _id: 'm1',
      title: 'Mongo Title',
      slug: 'mongo-title',
      price: 12,
      cover_url: null,
      status: 'published',
      visibility: 'public',
      author: { pen_name: 'Mongo Author' },
    });

    const { fetchPublishedBookForCheckout } = await import('@/lib/data/books');
    const book = await fetchPublishedBookForCheckout({ id: 'm1' });
    expect(mockGetBookById).toHaveBeenCalledWith('m1', {
      status: 'published',
      visibility: 'public',
    });
    expect(book?.id).toBe('m1');
    expect(book?.author?.pen_name).toBe('Mongo Author');
  });
});
