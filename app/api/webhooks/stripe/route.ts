/**
 * DEPRECATED Stripe webhook path (Task 1.4 — webhook route consolidation).
 *
 * This path used to be a silent re-export of the real handler
 * (`app/api/webhook/route.ts`), which meant two live URLs accepted production
 * payment events, two signing secrets could drift apart, and nothing in the
 * codebase said which one the Stripe dashboard was actually pointed at.
 *
 * Canonical endpoint: POST /api/webhook
 *
 * Why 410 Gone instead of deleting the file: the Stripe dashboard endpoint URL
 * is external configuration this repo cannot read. Deleting the route turns a
 * misconfigured dashboard into an anonymous 404 with no operator signal; a 410
 * with a JSON body naming the canonical path shows up verbatim in the Stripe
 * dashboard's event log, so whoever looks at the failed delivery is told
 * exactly what to change. Remove this file once the dashboard endpoint has
 * been confirmed as /api/webhook (see the human-action list on the PR).
 *
 * This route never verifies a signature and never fulfills an order — it must
 * not process events under any circumstances.
 */

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export const CANONICAL_WEBHOOK_PATH = '/api/webhook';

function goneResponse(): NextResponse {
  return NextResponse.json(
    {
      error: 'endpoint_gone',
      message: `This Stripe webhook endpoint has been retired. Point the Stripe dashboard endpoint at ${CANONICAL_WEBHOOK_PATH}.`,
      canonical_path: CANONICAL_WEBHOOK_PATH,
    },
    {
      status: 410,
      headers: {
        'Cache-Control': 'no-store',
        Deprecation: 'true',
        Link: `<${CANONICAL_WEBHOOK_PATH}>; rel="successor-version"`,
      },
    }
  );
}

export async function POST(): Promise<NextResponse> {
  // Deliberately logs no request body or headers — the payload is unverified.
  console.error(
    `[Webhook] Delivery to retired path /api/webhooks/stripe rejected with 410. ` +
      `Repoint the Stripe dashboard endpoint at ${CANONICAL_WEBHOOK_PATH}.`
  );
  return goneResponse();
}

export async function GET(): Promise<NextResponse> {
  return goneResponse();
}
