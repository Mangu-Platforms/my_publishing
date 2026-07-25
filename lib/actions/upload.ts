/* eslint-disable */
// Phoenix WS3 — dual-run upload action (Supabase Storage → Vercel Blob)
'use server';

import { createHash } from 'crypto';
import { UPLOAD_CONFIGS, type UploadResult } from '@/types/upload';
import { isBlobPrimary } from '@/lib/storage/provider';

// ─── Vercel Blob path ───────────────────────────────────────────────────────

async function uploadToBlob(
  file: File,
  userId: string,
  bucket: string,
  hash: string
): Promise<UploadResult> {
  const { put } = await import('@vercel/blob');

  const fileExt = file.name.split('.').pop();
  const fileName = `${hash}.${fileExt}`;
  const blobPath = `${userId}/${bucket}/${fileName}`;
  const fileBuffer = Buffer.from(await file.arrayBuffer());

  const blob = await put(blobPath, fileBuffer, {
    access: 'public',
    contentType: file.type,
    addRandomSuffix: false,
  });

  return {
    filePath: blobPath,
    publicUrl: blob.url,
    fileName: file.name,
    fileSize: file.size,
    mimeType: file.type,
    hash,
    metadata: { provider: 'vercel-blob', deduplicated: false },
  };
}

// ─── Supabase Storage path (legacy) ─────────────────────────────────────────

async function uploadToSupabase(
  file: File,
  userId: string,
  bucket: 'book-covers' | 'manuscripts' | 'published-epubs',
  hash: string
): Promise<UploadResult> {
  const { createClient } = await import('@/lib/supabase/server');
  const supabase = await createClient();

  const fileExt = file.name.split('.').pop();
  const fileName = `${hash}.${fileExt}`;
  const filePath = `${userId}/${fileName}`;
  const fileBuffer = Buffer.from(await file.arrayBuffer());

  const { data: existing } = await supabase.storage
    .from(bucket)
    .list(userId, { search: fileName });
  const alreadyUploaded = existing?.some((obj) => obj.name === fileName) ?? false;

  if (!alreadyUploaded) {
    const { error } = await supabase.storage.from(bucket).upload(filePath, fileBuffer, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type,
    });
    if (error && !/already exists|duplicate/i.test(error.message)) throw error;
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(bucket).getPublicUrl(filePath);

  return {
    filePath,
    publicUrl,
    fileName: file.name,
    fileSize: file.size,
    mimeType: file.type,
    hash,
    metadata: { provider: 'supabase', deduplicated: alreadyUploaded },
  };
}

// ─── Auth helper (dual-run) ──────────────────────────────────────────────────

async function getAuthenticatedUserId(): Promise<string> {
  const { isBetterAuthPrimary } = await import('@/lib/auth/provider');

  if (isBetterAuthPrimary()) {
    const { auth } = await import('@/lib/auth');
    const { headers } = await import('next/headers');
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) throw new Error('Unauthorized');
    return session.user.id;
  }

  const { createClient } = await import('@/lib/supabase/server');
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) throw new Error('Unauthorized');
  return user.id;
}

// ─── Public API ──────────────────────────────────────────────────────────────

export async function uploadFile(
  file: File,
  bucket: 'book-covers' | 'manuscripts' | 'published-epubs',
  _onProgress?: (progress: number) => void
): Promise<UploadResult> {
  const userId = await getAuthenticatedUserId();

  const configKey =
    bucket === 'book-covers' ? 'cover' : bucket === 'manuscripts' ? 'manuscript' : 'epub';
  const config = UPLOAD_CONFIGS[configKey];
  if (!config) throw new Error('Invalid bucket');
  if (file.size > config.maxSize)
    throw new Error(`File size exceeds ${config.maxSize / (1024 * 1024)}MB limit`);

  const fileBuffer = Buffer.from(await file.arrayBuffer());
  const hash = createHash('sha256').update(fileBuffer).digest('hex');

  if (isBlobPrimary()) {
    return uploadToBlob(file, userId, bucket, hash);
  }
  return uploadToSupabase(file, userId, bucket, hash);
}

export async function deleteFile(bucket: string, filePath: string): Promise<{ success: boolean }> {
  await getAuthenticatedUserId();

  if (isBlobPrimary()) {
    const { del } = await import('@vercel/blob');
    await del(filePath);
    return { success: true };
  }

  const { createClient } = await import('@/lib/supabase/server');
  const supabase = await createClient();
  const { error } = await supabase.storage.from(bucket).remove([filePath]);
  if (error) throw error;
  return { success: true };
}
