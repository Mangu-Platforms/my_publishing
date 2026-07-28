'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { submitContactMessage, type ContactFormState } from './actions';

const initialContactFormState: ContactFormState = {
  status: 'idle',
  message: '',
};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Sending…' : 'Send message'}
    </Button>
  );
}

export function ContactForm({
  enabled = true,
  fallbackEmail = 'books@mangu-publishers.com',
}: {
  enabled?: boolean;
  fallbackEmail?: string;
}) {
  const [state, formAction] = useFormState(submitContactMessage, initialContactFormState);

  // Honest-unavailable state: when email delivery isn't configured we don't
  // render a form that can't send, and we don't promise one later. We point
  // people at an address that works today (Task 4.6).
  if (!enabled) {
    return (
      <div className="mt-8 max-w-2xl rounded-md border border-input bg-muted/30 p-6">
        <p className="text-sm text-secondary">
          The message form is switched off right now, so use email instead. It reaches the same
          inbox:
        </p>
        <a
          className="mt-3 inline-block font-medium text-primary hover:underline"
          href={`mailto:${fallbackEmail}`}
        >
          {fallbackEmail}
        </a>
      </div>
    );
  }

  return (
    <form action={formAction} className="mt-8 max-w-2xl space-y-5">
      <div>
        <label className="mb-2 block text-sm font-medium" htmlFor="name">
          Name
        </label>
        <input
          className="w-full rounded-md border border-input bg-background px-3 py-2"
          id="name"
          name="name"
          required
          minLength={2}
          aria-invalid={state.fieldErrors?.name ? true : undefined}
          aria-describedby={state.fieldErrors?.name ? 'name-error' : undefined}
        />
        {state.fieldErrors?.name && (
          <p className="mt-1 text-sm text-red-600" id="name-error">
            {state.fieldErrors.name}
          </p>
        )}
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium" htmlFor="email">
          Email
        </label>
        <input
          className="w-full rounded-md border border-input bg-background px-3 py-2"
          id="email"
          name="email"
          required
          type="email"
          aria-invalid={state.fieldErrors?.email ? true : undefined}
          aria-describedby={state.fieldErrors?.email ? 'email-error' : undefined}
        />
        {state.fieldErrors?.email && (
          <p className="mt-1 text-sm text-red-600" id="email-error">
            {state.fieldErrors.email}
          </p>
        )}
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium" htmlFor="subject">
          Subject
        </label>
        <input
          className="w-full rounded-md border border-input bg-background px-3 py-2"
          id="subject"
          name="subject"
          required
          minLength={3}
          aria-invalid={state.fieldErrors?.subject ? true : undefined}
          aria-describedby={state.fieldErrors?.subject ? 'subject-error' : undefined}
        />
        {state.fieldErrors?.subject && (
          <p className="mt-1 text-sm text-red-600" id="subject-error">
            {state.fieldErrors.subject}
          </p>
        )}
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium" htmlFor="message">
          Message
        </label>
        <textarea
          className="min-h-32 w-full rounded-md border border-input bg-background px-3 py-2"
          id="message"
          name="message"
          required
          minLength={10}
          aria-invalid={state.fieldErrors?.message ? true : undefined}
          aria-describedby={state.fieldErrors?.message ? 'message-error' : undefined}
        />
        {state.fieldErrors?.message && (
          <p className="mt-1 text-sm text-red-600" id="message-error">
            {state.fieldErrors.message}
          </p>
        )}
      </div>

      {state.message && (
        <p
          role={state.status === 'success' ? 'status' : 'alert'}
          className={state.status === 'success' ? 'text-sm text-green-700' : 'text-sm text-red-600'}
        >
          {state.message}
        </p>
      )}

      <SubmitButton />
    </form>
  );
}
