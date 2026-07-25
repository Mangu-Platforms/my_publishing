/**
 * Dual-run admin users list (Phoenix WS2d.1).
 * Default: Supabase admin client. Mongo when DATABASE_PROVIDER=mongodb.
 * Mongo source: `profiles` (display_name → full_name).
 */

import '@/lib/server-only-guard';

import { isMongoPrimary } from '@/lib/db/provider';

export type AdminUserListItem = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: string;
  subscription_tier: string | null;
  created_at: string;
};

export type ListAdminUsersResult = {
  users: AdminUserListItem[];
  error: { message: string } | null;
};

const DEFAULT_LIMIT = 50;

/**
 * Admin users table — newest first, default limit 50.
 * Preserves Supabase shape used by the admin users page.
 */
export async function listAdminUsers(opts?: { limit?: number }): Promise<ListAdminUsersResult> {
  const limit = Math.min(100, Math.max(1, Math.floor(opts?.limit ?? DEFAULT_LIMIT)));

  if (isMongoPrimary()) {
    try {
      const { getDb } = await import('@/lib/mongo');
      const db = await getDb();

      const rows = await db
        .collection('profiles')
        .find({})
        .sort({ created_at: -1, _id: 1 })
        .limit(limit)
        .toArray();

      const users: AdminUserListItem[] = rows.map((row) => {
        const created =
          row.created_at instanceof Date
            ? row.created_at.toISOString()
            : String(row.created_at ?? '');
        const displayName =
          typeof row.display_name === 'string'
            ? row.display_name
            : typeof row.full_name === 'string'
              ? row.full_name
              : null;
        const tier = typeof row.subscription_tier === 'string' ? row.subscription_tier : null;

        return {
          id: String(row._id),
          email: typeof row.email === 'string' ? row.email : null,
          full_name: displayName,
          role: String(row.role ?? 'reader'),
          subscription_tier: tier,
          created_at: created,
        };
      });

      return { users, error: null };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Mongo admin users query failed';
      return { users: [], error: { message } };
    }
  }

  const { createClient } = await import('@/lib/supabase/admin');
  const supabase = createClient();

  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, role, subscription_tier, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    return { users: [], error: { message: error.message } };
  }

  const users: AdminUserListItem[] = ((data as AdminUserListItem[] | null) || []).map((row) => ({
    id: String(row.id),
    email: row.email ?? null,
    full_name: row.full_name ?? null,
    role: String(row.role ?? 'reader'),
    subscription_tier: row.subscription_tier ?? null,
    created_at: String(row.created_at ?? ''),
  }));

  return { users, error: null };
}
