-- HA-C2 / HA-B13: align storage with the locked "no public EPUB access" launch decision.
-- The bucket was verified EMPTY (0 objects) on 2026-07-30 before this change,
-- so no existing URL or signed-URL assumption can break.
-- App layer already treats EPUB delivery as gated (service-role streaming via /api/files).
--
-- NOTE: this migration was applied to the hosted project on 2026-07-30 (version
-- 20260730173947 in supabase_migrations.schema_migrations). This file mirrors the
-- applied SQL byte-for-byte so repo and hosted history stay in sync (Task 3.6 rule:
-- never let hosted history drift silently).
update storage.buckets set public = false where id = 'published-epubs';
