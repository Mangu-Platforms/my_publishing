/** @jest-environment node */

/**
 * Phoenix WS2d.1 — listAdminBooks dual-run (admin books list).
 */

const mockIsMongoPrimary = jest.fn(() => false);

jest.mock('@/lib/db/provider', () => ({
  isMongoPrimary: () => mockIsMongoPrimary(),
  getDatabaseProvider: () => (mockIsMongoPrimary() ? 'mongodb' : 'supabase'),
}));

jest.mock('@/lib/server-only-guard', () => ({}));

const mockAggregateToArray = jest.fn();
const mockGetDb = jest.fn(async () => ({
  collection: jest.fn(() => ({
    aggregate: jest.fn(() => ({ toArray: mockAggregateToArray })),
  })),
}));

jest.mock('@/lib/mongo', () => ({
  getDb: (...args: unknown[]) => mockGetDb(...args),
}));

const mockIlike = jest.fn();
const mockEq = jest.fn();
const mockRange = jest.fn();
const mockOrder = jest.fn();
const mockSelect = jest.fn();

jest.mock('@/lib/supabase/admin', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => {
      const result = {
        data: [
          {
            id: 'sb1',
            title: 'Supabase Book',
            status: 'published',
            price: 9.99,
            author: { pen_name: 'Ada' },
          },
        ],
        count: 1,
        error: null,
      };
      const chain: Record<string, unknown> = {};
      chain.select = (...args: unknown[]) => {
        mockSelect(...args);
        return chain;
      };
      chain.order = (...args: unknown[]) => {
        mockOrder(...args);
        return chain;
      };
      chain.ilike = (...args: unknown[]) => {
        mockIlike(...args);
        return chain;
      };
      chain.eq = (...args: unknown[]) => {
        mockEq(...args);
        return chain;
      };
      chain.range = (...args: unknown[]) => {
        mockRange(...args);
        return Promise.resolve(result);
      };
      return chain;
    }),
  })),
}));

describe('listAdminBooks dual-run', () => {
  afterEach(() => {
    mockIsMongoPrimary.mockReset();
    mockIsMongoPrimary.mockReturnValue(false);
    mockAggregateToArray.mockReset();
    mockIlike.mockReset();
    mockEq.mockReset();
    mockRange.mockReset();
    mockOrder.mockReset();
    mockSelect.mockReset();
    jest.resetModules();
  });

  it('uses Supabase admin list by default', async () => {
    mockIsMongoPrimary.mockReturnValue(false);
    const { listAdminBooks } = await import('@/lib/data/admin-books');
    const result = await listAdminBooks({
      q: 'Supa',
      status: 'published',
      page: 1,
      perPage: 10,
    });

    expect(mockSelect).toHaveBeenCalledWith('id, title, status, price, author:authors(pen_name)', {
      count: 'exact',
    });
    expect(mockOrder).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(mockIlike).toHaveBeenCalledWith('title', '%Supa%');
    expect(mockEq).toHaveBeenCalledWith('status', 'published');
    expect(mockRange).toHaveBeenCalledWith(0, 9);
    expect(mockAggregateToArray).not.toHaveBeenCalled();
    expect(result.error).toBeNull();
    expect(result.books).toHaveLength(1);
    expect(result.books[0].title).toBe('Supabase Book');
    expect(result.books[0].author?.pen_name).toBe('Ada');
    expect(result.total).toBe(1);
  });

  it('queries Mongo with title regex, status, and author lookup when primary', async () => {
    mockIsMongoPrimary.mockReturnValue(true);
    mockAggregateToArray.mockResolvedValue([
      {
        items: [
          {
            _id: 'mongo1',
            title: 'Mongo Admin Book',
            status: 'draft',
            price: 4.5,
            author: { pen_name: 'Bea' },
          },
        ],
        total: [{ count: 1 }],
      },
    ]);

    const { listAdminBooks } = await import('@/lib/data/admin-books');
    const result = await listAdminBooks({
      q: 'Mongo',
      status: 'draft',
      page: 2,
      perPage: 5,
    });

    expect(mockRange).not.toHaveBeenCalled();
    expect(mockAggregateToArray).toHaveBeenCalled();
    expect(result.error).toBeNull();
    expect(result.page).toBe(2);
    expect(result.perPage).toBe(5);
    expect(result.total).toBe(1);
    expect(result.books[0]).toEqual({
      id: 'mongo1',
      title: 'Mongo Admin Book',
      status: 'draft',
      price: 4.5,
      author: { pen_name: 'Bea' },
    });
  });
});
