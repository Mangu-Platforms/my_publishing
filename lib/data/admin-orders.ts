/**
 * Dual-run admin orders list (Phoenix WS2d.1).
 * Default: Supabase admin client. Mongo when DATABASE_PROVIDER=mongodb.
 * Mongo orders use embedded `order_items`; user email via profiles.auth_user_id.
 */

import '@/lib/server-only-guard';

import { isMongoPrimary } from '@/lib/db/provider';

export type AdminOrderListItem = {
  id: string;
  order_number: string;
  total_amount: number | null;
  status: string;
  created_at: string;
  user: { email: string | null } | null;
};

export type ListAdminOrdersResult = {
  orders: AdminOrderListItem[];
  error: { message: string } | null;
};

const DEFAULT_LIMIT = 50;

/**
 * Admin orders table — newest first, default limit 50.
 * Preserves Supabase shape: `user.email` from profiles join.
 */
export async function listAdminOrders(opts?: { limit?: number }): Promise<ListAdminOrdersResult> {
  const limit = Math.min(100, Math.max(1, Math.floor(opts?.limit ?? DEFAULT_LIMIT)));

  if (isMongoPrimary()) {
    try {
      const { getDb } = await import('@/lib/mongo');
      const db = await getDb();

      const rows = await db
        .collection('orders')
        .aggregate([
          { $sort: { created_at: -1, _id: 1 } },
          { $limit: limit },
          {
            $lookup: {
              from: 'profiles',
              localField: 'user_id',
              foreignField: 'auth_user_id',
              as: '_profiles',
            },
          },
          {
            $addFields: {
              _profile: { $ifNull: [{ $arrayElemAt: ['$_profiles', 0] }, null] },
            },
          },
          {
            $project: {
              order_number: 1,
              amount: 1,
              total_amount: 1,
              status: 1,
              created_at: 1,
              order_items: 1,
              user: {
                email: { $ifNull: ['$_profile.email', null] },
              },
            },
          },
        ])
        .toArray();

      const orders: AdminOrderListItem[] = rows.map((row) => {
        const created =
          row.created_at instanceof Date
            ? row.created_at.toISOString()
            : String(row.created_at ?? '');
        const amount =
          typeof row.total_amount === 'number'
            ? row.total_amount
            : typeof row.amount === 'number'
              ? row.amount
              : null;

        return {
          id: String(row._id),
          order_number: String(row.order_number ?? row._id),
          total_amount: amount,
          status: String(row.status ?? 'pending'),
          created_at: created,
          user: row.user ? { email: (row.user as { email?: string | null }).email ?? null } : null,
        };
      });

      return { orders, error: null };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Mongo admin orders query failed';
      return { orders: [], error: { message } };
    }
  }

  const { createClient } = await import('@/lib/supabase/admin');
  const supabase = createClient();

  const { data, error } = await supabase
    .from('orders')
    .select('id, order_number, total_amount, status, created_at, user:profiles(email)')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    return { orders: [], error: { message: error.message } };
  }

  const orders: AdminOrderListItem[] = ((data as AdminOrderListItem[] | null) || []).map((row) => ({
    id: String(row.id),
    order_number: String(row.order_number ?? row.id),
    total_amount: row.total_amount ?? null,
    status: String(row.status ?? 'pending'),
    created_at: String(row.created_at ?? ''),
    user: row.user ? { email: row.user.email ?? null } : null,
  }));

  return { orders, error: null };
}
