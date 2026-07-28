/**
 * Deterministic duplicate / QA-seed identification for the MANGU catalog
 * (Task 1.6). Pure logic only — no database driver, no I/O — so it can be
 * unit-tested and reasoned about independently of any provider.
 *
 * SAFETY CONTRACT
 *   - A record is only ever a cleanup candidate when it is PROVABLY either
 *     (a) a known QA/seed record (exact id or exact slug match against the
 *         hardcoded inventory below, or an exact normalized QA author name), or
 *     (b) a non-survivor member of a deterministic duplicate group.
 *   - Fuzzy matching is deliberately absent. "Looks like a test book" is not a
 *     reason to delete anything.
 *   - Every duplicate group keeps exactly one survivor, chosen deterministically
 *     (oldest created_at, then lowest id) so repeated runs agree.
 */

export type CatalogProvider = 'mongodb' | 'supabase';
export type CatalogCollection = 'books' | 'authors';

export interface CatalogRecord {
  /** Provider-native identifier as a string (ObjectId hex or uuid). */
  id: string;
  provider: CatalogProvider;
  collection: CatalogCollection;
  slug?: string | null;
  isbn?: string | null;
  title?: string | null;
  /** Author display/pen name, used for the title+author duplicate key. */
  authorName?: string | null;
  /** ISO timestamp; used only to pick a stable survivor. */
  createdAt?: string | null;
}

export type DuplicateKeyKind = 'slug' | 'isbn' | 'title+author';

export interface DuplicateKey {
  kind: DuplicateKeyKind;
  key: string;
}

export interface DuplicateGroup {
  kind: DuplicateKeyKind;
  key: string;
  provider: CatalogProvider;
  collection: CatalogCollection;
  /** The record that must be KEPT. */
  survivor: CatalogRecord;
  /** Non-survivors — the only members eligible for removal. */
  duplicates: CatalogRecord[];
}

export interface SeedMatch {
  record: CatalogRecord;
  /** Exactly why this record is provably a seed/QA record. */
  reason: string;
}

// ---------------------------------------------------------------------------
// Known QA / seed inventory (verified, exact-match only)
// ---------------------------------------------------------------------------

/** Author ids created by QA/seed runs. Exact match only. */
export const KNOWN_SEED_AUTHOR_IDS: readonly string[] = [
  '96a10f64-55c8-413f-b62e-04f619bcd6bf', // "Test Author"
  'fe2d0b1f-48e9-4dd5-ad05-ab8586738422', // "MANGU QA Author"
];

/** Normalized author names created by QA/seed runs. Exact match only. */
export const KNOWN_SEED_AUTHOR_NAMES: readonly string[] = ['test author', 'mangu qa author'];

/** Book slugs created by QA/seed runs. Exact match only. */
export const KNOWN_SEED_BOOK_SLUGS: readonly string[] = [
  'author-analytics-verification-book',
  'cloud-run-chronicles',
  'the-launch-gate',
];

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------

/** Lowercase, strip diacritics and punctuation, collapse whitespace. */
export function normalizeText(value: string | null | undefined): string {
  if (!value) return '';
  return value
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export const normalizeTitle = normalizeText;
export const normalizeAuthor = normalizeText;

/**
 * Normalize an ISBN to its bare ISBN-10/ISBN-13 form. Returns null for
 * anything that is not a structurally valid ISBN, so a malformed value can
 * never become a duplicate key (and never group two unrelated books).
 * Pattern matches types/books.ts `ISBNSchema`.
 */
export function normalizeIsbn(value: string | null | undefined): string | null {
  if (!value) return null;
  const stripped = value.replace(/[^0-9Xx]/g, '').toUpperCase();
  if (!/^(?:\d{9}[\dX]|\d{13})$/.test(stripped)) return null;
  return stripped;
}

/** Normalize a slug for comparison (case/edge-whitespace only). */
export function normalizeSlug(value: string | null | undefined): string {
  if (!value) return '';
  return value.trim().toLowerCase().replace(/^\/+|\/+$/g, '');
}

// ---------------------------------------------------------------------------
// Duplicate keys
// ---------------------------------------------------------------------------

/**
 * All deterministic duplicate keys a record participates in. A key is only
 * emitted when the underlying field is present and well-formed.
 */
export function duplicateKeysFor(record: CatalogRecord): DuplicateKey[] {
  const keys: DuplicateKey[] = [];

  const slug = normalizeSlug(record.slug);
  if (slug) keys.push({ kind: 'slug', key: slug });

  const isbn = normalizeIsbn(record.isbn);
  if (isbn) keys.push({ kind: 'isbn', key: isbn });

  const title = normalizeTitle(record.title);
  const author = normalizeAuthor(record.authorName);
  // Requires BOTH halves — a bare title is not a duplicate signal.
  if (title && author) keys.push({ kind: 'title+author', key: `${title}|${author}` });

  return keys;
}

/**
 * Deterministic survivor: oldest createdAt wins; records with no createdAt sort
 * last; ties broken by lexicographically lowest id.
 */
export function pickSurvivor(records: CatalogRecord[]): CatalogRecord {
  return [...records].sort((a, b) => {
    const at = a.createdAt ? Date.parse(a.createdAt) : Number.POSITIVE_INFINITY;
    const bt = b.createdAt ? Date.parse(b.createdAt) : Number.POSITIVE_INFINITY;
    const aTime = Number.isNaN(at) ? Number.POSITIVE_INFINITY : at;
    const bTime = Number.isNaN(bt) ? Number.POSITIVE_INFINITY : bt;
    if (aTime !== bTime) return aTime - bTime;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  })[0];
}

/**
 * Group records that share a duplicate key. Records are only ever compared
 * within the same provider AND collection — a Mongo book and a Supabase book
 * with the same slug are the SAME book in two stores, not a duplicate.
 */
export function groupDuplicates(records: CatalogRecord[]): DuplicateGroup[] {
  const buckets = new Map<string, { key: DuplicateKey; records: CatalogRecord[] }>();

  for (const record of records) {
    for (const key of duplicateKeysFor(record)) {
      const bucketId = `${record.provider}::${record.collection}::${key.kind}::${key.key}`;
      const bucket = buckets.get(bucketId);
      if (bucket) bucket.records.push(record);
      else buckets.set(bucketId, { key, records: [record] });
    }
  }

  const groups: DuplicateGroup[] = [];
  for (const [bucketId, bucket] of buckets) {
    if (bucket.records.length < 2) continue;
    const [provider, collection] = bucketId.split('::');
    const survivor = pickSurvivor(bucket.records);
    groups.push({
      kind: bucket.key.kind,
      key: bucket.key.key,
      provider: provider as CatalogProvider,
      collection: collection as CatalogCollection,
      survivor,
      duplicates: bucket.records.filter((r) => r.id !== survivor.id),
    });
  }

  return groups.sort((a, b) =>
    `${a.kind}${a.key}` < `${b.kind}${b.key}` ? -1 : `${a.kind}${a.key}` > `${b.kind}${b.key}` ? 1 : 0
  );
}

// ---------------------------------------------------------------------------
// Seed detection
// ---------------------------------------------------------------------------

/**
 * Returns a reason string when the record is PROVABLY a QA/seed record, else
 * null. Exact matches only — no substring or heuristic matching.
 */
export function seedMarkerFor(record: CatalogRecord): string | null {
  if (KNOWN_SEED_AUTHOR_IDS.includes(record.id)) {
    return `known seed author id ${record.id}`;
  }
  if (record.collection === 'books') {
    const slug = normalizeSlug(record.slug);
    if (slug && KNOWN_SEED_BOOK_SLUGS.includes(slug)) {
      return `known seed book slug "${slug}"`;
    }
  }
  if (record.collection === 'authors') {
    const name = normalizeAuthor(record.authorName ?? record.title);
    if (name && KNOWN_SEED_AUTHOR_NAMES.includes(name)) {
      return `known seed author name "${name}"`;
    }
  }
  return null;
}

export function findSeedRecords(records: CatalogRecord[]): SeedMatch[] {
  const matches: SeedMatch[] = [];
  for (const record of records) {
    const reason = seedMarkerFor(record);
    if (reason) matches.push({ record, reason });
  }
  return matches;
}

// ---------------------------------------------------------------------------
// Plan
// ---------------------------------------------------------------------------

export interface CleanupCandidate {
  record: CatalogRecord;
  reason: string;
}

export interface ProviderCounts {
  provider: CatalogProvider;
  collection: CatalogCollection;
  before: number;
  after: number;
}

export interface CleanupPlan {
  candidates: CleanupCandidate[];
  duplicateGroups: DuplicateGroup[];
  seedMatches: SeedMatch[];
  counts: ProviderCounts[];
  /** Token the operator must echo back via --confirm to run --execute. */
  confirmationToken: string;
}

/** Stable, dependency-free hash used to bind a confirmation token to a plan. */
export function planFingerprint(ids: string[]): string {
  let hash = 0x811c9dc5;
  for (const id of [...ids].sort()) {
    for (let i = 0; i < id.length; i += 1) {
      hash ^= id.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    hash ^= 0x2f;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0').toUpperCase();
}

/**
 * Build the cleanup plan. Purely descriptive — it deletes nothing and has no
 * side effects. The confirmation token is derived from the exact candidate set,
 * so a token from an earlier run cannot authorize a changed plan.
 */
export function buildCleanupPlan(records: CatalogRecord[]): CleanupPlan {
  const duplicateGroups = groupDuplicates(records);
  const seedMatches = findSeedRecords(records);

  const byId = new Map<string, CleanupCandidate>();
  for (const match of seedMatches) {
    byId.set(match.record.id, { record: match.record, reason: `seed marker — ${match.reason}` });
  }
  for (const group of duplicateGroups) {
    for (const duplicate of group.duplicates) {
      const existing = byId.get(duplicate.id);
      const reason = `duplicate ${group.kind} "${group.key}" — survivor is ${group.survivor.id}`;
      if (existing) existing.reason = `${existing.reason}; ${reason}`;
      else byId.set(duplicate.id, { record: duplicate, reason });
    }
  }

  const candidates = [...byId.values()].sort((a, b) =>
    a.record.id < b.record.id ? -1 : a.record.id > b.record.id ? 1 : 0
  );

  const countKeys = new Map<string, ProviderCounts>();
  for (const record of records) {
    const key = `${record.provider}::${record.collection}`;
    const entry = countKeys.get(key) ?? {
      provider: record.provider,
      collection: record.collection,
      before: 0,
      after: 0,
    };
    entry.before += 1;
    countKeys.set(key, entry);
  }
  const candidateIds = new Set(candidates.map((c) => c.record.id));
  for (const record of records) {
    if (candidateIds.has(record.id)) continue;
    const entry = countKeys.get(`${record.provider}::${record.collection}`);
    if (entry) entry.after += 1;
  }

  return {
    candidates,
    duplicateGroups,
    seedMatches,
    counts: [...countKeys.values()],
    confirmationToken: `CONFIRM-${candidates.length}-${planFingerprint(candidates.map((c) => c.record.id))}`,
  };
}

/** Guard used by the CLI before any write is permitted. */
export function isExecutionAuthorized(
  plan: CleanupPlan,
  options: { execute: boolean; confirm?: string }
): { authorized: boolean; message: string } {
  if (!options.execute) {
    return { authorized: false, message: 'DRY RUN (default) — no records were modified.' };
  }
  if (plan.candidates.length === 0) {
    return { authorized: false, message: 'Nothing to do — the plan is empty.' };
  }
  if (!options.confirm) {
    return {
      authorized: false,
      message:
        `REFUSED: --execute requires --confirm=${plan.confirmationToken} ` +
        '(the token is derived from this exact candidate set).',
    };
  }
  if (options.confirm !== plan.confirmationToken) {
    return {
      authorized: false,
      message:
        'REFUSED: confirmation token does not match this plan. The catalog changed since the ' +
        `token was issued. Re-run the dry run and use --confirm=${plan.confirmationToken}.`,
    };
  }
  return { authorized: true, message: 'Confirmation token accepted.' };
}
