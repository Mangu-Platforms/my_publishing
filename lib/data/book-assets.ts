/**
 * Provider-aware book asset writer/reader (Task 2.1 / 2.2).
 *
 * The admin write actions call `setBookAssets` after an upload has been
 * CONFIRMED by storage, so a failed or cancelled upload can never leave a
 * published record pointing at an object that does not exist.
 *
 * Where the values live:
 *
 *   MongoDB (production `DATABASE_PROVIDER`)
 *     All six fields are plain fields on the book document — see
 *     `MONGO_BOOK_EXTRA_WRITE_FIELDS` in lib/books/fields.ts. Written through
 *     `updateBookAdminMongo` so slug/lifecycle invariants stay in one place.
 *
 *   Supabase
 *     `cover_url` is a real column on `books` (20260116000000_initial_schema).
 *     `epub_url`, `audio_url` and the TOC live on `book_content(book_id,
 *     epub_url, pdf_url, audio_url, toc)` from the same migration. This module
 *     is the first `book_content` writer in the repo; RLS has no INSERT policy
 *     for that table (20260708074716_enable_rls_on_exposed_tables.sql only
 *     enables RLS), so the service-role client is required.
 *
 *     `book_content.book_id` has NO unique constraint, so PostgREST `upsert`
 *     with `onConflict: 'book_id'` would fail. We therefore select-then-
 *     insert-or-update, which is also what keeps the row count at one.
 *
 *     There are no `narrator` / `duration` columns anywhere in Supabase, and
 *     new migrations are blocked until Task 3.6, so those two values ride
 *     inside the free-form `toc` JSONB as `{ chapters, narrator,
 *     duration_seconds }`. `components/audio/parse-chapters.ts` already accepts
 *     the `{ chapters: [...] }` envelope, so the chapter contract is unchanged.
 */

import '@/lib/server-only-guard';

import { isMongoPrimary } from '@/lib/db/provider';
import { isValidExternalUrl, nullableText } from '@/lib/books/fields';

export type BookAssetPatch = {
  cover_url?: string | null;
  epub_url?: string | null;
  audio_url?: string | null;
  audio_toc?: unknown;
  audio_narrator?: string | null;
  audio_duration_seconds?: number | null;
};

type SetResult = { ok: true } | { ok: false; error: string };

const URL_KEYS = ['cover_url', 'epub_url', 'audio_url'] as const;

const URL_LABELS: Record<(typeof URL_KEYS)[number], string> = {
  cover_url: 'Cover image',
  epub_url: 'EPUB file',
  audio_url: 'Audio sample',
};

/**
 * Server-side re-validation of every asset reference.
 *
 * The forms run the same https rule before submitting; this is the copy that
 * actually protects the database when the form is bypassed.
 */
function normalizeAssetPatch(patch: BookAssetPatch): { values: BookAssetPatch } | { error: string } {
  const values: BookAssetPatch = {};

  for (const key of URL_KEYS) {
    if (!(key in patch)) continue;
    const normalized = nullableText(patch[key]);
    if (normalized !== null && !isValidExternalUrl(normalized)) {
      return { error: `${URL_LABELS[key]} must be a full https:// URL` };
    }
    values[key] = normalized;
  }

  if ('audio_narrator' in patch) {
    values.audio_narrator = nullableText(patch.audio_narrator);
  }

  if ('audio_duration_seconds' in patch) {
    const raw = patch.audio_duration_seconds;
    if (raw == null) {
      values.audio_duration_seconds = null;
    } else if (!Number.isFinite(raw) || raw <= 0 || !Number.isInteger(raw)) {
      return { error: 'Audio sample length must be a whole number of seconds' };
    } else {
      values.audio_duration_seconds = raw;
    }
  }

  if ('audio_toc' in patch) values.audio_toc = patch.audio_toc;

  return { values };
}

// ---------------------------------------------------------------------------
// Supabase `book_content.toc` envelope
// ---------------------------------------------------------------------------

type TocEnvelope = { chapters?: unknown; narrator?: string | null; duration_seconds?: number | null };

function buildTocPayload(
  existingToc: unknown,
  values: BookAssetPatch,
  touchesToc: boolean,
  touchesNarrator: boolean,
  touchesDuration: boolean
): unknown {
  const existing: TocEnvelope =
    existingToc && typeof existingToc === 'object' && !Array.isArray(existingToc)
      ? { ...(existingToc as TocEnvelope) }
      : { chapters: existingToc ?? undefined };

  if (touchesToc) existing.chapters = values.audio_toc ?? undefined;
  if (touchesNarrator) existing.narrator = values.audio_narrator ?? null;
  if (touchesDuration) existing.duration_seconds = values.audio_duration_seconds ?? null;

  const hasChapters = existing.chapters !== undefined && existing.chapters !== null;
  const hasNarrator = existing.narrator != null && existing.narrator !== '';
  const hasDuration = existing.duration_seconds != null;

  if (!hasChapters && !hasNarrator && !hasDuration) return null;
  // Plain array when there is nothing else to carry — keeps legacy rows simple.
  if (hasChapters && !hasNarrator && !hasDuration) return existing.chapters;
  return existing;
}

function readTocEnvelope(toc: unknown): {
  audio_toc: unknown;
  audio_narrator: string | null;
  audio_duration_seconds: number | null;
} {
  if (toc && typeof toc === 'object' && !Array.isArray(toc)) {
    const envelope = toc as TocEnvelope;
    const narrator = typeof envelope.narrator === 'string' ? envelope.narrator : null;
    const duration =
      typeof envelope.duration_seconds === 'number' && Number.isFinite(envelope.duration_seconds)
        ? envelope.duration_seconds
        : null;
    // Only unwrap when this really is our envelope; other shapes ({items:[…]})
    // are handed back untouched so parse-chapters keeps working.
    const isEnvelope = 'chapters' in envelope || narrator !== null || duration !== null;
    return {
      audio_toc: isEnvelope ? (envelope.chapters ?? null) : toc,
      audio_narrator: narrator,
      audio_duration_seconds: duration,
    };
  }
  return { audio_toc: toc ?? null, audio_narrator: null, audio_duration_seconds: null };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function setBookAssets(bookId: string, patch: BookAssetPatch): Promise<SetResult> {
  const id = String(bookId ?? '').trim();
  if (!id) return { ok: false, error: 'A book id is required' };

  const normalized = normalizeAssetPatch(patch);
  if ('error' in normalized) return { ok: false, error: normalized.error };
  const values = normalized.values;
  if (Object.keys(values).length === 0) return { ok: true };

  if (isMongoPrimary()) {
    try {
      const { updateBookAdminMongo } = await import('@/lib/mongo-books');
      // Cast at the boundary: the asset field set is defined by
      // MONGO_BOOK_EXTRA_WRITE_FIELDS, while AdminBookWriteInput types the full
      // admin payload. Casting here keeps this module decoupled from the exact
      // optionality of every unrelated admin field.
      const result = await updateBookAdminMongo(
        id,
        values as Parameters<typeof updateBookAdminMongo>[1]
      );
      if (result && 'error' in result) return { ok: false, error: result.error };
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : 'Failed to save book assets',
      };
    }
  }

  try {
    const { createClient } = await import('@/lib/supabase/admin');
    const admin = createClient();

    if ('cover_url' in values) {
      const { error } = await admin
        .from('books')
        .update({ cover_url: values.cover_url, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) return { ok: false, error: error.message };
    }

    const touchesToc = 'audio_toc' in values;
    const touchesNarrator = 'audio_narrator' in values;
    const touchesDuration = 'audio_duration_seconds' in values;
    const touchesContent =
      'epub_url' in values || 'audio_url' in values || touchesToc || touchesNarrator || touchesDuration;

    if (!touchesContent) return { ok: true };

    const { data: existing, error: readError } = await admin
      .from('book_content')
      .select('id, epub_url, audio_url, toc')
      .eq('book_id', id)
      .limit(1)
      .maybeSingle();
    if (readError) return { ok: false, error: readError.message };

    const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if ('epub_url' in values) row.epub_url = values.epub_url;
    if ('audio_url' in values) row.audio_url = values.audio_url;
    if (touchesToc || touchesNarrator || touchesDuration) {
      row.toc = buildTocPayload(
        existing?.toc ?? null,
        values,
        touchesToc,
        touchesNarrator,
        touchesDuration
      );
    }

    if (existing?.id) {
      const { error } = await admin.from('book_content').update(row).eq('id', existing.id);
      if (error) return { ok: false, error: error.message };
      return { ok: true };
    }

    const { error } = await admin.from('book_content').insert({ ...row, book_id: id });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to save book assets' };
  }
}

export async function getBookAssets(bookId: string): Promise<BookAssetPatch> {
  const empty: BookAssetPatch = {
    cover_url: null,
    epub_url: null,
    audio_url: null,
    audio_toc: null,
    audio_narrator: null,
    audio_duration_seconds: null,
  };

  const id = String(bookId ?? '').trim();
  if (!id) return empty;

  if (isMongoPrimary()) {
    try {
      const { getAdminBookMongo } = await import('@/lib/mongo-books');
      const book = (await getAdminBookMongo(id)) as Record<string, unknown> | null;
      if (!book) return empty;
      const duration = book.audio_duration_seconds;
      return {
        cover_url: (book.cover_url as string | null | undefined) ?? null,
        epub_url: (book.epub_url as string | null | undefined) ?? null,
        audio_url: (book.audio_url as string | null | undefined) ?? null,
        audio_toc: book.audio_toc ?? null,
        audio_narrator: (book.audio_narrator as string | null | undefined) ?? null,
        audio_duration_seconds: typeof duration === 'number' ? duration : null,
      };
    } catch {
      return empty;
    }
  }

  try {
    const { createClient } = await import('@/lib/supabase/admin');
    const admin = createClient();

    const { data: book } = await admin.from('books').select('cover_url').eq('id', id).maybeSingle();
    const { data: content } = await admin
      .from('book_content')
      .select('epub_url, audio_url, toc')
      .eq('book_id', id)
      .limit(1)
      .maybeSingle();

    const { audio_toc, audio_narrator, audio_duration_seconds } = readTocEnvelope(
      content?.toc ?? null
    );

    return {
      cover_url: (book?.cover_url as string | null | undefined) ?? null,
      epub_url: (content?.epub_url as string | null | undefined) ?? null,
      audio_url: (content?.audio_url as string | null | undefined) ?? null,
      audio_toc,
      audio_narrator,
      audio_duration_seconds,
    };
  } catch {
    return empty;
  }
}
