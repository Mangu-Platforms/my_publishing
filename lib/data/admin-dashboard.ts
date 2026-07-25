/**
 * Dual-run admin dashboard stats (Phoenix WS2d.1).
 * Default: Supabase. Mongo when DATABASE_PROVIDER=mongodb.
 */

import '@/lib/server-only-guard';

import { isMongoPrimary } from '@/lib/db/provider';

export type AdminEngagementActivity = {
  id: string;
  event_type: string;
  created_at: string;
  book: { title: string } | null;
};

export type AdminDashboardStats = {
  totalUsers: number;
  totalBooks: number;
  totalOrders: number;
  recentActivity: AdminEngagementActivity[];
};

export type AdminDashboardStatsResult =
  | { ok: true; data: AdminDashboardStats }
  | { ok: false; error: string };

async function getAdminDashboardStatsFromSupabase(): Promise<AdminDashboardStatsResult> {
  const { createClient } = await import('@/lib/supabase/admin');
  const supabase = createClient();

  const [usersResult, booksResult, ordersResult, activityResult] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('books').select('*', { count: 'exact', head: true }),
    supabase.from('orders').select('*', { count: 'exact', head: true }),
    supabase
      .from('engagement_events')
      .select('*, book:books(title)')
      .order('created_at', { ascending: false })
      .limit(10),
  ]);

  for (const result of [usersResult, booksResult, ordersResult, activityResult]) {
    if (result.error) {
      console.error('[admin] query failed:', result.error);
      return {
        ok: false,
        error: result.error.message || 'Query failed',
      };
    }
  }

  const recentActivity: AdminEngagementActivity[] = (activityResult.data ?? []).map(
    (activity: {
      id: string;
      event_type: string;
      created_at: string;
      book?: { title: string } | null;
    }) => ({
      id: String(activity.id),
      event_type: String(activity.event_type ?? ''),
      created_at: String(activity.created_at ?? ''),
      book: activity.book?.title ? { title: activity.book.title } : null,
    })
  );

  return {
    ok: true,
    data: {
      totalUsers: usersResult.count ?? 0,
      totalBooks: booksResult.count ?? 0,
      totalOrders: ordersResult.count ?? 0,
      recentActivity,
    },
  };
}

async function getMongoRecentEngagement(
  db: Awaited<ReturnType<typeof import('@/lib/mongo').getDb>>
): Promise<AdminEngagementActivity[]> {
  try {
    const existing = await db.listCollections({ name: 'engagement_events' }).toArray();
    if (existing.length === 0) return [];

    const events = await db
      .collection('engagement_events')
      .find({})
      .sort({ created_at: -1 })
      .limit(10)
      .toArray();

    if (events.length === 0) return [];

    const bookIds = [
      ...new Set(
        events
          .map((e) => e.book_id)
          .filter((id): id is string => id != null && String(id).length > 0)
          .map((id) => String(id))
      ),
    ];

    const titleById = new Map<string, string>();
    if (bookIds.length > 0) {
      const { ObjectId } = await import('mongodb');
      const objectIds = bookIds.filter((id) => ObjectId.isValid(id)).map((id) => new ObjectId(id));
      const orFilters: Array<Record<string, unknown>> = [{ _id: { $in: bookIds } }];
      if (objectIds.length) orFilters.push({ _id: { $in: objectIds } });

      const books = await db
        .collection('books')
        .find({ $or: orFilters })
        .project({ title: 1 })
        .toArray();
      for (const book of books) {
        titleById.set(String(book._id), String(book.title ?? 'Unknown book'));
      }
    }

    return events.map((event) => {
      const bookId = event.book_id != null ? String(event.book_id) : '';
      const title = bookId ? titleById.get(bookId) : undefined;
      const created =
        event.created_at instanceof Date
          ? event.created_at.toISOString()
          : String(event.created_at ?? '');
      return {
        id: String(event._id ?? event.id ?? ''),
        event_type: String(event.event_type ?? ''),
        created_at: created,
        book: title ? { title } : null,
      };
    });
  } catch {
    return [];
  }
}

async function getAdminDashboardStatsFromMongo(): Promise<AdminDashboardStatsResult> {
  try {
    const { getDb } = await import('@/lib/mongo');
    const db = await getDb();
    const [totalUsers, totalBooks, totalOrders, recentActivity] = await Promise.all([
      db.collection('profiles').countDocuments({}),
      db.collection('books').countDocuments({}),
      db.collection('orders').countDocuments({}),
      getMongoRecentEngagement(db),
    ]);

    return {
      ok: true,
      data: {
        totalUsers,
        totalBooks,
        totalOrders,
        recentActivity,
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Mongo dashboard query failed';
    return { ok: false, error: message };
  }
}

/**
 * Admin overview counts + recent engagement feed.
 */
export async function getAdminDashboardStats(): Promise<AdminDashboardStatsResult> {
  if (isMongoPrimary()) {
    return getAdminDashboardStatsFromMongo();
  }
  return getAdminDashboardStatsFromSupabase();
}
