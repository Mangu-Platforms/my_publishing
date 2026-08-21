/**
 * Phoenix WS3.3 — Secure manuscript download proxy.
 *
 * GET /api/files/[id]
 *
 * Verifies the requesting user has purchased the book (or is admin/author-owner)
 * before streaming the manuscript. Never exposes the raw Blob/Supabase URL to
 * the client.
 *
 * Source of the file: MongoDB `books.manuscript_url`, or Supabase
 * `book_content.epub_url` (falling back to `pdf_url`).
 *
 * Auth: dual-run (Supabase session or Better Auth session).
 * Data: dual-run (Supabase or MongoDB).
 */

import { NextResponse } from 'next/server';
import { isBetterAuthPrimary } from '@/lib/auth/provider';
import { isMongoPrimary } from '@/lib/db/provider';
import { hasCompletedOrderForBook } from '@/lib/reading/entitlement';

export const dynamic = 'force-dynamic';

async function getSessionUserId(request: Request): Promise<string | null> {
  try {
    if (isBetterAuthPrimary()) {
      const { getAuth } = await import('@/lib/auth');
      const auth = await getAuth();
      const session = await auth.api.getSession({
        headers: new Headers(request.headers),
      });
      return session?.user?.id ?? null;
    }

    const { createClient } = await import('@/lib/supabase/server');
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user?.id ?? null;
  } catch {
    return null;
  }
}

type BookFile = { url: string | null; extension: string; author_id: string };

async function getBookFile(bookId: string): Promise<BookFile | null> {
  if (isMongoPrimary()) {
    const { getBookById } = await import('@/lib/mongo-queries');
    const book = await getBookById(bookId);
    if (!book) return null;
    // `manuscript_url` IS a real field on the Mongo book document.
    return {
      url: book.manuscript_url ?? null,
      extension: 'epub',
      author_id: String(book.author_id),
    };
  }

  const { createClient } = await import('@/lib/supabase/admin');
  const admin = createClient();
  const { data: book } = await admin
    .from('books')
    .select('author_id')
    .eq('id', bookId)
    .maybeSingle();
  if (!book) return null;

  // Task 1.2 drift: `books.manuscript_url` exists in NO migration. PostgREST
  // rejects the whole SELECT when one column is unknown, so this endpoint 404'd
  // for every book. The readable file lives on `book_content`
  // (migration 20260116000000_initial_schema): EPUB first, PDF as fallback.
  const { data: content } = await admin
    .from('book_content')
    .select('epub_url, pdf_url')
    .eq('book_id', bookId)
    .limit(1)
    .maybeSingle();

  const epubUrl = content?.epub_url ?? null;
  const pdfUrl = content?.pdf_url ?? null;
  return {
    url: epubUrl ?? pdfUrl,
    extension: epubUrl ? 'epub' : 'pdf',
    author_id: book.author_id,
  };
}

async function userHasPurchased(userId: string, bookId: string): Promise<boolean> {
  if (isMongoPrimary()) {
    // Mongo Order.user_id stores the *auth* user id (Phoenix A-6).
    const { getDb } = await import('@/lib/mongodb');
    const db = await getDb();
    const order = await db.collection('orders').findOne({
      user_id: userId,
      status: 'completed',
      'order_items.book_id': bookId,
    });
    return order !== null;
  }

  // Supabase orders.user_id stores profiles.id, NOT the auth user id (see
  // lib/reading/entitlement.ts) — resolve the profile first, else purchasers
  // can never match and every download 403s.
  const { createClient } = await import('@/lib/supabase/admin');
  const admin = createClient();
  const { data: profile, error } = await admin
    .from('profiles')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();
  if (error || !profile) return false;

  try {
    return await hasCompletedOrderForBook(admin, profile.id, bookId, userId);
  } catch {
    return false; // fail closed on lookup errors
  }
}

/**
 * True when the caller's authors row is the book's author.
 * books.author_id references authors.id in both providers — never the auth
 * user id — so the caller's authors row must be resolved before comparing.
 */
async function isAuthorOwner(userId: string, bookAuthorId: string): Promise<boolean> {
  if (!bookAuthorId) return false;

  if (isMongoPrimary()) {
    const [{ getDb }, { ObjectId }] = await Promise.all([
      import('@/lib/mongodb'),
      import('mongodb'),
    ]);
    const db = await getDb();
    const profile = await db.collection('profiles').findOne({ auth_user_id: userId });
    if (!profile) return false;
    // Constrain by BOTH the book's author id and the caller's profile — a
    // profile can hold multiple pen names, so a lookup by profile alone can
    // return the wrong row and 403 a real owner.
    const idMatchers: Array<Record<string, unknown>> = [{ _id: bookAuthorId as never }];
    if (/^[a-fA-F0-9]{24}$/.test(bookAuthorId)) {
      idMatchers.push({ _id: new ObjectId(bookAuthorId) as never });
    }
    const author = await db.collection('authors').findOne({
      $and: [
        { $or: idMatchers },
        { $or: [{ profile_id: profile._id as never }, { profile_id: String(profile._id) }] },
      ],
    });
    return author !== null;
  }

  const { createClient } = await import('@/lib/supabase/admin');
  const admin = createClient();
  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();
  if (profileError || !profile) return false;

  // Both constraints in one query — membership, not first-row equality.
  const { data: author, error: authorError } = await admin
    .from('authors')
    .select('id')
    .eq('profile_id', profile.id)
    .eq('id', bookAuthorId)
    .limit(1)
    .maybeSingle();
  return !authorError && author !== null;
}

async function getUserRole(userId: string): Promise<string> {
  if (isMongoPrimary()) {
    const { getDb } = await import('@/lib/mongodb');
    const db = await getDb();
    const profile = await db.collection('profiles').findOne({ auth_user_id: userId });
    return (profile?.role as string) ?? 'reader';
  }

  const { createClient } = await import('@/lib/supabase/admin');
  const admin = createClient();
  const { data } = await admin.from('profiles').select('role').eq('user_id', userId).maybeSingle();
  return (data?.role as string) ?? 'reader';
}

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  const bookId = params.id;

  // 1. Auth — must be logged in
  const userId = await getSessionUserId(request);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Fetch book
  const book = await getBookFile(bookId);
  if (!book) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (!book.url) {
    return NextResponse.json({ error: 'No manuscript available' }, { status: 404 });
  }

  // 3. Authorisation: admin, or author-owner, or paying customer
  const role = await getUserRole(userId);
  const isAdmin = role === 'admin';
  const ownsAsAuthor = !isAdmin && (await isAuthorOwner(userId, book.author_id));
  const hasPurchased = !isAdmin && !ownsAsAuthor && (await userHasPurchased(userId, bookId));

  if (!isAdmin && !ownsAsAuthor && !hasPurchased) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // 4. Stream file — never redirect to the raw URL
  try {
    const upstream = await fetch(book.url);
    if (!upstream.ok) {
      return NextResponse.json({ error: 'File unavailable' }, { status: 502 });
    }

    const contentType = upstream.headers.get('content-type') || 'application/octet-stream';
    const contentLength = upstream.headers.get('content-length');

    const headers: Record<string, string> = {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="manuscript-${bookId}.${book.extension}"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    };
    if (contentLength) headers['Content-Length'] = contentLength;

    return new NextResponse(upstream.body, { status: 200, headers });
  } catch {
    return NextResponse.json({ error: 'File unavailable' }, { status: 502 });
  }
}
