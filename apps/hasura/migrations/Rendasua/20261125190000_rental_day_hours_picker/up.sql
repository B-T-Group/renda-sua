-- Rental day-and-hours picker (Samuel, 25 Nov 2026).
-- 1. Listing switches "Rent by the day" / "Rent by the hour". Both default on,
--    so every existing listing keeps renting both ways. At least one must stay on.
-- 2. Flag rentals_day_hours_picker_enabled, inserted false (global row).
--    Do not enable this from a workflow. DEV and prod are turned on by hand.
-- Idempotent: safe to re-run.

ALTER TABLE public.rental_location_listings
  ADD COLUMN IF NOT EXISTS offers_hourly boolean NOT NULL DEFAULT true;

ALTER TABLE public.rental_location_listings
  ADD COLUMN IF NOT EXISTS offers_daily boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.rental_location_listings.offers_hourly IS
  'Rent by the hour. Renters can pick hour blocks. Default true.';
COMMENT ON COLUMN public.rental_location_listings.offers_daily IS
  'Rent by the day. Renters can pick Full day. Default true.';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'rental_location_listings_offers_a_mode'
      AND conrelid = 'public.rental_location_listings'::regclass
  ) THEN
    ALTER TABLE public.rental_location_listings
      ADD CONSTRAINT rental_location_listings_offers_a_mode
      CHECK (offers_hourly OR offers_daily);
  END IF;
END
$$;

INSERT INTO public.application_configurations (
  config_key, config_name, description, data_type, boolean_value,
  country_code, status, version, tags
)
SELECT
  'rentals_day_hours_picker_enabled',
  'Rental day-and-hours picker',
  'One sheet to pick days, then Full day or Hours per day. Adds the listing switches Rent by the day / Rent by the hour, and turns on the server rules for days in a row, per-block min/max hours and the 2-hour lead time. Country row first, then global row, default false.',
  'boolean', false, NULL, 'active', 1,
  ARRAY['rentals', 'feature-flag']
WHERE NOT EXISTS (
  SELECT 1 FROM public.application_configurations
  WHERE config_key = 'rentals_day_hours_picker_enabled' AND country_code IS NULL
);
