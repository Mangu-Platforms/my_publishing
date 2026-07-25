/** @jest-environment node */

/**
 * Phoenix WS2d.1 Slice E — getBookReviewPage dual-run
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
const mockGetDb = jest.fn(async () => ({
  collection: jest.fn(() => ({
    find: jest.fn(() => ({
      sort: jest.fn(() => ({
        limit: jest.fn(() => ({
          toArray: mockFindToArray,
        })),
      })),
      project: jest.fn(() => ({
        toArray: mockFindToArray,
      })),
      toArray: mockFindToArray,
    })),
    findOne: mockFindOne,
  })),
}));

jest.mock('@/lib/mongo', () => ({
  getDb: (...args: unknown[]) => mockGetDb(...args),
}));

const mockMaybeSingle = jest.fn();
const mockRange = jest.fn();
const mockIn = jest.fn();

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
          },
        ];
        const result = { data: rows, error: null };
        const chain: Record<string, unknown> = {};
        chain.select = () => chain;
        chain.eq = () => chain;
        chain.order = () => chain;
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
              maybeSingle: () => Promise.resolve({ data: null, error: null }),
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
