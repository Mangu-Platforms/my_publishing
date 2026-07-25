/**
 * Phoenix WS3.3 — Secure manuscript download proxy.
 *
 * GET /api/files/[id]
 *
 * Verifies the requesting user has purchased the book (or is admin/author-owner)
 * before streaming the manuscript. Never exposes the raw Blob/Supabase URL to
 * the client.
 *
 * Auth: dual-run (Supabase session or Better Auth session).
 * Data: dual-run (Supabase or MongoDB).
 */

import { NextResponse } from 'next/server';
import { isBetterAuthPrimary } from '@/lib/auth/provider';
import { isMongoPrimary } from '@/lib/db/provider';

export const dynamic = 'force-dynamic';

async function getSessionUserId(request: Request): Promise<string | null> {
  try {
    if (isBetterAuthPrimary()) {
      const { auth } = await import('@/lib/auth');
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

async function getBookManuscriptUrl(
  bookId: string
): Promise<{ manuscript_url: string | null; author_id: string } | null> {
  if (isMongoPrimary()) {
    const { getBookById } = await import('@/lib/mongo-queries');
    const book = await getBookById(bookId);
    if (!book) return null;
    return {
      manuscript_url: book.manuscript_url ?? null,
      author_id: String(book.author_id),
    };
  }

  const { createClient } = await import('@/lib/supabase/admin');
  const admin = createClient();
  const { data } = await admin
    .from('books')
    .select('manuscript_url, author_id')
    .eq('id', bookId)
    .maybeSingle();
  if (!data) return null;
  return { manuscript_url: data.manuscript_url ?? null, author_id: data.author_id };
}

async function userHasPurchased(userId: string, bookId: string): Promise<boolean> {
  if (isMongoPrimary()) {
    const { getDb } = await import('@/lib/mongodb');
    const db = await getDb();
    const order = await db.collection('orders').findOne({
      user_id: userId,
      status: 'completed',
      'order_items.book_id': bookId,
    });
    return order !== null;
  }

  const { createClient } = await import('@/lib/supabase/admin');
  const admin = createClient();
  const { data } = await admin
    .from('order_items')
    .select('id, orders!inner(user_id, status)')
    .eq('book_id', bookId)
    .eq('orders.user_id', userId)
    .eq('orders.status', 'completed')
    .limit(1)
    .maybeSingle();
  return data !== null;
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
  const { data } = await admin
    .from('profiles')
    .select('role')
    .eq('user_id', userId)
    .maybeSingle();
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
  const book = await getBookManuscriptUrl(bookId);
  if (!book) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (!book.manuscript_url) {
    return NextResponse.json({ error: 'No manuscript available' }, { status: 404 });
  }

  // 3. Authorisation: admin, or author-owner, or paying customer
  const role = await getUserRole(userId);
  const isAdmin = role === 'admin';
  const isAuthorOwner = book.author_id === userId;
  const hasPurchased = !isAdmin && !isAuthorOwner && (await userHasPurchased(userId, bookId));

  if (!isAdmin && !isAuthorOwner && !hasPurchased) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // 4. Stream file — never redirect to the raw URL
  try {
    const upstream = await fetch(book.manuscript_url);
    if (!upstream.ok) {
      return NextResponse.json({ error: 'File unavailable' }, { status: 502 });
    }

    const contentType =
      upstream.headers.get('content-type') || 'application/octet-stream';
    const contentLength = upstream.headers.get('content-length');

    const headers: Record<string, string> = {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="manuscript-${bookId}.epub"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    };
    if (contentLength) headers['Content-Length'] = contentLength;

    return new NextResponse(upstream.body, { status: 200, headers });
  } catch {
    return NextResponse.json({ error: 'File unavailable' }, { status: 502 });
  }
}
