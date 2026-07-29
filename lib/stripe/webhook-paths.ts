/**
 * Canonical Stripe webhook path (Task 1.4 — webhook route consolidation).
 *
 * Lives outside `app/api/webhooks/stripe/route.ts` because Next.js route
 * modules may only export HTTP method handlers and route segment config;
 * any other named export fails `next build`'s route type validation.
 */
export const CANONICAL_WEBHOOK_PATH = '/api/webhook';
