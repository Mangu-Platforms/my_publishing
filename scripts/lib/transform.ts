/**
 * Phoenix P11.2 — pure Supabase → MongoDB transform (Tasks 2.1–2.8).
 *
 * Kept free of I/O so it can be unit-tested; `scripts/transform-data.ts` is the
 * CLI that reads `export/*.json` and writes `export/*_transformed.json`.
 *
 * Output is MongoDB Extended JSON v2 (`{"$oid":…}` / `{"$date":…}`) so that
 * `mongoimport --jsonArray` materialises real ObjectIds and Dates (Task 2.7).
 *
 * THE CARDINAL RULE (North Star #4, R-AUTH-07): password hashes are NEVER
 * migrated. Supabase stores bcrypt; Better Auth expects scrypt `salt:hash`.
 * Every legacy account gets the sentinel `!locked:<uuid>`, which cannot verify
 * against any input, and every legacy user must go through forced reset.
 */

export type ExtendedDate = { $date: string };
export type ExtendedObjectId = { $oid: string };

export const LOCKED_PASSWORD_PREFIX = '!locked:';

export type ManguRole = 'reader' | 'author' | 'partner' | 'admin';
export type MongoBookStatus = 'draft' | 'published' | 'archived';
export type MongoOrderStatus = 'pending' | 'completed' | 'failed' | 'refunded';

// ─── Legacy (Supabase) row shapes ───────────────────────────────────────────
// Only the columns the transform reads are declared; exports are `SELECT *`, so
// unknown extras are tolerated and ignored.

export interface LegacyAuthUser {
  id: string;
  email: string | null;
  email_confirmed_at: string | null;
  created_at: string | null;
  updated_at?: string | null;
  raw_user_meta_data?: Record<string, unknown> | null;
}

export interface LegacyProfile {
  id: string;
  user_id: string | null;
  email?: string | null;
  full_name?: string | null;
  role?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface LegacyAuthor {
  id: string;
  profile_id: string | null;
  pen_name?: string | null;
  bio?: string | null;
  photo_url?: string | null;
  is_verified?: boolean | null;
  total_books?: number | null;
  royalty_rate?: number | string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface LegacyBook {
  id: string;
  title?: string | null;
  slug?: string | null;
  description?: string | null;
  cover_url?: string | null;
  author_id: string | null;
  status?: string | null;
  visibility?: string | null;
  price?: number | string | null;
  genre?: string | null;
  content_type?: string | null;
  published_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

/** One row of the orders ⋈ order_items export (one row per order line). */
export interface LegacyOrderRow {
  order_id: string;
  order_number?: string | null;
  profile_id: string | null;
  total_amount?: number | string | null;
  status?: string | null;
  payment_intent_id?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  order_item_id?: string | null;
  book_id?: string | null;
  unit_price?: number | string | null;
}

export interface LegacyReview {
  id: string;
  book_id: string | null;
  user_id: string | null;
  rating?: number | null;
  title?: string | null;
  content?: string | null;
  helpful_count?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface LegacyReadingProgress {
  id: string;
  user_id: string | null;
  book_id: string | null;
  current_position?: number | string | null;
  is_finished?: boolean | null;
  rating?: number | null;
  finished_at?: string | null;
  last_accessed?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface TransformInput {
  auth_users: LegacyAuthUser[];
  profiles: LegacyProfile[];
  authors: LegacyAuthor[];
  books: LegacyBook[];
  orders_raw: LegacyOrderRow[];
  reviews: LegacyReview[];
  reading_progress: LegacyReadingProgress[];
}

export interface TransformOptions {
  /** Injected for deterministic tests; defaults to a real ObjectId generator. */
  newObjectId: () => string;
  /** Injected for deterministic tests; defaults to crypto.randomUUID. */
  newUuid: () => string;
  /** Timestamp used where a legacy row has no date at all. */
  now: Date;
}

export interface TransformReport {
  counts: Record<string, { in: number; out: number }>;
  orphans: {
    profiles_without_auth_user: string[];
    authors_without_profile: string[];
    books_without_author: string[];
    orders_without_profile: string[];
    order_items_without_book: string[];
    reviews_without_book: string[];
    reviews_without_auth_user: string[];
    reading_progress_without_book: string[];
    reading_progress_without_profile: string[];
  };
  slug_collisions_resolved: Array<{ book_id: string; from: string; to: string }>;
  book_status_remapped: Record<string, number>;
  order_status_remapped: Record<string, number>;
  synthesized_payment_intents: number;
  ratings_recomputed: number;
  locked_accounts: number;
  /** True when every foreign key resolved — the P11.2 gate. */
  zero_unmapped_foreign_keys: boolean;
}

export interface TransformOutput {
  user: Array<Record<string, unknown>>;
  account: Array<Record<string, unknown>>;
  profiles: Array<Record<string, unknown>>;
  authors: Array<Record<string, unknown>>;
  books: Array<Record<string, unknown>>;
  orders: Array<Record<string, unknown>>;
  reviews: Array<Record<string, unknown>>;
  reading_progress: Array<Record<string, unknown>>;
  /** Legacy UUID → new ObjectId hex, per collection (written to _id_map.json). */
  idMap: {
    profiles: Record<string, string>;
    authors: Record<string, string>;
    books: Record<string, string>;
    orders: Record<string, string>;
    reviews: Record<string, string>;
    reading_progress: Record<string, string>;
  };
  report: TransformReport;
}

// ─── Task 2.7 — dates ───────────────────────────────────────────────────────

export function toExtendedDate(value: unknown, fallback?: Date): ExtendedDate | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return { $date: value.toISOString() };
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return { $date: parsed.toISOString() };
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return { $date: new Date(value).toISOString() };
  }
  return fallback ? { $date: fallback.toISOString() } : null;
}

export function oid(hex: string): ExtendedObjectId {
  return { $oid: hex };
}

// ─── Task 2.5 — slugs ───────────────────────────────────────────────────────

/**
 * Ligatures and stroked letters that NFKD does not decompose. Without these,
 * "Æther" would slug to "ther" — the character is dropped rather than folded.
 */
const SLUG_TRANSLITERATIONS: ReadonlyArray<[RegExp, string]> = [
  [/[Ææ]/g, 'ae'],
  [/[Œœ]/g, 'oe'],
  [/ß/g, 'ss'],
  [/[Øø]/g, 'o'],
  [/[ĐđÐð]/g, 'd'],
  [/[Þþ]/g, 'th'],
  [/[Łł]/g, 'l'],
  [/[Ħħ]/g, 'h'],
  [/[Ŧŧ]/g, 't'],
];

export function slugify(input: string): string {
  let value = input;
  for (const [pattern, replacement] of SLUG_TRANSLITERATIONS) {
    value = value.replace(pattern, replacement);
  }
  const base = value
    .normalize('NFKD')
    // Drop the combining marks NFKD split off, folding "é" to "e".
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base || 'untitled';
}

/**
 * Hands out slugs that are unique across the whole run. A legacy slug is kept
 * verbatim when free; otherwise `-2`, `-3`, … is appended (Task 2.5).
 */
export function createSlugAllocator(): {
  allocate: (preferred: string | null | undefined, fallbackTitle: string) => string;
  wasCollision: (slug: string) => boolean;
} {
  const taken = new Set<string>();
  const collided = new Set<string>();

  return {
    allocate(preferred, fallbackTitle) {
      const desired = slugify(
        preferred && preferred.trim() !== '' ? preferred : (fallbackTitle ?? '')
      );
      if (!taken.has(desired)) {
        taken.add(desired);
        return desired;
      }
      let n = 2;
      while (taken.has(`${desired}-${n}`)) n += 1;
      const resolved = `${desired}-${n}`;
      taken.add(resolved);
      collided.add(resolved);
      return resolved;
    },
    wasCollision(slug) {
      return collided.has(slug);
    },
  };
}

// ─── Enum narrowing ─────────────────────────────────────────────────────────

/**
 * Supabase books.status allows draft|submitted|review|accepted|published|archived;
 * Mongo BookStatus allows only draft|published|archived. The three editorial
 * in-flight states collapse to `draft` so nothing unpublished leaks into the
 * public catalog.
 */
export function mapBookStatus(status: string | null | undefined): MongoBookStatus {
  switch ((status ?? '').toLowerCase()) {
    case 'published':
      return 'published';
    case 'archived':
      return 'archived';
    case 'submitted':
    case 'review':
    case 'accepted':
    case 'draft':
    case '':
      return 'draft';
    default:
      return 'draft';
  }
}

/**
 * Supabase orders.status allows pending|processing|completed|cancelled|refunded;
 * Mongo OrderStatus allows pending|completed|failed|refunded.
 */
export function mapOrderStatus(status: string | null | undefined): MongoOrderStatus {
  switch ((status ?? '').toLowerCase()) {
    case 'completed':
      return 'completed';
    case 'refunded':
      return 'refunded';
    case 'cancelled':
    case 'canceled':
    case 'failed':
      return 'failed';
    case 'processing':
    case 'pending':
    case '':
      return 'pending';
    default:
      return 'pending';
  }
}

export function normalizeRole(role: string | null | undefined): ManguRole {
  const value = (role ?? '').toLowerCase();
  if (value === 'author' || value === 'partner' || value === 'admin') return value;
  // `editor` was removed in Phoenix v4.0.1; any legacy value degrades to reader.
  return 'reader';
}

export function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

/** Display name from Supabase's raw_user_meta_data, which has no fixed shape. */
export function nameFromMetadata(meta: Record<string, unknown> | null | undefined): string {
  if (!meta) return '';
  for (const key of ['full_name', 'name', 'display_name', 'user_name']) {
    const value = meta[key];
    if (typeof value === 'string' && value.trim() !== '') return value.trim();
  }
  return '';
}

// ─── Task 2.1–2.8 — the transform ───────────────────────────────────────────

export function transform(input: TransformInput, options: TransformOptions): TransformOutput {
  const { newObjectId, newUuid, now } = options;

  const report: TransformReport = {
    counts: {},
    orphans: {
      profiles_without_auth_user: [],
      authors_without_profile: [],
      books_without_author: [],
      orders_without_profile: [],
      order_items_without_book: [],
      reviews_without_book: [],
      reviews_without_auth_user: [],
      reading_progress_without_book: [],
      reading_progress_without_profile: [],
    },
    slug_collisions_resolved: [],
    book_status_remapped: {},
    order_status_remapped: {},
    synthesized_payment_intents: 0,
    ratings_recomputed: 0,
    locked_accounts: 0,
    zero_unmapped_foreign_keys: true,
  };

  const bump = (bucket: Record<string, number>, key: string) => {
    bucket[key] = (bucket[key] ?? 0) + 1;
  };

  // ── Task 2.2 — user docs ──────────────────────────────────────────────────
  // `_id` is the legacy UUID string. The Better Auth Mongo adapter tries
  // `new ObjectId(value)` for id fields and falls back to the raw string when
  // that throws — which it always does for a 36-char UUID — so `user.id` comes
  // back as the original UUID. P11.3 is the gate that proves this round-trips.
  const authUserIds = new Set<string>();
  const user: Array<Record<string, unknown>> = [];
  const account: Array<Record<string, unknown>> = [];

  for (const row of input.auth_users) {
    if (!row?.id) continue;
    authUserIds.add(row.id);

    const createdAt = toExtendedDate(row.created_at, now);
    const updatedAt = toExtendedDate(row.updated_at ?? row.created_at, now);

    user.push({
      _id: row.id,
      email: (row.email ?? '').toLowerCase(),
      emailVerified: row.email_confirmed_at != null,
      name: nameFromMetadata(row.raw_user_meta_data),
      role: 'reader', // Overwritten below from the profile, which is authoritative.
      createdAt,
      updatedAt,
    });

    // ── Task 2.3 — locked credential account. NEVER a real hash. ────────────
    account.push({
      _id: oid(newObjectId()),
      accountId: row.id,
      providerId: 'credential',
      userId: row.id,
      password: `${LOCKED_PASSWORD_PREFIX}${newUuid()}`,
      createdAt,
      updatedAt,
    });
    report.locked_accounts += 1;
  }

  // ── Task 2.4 — profiles, and the UUID → ObjectId map ─────────────────────
  const profileIdMap: Record<string, string> = {};
  const profileToAuthUser: Record<string, string> = {};
  const roleByAuthUser: Record<string, ManguRole> = {};
  const profiles: Array<Record<string, unknown>> = [];

  for (const row of input.profiles) {
    if (!row?.id) continue;
    const hex = newObjectId();
    profileIdMap[row.id] = hex;

    const authUserId = row.user_id;
    if (!authUserId || !authUserIds.has(authUserId)) {
      report.orphans.profiles_without_auth_user.push(row.id);
      report.zero_unmapped_foreign_keys = false;
    } else {
      profileToAuthUser[row.id] = authUserId;
    }

    const role = normalizeRole(row.role);
    if (authUserId) roleByAuthUser[authUserId] = role;

    profiles.push({
      _id: oid(hex),
      auth_user_id: authUserId,
      display_name: row.full_name ?? '',
      role,
      email: (row.email ?? '').toLowerCase() || undefined,
      created_at: toExtendedDate(row.created_at, now),
      updated_at: toExtendedDate(row.updated_at ?? row.created_at, now),
    });
  }

  // The profile's role is authoritative over the `reader` default written above.
  for (const doc of user) {
    const id = doc._id as string;
    if (roleByAuthUser[id]) doc.role = roleByAuthUser[id];
  }

  // ── Task 2.5 — authors ───────────────────────────────────────────────────
  const authorIdMap: Record<string, string> = {};
  const authors: Array<Record<string, unknown>> = [];

  for (const row of input.authors) {
    if (!row?.id) continue;
    const hex = newObjectId();
    authorIdMap[row.id] = hex;

    const profileHex = row.profile_id ? profileIdMap[row.profile_id] : undefined;
    if (!profileHex) {
      report.orphans.authors_without_profile.push(row.id);
      report.zero_unmapped_foreign_keys = false;
    }

    authors.push({
      _id: oid(hex),
      profile_id: profileHex ? oid(profileHex) : null,
      pen_name: row.pen_name ?? '',
      bio: row.bio ?? null,
      photo_url: row.photo_url ?? null,
      is_verified: Boolean(row.is_verified),
      total_books: toNumber(row.total_books, 0),
      royalty_rate: toNumber(row.royalty_rate, 0),
      created_at: toExtendedDate(row.created_at, now),
      updated_at: toExtendedDate(row.updated_at ?? row.created_at, now),
    });
  }

  // ── Task 2.5 — books, unique slugs, rating fields ────────────────────────
  const bookIdMap: Record<string, string> = {};
  const bookTitles: Record<string, string> = {};
  const slugs = createSlugAllocator();
  const books: Array<Record<string, unknown>> = [];

  for (const row of input.books) {
    if (!row?.id) continue;
    const hex = newObjectId();
    bookIdMap[row.id] = hex;

    const title = row.title ?? '';
    bookTitles[row.id] = title;

    const legacySlug = row.slug ?? null;
    const slug = slugs.allocate(legacySlug, title);
    if (slugs.wasCollision(slug)) {
      report.slug_collisions_resolved.push({
        book_id: row.id,
        from: legacySlug ?? slugify(title),
        to: slug,
      });
    }

    const authorHex = row.author_id ? authorIdMap[row.author_id] : undefined;
    if (!authorHex) {
      // Supabase sets books.author_id NULL when an author is deleted, so this is
      // reachable with clean data. Reported, and surfaced by P11.5 as its own
      // check rather than silently failing referential integrity.
      report.orphans.books_without_author.push(row.id);
    }

    const status = mapBookStatus(row.status);
    if (status !== (row.status ?? 'draft'))
      bump(report.book_status_remapped, `${row.status}→${status}`);

    books.push({
      _id: oid(hex),
      title,
      slug,
      description: row.description ?? null,
      cover_url: row.cover_url ?? null,
      // Populated by WS3.4 migrate-storage from book_content after import.
      manuscript_url: null,
      author_id: authorHex ? oid(authorHex) : null,
      status,
      visibility: row.visibility === 'private' ? 'private' : 'public',
      price: toNumber(row.price, 0),
      currency: 'usd',
      genre: row.genre ?? null,
      content_type:
        row.content_type === 'comic' || row.content_type === 'paper' ? row.content_type : 'book',
      // Task 2.5 initialises these to 0; the recompute pass below fills in the
      // real values from the migrated reviews so the catalog does not show every
      // book as unrated the moment cutover completes.
      avg_rating: 0,
      review_count: 0,
      published_at: toExtendedDate(row.published_at) ?? null,
      created_at: toExtendedDate(row.created_at, now),
      updated_at: toExtendedDate(row.updated_at ?? row.created_at, now),
    });
  }

  // ── Task 2.6 — orders, flattened to embedded order_items[] ───────────────
  // Mongo Order.user_id is the *auth* user id (see the webhook handler), while
  // Supabase orders.user_id is a profiles.id — hence the remap.
  const orderIdMap: Record<string, string> = {};
  const orderGroups = new Map<string, LegacyOrderRow[]>();
  for (const row of input.orders_raw) {
    if (!row?.order_id) continue;
    const group = orderGroups.get(row.order_id);
    if (group) group.push(row);
    else orderGroups.set(row.order_id, [row]);
  }

  const orders: Array<Record<string, unknown>> = [];
  /** authUserId → set of book ObjectId hex, for review verified_purchase. */
  const purchasedBooksByUser = new Map<string, Set<string>>();

  for (const [orderId, rows] of orderGroups) {
    const head = rows[0];
    const hex = newObjectId();
    orderIdMap[orderId] = hex;

    const authUserId = head.profile_id ? profileToAuthUser[head.profile_id] : undefined;
    if (!authUserId) {
      report.orphans.orders_without_profile.push(orderId);
      report.zero_unmapped_foreign_keys = false;
    }

    // Collapse repeat lines for the same book into a quantity.
    const itemsByBook = new Map<string, { bookHex: string; quantity: number; unit: number }>();
    for (const row of rows) {
      if (!row.book_id) continue; // LEFT JOIN produced a bare order with no items
      const bookHex = bookIdMap[row.book_id];
      if (!bookHex) {
        report.orphans.order_items_without_book.push(`${orderId}:${row.book_id}`);
        report.zero_unmapped_foreign_keys = false;
        continue;
      }
      const existing = itemsByBook.get(row.book_id);
      if (existing) existing.quantity += 1;
      else
        itemsByBook.set(row.book_id, {
          bookHex,
          quantity: 1,
          unit: toNumber(row.unit_price, 0),
        });

      if (authUserId) {
        const owned = purchasedBooksByUser.get(authUserId) ?? new Set<string>();
        owned.add(bookHex);
        purchasedBooksByUser.set(authUserId, owned);
      }
    }

    const status = mapOrderStatus(head.status);
    if (status !== (head.status ?? 'pending'))
      bump(report.order_status_remapped, `${head.status}→${status}`);

    // The unique sparse index on stripe_payment_intent_id is what keeps the
    // Stripe webhook idempotent. Legacy rows predating Stripe have no intent, so
    // a stable synthetic key derived from the order keeps the invariant intact.
    let paymentIntent = head.payment_intent_id ?? null;
    if (!paymentIntent) {
      paymentIntent = `legacy:${head.order_number ?? orderId}`;
      report.synthesized_payment_intents += 1;
    }

    orders.push({
      _id: oid(hex),
      user_id: authUserId ?? null,
      status,
      amount: toNumber(head.total_amount, 0),
      currency: 'usd',
      order_items: Array.from(itemsByBook.entries()).map(([legacyBookId, item]) => ({
        book_id: oid(item.bookHex),
        title: bookTitles[legacyBookId] ?? '',
        quantity: item.quantity,
        unit_amount: item.unit,
        currency: 'usd',
      })),
      stripe_payment_intent_id: paymentIntent,
      stripe_session_id: null,
      created_at: toExtendedDate(head.created_at, now),
      updated_at: toExtendedDate(head.updated_at ?? head.created_at, now),
    });
  }

  // ── reviews ──────────────────────────────────────────────────────────────
  const reviewIdMap: Record<string, string> = {};
  const reviews: Array<Record<string, unknown>> = [];
  const ratingTotals = new Map<string, { sum: number; count: number }>();

  for (const row of input.reviews) {
    if (!row?.id) continue;
    const bookHex = row.book_id ? bookIdMap[row.book_id] : undefined;
    if (!bookHex) {
      report.orphans.reviews_without_book.push(row.id);
      report.zero_unmapped_foreign_keys = false;
      continue;
    }
    if (!row.user_id || !authUserIds.has(row.user_id)) {
      report.orphans.reviews_without_auth_user.push(row.id);
      report.zero_unmapped_foreign_keys = false;
      continue;
    }

    const hex = newObjectId();
    reviewIdMap[row.id] = hex;
    const rating = toNumber(row.rating, 0);

    reviews.push({
      _id: oid(hex),
      book_id: oid(bookHex),
      user_id: row.user_id,
      rating,
      title: row.title ?? undefined,
      content: row.content ?? undefined,
      helpful_count: toNumber(row.helpful_count, 0),
      verified_purchase: purchasedBooksByUser.get(row.user_id)?.has(bookHex) ?? false,
      created_at: toExtendedDate(row.created_at, now),
      updated_at: toExtendedDate(row.updated_at ?? row.created_at, now),
    });

    if (rating > 0) {
      const totals = ratingTotals.get(bookHex) ?? { sum: 0, count: 0 };
      totals.sum += rating;
      totals.count += 1;
      ratingTotals.set(bookHex, totals);
    }
  }

  // Same aggregation WS2c performs after a review mutation, applied once here so
  // imported books already agree with their imported reviews.
  for (const book of books) {
    const id = (book._id as ExtendedObjectId).$oid;
    const totals = ratingTotals.get(id);
    if (!totals || totals.count === 0) continue;
    book.avg_rating = Math.round((totals.sum / totals.count) * 100) / 100;
    book.review_count = totals.count;
    report.ratings_recomputed += 1;
  }

  // ── reading_progress ─────────────────────────────────────────────────────
  const readingProgressIdMap: Record<string, string> = {};
  const reading_progress: Array<Record<string, unknown>> = [];

  for (const row of input.reading_progress) {
    if (!row?.id) continue;
    const bookHex = row.book_id ? bookIdMap[row.book_id] : undefined;
    if (!bookHex) {
      report.orphans.reading_progress_without_book.push(row.id);
      report.zero_unmapped_foreign_keys = false;
      continue;
    }
    // reading_progress.user_id references profiles(id), not auth.users.
    const authUserId = row.user_id ? profileToAuthUser[row.user_id] : undefined;
    if (!authUserId) {
      report.orphans.reading_progress_without_profile.push(row.id);
      report.zero_unmapped_foreign_keys = false;
      continue;
    }

    const hex = newObjectId();
    readingProgressIdMap[row.id] = hex;

    reading_progress.push({
      _id: oid(hex),
      user_id: authUserId,
      book_id: oid(bookHex),
      current_position: toNumber(row.current_position, 0),
      is_finished: Boolean(row.is_finished),
      rating: row.rating == null ? null : toNumber(row.rating, 0),
      finished_at: toExtendedDate(row.finished_at) ?? null,
      last_accessed: toExtendedDate(row.last_accessed, now),
      created_at: toExtendedDate(row.created_at, now),
      updated_at: toExtendedDate(row.updated_at ?? row.created_at, now),
    });
  }

  // ── Task 2.8 — report ────────────────────────────────────────────────────
  report.counts = {
    user: { in: input.auth_users.length, out: user.length },
    account: { in: input.auth_users.length, out: account.length },
    profiles: { in: input.profiles.length, out: profiles.length },
    authors: { in: input.authors.length, out: authors.length },
    books: { in: input.books.length, out: books.length },
    orders: { in: orderGroups.size, out: orders.length },
    reviews: { in: input.reviews.length, out: reviews.length },
    reading_progress: { in: input.reading_progress.length, out: reading_progress.length },
  };

  return {
    user,
    account,
    profiles,
    authors,
    books,
    orders,
    reviews,
    reading_progress,
    idMap: {
      profiles: profileIdMap,
      authors: authorIdMap,
      books: bookIdMap,
      orders: orderIdMap,
      reviews: reviewIdMap,
      reading_progress: readingProgressIdMap,
    },
    report,
  };
}
