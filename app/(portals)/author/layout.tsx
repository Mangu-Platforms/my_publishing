/**
 * Server-trusted gate for the author portal (Task 1.5).
 *
 * Every /author/* page is now covered by a role check derived from the
 * authenticated session, not from the client-settable `mangu-role` cookie.
 * Previously only /author/dashboard and /author/submit checked the role;
 * /author/analytics and /author/projects/* checked authentication only.
 */
import { requireRole } from '@/lib/auth/require-role';

export const dynamic = 'force-dynamic';

export default async function AuthorPortalLayout({ children }: { children: React.ReactNode }) {
  await requireRole(['author', 'admin']);
  return <>{children}</>;
}
