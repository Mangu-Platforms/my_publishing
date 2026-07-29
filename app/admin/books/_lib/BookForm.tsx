'use client';

/**
 * Shared admin book form (Task 2.3 / 2.4) — one component for create and edit.
 *
 * There used to be two forms with different field sets: create could not set a
 * price currency, an ISBN, retailer links or any asset, and edit exposed a
 * `subtitle` column that exists in no migration. Anything the two surfaces do
 * not share is a field that silently fails to round-trip, so they are now the
 * same component with a `mode` switch.
 *
 * Validation is imported from `./book-validation` — the same module the server
 * write path uses — so the publish checklist cannot drift between the two.
 */

import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AlertTriangle, CheckCircle2, ExternalLink, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { BookAssetFields } from '@/components/books/BookUploadForm';
import { createBookAdmin, updateBookAdmin } from '@/lib/actions/books';
import {
  ADMIN_BOOK_STATUSES,
  CONTENT_TYPES,
  RETAILER_LABELS,
  RETAILER_URL_FIELDS,
  nullableText,
  type AdminBookStatus,
  type ContentType,
} from '@/lib/books/fields';
import type { AdminAuthorOption } from '@/lib/data/admin-books';
import {
  FIXED_CURRENCY,
  parsePriceInput,
  priceNumberFromCents,
  slugifyBookTitle,
  validateAdminBook,
  type AdminBookFormValues,
} from './book-validation';

const NO_AUTHOR = 'none';

const STATUS_LABELS: Record<AdminBookStatus, string> = {
  draft: 'Draft',
  published: 'Published',
  archived: 'Archived',
};

const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  book: 'Book',
  comic: 'Comic Book',
  paper: 'Paper / Article',
};

/**
 * Payload shapes sent to the shared server actions.
 *
 * These are named types rather than inline object literals, which means
 * TypeScript's excess-property check does NOT run on them: a key the action's
 * parameter type does not declare compiles fine and is then dropped on the way
 * to the database. So this payload and the `AdminBookInput` type in
 * `lib/actions/books.ts` have to be kept in step by hand — every key below is
 * accepted and persisted by both providers.
 *
 * `published_at` is NOT here. It is stamped by the write path on the first
 * transition to published and never restamped or cleared, so the form shows it
 * read-only instead of posting a value that would be discarded.
 */
type BookWritePayload = {
  title: string;
  slug: string;
  /** '' rather than null: the write path maps a blank string to NULL, and the
      shared action signature types these as plain strings. */
  description: string;
  genre: string;
  author_id: string | null;
  price: number | undefined;
  isbn: string;
  content_type: ContentType;
  is_featured: boolean;
  page_count: number | undefined;
  word_count: number | undefined;
  trailer_vimeo_id: string | null;
  cover_url: string | null;
  epub_url: string | null;
  audio_url: string | null;
  audio_narrator: string | null;
  audio_duration_seconds: number | null;
  amazon_url: string | null;
  kindle_url: string | null;
  apple_books_url: string | null;
  google_play_books_url: string | null;
  barnes_noble_url: string | null;
  audible_url: string | null;
};

type CreatePayload = BookWritePayload & { status: 'draft' | 'published' };
type UpdatePayload = BookWritePayload & { status: AdminBookStatus };

interface BookFormProps {
  mode: 'create' | 'edit';
  bookId?: string;
  authors: AdminAuthorOption[];
  initialValues: AdminBookFormValues;
}

function optionalInt(raw: string): number | undefined {
  const value = raw.trim();
  if (value === '') return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : undefined;
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="mt-1 text-sm text-red-500">
      {message}
    </p>
  );
}

/**
 * Wires a control to its error message (A11Y-008, WCAG 1.3.1 / 3.3.1 / 4.1.2).
 *
 * WHY: rendering the message under the input is a sighted-only relationship.
 * A screen-reader user hears it announced once and then tabs back through
 * roughly twenty fields with no way to tell which one it belonged to.
 * `app/(auth)/login/LoginForm.tsx` is the pattern this follows.
 */
function errorProps(
  field: string,
  message?: string
): { 'aria-invalid'?: true; 'aria-describedby'?: string } {
  if (!message) return {};
  return { 'aria-invalid': true, 'aria-describedby': `${field}-error` };
}

export function BookForm({ mode, bookId, authors, initialValues }: BookFormProps) {
  const router = useRouter();
  const [values, setValues] = useState<AdminBookFormValues>(initialValues);
  const [submitting, setSubmitting] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const validation = useMemo(() => validateAdminBook(values), [values]);

  // Publish blockers surface as field-level errors too, but only once the
  // operator has actually tried to publish — an empty new-book form must not
  // open covered in red.
  const visibleErrors = useMemo(() => {
    if (!showErrors) return { ...serverErrors };
    const merged: Record<string, string> = { ...validation.fieldErrors };
    if (values.status === 'published') {
      for (const blocker of validation.blockers) {
        merged[blocker.field] = merged[blocker.field] ?? blocker.message;
      }
    }
    return { ...merged, ...serverErrors };
  }, [showErrors, serverErrors, validation, values.status]);

  const setField = useCallback(
    <K extends keyof AdminBookFormValues>(field: K, value: AdminBookFormValues[K]) => {
      setValues((prev) => ({ ...prev, [field]: value }));
      // A field the operator just corrected must stop showing the stale
      // server-side error for that same field.
      setServerErrors((prev) => {
        if (!(field in prev)) return prev;
        const next = { ...prev };
        delete next[field as string];
        return next;
      });
    },
    []
  );

  const handleAssetChange = useCallback((patch: Partial<AdminBookFormValues>) => {
    setValues((prev) => ({ ...prev, ...patch }));
  }, []);

  const focusFirstError = (errors: Record<string, string>) => {
    const first = Object.keys(errors)[0];
    if (!first) return;
    if (typeof window === 'undefined') return;
    window.requestAnimationFrame(() => {
      const element = document.getElementById(first);
      element?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      (element as HTMLElement | null)?.focus?.();
    });
  };

  const buildPayload = (): BookWritePayload => {
    const price = parsePriceInput(values.price);
    const duration = optionalInt(values.audio_duration_seconds);
    return {
      title: values.title.trim(),
      slug: values.slug.trim() || slugifyBookTitle(values.title),
      description: values.description.trim(),
      genre: values.genre.trim(),
      author_id: nullableText(values.author_id),
      // Decimal-safe: cents come from string parsing, and the single division
      // below is the only float operation applied to money anywhere here.
      price: price.ok ? priceNumberFromCents(price.cents) : undefined,
      isbn: values.isbn.trim(),
      content_type: values.content_type,
      is_featured: values.is_featured,
      page_count: optionalInt(values.page_count),
      word_count: optionalInt(values.word_count),
      trailer_vimeo_id: nullableText(values.trailer_vimeo_id),
      cover_url: nullableText(values.cover_url),
      epub_url: nullableText(values.epub_url),
      audio_url: nullableText(values.audio_url),
      audio_narrator: nullableText(values.audio_narrator),
      audio_duration_seconds: duration ?? null,
      amazon_url: nullableText(values.amazon_url),
      kindle_url: nullableText(values.kindle_url),
      apple_books_url: nullableText(values.apple_books_url),
      google_play_books_url: nullableText(values.google_play_books_url),
      barnes_noble_url: nullableText(values.barnes_noble_url),
      audible_url: nullableText(values.audible_url),
    };
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);
    setShowErrors(true);

    if (!validation.ok) {
      // Nothing is submitted and nothing is reset — the operator keeps every
      // value they typed and only has to fix the flagged fields.
      const combined = { ...validation.fieldErrors };
      if (values.status === 'published') {
        for (const blocker of validation.blockers) {
          combined[blocker.field] = combined[blocker.field] ?? blocker.message;
        }
      }
      focusFirstError(combined);
      setFormError(
        values.status === 'published' && !validation.canPublish
          ? 'This book is not ready to publish yet — see the checklist below.'
          : 'Some fields need attention before this can be saved.'
      );
      return;
    }

    if (
      mode === 'edit' &&
      initialValues.status === 'published' &&
      values.status !== 'published' &&
      !window.confirm(
        `Unpublish "${values.title}"?\n\nIt will be removed from the public catalog immediately. Existing links will stop working.`
      )
    ) {
      return;
    }

    setSubmitting(true);
    try {
      const base = buildPayload();
      const createPayload: CreatePayload = {
        ...base,
        status: values.status === 'published' ? 'published' : 'draft',
      };
      const updatePayload: UpdatePayload = { ...base, status: values.status };

      const result =
        mode === 'create'
          ? await createBookAdmin(createPayload)
          : await updateBookAdmin(String(bookId), updatePayload);

      if (result.success) {
        router.push('/admin/books');
        router.refresh();
        return;
      }

      const failure = result as { error?: string; code?: string };

      if (failure.code === 'DUPLICATE_SLUG' || failure.code === 'DUPLICATE_BOOK') {
        // Duplicate slugs stay deterministic: the server owns the check and the
        // client turns its code into a field error instead of a generic alert.
        const message = 'Another book already uses this slug — choose a different one';
        setServerErrors({ slug: message });
        focusFirstError({ slug: message });
        setFormError(message);
        return;
      }

      setFormError(failure.error || 'Failed to save the book');
    } catch {
      setFormError('An error occurred while saving the book');
    } finally {
      setSubmitting(false);
    }
  };

  const authorValue = values.author_id ?? NO_AUTHOR;
  const statuses: readonly AdminBookStatus[] =
    mode === 'create' ? ['draft', 'published'] : ADMIN_BOOK_STATUSES;

  return (
    <form onSubmit={handleSubmit} className="space-y-8" aria-label={`${mode} book form`} noValidate>
      {formError && (
        <div
          role="alert"
          className="rounded-md border border-red-500 bg-red-500/10 p-3 text-sm text-red-500"
        >
          {formError}
        </div>
      )}

      {/* ---------------------------------------------------------------- */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Details</h2>

        <div>
          <Label htmlFor="title">Title *</Label>
          <Input
            id="title"
            {...errorProps('title', visibleErrors.title)}
            name="title"
            value={values.title}
            onChange={(event) => setField('title', event.target.value)}
            className="mt-1"
          />
          <FieldError id="title-error" message={visibleErrors.title} />
        </div>

        <div>
          <Label htmlFor="slug">URL slug{mode === 'edit' ? ' *' : ''}</Label>
          <Input
            id="slug"
            {...errorProps('slug', visibleErrors.slug)}
            name="slug"
            value={values.slug}
            onChange={(event) => setField('slug', event.target.value)}
            placeholder={
              mode === 'create' ? 'auto-generated from the title if left blank' : undefined
            }
            className="mt-1"
          />
          <FieldError id="slug-error" message={visibleErrors.slug} />
        </div>

        <div>
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            {...errorProps('description', visibleErrors.description)}
            name="description"
            rows={6}
            value={values.description}
            onChange={(event) => setField('description', event.target.value)}
            className="mt-1"
          />
          <FieldError id="description-error" message={visibleErrors.description} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="author_id">Author</Label>
            <Select
              value={authorValue}
              onValueChange={(value) => setField('author_id', value === NO_AUTHOR ? null : value)}
            >
              <SelectTrigger id="author_id" {...errorProps('author_id', visibleErrors.author_id)}>
                <SelectValue placeholder="Select an author" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_AUTHOR}>No author (assign later)</SelectItem>
                {authors.map((author) => (
                  <SelectItem key={author.id} value={author.id}>
                    {author.pen_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldError id="author_id-error" message={visibleErrors.author_id} />
          </div>

          <div>
            <Label htmlFor="genre">Genre *</Label>
            <Input
              id="genre"
              {...errorProps('genre', visibleErrors.genre)}
              name="genre"
              value={values.genre}
              onChange={(event) => setField('genre', event.target.value)}
              className="mt-1"
            />
            <FieldError id="genre-error" message={visibleErrors.genre} />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <Label htmlFor="price">Price *</Label>
            <Input
              id="price"
              {...errorProps('price', visibleErrors.price)}
              name="price"
              inputMode="decimal"
              value={values.price}
              onChange={(event) => setField('price', event.target.value)}
              placeholder="12.99"
              className="mt-1"
            />
            <FieldError id="price-error" message={visibleErrors.price} />
          </div>
          <div>
            <Label htmlFor="currency">Currency</Label>
            <Input id="currency" name="currency" value={FIXED_CURRENCY} readOnly className="mt-1" />
            <p className="mt-1 text-xs text-muted-foreground">
              Fixed at launch — there is no per-book currency column yet.
            </p>
          </div>
          <div>
            <Label htmlFor="isbn">ISBN</Label>
            <Input
              id="isbn"
              {...errorProps('isbn', visibleErrors.isbn)}
              name="isbn"
              value={values.isbn}
              onChange={(event) => setField('isbn', event.target.value)}
              className="mt-1"
            />
            <FieldError id="isbn-error" message={visibleErrors.isbn} />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="grid gap-2">
            <Label htmlFor="content_type">Content type</Label>
            <Select
              value={values.content_type}
              onValueChange={(value) => setField('content_type', value as ContentType)}
            >
              <SelectTrigger id="content_type">
                <SelectValue placeholder="Select content type" />
              </SelectTrigger>
              <SelectContent>
                {CONTENT_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {CONTENT_TYPE_LABELS[type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="published_at">Publication date</Label>
            <Input
              id="published_at"
              {...errorProps('published_at', visibleErrors.published_at)}
              name="published_at"
              type="date"
              value={values.published_at}
              readOnly
              className="mt-1"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Set automatically the first time this book is published, and kept if you unpublish
              it.
            </p>
            <FieldError id="published_at-error" message={visibleErrors.published_at} />
          </div>
          <div>
            <Label htmlFor="trailer_vimeo_id">Trailer (Vimeo ID)</Label>
            <Input
              id="trailer_vimeo_id"
              {...errorProps('trailer_vimeo_id', visibleErrors.trailer_vimeo_id)}
              name="trailer_vimeo_id"
              value={values.trailer_vimeo_id}
              onChange={(event) => setField('trailer_vimeo_id', event.target.value)}
              placeholder="76979871"
              className="mt-1"
            />
            <FieldError id="trailer_vimeo_id-error" message={visibleErrors.trailer_vimeo_id} />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="page_count">Page count</Label>
            <Input
              id="page_count"
              {...errorProps('page_count', visibleErrors.page_count)}
              name="page_count"
              type="number"
              min="0"
              value={values.page_count}
              onChange={(event) => setField('page_count', event.target.value)}
              className="mt-1"
            />
            <FieldError id="page_count-error" message={visibleErrors.page_count} />
          </div>
          <div>
            <Label htmlFor="word_count">Word count</Label>
            <Input
              id="word_count"
              {...errorProps('word_count', visibleErrors.word_count)}
              name="word_count"
              type="number"
              min="0"
              value={values.word_count}
              onChange={(event) => setField('word_count', event.target.value)}
              className="mt-1"
            />
            <FieldError id="word_count-error" message={visibleErrors.word_count} />
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      <section className="space-y-4 border-t border-border pt-6">
        <h2 className="text-lg font-semibold">Files</h2>
        <BookAssetFields
          values={{
            cover_url: values.cover_url,
            epub_url: values.epub_url,
            audio_url: values.audio_url,
            audio_narrator: values.audio_narrator,
            audio_duration_seconds: values.audio_duration_seconds,
          }}
          errors={visibleErrors}
          onChange={handleAssetChange}
          disabled={submitting}
          isPublished={initialValues.status === 'published'}
        />
      </section>

      {/* ---------------------------------------------------------------- */}
      <section className="space-y-3 border-t border-border pt-6">
        <h2 className="text-lg font-semibold">Retailer links</h2>
        <p className="text-sm text-muted-foreground">
          Full https:// links only. Leave blank to hide a button on the product page.
        </p>
        {RETAILER_URL_FIELDS.map((field) => (
          <div key={field}>
            <Label htmlFor={field}>{RETAILER_LABELS[field]}</Label>
            <Input
              id={field}
              {...errorProps(field, visibleErrors[field])}
              name={field}
              type="url"
              value={values[field]}
              onChange={(event) => setField(field, event.target.value)}
              placeholder="https://…"
              className="mt-1"
            />
            <FieldError id={`${field}-error`} message={visibleErrors[field]} />
          </div>
        ))}
      </section>

      {/* ---------------------------------------------------------------- */}
      <section className="space-y-4 border-t border-border pt-6">
        <h2 className="text-lg font-semibold">Publishing</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="status">Status</Label>
            <Select
              value={values.status}
              onValueChange={(value) => setField('status', value as AdminBookStatus)}
            >
              <SelectTrigger id="status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {statuses.map((status) => (
                  <SelectItem key={status} value={status}>
                    {STATUS_LABELS[status]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2 self-end pb-2">
            <Checkbox
              id="is_featured"
              checked={values.is_featured}
              onCheckedChange={(checked) => setField('is_featured', checked === true)}
            />
            <Label htmlFor="is_featured" className="cursor-pointer">
              Feature this book on the homepage
            </Label>
          </div>
        </div>

        <PublishChecklist validation={validation} status={values.status} />

        {mode === 'edit' && initialValues.status === 'published' && values.slug && (
          <Button asChild variant="outline" size="sm">
            <Link href={`/books/${values.slug}`} target="_blank" rel="noreferrer">
              <ExternalLink className="mr-2 h-4 w-4" aria-hidden="true" />
              View public page
            </Link>
          </Button>
        )}
      </section>

      <div className="flex justify-end gap-3 border-t border-border pt-6">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push('/admin/books')}
          disabled={submitting}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting
            ? 'Saving…'
            : mode === 'create'
              ? 'Create book'
              : 'Save changes'}
        </Button>
      </div>
    </form>
  );
}

function PublishChecklist({
  validation,
  status,
}: {
  validation: ReturnType<typeof validateAdminBook>;
  status: AdminBookStatus;
}) {
  const { blockers, warnings, canPublish } = validation;

  return (
    <div className="rounded-lg border border-border p-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        {canPublish ? (
          <CheckCircle2 className="h-4 w-4 text-green-500" aria-hidden="true" />
        ) : (
          <AlertTriangle className="h-4 w-4 text-red-500" aria-hidden="true" />
        )}
        Publish readiness
      </h3>

      {canPublish ? (
        <p className="mt-2 text-sm text-muted-foreground">
          {status === 'published'
            ? 'Everything required for a public listing is present.'
            : 'Ready to publish whenever you switch the status to Published.'}
        </p>
      ) : (
        <>
          <p className="mt-2 text-sm text-red-500">
            {blockers.length} item{blockers.length === 1 ? '' : 's'} must be fixed before this book
            can be published. Saving as a draft still works.
          </p>
          <ul className="mt-2 space-y-1 text-sm">
            {blockers.map((issue) => (
              <li key={`${issue.field}-${issue.message}`} className="flex items-start gap-2">
                <AlertTriangle
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500"
                  aria-hidden="true"
                />
                <span>{issue.message}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      {warnings.length > 0 && (
        <ul className="mt-3 space-y-1 border-t border-border pt-3 text-sm text-muted-foreground">
          {warnings.map((issue) => (
            <li key={`${issue.field}-${issue.message}`} className="flex items-start gap-2">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>{issue.message}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
