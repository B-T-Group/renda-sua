-- Hourly pricing replaced daily; inserts only set base_price_per_hour.
ALTER TABLE public.rental_location_listings
DROP COLUMN IF EXISTS base_price_per_day;
