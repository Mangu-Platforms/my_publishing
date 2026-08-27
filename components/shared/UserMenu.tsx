'use client';

import Link from 'next/link';
import { useAuth } from '@/components/providers/auth-provider';
import { Button } from '@/components/ui/button';

export function UserMenu() {
  const { user, isLoading, signOut } = useAuth();

  if (isLoading) {
    return (
      <div
        className="h-10 w-10 animate-pulse rounded-full bg-muted"
        aria-label="Loading user menu"
      />
    );
  }

  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href="/login">Login</Link>
        </Button>
        <Button asChild size="sm">
          <Link href="/register">Sign Up</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4">
      <Button asChild variant="ghost" size="sm">
        <Link href="/library">Library</Link>
      </Button>
      <Button variant="ghost" size="sm" onClick={signOut}>
        Sign Out
      </Button>
      <div
        className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-semibold"
        aria-label="Signed in user"
      >
        {(user.email?.[0] ?? '?').toUpperCase()}
      </div>
    </div>
  );
}
