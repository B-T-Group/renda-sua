-- Irreversible enum value additions are left in place.
DROP INDEX IF EXISTS unique_rating_per_rental_booking_type_rater;
DROP INDEX IF EXISTS unique_rating_per_order_type_rater;
DROP INDEX IF EXISTS idx_ratings_rental_booking_id;

ALTER TABLE public.ratings DROP CONSTRAINT IF EXISTS ratings_order_or_booking_chk;
ALTER TABLE public.ratings DROP CONSTRAINT IF EXISTS valid_rating_combination;
ALTER TABLE public.ratings DROP CONSTRAINT IF EXISTS ratings_rated_entity_type_check;

ALTER TABLE public.ratings DROP COLUMN IF EXISTS rental_booking_id;

ALTER TABLE public.ratings
  ADD CONSTRAINT valid_rating_combination CHECK (
    (rating_type = 'client_to_agent' AND rated_entity_type = 'agent')
    OR (rating_type = 'client_to_item' AND rated_entity_type = 'item')
    OR (rating_type = 'agent_to_client' AND rated_entity_type = 'client')
  );

ALTER TABLE public.ratings
  ADD CONSTRAINT ratings_rated_entity_type_check CHECK (
    rated_entity_type IN ('agent', 'client', 'item')
  );

ALTER TABLE public.rating_aggregates DROP CONSTRAINT IF EXISTS rating_aggregates_entity_type_check;
ALTER TABLE public.rating_aggregates
  ADD CONSTRAINT rating_aggregates_entity_type_check CHECK (
    entity_type IN ('agent', 'client', 'item')
  );
