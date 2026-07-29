/**
 * Mongo book mutations for Phoenix WS2c server actions / WS2b API.
 *
 * The admin publishing surface writes through the `*AdminMongo` helpers — the
 * MongoDB half of the provider-aware write path (Task 2.0b). Field names, the
 * status -> visibility rule and slug derivation all come from
 * `@/lib/books/fields` so both providers agree on what a book is.
 */

import '@/lib/server-only-guard';

import { ObjectId, type Db, type Document, type Filter } from 'mongodb';
import { getDb } from '@/lib/mongo';
import {
  MONGO_BOOK_EXTRA_WRITE_FIELDS,
  slugifyBookTitle,
  visibilityForStatus,
  type AdminBookStatus,
  type BookVisibility,
  type ContentType,
} from '@/lib/books/fields';
import { getBookById } from '@/lib/mongo-queries';
import type { Book, BookStatus } from '@/types/mongo';

function coerceId(id: string): ObjectId | string {
  return /^[a-fA-F0-9]{24}$/.test(id) ? new ObjectId(id) : id;
}

/** Driver Filter typings assume ObjectId-only `_id`. */
function asIdFilter(filter: Document): Filter<Document> {
  return filter as unknown as Filter<Document>;
}

async function resolveDb(db?: Db): Promise<Db> {
  return db ?? getDb();
}

export function slugifyTitle(title: string): string {
  return slugifyBookTitle(title);
}

export type CreateMongoBookInput = {
  title: string;
  description?: string;
  cover_url?: string | null;
  manuscript_url?: string | null;
  author_id: string;
  genre?: string;
  tags?: string[];
  price?: number;
  currency?: string;
  status?: BookStatus;
  slug?: string;
};

export type UpdateMongoBookInput = Partial<{
  title: string;
  description: string;
  cover_url: string | null;
  manuscript_url: string | null;
  genre: string;
  tags: string[];
  price: number;
  currency: string;
  status: BookStatus;
  slug: string;
  visibility: Book['visibility'];
}>;

/**
 * Everything the admin book form may write to a Mongo book document.
 *
 * `undefined` means "not supplied, leave the stored value alone"; `null` means
 * "clear it", which is how a blanked-out form field erases a retailer link.
 */
export type AdminBookWriteInput = {
  title?: string;
  slug?: string;
  description?: string | null;
  genre?: string | null;
  price?: number;
  currency?: string;
  status?: AdminBookStatus;
  visibility?: BookVisibility;
  content_type?: ContentType;
  isbn?: string | null;
  cover_url?: string | null;
  epub_url?: string | null;
  manuscript_url?: string | null;
  audio_url?: string | null;
  audio_toc?: unknown;
  audio_narrator?: string | null;
  audio_duration_seconds?: number | null;
  trailer_vimeo_id?: string | null;
  is_featured?: boolean;
  page_count?: number | null;
  word_count?: number | null;
  author_id?: string | null;
  tags?: string[];
  amazon_url?: string | null;
  kindle_url?: string | null;
  apple_books_url?: string | null;
  google_play_books_url?: string | null;
  barnes_noble_url?: string | null;
  audible_url?: string | null;
};

/** Core columns the admin form owns; `author_id` is handled separately (id coercion). */
const BASE_WRITE_FIELDS = [
  'title',
  'slug',
  'description',
  'genre',
  'price',
  'currency',
  'status',
  'visibility',
  'cover_url',
  'manuscript_url',
  'tags',
] as const;

/**
 * `published_at` belongs to the write path, not to the caller: it records the
 * first transition to published, so it is never copied out of form input and
 * never cleared. `featured_at` is the same kind of value and is likewise absent
 * from the shared contract — it is derived from `is_featured` below. Everything
 * else in the contract is caller-writable.
 */
const EXTRA_WRITE_FIELDS: readonly string[] = MONGO_BOOK_EXTRA_WRITE_FIELDS.filter(
  (field) => field !== 'published_at'
);

/**
 * Whitelisted `$set` payload — arbitrary caller keys (`subtitle`, anything a
 * form posts by accident) are dropped rather than persisted.
 */
function buildBookWrite(input: AdminBookWriteInput): Document {
  const $set: Document = {};

  for (const key of BASE_WRITE_FIELDS) {
    const value = input[key];
    if (value !== undefined) $set[key] = value;
  }

  const supplied = input as Record<string, unknown>;
  for (const key of EXTRA_WRITE_FIELDS) {
    if (supplied[key] !== undefined) $set[key] = supplied[key];
  }

  if (input.author_id !== undefined) {
    $set.author_id = input.author_id ? coerceId(input.author_id) : null;
  }

  // The admin UI exposes status only — there is no visibility control — so a
  // published book must derive `visibility: 'public'` or the public catalog
  // queries will never return it.
  if (input.status !== undefined && input.visibility === undefined) {
    $set.visibility = visibilityForStatus(input.status);
  }

  return $set;
}

/**
 * Insert a book from the admin form. Slug is derived from the title unless the
 * caller supplies one, and must be unique across the collection.
 */
export async function createBookAdminMongo(
  input: AdminBookWriteInput & { title: string },
  db?: Db
): Promise<{ book: Book } | { error: string; code: string }> {
  const database = await resolveDb(db);
  const title = input.title.trim();
  if (!title) {
    return { error: 'title is required', code: 'VALIDATION' };
  }

  const slug = (input.slug?.trim() || slugifyBookTitle(title)).slice(0, 120);
  if (!slug) {
    return { error: 'Could not derive slug from title', code: 'VALIDATION' };
  }

  const existing = await database.collection('books').findOne({ slug }, { projection: { _id: 1 } });
  if (existing) {
    return { error: 'A book with this slug already exists', code: 'DUPLICATE_SLUG' };
  }

  const now = new Date();
  const status: AdminBookStatus = input.status ?? 'draft';
  const doc: Document = {
    ...buildBookWrite({ ...input, title, slug, status }),
    description: input.description ?? null,
    cover_url: input.cover_url ?? null,
    manuscript_url: input.manuscript_url ?? null,
    author_id: input.author_id ? coerceId(input.author_id) : null,
    price: input.price ?? 0,
    currency: input.currency ?? 'USD',
    genre: input.genre ?? null,
    tags: input.tags ?? [],
    // Server-owned: counters and timestamps never come from the form.
    avg_rating: 0,
    review_count: 0,
    published_at: status === 'published' ? now : null,
    // `featured_at` is the sort key of the featured rail (listFeaturedBooks
    // sorts { featured_at: -1 }). A book flagged is_featured with no timestamp
    // sorts behind every stamped title, which is how "featured" silently did
    // nothing, so the flag and its timestamp are always written together.
    featured_at: input.is_featured ? now : null,
    created_at: now,
    updated_at: now,
  };

  const result = await database.collection('books').insertOne(doc);
  return { book: { ...doc, _id: result.insertedId } as Book };
}

/**
 * Patch a book from the admin form. Only supplied keys are written.
 */
export async function updateBookAdminMongo(
  id: string,
  patch: AdminBookWriteInput,
  db?: Db
): Promise<{ book: Book } | { error: string; code: string }> {
  const database = await resolveDb(db);
  const _id = coerceId(id);

  if (patch.slug) {
    const clash = await database
      .collection('books')
      .findOne(asIdFilter({ slug: patch.slug, _id: { $ne: _id } }), { projection: { _id: 1 } });
    if (clash) {
      return { error: 'A book with this slug already exists', code: 'DUPLICATE_SLUG' };
    }
  }

  const $set = buildBookWrite(patch);
  $set.updated_at = new Date();

  // `published_at` and `featured_at` both record a FIRST transition, so both
  // need the stored document. ONE read serves both, and nothing is read unless
  // a flag is actually being turned on — unpublishing stays a single write.
  const stampsPublish = patch.status === 'published';
  const stampsFeature = patch.is_featured === true;
  if (stampsPublish || stampsFeature) {
    const current = await database
      .collection('books')
      .findOne(asIdFilter({ _id }), { projection: { published_at: 1, featured_at: 1 } });
    // Unpublishing leaves published_at alone: clearing it would destroy the
    // date the book originally went live, and `visibility` already hides it.
    if (stampsPublish && !current?.published_at) {
      $set.published_at = new Date();
    }
    // Never restamped: re-saving a featured book must not jump it to the front
    // of the rail.
    if (stampsFeature && !current?.featured_at) {
      $set.featured_at = new Date();
    }
  }

  // Un-featuring clears the sort key instead of leaving a stale timestamp.
  if (patch.is_featured === false) {
    $set.featured_at = null;
  }

  const result = await database
    .collection('books')
    .findOneAndUpdate(asIdFilter({ _id }), { $set }, { returnDocument: 'after' });

  const book = result as unknown as Book | null;
  if (!book?._id) {
    return { error: 'Book not found', code: 'NOT_FOUND' };
  }

  return { book };
}

/** Publish / unpublish / archive from the admin list; visibility follows status. */
export async function setBookStatusMongo(
  id: string,
  status: AdminBookStatus,
  db?: Db
): Promise<{ book: Book } | { error: string; code: string }> {
  return updateBookAdminMongo(id, { status }, db);
}

/**
 * Load a book for the admin edit form — deliberately unfiltered. The public
 * lookup pins `status: 'published'` + `visibility: 'public'`, which would 404
 * every draft an admin is trying to edit.
 */
export async function getAdminBookMongo(
  id: string,
  db?: Db
): Promise<(Book & { author?: { _id?: unknown; pen_name?: string | null } | null }) | null> {
  return getBookById(id, {}, db);
}

/** Author options for the admin book form; pen name is the display label. */
export async function listAdminAuthorsMongo(
  db?: Db
): Promise<Array<{ id: string; pen_name: string }>> {
  const database = await resolveDb(db);
  const rows = await database
    .collection('authors')
    .find({}, { projection: { pen_name: 1 } })
    .sort({ pen_name: 1 })
    .toArray();

  return rows.map((row) => ({
    id: String(row._id),
    pen_name: String(row.pen_name ?? 'Author'),
  }));
}

export async function createBookMongo(
  input: CreateMongoBookInput,
  db?: Db
): Promise<{ book: Book } | { error: string; code: string }> {
  return createBookAdminMongo(input, db);
}

export async function updateBookMongo(
  id: string,
  patch: UpdateMongoBookInput,
  db?: Db
): Promise<{ book: Book } | { error: string; code: string }> {
  return updateBookAdminMongo(id, patch, db);
}
