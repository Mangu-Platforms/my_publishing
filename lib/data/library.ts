/**
 * Dual-run library (purchased books + progress) — Phoenix WS2d.1 Slice D.
 */

import '@/lib/server-only-guard';

import { isMongoPrimary } from '@/lib/db/provider';
import type { BookWithAuthor } from '@/types';

export type LibraryOrderItem = {
  id: string;
  unit_price: number;
  book: BookWithAuthor | null;
};

export type LibraryOrder = {
  id: string;
  order_number: string;
  created_at: string;
  items: LibraryOrderItem[];
};

export type LibraryProgressRow = {
  book_id: string;
  current_position: number;
  is_finished: boolean;
  last_accessed?: string | null;
};

export type LibraryData = {
  orders: LibraryOrder[];
  progress: LibraryProgressRow[];
};

function mapMongoBook(
  row: Record<string, unknown>,
  author?: Record<string, unknown> | null
): BookWithAuthor {
  const pen = (author?.pen_name as string | undefined) ?? null;
  return {
    id: String(row._id),
    title: String(row.title ?? ''),
    slug: String(row.slug ?? ''),
    description: (row.description as string | undefined) ?? undefined,
    cover_url: (row.cover_url as string | null | undefined) ?? undefined,
    author_id: row.author_id != null ? String(row.author_id) : '',
    status: (row.status as BookWithAuthor['status']) ?? 'published',
    visibility: (row.visibility as BookWithAuthor['visibility']) ?? 'public',
    price: typeof row.price === 'number' ? row.price : undefined,
    genre: (row.genre as string | undefined) ?? undefined,
    created_at:
      row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at ?? ''),
    updated_at:
      row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at ?? ''),
    author: pen
      ? ({
          id: author?._id != null ? String(author._id) : '',
          pen_name: pen,
          profile: { full_name: pen },
        } as BookWithAuthor['author'])
      : null,
  } as BookWithAuthor;
}

/**
 * Load completed orders (with books) + reading progress for an auth user.
 */
export async function getLibraryForAuthUser(authUserId: string): Promise<LibraryData> {
  if (isMongoPrimary()) {
    const { getDb } = await import('@/lib/mongo');
    const { ObjectId } = await import('mongodb');
    const db = await getDb();

    const ordersRaw = await db
      .collection('orders')
      .find({ user_id: authUserId, status: 'completed' })
      .sort({ created_at: -1 })
      .toArray();

    const bookIds = new Set<string>();
    for (const order of ordersRaw) {
      for (const item of (order.order_items as Array<{ book_id?: unknown }>) ?? []) {
        if (item.book_id != null) bookIds.add(String(item.book_id));
      }
    }

    const bookIdList = Array.from(bookIds);
    const objectIds = bookIdList
      .filter((id) => /^[a-fA-F0-9]{24}$/.test(id))
      .map((id) => new ObjectId(id));
    const books = bookIdList.length
      ? await db
          .collection('books')
          .find({
            $or: [
              ...(objectIds.length ? [{ _id: { $in: objectIds } }] : []),
              { _id: { $in: bookIdList as never[] } },
            ],
          })
          .toArray()
      : [];

    const booksById = new Map<string, Record<string, unknown>>();
    const authorIds = new Set<string>();
    for (const b of books) {
      booksById.set(String(b._id), b as Record<string, unknown>);
      if (b.author_id != null) authorIds.add(String(b.author_id));
    }

    const authorIdList = Array.from(authorIds);
    const authorObjectIds = authorIdList
      .filter((id) => /^[a-fA-F0-9]{24}$/.test(id))
      .map((id) => new ObjectId(id));
    const authors = authorIdList.length
      ? await db
          .collection('authors')
          .find({
            $or: [
              ...(authorObjectIds.length ? [{ _id: { $in: authorObjectIds } }] : []),
              { _id: { $in: authorIdList as never[] } },
            ],
          })
          .toArray()
      : [];
    const authorsById = new Map(authors.map((a) => [String(a._id), a as Record<string, unknown>]));

    const orders: LibraryOrder[] = ordersRaw.map((order) => {
      const items = (
        (order.order_items as Array<{ book_id?: unknown; unit_amount?: number; title?: string }>) ??
        []
      ).map((item, idx) => {
        const bid = item.book_id != null ? String(item.book_id) : '';
        const bookRow = booksById.get(bid);
        const author = bookRow?.author_id ? authorsById.get(String(bookRow.author_id)) : null;
        return {
          id: `${String(order._id)}-${idx}`,
          // Transform stores Supabase unit_price as unit_amount (currency units, not cents).
          unit_price: Number(item.unit_amount ?? 0),
          book: bookRow ? mapMongoBook(bookRow, author) : null,
        };
      });

      return {
        id: String(order._id),
        order_number: String((order as { order_number?: string }).order_number ?? order._id),
        created_at:
          order.created_at instanceof Date
            ? order.created_at.toISOString()
            : String(order.created_at ?? ''),
        items,
      };
    });

    const progressRows = await db
      .collection('reading_progress')
      .find({ user_id: authUserId })
      .project({ book_id: 1, current_position: 1, is_finished: 1, last_accessed: 1 })
      .toArray();

    const progress: LibraryProgressRow[] = progressRows.map((row) => ({
      book_id: String(row.book_id),
      current_position: Number(row.current_position ?? 0),
      is_finished: Boolean(row.is_finished),
      last_accessed:
        row.last_accessed instanceof Date
          ? row.last_accessed.toISOString()
          : ((row.last_accessed as string | null | undefined) ?? null),
    }));

    return { orders, progress };
  }

  const { createPublicCatalogClient, PUBLIC_BOOK_SELECT } =
    await import('@/lib/supabase/public-queries');
  const adminClient = createPublicCatalogClient();

  const { data: profile, error: profileError } = await adminClient
    .from('profiles')
    .select('id')
    .eq('user_id', authUserId)
    .maybeSingle();

  if (profileError) {
    throw new Error(`Failed to load library profile: ${profileError.message}`);
  }

  if (!profile) {
    return { orders: [], progress: [] };
  }

  const { data, error: ordersError } = await adminClient
    .from('orders')
    .select(
      `id, order_number, created_at, items:order_items(id, unit_price, book:books(${PUBLIC_BOOK_SELECT}))`
    )
    .eq('user_id', profile.id)
    .eq('status', 'completed')
    .order('created_at', { ascending: false });

  if (ordersError) {
    throw new Error(`Failed to load library orders: ${ordersError.message}`);
  }

  const { data: progressRows, error: progressError } = await adminClient
    .from('reading_progress')
    .select('book_id, current_position, is_finished, last_accessed')
    .eq('user_id', profile.id);

  if (progressError) {
    console.error(`Failed to load reading progress: ${progressError.message}`);
  }

  const orders = (
    (data as Array<{
      id: string;
      order_number: string;
      created_at: string;
      items: Array<{
        id: string;
        unit_price: number;
        book: BookWithAuthor | BookWithAuthor[] | null;
      }>;
    }>) || []
  ).map((order) => ({
    id: order.id,
    order_number: order.order_number,
    created_at: order.created_at,
    items: (order.items || []).map((item) => ({
      id: item.id,
      unit_price: item.unit_price,
      book: Array.isArray(item.book) ? (item.book[0] ?? null) : item.book,
    })),
  }));

  return {
    orders,
    progress: progressError ? [] : (progressRows as LibraryProgressRow[]) || [],
  };
}
