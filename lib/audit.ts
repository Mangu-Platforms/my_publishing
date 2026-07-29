/**
 * Audit log writer — Phoenix WS2c Task 2c.2.
 *
 * `recordAudit(actorId, action, target, metadata)` → `audit_logs` insert.
 * Dual-run: Mongo when DATABASE_PROVIDER=mongodb; else Supabase `audit_logs`.
 *
 * This is the ONLY audit writer. `lib/actions/books.ts` used to carry a second,
 * local `logAudit` helper that wrote `resource_id` / `resource_type` / `details`
 * — none of which exist on the table — and never checked the insert result, so
 * every admin audit write failed silently. Task 1.2 consolidated both here.
 */

import '@/lib/server-only-guard';

import type { Db } from 'mongodb';
import { createClient as createAdminClient } from '@/lib/supabase/admin';
import { isMongoPrimary } from '@/lib/db/provider';
import { getDb } from '@/lib/mongo';

export type AuditMetadata = Record<string, unknown>;

/**
 * The exact column list of Supabase `audit_logs`
 * (migration 20260118000000_critical_fixes.sql):
 *   id, user_id, action, table_name, record_id, old_data, new_data,
 *   ip_address, user_agent, created_at
 *
 * Exported so tests can assert no write drifts outside it. Adding a column is
 * not an option while hosted migration drift is unreconciled (Task 3.6).
 */
export const AUDIT_LOG_COLUMNS = [
  'user_id',
  'action',
  'table_name',
  'record_id',
  'old_data',
  'new_data',
  'ip_address',
  'user_agent',
  'created_at',
] as const;

/** Keys whose VALUE must never be persisted to an audit row. */
const SECRET_KEY_PATTERN =
  /(token|password|passwd|secret|api[_-]?key|authorization|credential|signature|cvv)/i;

/**
 * Private asset URLs are effectively capability tokens (signed download links,
 * unlisted manuscript locations). Record that the field changed, not the URL.
 */
const PRIVATE_URL_KEY_PATTERN =
  /(manuscript_url|epub_url|pdf_url|audio_url|file_url|download_url|signed_url)/i;

function redactAuditValue(key: string, value: unknown, depth: number): unknown {
  if (SECRET_KEY_PATTERN.test(key)) return '[redacted]';
  if (PRIVATE_URL_KEY_PATTERN.test(key) && typeof value === 'string' && value.length > 0) {
    return '[redacted-url]';
  }
  if (depth < 3 && value !== null && typeof value === 'object' && !Array.isArray(value)) {
    return redactAuditMetadata(value as AuditMetadata, depth + 1);
  }
  return value;
}

/** Strip secrets and private file URLs before anything reaches the log store. */
export function redactAuditMetadata(metadata: AuditMetadata, depth = 0): AuditMetadata {
  const safe: AuditMetadata = {};
  for (const [key, value] of Object.entries(metadata)) {
    safe[key] = redactAuditValue(key, value, depth);
  }
  return safe;
}

export async function recordAudit(
  actorId: string,
  action: string,
  target: string,
  metadata: AuditMetadata = {},
  db?: Db
): Promise<{ ok: true } | { ok: false; error: string }> {
  const trimmedAction = action.trim();
  const trimmedTarget = target.trim();
  if (!actorId || !trimmedAction || !trimmedTarget) {
    return { ok: false, error: 'actorId, action, and target are required' };
  }

  const now = new Date();
  const safeMetadata = redactAuditMetadata(metadata);

  try {
    if (isMongoPrimary()) {
      const database = db ?? (await getDb());
      await database.collection('audit_logs').insertOne({
        actor_id: actorId,
        action: trimmedAction,
        target: trimmedTarget,
        metadata: safeMetadata,
        created_at: now,
      });
      return { ok: true };
    }

    // `audit_logs` has an admin SELECT policy and NO INSERT policy, so this has
    // to go through the service-role client (which bypasses RLS). A session
    // client would be silently rejected by RLS.
    const admin = createAdminClient();
    // `resource_type` is the caller's carrier for the audited table; it maps to
    // the real `table_name` column. `target` maps to `record_id`, and the rest
    // of the metadata maps to `new_data` (the old `details` column never
    // existed). `old_data` is left unset until callers pass a before-image.
    const { resource_type: resourceType, ...rest } = safeMetadata;
    const { error } = await admin.from('audit_logs').insert({
      user_id: actorId,
      action: trimmedAction,
      table_name: typeof resourceType === 'string' ? resourceType : 'unknown',
      record_id: trimmedTarget,
      new_data: rest,
      created_at: now.toISOString(),
    });
    if (error) {
      // Surfaced to the caller AND logged: an audit gap that nobody can see is
      // worse than the write that caused it.
      console.error('[audit] recordAudit failed:', error.message);
      return { ok: false, error: error.message };
    }
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'audit write failed';
    console.error('[audit] recordAudit failed:', message);
    return { ok: false, error: message };
  }
}
