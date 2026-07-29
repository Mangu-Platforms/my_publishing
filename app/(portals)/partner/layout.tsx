/**
 * Server-trusted gate for the partner portal (Task 1.5).
 *
 * Role is derived from the authenticated session, never from the
 * client-settable `mangu-role` cookie. Individual pages keep their own
 * `requirePartner()` data-scoping checks — this layout is defense in depth so
 * a new page cannot ship without a gate.
 */
import { requireRole } from '@/lib/auth/require-role';

export const dynamic = 'force-dynamic';

export default async function PartnerPortalLayout({ children }: { children: React.ReactNode }) {
  await requireRole(['partner', 'admin']);
  return <>{children}</>;
}
