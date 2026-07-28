/** @jest-environment node */
/**
 * Classifier coverage for Task 3.6 (issue #192).
 *
 * All fixtures are FABRICATED. Nothing here asserts anything about the real
 * hosted database — the hosted state is unverified and this suite must never
 * imply otherwise. What it does assert is that when an operator pastes real
 * evidence, the classification of that evidence is correct and deterministic.
 */

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

import {
  DRIFT_CLASSES,
  EXPECTED_OBJECTS,
  INTENTIONAL_DIFFERENCES,
  buildReport,
  classifyMigrations,
  classifyObjects,
  parseCsv,
  parseHostedExport,
  parseMigrationFilename,
  readRepoMigrations,
  type ExpectedObject,
  type HostedExport,
  type RepoMigration,
} from '@/scripts/migration-drift-report';

const repo = (version: string, name: string): RepoMigration => ({
  version,
  name,
  file: `${version}_${name}.sql`,
});

/** Build a fabricated hosted export with every section marked as exported. */
function hostedFixture(partial: Partial<HostedExport> = {}): HostedExport {
  return {
    schema_migrations: [],
    columns: [],
    tables: [],
    routines: [],
    policies: [],
    rls: [],
    buckets: [],
    counts: [],
    sections: [
      'schema_migrations',
      'columns',
      'tables',
      'routines',
      'policies',
      'rls',
      'buckets',
      'counts',
    ],
    format: 'json-envelope',
    history_relation_present: true,
    ...partial,
  };
}

describe('parseHostedExport', () => {
  it('parses the JSON envelope produced by section 9 of the SQL export', () => {
    const parsed = parseHostedExport(
      JSON.stringify({
        exported_at: '2026-07-28T00:00:00+00:00',
        history_relation_present: true,
        schema_migrations: [{ version: '20260116000000', name: 'initial_schema' }],
        columns: [{ table_name: 'books', column_name: 'subtitle', data_type: 'text' }],
        tables: [{ table_name: 'books', table_kind: 'BASE TABLE' }],
        routines: [],
        policies: [],
        rls: [],
        buckets: [],
        counts: [],
      })
    );

    expect(parsed.format).toBe('json-envelope');
    expect(parsed.schema_migrations).toEqual([
      { version: '20260116000000', name: 'initial_schema' },
    ]);
    expect(parsed.sections).toContain('columns');
    expect(parsed.history_relation_present).toBe(true);
  });

  it('treats a section as exported when the key exists even if the array is empty', () => {
    // This is the whole "new project" case — an empty history that was really
    // exported must not be confused with a history that was never exported.
    const parsed = parseHostedExport(JSON.stringify({ schema_migrations: [] }));
    expect(parsed.sections).toContain('schema_migrations');
    expect(parsed.schema_migrations).toHaveLength(0);
  });

  it('accepts a bare JSON array as history-only evidence', () => {
    const parsed = parseHostedExport('[{"version":"20260116000000","name":"initial_schema"}]');
    expect(parsed.format).toBe('json-array');
    expect(parsed.sections).toEqual(['schema_migrations']);
    expect(parsed.columns).toHaveLength(0);
  });

  it('accepts CSV with version/name columns in any order and strips a BOM', () => {
    const parsed = parseHostedExport(
      '﻿name,version\r\ninitial_schema,20260116000000\r\nanalytics_events,20260117000000\r\n'
    );
    expect(parsed.format).toBe('csv');
    expect(parsed.schema_migrations).toEqual([
      { version: '20260116000000', name: 'initial_schema' },
      { version: '20260117000000', name: 'analytics_events' },
    ]);
  });

  it('rejects empty input and CSV with no version column', () => {
    expect(() => parseHostedExport('   ')).toThrow(/empty/i);
    expect(() => parseHostedExport('foo,bar\n1,2')).toThrow(/version/i);
  });

  it('handles quoted CSV fields containing commas', () => {
    expect(parseCsv('a,b\n"x,y",z\n')).toEqual([
      ['a', 'b'],
      ['x,y', 'z'],
    ]);
  });
});

describe('classifyMigrations', () => {
  const repoMigrations = [
    repo('20260116000000', 'initial_schema'),
    repo('20260117000000', 'analytics_events'),
  ];

  it('classifies a version present on both sides as applied-and-in-repo', () => {
    const rows = classifyMigrations(
      repoMigrations,
      hostedFixture({
        schema_migrations: [
          { version: '20260116000000', name: 'initial_schema' },
          { version: '20260117000000', name: 'analytics_events' },
        ],
      })
    );
    expect(rows.every((r) => r.driftClass === 'applied-and-in-repo')).toBe(true);
  });

  it('classifies a hosted version with no repo file as applied-missing-from-repo', () => {
    const rows = classifyMigrations(
      repoMigrations,
      hostedFixture({
        schema_migrations: [
          { version: '20260116000000', name: 'initial_schema' },
          { version: '20260117000000', name: 'analytics_events' },
          { version: '20260901000000', name: 'hotfix_applied_by_hand' },
        ],
      })
    );
    const orphan = rows.find((r) => r.id.startsWith('20260901000000'));
    expect(orphan?.driftClass).toBe('applied-missing-from-repo');
    expect(orphan?.inRepo).toBe(false);
    expect(orphan?.presentHosted).toBe(true);
    expect(orphan?.note).toMatch(/never delete the hosted row/i);
  });

  it('classifies a repo file absent from hosted history as in-repo-not-applied', () => {
    const rows = classifyMigrations(
      repoMigrations,
      hostedFixture({
        schema_migrations: [{ version: '20260116000000', name: 'initial_schema' }],
      })
    );
    const pending = rows.find((r) => r.id.startsWith('20260117000000'));
    expect(pending?.driftClass).toBe('in-repo-not-applied');
    expect(pending?.presentHosted).toBe(false);
  });

  it('flags a version whose hosted name differs from the repo filename', () => {
    const rows = classifyMigrations(
      [repo('20260116000000', 'initial_schema')],
      hostedFixture({
        schema_migrations: [{ version: '20260116000000', name: 'initial_schema_v2' }],
      })
    );
    expect(rows[0].driftClass).toBe('applied-and-in-repo');
    expect(rows[0].note).toMatch(/renamed after apply/i);
  });

  it('refuses to classify anything when no history was exported', () => {
    const rows = classifyMigrations(
      repoMigrations,
      hostedFixture({ sections: ['columns'], schema_migrations: [] })
    );
    expect(rows.every((r) => r.driftClass === null)).toBe(true);
    expect(rows.every((r) => r.presentHosted === null)).toBe(true);
  });
});

describe('empty hosted history (restore produced a new project)', () => {
  const repoMigrations = [
    repo('20260116000000', 'initial_schema'),
    repo('20260117000000', 'analytics_events'),
  ];

  it('reports every repo migration as in-repo-not-applied and flags a likely new project', () => {
    const report = buildReport(
      repoMigrations,
      hostedFixture({ schema_migrations: [], history_relation_present: true })
    );

    expect(report.historyEmpty).toBe(true);
    expect(report.likelyNewProject).toBe(true);
    expect(report.hostedMigrationCount).toBe(0);
    expect(report.counts['in-repo-not-applied']).toBe(2);
    expect(report.counts['applied-and-in-repo']).toBe(0);
    expect(report.warnings.join(' ')).toMatch(/blank project|new\/blank|fresh baseline/i);
  });

  it('warns loudly when the history is empty but hosted objects exist', () => {
    const report = buildReport(
      repoMigrations,
      hostedFixture({
        schema_migrations: [],
        tables: [{ table_name: 'books' }],
        columns: [{ table_name: 'books', column_name: 'title' }],
      })
    );
    expect(report.warnings.join(' ')).toMatch(/EMPTY but hosted schema objects exist/i);
    expect(report.warnings.join(' ')).toMatch(/Do not "replay" the repo blindly/i);
  });

  it('warns when the supabase_migrations schema does not exist at all', () => {
    const report = buildReport(
      repoMigrations,
      hostedFixture({ schema_migrations: [], history_relation_present: false })
    );
    expect(report.historyRelationPresent).toBe(false);
    expect(report.likelyNewProject).toBe(true);
    expect(report.warnings.join(' ')).toMatch(/DOES NOT EXIST/);
  });
});

describe('classifyObjects', () => {
  const referencedUndeclared: ExpectedObject = {
    kind: 'column',
    id: 'books.subtitle',
    declaredInRepo: false,
    referencedByCode: true,
    note: 'fixture',
  };
  const declared: ExpectedObject = {
    kind: 'table',
    id: 'audit_logs',
    declaredInRepo: true,
    referencedByCode: true,
    note: 'fixture',
  };
  const unreferencedUndeclared: ExpectedObject = {
    kind: 'table',
    id: 'legacy_scratch',
    declaredInRepo: false,
    referencedByCode: false,
    note: 'fixture',
  };

  it('marks a hosted object that no migration creates as manually-altered', () => {
    const [row] = classifyObjects(
      [referencedUndeclared],
      hostedFixture({ columns: [{ table_name: 'books', column_name: 'subtitle' }] })
    );
    expect(row.driftClass).toBe('manually-altered');
    expect(row.presentHosted).toBe(true);
    expect(row.note).toMatch(/created out of band/i);
  });

  it('marks a code-required object that neither side provides as manually-altered and broken', () => {
    const [row] = classifyObjects([referencedUndeclared], hostedFixture({ columns: [] }));
    expect(row.driftClass).toBe('manually-altered');
    expect(row.presentHosted).toBe(false);
    expect(row.note).toMatch(/production is broken for this path/i);
  });

  it('marks a hosted object nothing needs as obsolete', () => {
    const [row] = classifyObjects(
      [unreferencedUndeclared],
      hostedFixture({ tables: [{ table_name: 'legacy_scratch' }] })
    );
    expect(row.driftClass).toBe('obsolete');
    expect(row.note).toMatch(/never execute one from this tool/i);
  });

  it('marks a repo-declared object missing hosted as in-repo-not-applied', () => {
    const [row] = classifyObjects([declared], hostedFixture({ tables: [] }));
    expect(row.driftClass).toBe('in-repo-not-applied');
  });

  it('marks a repo-declared object present hosted as applied-and-in-repo', () => {
    const [row] = classifyObjects(
      [declared],
      hostedFixture({ tables: [{ table_name: 'audit_logs' }] })
    );
    expect(row.driftClass).toBe('applied-and-in-repo');
  });

  it('honours an owner-approved intentional difference allow-list', () => {
    const [row] = classifyObjects([referencedUndeclared], hostedFixture({ columns: [] }), [
      'books.subtitle',
    ]);
    expect(row.driftClass).toBe('intentional-environment-difference');
  });

  it('ships with an empty intentional allow-list — only the owner may add to it', () => {
    expect(INTENTIONAL_DIFFERENCES).toEqual([]);
  });

  it('returns null (unclassified) rather than guessing when evidence is absent', () => {
    const [row] = classifyObjects(
      [referencedUndeclared],
      hostedFixture({ sections: ['schema_migrations'] })
    );
    expect(row.driftClass).toBeNull();
    expect(row.presentHosted).toBeNull();
    expect(row.note).toMatch(/No hosted evidence/i);
  });

  it('detects a missing INSERT policy on audit_logs from policy evidence', () => {
    const auditInsert = EXPECTED_OBJECTS.find((o) => o.id === 'audit_logs:INSERT');
    expect(auditInsert).toBeDefined();

    const [row] = classifyObjects(
      [auditInsert as ExpectedObject],
      hostedFixture({
        policies: [
          { tablename: 'audit_logs', policyname: 'Admins can view audit logs', cmd: 'SELECT' },
        ],
      })
    );
    expect(row.presentHosted).toBe(false);
    expect(row.driftClass).toBe('manually-altered');
  });
});

describe('buildReport', () => {
  it('counts every class and lists evidence gaps for sections that were not pasted', () => {
    const report = buildReport(
      [repo('20260116000000', 'initial_schema')],
      hostedFixture({
        sections: ['schema_migrations'],
        schema_migrations: [{ version: '20260116000000', name: 'initial_schema' }],
      })
    );

    for (const cls of DRIFT_CLASSES) {
      expect(typeof report.counts[cls]).toBe('number');
    }
    expect(report.counts['applied-and-in-repo']).toBe(1);
    // Every catalogued object is unclassified because only history was pasted.
    expect(report.counts.unclassified).toBe(EXPECTED_OBJECTS.length);
    expect(report.evidenceGaps.some((g) => g.includes('columns'))).toBe(true);
    expect(report.evidenceGaps.some((g) => g.includes('buckets'))).toBe(true);
  });
});

describe('repository migration inventory', () => {
  const dir = join(process.cwd(), 'supabase/migrations');

  it('parses every .sql file in supabase/migrations', () => {
    const sqlFiles = readdirSync(dir).filter((f) => f.endsWith('.sql'));
    expect(sqlFiles.length).toBeGreaterThan(0);
    for (const file of sqlFiles) {
      expect(parseMigrationFilename(file)).not.toBeNull();
    }
  });

  it('has unique, strictly ascending versions', () => {
    const migrations = readRepoMigrations(dir);
    const versions = migrations.map((m) => m.version);
    expect(new Set(versions).size).toBe(versions.length);
    expect([...versions].sort()).toEqual(versions);
  });
});

describe('offline guarantee', () => {
  it('the drift report imports no database driver and opens no connection', () => {
    // The tool must work on pasted evidence alone. If someone adds a driver
    // import here, this test is the tripwire.
    const source = readFileSync(join(process.cwd(), 'scripts/migration-drift-report.ts'), 'utf8');
    const imports = source.match(/^import[\s\S]*?from '([^']+)';/gm) ?? [];
    const specifiers = imports.map((line) => /from '([^']+)';/.exec(line)?.[1] ?? '');
    expect(specifiers).toEqual(expect.arrayContaining(['fs', 'path']));
    for (const specifier of specifiers) {
      expect(specifier).not.toMatch(/mongodb|supabase|pg|postgres|@vercel/i);
    }
  });

  it('the backfill script has no execute mode', () => {
    const source = readFileSync(join(process.cwd(), 'scripts/backfill-books-dry-run.ts'), 'utf8');
    // No write operation may appear in the reader paths.
    expect(source).not.toMatch(/\.(insertOne|insertMany|updateOne|updateMany|deleteOne|deleteMany|bulkWrite|replaceOne)\(/);
    expect(source).not.toMatch(/\.upsert\(|\.from\([^)]*\)\.insert\(|\.from\([^)]*\)\.update\(/);
    // And the forbidden flags must be actively rejected, not merely absent.
    expect(source).toMatch(/FORBIDDEN_FLAGS/);
    expect(source).toMatch(/never will be/);
  });
});
