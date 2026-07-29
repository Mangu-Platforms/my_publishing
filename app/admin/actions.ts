'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@/lib/supabase/admin';
import { recordAudit } from '@/lib/audit';
import { isMongoPrimary } from '@/lib/db/provider';
import { setBookStatusMongo } from '@/lib/mongo-books';
import { isAdminBookStatus, visibilityForStatus } from '@/lib/books/fields';

type Role = 'reader' | 'author' | 'partner' | 'admin';
type ManuscriptStatus = 'accepted' | 'rejected';
type OrderStatus = 'pending' | 'processing' | 'completed' | 'cancelled' | 'refunded';

async function requireAdminForAction() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return { ok: false as const, error: 'Unauthorized' };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, user_id, role')
    .eq('user_id', user.id)
    .single();

  if (!profile || profile.role !== 'admin') {
    return { ok: false as const, error: 'Admin access required' };
  }

  return { ok: true as const, user, profile };
}

function valueFrom(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === 'string' ? value : '';
}

/**
 * Audit failures used to be discarded at every call site here. They are still
 * non-fatal — the state change already happened — but they are no longer
 * invisible.
 */
async function audit(
  actorId: string,
  action: string,
  target: string,
  metadata: Record<string, unknown>
) {
  const result = await recordAudit(actorId, action, target, metadata);
  if (!result.ok) {
    console.error(`[audit] ${action} on ${target} was not recorded: ${result.error}`);
  }
}

export async function updateBookStatusAction(formData: FormData) {
  const auth = await requireAdminForAction();
  if (!auth.ok) return;

  const id = valueFrom(formData, 'bookId');
  const status = valueFrom(formData, 'status');
  // Aligned to ADMIN_BOOK_STATUSES (draft | published | archived). This action
  // used to accept draft|published only, while the edit form offers archived —
  // so archiving from any surface that posts here was silently a no-op.
  if (!id || !isAdminBookStatus(status)) {
    return;
  }

  if (isMongoPrimary()) {
    // Task 1.0: production runs DATABASE_PROVIDER=mongodb and the catalog reads
    // MongoDB, but this action wrote Supabase unconditionally — publishing a
    // book from the admin UI could never make it appear on the site.
    const result = await setBookStatusMongo(id, status);
    if ('error' in result) return;
  } else {
    const admin = createAdminClient();

    const { data: existing } = await admin
      .from('books')
      .select('published_at')
      .eq('id', id)
      .maybeSingle();

    const updates: Record<string, unknown> = {
      status,
      // The public catalog requires status=published AND visibility=public.
      visibility: visibilityForStatus(status),
      updated_at: new Date().toISOString(),
    };

    // Stamp the FIRST publication only. This used to set published_at to null
    // on unpublish, destroying the original publication date.
    if (status === 'published' && !existing?.published_at) {
      updates.published_at = new Date().toISOString();
    }

    const { error } = await admin.from('books').update(updates).eq('id', id);

    if (error) return;
  }

  await audit(auth.user.id, 'content.approve', id, {
    resource_type: 'books',
    status,
  });
  revalidatePath('/admin/books');
  revalidatePath('/books');
  revalidateTag('featured-books');
}

export async function updateUserRoleAction(formData: FormData) {
  const auth = await requireAdminForAction();
  if (!auth.ok) return;

  const profileId = valueFrom(formData, 'profileId');
  const role = valueFrom(formData, 'role') as Role;
  if (!profileId || !['reader', 'author', 'partner', 'admin'].includes(role)) {
    return;
  }

  const admin = createAdminClient();
  const { data: target, error: targetError } = await admin
    .from('profiles')
    .select('id, user_id')
    .eq('id', profileId)
    .single();

  if (targetError || !target) return;
  if (target.user_id === auth.user.id && role !== 'admin') {
    return;
  }

  const { error } = await admin
    .from('profiles')
    .update({ role, updated_at: new Date().toISOString() })
    .eq('id', profileId);

  if (error) return;
  await audit(auth.user.id, 'user.role_change', profileId, {
    resource_type: 'profiles',
    role,
    target_user_id: target.user_id,
  });
  revalidatePath('/admin/users');
}

export async function updateManuscriptStatusAction(formData: FormData) {
  const auth = await requireAdminForAction();
  if (!auth.ok) return;

  const id = valueFrom(formData, 'manuscriptId');
  const status = valueFrom(formData, 'status') as ManuscriptStatus;
  if (!id || !['accepted', 'rejected'].includes(status)) {
    return;
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from('manuscripts')
    .update({
      status,
      editorial_notes: status === 'accepted' ? 'Approved by admin' : 'Rejected by admin',
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) return;
  await audit(auth.user.id, status === 'accepted' ? 'content.approve' : 'content.reject', id, {
    resource_type: 'manuscripts',
    status,
  });
  revalidatePath('/admin/manuscripts');
}

export async function updateOrderStatusAction(formData: FormData) {
  const auth = await requireAdminForAction();
  if (!auth.ok) return;

  const id = valueFrom(formData, 'orderId');
  const status = valueFrom(formData, 'status') as OrderStatus;
  if (!id || !['pending', 'processing', 'completed', 'cancelled', 'refunded'].includes(status)) {
    return;
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from('orders')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) return;
  revalidatePath('/admin/orders');
}
