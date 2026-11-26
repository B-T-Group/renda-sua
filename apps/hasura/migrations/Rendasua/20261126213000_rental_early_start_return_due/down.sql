-- Restore rental_mark_started without return_due_at, then drop the helper and the column.

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
  -- start_at / end_at are listing wall clock; p_at is a real instant. Compare on
  -- the listing clock. actual_start_at keeps the real p_at.
  IF public.rental_wall_now(p_at, v_country) < v_opens
     OR public.rental_wall_now(p_at, v_country) >= v_booking.end_at THEN
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

DROP FUNCTION IF EXISTS public.rental_early_start_return_due(timestamptz, timestamptz, jsonb, timestamptz, text);

ALTER TABLE public.rental_bookings
  DROP COLUMN IF EXISTS return_due_at;
