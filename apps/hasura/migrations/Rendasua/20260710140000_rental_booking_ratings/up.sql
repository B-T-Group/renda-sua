-- Allow ratings for completed rental bookings (in addition to orders)

ALTER TYPE public.rating_type_enum ADD VALUE IF NOT EXISTS 'client_to_rental_item';
ALTER TYPE public.rating_type_enum ADD VALUE IF NOT EXISTS 'client_to_rental_business';

ALTER TABLE public.ratings
  ALTER COLUMN order_id DROP NOT NULL;

ALTER TABLE public.ratings
  ADD COLUMN IF NOT EXISTS rental_booking_id UUID REFERENCES public.rental_bookings(id) ON DELETE CASCADE;

ALTER TABLE public.ratings
  DROP CONSTRAINT IF EXISTS unique_rating_per_order;

ALTER TABLE public.ratings
  ADD CONSTRAINT ratings_order_or_booking_chk CHECK (
    (order_id IS NOT NULL AND rental_booking_id IS NULL)
    OR (order_id IS NULL AND rental_booking_id IS NOT NULL)
  );

CREATE UNIQUE INDEX IF NOT EXISTS unique_rating_per_order_type_rater
  ON public.ratings (order_id, rating_type, rater_user_id)
  WHERE order_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS unique_rating_per_rental_booking_type_rater
  ON public.ratings (rental_booking_id, rating_type, rater_user_id)
  WHERE rental_booking_id IS NOT NULL;

ALTER TABLE public.ratings
  DROP CONSTRAINT IF EXISTS valid_rating_combination;

ALTER TABLE public.ratings
  ADD CONSTRAINT valid_rating_combination CHECK (
    (rating_type = 'client_to_agent' AND rated_entity_type = 'agent')
    OR (rating_type = 'client_to_item' AND rated_entity_type = 'item')
    OR (rating_type = 'agent_to_client' AND rated_entity_type = 'client')
    OR (rating_type = 'client_to_rental_item' AND rated_entity_type = 'rental_item')
    OR (rating_type = 'client_to_rental_business' AND rated_entity_type = 'business')
  );

ALTER TABLE public.ratings
  DROP CONSTRAINT IF EXISTS ratings_rated_entity_type_check;

ALTER TABLE public.ratings
  ADD CONSTRAINT ratings_rated_entity_type_check CHECK (
    rated_entity_type IN ('agent', 'client', 'item', 'rental_item', 'business')
  );

CREATE INDEX IF NOT EXISTS idx_ratings_rental_booking_id
  ON public.ratings (rental_booking_id)
  WHERE rental_booking_id IS NOT NULL;

ALTER TABLE public.rating_aggregates
  DROP CONSTRAINT IF EXISTS rating_aggregates_entity_type_check;

ALTER TABLE public.rating_aggregates
  ADD CONSTRAINT rating_aggregates_entity_type_check CHECK (
    entity_type IN ('agent', 'client', 'item', 'rental_item', 'business')
  );
