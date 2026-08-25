-- ============================================================================
-- ORDERS: ENFORCE PAYMENT-INTENT UNIQUENESS (F-01)
-- ============================================================================
-- The webhook's Supabase fulfillment path used SELECT-then-INSERT, so two
-- concurrent deliveries of the same checkout session could both pass the
-- duplicate check and create two orders (plus order_items and licenses) for
-- one payment. The webhook now treats a unique violation as "order already
-- fulfilled"; this index is the database-level guarantee that makes that safe.
--
-- Partial index: payment_intent_id is nullable (PI-less sessions fall back to
-- the existing order_number UNIQUE constraint), so NULL rows are excluded.
-- Mirrors manuscripts_book_id_unique (20260724000003).
-- ============================================================================

-- Guard: refuse to run while duplicate payment_intent_ids exist. Duplicates
-- are paid orders, so nothing is deleted automatically — the operator must
-- resolve them manually (merge/refund) and re-run the migration.
DO $$
DECLARE
  dup_list TEXT;
BEGIN
  SELECT string_agg(payment_intent_id || ' (' || cnt || ' orders)', ', ')
  INTO dup_list
  FROM (
    SELECT payment_intent_id, COUNT(*) AS cnt
    FROM orders
    WHERE payment_intent_id IS NOT NULL
    GROUP BY payment_intent_id
    HAVING COUNT(*) > 1
  ) dups;

  IF dup_list IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot enforce uniqueness on orders(payment_intent_id): duplicate payment_intent_ids must be resolved manually first: %', dup_list;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS orders_payment_intent_id_unique
  ON orders (payment_intent_id)
  WHERE payment_intent_id IS NOT NULL;
