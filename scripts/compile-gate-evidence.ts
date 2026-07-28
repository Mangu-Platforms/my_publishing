/**
 * scripts/compile-gate-evidence.ts
 *
 * Task 5.1 — launch gate evidence compiler.
 *
 * Reads `docs/launch/LAUNCH_GATE_EVIDENCE.md` and reports, gate by gate, which of
 * G1–G13 actually carry evidence and which do not.
 *
 * WHY THIS EXISTS
 * The ALL-TRUE rule (`docs/NEXT_GO.md` §6, CCR-003) makes a single unevidenced gate
 * a NO-GO. The failure mode it guards against is not a gate marked FALSE — that is
 * honest — it is a gate marked PASSED with an empty evidence cell. To a human
 * skimming a 13-row table that reads as a pass, which is exactly the "false
 * success" CCR-006 prohibits. So the hard rule implemented here is:
 *
 *   a gate marked PASSED without an evidence link, a commit SHA, an environment
 *   and a named human approver is an ERROR, not a pass.
 *
 * OWNERSHIP — READ ONLY
 * `docs/launch/LAUNCH_GATE_EVIDENCE.md` is owned elsewhere and is an append-only
 * operator record (CCR-002). A tool that rewrote it would destroy the audit trail
 * that rule depends on. Nothing in this file opens anything for writing.
 *
 * OFFLINE BY DESIGN
 * No network, no database, no new dependency. This script cannot open an evidence
 * link, confirm a SHA is deployed, or confirm a human did the work. It checks the
 * SHAPE of the evidence, never its truth. CI can never satisfy a manual gate
 * (CCR-014) and neither can this script — a green run here is not evidence.
 *
 * EXIT CODES (distinct on purpose, matching the convention in the launch tooling:
 * "we did not check" must never be reported as "we checked and it passed")
 *   0  GO        — 13/13 PASSED, evidence complete, one SHA, no open exception
 *   1  NO-GO     — evaluated and not ready, verdict withheld, or a validation error
 *   2  CANNOT RUN — document missing or no gate table could be parsed
 *
 * Run: npx tsx scripts/compile-gate-evidence.ts [--file=<path>] [--json]
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Portable script dir: works under tsx (CJS) and plain node type-stripping (ESM).
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(SCRIPT_DIR, '..');
const DEFAULT_EVIDENCE_PATH = path.join(REPO_ROOT, 'docs', 'launch', 'LAUNCH_GATE_EVIDENCE.md');

/** G1..G13 — the hard gate matrix in docs/NEXT_GO.md §6. Not configurable: the gate
 *  set is the authority's, and a document that omits one has a hole, not a shorter list. */
const EXPECTED_GATES: string[] = [];
for (let i = 1; i <= 13; i += 1) EXPECTED_GATES.push('G' + String(i));

/**
 * Gates CI can never satisfy (CCR-014; rule 4 of the evidence document itself).
 * They also require a real backend (CCR-010, docs/NEXT_GO.md §8 rule 7), so a
 * local or mocked environment is rejected for them specifically.
 */
const HUMAN_EVIDENCE_GATES = new Set(['G3', 'G5', 'G10']);

const PASS_STATUSES = new Set([
  'passed', 'pass', 'true', 'complete', 'completed', 'done', 'yes', 'ok', 'go',
]);
const NOT_PASSED_STATUSES = new Set([
  'not started', 'notstarted', 'in progress', 'blocked', 'failed', 'fail', 'false',
  'pending', 'unverified', 'partial', 'no', 'no-go', 'nogo', 'n/a', 'na', 'none',
]);
/** docs/NEXT_GO.md §1 and rule 6 of the evidence document: WAIVED is never valid for
 *  an unchanged hard gate, and SUPERSEDED needs a replacement to point at. */
const REFUSED_STATUSES = new Set(['waived', 'superseded']);

const EXCEPTION_FIELDS = ['owner', 'risk', 'mitigation', 'deadline'] as const;

// ---------------------------------------------------------------------------
// Cell helpers
// ---------------------------------------------------------------------------

/** Drop the markdown that decorates a cell without changing its meaning. */
function stripMarkdown(cell: string): string {
  return cell
    .replace(/`/g, '')
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalize(cell: string): string {
  return stripMarkdown(cell).toLowerCase();
}

/**
 * True when a cell is an unfilled slot rather than a value. The evidence template
 * uses long underscore runs and ballot boxes as fill-in blanks, so those are blank,
 * not content.
 */
function isBlankCell(cell: string): boolean {
  const s = normalize(cell);
  if (s.length === 0) return true;
  if (/^[_\-–—.·\s]+$/.test(s)) return true;
  if (s.charAt(0) === '☐' || s.charAt(0) === '☑') return true;
  return s === 'tbd' || s === 'todo' || s === 'tba' || s === '?' || s === '???';
}

/**
 * True when a cell carries a usable value. `n/a`, `none` and `pending` are refused
 * for evidence fields: a gate cannot be PASSED and simultaneously have no approver.
 */
function isUsableValue(cell: string): boolean {
  if (isBlankCell(cell)) return false;
  const s = normalize(cell);
  return !(s === 'n/a' || s === 'na' || s === 'none' || s === 'pending' || s === 'unknown');
}

/**
 * "Verified locally" is not evidence (rule 2 of the evidence document), so a link
 * cell must actually resolve to something a reviewer can open: a URL, a markdown
 * link, a committed artifact path, an issue/PR reference, or a Stripe event id.
 */
function looksLikeEvidenceLink(cell: string): boolean {
  const raw = cell.trim();
  const s = stripMarkdown(cell);
  if (/https?:\/\/\S+/i.test(s)) return true;
  if (/\[[^\]]+\]\([^)]+\)/.test(raw)) return true;
  if (/[\w./-]+\.(md|json|txt|log|png|jpe?g|pdf|csv|ya?ml|har)\b/i.test(s)) return true;
  if (/(^|\s)#\d{1,6}(\s|$)/.test(s)) return true;
  if (/\bevt_[A-Za-z0-9]+/.test(s)) return true;
  return false;
}

function isShaLike(cell: string): boolean {
  return /^[0-9a-f]{7,40}$/i.test(stripMarkdown(cell));
}

/** Same commit or not. Short SHAs are compared by prefix, in the shorter direction. */
function shaMatches(a: string, b: string): boolean {
  const x = stripMarkdown(a).toLowerCase();
  const y = stripMarkdown(b).toLowerCase();
  const n = Math.min(x.length, y.length);
  if (n < 7) return false;
  return x.slice(0, n) === y.slice(0, n);
}

/**
 * An approver is a person (rule 5 of the evidence document; CCR-014). A workflow,
 * a bot or an agent signing off a human gate is the exact substitution the control
 * forbids, so those names are rejected rather than warned about.
 */
function isHumanApprover(cell: string): boolean {
  if (!isUsableValue(cell)) return false;
  const s = normalize(cell);
  if (!/[a-z]/.test(s)) return false;
  if (s.length < 2) return false;
  return !/\b(ci|cd|bot|bots|github-?actions|actions|workflow|automation|automated|agent|robot|script|dependabot|copilot|claude)\b/.test(
    s
  );
}

/** Mocks and localhost cannot satisfy a real-backend gate (CCR-010). */
function isRealBackendEnvironment(cell: string): boolean {
  const s = normalize(cell);
  return !/local|localhost|127\.0\.0\.1|mock|stub|fixture|use_?mocks|skip_?emails|dev\b/.test(s);
}

// ---------------------------------------------------------------------------
// Markdown table parsing
// ---------------------------------------------------------------------------

interface TableRow {
  cells: string[];
  line: number;
}

interface MarkdownTable {
  headers: string[];
  rows: TableRow[];
  headerLine: number;
}

function splitRow(line: string): string[] {
  let s = line.trim();
  if (s.charAt(0) === '|') s = s.slice(1);
  if (s.length > 0 && s.charAt(s.length - 1) === '|') s = s.slice(0, -1);
  return s.split('|').map((c) => c.trim());
}

function isSeparatorRow(cells: string[]): boolean {
  return cells.length > 0 && cells.every((c) => /^:?-{2,}:?$/.test(c.replace(/\s/g, '')));
}

/**
 * Deliberately simple: a table is a header row, a `---` separator, then body rows.
 * A cell containing an unescaped `|` would split wrongly — that limitation is real
 * and is why the evidence document must not put pipes inside cells.
 */
function parseTables(lines: string[]): MarkdownTable[] {
  const tables: MarkdownTable[] = [];
  for (let i = 0; i < lines.length - 1; i += 1) {
    if (lines[i].trim().charAt(0) !== '|') continue;
    const headers = splitRow(lines[i]);
    const separator = splitRow(lines[i + 1]);
    if (!isSeparatorRow(separator) || separator.length !== headers.length) continue;

    const rows: TableRow[] = [];
    let j = i + 2;
    for (; j < lines.length && lines[j].trim().charAt(0) === '|'; j += 1) {
      rows.push({ cells: splitRow(lines[j]), line: j + 1 });
    }
    tables.push({ headers, rows, headerLine: i + 1 });
    i = j - 1;
  }
  return tables;
}

/** Header text carries provenance annotations ("Requirement *(from ...)*"); cut them. */
function normalizeHeader(header: string): string {
  return normalize(header).replace(/\s*\(.*\)\s*$/, '').trim();
}

function pickColumn(headers: string[], candidates: string[]): number {
  const normalized = headers.map(normalizeHeader);
  for (const candidate of candidates) {
    const idx = normalized.indexOf(candidate);
    if (idx >= 0) return idx;
  }
  return -1;
}

function cellAt(row: TableRow, index: number): string {
  if (index < 0 || index >= row.cells.length) return '';
  return row.cells[index];
}

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------

type GateVerdict = 'EVIDENCED' | 'INCOMPLETE' | 'UNEVIDENCED' | 'NOT PASSED' | 'ERROR';

interface GateRecord {
  gate: string;
  status: string;
  evidenceLink: string;
  commitSha: string;
  environment: string;
  approver: string;
  exception: string;
  verdict: GateVerdict;
  problems: string[];
  line: number;
}

interface ExceptionRecord {
  source: string;
  missing: string[];
  open: boolean;
  line: number;
}

const errors: string[] = [];
const blockers: string[] = [];
const notes: string[] = [];

const fail = (msg: string) => errors.push(msg);
const block = (msg: string) => blockers.push(msg);

// ---------------------------------------------------------------------------
// Exceptions
// ---------------------------------------------------------------------------

/**
 * An exception is only an exception if somebody owns it, its risk is stated, it is
 * mitigated and it expires. Anything less is an unowned open risk wearing the word
 * "exception", so the required shape is machine-checked:
 *
 *   owner=<person>; risk=<what breaks>; mitigation=<what we do>; deadline=YYYY-MM-DD
 *
 * `;`-separated, `=` or `:` accepted. `none` / blank means no exception.
 */
function readExceptionField(text: string, key: string): string {
  const re = new RegExp('\\b' + key + '\\s*[=:]\\s*([^;|]+)', 'i');
  const m = re.exec(text);
  return m === null ? '' : m[1].trim();
}

function inspectException(cell: string, source: string, line: number): ExceptionRecord | null {
  if (isBlankCell(cell)) return null;
  const s = normalize(cell);
  if (s === 'none' || s === 'no' || s === 'n/a' || s === 'na' || s === 'closed' || s === 'resolved') {
    return null;
  }

  const text = stripMarkdown(cell);
  const missing: string[] = [];
  for (const field of EXCEPTION_FIELDS) {
    const value = readExceptionField(text, field);
    if (value.length === 0 || isBlankCell(value)) {
      missing.push(field);
      continue;
    }
    if (field === 'deadline' && !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      missing.push('deadline (must be an ISO date, YYYY-MM-DD; got "' + value + '")');
    }
  }
  return { source, missing, open: true, line };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

interface Args {
  file: string;
  json: boolean;
  help: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { file: DEFAULT_EVIDENCE_PATH, json: false, help: false };
  for (const arg of argv) {
    if (arg === '--json') args.json = true;
    else if (arg === '--help' || arg === '-h') args.help = true;
    else if (arg.indexOf('--file=') === 0) {
      args.file = path.resolve(process.cwd(), arg.slice('--file='.length));
    }
  }
  return args;
}

const HELP = [
  'compile-gate-evidence — report which of G1–G13 carry evidence and which do not.',
  '',
  'Usage: npx tsx scripts/compile-gate-evidence.ts [--file=<path>] [--json]',
  '',
  '  --file=<path>  evidence document (default docs/launch/LAUNCH_GATE_EVIDENCE.md)',
  '  --json         machine-readable output',
  '',
  'Exit 0 = GO, 1 = NO-GO / verdict withheld / validation error, 2 = could not run.',
  'Read-only, offline. It checks the shape of evidence, not its truth.',
].join('\n');

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(HELP);
    return;
  }

  if (!fs.existsSync(args.file)) {
    console.error('CANNOT RUN: evidence document not found at ' + args.file);
    console.error('  This is not a NO-GO — nothing was evaluated. Create the document first.');
    process.exit(2);
    return; // unreachable; keeps control-flow analysis honest without @types/node
  }

  const text = fs.readFileSync(args.file, 'utf8');
  const lines = text.split(/\r?\n/);
  const tables = parseTables(lines);

  // --- Release candidate SHA (CCR-005: one immutable SHA behind every row) -----
  let declaredSha = '';
  // Anchored: the label must START the line. An unanchored match also hits the prose in
  // §1 ("...must reference the same release candidate SHA. A green result...") and would
  // read a sentence fragment as a commit SHA.
  const shaLine = /^(?:release candidate sha|release sha|rc sha)\s*:\s*(.*)$/i;
  for (const line of lines) {
    const m = shaLine.exec(stripMarkdown(line));
    if (m !== null && !isBlankCell(m[1])) {
      declaredSha = stripMarkdown(m[1]).split(/\s/)[0];
      break;
    }
  }
  if (declaredSha.length === 0) {
    fail(
      'No release candidate SHA is declared. Exact-SHA evidence only (CCR-005) — ' +
        'without one, no row can be tied to the build it describes.'
    );
  } else if (!isShaLike(declaredSha)) {
    fail('Declared release candidate SHA "' + declaredSha + '" is not a commit SHA.');
  }

  // --- Locate the gate table --------------------------------------------------
  let gateTable: MarkdownTable | null = null;
  let cols = { gate: -1, status: -1, link: -1, sha: -1, env: -1, approver: -1, exception: -1 };
  for (const table of tables) {
    const candidate = {
      gate: pickColumn(table.headers, ['gate']),
      status: pickColumn(table.headers, ['status']),
      link: pickColumn(table.headers, ['evidence link', 'evidence']),
      sha: pickColumn(table.headers, ['commit sha', 'sha']),
      env: pickColumn(table.headers, ['environment', 'env']),
      approver: pickColumn(table.headers, ['approver']),
      exception: pickColumn(table.headers, ['open exception', 'exception']),
    };
    if (candidate.gate >= 0 && candidate.status >= 0 && candidate.approver >= 0) {
      gateTable = table;
      cols = candidate;
      break;
    }
  }

  if (gateTable === null) {
    console.error('CANNOT RUN: no gate table found in ' + args.file);
    console.error(
      '  Expected a markdown table with at least "Gate", "Status" and "Approver" columns.'
    );
    process.exit(2);
    return; // unreachable; keeps control-flow analysis honest without @types/node
  }

  for (const [name, index] of [
    ['Evidence link', cols.link],
    ['Commit SHA', cols.sha],
    ['Environment', cols.env],
    ['Open exception', cols.exception],
  ] as [string, number][]) {
    if (index < 0) {
      fail(
        'The gate table has no "' + name + '" column. A gate cannot be shown to be ' +
          'evidenced without it, so no row can be accepted as PASSED.'
      );
    }
  }

  // --- Read the gate rows -----------------------------------------------------
  const gates: GateRecord[] = [];
  const seen = new Set<string>();
  const exceptions: ExceptionRecord[] = [];

  for (const row of gateTable.rows) {
    const gateId = stripMarkdown(cellAt(row, cols.gate)).toUpperCase();
    if (!/^G\d{1,2}$/.test(gateId)) continue;

    if (seen.has(gateId)) {
      fail(gateId + ': duplicate row at line ' + String(row.line) + ' — one row per gate.');
      continue;
    }
    seen.add(gateId);
    if (EXPECTED_GATES.indexOf(gateId) < 0) {
      fail(gateId + ' (line ' + String(row.line) + ') is not a gate in docs/NEXT_GO.md §6 (G1–G13).');
    }

    const record: GateRecord = {
      gate: gateId,
      status: stripMarkdown(cellAt(row, cols.status)),
      evidenceLink: stripMarkdown(cellAt(row, cols.link)),
      commitSha: stripMarkdown(cellAt(row, cols.sha)),
      environment: stripMarkdown(cellAt(row, cols.env)),
      approver: stripMarkdown(cellAt(row, cols.approver)),
      exception: cellAt(row, cols.exception),
      verdict: 'UNEVIDENCED',
      problems: [],
      line: row.line,
    };

    const status = normalize(record.status);

    if (isBlankCell(record.status)) {
      record.verdict = 'UNEVIDENCED';
      record.problems.push('no status recorded');
      block(gateId + ': no status recorded — the gate has not been evaluated.');
    } else if (REFUSED_STATUSES.has(status)) {
      record.verdict = 'ERROR';
      record.problems.push('status "' + record.status + '" is not valid for a hard gate');
      fail(
        gateId + ': status "' + record.status + '". WAIVED is never valid for an unchanged ' +
          'hard gate and SUPERSEDED needs a replacement gate to point at ' +
          '(docs/NEXT_GO.md §1; evidence document rule 6).'
      );
    } else if (PASS_STATUSES.has(status)) {
      // The whole point of this tool: a pass must carry all four evidence fields.
      const missing: string[] = [];
      if (!isUsableValue(record.evidenceLink)) missing.push('evidence link');
      else if (!looksLikeEvidenceLink(record.evidenceLink)) {
        record.problems.push('evidence link is not openable');
        fail(
          gateId + ': marked ' + record.status + ' but the evidence cell ("' + record.evidenceLink +
            '") is not a link a reviewer can open. "Verified locally" is not evidence.'
        );
      }
      if (!isUsableValue(record.commitSha)) missing.push('commit SHA');
      if (!isUsableValue(record.environment)) missing.push('environment');
      if (!isUsableValue(record.approver)) missing.push('approver');

      if (missing.length > 0) {
        record.verdict = 'ERROR';
        record.problems.push('missing ' + missing.join(', '));
        fail(
          gateId + ': marked ' + record.status + ' but has no ' + missing.join(', ') +
            '. A pass without evidence is a false success (CCR-006) and does not count.'
        );
      } else {
        record.verdict = 'EVIDENCED';
      }

      if (isUsableValue(record.commitSha)) {
        if (!isShaLike(record.commitSha)) {
          record.verdict = 'ERROR';
          fail(gateId + ': commit SHA "' + record.commitSha + '" is not a commit SHA.');
        } else if (declaredSha.length > 0 && isShaLike(declaredSha) && !shaMatches(record.commitSha, declaredSha)) {
          record.verdict = 'ERROR';
          record.problems.push('SHA differs from the release candidate');
          fail(
            gateId + ': evidence is from ' + record.commitSha + ' but the release candidate is ' +
              declaredSha + '. A green from another SHA is not evidence (CCR-005).'
          );
        }
      }

      if (isUsableValue(record.approver) && !isHumanApprover(record.approver)) {
        record.verdict = 'ERROR';
        record.problems.push('approver is not a person');
        fail(
          gateId + ': approver "' + record.approver + '" is not a person. Manual gates need ' +
            'human evidence and CI cannot substitute (CCR-014).'
        );
      }

      if (HUMAN_EVIDENCE_GATES.has(gateId) && isUsableValue(record.environment) && !isRealBackendEnvironment(record.environment)) {
        record.verdict = 'ERROR';
        record.problems.push('environment is not a real backend');
        fail(
          gateId + ': environment "' + record.environment + '" is not a real backend. Mocks and ' +
            'localhost cannot satisfy this gate (CCR-010, docs/NEXT_GO.md §8 rule 7).'
        );
      }
    } else if (NOT_PASSED_STATUSES.has(status)) {
      record.verdict = 'NOT PASSED';
      block(gateId + ': status ' + record.status + ' — NO-GO until it is PASSED with evidence.');
    } else {
      record.verdict = 'ERROR';
      record.problems.push('unrecognised status');
      fail(
        gateId + ': status "' + record.status + '" is outside the vocabulary in docs/NEXT_GO.md §1 ' +
          '(NOT STARTED / IN PROGRESS / BLOCKED / FAILED / PASSED / SUPERSEDED / WAIVED).'
      );
    }

    const exception = inspectException(record.exception, gateId, record.line);
    if (exception !== null) {
      exceptions.push(exception);
      if (record.verdict === 'EVIDENCED') record.verdict = 'INCOMPLETE';
      record.problems.push('open exception');
    }

    gates.push(record);
  }

  for (const gate of EXPECTED_GATES) {
    if (!seen.has(gate)) {
      fail(gate + ' has no row in the gate table. Every gate in docs/NEXT_GO.md §6 needs one.');
      block(gate + ': absent from the evidence document.');
    }
  }

  // --- Any exceptions register elsewhere in the document ----------------------
  for (const table of tables) {
    if (table === gateTable) continue;
    const idx: Record<string, number> = {};
    let complete = true;
    for (const field of EXCEPTION_FIELDS) {
      idx[field] = pickColumn(table.headers, [field]);
      if (idx[field] < 0) complete = false;
    }
    if (!complete) continue;

    const statusCol = pickColumn(table.headers, ['status', 'state']);
    for (const row of table.rows) {
      if (row.cells.every((c) => isBlankCell(c))) continue;
      const label = stripMarkdown(cellAt(row, 0)) || 'row at line ' + String(row.line);
      const missing: string[] = [];
      for (const field of EXCEPTION_FIELDS) {
        const value = cellAt(row, idx[field]);
        if (!isUsableValue(value)) missing.push(field);
        else if (field === 'deadline' && !/^\d{4}-\d{2}-\d{2}$/.test(stripMarkdown(value))) {
          missing.push('deadline (must be an ISO date, YYYY-MM-DD)');
        }
      }
      const state = statusCol >= 0 ? normalize(cellAt(row, statusCol)) : '';
      const open = !(state === 'closed' || state === 'resolved' || state === 'done');
      exceptions.push({ source: 'exception register: ' + label, missing, open, line: row.line });
    }
  }

  for (const exception of exceptions) {
    if (exception.missing.length > 0) {
      fail(
        exception.source + ' (line ' + String(exception.line) + '): exception is missing ' +
          exception.missing.join(', ') + '. An exception without an owner, a stated risk, a ' +
          'mitigation and a deadline is an unowned open risk. Required shape: ' +
          'owner=<person>; risk=<what breaks>; mitigation=<what we do>; deadline=YYYY-MM-DD'
      );
    }
    if (exception.open) {
      block(exception.source + ': open exception — it blocks the gate until it is closed.');
    }
  }

  // --- Verdict ----------------------------------------------------------------
  const evidenced = gates.filter((g) => g.verdict === 'EVIDENCED');
  const unevidenced = gates.filter((g) => g.verdict === 'UNEVIDENCED');
  const missingRows = EXPECTED_GATES.filter((g) => !seen.has(g));
  const malformedExceptions = exceptions.filter((e) => e.missing.length > 0);

  // Refuse to report readiness at all when the input is incomplete. Reporting
  // "NO-GO" would imply an evaluation happened; nothing was evaluated for a gate
  // with no status. The distinction matters when someone later asks what we knew.
  const withheld = unevidenced.length > 0 || missingRows.length > 0 || malformedExceptions.length > 0;
  const allPassed = evidenced.length === EXPECTED_GATES.length && errors.length === 0;
  const openExceptions = exceptions.filter((e) => e.open);

  let verdict: 'GO' | 'NO-GO' | 'WITHHELD';
  if (withheld) verdict = 'WITHHELD';
  else if (allPassed && openExceptions.length === 0) verdict = 'GO';
  else verdict = 'NO-GO';

  if (args.json) {
    console.log(
      JSON.stringify(
        {
          document: args.file,
          releaseCandidateSha: declaredSha,
          verdict,
          evidencedCount: evidenced.length,
          expectedCount: EXPECTED_GATES.length,
          gates: gates.map((g) => ({
            gate: g.gate,
            status: g.status,
            verdict: g.verdict,
            evidenceLink: g.evidenceLink,
            commitSha: g.commitSha,
            environment: g.environment,
            approver: g.approver,
            problems: g.problems,
          })),
          missingRows,
          errors,
          blockers,
          notes,
        },
        null,
        2
      )
    );
  } else {
    console.log('Launch gate evidence — ' + path.relative(REPO_ROOT, args.file));
    console.log('Release candidate SHA: ' + (declaredSha.length > 0 ? declaredSha : '(not declared)'));
    console.log('');
    console.log('  Gate  Verdict       Status           Link  SHA  Env  Approver');
    console.log('  ----  ------------  ---------------  ----  ---  ---  --------');
    for (const gate of gates) {
      const mark = (value: string, ok: boolean) => (isUsableValue(value) && ok ? ' ok ' : ' -- ');
      console.log(
        '  ' + gate.gate.padEnd(5) +
          gate.verdict.padEnd(14) +
          (gate.status.length > 0 ? gate.status : '(blank)').slice(0, 15).padEnd(17) +
          mark(gate.evidenceLink, looksLikeEvidenceLink(gate.evidenceLink)).padEnd(6) +
          mark(gate.commitSha, isShaLike(gate.commitSha)).padEnd(5) +
          mark(gate.environment, true).padEnd(5) +
          mark(gate.approver, isHumanApprover(gate.approver))
      );
    }
    for (const gate of missingRows) console.log('  ' + gate.padEnd(5) + 'ABSENT');

    console.log('');
    console.log('Evidenced: ' + String(evidenced.length) + ' / ' + String(EXPECTED_GATES.length));

    if (errors.length > 0) {
      console.log('');
      console.log('ERRORS (' + String(errors.length) + ') — these are defects in the evidence, not gate states:');
      for (const e of errors) console.log('  x ' + e);
    }
    if (blockers.length > 0) {
      console.log('');
      console.log('BLOCKERS (' + String(blockers.length) + '):');
      for (const b of blockers) console.log('  - ' + b);
    }

    console.log('');
    if (verdict === 'WITHHELD') {
      console.log('VERDICT WITHHELD — readiness was not evaluated.');
      console.log(
        '  ' + String(unevidenced.length + missingRows.length) + ' gate(s) carry no status and ' +
          String(malformedExceptions.length) + ' exception(s) are incomplete.'
      );
      console.log('  Operationally this is NO-GO by default (docs/NEXT_GO.md §8 rule 1), but it must');
      console.log('  not be recorded as an evaluated NO-GO: nothing was evaluated.');
    } else if (verdict === 'GO') {
      console.log('GO — 13/13 gates PASSED with complete evidence at ' + declaredSha + '.');
      console.log('  This tool checked the SHAPE of the evidence. It did not open a link, confirm a');
      console.log('  deploy, or confirm a human did the work. Sign-off is still human (CCR-014).');
    } else {
      console.log('NO-GO — ' + String(EXPECTED_GATES.length - evidenced.length) + ' gate(s) are not PASSED with complete evidence.');
    }

    console.log('');
    console.log('This report is not itself gate evidence.');
  }

  process.exit(verdict === 'GO' ? 0 : 1);
}

main();
