DELETE FROM public.application_configurations
WHERE config_key = 'rentals_day_hours_picker_enabled';

ALTER TABLE public.rental_location_listings
  DROP CONSTRAINT IF EXISTS rental_location_listings_offers_a_mode;

ALTER TABLE public.rental_location_listings
  DROP COLUMN IF EXISTS offers_daily;

ALTER TABLE public.rental_location_listings
  DROP COLUMN IF EXISTS offers_hourly;
