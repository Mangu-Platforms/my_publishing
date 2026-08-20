/**
 * Phoenix WS2b.1.2 — Book get + patch
 * GET   /api/books/[id]
 * PATCH /api/books/[id]
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { enforceRateLimit, getClientIdentifier } from '@/lib/rate-limit';
import { resolveCallerAuthorIds } from '@/lib/api/author-scope';
import { fetchBookForApi, patchBookForApi } from '@/lib/data/books';
import { isMongoPrimary } from '@/lib/db/provider';

export const dynamic = 'force-dynamic';

const PatchBookSchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    slug: z.string().min(1).max(120).optional(),
    description: z.string().max(10000).optional(),
    genre: z.string().max(100).optional(),
    price: z.number().min(0).max(10000).optional(),
    status: z.enum(['draft', 'published', 'archived']).optional(),
    visibility: z.enum(['public', 'private', 'unlisted']).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'No fields to update' });

type RouteContext = { params: { id: string } };

async function rateLimit(request: NextRequest) {
  const result = await enforceRateLimit('api', getClientIdentifier(request));
  if (result.success) return null;
  return NextResponse.json(
    { error: 'rate_limited' },
    { status: result.reason === 'unavailable' ? 503 : 429, headers: result.headers }
  );
}

export async function GET(request: NextRequest, context: RouteContext) {
  const limited = await rateLimit(request);
  if (limited) return limited;

  try {
    const { id } = context.params;
    const book = await fetchBookForApi({ id });
    if (!book) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({
      success: true,
      book,
      provider: isMongoPrimary() ? 'mongodb' : 'supabase',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load book';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const limited = await rateLimit(request);
  if (limited) return limited;

  try {
    const { id } = context.params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!profile || !['author', 'admin', 'partner'].includes(profile.role)) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const existing = await fetchBookForApi({ id });
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    }

    // Ownership guard: books.author_id references authors.id, so resolve the
    // caller's authors rows before comparing. A NULL author_id (orphaned via
    // ON DELETE SET NULL) is admin-only — the old truthiness short-circuit
    // let any author/partner edit orphaned books.
    if (profile.role !== 'admin') {
      const ownAuthorIds = await resolveCallerAuthorIds(profile.id);
      if (!existing.author_id || !ownAuthorIds.includes(existing.author_id)) {
        return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
      }
    }

    const body = await request.json();
    const parsed = PatchBookSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message || 'Invalid body' },
        { status: 400 }
      );
    }

    const book = await patchBookForApi(id, parsed.data);
    if (!book) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, book });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update book';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
