'use client';

/**
 * Publish / unpublish control for the admin books table.
 *
 * WHY a client wrapper around the existing server action: unpublishing removes
 * a title from the public catalog immediately, and Task 2.4 requires an
 * explicit confirmation for that. The list page is a server component and
 * cannot attach an onSubmit handler, so the <form> moves here and the server
 * action is passed straight through as a prop — the action itself is unchanged.
 */

import { Button } from '@/components/ui/button';

interface StatusToggleFormProps {
  bookId: string;
  title: string;
  /** The book's current status; the button switches to the opposite one. */
  status: string;
  action: (formData: FormData) => void | Promise<void>;
}

export function StatusToggleForm({ bookId, title, status, action }: StatusToggleFormProps) {
  const isPublished = status === 'published';
  const nextStatus = isPublished ? 'draft' : 'published';

  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!isPublished) return;
        const confirmed = window.confirm(
          `Unpublish "${title}"?\n\nIt will disappear from the public catalog immediately and existing links will stop working.`
        );
        if (!confirmed) event.preventDefault();
      }}
    >
      <input type="hidden" name="bookId" value={bookId} />
      <input type="hidden" name="status" value={nextStatus} />
      <Button variant="outline" size="sm" type="submit">
        {isPublished ? 'Unpublish' : 'Publish'}
      </Button>
    </form>
  );
}
