-- ============================================================================
-- RLS policy backfill (F-04) — Freeze #209 class: approved security fix
--
-- Supabase security advisors (2026-08-14) flag these tables as RLS ENABLED
-- with ZERO policies (deny-all): comments, user_follows, reading_lists,
-- user_activities, reading_sessions, engagement_events, newsletter_subscribers,
-- book_content, resonance_vectors, rate_limits, analytics_events_2025/2026/
-- 2027/default, mcp_vault.credentials. RLS was enabled without policies in
-- 20260708074716_enable_rls_on_exposed_tables.sql and
-- 20260122000000_social_features.sql.
--
-- This migration adds policies ONLY for the tables the app provably queries
-- with the user's cookie-scoped client (lib/supabase/server.ts, anon key,
-- RLS enforced): user_follows, reading_lists, user_activities. Every policy
-- cites the call site that needs it.
--
-- All other flagged tables are accessed exclusively through the service-role
-- client (lib/supabase/admin.ts, bypasses RLS) or not at all; their deny-all
-- posture is intentional and is documented — not changed — at the bottom of
-- this file.
--
-- Pattern/naming/idempotency convention copied from
-- 20260719014244_review_enhancements.sql: DROP POLICY IF EXISTS + CREATE
-- POLICY, snake_case {table}_owner_{op} names, owner checks on auth.uid().
-- (PostgreSQL has no CREATE POLICY IF NOT EXISTS; DROP+CREATE is the repo's
-- idempotency idiom.) Touches policies only: no ALTER TABLE, no grants.
--
-- Column ownership confirmed against the creating migration
-- 20260122000000_social_features.sql: user_follows.follower_id/following_id,
-- reading_lists.user_id and user_activities.user_id all reference
-- auth.users(id) directly, so auth.uid() comparisons need no profiles join
-- (unlike reading_progress/reading_sessions, whose user_id references
-- profiles(id)).
-- Idempotent: safe to run multiple times.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- user_follows — written and read with the user client in
-- lib/actions/follows.ts (createClient from @/lib/supabase/server).
-- ---------------------------------------------------------------------------

-- SELECT: checkIfFollowing() reads rows where follower_id = user.id
-- (lib/actions/follows.ts:73-97); getUserFollowers()/getUserFollowing()
-- (lib/actions/follows.ts:99-186) list rows by following_id/follower_id.
-- Owner-scoped: a user sees only follow edges they participate in.
DROP POLICY IF EXISTS user_follows_owner_select ON public.user_follows;
CREATE POLICY user_follows_owner_select ON public.user_follows
    FOR SELECT
    USING (auth.uid() = follower_id OR auth.uid() = following_id);

-- INSERT: followUser() inserts { follower_id: user.id, following_id }
-- (lib/actions/follows.ts:20-23).
DROP POLICY IF EXISTS user_follows_owner_insert ON public.user_follows;
CREATE POLICY user_follows_owner_insert ON public.user_follows
    FOR INSERT
    WITH CHECK (auth.uid() = follower_id);

-- DELETE: unfollowUser() deletes by follower_id = user.id
-- (lib/actions/follows.ts:57-61).
DROP POLICY IF EXISTS user_follows_owner_delete ON public.user_follows;
CREATE POLICY user_follows_owner_delete ON public.user_follows
    FOR DELETE
    USING (auth.uid() = follower_id);

-- No UPDATE policy: the app never updates follow edges (insert/delete only).

-- ---------------------------------------------------------------------------
-- reading_lists — full owner CRUD with the user client in
-- lib/actions/reading-list.ts; live UI path: components/social/ReadingList.tsx
-- imports updateReadingStatus (line 19).
-- ---------------------------------------------------------------------------

-- SELECT: addToReadingList() pre-checks existing rows by user_id = user.id
-- (lib/actions/reading-list.ts:35-40); getReadingList()/getReadingStats()
-- (lib/actions/reading-list.ts:150-226) list rows by user_id.
DROP POLICY IF EXISTS reading_lists_owner_select ON public.reading_lists;
CREATE POLICY reading_lists_owner_select ON public.reading_lists
    FOR SELECT
    USING (auth.uid() = user_id);

-- INSERT: addToReadingList() inserts { user_id: user.id, ... }
-- (lib/actions/reading-list.ts:20-25,54).
DROP POLICY IF EXISTS reading_lists_owner_insert ON public.reading_lists;
CREATE POLICY reading_lists_owner_insert ON public.reading_lists
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- UPDATE: addToReadingList() update path (lib/actions/reading-list.ts:44-51)
-- and updateReadingStatus() (lib/actions/reading-list.ts:71-124) update the
-- caller's own rows.
DROP POLICY IF EXISTS reading_lists_owner_update ON public.reading_lists;
CREATE POLICY reading_lists_owner_update ON public.reading_lists
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- DELETE: removeFromReadingList() deletes by user_id = user.id
-- (lib/actions/reading-list.ts:126-148).
DROP POLICY IF EXISTS reading_lists_owner_delete ON public.reading_lists;
CREATE POLICY reading_lists_owner_delete ON public.reading_lists
    FOR DELETE
    USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- user_activities — insert-only from the user client today.
-- ---------------------------------------------------------------------------

-- INSERT: followUser() logs { user_id: user.id, activity_type: 'follow' }
-- (lib/actions/follows.ts:32-38); logReadingActivity() logs reading-list
-- changes (lib/actions/reading-list.ts:159-166 via addToReadingList/
-- updateReadingStatus). Without this policy those user-client inserts fail
-- silently (their results are unchecked).
DROP POLICY IF EXISTS user_activities_owner_insert ON public.user_activities;
CREATE POLICY user_activities_owner_insert ON public.user_activities
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- SELECT: no client-side reader exists yet; owner-only read is granted so the
-- rows a user writes stay visible to that user (same owner-read precedent as
-- review_votes_owner_read in 20260719014244_review_enhancements.sql). Exposes
-- nothing about other users; anon still sees zero rows.
DROP POLICY IF EXISTS user_activities_owner_select ON public.user_activities;
CREATE POLICY user_activities_owner_select ON public.user_activities
    FOR SELECT
    USING (auth.uid() = user_id);

-- No UPDATE/DELETE policies: activity log entries are immutable in the app.

-- ============================================================================
-- DENY-ALL-BY-DESIGN — intentionally NO policies for the tables below.
-- RLS stays enabled with zero policies: anon/authenticated PostgREST access is
-- fully denied; the service-role client bypasses RLS and is the only intended
-- path. Recorded here so future advisor runs read this as a decision, not an
-- omission. (Comments only — this migration deliberately makes no change to
-- these tables.)
--
-- * public.comments — dead table. No .from('comments'), no PostgREST embed,
--   no API route anywhere in app/, lib/ or components/; only the creating
--   migration 20260122000000_social_features.sql references it. If a comments
--   UI ships, copy the reviews policy block from
--   20260719014244_review_enhancements.sql (public read / owner write).
--
-- * public.reading_sessions — no app read/write path. Sole reference is the
--   optional-table existence probe in app/api/health/route.ts:221-247, which
--   only inspects the error object; an RLS-filtered empty result still passes.
--   NOTE for future policies: reading_sessions.user_id references profiles(id)
--   (20260116000000_initial_schema.sql), so an owner check must join profiles
--   like the reading_progress policies do — NOT bare auth.uid() = user_id.
--
-- * public.book_content — service-role only, on purpose. Downloads are proxied
--   with a server-side purchase check through the admin client in
--   app/api/files/[id]/route.ts ("Never exposes the raw Blob/Supabase URL to
--   the client"); admin writes happen in lib/data/book-assets.ts:187-235. The
--   reader never queries book_content client-side, so no purchaser-read
--   (EXISTS orders/order_items) policy is added.
--
-- * public.engagement_events — service-role writes only:
--   app/api/resonance/track/route.ts:125-136, app/api/wishlist/route.ts:103-118
--   (in-code comment: "RLS blocks user-context inserts there, so use the
--   service-role client"), admin reads in lib/data/admin-dashboard.ts:29-45 and
--   lib/resonance/recommendations.ts. trackEngagement() in
--   lib/supabase/queries.ts:511-525 uses the user client but has no callers
--   (dead code).
--
-- * public.resonance_vectors — service-role only: admin-gated upsert in
--   app/api/resonance/embed/route.ts:42-62, admin reads in
--   lib/resonance/recommendations.ts:294.
--
-- * public.newsletter_subscribers — service-role only: every read/write in
--   lib/email/newsletter.ts goes through createAdminClient (lines 19, 92, 163,
--   207); double-opt-in tokens must never be user-readable.
--
-- * public.rate_limits — no PostgREST access at all. Runtime rate limiting is
--   Upstash/in-memory (lib/rate-limit.ts); the table is touched only by the
--   SQL function check_rate_limit() (20260118000000_critical_fixes.sql FIX 12).
--
-- * public.analytics_events_2025 / _2026 / _2027 / _default — partitions of
--   analytics_events. The app addresses only the parent table (admin inserts:
--   app/api/analytics/track/route.ts:168-176, app/api/webhook/route.ts:255;
--   author reads via the parent's "Authors can view analytics for their books"
--   policy from 20260719005815_security_hardening_rls_exec.sql, e.g.
--   lib/actions/export-data.ts:83-86). Parent-table RLS governs those queries;
--   the partitions' own zero-policy RLS only blocks direct partition access,
--   which nothing performs.
--
-- * mcp_vault.credentials — deny-all documented at creation:
--   20260729221355_create_mcp_vault_schema.sql revokes anon/authenticated and
--   states "No policies created: ... service_role bypasses RLS, which is the
--   only intended access path." Nothing to add.
-- ============================================================================
