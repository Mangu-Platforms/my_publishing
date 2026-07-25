/**
 * Dual-run admin books list (Phoenix WS2d.1).
 * Default: Supabase admin client. Mongo when DATABASE_PROVIDER=mongodb.
 */

import '@/lib/server-only-guard';

import { isMongoPrimary } from '@/lib/db/provider';

export type AdminBookListItem = {
  id: string;
  title: string;
  status: string;
  price: number | null;
  author: { pen_name: string | null } | null;
};

export type ListAdminBooksResult = {
  books: AdminBookListItem[];
  total: number;
  page: number;
  perPage: number;
  error: { message: string } | null;
};

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Admin books table — optional title search, status filter, pagination.
 * Preserves Supabase shape: `author.pen_name` from authors join.
 */
export async function listAdminBooks(opts: {
  q?: string;
  status?: string;
  page?: number;
  perPage?: number;
}): Promise<ListAdminBooksResult> {
  const page = Math.max(1, Math.floor(opts.page ?? 1));
  const perPage = Math.min(100, Math.max(1, Math.floor(opts.perPage ?? 10)));
  const queryText = opts.q?.trim() || '';
  const status = opts.status && opts.status !== 'all' ? opts.status : undefined;

  if (isMongoPrimary()) {
    try {
      const { getDb } = await import('@/lib/mongo');
      const db = await getDb();
      const match: Record<string, unknown> = {};
      if (queryText) {
        match.title = { $regex: escapeRegex(queryText), $options: 'i' };
      }
      if (status) match.status = status;

      const skip = (page - 1) * perPage;
      const [facet] = await db
        .collection('books')
        .aggregate([
          { $match: match },
          {
            $facet: {
              items: [
                { $sort: { created_at: -1, _id: 1 } },
                { $skip: skip },
                { $limit: perPage },
                {
                  $lookup: {
                    from: 'authors',
                    localField: 'author_id',
                    foreignField: '_id',
                    as: '_authors',
                  },
                },
                {
                  $addFields: {
                    author: { $ifNull: [{ $arrayElemAt: ['$_authors', 0] }, null] },
                  },
                },
                { $project: { _authors: 0 } },
              ],
              total: [{ $count: 'count' }],
            },
          },
        ])
        .toArray();

      const items = (facet?.items ?? []) as Array<{
        _id: unknown;
        title?: string;
        status?: string;
        price?: number | null;
        author?: { pen_name?: string | null } | null;
      }>;
      const total = Number(facet?.total?.[0]?.count ?? 0);

      return {
        books: items.map((b) => ({
          id: String(b._id),
          title: String(b.title ?? ''),
          status: String(b.status ?? 'draft'),
          price: b.price ?? null,
          author: b.author ? { pen_name: b.author.pen_name ?? null } : null,
        })),
        total,
        page,
        perPage,
        error: null,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Mongo admin books query failed';
      return { books: [], total: 0, page, perPage, error: { message } };
    }
  }

  const { createClient } = await import('@/lib/supabase/admin');
  const supabase = createClient();
  const from = (page - 1) * perPage;
  const to = from + perPage - 1;

  let query = supabase
    .from('books')
    .select('id, title, status, price, author:authors(pen_name)', { count: 'exact' })
    .order('created_at', { ascending: false });

  if (queryText) query = query.ilike('title', `%${queryText}%`);
  if (status) query = query.eq('status', status);

  const { data, count, error } = await query.range(from, to);
  if (error) {
    return {
      books: [],
      total: 0,
      page,
      perPage,
      error: { message: error.message },
    };
  }

  const books: AdminBookListItem[] = ((data as AdminBookListItem[] | null) || []).map((row) => ({
    id: String(row.id),
    title: row.title,
    status: row.status,
    price: row.price ?? null,
    author: row.author ? { pen_name: row.author.pen_name ?? null } : null,
  }));

  return {
    books,
    total: count ?? books.length,
    page,
    perPage,
    error: null,
  };
}
