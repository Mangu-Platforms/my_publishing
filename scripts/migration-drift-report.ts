#!/usr/bin/env tsx
/**
 * Offline migration drift classifier (Task 3.6 / issue #192).
 *
 * WHY THIS IS OFFLINE
 * Nobody on this task has database credentials, and the production Supabase
 * project's state after its pause/restore is UNVERIFIED. A tool that dials the
 * database would either fail confusingly or, worse, invite someone to hand it
 * a service-role key. So this script imports no database driver, opens no
 * socket, and reads nothing but (a) the migration filenames already in the
 * repository and (b) an evidence file an operator pasted from
 * `scripts/sql/export-migration-history.sql`.
 *
 * Usage:
 *   tsx scripts/migration-drift-report.ts --export ./hosted-export.json
 *   tsx scripts/migration-drift-report.ts --export ./hosted-export.csv --json
 *
 * Options:
 *   --export <path>          Required. JSON envelope (section 9 of the SQL
 *                            export), bare JSON array of {version,name}, or CSV.
 *   --migrations-dir <path>  Default: supabase/migrations
 *   --json                   Emit machine-readable JSON instead of a table.
 *
 * This script NEVER writes a migration and NEVER writes to any database.
 * It classifies. Deciding what to do with the classification is
 * docs/operations/MIGRATION_DRIFT_RECONCILIATION.md, and requires the owner.
 */

import { existsSync, readFileSync, readdirSync } from 'fs';
import { join, resolve } from 'path';

// ---------------------------------------------------------------------------
// Drift classes
// ---------------------------------------------------------------------------

/**
 * The six classes. Everything the report emits is one of these, or `null`
 * meaning "no hosted evidence was pasted for this object" — which is a real
 * outcome and must never be silently collapsed into a guess.
 */
export const DRIFT_CLASSES = [
  'applied-and-in-repo',
  'applied-missing-from-repo',
  'in-repo-not-applied',
  'manually-altered',
  'obsolete',
  'intentional-environment-difference',
] as const;

export type DriftClass = (typeof DRIFT_CLASSES)[number];

export const DRIFT_CLASS_MEANING: Record<DriftClass, string> = {
  'applied-and-in-repo':
    'Hosted and repository agree. No action.',
  'applied-missing-from-repo':
    'Hosted has it, the repository does not explain it. Capture it in a forward migration; never delete hosted history to make it match.',
  'in-repo-not-applied':
    'The repository declares it, hosted does not have it. Apply forward, in version order, after backup.',
  'manually-altered':
    'The hosted state of this object cannot be explained by the repository migration history — it was changed out of band. Codify the current intended state in a forward migration.',
  'obsolete':
    'Present hosted (or historically), and nothing in the repository or the application needs it. Candidate for removal — propose only, never auto-drop.',
  'intentional-environment-difference':
    'Known and accepted difference, recorded by the owner in MIGRATION_DRIFT_RECONCILIATION.md. No action.',
};

// ---------------------------------------------------------------------------
// Hosted evidence shapes (mirror scripts/sql/export-migration-history.sql §9)
// ---------------------------------------------------------------------------

export interface HostedMigrationRow {
  version: string;
  name?: string;
}

export interface HostedColumn {
  table_name: string;
  column_name: string;
  data_type?: string;
  is_nullable?: string;
}

export interface HostedTable {
  table_name: string;
  table_kind?: string;
}

export interface HostedRoutine {
  routine_name: string;
  arg_signature?: string;
  security_type?: string;
}

export interface HostedPolicy {
  schemaname?: string;
  tablename: string;
  policyname: string;
  cmd: string;
}

export interface HostedRls {
  table_name: string;
  rls_enabled: boolean;
}

export interface HostedBucket {
  id: string;
  public: boolean;
}

export interface HostedCount {
  metric: string;
  value: number;
}

/** Which sections the operator actually pasted. Absent !== empty. */
export type HostedSection =
  | 'schema_migrations'
  | 'columns'
  | 'tables'
  | 'routines'
  | 'policies'
  | 'rls'
  | 'buckets'
  | 'counts';

export interface HostedExport {
  exported_at?: string;
  /** false => the supabase_migrations schema does not exist on the host. */
  history_relation_present?: boolean;
  schema_migrations: HostedMigrationRow[];
  columns: HostedColumn[];
  tables: HostedTable[];
  routines: HostedRoutine[];
  policies: HostedPolicy[];
  rls: HostedRls[];
  buckets: HostedBucket[];
  counts: HostedCount[];
  /** Sections present in the pasted evidence. Drives "no evidence" handling. */
  sections: HostedSection[];
  /** How the evidence was supplied — surfaced in the report header. */
  format: 'json-envelope' | 'json-array' | 'csv';
}

// ---------------------------------------------------------------------------
// Expected schema objects (REPOSITORY-VERIFIED catalogue)
// ---------------------------------------------------------------------------

export interface ExpectedObject {
  kind: 'column' | 'table' | 'routine' | 'policy';
  /** 'books.subtitle', 'book_views', 'books_search', 'audit_logs:INSERT'. */
  id: string;
  /** Does any file in supabase/migrations create it? */
  declaredInRepo: boolean;
  /** Does application code under app/ lib/ components/ read or call it? */
  referencedByCode: boolean;
  note: string;
}

/**
 * Confirmed repository-side drift, verified by reading the repo — not by
 * reading the hosted database. Every entry below is "application code depends
 * on this object and no migration in supabase/migrations creates it".
 * Whether hosted HAS them is exactly what the operator export answers.
 */
export const EXPECTED_OBJECTS: ExpectedObject[] = [
  ...[
    'subtitle',
    'epub_url',
    'deleted_at',
    'author_name',
    'metadata',
    'tags',
    'categories',
    'view_count',
    'download_count',
    'manuscript_url',
    'language',
    'seo_title',
    'seo_description',
  ].map<ExpectedObject>((column) => ({
    kind: 'column',
    id: `books.${column}`,
    declaredInRepo: false,
    referencedByCode: true,
    note: 'Read by catalog/admin code; no migration creates it.',
  })),
  {
    kind: 'table',
    id: 'book_view_cache',
    declaredInRepo: false,
    referencedByCode: true,
    note: 'Referenced by analytics code; no migration creates it.',
  },
  {
    kind: 'table',
    id: 'book_views',
    declaredInRepo: false,
    referencedByCode: true,
    note: 'Referenced by analytics code; no migration creates it.',
  },
  {
    kind: 'routine',
    id: 'books_search',
    declaredInRepo: false,
    referencedByCode: true,
    note: 'RPC called by search; no migration creates it.',
  },
  {
    kind: 'routine',
    id: 'increment_view_count',
    declaredInRepo: false,
    referencedByCode: true,
    note: 'RPC called by the book detail path; no migration creates it.',
  },
  {
    kind: 'policy',
    id: 'audit_logs:INSERT',
    declaredInRepo: false,
    referencedByCode: true,
    note:
      'audit_logs has RLS enabled and a SELECT policy from ' +
      '20260118000000_critical_fixes.sql, but no INSERT policy — writes are ' +
      'blocked for every non-service role.',
  },
];

/**
 * Differences the OWNER has decided are intentional and permanent.
 * Deliberately empty: nothing may be marked "intentional" by an agent. Add an
 * id here only alongside a signed-off entry in
 * docs/operations/MIGRATION_DRIFT_RECONCILIATION.md.
 */
export const INTENTIONAL_DIFFERENCES: string[] = [];

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

function emptyExport(format: HostedExport['format']): HostedExport {
  return {
    schema_migrations: [],
    columns: [],
    tables: [],
    routines: [],
    policies: [],
    rls: [],
    buckets: [],
    counts: [],
    sections: [],
    format,
  };
}

/** Minimal CSV reader: handles quoted fields, embedded commas and CRLF. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      quoted = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (ch !== '\r') {
      field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

/**
 * Accepts any of the three shapes an operator can realistically produce:
 *   1. the §9 JSON envelope (preferred — every section present),
 *   2. a bare JSON array of {version, name} (migration history only),
 *   3. CSV with a `version` column (migration history only).
 *
 * Shapes 2 and 3 carry no object-level evidence, so object classification is
 * reported as "no evidence" rather than guessed.
 */
export function parseHostedExport(raw: string): HostedExport {
  const text = raw.replace(/^﻿/, '').trim();
  if (!text) {
    throw new Error('Hosted export is empty. Paste the operator export first.');
  }

  if (text.startsWith('{') || text.startsWith('[')) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (error) {
      throw new Error(
        `Hosted export looks like JSON but did not parse: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }

    if (Array.isArray(parsed)) {
      const out = emptyExport('json-array');
      out.schema_migrations = normaliseMigrationRows(parsed);
      out.sections = ['schema_migrations'];
      return out;
    }

    const obj = parsed as Record<string, unknown>;
    const out = emptyExport('json-envelope');
    out.exported_at = typeof obj.exported_at === 'string' ? obj.exported_at : undefined;
    if (typeof obj.history_relation_present === 'boolean') {
      out.history_relation_present = obj.history_relation_present;
    }
    out.schema_migrations = normaliseMigrationRows(asArray(obj.schema_migrations));
    out.columns = asArray<HostedColumn>(obj.columns);
    out.tables = asArray<HostedTable>(obj.tables);
    out.routines = asArray<HostedRoutine>(obj.routines);
    out.policies = asArray<HostedPolicy>(obj.policies);
    out.rls = asArray<HostedRls>(obj.rls);
    out.buckets = asArray<HostedBucket>(obj.buckets);
    out.counts = asArray<HostedCount>(obj.counts);

    const sectionKeys: HostedSection[] = [
      'schema_migrations',
      'columns',
      'tables',
      'routines',
      'policies',
      'rls',
      'buckets',
      'counts',
    ];
    // Presence is decided by the KEY existing, not by the array being non-empty.
    // An empty `schema_migrations` that was genuinely exported is the whole
    // point of the "new project" case and must not read as "not exported".
    out.sections = sectionKeys.filter((k) => k in obj);
    return out;
  }

  // CSV fallback: migration history only.
  const rows = parseCsv(text);
  if (rows.length === 0) {
    throw new Error('Hosted export CSV contained no rows.');
  }
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const versionIdx = header.indexOf('version');
  if (versionIdx === -1) {
    throw new Error(
      'Hosted export CSV has no "version" column. Export section 1 of ' +
        'scripts/sql/export-migration-history.sql, or use the JSON envelope.'
    );
  }
  const nameIdx = header.indexOf('name');
  const out = emptyExport('csv');
  out.schema_migrations = normaliseMigrationRows(
    rows.slice(1).map((r) => ({
      version: (r[versionIdx] ?? '').trim(),
      name: nameIdx === -1 ? undefined : (r[nameIdx] ?? '').trim(),
    }))
  );
  out.sections = ['schema_migrations'];
  return out;
}

function normaliseMigrationRows(rows: unknown[]): HostedMigrationRow[] {
  return rows
    .map((r) => {
      const row = (r ?? {}) as Record<string, unknown>;
      const version = String(row.version ?? '').trim();
      const name = row.name === undefined || row.name === null ? undefined : String(row.name).trim();
      return { version, name: name || undefined };
    })
    .filter((r) => r.version !== '');
}

// ---------------------------------------------------------------------------
// Repository migration inventory
// ---------------------------------------------------------------------------

export interface RepoMigration {
  version: string;
  name: string;
  file: string;
}

const MIGRATION_FILE = /^(\d{14})_(.+)\.sql$/;

export function parseMigrationFilename(file: string): RepoMigration | null {
  const match = MIGRATION_FILE.exec(file);
  if (!match) return null;
  return { version: match[1], name: match[2], file };
}

/** Read-only directory listing. Never writes, never creates. */
export function readRepoMigrations(dir: string): RepoMigration[] {
  if (!existsSync(dir)) {
    throw new Error(`Migrations directory not found: ${dir}`);
  }
  return readdirSync(dir)
    .map(parseMigrationFilename)
    .filter((m): m is RepoMigration => m !== null)
    .sort((a, b) => a.version.localeCompare(b.version));
}

// ---------------------------------------------------------------------------
// Classification
// ---------------------------------------------------------------------------

export interface DriftRow {
  subject: 'migration' | 'column' | 'table' | 'routine' | 'policy';
  id: string;
  driftClass: DriftClass | null;
  inRepo: boolean;
  /** null = the operator did not paste evidence covering this object. */
  presentHosted: boolean | null;
  note: string;
}

export interface DriftReport {
  exportedAt?: string;
  format: HostedExport['format'];
  historyRelationPresent: boolean | null;
  historyEmpty: boolean;
  /** Empty history + hosted objects existing => almost certainly a NEW project. */
  likelyNewProject: boolean;
  repoMigrationCount: number;
  hostedMigrationCount: number;
  rows: DriftRow[];
  counts: Record<string, number>;
  evidenceGaps: string[];
  warnings: string[];
}

export function classifyMigrations(
  repoMigrations: RepoMigration[],
  hosted: HostedExport
): DriftRow[] {
  const hostedByVersion = new Map(hosted.schema_migrations.map((m) => [m.version, m]));
  const repoByVersion = new Map(repoMigrations.map((m) => [m.version, m]));
  const historyExported = hosted.sections.includes('schema_migrations');

  const rows: DriftRow[] = [];

  for (const migration of repoMigrations) {
    const hostedRow = hostedByVersion.get(migration.version);
    if (!historyExported) {
      rows.push({
        subject: 'migration',
        id: `${migration.version}_${migration.name}`,
        driftClass: null,
        inRepo: true,
        presentHosted: null,
        note: 'No migration history exported — cannot classify.',
      });
      continue;
    }
    if (hostedRow) {
      const renamed =
        hostedRow.name !== undefined &&
        hostedRow.name !== '' &&
        hostedRow.name !== migration.name;
      rows.push({
        subject: 'migration',
        id: `${migration.version}_${migration.name}`,
        driftClass: 'applied-and-in-repo',
        inRepo: true,
        presentHosted: true,
        note: renamed
          ? `Version matches but hosted name is "${hostedRow.name}" — file was renamed after apply. Do NOT rename hosted history; keep the repo filename frozen.`
          : '',
      });
    } else {
      rows.push({
        subject: 'migration',
        id: `${migration.version}_${migration.name}`,
        driftClass: 'in-repo-not-applied',
        inRepo: true,
        presentHosted: false,
        note: 'Apply forward, in version order, after a verified backup.',
      });
    }
  }

  for (const hostedRow of hosted.schema_migrations) {
    if (repoByVersion.has(hostedRow.version)) continue;
    rows.push({
      subject: 'migration',
      id: `${hostedRow.version}${hostedRow.name ? `_${hostedRow.name}` : ''}`,
      driftClass: 'applied-missing-from-repo',
      inRepo: false,
      presentHosted: true,
      note: 'Hosted applied something the repo cannot reproduce. Recover the SQL and commit it as a no-op-safe forward migration; never delete the hosted row.',
    });
  }

  return rows;
}

function hostedHasObject(obj: ExpectedObject, hosted: HostedExport): boolean | null {
  switch (obj.kind) {
    case 'column': {
      if (!hosted.sections.includes('columns')) return null;
      const [table, column] = obj.id.split('.');
      return hosted.columns.some((c) => c.table_name === table && c.column_name === column);
    }
    case 'table': {
      if (!hosted.sections.includes('tables')) return null;
      return hosted.tables.some((t) => t.table_name === obj.id);
    }
    case 'routine': {
      if (!hosted.sections.includes('routines')) return null;
      return hosted.routines.some((r) => r.routine_name === obj.id);
    }
    case 'policy': {
      if (!hosted.sections.includes('policies')) return null;
      const [table, cmd] = obj.id.split(':');
      return hosted.policies.some(
        (p) => p.tablename === table && p.cmd.toUpperCase() === cmd.toUpperCase()
      );
    }
    default:
      return null;
  }
}

export function classifyObjects(
  expected: ExpectedObject[],
  hosted: HostedExport,
  intentional: string[] = INTENTIONAL_DIFFERENCES
): DriftRow[] {
  const accepted = new Set(intentional);

  return expected.map((obj) => {
    const present = hostedHasObject(obj, hosted);
    const base = {
      subject: obj.kind,
      id: obj.id,
      inRepo: obj.declaredInRepo,
      presentHosted: present,
    } as const;

    if (accepted.has(obj.id)) {
      return {
        ...base,
        driftClass: 'intentional-environment-difference' as const,
        note: `Accepted by the owner. ${obj.note}`,
      };
    }
    if (present === null) {
      return {
        ...base,
        driftClass: null,
        note: `No hosted evidence for ${obj.kind}s — run the full export. ${obj.note}`,
      };
    }
    if (obj.declaredInRepo) {
      return present
        ? { ...base, driftClass: 'applied-and-in-repo' as const, note: obj.note }
        : {
            ...base,
            driftClass: 'in-repo-not-applied' as const,
            note: `Repo declares it, hosted lacks it. ${obj.note}`,
          };
    }
    if (!obj.referencedByCode) {
      return {
        ...base,
        driftClass: 'obsolete' as const,
        note: present
          ? `Hosted has it, nothing needs it. Propose a drop — never execute one from this tool. ${obj.note}`
          : `Absent everywhere and unreferenced. Remove from the catalogue. ${obj.note}`,
      };
    }
    // Referenced by code and undeclared by any migration: the hosted state,
    // present or absent, cannot be explained by the repo's history. Either it
    // was hand-applied, or it was hand-applied and lost. Both need a forward
    // migration that states the intended shape.
    return {
      ...base,
      driftClass: 'manually-altered' as const,
      note: present
        ? `Present hosted but created out of band — codify it in a forward migration. ${obj.note}`
        : `Code depends on it and neither the repo nor the host provides it — production is broken for this path. ${obj.note}`,
    };
  });
}

export function buildReport(
  repoMigrations: RepoMigration[],
  hosted: HostedExport,
  expected: ExpectedObject[] = EXPECTED_OBJECTS,
  intentional: string[] = INTENTIONAL_DIFFERENCES
): DriftReport {
  const rows = [
    ...classifyMigrations(repoMigrations, hosted),
    ...classifyObjects(expected, hosted, intentional),
  ];

  const counts: Record<string, number> = { unclassified: 0 };
  for (const cls of DRIFT_CLASSES) counts[cls] = 0;
  for (const row of rows) {
    if (row.driftClass === null) counts.unclassified++;
    else counts[row.driftClass]++;
  }

  const historyExported = hosted.sections.includes('schema_migrations');
  const historyEmpty = historyExported && hosted.schema_migrations.length === 0;
  const hostedObjectsExist =
    hosted.tables.length > 0 || hosted.columns.length > 0 || hosted.routines.length > 0;

  const evidenceGaps: string[] = [];
  const allSections: HostedSection[] = [
    'schema_migrations',
    'columns',
    'tables',
    'routines',
    'policies',
    'rls',
    'buckets',
    'counts',
  ];
  for (const section of allSections) {
    if (!hosted.sections.includes(section)) {
      evidenceGaps.push(`No "${section}" evidence in the pasted export.`);
    }
  }

  const warnings: string[] = [];
  if (hosted.history_relation_present === false) {
    warnings.push(
      'supabase_migrations.schema_migrations DOES NOT EXIST on the host. This is the "restore produced a new project" signal — follow the decision tree in docs/operations/MIGRATION_DRIFT_RECONCILIATION.md before writing anything.'
    );
  }
  if (historyEmpty && hostedObjectsExist) {
    warnings.push(
      'Migration history is EMPTY but hosted schema objects exist. The schema was created outside the migration system, or the history table was reset by the restore. Do not "replay" the repo blindly — every migration would attempt to recreate live objects.'
    );
  }
  if (historyEmpty && !hostedObjectsExist) {
    warnings.push(
      'Migration history is empty and no hosted objects were reported. Consistent with a genuinely new/blank project. A fresh baseline plan is required — that is a finding, not an error.'
    );
  }

  return {
    exportedAt: hosted.exported_at,
    format: hosted.format,
    historyRelationPresent:
      hosted.history_relation_present === undefined ? null : hosted.history_relation_present,
    historyEmpty,
    likelyNewProject: hosted.history_relation_present === false || historyEmpty,
    repoMigrationCount: repoMigrations.length,
    hostedMigrationCount: hosted.schema_migrations.length,
    rows,
    counts,
    evidenceGaps,
    warnings,
  };
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

export function formatReport(report: DriftReport): string {
  const out: string[] = [];
  out.push('# Migration drift report (offline — pasted evidence only)');
  out.push('');
  out.push(`Evidence format:        ${report.format}`);
  out.push(`Hosted exported_at:     ${report.exportedAt ?? '(not supplied)'}`);
  out.push(
    `History relation:       ${
      report.historyRelationPresent === null
        ? '(not reported)'
        : report.historyRelationPresent
          ? 'present'
          : 'ABSENT'
    }`
  );
  out.push(`Repo migration files:   ${report.repoMigrationCount}`);
  out.push(`Hosted history rows:    ${report.hostedMigrationCount}`);
  out.push('');

  if (report.warnings.length > 0) {
    out.push('## Warnings');
    for (const w of report.warnings) out.push(`- ${w}`);
    out.push('');
  }

  out.push('## Summary');
  for (const cls of DRIFT_CLASSES) {
    out.push(`- ${cls}: ${report.counts[cls]}`);
  }
  out.push(`- unclassified (no hosted evidence): ${report.counts.unclassified}`);
  out.push('');

  out.push('## Detail');
  out.push('| subject | object | class | in repo | hosted | note |');
  out.push('| --- | --- | --- | --- | --- | --- |');
  for (const row of report.rows) {
    const hostedCell =
      row.presentHosted === null ? 'unknown' : row.presentHosted ? 'yes' : 'no';
    out.push(
      `| ${row.subject} | ${row.id} | ${row.driftClass ?? 'unclassified'} | ${
        row.inRepo ? 'yes' : 'no'
      } | ${hostedCell} | ${row.note.replace(/\|/g, '\\|')} |`
    );
  }
  out.push('');

  if (report.evidenceGaps.length > 0) {
    out.push('## Evidence gaps');
    out.push('These are UNVERIFIED, not "fine". Re-run the export to close them.');
    for (const gap of report.evidenceGaps) out.push(`- ${gap}`);
    out.push('');
  }

  out.push('## Rules that apply to every row above');
  out.push('- Never rewrite already-applied history.');
  out.push('- Prefer forward-only corrective migrations.');
  out.push('- Back up before any corrective action.');
  out.push('- No new migration is applied until the drift is understood and the owner approves.');
  out.push('');
  out.push('This tool made no database connection. It classified pasted evidence only.');

  return out.join('\n');
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

export interface CliOptions {
  exportPath: string;
  migrationsDir: string;
  json: boolean;
}

export function parseArgs(argv: string[]): CliOptions {
  let exportPath = '';
  let migrationsDir = 'supabase/migrations';
  let json = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--export') exportPath = argv[++i] ?? '';
    else if (arg === '--migrations-dir') migrationsDir = argv[++i] ?? migrationsDir;
    else if (arg === '--json') json = true;
    else if (arg === '--help' || arg === '-h') exportPath = '';
    else throw new Error(`Unknown argument: ${arg}`);
  }

  if (!exportPath) {
    throw new Error(
      'Usage: tsx scripts/migration-drift-report.ts --export <hosted-export.json|csv> ' +
        '[--migrations-dir supabase/migrations] [--json]\n' +
        'Produce the export with scripts/sql/export-migration-history.sql. ' +
        'Keep the export file OUTSIDE the repository.'
    );
  }
  return { exportPath, migrationsDir, json };
}

export function run(options: CliOptions): DriftReport {
  const hosted = parseHostedExport(readFileSync(resolve(options.exportPath), 'utf8'));
  const repoMigrations = readRepoMigrations(resolve(options.migrationsDir));
  return buildReport(repoMigrations, hosted);
}

function main(): void {
  const options = parseArgs(process.argv.slice(2));
  const report = run(options);
  console.log(options.json ? JSON.stringify(report, null, 2) : formatReport(report));
}

/**
 * Only run when invoked directly. Importing this module from a test (or any
 * other script) must not execute the CLI.
 */
function isDirectInvocation(): boolean {
  return /migration-drift-report\.(ts|js)$/.test(process.argv[1] ?? '');
}

if (isDirectInvocation()) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// `join` is re-exported for callers that build a migrations dir path.
export const migrationsDirFor = (root: string): string => join(root, 'supabase', 'migrations');
