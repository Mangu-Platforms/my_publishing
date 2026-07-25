/* eslint-disable */
/**
 * Phoenix P11.5 — VERIFY. Runnable mongosh script printing PASS/FAIL per check.
 *
 * Usage:
 *   mongosh "$MONGODB_URI" --quiet --file scripts/verify-migration.mongo.js
 *
 *   # with count reconciliation against the P11.2 transform report:
 *   EXPECTED_COUNTS="$(jq -c '[.counts|to_entries[]|{(.key):.value.out}]|add' export/transform-report.json)" \
 *     mongosh "$MONGODB_URI" --quiet --file scripts/verify-migration.mongo.js
 *
 * Exits 1 if any check FAILS, so it can gate P11.6 sign-off in a pipeline.
 *
 * Deviations from PROJECT_PHOENIX.md §5.5 P11.5 (see doc revision 4.0.2):
 *
 *   1. The documented checks use `db.user.distinct('id')`. At the raw collection
 *      level the Better Auth Mongo adapter stores the key as `_id`; there is no
 *      `id` field. `distinct('id')` returns [], and `{$nin: []}` matches every
 *      document — so the documented integrity checks would report 100% of rows
 *      as orphans. These use `_id`.
 *   2. `$nin: <full distinct array>` does not scale past a few thousand rows.
 *      Replaced with `$lookup` anti-joins.
 *   3. Adds a check the doc omits and North Star #4 requires: no credential
 *      account may carry a real password hash.
 */

const DB_NAME = process.env.MONGODB_DB || 'mangu';
const target = db.getSiblingDB(DB_NAME);

let failures = 0;
let warnings = 0;

function record(status, label, detail) {
  const tag = status === 'PASS' ? 'PASS' : status === 'WARN' ? 'WARN' : 'FAIL';
  if (tag === 'FAIL') failures++;
  if (tag === 'WARN') warnings++;
  print(`  [${tag}] ${label}${detail ? ` — ${detail}` : ''}`);
}

/** Asserts an anti-join returns no rows: every `localField` resolves. */
function checkReferences(label, from, localField, to, extraMatch) {
  const pipeline = [];
  const match = Object.assign({}, extraMatch || {});
  match[localField] = { $ne: null };
  pipeline.push({ $match: match });
  pipeline.push({
    $lookup: { from: to, localField: localField, foreignField: '_id', as: '_resolved' },
  });
  pipeline.push({ $match: { _resolved: { $size: 0 } } });
  pipeline.push({ $count: 'orphans' });

  const result = target.getCollection(from).aggregate(pipeline).toArray();
  const orphans = result.length ? result[0].orphans : 0;
  record(
    orphans === 0 ? 'PASS' : 'FAIL',
    `${from}.${localField} → ${to}`,
    orphans === 0 ? 'all resolve' : `${orphans} unresolved`
  );
  return orphans;
}

/** Same, but the foreign key points at a string `_id` (Better Auth `user`). */
function checkStringReferences(label, from, localField) {
  const pipeline = [
    { $match: { [localField]: { $ne: null } } },
    { $lookup: { from: 'user', localField: localField, foreignField: '_id', as: '_resolved' } },
    { $match: { _resolved: { $size: 0 } } },
    { $count: 'orphans' },
  ];
  const result = target.getCollection(from).aggregate(pipeline).toArray();
  const orphans = result.length ? result[0].orphans : 0;
  record(
    orphans === 0 ? 'PASS' : 'FAIL',
    `${from}.${localField} → user`,
    orphans === 0 ? 'all resolve' : `${orphans} unresolved`
  );
  return orphans;
}

print('');
print('──────────────────────────────────────────────────────────────');
print(`Phoenix P11.5 — migration verification   db="${DB_NAME}"`);
print('──────────────────────────────────────────────────────────────');

// ── 1. Counts ───────────────────────────────────────────────────────────────
print('');
print('1. Collection counts');

const collections = [
  'user',
  'account',
  'profiles',
  'authors',
  'books',
  'orders',
  'reviews',
  'reading_progress',
];
const actual = {};
for (const name of collections) {
  actual[name] = target.getCollection(name).countDocuments();
  print(`      ${name.padEnd(18)} ${actual[name]}`);
}

let expected = null;
if (process.env.EXPECTED_COUNTS) {
  try {
    expected = JSON.parse(process.env.EXPECTED_COUNTS);
  } catch (e) {
    record('FAIL', 'EXPECTED_COUNTS parse', e.message);
  }
}

print('');
print('2. Count reconciliation vs transform report');
if (!expected) {
  record(
    'WARN',
    'reconciliation skipped',
    'set EXPECTED_COUNTS to compare against export/transform-report.json'
  );
} else {
  for (const name of collections) {
    if (expected[name] === undefined) continue;
    const ok = actual[name] === expected[name];
    record(
      ok ? 'PASS' : 'FAIL',
      `${name} count`,
      ok ? `${actual[name]}` : `imported ${actual[name]}, transform produced ${expected[name]}`
    );
  }
}

// ── 3. Referential integrity ────────────────────────────────────────────────
print('');
print('3. Referential integrity (each must resolve completely)');

checkStringReferences('profiles auth user', 'profiles', 'auth_user_id');
checkStringReferences('orders owner', 'orders', 'user_id');
checkStringReferences('reviews author', 'reviews', 'user_id');
checkStringReferences('reading progress owner', 'reading_progress', 'user_id');
checkStringReferences('accounts owner', 'account', 'userId');

checkReferences('authors profile', 'authors', 'profile_id', 'profiles');
checkReferences('books author', 'books', 'author_id', 'authors');
checkReferences('reviews book', 'reviews', 'book_id', 'books');
checkReferences('reading progress book', 'reading_progress', 'book_id', 'books');

// Books whose legacy author_id was NULL are legitimate (Supabase nulls the FK on
// author delete), but they are invisible in the author portal, so surface them.
const authorlessBooks = target.getCollection('books').countDocuments({ author_id: null });
record(
  authorlessBooks === 0 ? 'PASS' : 'WARN',
  'books with no author',
  authorlessBooks === 0 ? 'none' : `${authorlessBooks} book(s) have author_id: null`
);

const emptyOrders = target
  .getCollection('orders')
  .countDocuments({ $or: [{ order_items: { $size: 0 } }, { order_items: { $exists: false } }] });
record(
  emptyOrders === 0 ? 'PASS' : 'FAIL',
  'orders have line items',
  emptyOrders === 0 ? 'none empty' : `${emptyOrders} order(s) with no items`
);

// ── 4. Credential safety — North Star #4 ────────────────────────────────────
print('');
print('4. Credential safety (no migrated password hashes)');

const credentialAccounts = target
  .getCollection('account')
  .countDocuments({ providerId: 'credential' });
const lockedAccounts = target
  .getCollection('account')
  .countDocuments({ providerId: 'credential', password: /^!locked:/ });
const bcryptAccounts = target
  .getCollection('account')
  .countDocuments({ providerId: 'credential', password: /^\$2[aby]?\$/ });

record(
  bcryptAccounts === 0 ? 'PASS' : 'FAIL',
  'no bcrypt hashes present',
  bcryptAccounts === 0 ? 'none' : `${bcryptAccounts} account(s) carry a bcrypt hash — ABORT CUTOVER`
);
record(
  lockedAccounts === credentialAccounts ? 'PASS' : 'WARN',
  'every credential account is locked',
  `${lockedAccounts}/${credentialAccounts} locked` +
    (lockedAccounts === credentialAccounts
      ? ''
      : ' — unlocked accounts are expected only after forced resets have been completed')
);

const usersWithoutAccount = target
  .getCollection('user')
  .aggregate([
    { $lookup: { from: 'account', localField: '_id', foreignField: 'userId', as: '_acct' } },
    { $match: { _acct: { $size: 0 } } },
    { $count: 'n' },
  ])
  .toArray();
const orphanUsers = usersWithoutAccount.length ? usersWithoutAccount[0].n : 0;
record(
  orphanUsers === 0 ? 'PASS' : 'FAIL',
  'every user has a credential account',
  orphanUsers === 0 ? 'none missing' : `${orphanUsers} user(s) cannot ever sign in`
);

// ── 5. Storage URLs — WS3.4 must have run ───────────────────────────────────
print('');
print('5. Legacy storage references');

const legacyStorage = target.getCollection('books').countDocuments({
  $or: [{ cover_url: /supabase\.co\/storage/ }, { manuscript_url: /supabase\.co\/storage/ }],
});
record(
  legacyStorage === 0 ? 'PASS' : 'FAIL',
  'no supabase storage URLs remain',
  legacyStorage === 0 ? 'none' : `${legacyStorage} book(s) still point at Supabase Storage`
);

// ── 6. Uniqueness invariants ────────────────────────────────────────────────
print('');
print('6. Uniqueness invariants');

function duplicateCount(collection, field) {
  const rows = target
    .getCollection(collection)
    .aggregate([
      { $match: { [field]: { $ne: null } } },
      { $group: { _id: `$${field}`, n: { $sum: 1 } } },
      { $match: { n: { $gt: 1 } } },
      { $count: 'dupes' },
    ])
    .toArray();
  return rows.length ? rows[0].dupes : 0;
}

const dupeSlugs = duplicateCount('books', 'slug');
record(
  dupeSlugs === 0 ? 'PASS' : 'FAIL',
  'books.slug unique',
  dupeSlugs === 0 ? 'no duplicates' : `${dupeSlugs} duplicated slug(s)`
);

const dupeIntents = duplicateCount('orders', 'stripe_payment_intent_id');
record(
  dupeIntents === 0 ? 'PASS' : 'FAIL',
  'orders.stripe_payment_intent_id unique',
  dupeIntents === 0
    ? 'no duplicates'
    : `${dupeIntents} duplicated intent(s) — webhook idempotency broken`
);

const dupeAuthUsers = duplicateCount('profiles', 'auth_user_id');
record(
  dupeAuthUsers === 0 ? 'PASS' : 'FAIL',
  'profiles.auth_user_id unique',
  dupeAuthUsers === 0 ? 'no duplicates' : `${dupeAuthUsers} duplicated profile(s)`
);

// The unique sparse index is what enforces webhook idempotency at write time;
// duplicate-free data is not enough if the index is missing.
function hasIndex(collection, name) {
  return target
    .getCollection(collection)
    .getIndexes()
    .some((ix) => ix.name === name);
}

record(
  hasIndex('orders', 'orders_stripe_payment_intent_uq') ? 'PASS' : 'FAIL',
  'unique index orders_stripe_payment_intent_uq',
  'run npm run db:mongo:indexes if missing'
);
record(
  hasIndex('books', 'books_slug_uq') ? 'PASS' : 'FAIL',
  'unique index books_slug_uq',
  'run npm run db:mongo:indexes if missing'
);

// ── 7. Deliberately-not-imported collections ────────────────────────────────
print('');
print('7. Collections intentionally left empty');

for (const name of ['session', 'verification']) {
  const n = target.getCollection(name).countDocuments();
  record(
    n === 0 ? 'PASS' : 'WARN',
    `${name} is empty`,
    n === 0 ? 'as designed' : `${n} document(s) present — sessions are wiped by design`
  );
}

// ── Summary ─────────────────────────────────────────────────────────────────
print('');
print('──────────────────────────────────────────────────────────────');
if (failures === 0) {
  print(
    `P11.5 PASSED${warnings ? ` with ${warnings} warning(s)` : ''} — ready for P11.6 sign-off.`
  );
} else {
  print(
    `P11.5 FAILED — ${failures} failing check(s)${warnings ? `, ${warnings} warning(s)` : ''}.`
  );
  print('Halt. Do not proceed to Phase 12 code cutover.');
}
print('──────────────────────────────────────────────────────────────');
print('');

if (failures > 0) {
  quit(1);
}
