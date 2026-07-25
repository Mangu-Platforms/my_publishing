/**
 * Dual-run book review page data (Phoenix WS2d.1 Slice E / API pagination /
 * my-reviews dashboard).
 * Auth session still from AUTH_PROVIDER; review docs gated by DATABASE_PROVIDER.
 */

import '@/lib/server-only-guard';

import { isMongoPrimary } from '@/lib/db/provider';
import type { ReviewSort } from '@/lib/validations/reviews';

export const REVIEWS_PAGE_SIZE = 10;

export type ReviewUser = {
  id: string;
  username: string;
  full_name?: string;
};

export type BookReview = {
  id: string;
  book_id: string;
  user_id: string;
  rating: number;
  title?: string | null;
  content: string;
  is_spoiler: boolean;
  is_public: boolean;
  helpful_count: number;
  verified_purchase?: boolean;
  author_reply?: string | null;
  author_reply_at?: string | null;
  created_at: string;
  updated_at: string;
  user_vote?: boolean | null;
  user: ReviewUser;
};

export type BookReviewPage = {
  reviews: BookReview[];
  averageRating: number;
  totalReviews: number;
  ratingDistribution: Record<number, number>;
  userReview?: BookReview;
  isAuthenticated: boolean;
  canReply: boolean;
};

export function emptyReviewPage(isAuthenticated = false): BookReviewPage {
  return {
    reviews: [],
    averageRating: 0,
    totalReviews: 0,
    ratingDistribution: {},
    isAuthenticated,
    canReply: false,
  };
}

function iso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  return '';
}

function mapMongoReview(
  row: Record<string, unknown>,
  user: ReviewUser,
  userVote: boolean | null = null
): BookReview {
  return {
    id: String(row._id),
    book_id: String(row.book_id),
    user_id: String(row.user_id),
    rating: Number(row.rating ?? 0),
    title: (row.title as string | null | undefined) ?? null,
    content: String(row.content ?? ''),
    is_spoiler: Boolean(row.is_spoiler ?? false),
    is_public: row.is_public === undefined ? true : Boolean(row.is_public),
    helpful_count: Number(row.helpful_count ?? 0),
    verified_purchase: Boolean(row.verified_purchase),
    author_reply: (row.author_reply as string | null | undefined) ?? null,
    author_reply_at: row.author_reply_at ? iso(row.author_reply_at) : null,
    created_at: iso(row.created_at),
    updated_at: iso(row.updated_at),
    user_vote: userVote,
    user,
  };
}

async function loadMongoReviewPage(
  bookId: string,
  bookAuthorId: string | null | undefined,
  authUserId: string | null
): Promise<BookReviewPage> {
  const { getDb } = await import('@/lib/mongo');
  const { ObjectId } = await import('mongodb');
  const db = await getDb();

  const bookMatchers: unknown[] = [bookId];
  if (/^[a-fA-F0-9]{24}$/.test(bookId)) bookMatchers.push(new ObjectId(bookId));

  const match = {
    book_id: { $in: bookMatchers },
    $or: [{ is_public: true }, { is_public: { $exists: false } }],
  };

  const [pageRows, allRatings] = await Promise.all([
    db
      .collection('reviews')
      .find(match)
      .sort({ helpful_count: -1, created_at: -1 })
      .limit(REVIEWS_PAGE_SIZE)
      .toArray(),
    db.collection('reviews').find(match).project({ rating: 1 }).toArray(),
  ]);

  const distribution: Record<number, number> = {};
  let sum = 0;
  for (const row of allRatings) {
    const rating = Number(row.rating ?? 0);
    sum += rating;
    distribution[rating] = (distribution[rating] || 0) + 1;
  }
  const totalReviews = allRatings.length;
  const averageRating = totalReviews ? sum / totalReviews : 0;

  const userIds = Array.from(new Set(pageRows.map((r) => String(r.user_id))));
  const profiles = userIds.length
    ? await db
        .collection('profiles')
        .find({ auth_user_id: { $in: userIds } })
        .project({ auth_user_id: 1, display_name: 1 })
        .toArray()
    : [];
  const profilesByUserId = new Map(
    profiles.map((p) => {
      const uid = String(p.auth_user_id);
      const name = String(p.display_name || 'Reader');
      return [uid, { id: uid, username: name, full_name: name }] as const;
    })
  );

  // review_votes is Supabase-shaped; skip on Mongo until a collection exists.
  const votesByReviewId = new Map<string, boolean>();

  let canReply = false;
  if (authUserId && bookAuthorId) {
    const profile = await db.collection('profiles').findOne({ auth_user_id: authUserId });
    if (profile) {
      const author = await db.collection('authors').findOne({
        $or: [
          { _id: bookAuthorId as never },
          ...(/^[a-fA-F0-9]{24}$/.test(bookAuthorId)
            ? [{ _id: new ObjectId(bookAuthorId) as never }]
            : []),
          { profile_id: profile._id as never },
          { profile_id: String(profile._id) },
        ],
      });
      canReply = !!author && String(author._id) === String(bookAuthorId);
    }
  }

  const reviews = pageRows.map((row) => {
    const uid = String(row.user_id);
    return mapMongoReview(
      row as Record<string, unknown>,
      profilesByUserId.get(uid) || { id: uid, username: 'Reader' },
      votesByReviewId.get(String(row._id)) ?? null
    );
  });

  let userReview = authUserId ? reviews.find((review) => review.user_id === authUserId) : undefined;
  if (authUserId && !userReview) {
    const own = await db.collection('reviews').findOne({
      book_id: { $in: bookMatchers },
      user_id: authUserId,
    });
    if (own) {
      userReview = mapMongoReview(own as Record<string, unknown>, {
        id: authUserId,
        username: 'You',
      });
    }
  }

  return {
    reviews,
    averageRating,
    totalReviews,
    ratingDistribution: distribution,
    userReview,
    isAuthenticated: !!authUserId,
    canReply,
  };
}

async function loadSupabaseReviewPage(
  bookId: string,
  bookAuthorId: string | null | undefined,
  authUserId: string | null
): Promise<BookReviewPage> {
  const { createClient: createAdminClient } = await import('@/lib/supabase/admin');
  const admin = createAdminClient();
  const emptyStats = { sum: 0, total: 0, distribution: {} as Record<number, number> };

  const { data: reviews, error: reviewsError } = await admin
    .from('reviews')
    .select(
      `
        id,
        book_id,
        user_id,
        rating,
        title,
        content,
        is_spoiler,
        is_public,
        helpful_count,
        verified_purchase,
        author_reply,
        author_reply_at,
        created_at,
        updated_at
      `
    )
    .eq('book_id', bookId)
    .eq('is_public', true)
    .order('helpful_count', { ascending: false })
    .order('created_at', { ascending: false })
    .range(0, REVIEWS_PAGE_SIZE - 1);

  const { data: allRatings, error: statsError } = await admin
    .from('reviews')
    .select('rating')
    .eq('book_id', bookId)
    .eq('is_public', true);

  if (reviewsError || statsError) {
    console.warn('[reviews] supabase query failed; rendering without reviews', {
      reviewsError,
      statsError,
    });
    return emptyReviewPage(!!authUserId);
  }

  const stats = (allRatings || []).reduce((acc, row) => {
    acc.sum += row.rating;
    acc.total += 1;
    acc.distribution[row.rating] = (acc.distribution[row.rating] || 0) + 1;
    return acc;
  }, emptyStats);

  const userIds = Array.from(new Set((reviews || []).map((review) => review.user_id)));
  const { data: profiles } = userIds.length
    ? await admin.from('profiles').select('user_id, full_name').in('user_id', userIds)
    : { data: [] };

  const profilesByUserId = new Map(
    (profiles || []).map((profile) => [
      profile.user_id,
      {
        id: profile.user_id,
        username: profile.full_name || 'Reader',
        full_name: profile.full_name || undefined,
      },
    ])
  );

  const votesByReviewId = new Map<string, boolean>();
  if (authUserId && (reviews || []).length) {
    const { data: votes } = await admin
      .from('review_votes')
      .select('review_id, is_helpful')
      .eq('user_id', authUserId)
      .in(
        'review_id',
        (reviews || []).map((review) => review.id)
      );
    for (const vote of votes || []) {
      votesByReviewId.set(vote.review_id, vote.is_helpful);
    }
  }

  let canReply = false;
  if (authUserId && bookAuthorId) {
    const { data: profile } = await admin
      .from('profiles')
      .select('id')
      .eq('user_id', authUserId)
      .maybeSingle();
    if (profile) {
      const { data: authorRows } = await admin
        .from('authors')
        .select('id')
        .eq('profile_id', profile.id);
      canReply = (authorRows || []).some((row) => row.id === bookAuthorId);
    }
  }

  const normalizedReviews = (reviews || []).map((review) => ({
    ...review,
    user_vote: votesByReviewId.get(review.id) ?? null,
    user: profilesByUserId.get(review.user_id) || {
      id: review.user_id,
      username: 'Reader',
    },
  })) as BookReview[];

  let userReview = normalizedReviews.find((review) => review.user_id === authUserId);
  if (authUserId && !userReview) {
    const { data: ownReview } = await admin
      .from('reviews')
      .select(
        'id, book_id, user_id, rating, title, content, is_spoiler, is_public, helpful_count, verified_purchase, author_reply, author_reply_at, created_at, updated_at'
      )
      .eq('book_id', bookId)
      .eq('user_id', authUserId)
      .maybeSingle();
    if (ownReview) {
      userReview = {
        ...ownReview,
        user_vote: null,
        user: profilesByUserId.get(ownReview.user_id) || {
          id: ownReview.user_id,
          username: 'You',
        },
      };
    }
  }

  return {
    reviews: normalizedReviews,
    averageRating: stats.total ? stats.sum / stats.total : 0,
    totalReviews: stats.total,
    ratingDistribution: stats.distribution,
    userReview,
    isAuthenticated: !!authUserId,
    canReply,
  };
}

/**
 * First page of public reviews + stats for the book PDP.
 * Degrades to empty on failure (never 500 the page).
 */
export async function getBookReviewPage(
  bookId: string,
  opts: { bookAuthorId?: string | null; authUserId?: string | null } = {}
): Promise<BookReviewPage> {
  const authUserId = opts.authUserId ?? null;
  try {
    if (isMongoPrimary()) {
      return await loadMongoReviewPage(bookId, opts.bookAuthorId, authUserId);
    }
    return await loadSupabaseReviewPage(bookId, opts.bookAuthorId, authUserId);
  } catch (error) {
    console.error('[reviews] getBookReviewPage failed; rendering without reviews', error);
    return emptyReviewPage(!!authUserId);
  }
}

// ---------------------------------------------------------------------------
// Public paginated list (GET /api/reviews) — dual-run
// ---------------------------------------------------------------------------

export type PublicReviewsPage = {
  reviews: BookReview[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  stats: {
    average: number;
    total: number;
    distribution: Record<number, number>;
    verifiedCount: number;
  };
};

function mongoSortForPublicReviews(sort: ReviewSort): Record<string, 1 | -1> {
  switch (sort) {
    case 'recent':
      return { created_at: -1 };
    case 'highest':
      return { rating: -1, created_at: -1 };
    case 'lowest':
      return { rating: 1, created_at: -1 };
    case 'helpful':
    default:
      return { helpful_count: -1, created_at: -1 };
  }
}

function buildStatsFromRatings(
  allRatings: Array<{ rating: number; verified_purchase?: boolean | null }>
): PublicReviewsPage['stats'] {
  const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let sum = 0;
  let verifiedCount = 0;
  for (const row of allRatings) {
    const rating = Number(row.rating ?? 0);
    if (rating >= 1 && rating <= 5) {
      distribution[rating] = (distribution[rating] || 0) + 1;
    }
    sum += rating;
    if (row.verified_purchase) verifiedCount += 1;
  }
  const total = allRatings.length;
  return {
    average: total ? Number((sum / total).toFixed(2)) : 0,
    total,
    distribution,
    verifiedCount,
  };
}

async function loadMongoPublicReviewsPage(opts: {
  bookId: string;
  sort: ReviewSort;
  page: number;
  limit: number;
}): Promise<PublicReviewsPage> {
  const { bookId, sort, page, limit } = opts;
  const { getDb } = await import('@/lib/mongo');
  const { ObjectId } = await import('mongodb');
  const db = await getDb();

  const bookMatchers: unknown[] = [bookId];
  if (/^[a-fA-F0-9]{24}$/.test(bookId)) bookMatchers.push(new ObjectId(bookId));

  const match = {
    book_id: { $in: bookMatchers },
    // Missing is_public ⇒ treat as public (parity with getBookReviewPage / transform).
    $or: [{ is_public: true }, { is_public: { $exists: false } }],
  };

  const skip = (page - 1) * limit;
  const sortSpec = mongoSortForPublicReviews(sort);

  const [pageRows, allRatings] = await Promise.all([
    db.collection('reviews').find(match).sort(sortSpec).skip(skip).limit(limit).toArray(),
    db.collection('reviews').find(match).project({ rating: 1, verified_purchase: 1 }).toArray(),
  ]);

  const stats = buildStatsFromRatings(
    allRatings.map((row) => ({
      rating: Number(row.rating ?? 0),
      verified_purchase: Boolean(row.verified_purchase),
    }))
  );
  const total = stats.total;

  const userIds = Array.from(new Set(pageRows.map((r) => String(r.user_id))));
  const profiles = userIds.length
    ? await db
        .collection('profiles')
        .find({ auth_user_id: { $in: userIds } })
        .project({ auth_user_id: 1, display_name: 1 })
        .toArray()
    : [];
  const profilesByUserId = new Map(
    profiles.map((p) => {
      const uid = String(p.auth_user_id);
      const name = String(p.display_name || 'Reader');
      return [uid, { id: uid, username: name, full_name: name }] as const;
    })
  );

  // review_votes is Supabase-shaped; skip on Mongo until a collection exists.
  const reviews = pageRows.map((row) => {
    const uid = String(row.user_id);
    return mapMongoReview(
      row as Record<string, unknown>,
      profilesByUserId.get(uid) || { id: uid, username: 'Reader' },
      null
    );
  });

  return {
    reviews,
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    stats,
  };
}

async function loadSupabasePublicReviewsPage(opts: {
  bookId: string;
  sort: ReviewSort;
  page: number;
  limit: number;
}): Promise<PublicReviewsPage> {
  const { bookId, sort, page, limit } = opts;
  const { createClient: createAdminClient } = await import('@/lib/supabase/admin');
  const admin = createAdminClient();

  let query = admin
    .from('reviews')
    .select(
      `
        id,
        book_id,
        user_id,
        rating,
        title,
        content,
        is_spoiler,
        is_public,
        helpful_count,
        verified_purchase,
        author_reply,
        author_reply_at,
        created_at,
        updated_at
      `,
      { count: 'exact' }
    )
    .eq('book_id', bookId)
    .eq('is_public', true);

  switch (sort) {
    case 'recent':
      query = query.order('created_at', { ascending: false });
      break;
    case 'highest':
      query = query.order('rating', { ascending: false }).order('created_at', { ascending: false });
      break;
    case 'lowest':
      query = query.order('rating', { ascending: true }).order('created_at', { ascending: false });
      break;
    case 'helpful':
    default:
      query = query
        .order('helpful_count', { ascending: false })
        .order('created_at', { ascending: false });
      break;
  }

  const from = (page - 1) * limit;
  const { data: reviewRows, error, count } = await query.range(from, from + limit - 1);
  if (error) throw error;

  const userIds = Array.from(new Set((reviewRows ?? []).map((r) => r.user_id)));
  const { data: profiles } = userIds.length
    ? await admin.from('profiles').select('user_id, full_name').in('user_id', userIds)
    : { data: [] as Array<{ user_id: string; full_name: string | null }> };

  const profilesByUserId = new Map((profiles ?? []).map((p) => [p.user_id, p]));

  const reviews = (reviewRows ?? []).map((review) => {
    const profile = profilesByUserId.get(review.user_id);
    return {
      ...review,
      is_public: review.is_public ?? true,
      user_vote: null as boolean | null,
      user: {
        id: review.user_id,
        username: profile?.full_name || 'Reader',
        full_name: profile?.full_name || undefined,
      },
    } as BookReview;
  });

  const { data: allRatings } = await admin
    .from('reviews')
    .select('rating, verified_purchase')
    .eq('book_id', bookId)
    .eq('is_public', true);

  const stats = buildStatsFromRatings(allRatings ?? []);
  const total = count ?? stats.total;

  return {
    reviews,
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    stats,
  };
}

/**
 * Paginated public reviews + rating stats for GET /api/reviews.
 * Gated by DATABASE_PROVIDER (default supabase). Throws on failure so the
 * route can return 503 — unlike getBookReviewPage which degrades for PDP.
 */
export async function listPublicReviewsPage(opts: {
  bookId: string;
  sort: ReviewSort;
  page: number;
  limit: number;
}): Promise<PublicReviewsPage> {
  const page = opts.page ?? 1;
  const limit = opts.limit ?? REVIEWS_PAGE_SIZE;
  const sort = opts.sort ?? 'helpful';

  if (isMongoPrimary()) {
    return loadMongoPublicReviewsPage({ bookId: opts.bookId, sort, page, limit });
  }
  return loadSupabasePublicReviewsPage({ bookId: opts.bookId, sort, page, limit });
}

// ---------------------------------------------------------------------------
// My Reviews dashboard (/dashboard/my-reviews) — dual-run
// ---------------------------------------------------------------------------

export type MyReviewBook = {
  id: string;
  slug: string;
  title: string;
  cover_url: string | null;
};

export type MyReviewRow = {
  id: string;
  book_id: string;
  user_id: string;
  rating: number;
  /** undefined (not null) so ReviewCard props stay happy */
  title?: string;
  content: string;
  is_spoiler: boolean;
  is_public: boolean;
  helpful_count: number;
  created_at: string;
  updated_at: string;
  book: MyReviewBook | null;
};

export type MyReviewsResult = {
  reviews: MyReviewRow[];
  profile: {
    full_name: string | null;
    avatar_url: string | null;
  };
};

function normalizeBookEmbed(book: unknown): MyReviewBook | null {
  const row = Array.isArray(book) ? book[0] : book;
  if (!row || typeof row !== 'object') return null;
  const b = row as Record<string, unknown>;
  const id = b.id != null ? String(b.id) : '';
  if (!id && !b.slug) return null;
  return {
    id: id || String(b.slug ?? ''),
    slug: String(b.slug ?? ''),
    title: String(b.title ?? ''),
    cover_url: (b.cover_url as string | null | undefined) ?? null,
  };
}

async function listMyReviewsMongo(authUserId: string): Promise<MyReviewsResult> {
  const { getDb } = await import('@/lib/mongo');
  const { ObjectId } = await import('mongodb');
  const db = await getDb();

  const profile = await db.collection('profiles').findOne({ auth_user_id: authUserId });
  const displayName = profile?.display_name != null ? String(profile.display_name) : null;
  const avatarUrl = profile?.avatar_url != null ? String(profile.avatar_url) : null;

  const rows = await db
    .collection('reviews')
    .find({ user_id: authUserId })
    .sort({ created_at: -1 })
    .toArray();

  const bookIds = Array.from(
    new Set(
      rows
        .map((r) => r.book_id)
        .filter((id) => id != null)
        .map((id) => String(id))
    )
  );

  const bookObjectIds = bookIds
    .filter((id) => /^[a-fA-F0-9]{24}$/.test(id))
    .map((id) => new ObjectId(id));

  const bookOr: Record<string, unknown>[] = [];
  if (bookObjectIds.length) bookOr.push({ _id: { $in: bookObjectIds } });
  if (bookIds.length) {
    bookOr.push({ _id: { $in: bookIds } });
    bookOr.push({ slug: { $in: bookIds } });
  }

  const bookRows =
    bookOr.length > 0
      ? await db
          .collection('books')
          .find({ $or: bookOr })
          .project({ _id: 1, slug: 1, title: 1, cover_url: 1 })
          .toArray()
      : [];

  const booksById = new Map<string, MyReviewBook>();
  for (const b of bookRows) {
    const mapped: MyReviewBook = {
      id: String(b._id),
      slug: String(b.slug ?? ''),
      title: String(b.title ?? ''),
      cover_url: (b.cover_url as string | null | undefined) ?? null,
    };
    booksById.set(mapped.id, mapped);
    if (mapped.slug) booksById.set(mapped.slug, mapped);
  }

  const reviews: MyReviewRow[] = rows.map((row) => {
    const bookId = String(row.book_id);
    return {
      id: String(row._id),
      book_id: bookId,
      user_id: String(row.user_id),
      rating: Number(row.rating ?? 0),
      title: (row.title as string | null | undefined) ?? undefined,
      content: String(row.content ?? ''),
      is_spoiler: Boolean(row.is_spoiler ?? false),
      // Missing is_public ⇒ published (parity with public list / transform).
      is_public: row.is_public === undefined ? true : Boolean(row.is_public),
      helpful_count: Number(row.helpful_count ?? 0),
      created_at: iso(row.created_at),
      updated_at: iso(row.updated_at),
      book: booksById.get(bookId) ?? null,
    };
  });

  return {
    reviews,
    profile: {
      full_name: displayName,
      avatar_url: avatarUrl,
    },
  };
}

async function listMyReviewsSupabase(authUserId: string): Promise<MyReviewsResult> {
  const { createClient: createAdminClient } = await import('@/lib/supabase/admin');
  const admin = createAdminClient();

  const [{ data: profile }, { data: reviewRows, error }] = await Promise.all([
    admin.from('profiles').select('full_name').eq('user_id', authUserId).maybeSingle(),
    admin
      .from('reviews')
      .select(
        `
      id,
      book_id,
      user_id,
      rating,
      title,
      content,
      is_spoiler,
      is_public,
      helpful_count,
      created_at,
      updated_at,
      book:books (
        id,
        slug,
        title,
        cover_url
      )
    `
      )
      .eq('user_id', authUserId)
      .order('created_at', { ascending: false }),
  ]);

  if (error) throw error;

  const reviews: MyReviewRow[] = (reviewRows ?? []).map((row) => ({
    id: String(row.id),
    book_id: String(row.book_id),
    user_id: String(row.user_id),
    rating: Number(row.rating ?? 0),
    title: (row.title as string | null | undefined) ?? undefined,
    content: String(row.content ?? ''),
    is_spoiler: Boolean(row.is_spoiler ?? false),
    is_public:
      row.is_public === undefined || row.is_public === null ? true : Boolean(row.is_public),
    helpful_count: Number(row.helpful_count ?? 0),
    created_at: String(row.created_at ?? ''),
    updated_at: String(row.updated_at ?? ''),
    book: normalizeBookEmbed(row.book),
  }));

  return {
    reviews,
    profile: {
      full_name: profile?.full_name ?? null,
      avatar_url: null,
    },
  };
}

/**
 * All reviews authored by `authUserId` (published + drafts) with book embeds.
 * Gated by DATABASE_PROVIDER (default supabase). Auth stays on AUTH_PROVIDER.
 */
export async function listMyReviews(authUserId: string): Promise<MyReviewsResult> {
  if (isMongoPrimary()) {
    return listMyReviewsMongo(authUserId);
  }
  return listMyReviewsSupabase(authUserId);
}
