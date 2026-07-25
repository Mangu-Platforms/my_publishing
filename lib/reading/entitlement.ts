import type { SupabaseClient } from '@supabase/supabase-js';
import { ObjectId } from 'mongodb';
import { isMongoPrimary } from '@/lib/db/provider';

// NOTE (Supabase): orders.user_id stores profiles.id (FK → profiles.id), NOT the
// auth user id. Callers must resolve auth.uid() → profiles.id before calling.
//
// NOTE (Mongo / Phoenix A-6): Order.user_id is the *auth* user id. When
// DATABASE_PROVIDER=mongodb, pass authUserId (or we resolve it from profiles).

async function resolveAuthUserIdFromProfile(profileId: string): Promise<string | null> {
  const { getDb } = await import('@/lib/mongo');
  const db = await getDb();
  const key = /^[a-fA-F0-9]{24}$/.test(profileId) ? new ObjectId(profileId) : profileId;
  const profile = await db.collection('profiles').findOne({
    $or: [{ _id: key as never }, { auth_user_id: profileId }],
  });
  if (!profile) return null;
  return (profile.auth_user_id as string | undefined) ?? null;
}

function mongoBookIdMatchers(bookId: string): Array<Record<string, unknown>> {
  const matchers: Array<Record<string, unknown>> = [{ 'order_items.book_id': bookId }];
  if (/^[a-fA-F0-9]{24}$/.test(bookId)) {
    matchers.push({ 'order_items.book_id': new ObjectId(bookId) });
  }
  return matchers;
}

/**
 * True when the profile has a completed order containing the book.
 * Fail closed: query errors propagate to the caller.
 *
 * @param authUserId Optional. Required for correct Mongo lookups (A-6). When
 * omitted on Mongo, we resolve profiles.auth_user_id from profileId.
 */
export async function hasCompletedOrderForBook(
  admin: SupabaseClient,
  profileId: string,
  bookId: string,
  authUserId?: string
): Promise<boolean> {
  if (isMongoPrimary()) {
    const userKey = authUserId ?? (await resolveAuthUserIdFromProfile(profileId));
    if (!userKey) return false;

    const { getDb } = await import('@/lib/mongo');
    const db = await getDb();
    const order = await db.collection('orders').findOne({
      user_id: userKey,
      status: 'completed',
      $or: mongoBookIdMatchers(bookId),
    });
    return !!order;
  }

  const { data, error } = await admin
    .from('orders')
    .select('id, items:order_items!inner(book_id)')
    .eq('user_id', profileId)
    .eq('status', 'completed')
    .eq('items.book_id', bookId)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return !!data;
}

/**
 * Book ids contained in the profile's completed orders.
 * Fail closed: query errors propagate to the caller.
 */
export async function getCompletedOrderBookIds(
  client: SupabaseClient,
  profileId: string,
  authUserId?: string
): Promise<string[]> {
  if (isMongoPrimary()) {
    const userKey = authUserId ?? (await resolveAuthUserIdFromProfile(profileId));
    if (!userKey) return [];

    const { getDb } = await import('@/lib/mongo');
    const db = await getDb();
    const orders = await db
      .collection('orders')
      .find({ user_id: userKey, status: 'completed' })
      .project({ order_items: 1 })
      .toArray();

    const bookIds = new Set<string>();
    for (const order of orders) {
      const items = (order.order_items as Array<{ book_id?: unknown }> | undefined) ?? [];
      for (const item of items) {
        if (item.book_id != null) bookIds.add(String(item.book_id));
      }
    }
    return Array.from(bookIds);
  }

  const { data, error } = await client
    .from('orders')
    .select('items:order_items(book_id)')
    .eq('user_id', profileId)
    .eq('status', 'completed');

  if (error) throw error;

  const bookIds = new Set<string>();
  for (const order of data ?? []) {
    const items = (order as { items?: Array<{ book_id: string }> | null }).items ?? [];
    for (const item of items) {
      if (item.book_id) bookIds.add(item.book_id);
    }
  }
  return Array.from(bookIds);
}
