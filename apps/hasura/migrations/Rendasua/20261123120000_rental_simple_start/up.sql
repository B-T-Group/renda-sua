-- Renter start window: 00:00 on the start day in the listing time zone until end_at.
-- rental_start_opens_at is the instant clients show as "Pickup on <day>".
-- PIN columns stay. Old PIN routes are rejected in the API.

CREATE OR REPLACE FUNCTION public.rental_listing_time_zone(p_country text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE upper(btrim(coalesce(p_country, '')))
    WHEN 'CM' THEN 'Africa/Douala'
    WHEN 'CAMEROON' THEN 'Africa/Douala'
    WHEN 'CAMEROUN' THEN 'Africa/Douala'
    WHEN 'CA' THEN 'America/Toronto'
    WHEN 'CANADA' THEN 'America/Toronto'
    WHEN 'GA' THEN 'Africa/Libreville'
    WHEN 'GABON' THEN 'Africa/Libreville'
    WHEN 'TG' THEN 'Africa/Lome'
    WHEN 'TOGO' THEN 'Africa/Lome'
    WHEN 'BJ' THEN 'Africa/Porto-Novo'
    WHEN 'BENIN' THEN 'Africa/Porto-Novo'
    WHEN 'BÉNIN' THEN 'Africa/Porto-Novo'
    WHEN 'CI' THEN 'Africa/Abidjan'
    WHEN 'COTE D''IVOIRE' THEN 'Africa/Abidjan'
    WHEN 'CÔTE D''IVOIRE' THEN 'Africa/Abidjan'
    WHEN 'IVORY COAST' THEN 'Africa/Abidjan'
    WHEN 'CG' THEN 'Africa/Brazzaville'
    WHEN 'CONGO' THEN 'Africa/Brazzaville'
    WHEN 'CD' THEN 'Africa/Kinshasa'
    WHEN 'PH' THEN 'Asia/Manila'
    WHEN 'PHILIPPINES' THEN 'Asia/Manila'
    WHEN 'US' THEN 'America/New_York'
    WHEN 'USA' THEN 'America/New_York'
    WHEN 'UNITED STATES' THEN 'America/New_York'
    ELSE 'Africa/Douala'
  END;
$$;

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

CREATE OR REPLACE FUNCTION public.rental_booking_country(p_listing_id uuid)
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT a.country
    FROM public.rental_location_listings l
    JOIN public.business_locations bl ON bl.id = l.business_location_id
    JOIN public.addresses a ON a.id = bl.address_id
   WHERE l.id = p_listing_id;
$$;

CREATE OR REPLACE FUNCTION public.rental_mark_started(p_booking_id uuid, p_at timestamptz)
RETURNS SETOF public.rental_bookings
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
  v_booking public.rental_bookings%ROWTYPE;
  v_country text;
  v_opens timestamptz;
BEGIN
  SELECT * INTO v_booking
    FROM public.rental_bookings
   WHERE id = p_booking_id
   FOR UPDATE;
  IF NOT FOUND OR v_booking.status::text <> 'confirmed' THEN
    RETURN;
  END IF;
  IF v_booking.inspection_policy_version IS NOT NULL AND NOT (
    v_booking.pickup_ack_current = true
    AND v_booking.pickup_accepted_version_id IS NOT NULL
    AND v_booking.pickup_accepted_version_id IS NOT DISTINCT FROM v_booking.pickup_current_version_id
  ) THEN
    RETURN;
  END IF;

  v_country := public.rental_booking_country(v_booking.rental_location_listing_id);
  v_opens := public.rental_start_opens_at(v_booking.start_at, v_country);
  IF p_at < v_opens OR p_at >= v_booking.end_at THEN
    RAISE EXCEPTION 'rental_start_window'
      USING ERRCODE = 'check_violation', DETAIL = v_opens::text;
  END IF;

  UPDATE public.rental_bookings
     SET status = 'active',
         actual_start_at = p_at,
         updated_at = now()
   WHERE id = p_booking_id
     AND status = 'confirmed'
  RETURNING * INTO v_booking;
  IF FOUND THEN
    RETURN NEXT v_booking;
  END IF;
  RETURN;
END;
$$;

CREATE OR REPLACE FUNCTION public.rental_accept_pickup_version(
  p_booking_id uuid,
  p_version_id uuid,
  p_actor uuid
) RETURNS SETOF public.rental_bookings
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
  v_rows integer;
  v_country text;
BEGIN
  PERFORM 1 FROM public.rental_bookings WHERE id = p_booking_id FOR UPDATE;

  INSERT INTO public.rental_inspection_acks (version_id, actor_user_id, persona, decision)
  SELECT p_version_id, p_actor, 'client', 'accept'
   WHERE EXISTS (
     SELECT 1
       FROM public.rental_bookings b
       JOIN public.rental_inspections i
         ON i.rental_booking_id = b.id AND i.stage = 'pickup'
       JOIN public.rental_inspection_versions v
         ON v.id = p_version_id
        AND v.inspection_id = i.id
        AND v.status = 'submitted'
        AND v.allocation_version = b.allocation_version
      WHERE b.id = p_booking_id
        AND b.inspection_policy_version IS NOT NULL
        AND b.pickup_current_version_id = p_version_id
        AND b.pickup_ack_current = false
        AND b.actual_start_at IS NULL
        AND b.status::text IN ('reserved', 'confirmed')
        AND NOT EXISTS (
          SELECT 1 FROM public.rental_inspection_acks a
           WHERE a.version_id = p_version_id AND a.persona = 'client'
        )
   );
  IF NOT FOUND THEN
    RAISE EXCEPTION 'rental_inspection_ack_conflict' USING ERRCODE = 'unique_violation';
  END IF;

  SELECT public.rental_booking_country(rental_location_listing_id)
    INTO v_country
    FROM public.rental_bookings
   WHERE id = p_booking_id;

  UPDATE public.rental_bookings
     SET pickup_accepted_version_id = p_version_id,
         pickup_ack_current = true,
         pickup_inspection_pending = false,
         reserved_cancel_after = CASE
           WHEN status::text = 'reserved'
             THEN public.rental_end_of_start_day(start_at, v_country)
           ELSE reserved_cancel_after
         END,
         updated_at = now()
   WHERE id = p_booking_id
     AND pickup_current_version_id = p_version_id
     AND pickup_ack_current = false
     AND actual_start_at IS NULL
     AND status::text IN ('reserved', 'confirmed');
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 1 THEN
    RAISE EXCEPTION 'rental_inspection_ack_conflict' USING ERRCODE = 'unique_violation';
  END IF;
  RETURN QUERY SELECT * FROM public.rental_bookings WHERE id = p_booking_id;
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'rental_inspection_ack_conflict' USING ERRCODE = 'unique_violation';
END;
$$;

INSERT INTO public.message_types (id, comment)
VALUES
  (
    'RENTAL_START_DAY',
    'Reminder that rental pickup is today and the renter starts it in the app.'
  ),
  (
    'RENTAL_NOT_COLLECTED',
    'The business says the renter did not collect the item.'
  ),
  (
    'RENTAL_NO_SHOW',
    'A confirmed rental was cancelled because nobody started it by the end time.'
  )
ON CONFLICT (id) DO NOTHING;
