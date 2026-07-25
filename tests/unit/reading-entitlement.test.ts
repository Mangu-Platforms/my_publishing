/** @jest-environment node */

import { hasCompletedOrderForBook, getCompletedOrderBookIds } from '@/lib/reading/entitlement';

const mockIsMongoPrimary = jest.fn(() => false);
jest.mock('@/lib/db/provider', () => ({
  isMongoPrimary: () => mockIsMongoPrimary(),
  getDatabaseProvider: () => (mockIsMongoPrimary() ? 'mongodb' : 'supabase'),
}));

const mockFindOne = jest.fn();
const mockFindToArray = jest.fn();
jest.mock('@/lib/mongo', () => ({
  getDb: jest.fn(async () => ({
    collection: jest.fn(() => ({
      findOne: (...args: unknown[]) => mockFindOne(...args),
      find: jest.fn(() => ({
        project: jest.fn(() => ({
          toArray: () => mockFindToArray(),
        })),
      })),
    })),
  })),
}));

function makeOrderChain(result: { data: unknown; error: unknown }) {
  const chain = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue(result),
  };
  return chain;
}

function makeListChain(result: { data: unknown; error: unknown }) {
  // .eq() is called twice; the final call resolves as the awaited query.
  const chain = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn(),
  };
  chain.eq.mockReturnValueOnce(chain).mockResolvedValueOnce(result);
  return chain;
}

describe('hasCompletedOrderForBook', () => {
  beforeEach(() => {
    mockIsMongoPrimary.mockReturnValue(false);
    mockFindOne.mockReset();
    mockFindToArray.mockReset();
  });

  it('returns true when a completed order contains the book', async () => {
    const chain = makeOrderChain({ data: { id: 'order-1' }, error: null });
    const admin = { from: jest.fn(() => chain) };

    await expect(hasCompletedOrderForBook(admin as never, 'profile-1', 'book-1')).resolves.toBe(
      true
    );

    expect(admin.from).toHaveBeenCalledWith('orders');
    // Pin the exact join: the !inner modifier is what makes .eq('items.book_id')
    // filter the parent order rows. A plain (non-inner) join would return the
    // order with an empty items array and grant entitlement to any completed
    // order regardless of book.
    expect(chain.select).toHaveBeenCalledWith('id, items:order_items!inner(book_id)');
    expect(chain.eq).toHaveBeenCalledWith('user_id', 'profile-1');
    expect(chain.eq).toHaveBeenCalledWith('status', 'completed');
    expect(chain.eq).toHaveBeenCalledWith('items.book_id', 'book-1');
  });

  it('returns false when no completed entitlement exists', async () => {
    const chain = makeOrderChain({ data: null, error: null });
    const admin = { from: jest.fn(() => chain) };

    await expect(hasCompletedOrderForBook(admin as never, 'profile-1', 'book-1')).resolves.toBe(
      false
    );
  });

  it('fails closed by throwing on query errors', async () => {
    const chain = makeOrderChain({ data: null, error: { message: 'db down' } });
    const admin = { from: jest.fn(() => chain) };

    await expect(hasCompletedOrderForBook(admin as never, 'profile-1', 'book-1')).rejects.toEqual({
      message: 'db down',
    });
  });
});

describe('hasCompletedOrderForBook (mongodb)', () => {
  beforeEach(() => {
    mockIsMongoPrimary.mockReturnValue(true);
    mockFindOne.mockReset();
  });

  it('queries orders by auth user id and embedded order_items', async () => {
    mockFindOne.mockResolvedValue({ _id: 'o1' });
    await expect(
      hasCompletedOrderForBook(null as never, 'profile-1', 'book-1', 'auth-1')
    ).resolves.toBe(true);
    expect(mockFindOne).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'auth-1',
        status: 'completed',
      })
    );
  });

  it('returns false when no mongo order matches', async () => {
    mockFindOne.mockResolvedValue(null);
    await expect(
      hasCompletedOrderForBook(null as never, 'profile-1', 'book-1', 'auth-1')
    ).resolves.toBe(false);
  });
});

describe('getCompletedOrderBookIds', () => {
  beforeEach(() => {
    mockIsMongoPrimary.mockReturnValue(false);
  });

  it('filters orders by profile id and status, returning deduped book ids', async () => {
    const chain = makeListChain({
      data: [
        { items: [{ book_id: 'book-1' }, { book_id: 'book-2' }] },
        { items: [{ book_id: 'book-1' }] },
        { items: null },
      ],
      error: null,
    });
    const client = { from: jest.fn(() => chain) };

    await expect(getCompletedOrderBookIds(client as never, 'profile-1')).resolves.toEqual([
      'book-1',
      'book-2',
    ]);

    expect(client.from).toHaveBeenCalledWith('orders');
    expect(chain.eq).toHaveBeenNthCalledWith(1, 'user_id', 'profile-1');
    expect(chain.eq).toHaveBeenNthCalledWith(2, 'status', 'completed');
  });

  it('returns an empty list when the profile has no completed orders', async () => {
    const chain = makeListChain({ data: [], error: null });
    const client = { from: jest.fn(() => chain) };

    await expect(getCompletedOrderBookIds(client as never, 'profile-1')).resolves.toEqual([]);
  });

  it('throws on query errors', async () => {
    const chain = makeListChain({ data: null, error: { message: 'db down' } });
    const client = { from: jest.fn(() => chain) };

    await expect(getCompletedOrderBookIds(client as never, 'profile-1')).rejects.toEqual({
      message: 'db down',
    });
  });
});
