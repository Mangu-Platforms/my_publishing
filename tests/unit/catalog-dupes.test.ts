import {
  buildCleanupPlan,
  duplicateKeysFor,
  findSeedRecords,
  groupDuplicates,
  isExecutionAuthorized,
  KNOWN_SEED_AUTHOR_IDS,
  KNOWN_SEED_BOOK_SLUGS,
  normalizeIsbn,
  normalizeSlug,
  normalizeText,
  pickSurvivor,
  planFingerprint,
  seedMarkerFor,
  type CatalogRecord,
} from '../../scripts/lib/catalog-dupes';

function book(partial: Partial<CatalogRecord> & { id: string }): CatalogRecord {
  return { provider: 'mongodb', collection: 'books', ...partial };
}
function author(partial: Partial<CatalogRecord> & { id: string }): CatalogRecord {
  return { provider: 'mongodb', collection: 'authors', ...partial };
}

describe('normalization', () => {
  it('normalizes titles and author names deterministically', () => {
    expect(normalizeText('  The   Launch—Gate!  ')).toBe('the launch gate');
    expect(normalizeText('Renée Ångström')).toBe('renee angstrom');
    expect(normalizeText(null)).toBe('');
  });

  it('accepts only structurally valid ISBNs', () => {
    expect(normalizeIsbn('978-0-306-40615-7')).toBe('9780306406157');
    expect(normalizeIsbn('0-306-40615-2')).toBe('0306406152');
    expect(normalizeIsbn('080442957X')).toBe('080442957X');
    expect(normalizeIsbn('not-an-isbn')).toBeNull();
    expect(normalizeIsbn('12345')).toBeNull();
    expect(normalizeIsbn('')).toBeNull();
  });

  it('normalizes slugs without altering their identity', () => {
    expect(normalizeSlug('/The-Launch-Gate/')).toBe('the-launch-gate');
  });
});

describe('duplicate keys', () => {
  it('emits slug, isbn and title+author keys when well-formed', () => {
    const keys = duplicateKeysFor(
      book({ id: 'a', slug: 'the-launch-gate', isbn: '978-0-306-40615-7', title: 'The Launch Gate', authorName: 'Test Author' })
    );
    expect(keys).toEqual([
      { kind: 'slug', key: 'the-launch-gate' },
      { kind: 'isbn', key: '9780306406157' },
      { kind: 'title+author', key: 'the launch gate|test author' },
    ]);
  });

  it('never keys on a malformed ISBN', () => {
    const keys = duplicateKeysFor(book({ id: 'a', isbn: 'TBD' }));
    expect(keys.some((k) => k.kind === 'isbn')).toBe(false);
  });

  it('requires BOTH title and author — a bare title is not a duplicate signal', () => {
    expect(duplicateKeysFor(book({ id: 'a', title: 'Untitled' }))).toEqual([]);
  });
});

describe('grouping', () => {
  it('groups records that share a slug and keeps exactly one survivor', () => {
    const records = [
      book({ id: 'newer', slug: 'dup', createdAt: '2026-02-01T00:00:00Z' }),
      book({ id: 'older', slug: 'dup', createdAt: '2026-01-01T00:00:00Z' }),
    ];
    const [group] = groupDuplicates(records);
    expect(group.kind).toBe('slug');
    expect(group.survivor.id).toBe('older');
    expect(group.duplicates.map((d) => d.id)).toEqual(['newer']);
  });

  it('never groups across providers — same slug in Mongo and Supabase is one book in two stores', () => {
    const records = [
      book({ id: 'm1', slug: 'same', provider: 'mongodb' }),
      book({ id: 's1', slug: 'same', provider: 'supabase' }),
    ];
    expect(groupDuplicates(records)).toEqual([]);
  });

  it('never groups across collections', () => {
    const records = [
      book({ id: 'b1', title: 'Ada', authorName: 'Ada' }),
      author({ id: 'a1', title: 'Ada', authorName: 'Ada' }),
    ];
    expect(groupDuplicates(records)).toEqual([]);
  });

  it('leaves unique records alone', () => {
    expect(groupDuplicates([book({ id: 'a', slug: 'x' }), book({ id: 'b', slug: 'y' })])).toEqual([]);
  });

  it('picks a stable survivor by id when timestamps tie or are absent', () => {
    const survivor = pickSurvivor([book({ id: 'zzz' }), book({ id: 'aaa' })]);
    expect(survivor.id).toBe('aaa');
  });
});

describe('seed detection (exact match only)', () => {
  it('matches the known seed author ids', () => {
    for (const id of KNOWN_SEED_AUTHOR_IDS) {
      expect(seedMarkerFor(author({ id }))).toContain(id);
    }
  });

  it('matches the known seed book slugs', () => {
    for (const slug of KNOWN_SEED_BOOK_SLUGS) {
      expect(seedMarkerFor(book({ id: 'x', slug }))).toContain(slug);
    }
  });

  it('matches the known QA author names', () => {
    expect(seedMarkerFor(author({ id: 'x', authorName: 'MANGU QA Author' }))).toContain('mangu qa author');
    expect(seedMarkerFor(author({ id: 'x', authorName: 'Test Author' }))).toContain('test author');
  });

  it('does NOT match records that merely look like test data', () => {
    expect(seedMarkerFor(book({ id: 'x', slug: 'the-launch-gate-ii' }))).toBeNull();
    expect(seedMarkerFor(book({ id: 'x', slug: 'testing-the-waters' }))).toBeNull();
    expect(seedMarkerFor(author({ id: 'x', authorName: 'Testa Authorson' }))).toBeNull();
    expect(seedMarkerFor(author({ id: 'x', authorName: 'A Real Author' }))).toBeNull();
    expect(findSeedRecords([book({ id: 'x', slug: 'my-real-novel' })])).toEqual([]);
  });

  it('does not treat a seed book slug as a seed author', () => {
    expect(seedMarkerFor(author({ id: 'x', slug: 'cloud-run-chronicles' }))).toBeNull();
  });
});

describe('cleanup plan', () => {
  const records: CatalogRecord[] = [
    book({ id: 'real-1', slug: 'a-real-book', title: 'A Real Book', authorName: 'Real Author', createdAt: '2026-01-01T00:00:00Z' }),
    book({ id: 'seed-1', slug: 'cloud-run-chronicles', title: 'Cloud Run Chronicles', createdAt: '2026-01-02T00:00:00Z' }),
    book({ id: 'dup-old', slug: 'shared', createdAt: '2026-01-03T00:00:00Z' }),
    book({ id: 'dup-new', slug: 'shared', createdAt: '2026-01-04T00:00:00Z' }),
  ];

  it('reports before/after counts and only provable candidates', () => {
    const plan = buildCleanupPlan(records);
    const counts = plan.counts.find((c) => c.provider === 'mongodb' && c.collection === 'books');
    expect(counts).toEqual({ provider: 'mongodb', collection: 'books', before: 4, after: 2 });

    const ids = plan.candidates.map((c) => c.record.id).sort();
    expect(ids).toEqual(['dup-new', 'seed-1']);
    expect(ids).not.toContain('real-1');
    expect(ids).not.toContain('dup-old');
  });

  it('records a human-readable reason for every candidate', () => {
    for (const candidate of buildCleanupPlan(records).candidates) {
      expect(candidate.reason).toMatch(/seed marker|duplicate/);
    }
  });

  it('produces an empty plan for a clean catalog', () => {
    const plan = buildCleanupPlan([records[0]]);
    expect(plan.candidates).toEqual([]);
    expect(plan.duplicateGroups).toEqual([]);
  });

  it('binds the confirmation token to the exact candidate set', () => {
    const a = buildCleanupPlan(records).confirmationToken;
    const b = buildCleanupPlan([...records].reverse()).confirmationToken;
    const c = buildCleanupPlan([...records, book({ id: 'seed-2', slug: 'the-launch-gate' })]).confirmationToken;
    expect(a).toBe(b); // order-independent
    expect(a).not.toBe(c); // changes when the plan changes
    expect(a).toMatch(/^CONFIRM-\d+-[0-9A-F]{8}$/);
  });

  it('fingerprints are order-independent and collision-sensitive', () => {
    expect(planFingerprint(['a', 'b'])).toBe(planFingerprint(['b', 'a']));
    expect(planFingerprint(['a', 'b'])).not.toBe(planFingerprint(['ab']));
  });
});

describe('execution guard', () => {
  const plan = buildCleanupPlan([
    book({ id: 'seed-1', slug: 'cloud-run-chronicles' }),
    book({ id: 'real-1', slug: 'a-real-book' }),
  ]);

  it('defaults to dry run', () => {
    const result = isExecutionAuthorized(plan, { execute: false });
    expect(result.authorized).toBe(false);
    expect(result.message).toContain('DRY RUN');
  });

  it('refuses --execute without a confirmation token', () => {
    const result = isExecutionAuthorized(plan, { execute: true });
    expect(result.authorized).toBe(false);
    expect(result.message).toContain('REFUSED');
    expect(result.message).toContain(plan.confirmationToken);
  });

  it('refuses a stale or wrong confirmation token', () => {
    const result = isExecutionAuthorized(plan, { execute: true, confirm: 'CONFIRM-99-DEADBEEF' });
    expect(result.authorized).toBe(false);
    expect(result.message).toContain('does not match');
  });

  it('authorizes only with --execute AND the matching token', () => {
    expect(isExecutionAuthorized(plan, { execute: true, confirm: plan.confirmationToken }).authorized).toBe(true);
  });

  it('refuses to execute an empty plan', () => {
    const empty = buildCleanupPlan([book({ id: 'real-1', slug: 'a-real-book' })]);
    expect(isExecutionAuthorized(empty, { execute: true, confirm: empty.confirmationToken }).authorized).toBe(false);
  });
});
