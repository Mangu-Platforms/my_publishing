'use client';

/**
 * Book asset fields — cover, EPUB and audio sample (Task 2.1 / 2.2).
 *
 * This file used to export a second, unmounted `BookUploadForm` that duplicated
 * the admin create form (subtitle field, `createBook` instead of
 * `createBookAdmin`) and was rendered by no page. Rather than leave a divergent
 * copy of the book form in the tree, it has been reduced to the piece that was
 * actually missing from the admin surface: the upload controls. Both admin
 * forms now render this one component, so cover/EPUB/audio behave identically
 * on create and on edit.
 *
 * Storage plumbing is reused, not rebuilt: the dropzone/preview/progress UI is
 * `components/ui/file-upload.tsx` and every byte goes through the existing
 * POST /api/upload/book-assets route (auth check -> validateBookAsset ->
 * storeBookAsset, service-role, content-addressed path).
 *
 * WHY the "legacy" `onUpload` mode of FileUpload instead of its `asset` mode:
 * asset mode fires the request the instant a file is dropped, which leaves no
 * point at which to (a) measure the image and enforce the 2:3 / 1600x2400 cover
 * geometry before bytes leave the browser and (b) ask for confirmation before
 * overwriting an asset a published book already points at. Both are required by
 * Task 2.1/2.4, so the upload is driven from here and the progress bar is
 * traded for the confirmation + geometry gate.
 */

import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { FileUpload } from '@/components/ui/file-upload';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { isValidExternalUrl } from '@/lib/books/fields';
import {
  AUDIO_SAMPLE_RULES,
  COVER_RULES,
  EPUB_RULES,
  validateCoverDimensions,
  validateCoverFile,
  validateEpubFile,
} from '@/app/admin/books/_lib/book-validation';

export type BookAssetValues = {
  cover_url: string | null;
  epub_url: string | null;
  audio_url: string | null;
  audio_narrator: string;
  audio_duration_seconds: string;
};

interface BookAssetFieldsProps {
  values: BookAssetValues;
  errors: Record<string, string>;
  onChange: (patch: Partial<BookAssetValues>) => void;
  disabled?: boolean;
  /** True once the book is live: replacing/removing assets is then destructive. */
  isPublished?: boolean;
}

const COVER_ACCEPT = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
};

const EPUB_ACCEPT = {
  'application/epub+zip': ['.epub'],
};

/** Reads intrinsic pixel dimensions without decoding the file server-side. */
async function measureImage(file: File): Promise<{ width: number; height: number }> {
  const objectUrl = URL.createObjectURL(file);
  try {
    return await new Promise<{ width: number; height: number }>((resolve, reject) => {
      const image = new window.Image();
      image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
      image.onerror = () => reject(new Error('That image could not be read'));
      image.src = objectUrl;
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function postAsset(file: File, asset: 'cover' | 'epub'): Promise<string> {
  const body = new FormData();
  body.append('asset', asset);
  body.append('file', file);

  const response = await fetch('/api/upload/book-assets', { method: 'POST', body });
  const payload = (await response.json().catch(() => null)) as
    | { url?: string; error?: string }
    | null;

  if (!response.ok || !payload?.url) {
    throw new Error(payload?.error || 'Upload failed — please try again');
  }
  return payload.url;
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="mt-1 text-sm text-red-500">
      {message}
    </p>
  );
}

export function BookAssetFields({
  values,
  errors,
  onChange,
  disabled,
  isPublished,
}: BookAssetFieldsProps) {
  // Bumping these remounts FileUpload so a cancelled removal restores its
  // preview (the component clears its own display before calling onRemove).
  const [coverKey, setCoverKey] = useState(0);
  const [epubKey, setEpubKey] = useState(0);

  const confirmReplace = (label: string, existing: string | null): boolean => {
    if (!existing) return true;
    const consequence = isPublished
      ? `This book is live. Replacing the ${label} changes it on the public site immediately.`
      : `The current ${label} will no longer be attached to this book.`;
    return window.confirm(`Replace the ${label}?\n\n${consequence}`);
  };

  const uploadCover = async (file: File): Promise<string> => {
    const fileCheck = validateCoverFile(file);
    if (!fileCheck.ok) throw new Error(fileCheck.error);

    const { width, height } = await measureImage(file);
    const geometry = validateCoverDimensions(width, height);
    if (!geometry.ok) throw new Error(geometry.error);

    if (!confirmReplace('cover image', values.cover_url)) {
      throw new Error('Replacement cancelled — the existing cover is unchanged');
    }

    // The URL is only recorded after storage confirms the object exists, so a
    // failed upload can never leave the record pointing at a missing asset.
    const url = await postAsset(file, 'cover');
    onChange({ cover_url: url });
    return url;
  };

  const uploadEpub = async (file: File): Promise<string> => {
    const fileCheck = validateEpubFile(file);
    if (!fileCheck.ok) throw new Error(fileCheck.error);

    if (!confirmReplace('EPUB file', values.epub_url)) {
      throw new Error('Replacement cancelled — the existing EPUB is unchanged');
    }

    const url = await postAsset(file, 'epub');
    onChange({ epub_url: url });
    return url;
  };

  const removeAsset = (key: 'cover_url' | 'epub_url', label: string, bump: () => void) => {
    const existing = values[key];
    if (!existing) return;
    const confirmed = window.confirm(
      `Remove the ${label} from this book?\n\nThe stored file is kept (other books may share it) — only this book's link is cleared.`
    );
    if (!confirmed) {
      bump();
      return;
    }
    onChange({ [key]: null } as Partial<BookAssetValues>);
  };

  const audioUrl = values.audio_url?.trim() ?? '';
  const audioPreviewable = audioUrl !== '' && isValidExternalUrl(audioUrl);

  return (
    <div className="space-y-6">
      <div>
        <Label htmlFor="cover-upload">Cover image *</Label>
        <p className="mb-2 mt-1 text-sm text-muted-foreground">
          JPG or PNG, portrait 2:3, at least {COVER_RULES.minWidth}x{COVER_RULES.minHeight}px, max{' '}
          {COVER_RULES.maxBytes / (1024 * 1024)}MB. Required before publishing.
        </p>
        <div id="cover-upload">
          <FileUpload
            key={`cover-${coverKey}`}
            onUpload={uploadCover}
            onRemove={() => removeAsset('cover_url', 'cover image', () => setCoverKey((n) => n + 1))}
            value={values.cover_url}
            valueLabel="Current cover"
            accept={COVER_ACCEPT}
            maxSize={COVER_RULES.maxBytes}
          />
        </div>
        <FieldError message={errors.cover_url} />
      </div>

      <div>
        <Label htmlFor="epub-upload">EPUB file</Label>
        <p className="mb-2 mt-1 text-sm text-muted-foreground">
          .epub only, max {EPUB_RULES.maxBytes / (1024 * 1024)}MB. Stored for distribution and
          fulfilment only — there is no on-site reader at launch, so no &ldquo;Start
          Reading&rdquo; control is shown to readers.
        </p>
        <div id="epub-upload">
          <FileUpload
            key={`epub-${epubKey}`}
            onUpload={uploadEpub}
            onRemove={() => removeAsset('epub_url', 'EPUB file', () => setEpubKey((n) => n + 1))}
            value={values.epub_url}
            valueLabel="Current EPUB"
            accept={EPUB_ACCEPT}
            maxSize={EPUB_RULES.maxBytes}
          />
        </div>
        <FieldError message={errors.epub_url} />
      </div>

      <div className="rounded-lg border border-border p-4">
        <h4 className="text-sm font-semibold">Audio sample</h4>
        <p className="mt-1 text-sm text-muted-foreground">
          Optional. {AUDIO_SAMPLE_RULES.extensions.join(' or ').toUpperCase()} hosted on https,
          {' '}
          {AUDIO_SAMPLE_RULES.recommendedMinSeconds / 60}–
          {AUDIO_SAMPLE_RULES.recommendedMaxSeconds / 60} minutes. Full-length audiobook delivery
          and entitlements are out of scope for launch.
        </p>
        <p className="mt-2 flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-600 dark:text-amber-400">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>
            Direct audio upload is not available: no audio storage bucket is provisioned. Paste the
            https URL of an already-hosted sample.
          </span>
        </p>

        <div className="mt-4 space-y-4">
          <div>
            <Label htmlFor="audio_url">Sample URL</Label>
            <Input
              id="audio_url"
              name="audio_url"
              type="url"
              inputMode="url"
              value={values.audio_url ?? ''}
              onChange={(event) => onChange({ audio_url: event.target.value })}
              placeholder="https://…/sample.mp3"
              disabled={disabled}
              className="mt-1"
            />
            <FieldError message={errors.audio_url} />
          </div>

          {audioPreviewable && (
            // Plain element on purpose: previewing here must not depend on the
            // shared AudioPlayer contract (Task 2.2 forbids touching it).
            // eslint-disable-next-line jsx-a11y/media-has-caption
            <audio controls preload="none" src={audioUrl} className="w-full">
              Your browser does not support audio playback.
            </audio>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="audio_narrator">Narrator</Label>
              <Input
                id="audio_narrator"
                name="audio_narrator"
                value={values.audio_narrator}
                onChange={(event) => onChange({ audio_narrator: event.target.value })}
                disabled={disabled}
                className="mt-1"
              />
              <FieldError message={errors.audio_narrator} />
            </div>
            <div>
              <Label htmlFor="audio_duration_seconds">Sample length (seconds)</Label>
              <Input
                id="audio_duration_seconds"
                name="audio_duration_seconds"
                type="number"
                min="0"
                step="1"
                value={values.audio_duration_seconds}
                onChange={(event) => onChange({ audio_duration_seconds: event.target.value })}
                disabled={disabled}
                className="mt-1"
              />
              <FieldError message={errors.audio_duration_seconds} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
