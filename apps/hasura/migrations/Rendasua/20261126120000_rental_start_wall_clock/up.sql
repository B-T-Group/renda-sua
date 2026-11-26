-- start_at is listing wall clock stored as UTC components (08:00 Douala is
-- 2026-11-26T08:00:00Z). Converting that instant into the listing time zone
-- opens the pickup day an hour early in Douala and can lock a Manila afternoon
-- booking until the next calendar day. The pickup day is the stored UTC date.

CREATE OR REPLACE FUNCTION public.rental_start_opens_at(p_start timestamptz, p_country text)
RETURNS timestamptz
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT date_trunc('day', p_start AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
$$;

CREATE OR REPLACE FUNCTION public.rental_end_of_start_day(p_start timestamptz, p_country text)
RETURNS timestamptz
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT public.rental_start_opens_at(p_start, p_country) + interval '1 day';
$$;
