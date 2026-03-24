ALTER TABLE public.rental_location_listings
ADD COLUMN base_price_per_day NUMERIC(18, 2);

UPDATE public.rental_location_listings
SET base_price_per_day = ROUND((base_price_per_hour * 12.0)::numeric, 2)
WHERE base_price_per_day IS NULL;

ALTER TABLE public.rental_location_listings
ALTER COLUMN base_price_per_day SET NOT NULL;
