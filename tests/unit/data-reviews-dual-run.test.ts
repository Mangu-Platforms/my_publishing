/** @jest-environment node */

/**
 * Phoenix WS2d.1 Slice E — getBookReviewPage + listPublicReviewsPage +
 * listMyReviews dual-run
 */

const mockIsMongoPrimary = jest.fn(() => false);

jest.mock('@/lib/db/provider', () => ({
  isMongoPrimary: () => mockIsMongoPrimary(),
  getDatabaseProvider: () => (mockIsMongoPrimary() ? 'mongodb' : 'supabase'),
}));

jest.mock('@/lib/server-only-guard', () => ({}));

jest.mock('mongodb', () => ({
  ObjectId: class ObjectId {
    id: string;
    constructor(id: string = '000000000000000000000000') {
      this.id = id;
    }
    toString() {
      return this.id;
    }
  },
}));

const mockFindToArray = jest.fn();
const mockFindOne = jest.fn();
const mockSkip = jest.fn();
const mockSort = jest.fn();
const mockLimit = jest.fn();

const mockGetDb = jest.fn(async () => ({
  collection: jest.fn(() => ({
    find: jest.fn(() => {
      const chain: Record<string, unknown> = {};
      chain.sort = (...args: unknown[]) => {
        mockSort(...args);
        return chain;
      };
      chain.skip = (...args: unknown[]) => {
        mockSkip(...args);
        return chain;
      };
      chain.limit = (...args: unknown[]) => {
        mockLimit(...args);
        return chain;
      };
      chain.project = () => ({
        toArray: mockFindToArray,
      });
      chain.toArray = mockFindToArray;
      return chain;
    }),
    findOne: mockFindOne,
  })),
}));

jest.mock('@/lib/mongo', () => ({
  getDb: (...args: unknown[]) => mockGetDb(...args),
}));

const mockMaybeSingle = jest.fn();
const mockRange = jest.fn();
const mockIn = jest.fn();
const mockOrder = jest.fn();

jest.mock('@/lib/supabase/admin', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn((table: string) => {
      if (table === 'reviews') {
        const rows = [
          {
            id: 'r1',
            book_id: 'b1',
            user_id: 'u1',
            rating: 5,
            title: null,
            content: 'Great',
            is_spoiler: false,
            is_public: true,
            helpful_count: 2,
            verified_purchase: true,
            author_reply: null,
            author_reply_at: null,
            created_at: '2026-01-01',
            updated_at: '2026-01-01',
            book: {
              id: 'b1',
              slug: 'great-book',
              title: 'Great Book',
              cover_url: null,
            },
          },
        ];
        const result = { data: rows, error: null, count: 1 };
        const chain: Record<string, unknown> = {};
        chain.select = () => chain;
        chain.eq = () => chain;
        chain.order = (...args: unknown[]) => {
          mockOrder(...args);
          return chain;
        };
        chain.range = (...args: unknown[]) => {
          mockRange(...args);
          return Promise.resolve(result);
        };
        chain.maybeSingle = () => mockMaybeSingle();
        // Make the chain thenable so `await query.eq(...)` resolves for stats.
        chain.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
          Promise.resolve(result).then(resolve, reject);
        return chain;
      }
      if (table === 'profiles') {
        return {
          select: () => ({
            in: (...args: unknown[]) => {
              mockIn(...args);
              return Promise.resolve({
                data: [{ user_id: 'u1', full_name: 'Pat' }],
                error: null,
              });
            },
            eq: () => ({
              maybeSingle: () => mockMaybeSingle(),
            }),
          }),
        };
      }
      if (table === 'review_votes') {
        return {
          select: () => ({
            eq: () => ({
              in: () => Promise.resolve({ data: [], error: null }),
            }),
          }),
        };
      }
      return {
        select: () => ({
          eq: () => Promise.resolve({ data: [], error: null }),
        }),
      };
    }),
  })),
}));

describe('getBookReviewPage', () => {
  afterEach(() => {
    mockIsMongoPrimary.mockReset();
    mockIsMongoPrimary.mockReturnValue(false);
    mockFindToArray.mockReset();
    mockFindOne.mockReset();
    mockSkip.mockReset();
    mockSort.mockReset();
    mockLimit.mockReset();
    mockOrder.mockReset();
    mockRange.mockReset();
    jest.resetModules();
  });

  it('loads supabase reviews by default', async () => {
    mockIsMongoPrimary.mockReturnValue(false);
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    const { getBookReviewPage } = await import('@/lib/data/reviews');
    const page = await getBookReviewPage('b1', { authUserId: null });
    expect(page.reviews).toHaveLength(1);
    expect(page.reviews[0].content).toBe('Great');
    expect(page.totalReviews).toBe(1);
    expect(page.averageRating).toBe(5);
  });

  it('aggregates mongo reviews when primary', async () => {
    mockIsMongoPrimary.mockReturnValue(true);
    mockFindToArray
      .mockResolvedValueOnce([
        {
          _id: 'mr1',
          book_id: 'b1',
          user_id: 'auth1',
          rating: 4,
          content: 'Mongo review',
          helpful_count: 1,
          verified_purchase: false,
          created_at: new Date('2026-01-01'),
          updated_at: new Date('2026-01-01'),
        },
      ])
      .mockResolvedValueOnce([{ rating: 4 }])
      .mockResolvedValueOnce([{ auth_user_id: 'auth1', display_name: 'Ada' }]);
    mockFindOne.mockResolvedValue(null);

    const { getBookReviewPage } = await import('@/lib/data/reviews');
    const page = await getBookReviewPage('b1', { authUserId: 'auth1' });
    expect(page.reviews[0].content).toBe('Mongo review');
    expect(page.reviews[0].user.username).toBe('Ada');
    expect(page.isAuthenticated).toBe(true);
  });
});

describe('listPublicReviewsPage', () => {
  afterEach(() => {
    mockIsMongoPrimary.mockReset();
    mockIsMongoPrimary.mockReturnValue(false);
    mockFindToArray.mockReset();
    mockFindOne.mockReset();
    mockSkip.mockReset();
    mockSort.mockReset();
    mockLimit.mockReset();
    mockOrder.mockReset();
    mockRange.mockReset();
    jest.resetModules();
  });

  it('paginates supabase reviews by default with stats and display names', async () => {
    mockIsMongoPrimary.mockReturnValue(false);
    const { listPublicReviewsPage } = await import('@/lib/data/reviews');
    const result = await listPublicReviewsPage({
      bookId: 'b1',
      sort: 'recent',
      page: 1,
      limit: 10,
    });

    expect(mockOrder).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(mockRange).toHaveBeenCalledWith(0, 9);
    expect(result.reviews).toHaveLength(1);
    expect(result.reviews[0].user.username).toBe('Pat');
    expect(result.reviews[0].user.full_name).toBe('Pat');
    expect(result.total).toBe(1);
    expect(result.totalPages).toBe(1);
    expect(result.stats.average).toBe(5);
    expect(result.stats.distribution[5]).toBe(1);
    expect(result.stats.verifiedCount).toBe(1);
  });

  it('paginates mongo reviews when primary (missing is_public ⇒ public)', async () => {
    mockIsMongoPrimary.mockReturnValue(true);
    mockFindToArray
      .mockResolvedValueOnce([
        {
          _id: 'mr2',
          book_id: 'b1',
          user_id: 'auth2',
          rating: 3,
          content: 'Page 2 review',
          // is_public intentionally omitted — must still appear
          helpful_count: 0,
          verified_purchase: true,
          created_at: new Date('2026-02-01'),
          updated_at: new Date('2026-02-01'),
        },
      ])
      .mockResolvedValueOnce([
        { rating: 5, verified_purchase: false },
        { rating: 3, verified_purchase: true },
      ])
      .mockResolvedValueOnce([{ auth_user_id: 'auth2', display_name: 'Bea' }]);

    const { listPublicReviewsPage } = await import('@/lib/data/reviews');
    const result = await listPublicReviewsPage({
      bookId: 'b1',
      sort: 'highest',
      page: 2,
      limit: 5,
    });

    expect(mockSort).toHaveBeenCalledWith({ rating: -1, created_at: -1 });
    expect(mockSkip).toHaveBeenCalledWith(5);
    expect(mockLimit).toHaveBeenCalledWith(5);
    expect(result.reviews).toHaveLength(1);
    expect(result.reviews[0].is_public).toBe(true);
    expect(result.reviews[0].user.username).toBe('Bea');
    expect(result.page).toBe(2);
    expect(result.limit).toBe(5);
    expect(result.total).toBe(2);
    expect(result.totalPages).toBe(1); // Math.max(1, ceil(2/5))
    expect(result.stats.average).toBe(4);
    expect(result.stats.distribution[5]).toBe(1);
    expect(result.stats.distribution[3]).toBe(1);
    expect(result.stats.verifiedCount).toBe(1);
  });
});

describe('listMyReviews', () => {
  afterEach(() => {
    mockIsMongoPrimary.mockReset();
    mockIsMongoPrimary.mockReturnValue(false);
    mockFindToArray.mockReset();
    mockFindOne.mockReset();
    mockSkip.mockReset();
    mockSort.mockReset();
    mockLimit.mockReset();
    mockOrder.mockReset();
    mockMaybeSingle.mockReset();
    jest.resetModules();
  });

  it('loads supabase reviews + profile by default', async () => {
    mockIsMongoPrimary.mockReturnValue(false);
    mockMaybeSingle.mockResolvedValue({ data: { full_name: 'Pat' }, error: null });

    const { listMyReviews } = await import('@/lib/data/reviews');
    const result = await listMyReviews('u1');

    expect(mockOrder).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(result.reviews).toHaveLength(1);
    expect(result.reviews[0].content).toBe('Great');
    expect(result.reviews[0].is_public).toBe(true);
    expect(result.reviews[0].book?.slug).toBe('great-book');
    expect(result.profile.full_name).toBe('Pat');
    expect(result.profile.avatar_url).toBeNull();
  });

  it('loads mongo reviews + profile when primary (missing is_public ⇒ published)', async () => {
    mockIsMongoPrimary.mockReturnValue(true);
    mockFindOne.mockResolvedValue({
      auth_user_id: 'auth1',
      display_name: 'Ada',
      avatar_url: 'https://example.com/a.png',
    });
    mockFindToArray
      .mockResolvedValueOnce([
        {
          _id: 'mr1',
          book_id: '507f1f77bcf86cd799439011',
          user_id: 'auth1',
          rating: 4,
          content: 'My mongo review',
          is_spoiler: false,
          // is_public omitted ⇒ published
          helpful_count: 6,
          created_at: new Date('2026-01-02'),
          updated_at: new Date('2026-01-03'),
        },
        {
          _id: 'mr2',
          book_id: '507f1f77bcf86cd799439011',
          user_id: 'auth1',
          rating: 2,
          content: 'Draft thoughts',
          is_public: false,
          helpful_count: 0,
          created_at: new Date('2026-01-01'),
          updated_at: new Date('2026-01-01'),
        },
      ])
      .mockResolvedValueOnce([
        {
          _id: '507f1f77bcf86cd799439011',
          slug: 'mongo-book',
          title: 'Mongo Book',
          cover_url: null,
        },
      ]);

    const { listMyReviews } = await import('@/lib/data/reviews');
    const result = await listMyReviews('auth1');

    expect(mockSort).toHaveBeenCalledWith({ created_at: -1 });
    expect(result.profile.full_name).toBe('Ada');
    expect(result.profile.avatar_url).toBe('https://example.com/a.png');
    expect(result.reviews).toHaveLength(2);
    expect(result.reviews[0].is_public).toBe(true);
    expect(result.reviews[0].book?.slug).toBe('mongo-book');
    expect(result.reviews[1].is_public).toBe(false);
    expect(result.reviews[1].content).toBe('Draft thoughts');
  });
});
