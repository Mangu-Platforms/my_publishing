/**
 * Phoenix P11.2 transform invariants.
 *
 * The first block is the most important test in the migration: Supabase bcrypt
 * hashes must never reach Better Auth (North Star #4 / R-AUTH-07). "Re-hash on
 * first login" was the v3.0 bug and must stay impossible.
 */

import {
  LOCKED_PASSWORD_PREFIX,
  createSlugAllocator,
  mapBookStatus,
  mapOrderStatus,
  nameFromMetadata,
  normalizeRole,
  slugify,
  toExtendedDate,
  transform,
  type TransformInput,
  type TransformOptions,
} from '../../scripts/lib/transform';

const NOW = new Date('2026-07-25T00:00:00.000Z');

function options(): TransformOptions {
  let oidSeq = 0;
  let uuidSeq = 0;
  return {
    // Deterministic 24-char hex so assertions can name exact ids.
    newObjectId: () => {
      oidSeq += 1;
      return oidSeq.toString(16).padStart(24, '0');
    },
    newUuid: () => {
      uuidSeq += 1;
      return `uuid-${uuidSeq}`;
    },
    now: NOW,
  };
}

function emptyInput(): TransformInput {
  return {
    auth_users: [],
    profiles: [],
    authors: [],
    books: [],
    orders_raw: [],
    reviews: [],
    reading_progress: [],
  };
}

/** A minimal but fully-linked dataset: 1 user → profile → author → book. */
function linkedInput(): TransformInput {
  return {
    auth_users: [
      {
        id: '11111111-1111-1111-1111-111111111111',
        email: 'Reader@Example.com',
        email_confirmed_at: '2026-01-02T03:04:05Z',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-05T00:00:00Z',
        raw_user_meta_data: { full_name: 'Ada Lovelace' },
      },
    ],
    profiles: [
      {
        id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        user_id: '11111111-1111-1111-1111-111111111111',
        email: 'reader@example.com',
        full_name: 'Ada Lovelace',
        role: 'author',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
    ],
    authors: [
      {
        id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        profile_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        pen_name: 'A. Lovelace',
        is_verified: true,
        total_books: 1,
        royalty_rate: '50.00',
        created_at: '2026-01-01T00:00:00Z',
      },
    ],
    books: [
      {
        id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
        title: 'Notes on the Analytical Engine',
        slug: 'notes-on-the-analytical-engine',
        author_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        status: 'published',
        price: '19.99',
        created_at: '2026-01-01T00:00:00Z',
      },
    ],
    orders_raw: [],
    reviews: [],
    reading_progress: [],
  };
}

describe('never migrates password hashes (North Star #4)', () => {
  const bcryptHash = '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';

  it('emits exactly one locked credential account per user', () => {
    const input = emptyInput();
    input.auth_users = [
      {
        id: 'u-1',
        email: 'a@example.com',
        email_confirmed_at: null,
        created_at: '2026-01-01T00:00:00Z',
      },
      {
        id: 'u-2',
        email: 'b@example.com',
        email_confirmed_at: null,
        created_at: '2026-01-01T00:00:00Z',
      },
    ];

    const { account, report } = transform(input, options());

    expect(account).toHaveLength(2);
    expect(report.locked_accounts).toBe(2);
    for (const doc of account) {
      expect(doc.providerId).toBe('credential');
      expect(doc.accountId).toBe(doc.userId);
      expect(String(doc.password).startsWith(LOCKED_PASSWORD_PREFIX)).toBe(true);
    }
    // Each account gets its own sentinel, so one leaked value unlocks nothing.
    expect(new Set(account.map((a) => a.password)).size).toBe(2);
  });

  it('never copies a bcrypt hash even when one is present on the source row', () => {
    const input = emptyInput();
    input.auth_users = [
      {
        id: 'u-1',
        email: 'a@example.com',
        email_confirmed_at: null,
        created_at: '2026-01-01T00:00:00Z',
        // A real export includes encrypted_password; the transform must ignore it.
        raw_user_meta_data: { encrypted_password: bcryptHash },
      } as TransformInput['auth_users'][number] & { raw_user_meta_data: Record<string, unknown> },
    ];

    const { user, account } = transform(input, options());
    const serialized = JSON.stringify({ user, account });

    expect(serialized).not.toContain(bcryptHash);
    expect(serialized).not.toContain('$2a$');
    expect(serialized).not.toContain('encrypted_password');
  });

  it('produces a sentinel that cannot be mistaken for a scrypt salt:hash pair', () => {
    const input = emptyInput();
    input.auth_users = [
      { id: 'u-1', email: 'a@e.com', email_confirmed_at: null, created_at: null },
    ];

    const password = String(transform(input, options()).account[0].password);
    const [salt, hash] = password.split(':');

    expect(salt).toBe('!locked');
    // Better Auth's scrypt verify expects hex; '!locked' can never be produced by
    // its hasher, so verification always fails for legacy accounts.
    expect(salt).not.toMatch(/^[0-9a-f]+$/);
    expect(hash).toBeTruthy();
  });
});

describe('Task 2.2 — user docs', () => {
  it('keeps the legacy UUID as _id so Better Auth resolves user.id to it', () => {
    const { user } = transform(linkedInput(), options());
    expect(user[0]._id).toBe('11111111-1111-1111-1111-111111111111');
  });

  it('derives emailVerified from email_confirmed_at and lowercases the email', () => {
    const input = linkedInput();
    const { user } = transform(input, options());
    expect(user[0].emailVerified).toBe(true);
    expect(user[0].email).toBe('reader@example.com');

    input.auth_users[0].email_confirmed_at = null;
    expect(transform(input, options()).user[0].emailVerified).toBe(false);
  });

  it('takes name from raw_user_meta_data and role from the profile', () => {
    const { user } = transform(linkedInput(), options());
    expect(user[0].name).toBe('Ada Lovelace');
    // profiles.role is authoritative over the `reader` default.
    expect(user[0].role).toBe('author');
  });
});

describe('Task 2.4/2.5 — foreign keys remap to ObjectIds', () => {
  it('maps profile → author → book and records the id map', () => {
    const { authors, books, idMap } = transform(linkedInput(), options());

    const profileHex = idMap.profiles['aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'];
    const authorHex = idMap.authors['bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'];

    expect(authors[0].profile_id).toEqual({ $oid: profileHex });
    expect(books[0].author_id).toEqual({ $oid: authorHex });
    expect(idMap.books['cccccccc-cccc-cccc-cccc-cccccccccccc']).toBeTruthy();
  });

  it('maps profiles.user_id onto the Mongo auth_user_id field', () => {
    const { profiles } = transform(linkedInput(), options());
    expect(profiles[0].auth_user_id).toBe('11111111-1111-1111-1111-111111111111');
    expect(profiles[0].display_name).toBe('Ada Lovelace');
  });

  it('flags an orphan profile and fails the zero-unmapped-FK gate', () => {
    const input = linkedInput();
    input.profiles[0].user_id = 'missing-user';

    const { report } = transform(input, options());
    expect(report.orphans.profiles_without_auth_user).toEqual([
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    ]);
    expect(report.zero_unmapped_foreign_keys).toBe(false);
  });

  it('keeps a book whose author_id was NULL without failing the gate', () => {
    const input = linkedInput();
    input.books[0].author_id = null;

    const { books, report } = transform(input, options());
    expect(books).toHaveLength(1);
    expect(books[0].author_id).toBeNull();
    expect(report.orphans.books_without_author).toHaveLength(1);
    // Supabase nulls author_id on author delete, so this is valid input.
    expect(report.zero_unmapped_foreign_keys).toBe(true);
  });
});

describe('Task 2.5 — slugs', () => {
  it('slugifies titles and strips accents', () => {
    expect(slugify('The Æther & the Machine!')).toBe('the-aether-the-machine');
    expect(slugify('   ')).toBe('untitled');
  });

  it('appends a numeric suffix on collision and reports it', () => {
    const allocator = createSlugAllocator();
    expect(allocator.allocate('dune', 'Dune')).toBe('dune');
    expect(allocator.allocate('dune', 'Dune')).toBe('dune-2');
    expect(allocator.allocate('dune', 'Dune')).toBe('dune-3');
    expect(allocator.wasCollision('dune-2')).toBe(true);
    expect(allocator.wasCollision('dune')).toBe(false);
  });

  it('resolves duplicate legacy slugs across the run', () => {
    const input = linkedInput();
    input.books.push({ ...input.books[0], id: 'dddddddd-dddd-dddd-dddd-dddddddddddd' });

    const { books, report } = transform(input, options());
    expect(books.map((b) => b.slug)).toEqual([
      'notes-on-the-analytical-engine',
      'notes-on-the-analytical-engine-2',
    ]);
    expect(report.slug_collisions_resolved).toHaveLength(1);
  });

  it('falls back to the title when the legacy slug is empty', () => {
    const input = linkedInput();
    input.books[0].slug = null;
    expect(transform(input, options()).books[0].slug).toBe('notes-on-the-analytical-engine');
  });
});

describe('enum narrowing', () => {
  it('collapses in-flight editorial states to draft', () => {
    expect(mapBookStatus('submitted')).toBe('draft');
    expect(mapBookStatus('review')).toBe('draft');
    expect(mapBookStatus('accepted')).toBe('draft');
    expect(mapBookStatus('published')).toBe('published');
    expect(mapBookStatus('archived')).toBe('archived');
    expect(mapBookStatus(null)).toBe('draft');
  });

  it('never leaks an unpublished legacy state into the public catalog', () => {
    const input = linkedInput();
    input.books[0].status = 'submitted';
    const { books, report } = transform(input, options());
    expect(books[0].status).toBe('draft');
    expect(report.book_status_remapped).toEqual({ 'submitted→draft': 1 });
  });

  it('maps order statuses onto the Mongo union', () => {
    expect(mapOrderStatus('processing')).toBe('pending');
    expect(mapOrderStatus('cancelled')).toBe('failed');
    expect(mapOrderStatus('completed')).toBe('completed');
    expect(mapOrderStatus('refunded')).toBe('refunded');
  });

  it('degrades the removed editor role to reader', () => {
    expect(normalizeRole('editor')).toBe('reader');
    expect(normalizeRole('admin')).toBe('admin');
    expect(normalizeRole(null)).toBe('reader');
  });

  it('reads a display name from any of the metadata spellings', () => {
    expect(nameFromMetadata({ full_name: 'A' })).toBe('A');
    expect(nameFromMetadata({ name: 'B' })).toBe('B');
    expect(nameFromMetadata(null)).toBe('');
  });
});

describe('Task 2.6 — orders flatten to embedded items', () => {
  function orderInput(): TransformInput {
    const input = linkedInput();
    input.orders_raw = [
      {
        order_id: 'o-1',
        order_number: 'MANGU-1',
        profile_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        total_amount: '39.98',
        status: 'completed',
        payment_intent_id: 'pi_123',
        created_at: '2026-02-01T00:00:00Z',
        order_item_id: 'oi-1',
        book_id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
        unit_price: '19.99',
      },
      {
        order_id: 'o-1',
        order_number: 'MANGU-1',
        profile_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        total_amount: '39.98',
        status: 'completed',
        payment_intent_id: 'pi_123',
        created_at: '2026-02-01T00:00:00Z',
        order_item_id: 'oi-2',
        book_id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
        unit_price: '19.99',
      },
    ];
    return input;
  }

  it('groups join rows into one order with embedded items', () => {
    const { orders } = transform(orderInput(), options());
    expect(orders).toHaveLength(1);
    expect(orders[0].order_items).toHaveLength(1);
    expect(orders[0].amount).toBe(39.98);
  });

  it('collapses repeat lines for one book into a quantity', () => {
    const { orders } = transform(orderInput(), options());
    const items = orders[0].order_items as Array<Record<string, unknown>>;
    expect(items[0].quantity).toBe(2);
    expect(items[0].unit_amount).toBe(19.99);
    expect(items[0].title).toBe('Notes on the Analytical Engine');
  });

  it('rewrites orders.user_id from a profiles.id to the auth user id', () => {
    const { orders } = transform(orderInput(), options());
    expect(orders[0].user_id).toBe('11111111-1111-1111-1111-111111111111');
  });

  it('preserves the Stripe payment intent that keeps the webhook idempotent', () => {
    const { orders, report } = transform(orderInput(), options());
    expect(orders[0].stripe_payment_intent_id).toBe('pi_123');
    expect(report.synthesized_payment_intents).toBe(0);
  });

  it('synthesizes a stable key when the legacy order predates Stripe', () => {
    const input = orderInput();
    for (const row of input.orders_raw) row.payment_intent_id = null;

    const { orders, report } = transform(input, options());
    expect(orders[0].stripe_payment_intent_id).toBe('legacy:MANGU-1');
    expect(report.synthesized_payment_intents).toBe(1);
  });

  it('keeps synthesized keys unique so the sparse unique index still holds', () => {
    const input = orderInput();
    for (const row of input.orders_raw) row.payment_intent_id = null;
    input.orders_raw.push({
      ...input.orders_raw[0],
      order_id: 'o-2',
      order_number: 'MANGU-2',
    });

    const { orders } = transform(input, options());
    const keys = orders.map((o) => o.stripe_payment_intent_id);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('reports an order item pointing at a missing book and fails the gate', () => {
    const input = orderInput();
    input.orders_raw[0].book_id = 'no-such-book';
    input.orders_raw.pop();

    const { report } = transform(input, options());
    expect(report.orphans.order_items_without_book).toHaveLength(1);
    expect(report.zero_unmapped_foreign_keys).toBe(false);
  });
});

describe('ratings and reviews', () => {
  function reviewInput(): TransformInput {
    const input = linkedInput();
    input.auth_users.push({
      id: '22222222-2222-2222-2222-222222222222',
      email: 'second@example.com',
      email_confirmed_at: '2026-01-02T00:00:00Z',
      created_at: '2026-01-01T00:00:00Z',
    });
    input.reviews = [
      {
        id: 'r-1',
        book_id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
        user_id: '11111111-1111-1111-1111-111111111111',
        rating: 5,
        helpful_count: 3,
        created_at: '2026-03-01T00:00:00Z',
      },
      {
        id: 'r-2',
        book_id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
        user_id: '22222222-2222-2222-2222-222222222222',
        rating: 4,
        created_at: '2026-03-02T00:00:00Z',
      },
    ];
    return input;
  }

  it('recomputes avg_rating and review_count so books agree with reviews', () => {
    const { books, report } = transform(reviewInput(), options());
    expect(books[0].avg_rating).toBe(4.5);
    expect(books[0].review_count).toBe(2);
    expect(report.ratings_recomputed).toBe(1);
  });

  it('leaves books with no reviews at zero', () => {
    const { books } = transform(linkedInput(), options());
    expect(books[0].avg_rating).toBe(0);
    expect(books[0].review_count).toBe(0);
  });

  it('marks verified_purchase only for reviewers who actually bought the book', () => {
    const input = reviewInput();
    input.orders_raw = [
      {
        order_id: 'o-1',
        order_number: 'MANGU-1',
        profile_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        total_amount: '19.99',
        status: 'completed',
        payment_intent_id: 'pi_1',
        created_at: '2026-02-01T00:00:00Z',
        book_id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
        unit_price: '19.99',
      },
    ];

    const { reviews } = transform(input, options());
    const byUser = Object.fromEntries(reviews.map((r) => [r.user_id, r.verified_purchase]));
    expect(byUser['11111111-1111-1111-1111-111111111111']).toBe(true);
    expect(byUser['22222222-2222-2222-2222-222222222222']).toBe(false);
  });

  it('drops a review whose author no longer exists and fails the gate', () => {
    const input = reviewInput();
    input.reviews[1].user_id = 'deleted-user';

    const { reviews, report } = transform(input, options());
    expect(reviews).toHaveLength(1);
    expect(report.orphans.reviews_without_auth_user).toEqual(['r-2']);
    expect(report.zero_unmapped_foreign_keys).toBe(false);
  });
});

describe('reading progress', () => {
  it('remaps the profiles.id reference to the auth user id', () => {
    const input = linkedInput();
    input.reading_progress = [
      {
        id: 'rp-1',
        user_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        book_id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
        current_position: '42.50',
        is_finished: false,
        created_at: '2026-04-01T00:00:00Z',
      },
    ];

    const { reading_progress } = transform(input, options());
    expect(reading_progress).toHaveLength(1);
    expect(reading_progress[0].user_id).toBe('11111111-1111-1111-1111-111111111111');
    expect(reading_progress[0].current_position).toBe(42.5);
  });
});

describe('Task 2.7 — dates become Extended JSON', () => {
  it('converts ISO strings to $date', () => {
    expect(toExtendedDate('2026-01-02T03:04:05Z')).toEqual({
      $date: '2026-01-02T03:04:05.000Z',
    });
  });

  it('falls back only when a fallback is supplied', () => {
    expect(toExtendedDate(null)).toBeNull();
    expect(toExtendedDate('nonsense')).toBeNull();
    expect(toExtendedDate(null, NOW)).toEqual({ $date: NOW.toISOString() });
  });

  it('emits $date on every migrated document timestamp', () => {
    const { user, profiles, books } = transform(linkedInput(), options());
    expect(user[0].createdAt).toEqual({ $date: '2026-01-01T00:00:00.000Z' });
    expect(profiles[0].created_at).toEqual({ $date: '2026-01-01T00:00:00.000Z' });
    expect(books[0].created_at).toEqual({ $date: '2026-01-01T00:00:00.000Z' });
  });

  it('leaves no raw ISO strings in date positions', () => {
    const { books } = transform(linkedInput(), options());
    for (const field of ['created_at', 'updated_at']) {
      expect(typeof books[0][field]).toBe('object');
    }
  });
});

describe('Task 2.8 — report', () => {
  it('reports in/out counts per collection', () => {
    const { report } = transform(linkedInput(), options());
    expect(report.counts.user).toEqual({ in: 1, out: 1 });
    expect(report.counts.account).toEqual({ in: 1, out: 1 });
    expect(report.counts.books).toEqual({ in: 1, out: 1 });
    expect(report.zero_unmapped_foreign_keys).toBe(true);
  });

  it('handles a completely empty export without throwing', () => {
    const { user, report } = transform(emptyInput(), options());
    expect(user).toHaveLength(0);
    expect(report.zero_unmapped_foreign_keys).toBe(true);
  });
});

describe('slug transliteration does not eat separators', () => {
  it('folds ligatures and stroked letters without dropping them', () => {
    expect(slugify('Æther')).toBe('aether');
    expect(slugify('Œuvre')).toBe('oeuvre');
    expect(slugify('Straße')).toBe('strasse');
    expect(slugify('Łódź')).toBe('lodz');
    expect(slugify('Þing')).toBe('thing');
  });

  it('keeps word boundaries intact', () => {
    // A space inside a transliteration character class would silently turn
    // "a b" into "adb"; this guards that regression.
    expect(slugify('a b c')).toBe('a-b-c');
    expect(slugify('Dune Messiah')).toBe('dune-messiah');
  });

  it('folds ordinary accents via NFKD', () => {
    expect(slugify('Café Society')).toBe('cafe-society');
    expect(slugify('Ñandú')).toBe('nandu');
  });
});
