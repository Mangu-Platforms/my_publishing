#!/usr/bin/env tsx
/**
 * Phoenix §8.3 — capture writes that happened inside the migration window.
 *
 * Between the P11.1 export and the Phase 13 DNS cutover, the public site is
 * still serving from Supabase, so rows keep being written. Those writes exist in
 * Supabase but not in the freshly-imported MongoDB. This script captures that
 * divergence so it can be replayed forward (or, on rollback, so the Mongo-side
 * writes can be replayed back into Supabase).
 *
 * Run it twice, in both directions:
 *
 *   # what Supabase gained since the export snapshot
 *   SUPABASE_DB_URL=… npm run phoenix:delta -- --since 2026-07-25T00:00:00Z --source supabase
 *
 *   # what MongoDB gained since cutover began (rollback divergence)
 *   MONGODB_URI=… npm run phoenix:delta -- --since 2026-07-25T00:00:00Z --source mongo
 *
 * Output: export/delta-<source>-<timestamp>/<collection>.json plus a summary
 * delta-report.json. Read-only against both databases — it never writes to
 * Supabase or Mongo.
 */

import { execFileSync } from 'child_process';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';
import { loadDotEnvLocal } from './lib/env-file';

function argValue(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  return idx >= 0 && idx + 1 < process.argv.length ? process.argv[idx + 1] : undefined;
}

/** Tables/collections whose rows users can create while the freeze is on. */
const SUPABASE_TARGETS: Array<{ name: string; sql: (since: string) => string }> = [
  {
    name: 'auth_users',
    sql: (since) => `
      SELECT id, email, email_confirmed_at, created_at, updated_at, raw_user_meta_data
      FROM auth.users
      WHERE created_at > '${since}' OR updated_at > '${since}'`,
  },
  {
    name: 'profiles',
    sql: (since) =>
      `SELECT * FROM public.profiles WHERE created_at > '${since}' OR updated_at > '${since}'`,
  },
  {
    name: 'books',
    sql: (since) =>
      `SELECT * FROM public.books WHERE created_at > '${since}' OR updated_at > '${since}'`,
  },
  {
    name: 'orders_raw',
    sql: (since) => `
      SELECT o.id AS order_id, o.order_number, o.user_id AS profile_id, o.total_amount,
             o.status, o.payment_intent_id, o.created_at, o.updated_at,
             oi.id AS order_item_id, oi.book_id, oi.unit_price, oi.license_key
      FROM public.orders o
      LEFT JOIN public.order_items oi ON oi.order_id = o.id
      WHERE o.created_at > '${since}' OR o.updated_at > '${since}'`,
  },
  {
    name: 'reviews',
    sql: (since) =>
      `SELECT * FROM public.reviews WHERE created_at > '${since}' OR updated_at > '${since}'`,
  },
  {
    name: 'reading_progress',
    sql: (since) => `
      SELECT * FROM public.reading_progress
      WHERE created_at > '${since}' OR updated_at > '${since}' OR last_accessed > '${since}'`,
  },
];

const MONGO_TARGETS: Array<{ collection: string; dateFields: string[] }> = [
  { collection: 'user', dateFields: ['createdAt', 'updatedAt'] },
  { collection: 'profiles', dateFields: ['created_at', 'updated_at'] },
  { collection: 'books', dateFields: ['created_at', 'updated_at'] },
  { collection: 'orders', dateFields: ['created_at', 'updated_at'] },
  { collection: 'reviews', dateFields: ['created_at', 'updated_at'] },
  { collection: 'reading_progress', dateFields: ['created_at', 'updated_at', 'last_accessed'] },
  { collection: 'audit_logs', dateFields: ['created_at'] },
];

async function exportFromSupabase(since: string, outDir: string): Promise<Record<string, number>> {
  const dbUrl = process.env.SUPABASE_DB_URL;
  if (!dbUrl) throw new Error('SUPABASE_DB_URL is required for --source supabase');

  const counts: Record<string, number> = {};
  for (const target of SUPABASE_TARGETS) {
    // -A -t writes the raw scalar; \copy would apply COPY text escaping and
    // corrupt the JSON (same reason export-supabase.sh avoids it).
    const stdout = execFileSync(
      'psql',
      [
        dbUrl,
        '-X',
        '-A',
        '-t',
        '-v',
        'ON_ERROR_STOP=1',
        '-c',
        `SELECT coalesce(json_agg(row_to_json(t)), '[]'::json) FROM (${target.sql(since)}) t`,
      ],
      { encoding: 'utf8', maxBuffer: 512 * 1024 * 1024 }
    );

    const rows = JSON.parse(stdout.trim() || '[]') as unknown[];
    counts[target.name] = rows.length;
    writeFileSync(join(outDir, `${target.name}.json`), `${JSON.stringify(rows, null, 2)}\n`);
    console.log(`  ${target.name.padEnd(20)} ${rows.length}`);
  }
  return counts;
}

async function exportFromMongo(since: string, outDir: string): Promise<Record<string, number>> {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required for --source mongo');

  const { getDb } = await import('../lib/mongodb');
  const db = await getDb();
  const sinceDate = new Date(since);

  const counts: Record<string, number> = {};
  for (const target of MONGO_TARGETS) {
    const rows = await db
      .collection(target.collection)
      .find({ $or: target.dateFields.map((f) => ({ [f]: { $gt: sinceDate } })) })
      .toArray();

    counts[target.collection] = rows.length;
    writeFileSync(join(outDir, `${target.collection}.json`), `${JSON.stringify(rows, null, 2)}\n`);
    console.log(`  ${target.collection.padEnd(20)} ${rows.length}`);
  }
  return counts;
}

async function main(): Promise<void> {
  loadDotEnvLocal();

  const since = argValue('--since');
  const source = (argValue('--source') ?? 'supabase').toLowerCase();

  if (!since) {
    console.error(
      'Usage: npm run phoenix:delta -- --since <ISO timestamp> [--source supabase|mongo]\n' +
        '  --since should be the moment the P11.1 export snapshot was taken.'
    );
    process.exit(1);
  }
  if (Number.isNaN(new Date(since).getTime())) {
    console.error(`--since is not a valid timestamp: ${since}`);
    process.exit(1);
  }
  if (source !== 'supabase' && source !== 'mongo') {
    console.error(`--source must be "supabase" or "mongo", got "${source}"`);
    process.exit(1);
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outDir = resolve(process.cwd(), 'export', `delta-${source}-${stamp}`);
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

  console.log('');
  console.log(`Phoenix delta capture — source=${source}, since=${since}`);
  console.log(`Output: ${outDir}`);
  console.log('');

  const counts =
    source === 'supabase'
      ? await exportFromSupabase(since, outDir)
      : await exportFromMongo(since, outDir);

  const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
  writeFileSync(
    join(outDir, 'delta-report.json'),
    `${JSON.stringify({ source, since, captured_at: new Date().toISOString(), counts, total }, null, 2)}\n`
  );

  console.log('');
  console.log(`  total diverged rows: ${total}`);
  console.log('');
  if (total === 0) {
    console.log('No divergence in the window — safe to proceed.');
  } else {
    console.log(
      'Divergence captured. Replay these rows before declaring cutover complete\n' +
        '(forward) or before restoring Supabase as primary (rollback). Attach\n' +
        'delta-report.json to the P11.6 reconciliation record.'
    );
  }
}

main().catch((error) => {
  console.error(`[export-delta] ${error instanceof Error ? error.message : error}`);
  process.exit(1);
});
