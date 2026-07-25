/**
 * Storage-provider switch for Phoenix WS3.
 *
 * STORAGE_PROVIDER=supabase|vercel-blob
 * Default: supabase — stays until WS3.4 migration script is run and
 * all object URLs are rewritten to Blob URLs in the DB.
 */

export type StorageProvider = 'supabase' | 'vercel-blob';

export function getStorageProvider(): StorageProvider {
  const raw = (process.env.STORAGE_PROVIDER || 'supabase').toLowerCase();
  if (raw === 'vercel-blob' || raw === 'blob') return 'vercel-blob';
  return 'supabase';
}

export function isBlobPrimary(): boolean {
  return getStorageProvider() === 'vercel-blob';
}
