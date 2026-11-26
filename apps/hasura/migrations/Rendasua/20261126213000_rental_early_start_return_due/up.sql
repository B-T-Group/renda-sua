-- Early start of an hourly rental (Samuel, 26 Nov 2026 12:01 PM ET).
-- A single hourly booking started before its booked start is due back at the real
-- start + the booked hours: a 14:00-16:00 booking started at 11:00 is due at 13:00.
-- Full-day and multi-window bookings, on-time starts and late starts keep end_at.
--
-- * rental_bookings.return_due_at: the return due time set when the rental starts.
--   Same encoding as start_at / end_at (listing wall clock written as UTC components).
--   NULL means the booked end_at is the due time. Readers use COALESCE(return_due_at, end_at).
-- * rental_early_start_return_due: the rule. Booked hours are added to the real start
--   instant, then read on the listing clock, so a DST change inside the rental still
--   gives exactly the booked hours of use.
-- * rental_mark_started stamps return_due_at. Its signature is unchanged.
-- Idempotent.

ALTER TABLE public.rental_bookings
  ADD COLUMN IF NOT EXISTS return_due_at timestamptz;

COMMENT ON COLUMN public.rental_bookings.return_due_at IS
  'Return due time set at start (listing wall clock, same encoding as end_at). Set for hourly early starts only: actual start + booked hours. NULL = end_at.';

CREATE OR REPLACE FUNCTION public.rental_early_start_return_due(
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_snapshot jsonb,
  p_at timestamptz,
  p_country text
) RETURNS timestamptz
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_start_at IS NULL OR p_end_at IS NULL OR p_at IS NULL OR p_end_at <= p_start_at THEN NULL
    WHEN jsonb_typeof(p_snapshot->'lines') IS DISTINCT FROM 'array' THEN NULL
    WHEN jsonb_array_length(p_snapshot->'lines') <> 1 THEN NULL
    WHEN (p_snapshot->'lines'->0->>'kind') IS DISTINCT FROM 'hourly' THEN NULL
    WHEN public.rental_wall_now(p_at, p_country) >= p_start_at THEN NULL
    ELSE LEAST(
      p_end_at,
      public.rental_wall_now(
        p_at + make_interval(secs => EXTRACT(EPOCH FROM (p_end_at - p_start_at))),
        p_country
      )
    )
  END;
$$;

COMMENT ON FUNCTION public.rental_early_start_return_due(timestamptz, timestamptz, jsonb, timestamptz, text) IS
  'Wall-clock return due for an hourly booking started early (p_at before start_at on the listing clock); NULL keeps end_at.';

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
         return_due_at = public.rental_early_start_return_due(
           v_booking.start_at,
           v_booking.end_at,
           v_booking.rental_pricing_snapshot,
           p_at,
           v_country
         ),
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
