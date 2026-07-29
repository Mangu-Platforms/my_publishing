/**
 * Server-trusted role gate (Task 1.5).
 *
 * Authorization is derived from the authenticated session plus the trusted
 * profile/claim resolved by `getRequestUser()` — never from a request cookie.
 * The `mangu-role` cookie is presentation state only and is not read here.
 */

import { redirect } from 'next/navigation';
import { getRequestUser, type ApiRequestUser } from '@/lib/api/request-user';
import type { ManguRole } from '@/lib/auth/roles';

export async function requireRole(allowed: readonly ManguRole[]): Promise<ApiRequestUser> {
  const user = await getRequestUser();

  if (!user) {
    redirect('/login');
  }

  if (!allowed.includes(user.role)) {
    redirect('/');
  }

  return user;
}
