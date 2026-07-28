#!/usr/bin/env tsx
/**
 * Supabase -> MongoDB book reconciliation, DRY RUN ONLY (Task 3.6 / issue #192).
 *
 * WHY THIS EXISTS
 * Production reads the catalog from MongoDB (DATABASE_PROVIDER=mongodb) while
 * auth/identity/orders stay on Supabase (AUTH_PROVIDER=supabase). Once admin
 * book writes became provider-aware, every book published through the admin UI
 * lands in MongoDB — which means any book row that only ever existed in
 * Supabase is now invisible to the production read path. This script measures
 * that gap. It does not close it.
 *
 * WHY THERE IS NO EXECUTE MODE
 * Writing books across stores is a destructive, hard-to-reverse operation on
 * live customer-facing data whose two sides may disagree. There is deliberately
 * no --execute, --apply, --write or --force flag anywhere in this file, and
 * passing one is a hard error. Any actual backfill requires a verified backup
 * and Renee's written approval, and belongs in a separate, reviewed change.
 *
 * Usage:
 *   tsx scripts/backfill-books-dry-run.ts
 *   tsx scripts/backfill-books-dry-run.ts --limit 50
 *   tsx scripts/backfill-books-dry-run.ts --json
 *
 * Reads only. Uses the repository's existing helpers and existing env var
 * names — NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, MONGODB_URI,
 * MONGODB_DB. It introduces no new environment variables.
 */

import { setDefaultResultOrder } from 'node:dns';
import { createHash } from 'node:crypto';

import { loadDotEnvLocal } from './lib/env-file';
import { createClient as createSupabaseAdminClient } from '../lib/supabase/admin';
import { getDb, getMongoDbName, isMongoConfigured, __resetMongoClientForTests } from '../lib/mongodb';

// GitHub-hosted runners intermittently fail IPv6 connections to Supabase,
// which undici reports as an opaque 'TypeError: fetch failed'.
setDefaultResultOrder('ipv4first');

const BANNER = [
  '',
  '==============================================================================',
  '  DRY RUN ONLY — NOTHING IS WRITTEN, ANYWHERE.',
  '',
  '  This script compares book records across Supabase and MongoDB and reports',
  '  the difference. It has no execute mode.',
  '',
  '  Any actual backfill requires, in this order:',
  '    1. a verified, restorable backup of BOTH stores, and',
  '    2. Renee\'s WRITTEN approval of the specific reconciliation plan.',
  '',
  '  If both stores contain non-identical live book rows, STOP. That is an',
  '  owner decision, not an engineering one. See docs/launch/BACKFILL_PLAN.md.',
  '==============================================================================',
  '',
].join('\n');

// Refuse to look like something it is not.
const FORBIDDEN_FLAGS = ['--execute', '--apply', '--write', '--commit', '--force', '--yes'];

/** Columns that exist in supabase/migrations — never select drifted columns. */
const SUPABASE_BOOK_COLUMNS = [
  'id',
  'isbn',
  'title',
  'slug',
  'description',
  'genre',
  'price',
  'status',
  'visibility',
  'cover_url',
  'author_id',
  'published_at',
  'created_at',
  'updated_at',
].join(', ');

// ---------------------------------------------------------------------------
// Redaction helpers — output is pasted into issues and PRs, so it must be safe
// ---------------------------------------------------------------------------

/** Short, stable, non-reversible tag for an identifier. */
function redactId(id: unknown): string {
  const value = String(id ?? '');
  if (!value) return '(none)';
  return `id:${createHash('sha256').update(value).digest('hex').slice(0, 8)}`;
}

/**
 * Storage URLs can carry signed tokens. Keep only the final path segment so a
 * human can tell two assets apart without the credential travelling with it.
 */
function redactUrl(url: unknown): string {
  const value = String(url ?? '');
  if (!value) return '(empty)';
  try {
    const parsed = new URL(value);
    const last = parsed.pathname.split('/').filter(Boolean).pop() ?? '';
    return `…/${last}${parsed.search ? ' (+query redacted)' : ''}`;
  } catch {
    return value.length > 40 ? `${value.slice(0, 37)}…` : value;
  }
}

/** Long free text is summarised, never printed. */
function summariseText(text: unknown): string {
  const value = typeof text === 'string' ? text : '';
  if (!value) return '(empty)';
  return `len=${value.length} sha=${createHash('sha256').update(value).digest('hex').slice(0, 8)}`;
}

function redactTitle(title: unknown): string {
  const value = String(title ?? '').trim();
  return value.length > 60 ? `${value.slice(0, 57)}…` : value || '(untitled)';
}

// ---------------------------------------------------------------------------
// Normalisation and matching
// ---------------------------------------------------------------------------

export interface NormalisedBook {
  source: 'supabase' | 'mongo';
  rawId: string;
  slug: string;
  isbn: string;
  title: string;
  authorName: string;
  description: string;
  genre: string;
  status: string;
  visibility: string;
  price: number | null;
  coverUrl: string;
  publishedAt: string;
}

function norm(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase();
}

/** Fold to letters+digits so punctuation and spacing differences do not split a pair. */
export function normaliseKeyPart(value: unknown): string {
  return norm(value).replace(/[^a-z0-9]+/g, '');
}

export function titleAuthorKey(book: NormalisedBook): string {
  const title = normaliseKeyPart(book.title);
  const author = normaliseKeyPart(book.authorName);
  return title ? `${title}::${author}` : '';
}

function isoDate(value: unknown): string {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Signed/expiring query strings differ per read — compare the path only. */
function urlPath(value: unknown): string {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  try {
    return new URL(raw).pathname;
  } catch {
    return raw;
  }
}

// ---------------------------------------------------------------------------
// Field-by-field comparison
// ---------------------------------------------------------------------------

export interface FieldDiff {
  field: string;
  supabase: string;
  mongo: string;
}

/**
 * Fields compared for the "identical vs conflicting" decision.
 * `compare` returns the value actually compared; `display` returns the REDACTED
 * value printed when the field differs. They are separate on purpose: we
 * compare on full fidelity and print on redacted fidelity.
 */
const COMPARED_FIELDS: Array<{
  field: string;
  compare: (b: NormalisedBook) => string;
  display: (b: NormalisedBook) => string;
}> = [
  { field: 'title', compare: (b) => norm(b.title), display: (b) => redactTitle(b.title) },
  { field: 'slug', compare: (b) => norm(b.slug), display: (b) => b.slug || '(empty)' },
  { field: 'isbn', compare: (b) => normaliseKeyPart(b.isbn), display: (b) => b.isbn || '(empty)' },
  {
    field: 'author_name',
    compare: (b) => normaliseKeyPart(b.authorName),
    display: (b) => redactTitle(b.authorName),
  },
  {
    field: 'description',
    compare: (b) => norm(b.description).replace(/\s+/g, ' '),
    display: (b) => summariseText(b.description),
  },
  { field: 'genre', compare: (b) => norm(b.genre), display: (b) => b.genre || '(empty)' },
  { field: 'status', compare: (b) => norm(b.status), display: (b) => b.status || '(empty)' },
  {
    field: 'visibility',
    compare: (b) => norm(b.visibility),
    display: (b) => b.visibility || '(empty)',
  },
  {
    field: 'price',
    compare: (b) => (b.price === null ? '' : b.price.toFixed(2)),
    display: (b) => (b.price === null ? '(none)' : b.price.toFixed(2)),
  },
  {
    field: 'cover_url',
    compare: (b) => urlPath(b.coverUrl),
    display: (b) => redactUrl(b.coverUrl),
  },
  {
    field: 'published_at',
    compare: (b) => b.publishedAt,
    display: (b) => b.publishedAt || '(null)',
  },
];

export function diffBooks(supabase: NormalisedBook, mongo: NormalisedBook): FieldDiff[] {
  const diffs: FieldDiff[] = [];
  for (const spec of COMPARED_FIELDS) {
    if (spec.compare(supabase) !== spec.compare(mongo)) {
      diffs.push({
        field: spec.field,
        supabase: spec.display(supabase),
        mongo: spec.display(mongo),
      });
    }
  }
  return diffs;
}

// ---------------------------------------------------------------------------
// Bucketing
// ---------------------------------------------------------------------------

export interface MatchedPair {
  matchedBy: 'slug' | 'isbn' | 'title+author';
  supabase: NormalisedBook;
  mongo: NormalisedBook;
  diffs: FieldDiff[];
}

export interface Buckets {
  supabaseOnly: NormalisedBook[];
  mongoOnly: NormalisedBook[];
  identical: MatchedPair[];
  conflicting: MatchedPair[];
}

/**
 * Match precedence: slug, then ISBN, then normalised title+author.
 * Slug is the production identity used by the public catalog route, so it wins.
 * ISBN is globally unique when present but is often blank on drafts.
 * title+author is a last-resort heuristic and is reported as such — a pair
 * matched only by title+author should be read as "probably the same book",
 * never as proof.
 */
export function bucketBooks(
  supabaseBooks: NormalisedBook[],
  mongoBooks: NormalisedBook[]
): Buckets {
  const remainingMongo = new Map(mongoBooks.map((b) => [b.rawId, b]));

  const bySlug = new Map<string, NormalisedBook>();
  const byIsbn = new Map<string, NormalisedBook>();
  const byTitleAuthor = new Map<string, NormalisedBook>();
  for (const book of mongoBooks) {
    const slug = norm(book.slug);
    if (slug && !bySlug.has(slug)) bySlug.set(slug, book);
    const isbn = normaliseKeyPart(book.isbn);
    if (isbn && !byIsbn.has(isbn)) byIsbn.set(isbn, book);
    const key = titleAuthorKey(book);
    if (key && !byTitleAuthor.has(key)) byTitleAuthor.set(key, book);
  }

  const identical: MatchedPair[] = [];
  const conflicting: MatchedPair[] = [];
  const supabaseOnly: NormalisedBook[] = [];

  for (const sb of supabaseBooks) {
    let match: NormalisedBook | undefined;
    let matchedBy: MatchedPair['matchedBy'] = 'slug';

    const slug = norm(sb.slug);
    if (slug && bySlug.has(slug) && remainingMongo.has(bySlug.get(slug)!.rawId)) {
      match = bySlug.get(slug);
      matchedBy = 'slug';
    }
    if (!match) {
      const isbn = normaliseKeyPart(sb.isbn);
      if (isbn && byIsbn.has(isbn) && remainingMongo.has(byIsbn.get(isbn)!.rawId)) {
        match = byIsbn.get(isbn);
        matchedBy = 'isbn';
      }
    }
    if (!match) {
      const key = titleAuthorKey(sb);
      if (key && byTitleAuthor.has(key) && remainingMongo.has(byTitleAuthor.get(key)!.rawId)) {
        match = byTitleAuthor.get(key);
        matchedBy = 'title+author';
      }
    }

    if (!match) {
      supabaseOnly.push(sb);
      continue;
    }

    remainingMongo.delete(match.rawId);
    const diffs = diffBooks(sb, match);
    const pair: MatchedPair = { matchedBy, supabase: sb, mongo: match, diffs };
    if (diffs.length === 0) identical.push(pair);
    else conflicting.push(pair);
  }

  return {
    supabaseOnly,
    mongoOnly: [...remainingMongo.values()],
    identical,
    conflicting,
  };
}

// ---------------------------------------------------------------------------
// Readers (SELECT / find only — no insert, update, delete anywhere)
// ---------------------------------------------------------------------------

type SupabaseAuthorJoin = { pen_name?: string | null } | Array<{ pen_name?: string | null }> | null;

async function readSupabaseBooks(): Promise<NormalisedBook[]> {
  const client = createSupabaseAdminClient();
  const { data, error } = await client
    .from('books')
    .select(`${SUPABASE_BOOK_COLUMNS}, author:authors(pen_name)`)
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(`Supabase read failed: ${error.message}`);
  }

  return (data ?? []).map((row) => {
    const record = row as unknown as Record<string, unknown>;
    const author = record.author as SupabaseAuthorJoin;
    const penName = Array.isArray(author) ? author[0]?.pen_name : author?.pen_name;
    return {
      source: 'supabase' as const,
      rawId: String(record.id ?? ''),
      slug: String(record.slug ?? ''),
      isbn: String(record.isbn ?? ''),
      title: String(record.title ?? ''),
      authorName: String(penName ?? ''),
      description: String(record.description ?? ''),
      genre: String(record.genre ?? ''),
      status: String(record.status ?? ''),
      visibility: String(record.visibility ?? ''),
      price: numberOrNull(record.price),
      coverUrl: String(record.cover_url ?? ''),
      publishedAt: isoDate(record.published_at),
    };
  });
}

async function readMongoBooks(): Promise<NormalisedBook[]> {
  const db = await getDb();
  const docs = await db
    .collection('books')
    .find({}, { projection: { search_vector: 0 } })
    .toArray();

  // Resolve pen names in one pass rather than one lookup per book. author_id
  // is an ObjectId on admin-created books but a string on imported ones, so we
  // key the map by String(_id) and look up the same way.
  const authorDocs = docs.length
    ? await db.collection('authors').find({}, { projection: { pen_name: 1 } }).toArray()
    : [];
  const penNames = new Map(authorDocs.map((a) => [String(a._id), String(a.pen_name ?? '')]));

  return docs.map((doc) => ({
    source: 'mongo' as const,
    rawId: String(doc._id),
    slug: String(doc.slug ?? ''),
    isbn: String(doc.isbn ?? ''),
    title: String(doc.title ?? ''),
    authorName: String(doc.author_name ?? penNames.get(String(doc.author_id ?? '')) ?? ''),
    description: String(doc.description ?? ''),
    genre: String(doc.genre ?? ''),
    status: String(doc.status ?? ''),
    visibility: String(doc.visibility ?? ''),
    price: numberOrNull(doc.price),
    coverUrl: String(doc.cover_url ?? ''),
    publishedAt: isoDate(doc.published_at),
  }));
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

function describe(book: NormalisedBook): string {
  return `${redactTitle(book.title)} [slug=${book.slug || '(none)'}] ${redactId(book.rawId)}`;
}

function printBuckets(buckets: Buckets, limit: number): void {
  const { supabaseOnly, mongoOnly, identical, conflicting } = buckets;

  console.log('## Buckets');
  console.log(`  1. Supabase-only (stranded from the production read path): ${supabaseOnly.length}`);
  console.log(`  2. Mongo-only:                                            ${mongoOnly.length}`);
  console.log(`  3. In both, identical:                                    ${identical.length}`);
  console.log(`  4. In both, CONFLICTING:                                  ${conflicting.length}`);
  console.log('');

  console.log(`### 1. Supabase-only (showing up to ${limit})`);
  if (supabaseOnly.length === 0) console.log('  (none)');
  for (const book of supabaseOnly.slice(0, limit)) {
    console.log(`  - ${describe(book)} status=${book.status || '(none)'} visibility=${book.visibility || '(none)'}`);
  }
  console.log('');

  console.log(`### 2. Mongo-only (showing up to ${limit})`);
  if (mongoOnly.length === 0) console.log('  (none)');
  for (const book of mongoOnly.slice(0, limit)) {
    console.log(`  - ${describe(book)} status=${book.status || '(none)'}`);
  }
  console.log('');

  console.log('### 3. In both, identical');
  console.log(`  ${identical.length} pair(s). No action needed for these.`);
  const heuristic = identical.filter((p) => p.matchedBy === 'title+author').length;
  if (heuristic > 0) {
    console.log(`  ${heuristic} matched only by normalised title+author — treat as probable, not proven.`);
  }
  console.log('');

  console.log(`### 4. In both, CONFLICTING (showing up to ${limit})`);
  if (conflicting.length === 0) console.log('  (none)');
  for (const pair of conflicting.slice(0, limit)) {
    console.log(`  - ${describe(pair.supabase)}  (matched by ${pair.matchedBy})`);
    for (const diff of pair.diffs) {
      console.log(`      ${diff.field}: supabase=${diff.supabase}  |  mongo=${diff.mongo}`);
    }
  }
  console.log('');

  if (conflicting.length > 0) {
    console.log('==============================================================================');
    console.log('  STOP CONDITION MET');
    console.log('');
    console.log('  Both stores contain non-identical live book rows. Reconciliation now needs');
    console.log("  a verified backup and Renee's written approval before ANY write. Do not");
    console.log('  attempt to resolve these conflicts from this script — it cannot write, and');
    console.log('  it must not be extended so that it can.');
    console.log('==============================================================================');
    console.log('');
  }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

interface DryRunOptions {
  limit: number;
  json: boolean;
}

function parseArgs(argv: string[]): DryRunOptions {
  let limit = 25;
  let json = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (FORBIDDEN_FLAGS.includes(arg)) {
      throw new Error(
        `"${arg}" is not supported and never will be. This script is dry-run only. ` +
          'A real backfill requires a verified backup and the owner\'s written approval, ' +
          'and belongs in a separate reviewed change — see docs/launch/BACKFILL_PLAN.md.'
      );
    }
    if (arg === '--limit') {
      limit = Math.max(1, Number(argv[++i] ?? 25) || 25);
    } else if (arg === '--json') {
      json = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return { limit, json };
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  loadDotEnvLocal();
  __resetMongoClientForTests();

  console.log(BANNER);

  const missing: string[] = [];
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) missing.push('NEXT_PUBLIC_SUPABASE_URL');
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY');
  if (!isMongoConfigured()) missing.push('MONGODB_URI');
  if (missing.length > 0) {
    throw new Error(
      `Missing environment variables: ${missing.join(', ')}. ` +
        'Set them in .env.local. This script introduces no new variables.'
    );
  }

  console.log(`Mongo database: ${getMongoDbName()}`);
  console.log('Reading both stores (SELECT / find only)…');
  console.log('');

  // Read both sides independently so one unreachable store still yields the
  // other's inventory plus an explicit, honest gap — never a silent zero.
  const [supabaseResult, mongoResult] = await Promise.allSettled([
    readSupabaseBooks(),
    readMongoBooks(),
  ]);

  if (supabaseResult.status === 'rejected' || mongoResult.status === 'rejected') {
    if (supabaseResult.status === 'rejected') {
      console.error(`Supabase side UNREAD: ${String(supabaseResult.reason)}`);
      console.error(
        '  If the project is paused, deleted or newly restored, that IS the finding. ' +
          'Record it in issue #192 — do not infer that there are zero Supabase books.'
      );
    }
    if (mongoResult.status === 'rejected') {
      console.error(`Mongo side UNREAD: ${String(mongoResult.reason)}`);
    }
    throw new Error('Could not read both stores — the comparison would be misleading. Aborting.');
  }

  const buckets = bucketBooks(supabaseResult.value, mongoResult.value);

  if (options.json) {
    // Redacted JSON: identifiers hashed, free text summarised, URLs stripped.
    console.log(
      JSON.stringify(
        {
          dry_run: true,
          supabase_total: supabaseResult.value.length,
          mongo_total: mongoResult.value.length,
          buckets: {
            supabase_only: buckets.supabaseOnly.map(describe),
            mongo_only: buckets.mongoOnly.map(describe),
            identical: buckets.identical.length,
            conflicting: buckets.conflicting.map((p) => ({
              book: describe(p.supabase),
              matched_by: p.matchedBy,
              diffs: p.diffs,
            })),
          },
          stop_condition_met: buckets.conflicting.length > 0,
          approval_required: true,
        },
        null,
        2
      )
    );
    return;
  }

  console.log(`Supabase books read: ${supabaseResult.value.length}`);
  console.log(`Mongo books read:    ${mongoResult.value.length}`);
  console.log('');
  printBuckets(buckets, options.limit);

  console.log('Nothing was written. Next step is a decision, not a command:');
  console.log('  docs/launch/BACKFILL_PLAN.md');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
