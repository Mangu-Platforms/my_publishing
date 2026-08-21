/**
 * Author-ownership resolution for API routes.
 *
 * books.author_id references authors.id (initial_schema:61) — never
 * profiles.id and never the auth uid — so ownership checks must resolve the
 * caller's authors rows through profiles before comparing. Comparing against
 * the wrong id domain either locks real owners out or, worse, lets the check
 * pass vacuously (the pre-fix NULL-owner PATCH bypass).
 *
 * Supabase-only by design: the books API routes authenticate through the
 * Supabase session today (WS2b). When their auth goes dual-run, this helper
 * grows a Better Auth/Mongo branch alongside.
 */

import { createClient as createAdminClient } from '@/lib/supabase/admin';

/**
 * The caller's authors.id values (a profile can hold multiple pen names).
 * Empty array when the caller has no authors row — callers must fail closed.
 */
export async function resolveCallerAuthorIds(profileId: string): Promise<string[]> {
  const admin = createAdminClient();
  const { data, error } = await admin.from('authors').select('id').eq('profile_id', profileId);
  if (error || !data) return [];
  return data.map((row) => row.id);
}
