/**
 * @jest-environment node
 *
 * Phoenix WS2d.1 — dual-run admin dashboard stats.
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
    static isValid(id: string) {
      return /^[a-fA-F0-9]{24}$/.test(id);
    }
  },
}));

const mockCountDocuments = jest.fn();
const mockListCollectionsToArray = jest.fn();
const mockFindToArray = jest.fn();
const mockProjectToArray = jest.fn();

const mockGetDb = jest.fn(async () => ({
  listCollections: jest.fn(() => ({
    toArray: mockListCollectionsToArray,
  })),
  collection: jest.fn((name: string) => {
    if (name === 'engagement_events') {
      const chain: Record<string, unknown> = {};
      chain.sort = () => chain;
      chain.limit = () => chain;
      chain.toArray = mockFindToArray;
      return {
        find: () => chain,
      };
    }
    if (name === 'books') {
      return {
        countDocuments: mockCountDocuments,
        find: () => ({
          project: () => ({
            toArray: mockProjectToArray,
          }),
        }),
      };
    }
    return {
      countDocuments: mockCountDocuments,
    };
  }),
}));

jest.mock('@/lib/mongo', () => ({
  getDb: (...args: unknown[]) => mockGetDb(...args),
}));

const mockFrom = jest.fn();

jest.mock('@/lib/supabase/admin', () => ({
  createClient: jest.fn(() => ({
    from: (...args: unknown[]) => mockFrom(...args),
  })),
}));

function supabaseCountResult(count: number) {
  return Promise.resolve({ data: null, error: null, count });
}

function supabaseActivityResult(
  data: Array<{
    id: string;
    event_type: string;
    created_at: string;
    book: { title: string } | null;
  }>
) {
  const chain: Record<string, unknown> = {};
  chain.select = () => chain;
  chain.order = () => chain;
  chain.limit = () => Promise.resolve({ data, error: null });
  return chain;
}

describe('getAdminDashboardStats dual-run', () => {
  afterEach(() => {
    mockIsMongoPrimary.mockReset();
    mockIsMongoPrimary.mockReturnValue(false);
    mockCountDocuments.mockReset();
    mockListCollectionsToArray.mockReset();
    mockFindToArray.mockReset();
    mockProjectToArray.mockReset();
    mockFrom.mockReset();
    mockGetDb.mockClear();
    jest.resetModules();
  });

  it('uses Supabase counts + engagement by default', async () => {
    mockIsMongoPrimary.mockReturnValue(false);
    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') {
        return { select: () => supabaseCountResult(12) };
      }
      if (table === 'books') {
        return { select: () => supabaseCountResult(4) };
      }
      if (table === 'orders') {
        return { select: () => supabaseCountResult(9) };
      }
      if (table === 'engagement_events') {
        return supabaseActivityResult([
          {
            id: 'e1',
            event_type: 'view',
            created_at: '2026-07-01T00:00:00.000Z',
            book: { title: 'Atlas' },
          },
        ]);
      }
      throw new Error(`unexpected table ${table}`);
    });

    const { getAdminDashboardStats } = await import('@/lib/data/admin-dashboard');
    await expect(getAdminDashboardStats()).resolves.toEqual({
      ok: true,
      data: {
        totalUsers: 12,
        totalBooks: 4,
        totalOrders: 9,
        recentActivity: [
          {
            id: 'e1',
            event_type: 'view',
            created_at: '2026-07-01T00:00:00.000Z',
            book: { title: 'Atlas' },
          },
        ],
      },
    });
    expect(mockGetDb).not.toHaveBeenCalled();
  });

  it('counts Mongo collections and returns [] when engagement_events missing', async () => {
    mockIsMongoPrimary.mockReturnValue(true);
    mockCountDocuments.mockResolvedValueOnce(5).mockResolvedValueOnce(3).mockResolvedValueOnce(2);
    mockListCollectionsToArray.mockResolvedValue([]);

    const { getAdminDashboardStats } = await import('@/lib/data/admin-dashboard');
    await expect(getAdminDashboardStats()).resolves.toEqual({
      ok: true,
      data: {
        totalUsers: 5,
        totalBooks: 3,
        totalOrders: 2,
        recentActivity: [],
      },
    });
    expect(mockFrom).not.toHaveBeenCalled();
  });
});
