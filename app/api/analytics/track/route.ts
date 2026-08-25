/**
 * Analytics Tracking API
 * Production-grade event tracking with validation and rate limiting
 */

import { NextRequest, NextResponse } from 'next/server';
import { corsHeadersFor, corsPreflightHeadersFor } from '@/lib/api/cors';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@/lib/supabase/admin';
import { enforceRateLimit, getClientIdentifier } from '@/lib/rate-limit';
import { AnalyticsEventSchema, validateSafe, getFirstError } from '@/lib/validations/schemas';
import type { TrackEventResponse, AnalyticsEvent } from '@/types/analytics';

/**
 * Parse user agent for device type
 */
function getDeviceType(userAgent: string | null): 'desktop' | 'mobile' | 'tablet' {
  if (!userAgent) return 'desktop';

  const ua = userAgent.toLowerCase();

  if (/tablet|ipad|playbook|silk/i.test(ua)) {
    return 'tablet';
  }

  if (/mobile|iphone|ipod|android|blackberry|opera mini|iemobile/i.test(ua)) {
    return 'mobile';
  }

  return 'desktop';
}

/**
 * Extract domain from referrer URL
 */
function getReferrerDomain(referrer: string | null): string | null {
  if (!referrer) return null;

  try {
    const url = new URL(referrer);
    return url.hostname;
  } catch {
    return null;
  }
}

/**
 * Track analytics event
 * POST /api/analytics/track
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();

  // Rate limiting (fail-closed, Fix C8)
  const clientId = getClientIdentifier(request);
  const rateLimitResult = await enforceRateLimit('analytics', clientId);
  const rateLimitHeaders = rateLimitResult.headers;
  const corsHeaders = corsHeadersFor(request);

  if (!rateLimitResult.success) {
    return NextResponse.json(
      {
        success: false,
        error:
          rateLimitResult.reason === 'unavailable'
            ? 'Rate limiter unavailable. Please try again shortly.'
            : 'Rate limit exceeded. Please slow down.',
      } satisfies TrackEventResponse,
      {
        status: rateLimitResult.reason === 'unavailable' ? 503 : 429,
        headers: rateLimitHeaders,
      }
    );
  }

  try {
    // Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid JSON body',
        } satisfies TrackEventResponse,
        { status: 400, headers: rateLimitHeaders }
      );
    }

    // Validate input
    const validation = validateSafe(AnalyticsEventSchema, body);
    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: getFirstError(validation.error),
        } satisfies TrackEventResponse,
        { status: 400, headers: rateLimitHeaders }
      );
    }

    const { book_id, event_type, session_id, event_data, referrer } = validation.data;

    // Initialize Supabase client
    const supabase = await createClient();

    // Get optional user ID from session
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const userId = user?.id;

    // Extract request metadata
    const userAgent = request.headers.get('user-agent');
    const ipAddress = clientId !== 'unknown' ? clientId : null;
    const deviceType = getDeviceType(userAgent);
    const referrerDomain = getReferrerDomain(referrer || request.headers.get('referer'));

    // Verify book exists and is accessible
    const { data: book, error: bookError } = await supabase
      .from('books')
      .select('id, visibility, status')
      .eq('id', book_id)
      .single();

    if (bookError || !book) {
      return NextResponse.json(
        {
          success: false,
          error: 'Book not found',
        } satisfies TrackEventResponse,
        { status: 404, headers: rateLimitHeaders }
      );
    }

    // Don't track events for private/draft books unless user is the author
    if (book.visibility === 'private' || book.status !== 'published') {
      const { data: isAuthor } = await supabase
        .from('books')
        .select('id')
        .eq('id', book_id)
        .eq('author_id', userId || '')
        .single();

      if (!isAuthor) {
        return NextResponse.json(
          {
            success: false,
            error: 'Book not accessible',
          } satisfies TrackEventResponse,
          { status: 403, headers: rateLimitHeaders }
        );
      }
    }

    // Create the analytics event
    const eventRecord: Partial<AnalyticsEvent> = {
      book_id,
      event_type,
      session_id,
      user_id: userId || undefined,
      event_data: event_data || undefined,
      referrer: referrerDomain || undefined,
      user_agent: userAgent || undefined,
      ip_address: ipAddress || undefined,
      device_type: deviceType,
    };

    const adminSupabase = createAdminClient();
    const { data: insertedEvent, error: insertError } = await adminSupabase
      .from('analytics_events')
      .insert(eventRecord)
      .select('id')
      .single();

    if (insertError) {
      console.error('[Analytics] Failed to insert event:', insertError);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to track event',
        } satisfies TrackEventResponse,
        { status: 500, headers: rateLimitHeaders }
      );
    }

    const duration = Date.now() - startTime;
    console.log(`[Analytics] Tracked ${event_type} for book ${book_id} in ${duration}ms`);

    return NextResponse.json(
      {
        success: true,
        event_id: insertedEvent.id,
      } satisfies TrackEventResponse,
      {
        status: 200,
        headers: { ...rateLimitHeaders, ...corsHeaders },
      }
    );
  } catch (error) {
    console.error('[Analytics] Unexpected error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      } satisfies TrackEventResponse,
      { status: 500, headers: rateLimitHeaders }
    );
  }
}

/**
 * Reject non-POST requests
 */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    { error: 'Method not allowed. Use POST to track events.' },
    { status: 405 }
  );
}

/**
 * Handle OPTIONS for CORS preflight
 */
export async function OPTIONS(request: NextRequest): Promise<NextResponse> {
  return new NextResponse(null, {
    status: 204,
    headers: corsPreflightHeadersFor(request, 'POST, OPTIONS'),
  });
}
