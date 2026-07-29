#!/usr/bin/env tsx
/**
 * Catalog duplicate / QA-seed audit (Task 1.6) — DRY RUN BY DEFAULT.
 *
 * Reports duplicate and QA/seed catalog records under BOTH data providers
 * (MongoDB primary per DATABASE_PROVIDER=mongodb, and legacy Supabase) using
 * the deterministic keys in `scripts/lib/catalog-dupes.ts`:
 *   slug · ISBN · normalized title+author · known seed marker
 *
 * SAFETY
 *   - Dry run is the default. Nothing is written unless BOTH `--execute` and a
 *     matching `--confirm=<token>` are supplied; the token is derived from the
 *     exact candidate set, so a stale token cannot authorize a changed plan.
 *   - Only provably QA/seed or provably-duplicate (non-survivor) records are
 *     ever listed as candidates.
 *   - An author is never removed while any book still references it.
 *   - Read-only credentials are sufficient for the default dry run.
 *
 * Usage:
 *   npm run catalog:seed-audit                        # dry run, both providers
 *   npm run catalog:seed-audit -- --provider=mongodb
 *   npm run catalog:seed-audit -- --json
 *   npm run catalog:seed-audit -- --execute --confirm=CONFIRM-<n>-<fingerprint>
 */

import { MongoClient, ObjectId } from 'mongodb';
import { createClient } from '@supabase/supabase-js';
import { loadDotEnvLocal } from './lib/env-file';
import {
  buildCleanupPlan,
  isExecutionAuthorized,
  type CatalogRecord,
  type CleanupPlan,
} from './lib/catalog-dupes';

type ProviderChoice = 'mongodb' | 'supabase' | 'both';

function flag(name: string): string | undefined {
  const prefixed = `--${name}`;
  const argv = process.argv.slice(2);
  const exact = argv.indexOf(prefixed);
  if (exact >= 0) {
    const next = argv[exact + 1];
    return next && !next.startsWith('--') ? next : '';
  }
  const inline = argv.find((a) => a.startsWith(`${prefixed}=`));
  return inline ? inline.slice(prefixed.length + 1) : undefined;
}

const hasFlag = (name: string) => flag(name) !== undefined;

async function loadMongoRecords(): Promise<CatalogRecord[]> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.warn('  MongoDB SKIPPED — MONGODB_URI is not set.');
    return [];
  }
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db(process.env.MONGODB_DB || 'mangu');

    const authors = await db
      .collection('authors')
      .find({}, { projection: { pen_name: 1, created_at: 1 } })
      .toArray();
    const authorNameById = new Map<string, string>();
    for (const author of authors) {
      authorNameById.set(String(author._id), String(author.pen_name ?? ''));
    }

    const books = await db
      .collection('books')
      .find({}, { projection: { title: 1, slug: 1, isbn: 1, author_id: 1, created_at: 1 } })
      .toArray();

    const records: CatalogRecord[] = [];
    for (const author of authors) {
      records.push({
        id: String(author._id),
        provider: 'mongodb',
        collection: 'authors',
        authorName: (author.pen_name as string) ?? null,
        createdAt: author.created_at ? new Date(author.created_at as Date).toISOString() : null,
      });
    }
    for (const book of books) {
      records.push({
        id: String(book._id),
        provider: 'mongodb',
        collection: 'books',
        title: (book.title as string) ?? null,
        slug: (book.slug as string) ?? null,
        isbn: (book.isbn as string) ?? null,
        authorName: authorNameById.get(String(book.author_id)) ?? null,
        createdAt: book.created_at ? new Date(book.created_at as Date).toISOString() : null,
      });
    }
    return records;
  } finally {
    await client.close();
  }
}

async function loadSupabaseRecords(): Promise<CatalogRecord[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.warn(
      '  Supabase SKIPPED — NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set.'
    );
    return [];
  }
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const { data: authors, error: authorsError } = await supabase
    .from('authors')
    .select('id, pen_name, created_at');
  if (authorsError) {
    console.warn(`  Supabase authors read failed: ${authorsError.message}`);
  }
  const { data: books, error: booksError } = await supabase
    .from('books')
    .select('id, title, slug, isbn, author_id, created_at');
  if (booksError) {
    console.warn(`  Supabase books read failed: ${booksError.message}`);
  }

  const authorNameById = new Map<string, string>();
  for (const author of authors ?? []) authorNameById.set(String(author.id), author.pen_name ?? '');

  const records: CatalogRecord[] = [];
  for (const author of authors ?? []) {
    records.push({
      id: String(author.id),
      provider: 'supabase',
      collection: 'authors',
      authorName: author.pen_name ?? null,
      createdAt: author.created_at ?? null,
    });
  }
  for (const book of books ?? []) {
    records.push({
      id: String(book.id),
      provider: 'supabase',
      collection: 'books',
      title: book.title ?? null,
      slug: book.slug ?? null,
      isbn: book.isbn ?? null,
      authorName: authorNameById.get(String(book.author_id)) ?? null,
      createdAt: book.created_at ?? null,
    });
  }
  return records;
}

/**
 * Refuse to remove an author that any book (candidate or not) still points at.
 * Returns the blocked author ids.
 */
function authorsStillReferenced(plan: CleanupPlan, allRecords: CatalogRecord[]): Set<string> {
  const survivingBookAuthors = new Set<string>();
  const candidateIds = new Set(plan.candidates.map((c) => c.record.id));
  for (const record of allRecords) {
    if (record.collection !== 'books') continue;
    if (candidateIds.has(record.id)) continue;
    if (record.authorName) survivingBookAuthors.add(record.authorName.trim().toLowerCase());
  }
  const blocked = new Set<string>();
  for (const candidate of plan.candidates) {
    if (candidate.record.collection !== 'authors') continue;
    const name = candidate.record.authorName?.trim().toLowerCase();
    if (name && survivingBookAuthors.has(name)) blocked.add(candidate.record.id);
  }
  return blocked;
}

function printPlan(plan: CleanupPlan, blockedAuthors: Set<string>): void {
  console.log('\n── Before / after counts ──────────────────────────────────');
  if (plan.counts.length === 0) console.log('  (no records read)');
  for (const count of plan.counts) {
    console.log(
      `  ${count.provider.padEnd(9)} ${count.collection.padEnd(8)} ` +
        `before=${count.before}  after=${count.after}  removed=${count.before - count.after}`
    );
  }

  console.log('\n── Duplicate groups ───────────────────────────────────────');
  if (plan.duplicateGroups.length === 0) console.log('  none');
  for (const group of plan.duplicateGroups) {
    console.log(
      `  [${group.provider}/${group.collection}] ${group.kind} = "${group.key}" ` +
        `→ keep ${group.survivor.id}, duplicates: ${group.duplicates.map((d) => d.id).join(', ')}`
    );
  }

  console.log('\n── QA / seed records ──────────────────────────────────────');
  if (plan.seedMatches.length === 0) console.log('  none');
  for (const match of plan.seedMatches) {
    console.log(`  [${match.record.provider}/${match.record.collection}] ${match.record.id} — ${match.reason}`);
  }

  console.log('\n── Cleanup candidates ─────────────────────────────────────');
  if (plan.candidates.length === 0) console.log('  none');
  for (const candidate of plan.candidates) {
    const blocked = blockedAuthors.has(candidate.record.id) ? '  [BLOCKED: still referenced by a book]' : '';
    console.log(`  ${candidate.record.id} (${candidate.record.provider}/${candidate.record.collection}) — ${candidate.reason}${blocked}`);
  }

  console.log(`\n  Confirmation token for --execute: ${plan.confirmationToken}`);
}

async function deleteCandidates(plan: CleanupPlan, blockedAuthors: Set<string>): Promise<void> {
  const mongoIds = plan.candidates.filter(
    (c) => c.record.provider === 'mongodb' && !blockedAuthors.has(c.record.id)
  );
  const supabaseIds = plan.candidates.filter(
    (c) => c.record.provider === 'supabase' && !blockedAuthors.has(c.record.id)
  );

  if (mongoIds.length > 0 && process.env.MONGODB_URI) {
    const client = new MongoClient(process.env.MONGODB_URI);
    try {
      await client.connect();
      const db = client.db(process.env.MONGODB_DB || 'mangu');
      for (const candidate of mongoIds) {
        const result = await db
          .collection(candidate.record.collection)
          .deleteOne({ _id: new ObjectId(candidate.record.id) });
        console.log(`  mongodb ${candidate.record.collection} ${candidate.record.id} deleted=${result.deletedCount}`);
      }
    } finally {
      await client.close();
    }
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (supabaseIds.length > 0 && url && key) {
    const supabase = createClient(url, key, { auth: { persistSession: false } });
    for (const candidate of supabaseIds) {
      const { error } = await supabase
        .from(candidate.record.collection)
        .delete()
        .eq('id', candidate.record.id);
      console.log(
        `  supabase ${candidate.record.collection} ${candidate.record.id} ${error ? `FAILED: ${error.message}` : 'deleted'}`
      );
    }
  }
}

async function main(): Promise<void> {
  loadDotEnvLocal();

  const provider = (flag('provider') || 'both') as ProviderChoice;
  const execute = hasFlag('execute');
  const confirm = flag('confirm') || undefined;
  const jsonOutput = hasFlag('json');

  console.log('MANGU catalog duplicate / QA-seed audit');
  console.log(`  mode:     ${execute ? 'EXECUTE (requested)' : 'DRY RUN (default)'}`);
  console.log(`  provider: ${provider}\n`);

  const records: CatalogRecord[] = [];
  if (provider === 'mongodb' || provider === 'both') records.push(...(await loadMongoRecords()));
  if (provider === 'supabase' || provider === 'both') records.push(...(await loadSupabaseRecords()));

  const plan = buildCleanupPlan(records);
  const blockedAuthors = authorsStillReferenced(plan, records);

  if (jsonOutput) {
    console.log(JSON.stringify({ ...plan, blockedAuthors: [...blockedAuthors] }, null, 2));
  } else {
    printPlan(plan, blockedAuthors);
  }

  const authorization = isExecutionAuthorized(plan, { execute, confirm });
  console.log(`\n${authorization.message}`);

  if (!authorization.authorized) {
    process.exit(0);
  }

  console.log('\n── Executing deletions ────────────────────────────────────');
  await deleteCandidates(plan, blockedAuthors);
  console.log('Done. Re-run the dry run to verify the after counts.');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
