DROP TRIGGER IF EXISTS set_public_rental_listing_weekly_availability_updated_at
ON public.rental_listing_weekly_availability;

DROP TABLE IF EXISTS public.rental_listing_weekly_availability;

ALTER TABLE public.rental_location_listings
DROP CONSTRAINT IF EXISTS rental_location_listings_min_max_hours_check;

ALTER TABLE public.rental_location_listings
DROP COLUMN IF EXISTS max_rental_hours,
DROP COLUMN IF EXISTS min_rental_hours,
DROP COLUMN IF EXISTS base_price_per_hour;
