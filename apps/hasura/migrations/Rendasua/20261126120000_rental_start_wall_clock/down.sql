CREATE OR REPLACE FUNCTION public.rental_start_opens_at(p_start timestamptz, p_country text)
RETURNS timestamptz
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT date_trunc(
    'day',
    p_start AT TIME ZONE public.rental_listing_time_zone(p_country)
  ) AT TIME ZONE public.rental_listing_time_zone(p_country);
$$;

CREATE OR REPLACE FUNCTION public.rental_end_of_start_day(p_start timestamptz, p_country text)
RETURNS timestamptz
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT public.rental_start_opens_at(p_start, p_country) + interval '1 day';
$$;
