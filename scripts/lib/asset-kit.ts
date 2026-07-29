/**
 * scripts/lib/asset-kit.ts — Task 4.2 (book asset-kit intake).
 *
 * WHY this module exists: the publisher hands over 3-6 finished books as
 * folders on disk. Everything that can be wrong with one of those folders has
 * to be found BEFORE anyone opens /admin/books — a defect caught here costs the
 * publisher a re-export, the same defect caught in the admin UI costs a
 * round-trip and a slot in the launch window.
 *
 * WHY it restates nothing: the publish gate already exists in
 * `app/admin/books/_lib/book-validation.ts` and the field contract already
 * exists in `lib/books/fields.ts`. This module MAPS a kit onto
 * `AdminBookFormValues` and calls `validateAdminBook` unchanged. If a field
 * moves between blocker and warning in the admin rule set, intake moves with it
 * in the same commit, because there is no second copy of the rules to forget.
 *
 * Everything this module adds on top is tagged `source: 'intake'` in the issue
 * stream, and every one of those additions is a check the admin UI structurally
 * CANNOT perform: it sees one book at a time (no batch uniqueness), it has no
 * filesystem (no on-disk asset), and it has no legal/approval record.
 *
 * Deliberately fs-free and dependency-free so the rules are unit-testable
 * without fixture folders. `scripts/validate-asset-kit.ts` does the I/O and
 * hands the facts in.
 */

import {
  CONTENT_TYPES,
  RETAILER_URL_FIELDS,
  nullableText,
  slugifyBookTitle,
  type ContentType,
} from '@/lib/books/fields';
import {
  AUDIO_SAMPLE_RULES,
  COVER_RULES,
  EMPTY_BOOK_FORM_VALUES,
  EPUB_RULES,
  FIXED_CURRENCY,
  parsePriceInput,
  validateAdminBook,
  validateCoverDimensions,
  validateCoverFile,
  validateEpubFile,
  type AdminBookFormValues,
} from '@/app/admin/books/_lib/book-validation';

// ---------------------------------------------------------------------------
// Issue stream
// ---------------------------------------------------------------------------

export type IssueSeverity = 'blocker' | 'warning';

/**
 * `source` is not decoration: it is how a reviewer proves at a glance that
 * intake did not grow a private rule set. Anything tagged 'admin-validation'
 * came out of `validateAdminBook` verbatim.
 */
export type IssueSource = 'admin-validation' | 'intake';

export type KitIssue = {
  severity: IssueSeverity;
  /** Stable machine code for --json consumers; never reworded casually. */
  code: string;
  /** Dotted path into book.json, e.g. 'assets.cover_file'. */
  field: string;
  message: string;
  source: IssueSource;
};

// ---------------------------------------------------------------------------
// Limits that are NOT in book-validation.ts, each with its origin
// ---------------------------------------------------------------------------

/** `CreateBookSchema.title.max(200)` — types/books.ts. Zod rejects longer at write time. */
export const TITLE_MAX = 200;

/** `CreateBookSchema.description.max(5000)` — types/books.ts. */
export const DESCRIPTION_MAX = 5000;

/** `UpdateBookSchema.seo_title.max(60)` — types/books.ts. */
export const SEO_TITLE_MAX = 60;

/** `UpdateBookSchema.seo_description.max(160)` — types/books.ts. */
export const SEO_DESCRIPTION_MAX = 160;

/**
 * NOT a repo constraint. There is no `books.short_description` column and no
 * schema for it anywhere, so this is an editorial intake cap and it can only
 * ever produce a WARNING. Flagged for the publisher's decision rather than
 * dressed up as storage config.
 */
export const SHORT_DESCRIPTION_GUIDANCE_MAX = 200;

/**
 * NOT a repo constraint either. Every cover today renders with a hardcoded
 * `alt={`Cover of ${book.title}`}` (app/(consumer)/books/[slug]/page.tsx,
 * components/cards/BookCard.tsx and friends) and no alt-text column exists.
 * Warning-only, and escalated.
 */
export const ALT_TEXT_GUIDANCE_MAX = 125;

/**
 * Stand-in origin for an asset that exists on disk but has not been uploaded
 * yet. `validateAdminBook` asks "is there an https cover reference?", which at
 * intake means "has a cover been supplied?" — so a supplied local file has to
 * resolve to SOMETHING https or the reused rule would misfire on every kit.
 * `.invalid` is reserved by RFC 2606 and can never resolve, so if this string
 * ever escapes into a database row it is unmistakable rather than plausible.
 */
export const PENDING_UPLOAD_ORIGIN = 'https://pending-upload.invalid';

/**
 * Stand-in author id for a kit that names an author but has not been linked to
 * an `authors` row yet. Creating the author record is an operator step in
 * /admin/authors, not something a publisher can put in a JSON file.
 */
export const PENDING_AUTHOR_ID = 'pending-author-record';

/** Top-level keys book.json is allowed to carry; anything else is a typo warning. */
export const KNOWN_KIT_KEYS = [
  'kit_format_version',
  'title',
  'slug',
  'author',
  'genre',
  'content_type',
  'description',
  'short_description',
  'price',
  'currency',
  'isbn',
  'published_at',
  'page_count',
  'word_count',
  'trailer_vimeo_id',
  'retailers',
  'assets',
  'seo',
  'rights',
  'approval',
] as const;

// ---------------------------------------------------------------------------
// ISBN — normalisation + check digit
// ---------------------------------------------------------------------------

/** Strip the separators a publisher's catalogue export puts in. */
export function normalizeIsbn(raw: string): string {
  return String(raw ?? '')
    .replace(/[\s-]/g, '')
    .toUpperCase();
}

/**
 * Check digit for ISBN-10 (mod 11, 'X' = 10) and ISBN-13 (EAN-13 mod 10).
 *
 * WHY this is intake-only: `isValidIsbn` in book-validation.ts is documented as
 * a SHAPE check ("books.isbn is UNIQUE TEXT with no format constraint"), so the
 * admin UI accepts a transposed digit. A failing check digit is a guaranteed
 * typo, and intake is the last moment it can be fixed for free instead of being
 * sent to six retailers. This is the ONE place intake is deliberately stricter
 * than the admin UI, and the strictness runs the safe way round: nothing that
 * passes intake can fail the admin UI.
 */
export function isbnCheckDigitValid(raw: string): boolean {
  const value = normalizeIsbn(raw);

  if (/^\d{9}[\dX]$/.test(value)) {
    let sum = 0;
    for (let i = 0; i < 9; i += 1) sum += (10 - i) * Number(value[i]);
    sum += value[9] === 'X' ? 10 : Number(value[9]);
    return sum % 11 === 0;
  }

  if (/^\d{13}$/.test(value)) {
    let sum = 0;
    for (let i = 0; i < 12; i += 1) sum += Number(value[i]) * (i % 2 === 0 ? 1 : 3);
    return (10 - (sum % 10)) % 10 === Number(value[12]);
  }

  return false;
}

// ---------------------------------------------------------------------------
// Image + container headers, read without adding a dependency
// ---------------------------------------------------------------------------

export type ImageDimensions = { width: number; height: number };

function view(bytes: Uint8Array): DataView {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

/** PNG spec: IHDR is always the first chunk, so width/height sit at fixed offsets. */
export function readPngDimensions(bytes: Uint8Array): ImageDimensions | null {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length < 24) return null;
  for (let i = 0; i < signature.length; i += 1) {
    if (bytes[i] !== signature[i]) return null;
  }
  if (String.fromCharCode(bytes[12], bytes[13], bytes[14], bytes[15]) !== 'IHDR') return null;
  const data = view(bytes);
  return { width: data.getUint32(16), height: data.getUint32(20) };
}

/** Frame headers that carry the true image size; C4/C8/CC are tables, not frames. */
const JPEG_SOF_MARKERS = new Set([
  0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
]);

/** Walk the JPEG marker chain to the first SOF segment. Returns null if unreadable. */
export function readJpegDimensions(bytes: Uint8Array): ImageDimensions | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  const data = view(bytes);
  let offset = 2;

  while (offset + 3 < bytes.length) {
    // Fill bytes (0xFF padding) and stray bytes: resync rather than give up.
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = bytes[offset + 1];
    if (marker === 0xff) {
      offset += 1;
      continue;
    }
    // Standalone markers carry no length field.
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }
    // Entropy-coded data starts here; a compliant file has already shown its SOF.
    if (marker === 0xda || marker === 0xd9) return null;

    const length = data.getUint16(offset + 2);
    if (length < 2) return null;
    if (JPEG_SOF_MARKERS.has(marker)) {
      if (offset + 9 > bytes.length) return null;
      return { width: data.getUint16(offset + 7), height: data.getUint16(offset + 5) };
    }
    offset += 2 + length;
  }

  return null;
}

export function readImageDimensions(bytes: Uint8Array): ImageDimensions | null {
  return readPngDimensions(bytes) ?? readJpegDimensions(bytes);
}

/**
 * MIME from the header, never from the extension — a .png that is really a JPEG
 * uploads fine and then fails whatever downstream tool trusts the extension.
 */
export function sniffImageMime(bytes: Uint8Array): 'image/png' | 'image/jpeg' | null {
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return 'image/png';
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }
  return null;
}

/** EPUB is an OCF (ZIP) container, so the local file header magic must be present. */
export function isZipContainer(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 4 &&
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    bytes[2] === 0x03 &&
    bytes[3] === 0x04
  );
}

// ---------------------------------------------------------------------------
// Kit shape
// ---------------------------------------------------------------------------

export type RawKit = Record<string, unknown>;

/** What the CLI learned about one file named by book.json. */
export type LocalFileFacts = {
  /** Path exactly as written in book.json, for messages. */
  declaredPath: string;
  exists: boolean;
  size: number;
  /** Sniffed from header bytes; null when the header is not one we recognise. */
  sniffedMime: string | null;
  dimensions: ImageDimensions | null;
  isZipContainer: boolean;
};

export type AssetKitFileFacts = {
  cover?: LocalFileFacts | null;
  epub?: LocalFileFacts | null;
  /** Present only when the kit wrongly ships an audio FILE instead of a URL. */
  audio?: LocalFileFacts | null;
};

export type AssetKitOptions = {
  /**
   * Off for the publisher's own run (they cannot know internal author ids), on
   * for the operator's final pre-publish pass once /admin/authors is populated.
   */
  requireAuthorId?: boolean;
};

export type AssetKitInput = {
  /** Folder name, used to identify the kit in output. */
  kitName: string;
  kit: RawKit;
  files: AssetKitFileFacts;
  options?: AssetKitOptions;
};

export type AssetKitResult = {
  kitName: string;
  title: string;
  slug: string;
  /** Integer cents, or null when the price did not parse. Never a float. */
  priceCents: number | null;
  isbn: string | null;
  blockers: KitIssue[];
  warnings: KitIssue[];
  ok: boolean;
};

export type AssetKitBatchResult = {
  results: AssetKitResult[];
  blockerCount: number;
  warningCount: number;
  ok: boolean;
};

// ---------------------------------------------------------------------------
// Defensive readers — book.json is hand-edited, so nothing may be assumed
// ---------------------------------------------------------------------------

function pick(source: RawKit, path: string): unknown {
  let current: unknown = source;
  for (const part of path.split('.')) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function text(source: RawKit, path: string): string {
  const value = pick(source, path);
  if (typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
}

function isTrue(source: RawKit, path: string): boolean {
  return pick(source, path) === true;
}

function baseName(filePath: string): string {
  const parts = filePath.split(/[\\/]/);
  return parts[parts.length - 1] || filePath;
}

// ---------------------------------------------------------------------------
// Kit -> the exact object the admin form produces
// ---------------------------------------------------------------------------

function assetReference(
  kit: RawKit,
  urlPath: string,
  facts: LocalFileFacts | null | undefined,
  kind: string
): string | null {
  const hosted = nullableText(text(kit, urlPath));
  if (hosted) return hosted;
  if (facts && facts.exists) {
    return `${PENDING_UPLOAD_ORIGIN}/${kind}/${encodeURIComponent(baseName(facts.declaredPath))}`;
  }
  return null;
}

/**
 * Project a kit onto `AdminBookFormValues`.
 *
 * `status` is pinned to 'published' on purpose: an asset kit exists to be
 * published, so intake must be judged against the publish gate, not the
 * save-a-draft gate. Anything else would let a kit "pass" and then be refused
 * the moment someone flips the status in the admin UI.
 */
export function toAdminFormValues(kit: RawKit, files: AssetKitFileFacts): AdminBookFormValues {
  const values: AdminBookFormValues = { ...EMPTY_BOOK_FORM_VALUES };

  values.title = text(kit, 'title');
  values.slug = text(kit, 'slug').trim();
  values.description = text(kit, 'description');
  values.genre = text(kit, 'genre');

  const linkedAuthorId = nullableText(text(kit, 'author.admin_author_id'));
  const penName = nullableText(text(kit, 'author.pen_name'));
  values.author_id = linkedAuthorId ?? (penName ? PENDING_AUTHOR_ID : null);

  values.price = text(kit, 'price');
  values.currency = text(kit, 'currency') || FIXED_CURRENCY;
  values.isbn = text(kit, 'isbn');

  const declaredType = text(kit, 'content_type');
  values.content_type = (CONTENT_TYPES as readonly string[]).includes(declaredType)
    ? (declaredType as ContentType)
    : 'book';

  values.published_at = text(kit, 'published_at');
  values.status = 'published';
  values.page_count = text(kit, 'page_count');
  values.word_count = text(kit, 'word_count');
  values.trailer_vimeo_id = text(kit, 'trailer_vimeo_id');

  values.cover_url = assetReference(kit, 'assets.cover_url', files.cover, 'cover');
  values.epub_url = assetReference(kit, 'assets.epub_url', files.epub, 'epub');
  values.audio_url = nullableText(text(kit, 'assets.audio_sample_url'));
  values.audio_narrator = text(kit, 'assets.audio_narrator');
  values.audio_duration_seconds = text(kit, 'assets.audio_duration_seconds');

  for (const field of RETAILER_URL_FIELDS) {
    values[field] = text(kit, `retailers.${field}`);
  }

  return values;
}

/** Slug a kit will occupy, matching what the create path derives. */
export function resolveKitSlug(kit: RawKit): string {
  const declared = text(kit, 'slug').trim();
  return declared !== '' ? declared : slugifyBookTitle(text(kit, 'title'));
}

// ---------------------------------------------------------------------------
// The rule run
// ---------------------------------------------------------------------------

export function validateAssetKit(input: AssetKitInput): AssetKitResult {
  const { kit, files } = input;
  const requireAuthorId = input.options?.requireAuthorId === true;

  const blockers: KitIssue[] = [];
  const warnings: KitIssue[] = [];
  const seen = new Set<string>();

  const add = (issue: KitIssue): void => {
    const key = `${issue.severity}:${issue.field}:${issue.message}`;
    if (seen.has(key)) return;
    seen.add(key);
    (issue.severity === 'blocker' ? blockers : warnings).push(issue);
  };

  const block = (code: string, field: string, message: string, source: IssueSource): void =>
    add({ severity: 'blocker', code, field, message, source });
  const warn = (code: string, field: string, message: string, source: IssueSource): void =>
    add({ severity: 'warning', code, field, message, source });

  // --- 1. the admin rule set, run verbatim ---------------------------------
  const values = toAdminFormValues(kit, files);
  const admin = validateAdminBook(values);

  // A fieldError blocks SAVE in the admin UI, so it must block intake too.
  for (const [field, message] of Object.entries(admin.fieldErrors)) {
    block(`admin.field.${field}`, field, message, 'admin-validation');
  }
  for (const issue of admin.blockers) {
    block(`admin.blocker.${issue.field}`, issue.field, issue.message, 'admin-validation');
  }
  for (const issue of admin.warnings) {
    warn(`admin.warning.${issue.field}`, issue.field, issue.message, 'admin-validation');
  }

  // --- 2. shape of the handover document itself ----------------------------
  if ('subtitle' in kit) {
    block(
      'kit.subtitle_unsupported',
      'subtitle',
      'Remove `subtitle`: `books.subtitle` exists in no migration and was dropped from the admin surface on purpose (see lib/books/fields.ts, MONGO_BOOK_EXTRA_WRITE_FIELDS). Fold it into the title or the description.',
      'intake'
    );
  }
  for (const key of Object.keys(kit)) {
    if (!(KNOWN_KIT_KEYS as readonly string[]).includes(key) && key !== 'subtitle') {
      warn(
        'kit.unknown_key',
        key,
        `\`${key}\` is not a field in the asset-kit spec and will be ignored — check for a typo`,
        'intake'
      );
    }
  }

  // --- 3. money ------------------------------------------------------------
  const priceRaw = text(kit, 'price');
  const parsed = priceRaw.trim() === '' ? null : parsePriceInput(priceRaw);
  const priceCents = parsed && parsed.ok ? parsed.cents : null;

  if (typeof pick(kit, 'price') === 'number') {
    warn(
      'kit.price_not_string',
      'price',
      'Quote the price as a string ("12.99"). A bare JSON number is an IEEE-754 double and export tooling can round-trip it imprecisely.',
      'intake'
    );
  }
  if (priceCents === 0) {
    warn('kit.price_zero', 'price', 'Price is 0.00 — this book will be free. Confirm.', 'intake');
  }

  const currency = text(kit, 'currency').trim();
  if (currency !== '' && currency !== FIXED_CURRENCY) {
    block(
      'kit.currency_unsupported',
      'currency',
      `Currency must be ${FIXED_CURRENCY}. There is no \`books.currency\` column in any migration, so a per-book currency cannot round-trip (CURRENCY_IS_FIXED in app/admin/books/_lib/book-validation.ts).`,
      'intake'
    );
  }

  // --- 4. lengths that zod enforces at write time --------------------------
  const title = text(kit, 'title');
  if (title.length > TITLE_MAX) {
    block(
      'kit.title_too_long',
      'title',
      `Title is ${title.length} characters; CreateBookSchema in types/books.ts caps it at ${TITLE_MAX}.`,
      'intake'
    );
  }
  const description = text(kit, 'description');
  if (description.length > DESCRIPTION_MAX) {
    block(
      'kit.description_too_long',
      'description',
      `Long description is ${description.length} characters; CreateBookSchema in types/books.ts caps it at ${DESCRIPTION_MAX}.`,
      'intake'
    );
  }

  // --- 5. content type -----------------------------------------------------
  const declaredType = text(kit, 'content_type').trim();
  if (declaredType !== '' && !(CONTENT_TYPES as readonly string[]).includes(declaredType)) {
    block(
      'kit.content_type_invalid',
      'content_type',
      `content_type must be one of ${CONTENT_TYPES.join(', ')} (lib/books/fields.ts).`,
      'intake'
    );
  }

  // --- 6. ISBN check digit -------------------------------------------------
  const isbnRaw = text(kit, 'isbn').trim();
  const isbn = isbnRaw === '' ? null : normalizeIsbn(isbnRaw);
  if (isbn && !admin.fieldErrors.isbn && !isbnCheckDigitValid(isbn)) {
    block(
      'kit.isbn_check_digit',
      'isbn',
      `ISBN ${isbn} has the right shape but the check digit does not verify — a digit is wrong or transposed.`,
      'intake'
    );
  }

  // --- 7. author linkage ---------------------------------------------------
  if (values.author_id === PENDING_AUTHOR_ID) {
    const message =
      'author.admin_author_id is empty — create the author in /admin/authors and paste the id back, or the admin UI will refuse to publish.';
    if (requireAuthorId) block('kit.author_unlinked', 'author.admin_author_id', message, 'intake');
    else warn('kit.author_unlinked', 'author.admin_author_id', message, 'intake');
  }

  // --- 8. dates ------------------------------------------------------------
  if (text(kit, 'published_at').trim() === '') {
    warn(
      'kit.published_at_missing',
      'published_at',
      'No publication date — the PDP and any date-ordered listing fall back to created_at.',
      'intake'
    );
  }

  // --- 9. cover ------------------------------------------------------------
  const cover = files.cover;
  if (cover) {
    if (!cover.exists) {
      block(
        'kit.cover_missing_file',
        'assets.cover_file',
        `Cover file not found in the kit: ${cover.declaredPath}`,
        'intake'
      );
    } else {
      const sniffed = cover.sniffedMime;
      if (!sniffed || !(COVER_RULES.mimeTypes as readonly string[]).includes(sniffed)) {
        block(
          'kit.cover_not_jpg_png',
          'assets.cover_file',
          'Cover is not a JPG or PNG (checked by reading the file header, not the extension).',
          'intake'
        );
      } else {
        const lower = cover.declaredPath.toLowerCase();
        const extSaysJpeg = lower.endsWith('.jpg') || lower.endsWith('.jpeg');
        const extSaysPng = lower.endsWith('.png');
        if ((sniffed === 'image/jpeg' && !extSaysJpeg) || (sniffed === 'image/png' && !extSaysPng)) {
          block(
            'kit.cover_extension_mismatch',
            'assets.cover_file',
            `Cover header says ${sniffed} but the filename says otherwise — re-export it rather than renaming it.`,
            'intake'
          );
        }
        // MIME + extension + the 5 MB book-covers bucket ceiling, reused.
        const fileCheck = validateCoverFile({
          name: cover.declaredPath,
          type: sniffed,
          size: cover.size,
        });
        if (!fileCheck.ok) {
          block('kit.cover_file_rejected', 'assets.cover_file', fileCheck.error, 'admin-validation');
        }
      }

      if (cover.dimensions) {
        const dims = validateCoverDimensions(cover.dimensions.width, cover.dimensions.height);
        if (!dims.ok) {
          block('kit.cover_dimensions', 'assets.cover_file', dims.error, 'admin-validation');
        }
      } else {
        warn(
          'kit.cover_dimensions_unreadable',
          'assets.cover_file',
          `Could not read the cover dimensions from the file header, so portrait 2:3 at >=${COVER_RULES.minWidth}x${COVER_RULES.minHeight} could not be confirmed — check it by hand.`,
          'intake'
        );
      }
    }
  }

  // --- 10. EPUB ------------------------------------------------------------
  const epub = files.epub;
  const epubUrl = nullableText(text(kit, 'assets.epub_url'));
  if (!epub && !epubUrl) {
    warn(
      'kit.epub_missing',
      'assets.epub_file',
      'No EPUB. There is no on-site reader at launch, so an EPUB is an internal asset — not a customer deliverable — but the catalog record stays incomplete without it.',
      'intake'
    );
  } else if (epub) {
    if (!epub.exists) {
      block(
        'kit.epub_missing_file',
        'assets.epub_file',
        `EPUB file not found in the kit: ${epub.declaredPath}`,
        'intake'
      );
    } else {
      if (!epub.isZipContainer) {
        block(
          'kit.epub_not_a_container',
          'assets.epub_file',
          'File does not start with the ZIP local-file-header magic, so it is not an EPUB/OCF container whatever the extension says.',
          'intake'
        );
      }
      // Extension + the 50 MB published-epubs bucket ceiling, reused. The loose
      // MIME is exactly the tolerance EPUB_RULES already documents for files
      // that arrive without a browser-supplied type.
      const epubCheck = validateEpubFile({
        name: epub.declaredPath,
        type: EPUB_RULES.looseMimeTypes[0],
        size: epub.size,
      });
      if (!epubCheck.ok) {
        block('kit.epub_file_rejected', 'assets.epub_file', epubCheck.error, 'admin-validation');
      }
    }
  }

  // --- 11. audio sample ----------------------------------------------------
  const audioFileDeclared = nullableText(text(kit, 'assets.audio_sample_file'));
  if (audioFileDeclared || files.audio) {
    block(
      'kit.audio_no_bucket',
      'assets.audio_sample_file',
      'Audio samples cannot be uploaded: no audio bucket is provisioned. supabase/migrations/20260117000006_storage_policies.sql creates only book-covers, manuscripts and published-epubs; types/upload.ts names an `audiobooks` bucket that no migration ever creates; /api/upload/book-assets accepts asset=cover|epub only. Host the sample and put its https URL in assets.audio_sample_url.',
      'intake'
    );
  }

  const durationRaw = text(kit, 'assets.audio_duration_seconds').trim();
  if (nullableText(text(kit, 'assets.audio_sample_url')) && /^\d{1,9}$/.test(durationRaw)) {
    const seconds = Number(durationRaw);
    if (
      seconds < AUDIO_SAMPLE_RULES.recommendedMinSeconds ||
      seconds > AUDIO_SAMPLE_RULES.recommendedMaxSeconds
    ) {
      warn(
        'kit.audio_duration_off_guidance',
        'assets.audio_duration_seconds',
        `Sample is ${seconds}s; AUDIO_SAMPLE_RULES recommends ${AUDIO_SAMPLE_RULES.recommendedMinSeconds}-${AUDIO_SAMPLE_RULES.recommendedMaxSeconds}s (2-5 minutes). Editorial guidance, not a storage limit.`,
        'intake'
      );
    }
  }

  // --- 12. SEO + alt text --------------------------------------------------
  const seoTitle = text(kit, 'seo.title').trim();
  if (seoTitle === '') {
    warn(
      'kit.seo_title_missing',
      'seo.title',
      'No SEO title — generateMetadata in app/(consumer)/books/[slug]/page.tsx falls back to the book title.',
      'intake'
    );
  } else if (seoTitle.length > SEO_TITLE_MAX) {
    block(
      'kit.seo_title_too_long',
      'seo.title',
      `SEO title is ${seoTitle.length} characters; UpdateBookSchema in types/books.ts caps seo_title at ${SEO_TITLE_MAX}.`,
      'intake'
    );
  }

  const seoDescription = text(kit, 'seo.description').trim();
  if (seoDescription === '') {
    warn(
      'kit.seo_description_missing',
      'seo.description',
      'No SEO description — generateMetadata falls back to the long description, which is usually far past the ~160-character snippet window.',
      'intake'
    );
  } else if (seoDescription.length > SEO_DESCRIPTION_MAX) {
    block(
      'kit.seo_description_too_long',
      'seo.description',
      `SEO description is ${seoDescription.length} characters; UpdateBookSchema in types/books.ts caps seo_description at ${SEO_DESCRIPTION_MAX}.`,
      'intake'
    );
  }

  const altText = text(kit, 'seo.cover_alt').trim();
  if (altText === '') {
    warn(
      'kit.cover_alt_missing',
      'seo.cover_alt',
      'No cover alt text. Every cover currently renders with a hardcoded `Cover of <title>`; supply the alt text so it can be used once a field exists.',
      'intake'
    );
  } else if (altText.length > ALT_TEXT_GUIDANCE_MAX) {
    warn(
      'kit.cover_alt_long',
      'seo.cover_alt',
      `Alt text is ${altText.length} characters, past the ${ALT_TEXT_GUIDANCE_MAX}-character intake guideline. Guidance only — no alt-text column exists yet.`,
      'intake'
    );
  }

  const shortDescription = text(kit, 'short_description').trim();
  if (shortDescription === '') {
    warn(
      'kit.short_description_missing',
      'short_description',
      'No short description for cards and share previews.',
      'intake'
    );
  } else if (shortDescription.length > SHORT_DESCRIPTION_GUIDANCE_MAX) {
    warn(
      'kit.short_description_long',
      'short_description',
      `Short description is ${shortDescription.length} characters, past the ${SHORT_DESCRIPTION_GUIDANCE_MAX}-character intake guideline. Guidance only — no short_description column exists.`,
      'intake'
    );
  }

  // --- 13. rights + approval ----------------------------------------------
  // No database column backs any of this and none is proposed: it is the
  // handover record that says a human signed the book off. Missing sign-off is
  // the whole reason intake exists, so it blocks.
  if (!isTrue(kit, 'rights.confirmed')) {
    block(
      'kit.rights_unconfirmed',
      'rights.confirmed',
      'rights.confirmed must be true — the publisher confirms they hold the rights to publish and distribute this title.',
      'intake'
    );
  }
  if (nullableText(text(kit, 'rights.holder')) === null) {
    block('kit.rights_holder_missing', 'rights.holder', 'Name the rights holder.', 'intake');
  }
  if (nullableText(text(kit, 'rights.territory')) === null) {
    warn(
      'kit.rights_territory_missing',
      'rights.territory',
      'No territory recorded (e.g. "World, all languages").',
      'intake'
    );
  }

  if (nullableText(text(kit, 'approval.approved_by')) === null) {
    block(
      'kit.approval_by_missing',
      'approval.approved_by',
      'approval.approved_by must name the person who signed this book off.',
      'intake'
    );
  }
  const approvedOn = text(kit, 'approval.approved_on').trim();
  if (approvedOn === '' || Number.isNaN(Date.parse(approvedOn))) {
    block(
      'kit.approval_date_missing',
      'approval.approved_on',
      'approval.approved_on must be a valid date (yyyy-mm-dd).',
      'intake'
    );
  }
  if (!isTrue(kit, 'approval.final_files_confirmed')) {
    block(
      'kit.approval_files_unconfirmed',
      'approval.final_files_confirmed',
      'approval.final_files_confirmed must be true — these are the final files, with no watermark, no draft label and no placeholder copy.',
      'intake'
    );
  }
  if (!isTrue(kit, 'approval.retailer_links_opened')) {
    block(
      'kit.approval_links_unopened',
      'approval.retailer_links_opened',
      'approval.retailer_links_opened must be true — every retailer URL has been opened and confirmed to land on THIS book. No offline validator can check where a link goes.',
      'intake'
    );
  }

  return {
    kitName: input.kitName,
    title,
    slug: resolveKitSlug(kit),
    priceCents,
    isbn,
    blockers,
    warnings,
    ok: blockers.length === 0,
  };
}

// ---------------------------------------------------------------------------
// Batch — the checks that only exist across kits
// ---------------------------------------------------------------------------

/**
 * `books.slug` and `books.isbn` are both UNIQUE (supabase/migrations/
 * 20260116000000_initial_schema.sql). The admin UI sees one book at a time and
 * only learns about a clash when the insert fails, which at launch means a
 * half-migrated catalog. Intake sees the whole handover at once.
 */
export function validateAssetKitBatch(inputs: AssetKitInput[]): AssetKitBatchResult {
  const results = inputs.map((input) => validateAssetKit(input));

  const collide = (
    key: (r: AssetKitResult) => string | null,
    code: string,
    field: string,
    label: string
  ): void => {
    const groups = new Map<string, AssetKitResult[]>();
    for (const result of results) {
      const value = key(result);
      if (!value) continue;
      const bucket = groups.get(value);
      if (bucket) bucket.push(result);
      else groups.set(value, [result]);
    }
    for (const [value, group] of groups) {
      if (group.length < 2) continue;
      const names = group.map((r) => r.kitName).join(', ');
      for (const result of group) {
        result.blockers.push({
          severity: 'blocker',
          code,
          field,
          message: `${label} "${value}" is used by ${group.length} kits in this batch (${names}); the column is UNIQUE so only one can be created.`,
          source: 'intake',
        });
        result.ok = false;
      }
    }
  };

  collide((r) => r.slug || null, 'batch.slug_collision', 'slug', 'Slug');
  collide((r) => r.isbn, 'batch.isbn_collision', 'isbn', 'ISBN');

  const blockerCount = results.reduce((total, r) => total + r.blockers.length, 0);
  const warningCount = results.reduce((total, r) => total + r.warnings.length, 0);

  return { results, blockerCount, warningCount, ok: blockerCount === 0 };
}

// ---------------------------------------------------------------------------
// book.json parsing
// ---------------------------------------------------------------------------

/**
 * book.json ships to the publisher WITH comments — a field list nobody can read
 * in place is a field list that gets filled in wrong. JSON has no comment
 * syntax, so `//` and block comments are stripped before parsing.
 *
 * String-aware on purpose: `https://amazon.example/...` contains `//` and must
 * survive untouched. Trailing commas are NOT swallowed — that is a genuine JSON
 * error and the publisher should see it.
 */
export function stripJsonComments(source: string): string {
  let out = '';
  let inString = false;
  let escaped = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i];
    const next = source[i + 1];

    if (inLineComment) {
      if (ch === '\n') {
        inLineComment = false;
        out += ch;
      }
      continue;
    }
    if (inBlockComment) {
      if (ch === '*' && next === '/') {
        inBlockComment = false;
        i += 1;
      }
      continue;
    }
    if (inString) {
      out += ch;
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      out += ch;
      continue;
    }
    if (ch === '/' && next === '/') {
      inLineComment = true;
      i += 1;
      continue;
    }
    if (ch === '/' && next === '*') {
      inBlockComment = true;
      i += 1;
      continue;
    }
    out += ch;
  }

  return out;
}

export function parseKitJson(source: string): RawKit {
  const parsed: unknown = JSON.parse(stripJsonComments(source));
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('book.json must contain a single JSON object');
  }
  return parsed as RawKit;
}
