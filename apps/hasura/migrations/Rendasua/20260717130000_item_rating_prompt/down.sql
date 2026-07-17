DROP INDEX IF EXISTS unique_rating_per_order_type_rater_entity;

CREATE UNIQUE INDEX IF NOT EXISTS unique_rating_per_order_type_rater
  ON public.ratings (order_id, rating_type, rater_user_id)
  WHERE order_id IS NOT NULL;

ALTER TABLE public.orders
  DROP COLUMN IF EXISTS item_rating_nudge_sent_at;
