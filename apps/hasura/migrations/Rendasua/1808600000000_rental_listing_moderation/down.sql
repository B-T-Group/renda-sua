DELETE FROM public.entity_types WHERE id = 'rental_listing';

ALTER TABLE public.rental_location_listings
  DROP COLUMN IF EXISTS moderated_by_user_id,
  DROP COLUMN IF EXISTS moderated_at,
  DROP COLUMN IF EXISTS moderation_status;

DROP TYPE IF EXISTS public.rental_listing_moderation_status;
