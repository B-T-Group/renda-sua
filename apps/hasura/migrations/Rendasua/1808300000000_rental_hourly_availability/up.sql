ALTER TABLE public.rental_location_listings
ADD COLUMN base_price_per_hour NUMERIC(18, 2),
ADD COLUMN min_rental_hours INTEGER,
ADD COLUMN max_rental_hours INTEGER;

UPDATE public.rental_location_listings
SET
  base_price_per_hour = ROUND((base_price_per_day / 12.0)::numeric, 2),
  min_rental_hours = GREATEST(COALESCE(min_rental_days, 1) * 12, 1),
  max_rental_hours = CASE
    WHEN max_rental_days IS NULL THEN NULL
    ELSE GREATEST(max_rental_days * 12, 1)
  END;

ALTER TABLE public.rental_location_listings
ALTER COLUMN base_price_per_hour SET NOT NULL,
ALTER COLUMN min_rental_hours SET NOT NULL;

ALTER TABLE public.rental_location_listings
ADD CONSTRAINT rental_location_listings_min_max_hours_check CHECK (
  max_rental_hours IS NULL OR max_rental_hours >= min_rental_hours
);

CREATE TABLE public.rental_listing_weekly_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES public.rental_location_listings(id) ON UPDATE RESTRICT ON DELETE CASCADE,
  weekday INTEGER NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  is_available BOOLEAN NOT NULL DEFAULT TRUE,
  start_time TIME,
  end_time TIME,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT rental_listing_weekly_availability_unique UNIQUE (listing_id, weekday),
  CONSTRAINT rental_listing_weekly_availability_time_check CHECK (
    (is_available = FALSE AND start_time IS NULL AND end_time IS NULL)
    OR (
      is_available = TRUE
      AND start_time IS NOT NULL
      AND end_time IS NOT NULL
      AND end_time > start_time
    )
  )
);

CREATE INDEX idx_rental_listing_weekly_availability_listing
ON public.rental_listing_weekly_availability(listing_id);

CREATE TRIGGER set_public_rental_listing_weekly_availability_updated_at
  BEFORE UPDATE ON public.rental_listing_weekly_availability
  FOR EACH ROW
  EXECUTE FUNCTION public.set_current_timestamp_updated_at();

INSERT INTO public.rental_listing_weekly_availability (
  listing_id,
  weekday,
  is_available,
  start_time,
  end_time
)
SELECT
  rll.id,
  weekdays.weekday,
  CASE WHEN weekdays.weekday BETWEEN 1 AND 6 THEN TRUE ELSE FALSE END,
  CASE WHEN weekdays.weekday BETWEEN 1 AND 6 THEN '08:00:00'::time ELSE NULL END,
  CASE WHEN weekdays.weekday BETWEEN 1 AND 6 THEN '20:00:00'::time ELSE NULL END
FROM public.rental_location_listings rll
CROSS JOIN (
  SELECT 0 AS weekday
  UNION ALL SELECT 1
  UNION ALL SELECT 2
  UNION ALL SELECT 3
  UNION ALL SELECT 4
  UNION ALL SELECT 5
  UNION ALL SELECT 6
) weekdays;
