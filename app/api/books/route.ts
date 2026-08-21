/**
 * Phoenix WS2b.1.1 — Books list + create
 * GET  /api/books — published public catalog (paginated)
 * POST /api/books — authenticated author/admin create
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { enforceRateLimit, getClientIdentifier } from '@/lib/rate-limit';
import { resolveCallerAuthorIds } from '@/lib/api/author-scope';
import { createBookForApi, listPublishedBooks } from '@/lib/data/books';
import { isMongoPrimary } from '@/lib/db/provider';

export const dynamic = 'force-dynamic';

const CreateBookSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(10000).optional(),
  genre: z.string().max(100).optional(),
  price: z.number().min(0).max(10000).optional(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
  visibility: z.enum(['public', 'private', 'unlisted']).optional(),
  slug: z.string().min(1).max(120).optional(),
  author_id: z.string().min(1).optional(),
});

async function rateLimit(request: NextRequest) {
  const result = await enforceRateLimit('api', getClientIdentifier(request));
  if (result.success) return null;
  return NextResponse.json(
    { error: 'rate_limited' },
    { status: result.reason === 'unavailable' ? 503 : 429, headers: result.headers }
  );
}

export async function GET(request: NextRequest) {
  const limited = await rateLimit(request);
  if (limited) return limited;

  try {
    const sp = request.nextUrl.searchParams;
    const page = Math.max(1, Number(sp.get('page') || 1) || 1);
    const perPage = Math.min(100, Math.max(1, Number(sp.get('perPage') || 20) || 20));
    const genre = sp.get('genre') || undefined;

    const result = await listPublishedBooks({ page, perPage, genre });
    return NextResponse.json({
      success: true,
      ...result,
      provider: isMongoPrimary() ? 'mongodb' : 'supabase',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to list books';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const limited = await rateLimit(request);
  if (limited) return limited;

  try {
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

    const body = await request.json();
    const parsed = CreateBookSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message || 'Invalid body' },
        { status: 400 }
      );
    }

    // Attribution guard: non-admins may only publish under their own
    // authors row; body author_id naming anyone else is rejected, not
    // silently reattributed.
    let authorId = parsed.data.author_id;
    if (profile.role !== 'admin') {
      const ownAuthorIds = await resolveCallerAuthorIds(profile.id);
      if (ownAuthorIds.length === 0) {
        return NextResponse.json(
          { success: false, error: 'No author profile for this account' },
          { status: 403 }
        );
      }
      if (authorId && !ownAuthorIds.includes(authorId)) {
        return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
      }
      authorId = authorId || ownAuthorIds[0];
    } else if (!authorId) {
      // profiles.id is not a valid books.author_id (FK → authors.id), so the
      // old fallback could never insert; require the target author instead.
      return NextResponse.json({ success: false, error: 'author_id is required' }, { status: 400 });
    }

    const book = await createBookForApi({
      ...parsed.data,
      author_id: authorId,
    });

    return NextResponse.json({ success: true, book }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create book';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
