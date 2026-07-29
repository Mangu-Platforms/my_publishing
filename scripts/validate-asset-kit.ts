/**
 * scripts/validate-asset-kit.ts — Task 4.2.
 *
 * Validates one book asset kit, or a whole handover directory of them, against
 * the SAME rule set the admin publish gate uses. Run it before the publisher
 * sends the kits, and again before anyone touches /admin/books.
 *
 *   npx tsx scripts/validate-asset-kit.ts docs/launch/asset-kit-template
 *   npx tsx scripts/validate-asset-kit.ts ~/handover            # many kits
 *   npx tsx scripts/validate-asset-kit.ts ~/handover --json
 *   npx tsx scripts/validate-asset-kit.ts ~/handover --require-author-id
 *
 * Exit codes:
 *   0  no blockers (warnings may still be printed)
 *   1  at least one blocker
 *   2  usage or I/O error (nothing was validated)
 *
 * CONSTRAINT — no new npm dependencies. Image geometry is read straight from
 * the PNG/JPEG headers in scripts/lib/asset-kit.ts rather than pulling in an
 * image library; the file is opened once and only its head is read, so a 50MB
 * EPUB is never loaded into memory.
 *
 * All rules live in scripts/lib/asset-kit.ts. This file is I/O and formatting
 * only — keep it that way so the rules stay unit-testable without fixtures.
 */

import { closeSync, existsSync, openSync, readFileSync, readSync, readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';

import {
  isZipContainer,
  parseKitJson,
  readImageDimensions,
  sniffImageMime,
  validateAssetKitBatch,
  type AssetKitInput,
  type AssetKitResult,
  type KitIssue,
  type LocalFileFacts,
  type RawKit,
} from './lib/asset-kit';

const KIT_MANIFEST = 'book.json';

/**
 * Head-read budget. A JPEG's SOF frame sits after any EXIF/ICC blocks, which on
 * a print-resolution cover with an embedded colour profile can run past 64KB;
 * 256KB clears every real-world cover while still being a bounded read.
 */
const HEAD_BYTES = 256 * 1024;

type Cli = {
  targets: string[];
  json: boolean;
  requireAuthorId: boolean;
};

function parseArgs(argv: string[]): Cli | null {
  const cli: Cli = { targets: [], json: false, requireAuthorId: false };
  for (const arg of argv) {
    if (arg === '--json') cli.json = true;
    else if (arg === '--require-author-id') cli.requireAuthorId = true;
    else if (arg === '--help' || arg === '-h') return null;
    else if (arg.startsWith('-')) {
      throw new Error(`Unknown option ${arg}`);
    } else cli.targets.push(arg);
  }
  return cli;
}

function usage(): string {
  return [
    'Usage: npx tsx scripts/validate-asset-kit.ts <path> [<path>...] [options]',
    '',
    '  <path>  a kit folder (one containing book.json), or a directory of kit folders',
    '',
    'Options:',
    '  --json                machine-readable output on stdout',
    '  --require-author-id   treat an unlinked author record as a blocker',
    '                        (operator pre-publish pass, once /admin/authors is populated)',
    '  -h, --help            this text',
    '',
    'Exit 0 = no blockers, 1 = blockers found, 2 = usage or I/O error.',
  ].join('\n');
}

/** Read only the head of a file — covers are big and EPUBs are bigger. */
function readHead(path: string, bytes: number): Uint8Array {
  const fd = openSync(path, 'r');
  try {
    const buffer = Buffer.alloc(bytes);
    const read = readSync(fd, buffer, 0, bytes, 0);
    return buffer.subarray(0, read);
  } finally {
    closeSync(fd);
  }
}

function fileFacts(
  kitDir: string,
  declared: string | null,
  wantDimensions: boolean
): LocalFileFacts | null {
  if (!declared) return null;

  const missing: LocalFileFacts = {
    declaredPath: declared,
    exists: false,
    size: 0,
    sniffedMime: null,
    dimensions: null,
    isZipContainer: false,
  };

  const full = resolve(kitDir, declared);
  if (!existsSync(full)) return missing;
  const stats = statSync(full);
  if (!stats.isFile()) return missing;

  const head = readHead(full, HEAD_BYTES);
  return {
    declaredPath: declared,
    exists: true,
    size: stats.size,
    sniffedMime: sniffImageMime(head),
    dimensions: wantDimensions ? readImageDimensions(head) : null,
    isZipContainer: isZipContainer(head),
  };
}

function declaredPath(kit: RawKit, key: string): string | null {
  const assets = kit.assets;
  if (assets == null || typeof assets !== 'object') return null;
  const value = (assets as Record<string, unknown>)[key];
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

/** A target is either a kit folder or a parent holding several of them. */
function discoverKitDirs(target: string): string[] {
  const full = resolve(process.cwd(), target);
  if (!existsSync(full)) throw new Error(`Path not found: ${target}`);
  if (!statSync(full).isDirectory()) throw new Error(`Not a directory: ${target}`);
  if (existsSync(join(full, KIT_MANIFEST))) return [full];

  const children = readdirSync(full, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(full, entry.name))
    .filter((dir) => existsSync(join(dir, KIT_MANIFEST)))
    .sort();

  if (children.length === 0) {
    throw new Error(`No ${KIT_MANIFEST} in ${target} or in any folder directly inside it`);
  }
  return children;
}

function loadKit(kitDir: string, requireAuthorId: boolean): AssetKitInput {
  const manifestPath = join(kitDir, KIT_MANIFEST);
  let kit: RawKit;
  try {
    kit = parseKitJson(readFileSync(manifestPath, 'utf8'));
  } catch (error) {
    // A manifest that will not parse is a blocker, not a crash: one broken kit
    // in a batch of six must not hide the state of the other five.
    const reason = error instanceof Error ? error.message : String(error);
    return {
      kitName: kitDir.split(/[\\/]/).pop() ?? kitDir,
      kit: { __unparseable: reason },
      files: {},
      options: { requireAuthorId },
    };
  }

  return {
    kitName: kitDir.split(/[\\/]/).pop() ?? kitDir,
    kit,
    files: {
      cover: fileFacts(kitDir, declaredPath(kit, 'cover_file'), true),
      epub: fileFacts(kitDir, declaredPath(kit, 'epub_file'), false),
      audio: fileFacts(kitDir, declaredPath(kit, 'audio_sample_file'), false),
    },
    options: { requireAuthorId },
  };
}

function formatIssue(issue: KitIssue): string {
  const label = issue.severity === 'blocker' ? 'BLOCKER' : 'warning';
  return `    ${label.padEnd(8)} ${issue.field.padEnd(28)} ${issue.message} [${issue.source}]`;
}

function formatKit(result: AssetKitResult): string[] {
  const mark = result.ok ? 'PASS' : 'FAIL';
  const price = result.priceCents === null ? 'no price' : `${result.priceCents} cents`;
  const lines = [
    '',
    `${mark}  ${result.kitName}  ->  slug "${result.slug || '(none)'}", ${price}` +
      `${result.isbn ? `, ISBN ${result.isbn}` : ''}`,
  ];
  for (const issue of result.blockers) lines.push(formatIssue(issue));
  for (const issue of result.warnings) lines.push(formatIssue(issue));
  return lines;
}

/**
 * Split from the process exit on purpose: every path returns a code instead of
 * calling process.exit mid-function, so the control flow is checkable and the
 * whole run stays testable if it ever needs to be.
 */
export function run(argv: string[]): number {
  let cli: Cli | null;
  try {
    cli = parseArgs(argv);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    console.error(usage());
    return 2;
  }

  if (cli === null) {
    console.log(usage());
    return 0;
  }
  if (cli.targets.length === 0) {
    console.error(usage());
    return 2;
  }

  let inputs: AssetKitInput[];
  try {
    const dirs = cli.targets.flatMap((target) => discoverKitDirs(target));
    // De-duplicate: passing both a parent and one of its children is easy to do.
    const unique = Array.from(new Set(dirs));
    inputs = unique.map((dir) => loadKit(dir, cli.requireAuthorId));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 2;
  }

  const batch = validateAssetKitBatch(inputs);

  if (cli.json) {
    console.log(JSON.stringify(batch, null, 2));
    return batch.ok ? 0 : 1;
  }

  const passed = batch.results.filter((result) => result.ok).length;
  const lines: string[] = [
    `Asset-kit intake — ${batch.results.length} kit(s)`,
    'Rules: app/admin/books/_lib/book-validation.ts (source=admin-validation)',
    '       + intake-only checks the admin UI cannot run (source=intake)',
  ];
  for (const result of batch.results) lines.push(...formatKit(result));
  lines.push(
    '',
    `${passed}/${batch.results.length} kits ready. ` +
      `${batch.blockerCount} blocker(s), ${batch.warningCount} warning(s).`
  );
  lines.push(
    batch.ok
      ? 'No blockers. Warnings never block — review them, then hand over.'
      : 'Blockers must be cleared before these books can be created in /admin/books.'
  );

  const out = lines.join('\n');
  if (batch.ok) console.log(out);
  else console.error(out);

  return batch.ok ? 0 : 1;
}

process.exit(run(process.argv.slice(2)));
