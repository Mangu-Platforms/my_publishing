/**
 * Canonical book field contract (Task 1.0 / Task 2.0b).
 *
 * Every book write path and every catalog read path imports its field
 * definitions from this module. Before this existed, the six retailer URL
 * fields were spelled out independently in `lib/actions/books.ts`, in the admin
 * edit form and in the product detail page, and the MongoDB catalog path simply
 * omitted them — so "save a retailer link" meant different things depending on
 * `DATABASE_PROVIDER`.
 *
 * This module is intentionally dependency-free and pure: it is imported by
 * server actions, by Edge-safe code paths and by client components alike.
 */

// ---------------------------------------------------------------------------
// Retailer links (locked decision C.3 — retailer URLs at launch, APIs later)
// ---------------------------------------------------------------------------

/** The six retailer URL columns that exist on Supabase `books` (migration 20260619170000). */
export const RETAILER_URL_FIELDS = [
  'amazon_url',
  'kindle_url',
  'apple_books_url',
  'google_play_books_url',
  'barnes_noble_url',
  'audible_url',
] as const;

export type RetailerUrlField = (typeof RETAILER_URL_FIELDS)[number];

/** Display order and labels for the "Also available at" section on the PDP. */
export const RETAILER_LABELS: Record<RetailerUrlField, string> = {
  amazon_url: 'Amazon',
  kindle_url: 'Kindle',
  apple_books_url: 'Apple Books',
  google_play_books_url: 'Google Play Books',
  barnes_noble_url: 'Barnes & Noble',
  audible_url: 'Audible',
};

// ---------------------------------------------------------------------------
// Lifecycle (Task 2.0)
// ---------------------------------------------------------------------------

/**
 * Book statuses the admin pipeline supports.
 *
 * Supabase's CHECK constraint additionally allows 'submitted' | 'review' |
 * 'accepted' (migration 20260116000000) and MongoDB is schemaless, but the
 * admin UI only ever produces these three. Anything else is legacy data.
 */
export const ADMIN_BOOK_STATUSES = ['draft', 'published', 'archived'] as const;
export type AdminBookStatus = (typeof ADMIN_BOOK_STATUSES)[number];

export type BookVisibility = 'public' | 'private' | 'unlisted';

export function isAdminBookStatus(value: unknown): value is AdminBookStatus {
  return (
    typeof value === 'string' && (ADMIN_BOOK_STATUSES as readonly string[]).includes(value)
  );
}

/**
 * The public catalog reads `status === 'published' AND visibility === 'public'`
 * (see `lib/data/books.ts`). The admin UI exposes status only — there is no
 * visibility control anywhere in `/admin/books` — so visibility is DERIVED from
 * status. Without this rule a Mongo book published through the admin UI stays
 * `visibility: 'private'` (the `createBookMongo` default) and never appears
 * publicly, which is one half of the Task 1.0 defect.
 *
 * Supabase reaches the same end state by column default (`visibility` defaults
 * to 'public'), so applying this rule on both providers is parity, not a
 * behaviour change for Supabase.
 */
export function visibilityForStatus(status: AdminBookStatus): BookVisibility {
  return status === 'published' ? 'public' : 'private';
}

// ---------------------------------------------------------------------------
// Value normalisation
// ---------------------------------------------------------------------------

/** Trim; empty string becomes null so blank form fields clear the value. */
export function nullableText(value?: string | null): string | null {
  if (value == null) return null;
  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * External URLs (retailer links, cover/EPUB/audio asset URLs) must be absolute
 * https. The PDP only renders `https://` destinations, so accepting anything
 * else at write time would silently store a link that can never be shown.
 */
export function isValidExternalUrl(value: string): boolean {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

export type UrlValidationIssue = { field: string; message: string };

/**
 * Normalise a set of URL-valued fields. Blank clears to null; a present but
 * non-https value is reported rather than silently dropped.
 */
export function normalizeUrlFields(
  input: Record<string, string | null | undefined>,
  fields: readonly string[]
): { values: Record<string, string | null>; issues: UrlValidationIssue[] } {
  const values: Record<string, string | null> = {};
  const issues: UrlValidationIssue[] = [];

  for (const field of fields) {
    if (!(field in input)) continue;
    const normalized = nullableText(input[field]);
    if (normalized !== null && !isValidExternalUrl(normalized)) {
      issues.push({
        field,
        message: 'Must be a full https:// URL',
      });
      continue;
    }
    values[field] = normalized;
  }

  return { values, issues };
}

/** Retailer links present on a book record, in canonical display order. */
export function retailerLinksFrom(
  book: Record<string, unknown> | null | undefined
): Array<{ field: RetailerUrlField; label: string; url: string }> {
  if (!book) return [];
  const links: Array<{ field: RetailerUrlField; label: string; url: string }> = [];
  for (const field of RETAILER_URL_FIELDS) {
    const raw = book[field];
    if (typeof raw !== 'string') continue;
    const url = raw.trim();
    if (url && isValidExternalUrl(url)) {
      links.push({ field, label: RETAILER_LABELS[field], url });
    }
  }
  return links;
}

// ---------------------------------------------------------------------------
// Catalog field contract (Task 2.0b)
// ---------------------------------------------------------------------------

/**
 * Fields the public catalog projects for a single book, beyond the core
 * identity/pricing columns. The MongoDB read mappers in `lib/data/books.ts`
 * previously hardcoded `audio_url: null` / `trailer_vimeo_id: null` and dropped
 * every retailer field; these names are the contract they must now honour.
 *
 * `epub_url` and `audio_url` are stored on Supabase `book_content` (columns
 * `epub_url` / `audio_url` / `toc`) and directly on the MongoDB book document.
 * The read mappers flatten both shapes onto these names.
 */
export const CATALOG_DETAIL_FIELDS = [
  ...RETAILER_URL_FIELDS,
  'audio_url',
  'audio_toc',
  'audio_narrator',
  'audio_duration_seconds',
  'epub_url',
  'trailer_vimeo_id',
  'content_type',
  'isbn',
  'is_featured',
  'page_count',
  'word_count',
] as const;

export type CatalogDetailField = (typeof CATALOG_DETAIL_FIELDS)[number];

/**
 * MongoDB book-document fields the admin write paths may set, beyond the ones
 * `createBookMongo` already handled (title, slug, description, cover_url,
 * manuscript_url, author_id, status, visibility, price, currency, genre, tags).
 *
 * Deliberately EXCLUDES `subtitle`: `books.subtitle` exists in no Supabase
 * migration, and new migrations are blocked until hosted migration drift is
 * reconciled (Task 3.6), so subtitle is removed from the admin surface on both
 * providers rather than left working on one and broken on the other. See
 * docs/architecture/SCHEMA_DRIFT_DISPOSITIONS.md.
 */
export const MONGO_BOOK_EXTRA_WRITE_FIELDS = [
  ...RETAILER_URL_FIELDS,
  'audio_url',
  'audio_toc',
  'audio_narrator',
  'audio_duration_seconds',
  'epub_url',
  'trailer_vimeo_id',
  'content_type',
  'isbn',
  'is_featured',
  'page_count',
  'word_count',
  'published_at',
] as const;

export type ContentType = 'book' | 'comic' | 'paper';

export const CONTENT_TYPES: readonly ContentType[] = ['book', 'comic', 'paper'];

/** Slug derivation used by every create path (max 120 chars, matches slugifyTitle). */
export function slugifyBookTitle(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}
