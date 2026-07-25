/** @jest-environment node */

/**
 * Phoenix WS2d.1 — listAdminOrders / listAdminUsers dual-run.
 */

const mockIsMongoPrimary = jest.fn(() => false);

jest.mock('@/lib/db/provider', () => ({
  isMongoPrimary: () => mockIsMongoPrimary(),
  getDatabaseProvider: () => (mockIsMongoPrimary() ? 'mongodb' : 'supabase'),
}));

jest.mock('@/lib/server-only-guard', () => ({}));

const mockAggregateToArray = jest.fn();
const mockFindToArray = jest.fn();
const mockSort = jest.fn();
const mockLimit = jest.fn();
const mockFind = jest.fn();

const mockGetDb = jest.fn(async () => ({
  collection: jest.fn((name: string) => {
    if (name === 'orders') {
      return {
        aggregate: jest.fn(() => ({ toArray: mockAggregateToArray })),
      };
    }
    return {
      find: (...args: unknown[]) => {
        mockFind(...args);
        const chain: Record<string, unknown> = {};
        chain.sort = (...sortArgs: unknown[]) => {
          mockSort(...sortArgs);
          return chain;
        };
        chain.limit = (...limitArgs: unknown[]) => {
          mockLimit(...limitArgs);
          return chain;
        };
        chain.toArray = () => mockFindToArray();
        return chain;
      },
    };
  }),
}));

jest.mock('@/lib/mongo', () => ({
  getDb: (...args: unknown[]) => mockGetDb(...args),
}));

const mockOrdersLimit = jest.fn();
const mockOrdersOrder = jest.fn();
const mockOrdersSelect = jest.fn();
const mockUsersLimit = jest.fn();
const mockUsersOrder = jest.fn();
const mockUsersSelect = jest.fn();

jest.mock('@/lib/supabase/admin', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn((table: string) => {
      if (table === 'orders') {
        const result = {
          data: [
            {
              id: 'o1',
              order_number: 'ORD-1',
              total_amount: 12.5,
              status: 'completed',
              created_at: '2026-01-01T00:00:00.000Z',
              user: { email: 'buyer@example.com' },
            },
          ],
          error: null,
        };
        const chain: Record<string, unknown> = {};
        chain.select = (...args: unknown[]) => {
          mockOrdersSelect(...args);
          return chain;
        };
        chain.order = (...args: unknown[]) => {
          mockOrdersOrder(...args);
          return chain;
        };
        chain.limit = (...args: unknown[]) => {
          mockOrdersLimit(...args);
          return Promise.resolve(result);
        };
        return chain;
      }

      const result = {
        data: [
          {
            id: 'u1',
            email: 'reader@example.com',
            full_name: 'Pat Reader',
            role: 'reader',
            subscription_tier: 'free',
            created_at: '2026-01-02T00:00:00.000Z',
          },
        ],
        error: null,
      };
      const chain: Record<string, unknown> = {};
      chain.select = (...args: unknown[]) => {
        mockUsersSelect(...args);
        return chain;
      };
      chain.order = (...args: unknown[]) => {
        mockUsersOrder(...args);
        return chain;
      };
      chain.limit = (...args: unknown[]) => {
        mockUsersLimit(...args);
        return Promise.resolve(result);
      };
      return chain;
    }),
  })),
}));

describe('listAdminOrders dual-run', () => {
  afterEach(() => {
    mockIsMongoPrimary.mockReset();
    mockIsMongoPrimary.mockReturnValue(false);
    mockAggregateToArray.mockReset();
    mockOrdersSelect.mockReset();
    mockOrdersOrder.mockReset();
    mockOrdersLimit.mockReset();
    jest.resetModules();
  });

  it('uses Supabase admin orders list by default', async () => {
    mockIsMongoPrimary.mockReturnValue(false);
    const { listAdminOrders } = await import('@/lib/data/admin-orders');
    const result = await listAdminOrders({ limit: 50 });

    expect(mockOrdersSelect).toHaveBeenCalledWith(
      'id, order_number, total_amount, status, created_at, user:profiles(email)'
    );
    expect(mockOrdersOrder).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(mockOrdersLimit).toHaveBeenCalledWith(50);
    expect(mockAggregateToArray).not.toHaveBeenCalled();
    expect(result.error).toBeNull();
    expect(result.orders).toHaveLength(1);
    expect(result.orders[0].user?.email).toBe('buyer@example.com');
    expect(result.orders[0].total_amount).toBe(12.5);
  });

  it('queries Mongo orders with profiles lookup when primary', async () => {
    mockIsMongoPrimary.mockReturnValue(true);
    mockAggregateToArray.mockResolvedValue([
      {
        _id: 'mo1',
        order_number: 'M-1',
        amount: 9,
        status: 'completed',
        created_at: new Date('2026-03-01T00:00:00.000Z'),
        order_items: [
          { book_id: 'b1', title: 'Book', quantity: 1, unit_amount: 9, currency: 'usd' },
        ],
        user: { email: 'mongo@example.com' },
      },
    ]);

    const { listAdminOrders } = await import('@/lib/data/admin-orders');
    const result = await listAdminOrders({ limit: 25 });

    expect(mockOrdersLimit).not.toHaveBeenCalled();
    expect(mockAggregateToArray).toHaveBeenCalled();
    expect(result.error).toBeNull();
    expect(result.orders[0]).toEqual({
      id: 'mo1',
      order_number: 'M-1',
      total_amount: 9,
      status: 'completed',
      created_at: '2026-03-01T00:00:00.000Z',
      user: { email: 'mongo@example.com' },
    });
  });
});

describe('listAdminUsers dual-run', () => {
  afterEach(() => {
    mockIsMongoPrimary.mockReset();
    mockIsMongoPrimary.mockReturnValue(false);
    mockFindToArray.mockReset();
    mockFind.mockReset();
    mockSort.mockReset();
    mockLimit.mockReset();
    mockUsersSelect.mockReset();
    mockUsersOrder.mockReset();
    mockUsersLimit.mockReset();
    jest.resetModules();
  });

  it('uses Supabase profiles list by default', async () => {
    mockIsMongoPrimary.mockReturnValue(false);
    const { listAdminUsers } = await import('@/lib/data/admin-users');
    const result = await listAdminUsers({ limit: 50 });

    expect(mockUsersSelect).toHaveBeenCalledWith(
      'id, email, full_name, role, subscription_tier, created_at'
    );
    expect(mockUsersOrder).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(mockUsersLimit).toHaveBeenCalledWith(50);
    expect(mockFind).not.toHaveBeenCalled();
    expect(result.error).toBeNull();
    expect(result.users[0].full_name).toBe('Pat Reader');
    expect(result.users[0].subscription_tier).toBe('free');
  });

  it('queries Mongo profiles and maps display_name when primary', async () => {
    mockIsMongoPrimary.mockReturnValue(true);
    mockFindToArray.mockResolvedValue([
      {
        _id: 'mp1',
        email: 'ada@example.com',
        display_name: 'Ada Lovelace',
        role: 'author',
        created_at: new Date('2026-04-01T00:00:00.000Z'),
      },
    ]);

    const { listAdminUsers } = await import('@/lib/data/admin-users');
    const result = await listAdminUsers({ limit: 10 });

    expect(mockUsersLimit).not.toHaveBeenCalled();
    expect(mockFind).toHaveBeenCalledWith({});
    expect(mockSort).toHaveBeenCalledWith({ created_at: -1, _id: 1 });
    expect(mockLimit).toHaveBeenCalledWith(10);
    expect(result.error).toBeNull();
    expect(result.users[0]).toEqual({
      id: 'mp1',
      email: 'ada@example.com',
      full_name: 'Ada Lovelace',
      role: 'author',
      subscription_tier: null,
      created_at: '2026-04-01T00:00:00.000Z',
    });
  });
});
