/**
 * Dual-run author portal dashboard data (Phoenix WS2d.1).
 * Auth session stays on AUTH_PROVIDER; DB reads gated by DATABASE_PROVIDER.
 * Default: Supabase. Mongo when DATABASE_PROVIDER=mongodb.
 */

import '@/lib/server-only-guard';

import { isMongoPrimary } from '@/lib/db/provider';
import type { Book, Manuscript } from '@/types';

export type AuthorPortalAuthor = {
  id: string;
  profile_id: string;
  pen_name: string;
  bio: string | null;
  is_verified: boolean;
  total_books: number;
  photo_url: string | null;
  created_at: string;
};

export type AuthorDashboardData = {
  author: AuthorPortalAuthor | null;
  books: Book[];
  manuscripts: Manuscript[];
  earnings: number;
};

function iso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  return '';
}

function mapMongoAuthor(row: Record<string, unknown>): AuthorPortalAuthor {
  return {
    id: String(row._id),
    profile_id: row.profile_id != null ? String(row.profile_id) : '',
    pen_name: String(row.pen_name ?? 'Author'),
    bio: (row.bio as string | null | undefined) ?? null,
    is_verified: Boolean(row.is_verified),
    total_books: Number(row.total_books ?? 0),
    photo_url: (row.photo_url as string | null | undefined) ?? null,
    created_at: iso(row.created_at),
  };
}

function mapMongoBook(row: Record<string, unknown>): Book {
  return {
    id: String(row._id),
    title: String(row.title ?? ''),
    slug: String(row.slug ?? ''),
    description: (row.description as string | undefined) ?? undefined,
    cover_url: (row.cover_url as string | null | undefined) ?? undefined,
    author_id: row.author_id != null ? String(row.author_id) : '',
    status: (row.status as Book['status']) ?? 'published',
    visibility: (row.visibility as Book['visibility']) ?? 'public',
    price: typeof row.price === 'number' ? row.price : undefined,
    genre: (row.genre as string | undefined) ?? undefined,
    created_at: iso(row.created_at) || new Date().toISOString(),
    updated_at: iso(row.updated_at) || new Date().toISOString(),
  };
}

async function listAuthorDashboardDataMongo(authUserId: string): Promise<AuthorDashboardData> {
  const { getDb } = await import('@/lib/mongo');
  const { ObjectId } = await import('mongodb');
  const db = await getDb();

  const profile = await db.collection('profiles').findOne({ auth_user_id: authUserId });
  if (!profile) {
    return { author: null, books: [], manuscripts: [], earnings: 0 };
  }

  const profileIdStr = String(profile._id);
  const profileObjectId = /^[a-fA-F0-9]{24}$/.test(profileIdStr)
    ? new ObjectId(profileIdStr)
    : null;
  const authorRow = await db.collection('authors').findOne({
    $or: [
      ...(profileObjectId ? [{ profile_id: profileObjectId }] : []),
      { profile_id: profileIdStr },
      { profile_id: profile._id },
    ],
  });

  if (!authorRow) {
    return { author: null, books: [], manuscripts: [], earnings: 0 };
  }

  const author = mapMongoAuthor(authorRow as Record<string, unknown>);
  const authorIdStr = author.id;
  const authorObjectId = /^[a-fA-F0-9]{24}$/.test(authorIdStr) ? new ObjectId(authorIdStr) : null;

  const bookRows = await db
    .collection('books')
    .find({
      $or: [
        ...(authorObjectId ? [{ author_id: authorObjectId }] : []),
        { author_id: authorIdStr },
        { author_id: authorRow._id },
      ],
    })
    .toArray();

  // Phoenix Mongo schema has no `manuscripts` collection (editorial workflow stays on
  // Supabase until a later parity slice). Return empty rather than probing a missing coll.
  const manuscripts: Manuscript[] = [];

  return {
    author,
    books: bookRows.map((row) => mapMongoBook(row as Record<string, unknown>)),
    manuscripts,
    earnings: 0,
  };
}

async function listAuthorDashboardDataSupabase(authUserId: string): Promise<AuthorDashboardData> {
  const { getAuthorForUser } = await import('@/lib/supabase/portal-queries');
  const { createClient: createAdminClient } = await import('@/lib/supabase/admin');

  const authorRow = await getAuthorForUser(authUserId);
  if (!authorRow) {
    return { author: null, books: [], manuscripts: [], earnings: 0 };
  }

  const author: AuthorPortalAuthor = {
    id: String(authorRow.id),
    profile_id: String(authorRow.profile_id),
    pen_name: String(authorRow.pen_name ?? 'Author'),
    bio: (authorRow.bio as string | null | undefined) ?? null,
    is_verified: Boolean(authorRow.is_verified),
    total_books: Number(authorRow.total_books ?? 0),
    photo_url: (authorRow.photo_url as string | null | undefined) ?? null,
    created_at: String(authorRow.created_at ?? ''),
  };

  const admin = createAdminClient();
  const [{ data: books }, { data: manuscripts }] = await Promise.all([
    admin.from('books').select('*').eq('author_id', author.id),
    admin
      .from('manuscripts')
      .select('*')
      .eq('author_id', author.id)
      .order('created_at', { ascending: false }),
  ]);

  return {
    author,
    books: (books as Book[]) || [],
    manuscripts: (manuscripts as Manuscript[]) || [],
    earnings: 0,
  };
}

/**
 * Load author row + books + manuscripts for the author portal dashboard.
 */
export async function listAuthorDashboardData(authUserId: string): Promise<AuthorDashboardData> {
  if (isMongoPrimary()) {
    return listAuthorDashboardDataMongo(authUserId);
  }
  return listAuthorDashboardDataSupabase(authUserId);
}
