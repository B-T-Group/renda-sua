-- Item rating prompt support:
-- 1. Track when the delayed "rate your item" nudge was sent for an order.
-- 2. Allow one client_to_item rating per line item (not just one per order)
--    by including rated_entity_id in the order uniqueness index.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS item_rating_nudge_sent_at TIMESTAMPTZ;

COMMENT ON COLUMN public.orders.item_rating_nudge_sent_at IS
  'When the delayed rate-your-item push nudge was sent to the client (null = not sent yet).';

DROP INDEX IF EXISTS unique_rating_per_order_type_rater;

CREATE UNIQUE INDEX IF NOT EXISTS unique_rating_per_order_type_rater_entity
  ON public.ratings (order_id, rating_type, rater_user_id, rated_entity_id)
  WHERE order_id IS NOT NULL;
