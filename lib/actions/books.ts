/* eslint-disable */
'use server';

import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath, revalidateTag } from 'next/cache';
import { revalidateBooks } from '@/lib/supabase/queries'; // PERF-PHASE2-2
import { z } from 'zod';
import {
  CreateBookSchema,
  UpdateBookSchema,
  type Book,
  type CreateBookInput,
  type UpdateBookInput,
} from '@/types/books';
import { isMongoPrimary } from '@/lib/db/provider';
import {
  createBookAdminMongo,
  createBookMongo,
  updateBookAdminMongo,
  updateBookMongo,
} from '@/lib/mongo-books';
import { getBookById } from '@/lib/mongo-queries';
import { recordAudit } from '@/lib/audit';
import { setBookAssets } from '@/lib/data/book-assets';
import {
  RETAILER_URL_FIELDS,
  nullableText,
  normalizeUrlFields,
  slugifyBookTitle,
  visibilityForStatus,
  type AdminBookStatus,
} from '@/lib/books/fields';

// Rate limiting
const RATE_LIMIT = new Map<string, { count: number; timestamp: number }>();

const checkRateLimit = (userId: string, action: string) => {
  const key = `${userId}:${action}`;
  const now = Date.now();
  const limit = RATE_LIMIT.get(key);

  if (limit) {
    if (now - limit.timestamp < 60000) {
      // 1 minute window
      if (limit.count >= 10) {
        // 10 requests per minute
        throw new Error('Rate limit exceeded. Please try again later.');
      }
      limit.count += 1;
    } else {
      RATE_LIMIT.set(key, { count: 1, timestamp: now });
    }
  } else {
    RATE_LIMIT.set(key, { count: 1, timestamp: now });
  }

  // Clean up old entries
  setTimeout(() => {
    RATE_LIMIT.delete(key);
  }, 60000);
};

/**
 * Audit logging (Task 1.2 — one audit system, not two).
 *
 * The local `logAudit` helper that used to live here wrote `resource_id` /
 * `resource_type` / `details`, columns that exist on no migration, and never
 * inspected the insert result — so every audit write failed silently. There is
 * one writer now: `recordAudit` (@/lib/audit), which is provider-aware and
 * writes real `audit_logs` columns through the service-role client (the table
 * has no INSERT RLS policy).
 *
 * A failed audit is logged loudly but does not fail the caller's write: losing
 * the book is worse than losing the audit row, and the gap is now visible.
 */
const audit = async (
  actorId: string,
  action: string,
  target: string,
  metadata: Record<string, unknown>
): Promise<void> => {
  const result = await recordAudit(actorId, action, target, metadata);
  if (!result.ok) {
    console.error(`[audit] ${action} on ${target} was not recorded: ${result.error}`);
  }
};

/*
 * SCHEMA NOTE — columns that actually exist on Supabase `books`
 * (20260116000000_initial_schema, + visibility 20260118000000,
 * + content_type 20260619124500, + retailer URLs 20260619170000).
 *
 * Every write below builds its payload from this set explicitly instead of
 * spreading validated input. Spreading wrote `subtitle`, `epub_url`,
 * `manuscript_url`, `author_name`, `metadata`, `tags`, `categories`,
 * `language`, `seo_*` and `deleted_at` — none of which exist — and PostgREST
 * rejects the WHOLE statement when a single column is unknown, so one drifted
 * field silently broke the entire write. New migrations are blocked until
 * hosted drift is reconciled (Task 3.6), so every disposition is code-side:
 * drop the field, or remap it onto a real column.
 */

/** EPUBs are assets, not book columns — `book_content.epub_url` on Supabase. */
const writeEpubAsset = async (bookId: string, epubUrl: string | null | undefined) => {
  if (epubUrl === undefined) return;
  const result = await setBookAssets(bookId, { epub_url: nullableText(epubUrl) });
  if (!result.ok) {
    console.error(`[books] epub asset write failed for ${bookId}: ${result.error}`);
  }
};

export async function createBook(input: CreateBookInput) {
  try {
    if (isMongoPrimary()) {
      const { getRequestUser } = await import('@/lib/api/request-user');
      const user = await getRequestUser();
      if (!user) {
        return { success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' };
      }
      checkRateLimit(user.id, 'create_book');
      const validated = CreateBookSchema.parse(input);
      const result = await createBookMongo({
        title: validated.title,
        description: validated.description,
        cover_url: validated.cover_url,
        manuscript_url: validated.manuscript_url,
        author_id: user.id,
        tags: validated.tags,
      });
      if ('error' in result) {
        return {
          success: false,
          error: result.error,
          code: result.code === 'DUPLICATE_SLUG' ? 'DUPLICATE_BOOK' : result.code,
        };
      }
      await writeEpubAsset(String(result.book._id), validated.epub_url);
      await audit(user.id, 'CREATE', String(result.book._id), {
        resource_type: 'books',
        title: result.book.title,
        status: result.book.status,
      });
      revalidatePath('/admin/books');
      revalidatePath('/books');
      revalidateTag('featured-books');
      revalidateBooks();
      return { success: true, data: result.book, code: 'BOOK_CREATED' };
    }

    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      return { success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' };
    }

    checkRateLimit(user.id, 'create_book');

    // Validate input
    const validated = CreateBookSchema.parse(input);

    // Slug derivation is shared with every other create path.
    const slug = slugifyBookTitle(validated.title);

    // Duplicate check. The old `.is('deleted_at', null)` filter referenced a
    // column that does not exist, so this query errored and every duplicate
    // read as "no duplicate".
    const { data: existingBook } = await supabase
      .from('books')
      .select('id')
      .eq('slug', slug)
      .eq('author_id', user.id)
      .maybeSingle();

    if (existingBook) {
      return {
        success: false,
        error: 'A book with this title already exists',
        code: 'DUPLICATE_BOOK',
      };
    }

    const { data, error } = await supabase
      .from('books')
      .insert({
        title: validated.title,
        slug,
        description: nullableText(validated.description),
        isbn: nullableText(validated.isbn),
        cover_url: nullableText(validated.cover_url),
        author_id: user.id,
      })
      .select()
      .single();

    if (error) throw error;

    // `books.manuscript_url` and `books.epub_url` exist in no migration; on
    // Supabase the readable file lives on `book_content.epub_url` (which is
    // what app/api/files/[id] serves), so route both inputs there.
    await writeEpubAsset(data.id, validated.epub_url ?? validated.manuscript_url);

    // Log audit
    await audit(user.id, 'CREATE', data.id, {
      resource_type: 'books',
      title: data.title,
      status: data.status,
    });

    revalidatePath('/admin/books');
    revalidatePath('/books');
    revalidateTag('featured-books');
    revalidateBooks(); // PERF-PHASE2-2

    return { success: true, data, code: 'BOOK_CREATED' };
  } catch (error) {
    console.error('Create book error:', error);

    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: 'Validation failed',
        details: error.errors,
        code: 'VALIDATION_ERROR',
      };
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create book',
      code: 'UNKNOWN_ERROR',
    };
  }
}

export async function updateBook(bookId: string, input: UpdateBookInput) {
  try {
    if (isMongoPrimary()) {
      const { getRequestUser } = await import('@/lib/api/request-user');
      const user = await getRequestUser();
      if (!user) {
        return { success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' };
      }
      checkRateLimit(user.id, 'update_book');
      const validated = UpdateBookSchema.parse(input);
      const existing = await getBookById(bookId);
      if (!existing || (String(existing.author_id) !== user.id && user.role !== 'admin')) {
        return { success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' };
      }
      const result = await updateBookMongo(bookId, {
        title: validated.title,
        description: validated.description,
        cover_url: validated.cover_url,
        manuscript_url: validated.manuscript_url,
        status: validated.status,
        slug: validated.slug,
        tags: validated.tags,
      });
      if ('error' in result) {
        return { success: false, error: result.error, code: result.code };
      }
      await writeEpubAsset(bookId, validated.epub_url);
      await audit(user.id, 'UPDATE', bookId, {
        resource_type: 'books',
        title: result.book.title,
      });
      revalidatePath('/admin/books');
      revalidatePath('/books');
      revalidatePath(`/books/${result.book.slug}`);
      revalidateTag('featured-books');
      revalidateBooks();
      return { success: true, data: result.book, code: 'BOOK_UPDATED' };
    }

    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      return { success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' };
    }

    checkRateLimit(user.id, 'update_book');

    // Validate input
    const validated = UpdateBookSchema.parse(input);

    // Check ownership and if book exists. `deleted_at` is gone: soft delete is
    // now expressed through the real `status` column (see deleteBook).
    const { data: book } = await supabase
      .from('books')
      .select('author_id')
      .eq('id', bookId)
      .maybeSingle();

    if (!book || book.author_id !== user.id) {
      return { success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' };
    }

    // Handle slug uniqueness if being updated
    if (validated.slug) {
      const { data: existingBook } = await supabase
        .from('books')
        .select('id')
        .eq('slug', validated.slug)
        .neq('id', bookId)
        .eq('author_id', user.id)
        .maybeSingle();

      if (existingBook) {
        return {
          success: false,
          error: 'Another book with this slug already exists',
          code: 'DUPLICATE_SLUG',
        };
      }
    }

    // Explicit allow-list of real columns (see the note above).
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (validated.title !== undefined) updates.title = validated.title;
    if (validated.description !== undefined) {
      updates.description = nullableText(validated.description);
    }
    if (validated.isbn !== undefined) updates.isbn = nullableText(validated.isbn);
    if (validated.cover_url !== undefined) updates.cover_url = nullableText(validated.cover_url);
    if (validated.page_count !== undefined) updates.page_count = validated.page_count;
    if (validated.word_count !== undefined) updates.word_count = validated.word_count;
    if (validated.slug !== undefined) updates.slug = validated.slug;
    if (validated.status !== undefined) {
      updates.status = validated.status;
      updates.visibility = visibilityForStatus(validated.status);
    }

    const { data, error } = await supabase
      .from('books')
      .update(updates)
      .eq('id', bookId)
      .select()
      .single();

    if (error) throw error;

    await writeEpubAsset(bookId, validated.epub_url ?? validated.manuscript_url);

    // Log audit
    await audit(user.id, 'UPDATE', bookId, {
      resource_type: 'books',
      changes: Object.keys(updates).filter((k) => k !== 'updated_at'),
      new_status: validated.status,
    });

    revalidatePath('/admin/books');
    revalidatePath(`/books/${bookId}`);
    revalidatePath(`/books/${data.slug}`);
    revalidateTag('featured-books');
    revalidateBooks(); // PERF-PHASE2-2

    return { success: true, data, code: 'BOOK_UPDATED' };
  } catch (error) {
    console.error('Update book error:', error);

    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: 'Validation failed',
        details: error.errors,
        code: 'VALIDATION_ERROR',
      };
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update book',
      code: 'UNKNOWN_ERROR',
    };
  }
}

/**
 * Admin-only book update. Unlike updateBook (author-scoped), this lets a user
 * with the 'admin' role edit ANY book, including the external retailer URLs.
 *
 * Task 1.0: authentication and the admin role check stay on Supabase (locked
 * architecture: AUTH_PROVIDER=supabase). Only the WRITE branches on
 * DATABASE_PROVIDER — before this, the write always went to Supabase while
 * production read MongoDB, so an edited book never changed on the site.
 *
 * `subtitle` is deliberately absent: `books.subtitle` exists in no migration
 * and new migrations are blocked until Task 3.6, so it is removed from the
 * admin surface rather than written to a column that is not there.
 */
export async function updateBookAdmin(
  bookId: string,
  input: {
    title?: string;
    description?: string;
    content_type?: 'book' | 'comic' | 'paper';
    slug?: string;
    price?: number;
    isbn?: string;
    genre?: string;
    page_count?: number;
    word_count?: number;
    status?: AdminBookStatus;
    cover_url?: string | null;
    epub_url?: string | null;
    amazon_url?: string | null;
    kindle_url?: string | null;
    apple_books_url?: string | null;
    audible_url?: string | null;
    barnes_noble_url?: string | null;
    google_play_books_url?: string | null;
  }
) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      return { success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' };
    }

    // Role check: role lives on profiles.role (same gate as requireAdmin).
    // profiles.id is its own UUID; the auth user id is profiles.user_id.
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (!profile || profile.role !== 'admin') {
      return { success: false, error: 'Admin access required', code: 'FORBIDDEN' };
    }

    checkRateLimit(user.id, 'update_book_admin');

    // Retailer links are external by contract: reject anything the PDP could
    // never render rather than storing a dead link.
    const { values: retailerUrls, issues } = normalizeUrlFields(
      input as Record<string, string | null | undefined>,
      RETAILER_URL_FIELDS
    );
    if (issues.length > 0) {
      return {
        success: false,
        error: `${issues[0].field}: ${issues[0].message}`,
        code: 'VALIDATION_ERROR',
      };
    }

    if (isMongoPrimary()) {
      const result = await updateBookAdminMongo(bookId, {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.slug !== undefined ? { slug: input.slug } : {}),
        ...(input.description !== undefined
          ? { description: nullableText(input.description) }
          : {}),
        ...(input.genre !== undefined ? { genre: nullableText(input.genre) } : {}),
        ...(input.price !== undefined ? { price: input.price } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.content_type !== undefined ? { content_type: input.content_type } : {}),
        ...(input.isbn !== undefined ? { isbn: nullableText(input.isbn) } : {}),
        ...(input.page_count !== undefined ? { page_count: input.page_count } : {}),
        ...(input.word_count !== undefined ? { word_count: input.word_count } : {}),
        ...(input.cover_url !== undefined ? { cover_url: nullableText(input.cover_url) } : {}),
        ...retailerUrls,
      });

      if ('error' in result) {
        return {
          success: false,
          error: result.error,
          code: result.code === 'VALIDATION' ? 'VALIDATION_ERROR' : result.code,
        };
      }

      await writeEpubAsset(bookId, input.epub_url);
      await audit(user.id, 'UPDATE', bookId, {
        resource_type: 'books',
        changes: Object.keys(input),
        admin: true,
      });

      revalidatePath('/admin/books');
      revalidatePath(`/books/${bookId}`);
      if (result.book?.slug) revalidatePath(`/books/${result.book.slug}`);
      revalidateTag('featured-books');
      revalidateBooks();

      return { success: true, data: result.book, code: 'BOOK_UPDATED' };
    }

    // Service-role client after role check — matches createBookAdmin / updateBookStatusAction.
    // There is no admin UPDATE RLS policy on books for the session client.
    const admin = createAdminClient();

    const { data: existing } = await admin
      .from('books')
      .select('id, status, published_at')
      .eq('id', bookId)
      .maybeSingle();

    if (!existing) {
      return { success: false, error: 'Book not found', code: 'NOT_FOUND' };
    }

    // Only write keys that were actually provided, and only real columns.
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (input.title !== undefined) updates.title = input.title;
    if (input.description !== undefined) updates.description = nullableText(input.description);
    if (input.content_type !== undefined) updates.content_type = input.content_type;
    if (input.slug !== undefined) updates.slug = input.slug;
    if (input.price !== undefined) updates.price = input.price;
    if (input.isbn !== undefined) updates.isbn = nullableText(input.isbn);
    if (input.genre !== undefined) updates.genre = nullableText(input.genre);
    if (input.page_count !== undefined) updates.page_count = input.page_count;
    if (input.word_count !== undefined) updates.word_count = input.word_count;
    if (input.cover_url !== undefined) updates.cover_url = nullableText(input.cover_url);
    Object.assign(updates, retailerUrls);

    if (input.status !== undefined) {
      updates.status = input.status;
      // The public catalog requires status=published AND visibility=public, and
      // the admin UI exposes status only, so visibility is derived from it.
      updates.visibility = visibilityForStatus(input.status);
      // Stamp the FIRST publication only. Unpublishing must never null
      // published_at — that destroys the original publication date.
      if (input.status === 'published' && !existing.published_at) {
        updates.published_at = new Date().toISOString();
      }
    }

    // Slug uniqueness across all books (admin is not author-scoped).
    if (typeof updates.slug === 'string') {
      const { data: dupe } = await admin
        .from('books')
        .select('id')
        .eq('slug', updates.slug)
        .neq('id', bookId)
        .maybeSingle();
      if (dupe) {
        return {
          success: false,
          error: 'Another book with this slug already exists',
          code: 'DUPLICATE_SLUG',
        };
      }
    }

    const { data, error } = await admin
      .from('books')
      .update(updates)
      .eq('id', bookId)
      .select()
      .single();

    if (error) throw error;

    await writeEpubAsset(bookId, input.epub_url);

    await audit(user.id, 'UPDATE', bookId, {
      resource_type: 'books',
      changes: Object.keys(updates).filter((k) => k !== 'updated_at'),
      admin: true,
    });

    revalidatePath('/admin/books');
    revalidatePath(`/books/${bookId}`);
    if (data?.slug) revalidatePath(`/books/${data.slug}`);
    revalidateTag('featured-books');
    revalidateBooks(); // PERF-PHASE2-2

    return { success: true, data, code: 'BOOK_UPDATED' };
  } catch (error) {
    console.error('Admin update book error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update book',
      code: 'UNKNOWN_ERROR',
    };
  }
}

/**
 * Admin-only book creation for /admin/books/new. Unlike createBook
 * (author-scoped, RLS requires author_id = auth.uid()), this lets an admin
 * create a book for any author (or none), so the Supabase insert uses the
 * service-role client after the role check passes.
 *
 * Task 1.0: the write branches on DATABASE_PROVIDER; auth stays on Supabase.
 */
export async function createBookAdmin(input: {
  title: string;
  slug?: string;
  description?: string;
  genre: string;
  price?: number;
  status?: AdminBookStatus;
  content_type?: 'book' | 'comic' | 'paper';
  author_id?: string | null;
  cover_url?: string | null;
  epub_url?: string | null;
}) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      return { success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' };
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (!profile || profile.role !== 'admin') {
      return { success: false, error: 'Admin access required', code: 'FORBIDDEN' };
    }

    checkRateLimit(user.id, 'create_book_admin');

    const title = (input.title || '').trim();
    const genre = (input.genre || '').trim();
    if (!title) {
      return { success: false, error: 'Title is required', code: 'VALIDATION_ERROR' };
    }
    if (!genre) {
      return { success: false, error: 'Genre is required', code: 'VALIDATION_ERROR' };
    }

    const slug = slugifyBookTitle(input.slug || title);
    if (!slug) {
      return {
        success: false,
        error: 'Slug could not be derived from title',
        code: 'VALIDATION_ERROR',
      };
    }

    const status: AdminBookStatus = input.status || 'draft';

    if (isMongoPrimary()) {
      const result = await createBookAdminMongo({
        title,
        slug,
        description: nullableText(input.description),
        genre,
        price: input.price ?? 0,
        status,
        content_type: input.content_type || 'book',
        author_id: input.author_id || null,
        cover_url: nullableText(input.cover_url),
      });

      if ('error' in result) {
        return {
          success: false,
          error: result.error,
          code: result.code === 'VALIDATION' ? 'VALIDATION_ERROR' : result.code,
        };
      }

      const bookId = String(result.book._id);
      await writeEpubAsset(bookId, input.epub_url);
      await audit(user.id, 'CREATE', bookId, {
        resource_type: 'books',
        title: result.book.title,
        status: result.book.status,
        admin: true,
      });

      revalidatePath('/admin/books');
      revalidatePath('/books');
      revalidateTag('featured-books');
      revalidateBooks();

      return { success: true, data: result.book, code: 'BOOK_CREATED' };
    }

    const admin = createAdminClient();

    const { data: dupe } = await admin.from('books').select('id').eq('slug', slug).maybeSingle();
    if (dupe) {
      return {
        success: false,
        error: 'A book with this slug already exists',
        code: 'DUPLICATE_SLUG',
      };
    }

    const { data, error } = await admin
      .from('books')
      .insert({
        title,
        slug,
        description: nullableText(input.description),
        genre,
        price: input.price ?? 0,
        status,
        // Derived, not exposed: the catalog needs published + public together.
        visibility: visibilityForStatus(status),
        content_type: input.content_type || 'book',
        author_id: input.author_id || null,
        cover_url: nullableText(input.cover_url),
        published_at: status === 'published' ? new Date().toISOString() : null,
      })
      .select()
      .single();

    if (error) throw error;

    await writeEpubAsset(data.id, input.epub_url);

    await audit(user.id, 'CREATE', data.id, {
      resource_type: 'books',
      title: data.title,
      status: data.status,
      admin: true,
    });

    revalidatePath('/admin/books');
    revalidatePath('/books');
    revalidateTag('featured-books');
    revalidateBooks(); // PERF-PHASE2-2

    return { success: true, data, code: 'BOOK_CREATED' };
  } catch (error) {
    console.error('Admin create book error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create book',
      code: 'UNKNOWN_ERROR',
    };
  }
}

/**
 * Delete a book. `hardDelete` still removes the row (admin only).
 *
 * The former "soft delete" wrote `books.deleted_at`, a column that exists in no
 * migration, so it never deleted anything — the statement was rejected. Soft
 * delete is now expressed through the real `status` column: `archived` plus a
 * non-public visibility takes the book out of every public read path without
 * destroying the row. Nothing that used to be a soft delete became a hard one.
 */
export async function deleteBook(bookId: string, hardDelete: boolean = false) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      return { success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' };
    }

    checkRateLimit(user.id, 'delete_book');

    const { data: book } = await supabase
      .from('books')
      .select('author_id, status')
      .eq('id', bookId)
      .maybeSingle();

    if (!book || book.author_id !== user.id) {
      return { success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' };
    }

    if (hardDelete && user.user_metadata?.role !== 'admin') {
      return { success: false, error: 'Admin required for hard delete', code: 'ADMIN_REQUIRED' };
    }

    if (hardDelete) {
      // Hard delete (admin only)
      const { error } = await supabase.from('books').delete().eq('id', bookId);

      if (error) throw error;
    } else {
      // Archive (the replacement for the never-working soft delete)
      const { error } = await supabase
        .from('books')
        .update({
          status: 'archived',
          visibility: visibilityForStatus('archived'),
          updated_at: new Date().toISOString(),
        })
        .eq('id', bookId);

      if (error) throw error;
    }

    // Log audit
    await audit(user.id, hardDelete ? 'HARD_DELETE' : 'SOFT_DELETE', bookId, {
      resource_type: 'books',
    });

    revalidatePath('/admin/books');
    revalidatePath('/books');
    revalidateTag('featured-books');
    revalidateBooks(); // PERF-PHASE2-2

    return { success: true, code: hardDelete ? 'BOOK_HARD_DELETED' : 'BOOK_SOFT_DELETED' };
  } catch (error) {
    console.error('Delete book error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete book',
      code: 'UNKNOWN_ERROR',
    };
  }
}

/** Restore an archived book to draft (the inverse of deleteBook's archive). */
export async function restoreBook(bookId: string) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      return { success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' };
    }

    const { data: book } = await supabase
      .from('books')
      .select('author_id, status')
      .eq('id', bookId)
      .maybeSingle();

    if (!book || book.author_id !== user.id) {
      return { success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' };
    }

    if (book.status !== 'archived') {
      return { success: false, error: 'Book is not archived', code: 'NOT_DELETED' };
    }

    const { error } = await supabase
      .from('books')
      .update({
        status: 'draft', // Reset to draft when restoring
        visibility: visibilityForStatus('draft'),
        updated_at: new Date().toISOString(),
      })
      .eq('id', bookId);

    if (error) throw error;

    // Log audit
    await audit(user.id, 'RESTORE', bookId, { resource_type: 'books' });

    revalidatePath('/admin/books');
    revalidatePath('/books');
    revalidateTag('featured-books');
    revalidateBooks(); // PERF-PHASE2-2

    return { success: true, code: 'BOOK_RESTORED' };
  } catch (error) {
    console.error('Restore book error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to restore book',
      code: 'UNKNOWN_ERROR',
    };
  }
}

export async function getMyBooks(options?: {
  status?: Book['status'];
  limit?: number;
  offset?: number;
}) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' };

    let query = supabase
      .from('books')
      .select('*', { count: 'exact' })
      .eq('author_id', user.id)
      .order('created_at', { ascending: false });

    if (options?.status) {
      query = query.eq('status', options.status);
    }

    // No `deleted_at` filter: the column does not exist. Archived books are
    // still the author's books and stay visible in their own list.

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
    }

    const { data, error, count } = await query;

    if (error) throw error;

    return {
      success: true,
      data,
      count: count || 0,
      code: 'BOOKS_FETCHED',
    };
  } catch (error) {
    console.error('Get my books error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch books',
      code: 'UNKNOWN_ERROR',
    };
  }
}

/*
 * Removed in Task 1.2 (schema drift, code-side dispositions):
 *
 * - `searchBooks` built a raw SQL string it never executed and then called the
 *   RPC `books_search`, which exists in no migration. Nothing imported it: the
 *   catalog uses `searchBooks` from `@/lib/mongo-queries` (via lib/data/books)
 *   and `@/lib/supabase/queries` — same name, different modules.
 * - `getBookStats` selected `books.view_count` / `books.download_count` /
 *   `books.review_count` and a `book_stats` table; none exist (the real columns
 *   are `total_reads` / `total_reviews` / `average_rating`, and the real table
 *   is `book_stats_daily`). It had no callers, so it is removed rather than
 *   half-remapped onto a daily table with a monthly response shape.
 * - `incrementViewCount` wrote `book_view_cache` / `book_views` and called the
 *   RPC `increment_view_count`; none exist, it swallowed its own errors, and it
 *   had no callers.
 *
 * All three are restorable from git history once Task 3.6 unblocks migrations.
 */
