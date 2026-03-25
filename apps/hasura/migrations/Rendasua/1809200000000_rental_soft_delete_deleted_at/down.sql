DROP INDEX IF EXISTS public.idx_rental_location_listings_deleted_at_null;
DROP INDEX IF EXISTS public.idx_rental_items_deleted_at_null;

ALTER TABLE public.rental_location_listings
  DROP COLUMN IF EXISTS deleted_at;

ALTER TABLE public.rental_items
  DROP COLUMN IF EXISTS deleted_at;
