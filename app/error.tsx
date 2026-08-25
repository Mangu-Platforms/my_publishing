'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { captureException } from '@/lib/sentry';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Application error:', error);
    captureException(error, { digest: error.digest });
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="text-center">
        <h1 className="mb-4 text-4xl font-bold text-primary">Something went wrong!</h1>
        {/* Never render error.message — in production Next.js redacts server
            errors, but client-thrown errors keep their raw message and would
            leak internals to users. Sentry + the console log above capture
            the real detail for operators. The digest lets support correlate
            reports back to a specific error occurrence. */}
        <p className="mb-2 text-lg text-secondary">
          Something went wrong on our side. Please try again.
        </p>
        {error.digest && (
          <p className="mb-8 text-xs text-secondary/70">Reference: {error.digest}</p>
        )}
        <div className="flex justify-center gap-4">
          <Button onClick={reset} variant="default">
            Try again
          </Button>
          <Button asChild variant="outline">
            <Link href="/">Go home</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
