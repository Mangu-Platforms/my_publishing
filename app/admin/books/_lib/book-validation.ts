/**
 * Shared admin book validation rule set (Task 2.3 / Task 2.4).
 *
 * WHY a single module: the publish checklist has to behave identically in the
 * browser (field-level errors + the readiness summary shown before submit) and
 * on the server (the write path must refuse to publish an incomplete book even
 * when the form is bypassed). Two copies of these rules drift the first time a
 * field moves between "blocker" and "warning", which is how a book ends up
 * public with no cover. Both sides import this file.
 *
 * Deliberately pure and dependency-free: it is imported by a client component
 * AND by `lib/data/book-assets.ts` (server, service-role), so it must not pull
 * in `server-only-guard`, Supabase or Mongo.
 *
 * Location: `app/admin/books/_lib/` (leading underscore = non-routable) next to
 * the only UI that produces these values, matching `app/admin/_lib/query-error`.
 */

import {
  ADMIN_BOOK_STATUSES,
  RETAILER_URL_FIELDS,
  isValidExternalUrl,
  nullableText,
  normalizeUrlFields,
  slugifyBookTitle,
  type AdminBookStatus,
  type ContentType,
  type RetailerUrlField,
} from '@/lib/books/fields';

// ---------------------------------------------------------------------------
// Asset rules — every limit below is taken from provisioned storage config.
// ---------------------------------------------------------------------------

/**
 * Cover art.
 *
 * `maxBytes` is the `book-covers` bucket's `file_size_limit` (5242880) from
 * supabase/migrations/20260117000006_storage_policies.sql, mirrored by
 * `UPLOAD_CONFIGS.cover` in types/upload.ts. Anything larger is rejected by
 * Storage itself, so this is the authoritative ceiling — not an invented one.
 *
 * The bucket also allows image/webp and image/gif; the admin surface narrows to
 * JPG/PNG because those are the only formats the retailers accept for covers.
 * Narrowing is always safe (a subset of what Storage will take).
 *
 * Dimensions: portrait 2:3, minimum 1600x2400 — the industry-standard ebook
 * cover geometry the PDP hero (`aspect-[2/3]`) is laid out for.
 */
export const COVER_RULES = {
  mimeTypes: ['image/jpeg', 'image/png'] as const,
  extensions: ['.jpg', '.jpeg', '.png'] as const,
  maxBytes: 5 * 1024 * 1024,
  minWidth: 1600,
  minHeight: 2400,
  aspectRatio: 2 / 3,
  /** 2% tolerance: exports off by a pixel or two must not be rejected. */
  aspectTolerance: 0.02,
} as const;

/**
 * EPUB.
 *
 * `maxBytes` is the `published-epubs` bucket's `file_size_limit` (52428800)
 * from supabase/migrations/20260117000006_storage_policies.sql, mirrored by
 * `UPLOAD_CONFIGS.epub`. The bucket's `allowed_mime_types` is exactly
 * {application/epub+zip}. Browsers frequently report .epub as
 * application/octet-stream (or ''), so extension is checked as well as MIME —
 * the same tolerance `lib/uploads/store-asset.ts` applies server-side.
 */
export const EPUB_RULES = {
  mimeTypes: ['application/epub+zip'] as const,
  looseMimeTypes: ['application/octet-stream', ''] as const,
  extensions: ['.epub'] as const,
  maxBytes: 50 * 1024 * 1024,
} as const;

/**
 * Audio sample.
 *
 * Formats: MP3 and M4A only. Both decode through the plain `<audio>` element
 * that `components/audio/use-audio-engine.ts` drives, so the existing player
 * handles them with no change to its props (Task 2.2 forbids touching it).
 *
 * `maxBytes` is null ON PURPOSE: no audio bucket is provisioned in any
 * migration (`types/upload.ts` names an `audiobooks` bucket that
 * supabase/migrations never creates, and /api/upload/book-assets only accepts
 * 'cover' | 'epub'). Inventing a ceiling here would be guessing at storage
 * config, so the admin surface takes an already-hosted https URL instead of
 * performing the upload, and the missing bucket is escalated rather than
 * papered over. Length guidance below is editorial, not a storage limit.
 */
export const AUDIO_SAMPLE_RULES = {
  mimeTypes: ['audio/mpeg', 'audio/mp4', 'audio/x-m4a'] as const,
  extensions: ['.mp3', '.m4a'] as const,
  maxBytes: null,
  recommendedMinSeconds: 120,
  recommendedMaxSeconds: 300,
} as const;

// ---------------------------------------------------------------------------
// Money — decimal-safe
// ---------------------------------------------------------------------------

/** Up to 7 whole digits (books.price is DECIMAL(10,2)) and at most 2 decimals. */
const PRICE_PATTERN = /^\d{1,7}(?:\.\d{1,2})?$/;

export type PriceParse = { ok: true; cents: number } | { ok: false; error: string };

/**
 * Parse a typed price into INTEGER CENTS by string surgery.
 *
 * WHY not `Number(input) * 100`: 19.99 has no exact double representation, so
 * that multiplication yields 1998.9999999999998 and rounds a cent away on some
 * inputs. Splitting on the decimal point and padding the fraction keeps every
 * step in integer arithmetic (both operands are integers well under 2^53).
 */
export function parsePriceInput(raw: string | null | undefined): PriceParse {
  const trimmed = String(raw ?? '')
    .trim()
    .replace(/^\$/, '')
    .replace(',', '.');
  if (trimmed === '') return { ok: false, error: 'Price is required' };
  if (!PRICE_PATTERN.test(trimmed)) {
    return { ok: false, error: 'Enter a plain amount such as 12.99 (2 decimal places max)' };
  }
  const [whole, fraction = ''] = trimmed.split('.');
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  return { ok: true, cents };
}

/**
 * Cents -> the `number` the book write actions accept.
 *
 * One division at the API boundary only. The result is the nearest double to
 * the exact decimal, which is precisely what Postgres DECIMAL(10,2) and the
 * Mongo document round-trip back; no further float arithmetic is performed.
 */
export function priceNumberFromCents(cents: number): number {
  return cents / 100;
}

/** Cents -> "12.99" without ever calling toFixed on an accumulated float. */
export function formatPriceFromCents(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(Math.trunc(cents));
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}

/** Stored price -> the string the form input shows (blank when unset). */
export function priceInputFromStored(price: number | null | undefined): string {
  if (price == null || !Number.isFinite(price)) return '';
  // toFixed on a single DB value is the correctly-rounded decimal rendering of
  // that value; no arithmetic is applied to it afterwards.
  return price.toFixed(2);
}

// ---------------------------------------------------------------------------
// Field-shape helpers
// ---------------------------------------------------------------------------

/** Matches the slug regex already enforced by `UpdateBookSchema` in types/books.ts. */
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isValidSlug(slug: string): boolean {
  const value = slug.trim();
  return value.length > 0 && value.length <= 120 && SLUG_PATTERN.test(value);
}

export { slugifyBookTitle };

/** ISBN-10/13 shape check (books.isbn is UNIQUE TEXT with no format constraint). */
export function isValidIsbn(raw: string): boolean {
  const value = raw.replace(/[\s-]/g, '').toUpperCase();
  return /^\d{9}[\dX]$/.test(value) || /^\d{13}$/.test(value);
}

/** Vimeo IDs are numeric; the player builds player.vimeo.com/video/<id>. */
export function isValidVimeoId(raw: string): boolean {
  return /^\d{6,12}$/.test(raw.trim());
}

function hasExtension(name: string, extensions: readonly string[]): boolean {
  const lower = name.toLowerCase();
  return extensions.some((ext) => lower.endsWith(ext));
}

export type FileCheck = { ok: true } | { ok: false; error: string };

function mb(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(1).replace(/\.0$/, '');
}

/** MIME + extension + size. Mirrors `validateBookAsset` server-side. */
export function validateCoverFile(file: { name: string; type: string; size: number }): FileCheck {
  if (file.size <= 0) return { ok: false, error: 'The file is empty' };
  if (!(COVER_RULES.mimeTypes as readonly string[]).includes(file.type)) {
    return { ok: false, error: 'Cover must be a JPG or PNG image' };
  }
  if (!hasExtension(file.name, COVER_RULES.extensions)) {
    return { ok: false, error: 'Cover file must end in .jpg, .jpeg or .png' };
  }
  if (file.size > COVER_RULES.maxBytes) {
    return {
      ok: false,
      error: `Cover must be ${mb(COVER_RULES.maxBytes)}MB or smaller — yours is ${mb(file.size)}MB`,
    };
  }
  return { ok: true };
}

/** Portrait 2:3, at least 1600x2400. Measured in the browser before upload. */
export function validateCoverDimensions(width: number, height: number): FileCheck {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return { ok: false, error: 'Could not read the image dimensions' };
  }
  if (width < COVER_RULES.minWidth || height < COVER_RULES.minHeight) {
    return {
      ok: false,
      error: `Cover must be at least ${COVER_RULES.minWidth}x${COVER_RULES.minHeight}px — yours is ${width}x${height}px`,
    };
  }
  const ratio = width / height;
  if (Math.abs(ratio - COVER_RULES.aspectRatio) > COVER_RULES.aspectTolerance) {
    return {
      ok: false,
      error: `Cover must be portrait 2:3 (e.g. 1600x2400) — yours is ${width}x${height}px`,
    };
  }
  return { ok: true };
}

export function validateEpubFile(file: { name: string; type: string; size: number }): FileCheck {
  if (file.size <= 0) return { ok: false, error: 'The file is empty' };
  const mimeOk =
    (EPUB_RULES.mimeTypes as readonly string[]).includes(file.type) ||
    ((EPUB_RULES.looseMimeTypes as readonly string[]).includes(file.type) &&
      hasExtension(file.name, EPUB_RULES.extensions));
  if (!mimeOk || !hasExtension(file.name, EPUB_RULES.extensions)) {
    return { ok: false, error: 'EPUB files (.epub) only' };
  }
  if (file.size > EPUB_RULES.maxBytes) {
    return {
      ok: false,
      error: `EPUB must be ${mb(EPUB_RULES.maxBytes)}MB or smaller — yours is ${mb(file.size)}MB`,
    };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// The publish checklist
// ---------------------------------------------------------------------------

export type ValidationIssue = { field: string; message: string };

export type AdminBookFormValues = {
  title: string;
  slug: string;
  description: string;
  genre: string;
  author_id: string | null;
  /** Raw input text — parsed decimal-safely, never pre-converted to a float. */
  price: string;
  /** Display only today; see CURRENCY_IS_FIXED. */
  currency: string;
  isbn: string;
  content_type: ContentType;
  /** yyyy-mm-dd from <input type="date">, or ''. */
  published_at: string;
  status: AdminBookStatus;
  is_featured: boolean;
  page_count: string;
  word_count: string;
  trailer_vimeo_id: string;
  cover_url: string | null;
  epub_url: string | null;
  audio_url: string | null;
  audio_narrator: string;
  audio_duration_seconds: string;
} & Record<RetailerUrlField, string>;

/**
 * There is no `books.currency` column in any Supabase migration (only the
 * unused `book_pricing.currency`), and `createBookAdmin`/`updateBookAdmin` do
 * not accept a currency, so a per-book currency cannot round-trip on the
 * Supabase provider. New migrations are blocked until Task 3.6, so the admin
 * surface shows the currency as fixed rather than pretending to save it.
 */
export const CURRENCY_IS_FIXED = true;
export const FIXED_CURRENCY = 'USD';

export const EMPTY_BOOK_FORM_VALUES: AdminBookFormValues = {
  title: '',
  slug: '',
  description: '',
  genre: '',
  author_id: null,
  price: '',
  currency: FIXED_CURRENCY,
  isbn: '',
  content_type: 'book',
  published_at: '',
  status: 'draft',
  is_featured: false,
  page_count: '',
  word_count: '',
  trailer_vimeo_id: '',
  cover_url: null,
  epub_url: null,
  audio_url: null,
  audio_narrator: '',
  audio_duration_seconds: '',
  amazon_url: '',
  kindle_url: '',
  apple_books_url: '',
  google_play_books_url: '',
  barnes_noble_url: '',
  audible_url: '',
};

export type AdminBookValidation = {
  /** Keyed by form field name; blocks SAVE regardless of status. */
  fieldErrors: Record<string, string>;
  /** Must all clear before status can become 'published'. */
  blockers: ValidationIssue[];
  /** Never block anything — shown as "nice to have" on the readiness card. */
  warnings: ValidationIssue[];
  canPublish: boolean;
  /** True when this exact payload is safe to write with the requested status. */
  ok: boolean;
};

const ASSET_URL_FIELDS: Array<{ field: 'cover_url' | 'epub_url' | 'audio_url'; label: string }> = [
  { field: 'cover_url', label: 'Cover image' },
  { field: 'epub_url', label: 'EPUB file' },
  { field: 'audio_url', label: 'Audio sample' },
];

function intFieldError(raw: string, label: string): string | null {
  const value = raw.trim();
  if (value === '') return null;
  if (!/^\d{1,9}$/.test(value)) return `${label} must be a whole number`;
  return null;
}

/**
 * The one rule set. Client renders it; server re-runs it before writing.
 *
 * Hard blockers (publish is refused): title, author, cover, description, genre,
 * price, a valid slug, and every required asset reference resolving to https.
 * Warnings never block: no retailer URL, no audio sample, no trailer, no ISBN.
 */
export function validateAdminBook(values: AdminBookFormValues): AdminBookValidation {
  const fieldErrors: Record<string, string> = {};
  const blockers: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  const title = nullableText(values.title);
  const description = nullableText(values.description);
  const genre = nullableText(values.genre);
  const authorId = nullableText(values.author_id);
  const slug = values.slug.trim();

  // --- always-required-to-save fields (NOT NULL on Supabase `books`) --------
  if (!title) fieldErrors.title = 'Title is required';
  if (!genre) fieldErrors.genre = 'Genre is required';

  // --- shape checks --------------------------------------------------------
  // Blank slug on create is legal: the server derives it from the title.
  if (slug !== '' && !isValidSlug(slug)) {
    fieldErrors.slug = 'Use lowercase letters, numbers and single hyphens (max 120 characters)';
  }

  const priceRaw = values.price.trim();
  const parsedPrice = priceRaw === '' ? null : parsePriceInput(priceRaw);
  if (parsedPrice && !parsedPrice.ok) fieldErrors.price = parsedPrice.error;

  if (values.isbn.trim() !== '' && !isValidIsbn(values.isbn)) {
    fieldErrors.isbn = 'Enter a valid ISBN-10 or ISBN-13';
  }

  if (values.trailer_vimeo_id.trim() !== '' && !isValidVimeoId(values.trailer_vimeo_id)) {
    fieldErrors.trailer_vimeo_id = 'Vimeo IDs are numeric, e.g. 76979871';
  }

  const pageCountError = intFieldError(values.page_count, 'Page count');
  if (pageCountError) fieldErrors.page_count = pageCountError;
  const wordCountError = intFieldError(values.word_count, 'Word count');
  if (wordCountError) fieldErrors.word_count = wordCountError;
  const durationError = intFieldError(values.audio_duration_seconds, 'Sample length');
  if (durationError) fieldErrors.audio_duration_seconds = durationError;

  if (values.published_at.trim() !== '' && Number.isNaN(Date.parse(values.published_at))) {
    fieldErrors.published_at = 'Enter a valid date';
  }

  // --- URL fields: retailer links and asset references ---------------------
  const retailerInput: Record<string, string> = {};
  for (const field of RETAILER_URL_FIELDS) retailerInput[field] = values[field];
  const retailer = normalizeUrlFields(retailerInput, RETAILER_URL_FIELDS);
  for (const issue of retailer.issues) fieldErrors[issue.field] = issue.message;

  for (const { field, label } of ASSET_URL_FIELDS) {
    const value = nullableText(values[field]);
    if (value && !isValidExternalUrl(value)) {
      fieldErrors[field] = `${label} must be a full https:// URL`;
    }
  }

  // --- hard blockers (publish only) ----------------------------------------
  if (!title) blockers.push({ field: 'title', message: 'Title is required' });
  if (!authorId) blockers.push({ field: 'author_id', message: 'Assign an author' });
  if (!description) {
    blockers.push({ field: 'description', message: 'Write a description for the product page' });
  }
  if (!genre) blockers.push({ field: 'genre', message: 'Genre is required' });

  const coverUrl = nullableText(values.cover_url);
  if (!coverUrl) {
    blockers.push({ field: 'cover_url', message: 'Upload a cover image' });
  } else if (!isValidExternalUrl(coverUrl)) {
    blockers.push({ field: 'cover_url', message: 'Cover image link is broken (not an https URL)' });
  }

  if (parsedPrice === null) {
    blockers.push({ field: 'price', message: 'Set a price (use 0.00 for free)' });
  } else if (!parsedPrice.ok) {
    blockers.push({ field: 'price', message: parsedPrice.error });
  }

  if (slug === '') {
    // A published book must have a real slug; create derives one from title.
    const derived = slugifyBookTitle(values.title);
    if (!derived) blockers.push({ field: 'slug', message: 'A URL slug is required' });
  } else if (!isValidSlug(slug)) {
    blockers.push({ field: 'slug', message: 'The URL slug is not valid' });
  }

  // A published record must never point at an asset reference we know is broken.
  for (const { field, label } of ASSET_URL_FIELDS) {
    if (field === 'cover_url') continue; // already covered above
    const value = nullableText(values[field]);
    if (value && !isValidExternalUrl(value)) {
      blockers.push({ field, message: `${label} link is broken (not an https URL)` });
    }
  }

  // --- warnings ------------------------------------------------------------
  const hasRetailer = RETAILER_URL_FIELDS.some((field) => nullableText(values[field]) !== null);
  if (!hasRetailer) {
    warnings.push({
      field: 'amazon_url',
      message: 'No retailer links yet — the "Also available at" section stays hidden',
    });
  }
  if (!nullableText(values.audio_url)) {
    warnings.push({ field: 'audio_url', message: 'No audio sample — the audio tab stays hidden' });
  }
  if (!nullableText(values.trailer_vimeo_id)) {
    warnings.push({ field: 'trailer_vimeo_id', message: 'No trailer video' });
  }
  if (!nullableText(values.isbn)) {
    warnings.push({ field: 'isbn', message: 'No ISBN (not required for digital-only titles)' });
  }

  const canPublish = blockers.length === 0;
  const wantsPublished = values.status === 'published';
  const ok = Object.keys(fieldErrors).length === 0 && (!wantsPublished || canPublish);

  return { fieldErrors, blockers, warnings, canPublish, ok };
}

/** Narrow an unknown status string to the admin lifecycle, defaulting to draft. */
export function coerceAdminStatus(value: unknown): AdminBookStatus {
  return typeof value === 'string' && (ADMIN_BOOK_STATUSES as readonly string[]).includes(value)
    ? (value as AdminBookStatus)
    : 'draft';
}
