/**
 * @jest-environment node
 *
 * Provider-aware admin book writes on MongoDB (Task 2.0b) — mocked Db, no live
 * Atlas. Node env required: the mongodb driver needs TextEncoder (not in jsdom).
 *
 * These cases are the regression net for the Task 1.0 defect: a book published
 * through the admin UI has to end up `status: 'published'` AND
 * `visibility: 'public'`, or the storefront queries can never see it.
 */

jest.mock('@/lib/server-only-guard', () => ({}));
jest.mock('@/lib/mongo', () => ({
  getDb: jest.fn(() => {
    throw new Error('getDb should not be called when Db is injected');
  }),
}));

import {
  createBookAdminMongo,
  getAdminBookMongo,
  listAdminAuthorsMongo,
  setBookStatusMongo,
  updateBookAdminMongo,
  type AdminBookWriteInput,
} from '@/lib/mongo-books';
import { createBook, updateBook } from '@/lib/mongo-queries';

const BOOK_ID = '507f1f77bcf86cd799439011';

const RETAILER_INPUT = {
  amazon_url: 'https://amazon.com/dp/1',
  kindle_url: 'https://amazon.com/kindle/1',
  apple_books_url: 'https://books.apple.com/1',
  google_play_books_url: 'https://play.google.com/1',
  barnes_noble_url: 'https://barnesandnoble.com/1',
  audible_url: 'https://audible.com/1',
};

const AUDIO_INPUT = {
  audio_url: 'https://cdn.example.com/a.m4b',
  audio_narrator: 'Nina Voice',
  audio_duration_seconds: 4321,
  audio_toc: [{ title: 'Chapter 1', start: 0 }],
  epub_url: 'https://cdn.example.com/a.epub',
  trailer_vimeo_id: '987654',
};

function mockDb(
  handlers: {
    /** Returned for the `{ slug }` lookups (create dedupe / update clash check). */
    slugClash?: unknown;
    /** Returned for the `{ _id }` lookup that guards `published_at`. */
    currentDoc?: unknown;
    updatedDoc?: unknown;
    aggregateResult?: unknown[];
    authorRows?: unknown[];
    matchedCount?: number;
  } = {}
) {
  const findOne = jest.fn().mockImplementation((filter: Record<string, unknown> = {}) => {
    if ('slug' in filter) return Promise.resolve(handlers.slugClash ?? null);
    return Promise.resolve(handlers.currentDoc ?? null);
  });

  const insertOne = jest.fn().mockResolvedValue({ insertedId: BOOK_ID });

  const findOneAndUpdate = jest
    .fn()
    .mockImplementation((_filter: unknown, update: { $set?: Record<string, unknown> }) =>
      Promise.resolve(
        handlers.updatedDoc !== undefined ? handlers.updatedDoc : { _id: BOOK_ID, ...update.$set }
      )
    );

  const updateOne = jest.fn().mockResolvedValue({
    matchedCount: handlers.matchedCount ?? 1,
    modifiedCount: 1,
    upsertedCount: 0,
  });

  const aggregate = jest.fn().mockReturnValue({
    toArray: jest.fn().mockResolvedValue(handlers.aggregateResult ?? []),
  });

  const authorToArray = jest.fn().mockResolvedValue(handlers.authorRows ?? []);
  const sort = jest.fn().mockReturnValue({ toArray: authorToArray });
  const find = jest.fn().mockReturnValue({ sort });

  const collection = jest.fn().mockImplementation(() => ({
    findOne,
    insertOne,
    findOneAndUpdate,
    updateOne,
    aggregate,
    find,
  }));

  return {
    db: { collection } as unknown as import('mongodb').Db,
    findOne,
    insertOne,
    findOneAndUpdate,
    updateOne,
    aggregate,
    find,
    sort,
  };
}

/** The document handed to `insertOne`. */
function insertedDoc(insertOne: jest.Mock): Record<string, unknown> {
  return insertOne.mock.calls[0][0] as Record<string, unknown>;
}

/** The `$set` handed to `findOneAndUpdate` / `updateOne`. */
function setPayload(fn: jest.Mock): Record<string, unknown> {
  return (fn.mock.calls[0][1] as { $set: Record<string, unknown> }).$set;
}

describe('createBookAdminMongo', () => {
  it('derives visibility public and stamps published_at when publishing', async () => {
    const { db, insertOne } = mockDb();

    const result = await createBookAdminMongo(
      { title: 'Resonance', status: 'published', author_id: BOOK_ID },
      db
    );

    expect('book' in result).toBe(true);
    const doc = insertedDoc(insertOne);
    expect(doc.status).toBe('published');
    expect(doc.visibility).toBe('public');
    expect(doc.published_at).toBeInstanceOf(Date);
  });

  it('derives visibility private for a draft and leaves published_at null', async () => {
    const { db, insertOne } = mockDb();

    await createBookAdminMongo({ title: 'Resonance', author_id: BOOK_ID }, db);

    const doc = insertedDoc(insertOne);
    expect(doc.status).toBe('draft');
    expect(doc.visibility).toBe('private');
    expect(doc.published_at).toBeNull();
  });

  it('honours an explicitly supplied visibility over the derived one', async () => {
    const { db, insertOne } = mockDb();

    await createBookAdminMongo(
      { title: 'Resonance', status: 'published', visibility: 'unlisted' },
      db
    );

    expect(insertedDoc(insertOne).visibility).toBe('unlisted');
  });

  it('derives the slug from the title', async () => {
    const { db, insertOne } = mockDb();

    await createBookAdminMongo({ title: '  The Long Goodbye! ' }, db);

    expect(insertedDoc(insertOne).slug).toBe('the-long-goodbye');
  });

  it('carries every retailer and audio field onto the inserted document', async () => {
    const { db, insertOne } = mockDb();

    await createBookAdminMongo(
      {
        title: 'Resonance',
        isbn: '9781234567897',
        content_type: 'book',
        is_featured: true,
        page_count: 320,
        word_count: 90000,
        ...RETAILER_INPUT,
        ...AUDIO_INPUT,
      },
      db
    );

    const doc = insertedDoc(insertOne);
    expect(doc).toMatchObject({
      ...RETAILER_INPUT,
      ...AUDIO_INPUT,
      isbn: '9781234567897',
      content_type: 'book',
      is_featured: true,
      page_count: 320,
      word_count: 90000,
    });
  });

  it('stamps featured_at alongside is_featured, and leaves it null otherwise', async () => {
    const featured = mockDb();
    await createBookAdminMongo({ title: 'Resonance', is_featured: true }, featured.db);
    expect(insertedDoc(featured.insertOne).featured_at).toBeInstanceOf(Date);

    const plain = mockDb();
    await createBookAdminMongo({ title: 'Resonance' }, plain.db);
    expect(insertedDoc(plain.insertOne).featured_at).toBeNull();
  });

  it('never writes subtitle or any other unlisted key', async () => {
    const { db, insertOne } = mockDb();

    await createBookAdminMongo(
      {
        title: 'Resonance',
        subtitle: 'A Novel',
        deleted_at: 'now',
      } as unknown as AdminBookWriteInput & { title: string },
      db
    );

    const doc = insertedDoc(insertOne);
    expect(doc).not.toHaveProperty('subtitle');
    expect(doc).not.toHaveProperty('deleted_at');
  });

  it('returns DUPLICATE_SLUG when the slug is already taken', async () => {
    const { db, insertOne } = mockDb({ slugClash: { _id: 'other' } });

    const result = await createBookAdminMongo({ title: 'Resonance' }, db);

    expect(result).toEqual({
      error: 'A book with this slug already exists',
      code: 'DUPLICATE_SLUG',
    });
    expect(insertOne).not.toHaveBeenCalled();
  });

  it('returns VALIDATION for a blank title', async () => {
    const { db, insertOne } = mockDb();

    const result = await createBookAdminMongo({ title: '   ' }, db);

    expect(result).toEqual({ error: 'title is required', code: 'VALIDATION' });
    expect(insertOne).not.toHaveBeenCalled();
  });
});

describe('updateBookAdminMongo', () => {
  it('derives visibility public and stamps published_at on the first publish', async () => {
    const { db, findOneAndUpdate } = mockDb({ currentDoc: { _id: BOOK_ID, published_at: null } });

    await updateBookAdminMongo(BOOK_ID, { status: 'published' }, db);

    const $set = setPayload(findOneAndUpdate);
    expect($set.status).toBe('published');
    expect($set.visibility).toBe('public');
    expect($set.published_at).toBeInstanceOf(Date);
  });

  it('does not restamp published_at for an already published book', async () => {
    const original = new Date('2024-01-01T00:00:00.000Z');
    const { db, findOneAndUpdate } = mockDb({
      currentDoc: { _id: BOOK_ID, published_at: original },
    });

    await updateBookAdminMongo(BOOK_ID, { status: 'published' }, db);

    expect(setPayload(findOneAndUpdate)).not.toHaveProperty('published_at');
  });

  it('leaves published_at untouched when unpublishing', async () => {
    const { db, findOneAndUpdate, findOne } = mockDb();

    await setBookStatusMongo(BOOK_ID, 'draft', db);

    const $set = setPayload(findOneAndUpdate);
    expect($set.status).toBe('draft');
    expect($set.visibility).toBe('private');
    expect($set).not.toHaveProperty('published_at');
    // Nothing is read: unpublishing never needs to know the publication date.
    expect(findOne).not.toHaveBeenCalled();
  });

  it('archives without clearing the publication date', async () => {
    const { db, findOneAndUpdate } = mockDb();

    await setBookStatusMongo(BOOK_ID, 'archived', db);

    const $set = setPayload(findOneAndUpdate);
    expect($set.status).toBe('archived');
    expect($set.visibility).toBe('private');
    expect($set).not.toHaveProperty('published_at');
  });

  it('honours an explicitly supplied visibility over the derived one', async () => {
    const { db, findOneAndUpdate } = mockDb({ currentDoc: { _id: BOOK_ID } });

    await updateBookAdminMongo(BOOK_ID, { status: 'published', visibility: 'unlisted' }, db);

    expect(setPayload(findOneAndUpdate).visibility).toBe('unlisted');
  });

  it('round-trips retailer and audio fields', async () => {
    const { db, findOneAndUpdate } = mockDb();

    await updateBookAdminMongo(BOOK_ID, { ...RETAILER_INPUT, ...AUDIO_INPUT }, db);

    expect(setPayload(findOneAndUpdate)).toMatchObject({ ...RETAILER_INPUT, ...AUDIO_INPUT });
  });

  it('writes null to clear a field but skips undefined', async () => {
    const { db, findOneAndUpdate } = mockDb();

    await updateBookAdminMongo(
      BOOK_ID,
      { amazon_url: null, audio_url: null, kindle_url: undefined, title: undefined },
      db
    );

    const $set = setPayload(findOneAndUpdate);
    expect($set.amazon_url).toBeNull();
    expect($set.audio_url).toBeNull();
    expect($set).not.toHaveProperty('kindle_url');
    expect($set).not.toHaveProperty('title');
    expect($set.updated_at).toBeInstanceOf(Date);
  });

  it('stamps featured_at on the first feature and never restamps it', async () => {
    const first = mockDb({ currentDoc: { _id: BOOK_ID, featured_at: null } });
    await updateBookAdminMongo(BOOK_ID, { is_featured: true }, first.db);
    const $first = setPayload(first.findOneAndUpdate);
    expect($first.is_featured).toBe(true);
    expect($first.featured_at).toBeInstanceOf(Date);

    const original = new Date('2024-05-05T00:00:00.000Z');
    const again = mockDb({ currentDoc: { _id: BOOK_ID, featured_at: original } });
    await updateBookAdminMongo(BOOK_ID, { is_featured: true }, again.db);
    expect(setPayload(again.findOneAndUpdate)).not.toHaveProperty('featured_at');
  });

  it('clears featured_at when the book is un-featured, without reading first', async () => {
    const { db, findOneAndUpdate, findOne } = mockDb();

    await updateBookAdminMongo(BOOK_ID, { is_featured: false }, db);

    const $set = setPayload(findOneAndUpdate);
    expect($set.is_featured).toBe(false);
    expect($set.featured_at).toBeNull();
    // Un-featuring needs no stored value, so it stays a single write.
    expect(findOne).not.toHaveBeenCalled();
  });

  it('leaves featured_at alone when is_featured is not part of the patch', async () => {
    const { db, findOneAndUpdate } = mockDb();

    await updateBookAdminMongo(BOOK_ID, { title: 'Resonance' }, db);

    expect(setPayload(findOneAndUpdate)).not.toHaveProperty('featured_at');
  });

  it('never writes subtitle or any other unlisted key', async () => {
    const { db, findOneAndUpdate } = mockDb();

    await updateBookAdminMongo(
      BOOK_ID,
      { title: 'Resonance', subtitle: 'A Novel' } as unknown as AdminBookWriteInput,
      db
    );

    const $set = setPayload(findOneAndUpdate);
    expect($set.title).toBe('Resonance');
    expect($set).not.toHaveProperty('subtitle');
  });

  it('returns DUPLICATE_SLUG when another book already owns the slug', async () => {
    const { db, findOneAndUpdate } = mockDb({ slugClash: { _id: 'other' } });

    const result = await updateBookAdminMongo(BOOK_ID, { slug: 'taken' }, db);

    expect(result).toEqual({
      error: 'A book with this slug already exists',
      code: 'DUPLICATE_SLUG',
    });
    expect(findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('returns NOT_FOUND when no document matched', async () => {
    const { db } = mockDb({ updatedDoc: null });

    const result = await updateBookAdminMongo(BOOK_ID, { title: 'Nope' }, db);

    expect(result).toEqual({ error: 'Book not found', code: 'NOT_FOUND' });
  });
});

describe('getAdminBookMongo', () => {
  it('applies no status or visibility filter so drafts still load', async () => {
    const draft = { _id: BOOK_ID, title: 'Draft', status: 'draft', visibility: 'private' };
    const { db, aggregate } = mockDb({ aggregateResult: [draft] });

    const book = await getAdminBookMongo(BOOK_ID, db);

    expect(book?.title).toBe('Draft');
    const pipeline = aggregate.mock.calls[0][0] as Array<Record<string, unknown>>;
    const match = JSON.stringify(pipeline[0]);
    expect(match).not.toContain('status');
    expect(match).not.toContain('visibility');
  });

  it('returns null when the book does not exist', async () => {
    const { db } = mockDb({ aggregateResult: [] });
    await expect(getAdminBookMongo(BOOK_ID, db)).resolves.toBeNull();
  });
});

describe('listAdminAuthorsMongo', () => {
  it('maps authors to id / pen_name options', async () => {
    const { db, sort } = mockDb({
      authorRows: [{ _id: 'a1', pen_name: 'Ada Lovelace' }, { _id: 'a2' }],
    });

    await expect(listAdminAuthorsMongo(db)).resolves.toEqual([
      { id: 'a1', pen_name: 'Ada Lovelace' },
      { id: 'a2', pen_name: 'Author' },
    ]);
    expect(sort).toHaveBeenCalledWith({ pen_name: 1 });
  });
});

describe('mongo-queries book writes', () => {
  it('createBook derives visibility from status and carries catalog fields', async () => {
    const { db, insertOne } = mockDb();

    await createBook(
      {
        title: 'Resonance',
        slug: 'resonance',
        author_id: BOOK_ID,
        status: 'published',
        ...RETAILER_INPUT,
        ...AUDIO_INPUT,
      },
      db
    );

    const doc = insertedDoc(insertOne);
    expect(doc.visibility).toBe('public');
    expect(doc.published_at).toBeInstanceOf(Date);
    expect(doc).toMatchObject({ ...RETAILER_INPUT, ...AUDIO_INPUT });
  });

  it('createBook keeps a draft private with a null published_at', async () => {
    const { db, insertOne } = mockDb();

    await createBook({ title: 'Resonance', slug: 'resonance', author_id: BOOK_ID }, db);

    const doc = insertedDoc(insertOne);
    expect(doc.visibility).toBe('private');
    expect(doc.published_at).toBeNull();
  });

  it('updateBook publishes with derived visibility and a first-publish stamp', async () => {
    const { db, updateOne } = mockDb({ currentDoc: { _id: BOOK_ID } });

    await expect(updateBook(BOOK_ID, { status: 'published' }, db)).resolves.toBe(true);

    const $set = setPayload(updateOne);
    expect($set.visibility).toBe('public');
    expect($set.published_at).toBeInstanceOf(Date);
  });

  it('updateBook never clears published_at on unpublish', async () => {
    const { db, updateOne, findOne } = mockDb();

    await updateBook(BOOK_ID, { status: 'draft' }, db);

    const $set = setPayload(updateOne);
    expect($set.visibility).toBe('private');
    expect($set).not.toHaveProperty('published_at');
    expect(findOne).not.toHaveBeenCalled();
  });

  it('updateBook ignores unlisted keys', async () => {
    const { db, updateOne } = mockDb();

    await updateBook(BOOK_ID, { subtitle: 'A Novel' } as unknown as { title?: string }, db);

    expect(setPayload(updateOne)).not.toHaveProperty('subtitle');
  });
});
