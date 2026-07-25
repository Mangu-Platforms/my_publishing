/**
 * Phoenix WS3.4 — Supabase Storage → Vercel Blob migration script.
 *
 * Copies every cover_url and manuscript_url from Supabase Storage to Vercel
 * Blob, then rewrites the MongoDB documents to point at the new Blob URLs.
 * Idempotent: already-migrated URLs (containing blob.vercel-storage.com) are
 * skipped. Run with DRY_RUN=1 to preview without making changes.
 *
 * Usage:
 *   SUPABASE_SERVICE_ROLE_KEY=... BLOB_READ_WRITE_TOKEN=... MONGODB_URI=... \
 *     npx tsx scripts/migrate-storage.ts
 *
 * Requires:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   BLOB_READ_WRITE_TOKEN
 *   MONGODB_URI
 *   MONGODB_DB (optional, default: mangu)
 */

import { createClient } from '@supabase/supabase-js';
import { put } from '@vercel/blob';
import { MongoClient } from 'mongodb';

const DRY_RUN = process.env.DRY_RUN === '1';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const mongoUri = process.env.MONGODB_URI;
const mongoDb = process.env.MONGODB_DB || 'mangu';

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
if (!mongoUri) {
  console.error('Missing MONGODB_URI');
  process.exit(1);
}
if (!process.env.BLOB_READ_WRITE_TOKEN) {
  console.error('Missing BLOB_READ_WRITE_TOKEN');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

interface MigrationResult {
  total: number;
  migrated: number;
  skipped: number;
  failed: number;
  errors: Array<{ bookId: string; field: string; url: string; error: string }>;
}

function isBlobUrl(url: string): boolean {
  return url.includes('blob.vercel-storage.com');
}

async function downloadFromSupabase(url: string): Promise<Buffer | null> {
  try {
    // Supabase Storage URLs end with /storage/v1/object/public/<bucket>/<path>
    const match = url.match(/\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/(.+)/);
    if (!match) {
      // Fall back to direct fetch for any signed or custom URL
      const res = await fetch(url);
      if (!res.ok) return null;
      return Buffer.from(await res.arrayBuffer());
    }

    const [, bucket, path] = match;
    const { data, error } = await supabase.storage.from(bucket).download(path);
    if (error || !data) return null;
    return Buffer.from(await data.arrayBuffer());
  } catch {
    return null;
  }
}

async function migrateUrl(
  url: string,
  blobPath: string,
  contentType: string
): Promise<string | null> {
  if (DRY_RUN) {
    console.log(`  [dry-run] would upload → ${blobPath}`);
    return `https://dry-run.public.blob.vercel-storage.com/${blobPath}`;
  }

  const buffer = await downloadFromSupabase(url);
  if (!buffer) return null;

  const blob = await put(blobPath, buffer, {
    access: 'public',
    contentType,
    addRandomSuffix: false,
  });
  return blob.url;
}

async function run(): Promise<void> {
  console.log(`\n🚀 MANGU Storage Migration — ${DRY_RUN ? 'DRY RUN' : 'LIVE'}\n`);

  const mongo = new MongoClient(mongoUri!);
  await mongo.connect();
  const db = mongo.db(mongoDb);
  const books = db.collection('books');

  const result: MigrationResult = {
    total: 0,
    migrated: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  };

  const cursor = books.find(
    {
      $or: [
        { cover_url: { $exists: true, $ne: null } },
        { manuscript_url: { $exists: true, $ne: null } },
      ],
    },
    { projection: { _id: 1, cover_url: 1, manuscript_url: 1 } }
  );

  for await (const book of cursor) {
    result.total++;
    const bookId = String(book._id);
    const updates: Record<string, string> = {};

    for (const field of ['cover_url', 'manuscript_url'] as const) {
      const url = book[field] as string | null | undefined;
      if (!url) continue;

      if (isBlobUrl(url)) {
        console.log(`  ⏭  ${bookId} ${field} already on Blob`);
        result.skipped++;
        continue;
      }

      const ext = url.split('.').pop()?.split('?')[0] || (field === 'cover_url' ? 'jpg' : 'epub');
      const contentType =
        field === 'cover_url' ? `image/${ext === 'jpg' ? 'jpeg' : ext}` : 'application/epub+zip';
      const blobPath = `books/${bookId}/${field}.${ext}`;

      console.log(`  ⬆  ${bookId} ${field} → ${blobPath}`);
      const newUrl = await migrateUrl(url, blobPath, contentType);

      if (!newUrl) {
        console.error(`  ✗  ${bookId} ${field} download failed`);
        result.failed++;
        result.errors.push({ bookId, field, url, error: 'download failed' });
        continue;
      }

      updates[field] = newUrl;
      result.migrated++;
    }

    if (Object.keys(updates).length > 0 && !DRY_RUN) {
      await books.updateOne({ _id: book._id }, { $set: updates });
    }
  }

  await mongo.close();

  console.log('\n─────────────────────────────────────────');
  console.log(`Total books scanned : ${result.total}`);
  console.log(`Fields migrated     : ${result.migrated}`);
  console.log(`Fields skipped      : ${result.skipped}`);
  console.log(`Failures            : ${result.failed}`);
  if (result.errors.length > 0) {
    console.log('\nFailure details:');
    result.errors.forEach((e) => console.log(`  ${e.bookId} ${e.field}: ${e.error}`));
  }
  console.log(result.failed === 0 ? '\n✅ Migration complete — 0 failures' : '\n⚠️  Completed with failures — re-run to retry');

  if (result.failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
