#!/usr/bin/env tsx
/**
 * Phoenix P11.2 — TRANSFORM. Reads `export/*.json` (produced by P11.1) and writes
 * `export/*_transformed.json` ready for `mongoimport --jsonArray`, plus
 * `export/_id_map.json` and `export/transform-report.json`.
 *
 * All logic lives in `scripts/lib/transform.ts` (unit-tested); this file is only
 * I/O, validation and reporting.
 *
 * Usage:
 *   npm run phoenix:transform
 *   npm run phoenix:transform -- --in export --out export
 *
 * Exits non-zero when any foreign key failed to map, which is the P11.2 gate:
 * "transform report shows zero unmapped foreign keys".
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';
import { randomUUID } from 'crypto';
import { ObjectId } from 'mongodb';
import {
  transform,
  type LegacyAuthUser,
  type LegacyAuthor,
  type LegacyBook,
  type LegacyOrderRow,
  type LegacyProfile,
  type LegacyReadingProgress,
  type LegacyReview,
  type TransformInput,
} from './lib/transform';

function argValue(flag: string, fallback: string): string {
  const idx = process.argv.indexOf(flag);
  return idx >= 0 && idx + 1 < process.argv.length ? process.argv[idx + 1] : fallback;
}

const inDir = resolve(process.cwd(), argValue('--in', 'export'));
const outDir = resolve(process.cwd(), argValue('--out', 'export'));

/** Task 2.1 — parse every export file, failing loudly on malformed input. */
function readArray<T>(name: string, required: boolean): T[] {
  const path = join(inDir, `${name}.json`);
  if (!existsSync(path)) {
    if (required) {
      throw new Error(
        `Missing required export file: ${path}\n` +
          `  Run ./scripts/export-supabase.sh first (Phoenix P11.1).`
      );
    }
    console.warn(`  ! ${name}.json absent — treating as empty`);
    return [];
  }

  const raw = readFileSync(path, 'utf8').trim();
  if (raw === '' || raw === '\\N') {
    console.warn(`  ! ${name}.json is empty — treating as []`);
    return [];
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(
      `${name}.json is not valid JSON: ${error instanceof Error ? error.message : String(error)}\n` +
        `  psql \\copy writes COPY text format, which escapes newlines and breaks JSON.\n` +
        `  Re-export with ./scripts/export-supabase.sh, which uses "psql -At -c".`
    );
  }

  if (parsed === null) return [];
  if (!Array.isArray(parsed)) {
    throw new Error(`${name}.json must contain a JSON array, got ${typeof parsed}`);
  }
  return parsed as T[];
}

function main(): void {
  console.log(`\nPhoenix P11.2 — transform  ${inDir} → ${outDir}\n`);

  const input: TransformInput = {
    auth_users: readArray<LegacyAuthUser>('auth_users', true),
    profiles: readArray<LegacyProfile>('profiles', true),
    authors: readArray<LegacyAuthor>('authors', true),
    books: readArray<LegacyBook>('books', true),
    orders_raw: readArray<LegacyOrderRow>('orders_raw', false),
    reviews: readArray<LegacyReview>('reviews', false),
    reading_progress: readArray<LegacyReadingProgress>('reading_progress', false),
  };

  const result = transform(input, {
    newObjectId: () => new ObjectId().toHexString(),
    newUuid: () => randomUUID(),
    now: new Date(),
  });

  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

  const write = (name: string, data: unknown) => {
    writeFileSync(join(outDir, name), `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  };

  write('user_transformed.json', result.user);
  write('account_transformed.json', result.account);
  write('profiles_transformed.json', result.profiles);
  write('authors_transformed.json', result.authors);
  write('books_transformed.json', result.books);
  write('orders_transformed.json', result.orders);
  write('reviews_transformed.json', result.reviews);
  write('reading_progress_transformed.json', result.reading_progress);
  write('_id_map.json', result.idMap);
  write('transform-report.json', result.report);

  const { report } = result;

  console.log('Collection counts (in → out):');
  for (const [name, c] of Object.entries(report.counts)) {
    const flag = c.in === c.out ? ' ' : '!';
    console.log(
      `  ${flag} ${name.padEnd(18)} ${String(c.in).padStart(7)} → ${String(c.out).padStart(7)}`
    );
  }

  const orphanEntries = Object.entries(report.orphans).filter(([, ids]) => ids.length > 0);
  console.log('\nForeign keys:');
  if (orphanEntries.length === 0) {
    console.log('  all resolved');
  } else {
    for (const [kind, ids] of orphanEntries) {
      console.log(`  ${kind}: ${ids.length}`);
      for (const id of ids.slice(0, 5)) console.log(`      ${id}`);
      if (ids.length > 5) console.log(`      … and ${ids.length - 5} more`);
    }
  }

  console.log('\nTransform notes:');
  console.log(
    `  locked credential accounts   : ${report.locked_accounts} (password="!locked:<uuid>", never a hash)`
  );
  console.log(`  slug collisions resolved     : ${report.slug_collisions_resolved.length}`);
  console.log(`  book statuses remapped       : ${JSON.stringify(report.book_status_remapped)}`);
  console.log(`  order statuses remapped      : ${JSON.stringify(report.order_status_remapped)}`);
  console.log(`  synthesized payment intents  : ${report.synthesized_payment_intents}`);
  console.log(`  books with recomputed rating : ${report.ratings_recomputed}`);

  console.log(`\nWrote 8 *_transformed.json + _id_map.json + transform-report.json to ${outDir}`);

  // `books_without_author` is expected with clean data (Supabase nulls author_id
  // on author delete), so it does not fail the gate; P11.5 reports it separately.
  if (!report.zero_unmapped_foreign_keys) {
    console.error(
      '\nP11.2 GATE FAILED — unmapped foreign keys above. Halt, fix the export, re-run.\n' +
        'Do not proceed to P11.3/P11.4.'
    );
    process.exit(1);
  }

  if (report.orphans.books_without_author.length > 0) {
    console.warn(
      `\nNote: ${report.orphans.books_without_author.length} book(s) have no author (legacy author_id was NULL). ` +
        'Imported with author_id: null and reported by P11.5.'
    );
  }

  console.log('\nP11.2 gate PASSED — zero unmapped foreign keys.');
  console.log('Next: P11.3 dry-run import into the staging database.');
}

try {
  main();
} catch (error) {
  console.error(`\n[transform-data] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
