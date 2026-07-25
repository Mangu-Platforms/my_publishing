#!/usr/bin/env tsx
/**
 * Phoenix — batch forced-password-reset for migrated legacy users.
 *
 * Every legacy account was imported with a locked credential (`!locked:<uuid>`)
 * because Supabase bcrypt hashes are never migrated (North Star #4). This script
 * is how those users get back in: it asks Better Auth to issue a reset email for
 * each one.
 *
 * A human triggers this in production (HUMAN_TASKS.md Phase 11). Default is a
 * DRY RUN — nothing is sent unless --send is passed.
 *
 * Usage:
 *   npm run phoenix:forced-resets                      # dry run, prints the plan
 *   npm run phoenix:forced-resets -- --send            # actually send
 *   npm run phoenix:forced-resets -- --send --limit 50 # first batch only
 *   npm run phoenix:forced-resets -- --send --resume-from progress.json
 *
 * Requires: MONGODB_URI, BETTER_AUTH_SECRET, BETTER_AUTH_URL (or
 * NEXT_PUBLIC_SITE_URL), RESEND_API_KEY.
 *
 * Safe to re-run: --resume-from skips addresses already recorded as sent, so an
 * interrupted run does not double-mail anyone.
 */

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { loadDotEnvLocal } from './lib/env-file';

const LOCKED_PREFIX = '!locked:';

function argValue(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  return idx >= 0 && idx + 1 < process.argv.length ? process.argv[idx + 1] : undefined;
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

interface ProgressFile {
  started_at: string;
  updated_at: string;
  sent: string[];
  failed: Array<{ email: string; error: string }>;
}

function loadProgress(path: string | undefined): ProgressFile {
  if (path && existsSync(resolve(process.cwd(), path))) {
    const parsed = JSON.parse(readFileSync(resolve(process.cwd(), path), 'utf8')) as ProgressFile;
    return {
      started_at: parsed.started_at ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
      sent: Array.isArray(parsed.sent) ? parsed.sent : [],
      failed: Array.isArray(parsed.failed) ? parsed.failed : [],
    };
  }
  return {
    started_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    sent: [],
    failed: [],
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function main(): Promise<void> {
  loadDotEnvLocal();

  const send = hasFlag('--send');
  const limit = Number(argValue('--limit') ?? '0') || 0;
  // Resend's default ceiling is 2 requests/second; 600ms keeps a safety margin
  // and the reset mail is not time-critical.
  const delayMs = Number(argValue('--delay-ms') ?? '600');
  const progressPath = argValue('--resume-from') ?? 'forced-reset-progress.json';
  const onlyEmail = argValue('--email');

  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI is required.');
    process.exit(1);
  }

  // The reset endpoint lives behind the Better Auth provider, so enable it for
  // this process only. Never writes AUTH_PROVIDER back to the environment.
  process.env.AUTH_PROVIDER = 'better-auth';

  const { getDb } = await import('../lib/mongodb');
  const { getAuth } = await import('../lib/auth');

  const db = await getDb();

  // Only locked accounts need a reset. Anyone who already set a password (or
  // signed up post-cutover) is skipped, which is what makes re-runs safe.
  const lockedUserIds = await db
    .collection('account')
    .find(
      { providerId: 'credential', password: { $regex: `^${LOCKED_PREFIX.replace('!', '\\!')}` } },
      { projection: { userId: 1 } }
    )
    .map((doc) => String((doc as { userId?: unknown }).userId ?? ''))
    .toArray();

  const uniqueUserIds = Array.from(new Set(lockedUserIds.filter(Boolean)));

  const users = await db
    .collection('user')
    .find({ _id: { $in: uniqueUserIds } } as Record<string, unknown>, {
      projection: { _id: 1, email: 1, name: 1 },
    })
    .toArray();

  let targets = users
    .map((u) => ({
      id: String(u._id),
      email: String((u as { email?: unknown }).email ?? '')
        .trim()
        .toLowerCase(),
    }))
    .filter((u) => u.email.includes('@'));

  if (onlyEmail) {
    targets = targets.filter((u) => u.email === onlyEmail.trim().toLowerCase());
  }

  const progress = loadProgress(progressPath);
  const alreadySent = new Set(progress.sent);
  const pending = targets.filter((t) => !alreadySent.has(t.email));
  const batch = limit > 0 ? pending.slice(0, limit) : pending;

  console.log('');
  console.log(`Phoenix forced password reset — ${send ? 'LIVE SEND' : 'DRY RUN'}`);
  console.log('──────────────────────────────────────────────');
  console.log(`  locked credential accounts : ${uniqueUserIds.length}`);
  console.log(`  resolvable email addresses : ${targets.length}`);
  console.log(`  already sent (progress)    : ${alreadySent.size}`);
  console.log(`  this run                   : ${batch.length}`);
  console.log(`  progress file              : ${progressPath}`);
  console.log(`  delay between sends        : ${delayMs}ms`);
  console.log('');

  if (uniqueUserIds.length > 0 && targets.length === 0) {
    console.warn('No locked account has a usable email address — nothing to do.');
  }

  if (!send) {
    console.log('Dry run. First 10 recipients:');
    for (const t of batch.slice(0, 10)) console.log(`  ${t.email}`);
    if (batch.length > 10) console.log(`  … and ${batch.length - 10} more`);
    console.log('');
    console.log('Re-run with --send to deliver. Nothing was sent.');
    process.exit(0);
  }

  // Legacy copy: "Welcome to the new Mangu — set your password" rather than the
  // standard "Reset your password", which would confuse someone who never asked.
  process.env.AUTH_LEGACY_RESET_COPY = '1';

  const auth = await getAuth();
  const baseUrl = (
    process.env.BETTER_AUTH_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    'http://localhost:3000'
  ).replace(/\/+$/, '');

  let sent = 0;
  for (const [index, target] of batch.entries()) {
    try {
      await auth.api.requestPasswordReset({
        body: { email: target.email, redirectTo: `${baseUrl}/reset-password/confirm` },
      });
      progress.sent.push(target.email);
      sent += 1;
      console.log(`  [${index + 1}/${batch.length}] sent → ${target.email}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      progress.failed.push({ email: target.email, error: message });
      console.error(`  [${index + 1}/${batch.length}] FAILED → ${target.email}: ${message}`);
    }

    // Persist after every send so a crash never re-mails the same person.
    progress.updated_at = new Date().toISOString();
    writeFileSync(resolve(process.cwd(), progressPath), `${JSON.stringify(progress, null, 2)}\n`);

    if (index < batch.length - 1) await sleep(delayMs);
  }

  console.log('');
  console.log('──────────────────────────────────────────────');
  console.log(`  sent this run : ${sent}`);
  console.log(`  failed        : ${progress.failed.length}`);
  console.log(`  total sent    : ${progress.sent.length} / ${targets.length}`);
  console.log(`  report        : ${progressPath}`);
  console.log('');

  if (progress.failed.length > 0) {
    console.error('Some sends failed. Re-run the same command to retry only those.');
    process.exit(1);
  }
  console.log('Forced-reset batch complete.');
}

main().catch((error) => {
  console.error(`[send-forced-resets] ${error instanceof Error ? error.message : error}`);
  process.exit(1);
});
