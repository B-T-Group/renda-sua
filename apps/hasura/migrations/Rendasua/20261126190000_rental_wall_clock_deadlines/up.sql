-- Rental start_at / end_at (and request window starts) are the listing's wall clock
-- written as UTC components: Toronto 14:00 is 2026-11-26T14:00:00Z. Real instants
-- (now(), p_at, created_at, paid_at, actual_start_at, holds) were compared with them
-- directly, so Toronto deadlines landed 5 hours early and Douala / Manila ones late.
--
-- * rental_wall_now: a real instant read on the listing clock (same encoding as start_at).
-- * rental_wall_to_instant: the real instant a wall-clock value happens at the listing.
-- * rental_mark_started compares p_at on the listing clock.
-- * reserved_cancel_after (shown as a countdown) is stored as a real instant.
-- * respond_by stays a real instant; its "by the start" cap uses the real start.
-- Signatures are unchanged.

CREATE OR REPLACE FUNCTION public.rental_wall_now(p_at timestamptz, p_country text)
RETURNS timestamptz
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT timezone(public.rental_listing_time_zone(p_country), p_at) AT TIME ZONE 'UTC';
$$;

CREATE OR REPLACE FUNCTION public.rental_wall_to_instant(p_wall timestamptz, p_country text)
RETURNS timestamptz
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT timezone('UTC', p_wall) AT TIME ZONE public.rental_listing_time_zone(p_country);
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
             THEN public.rental_wall_to_instant(public.rental_end_of_start_day(start_at, v_country), v_country)
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

CREATE OR REPLACE FUNCTION public.extend_overdue_rental_respond_by(
  p_cutoff timestamptz,
  p_country text
) RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  n integer;
  v_base timestamptz := GREATEST(p_cutoff, now());
BEGIN
  UPDATE public.rental_requests AS request
     SET respond_by = GREATEST(
       LEAST(
         GREATEST(COALESCE(request.respond_by, v_base), v_base + interval '24 hours'),
         COALESCE(
           public.rental_wall_to_instant(
             request.requested_start_at,
             public.rental_booking_country(request.rental_location_listing_id)
           ),
           v_base + interval '24 hours'
         )
       ),
       p_cutoff
     )
   WHERE request.status::text = 'pending'
     AND (request.respond_by IS NULL OR request.respond_by < v_base)
     AND (
       p_country IS NULL
       OR EXISTS (
         SELECT 1
           FROM public.rental_location_listings AS listing
           JOIN public.business_locations AS location
             ON location.id = listing.business_location_id
           JOIN public.addresses AS address
             ON address.id = location.address_id
          WHERE listing.id = request.rental_location_listing_id
            AND public.normalized_country_key(address.country) = ANY (
              SELECT public.normalized_country_key(spelling)
                FROM unnest(public.rental_address_spellings(p_country)) AS spelling
            )
       )
     );
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_rental_request_edit(
  p_request_id uuid,
  p_client_id uuid,
  p_actor uuid,
  p_expected_version integer,
  p_windows jsonb,
  p_units integer,
  p_note text,
  p_change_summary jsonb,
  p_now timestamptz,
  p_confirmed_amount numeric DEFAULT NULL,
  p_confirmed_currency text DEFAULT NULL
) RETURNS SETOF public.rental_request_revisions
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
  v_listing uuid;
  v_req public.rental_requests%ROWTYPE;
  v_units_available integer;
  v_day numeric;
  v_hour numeric;
  v_deposit numeric;
  v_currency text;
  v_elem jsonb;
  v_line jsonb;
  v_lines jsonb := '[]'::jsonb;
  v_snapshot jsonb;
  v_start timestamptz;
  v_end timestamptz;
  v_new_start timestamptz;
  v_total numeric := 0;
  v_hours numeric;
  v_peak integer;
  v_note text;
  v_next integer;
  v_respond_by timestamptz;
  v_now_wall timestamptz;
  v_start_instant timestamptz;
  v_price_confirmed boolean := false;
  v_row public.rental_request_revisions%ROWTYPE;
BEGIN
  SELECT rental_location_listing_id INTO v_listing
    FROM public.rental_requests
   WHERE id = p_request_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'rental_request_not_pending' USING ERRCODE = 'check_violation';
  END IF;

  PERFORM 1 FROM public.rental_location_listings WHERE id = v_listing FOR NO KEY UPDATE;
  SELECT * INTO v_req FROM public.rental_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'rental_request_not_pending' USING ERRCODE = 'check_violation';
  END IF;
  IF v_req.client_id IS DISTINCT FROM p_client_id THEN
    RAISE EXCEPTION 'rental_request_forbidden' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF v_req.status::text IS DISTINCT FROM 'pending' THEN
    RAISE EXCEPTION 'rental_request_not_pending' USING ERRCODE = 'check_violation';
  END IF;
  IF v_req.edit_version IS DISTINCT FROM p_expected_version THEN
    RAISE EXCEPTION 'rental_request_stale_version' USING ERRCODE = 'serialization_failure';
  END IF;

  SELECT MIN((elem->>'start_at')::timestamptz) INTO v_start
    FROM jsonb_array_elements(COALESCE(v_req.rental_selection_windows, '[]'::jsonb)) elem;
  SELECT MIN((elem->>'start_at')::timestamptz) INTO v_new_start
    FROM jsonb_array_elements(p_windows) elem;
  -- start_at is listing wall clock stored as UTC components (Toronto 12:00 is
  -- T12:00:00Z), so the 2-hour edit window reads p_now on the listing's wall clock.
  v_now_wall := timezone(
    public.rental_listing_time_zone(public.rental_booking_country(v_listing)),
    p_now
  ) AT TIME ZONE 'UTC';
  IF v_start IS NULL OR v_new_start IS NULL
     OR v_start <= v_now_wall + interval '2 hours'
     OR v_new_start <= v_now_wall + interval '2 hours' THEN
    RAISE EXCEPTION 'rental_request_window_closed' USING ERRCODE = 'check_violation';
  END IF;

  SELECT l.units_available, l.base_price_per_day, l.base_price_per_hour,
         COALESCE(l.security_deposit_amount, 0), COALESCE(NULLIF(btrim(i.currency::text), ''), 'XAF')
    INTO v_units_available, v_day, v_hour, v_deposit, v_currency
    FROM public.rental_location_listings l
    LEFT JOIN public.rental_items i ON i.id = l.rental_item_id
   WHERE l.id = v_listing;
  IF p_units < 1 OR p_units > GREATEST(COALESCE(v_units_available, 1), 1) THEN
    RAISE EXCEPTION 'rental_request_unavailable' USING ERRCODE = 'check_violation';
  END IF;

  FOR v_elem IN SELECT value FROM jsonb_array_elements(p_windows)
  LOOP
    IF COALESCE(v_elem->>'billing', '') = 'all_day'
       AND v_elem->>'calendar_date' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN
      v_start := (v_elem->>'calendar_date' || 'T00:00:00Z')::timestamptz;
      v_end := v_start + interval '1 day';
      v_hours := 0;
      v_total := v_total + COALESCE(v_day, 0) * p_units;
      v_line := jsonb_build_object(
        'kind', 'all_day',
        'calendarDate', v_elem->>'calendar_date',
        'ratePerDay', COALESCE(v_day, 0),
        'subtotal', ROUND(COALESCE(v_day, 0) * p_units, 2)
      );
    ELSE
      v_start := (v_elem->>'start_at')::timestamptz;
      v_end := (v_elem->>'end_at')::timestamptz;
      v_hours := GREATEST(1, CEIL(EXTRACT(EPOCH FROM (v_end - v_start)) / 3600.0));
      v_total := v_total + v_hours * COALESCE(v_hour, 0) * p_units;
      v_line := jsonb_build_object(
        'kind', 'hourly',
        'startAt', v_elem->>'start_at',
        'endAt', v_elem->>'end_at',
        'billableHours', v_hours,
        'ratePerHour', COALESCE(v_hour, 0),
        'subtotal', ROUND(v_hours * COALESCE(v_hour, 0) * p_units, 2)
      );
    END IF;
    v_lines := v_lines || jsonb_build_array(v_line);
    v_peak := public.rental_peak_units_held_except(v_listing, v_start, v_end, p_now, p_request_id);
    IF v_peak + p_units > GREATEST(COALESCE(v_units_available, 1), 1) THEN
      RAISE EXCEPTION 'rental_request_unavailable' USING ERRCODE = 'check_violation';
    END IF;
  END LOOP;

  v_note := NULLIF(btrim(COALESCE(p_note, '')), '');
  v_next := v_req.edit_version + 1;
  v_total := ROUND(v_total, 2);
  -- Same or lower than the stored quote skips this block and saves with price_confirmed false.
  IF v_req.quoted_total IS NOT NULL AND v_total > ROUND(v_req.quoted_total, 2) THEN
    IF p_confirmed_amount IS NULL
       OR NULLIF(btrim(COALESCE(p_confirmed_currency, '')), '') IS NULL
       OR ROUND(p_confirmed_amount, 2) IS DISTINCT FROM v_total
       OR upper(btrim(p_confirmed_currency)) IS DISTINCT FROM upper(btrim(v_currency)) THEN
      RAISE EXCEPTION USING
        ERRCODE = 'check_violation',
        MESSAGE = 'rental_request_price_confirm_required ' || json_build_object(
          'total', v_total,
          'currency', v_currency,
          'previousTotal', ROUND(v_req.quoted_total, 2)
        )::text;
    END IF;
    v_price_confirmed := true;
  END IF;
  SELECT MAX((elem->>'end_at')::timestamptz) INTO v_end FROM jsonb_array_elements(p_windows) elem;
  SELECT MIN((elem->>'start_at')::timestamptz) INTO v_start FROM jsonb_array_elements(p_windows) elem;
  v_respond_by := p_now + interval '24 hours';
  -- respond_by is a real instant; cap it at the real instant of the wall-clock start.
  v_start_instant := public.rental_wall_to_instant(v_start, public.rental_booking_country(v_listing));
  IF v_start_instant IS NOT NULL AND v_start_instant < v_respond_by THEN
    v_respond_by := v_start_instant;
  END IF;
  v_snapshot := jsonb_build_object(
    'version', 4,
    'currency', v_currency,
    'total', v_total,
    'unitsBooked', p_units,
    'securityDeposit', ROUND(GREATEST(COALESCE(v_deposit, 0), 0) * p_units, 2),
    'lines', v_lines,
    'computedAt', to_char(timezone('UTC', p_now), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  );

  UPDATE public.rental_requests
     SET rental_selection_windows = p_windows,
         requested_start_at = v_start,
         requested_end_at = v_end,
         units_requested = p_units,
         client_request_note = v_note,
         quoted_total = v_total,
         rental_pricing_snapshot = v_snapshot,
         respond_by = v_respond_by,
         change_summary = p_change_summary,
         edit_version = v_next
   WHERE id = p_request_id
     AND status = 'pending'
     AND edit_version = p_expected_version;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'rental_request_stale_version' USING ERRCODE = 'serialization_failure';
  END IF;

  INSERT INTO public.rental_request_revisions (
    rental_request_id, version, rental_selection_windows, units_requested,
    client_request_note, quoted_total, changed_fields, previous_windows,
    previous_units, previous_note, previous_quoted_total, price_confirmed, edited_by_user_id
  ) VALUES (
    p_request_id, v_next, p_windows, p_units, v_note, v_total,
    COALESCE(p_change_summary->'fields', '[]'::jsonb),
    COALESCE(v_req.rental_selection_windows, '[]'::jsonb),
    GREATEST(COALESCE(v_req.units_requested, 1), 1),
    v_req.client_request_note,
    v_req.quoted_total,
    v_price_confirmed,
    p_actor
  )
  RETURNING * INTO v_row;
  RETURN NEXT v_row;
END;
$$;

-- Backfill. Pending requests whose respond_by was capped at the stored wall-clock
-- start move to the real start (still no later than created_at + 24 hours unless
-- the old value already was). Toronto deadlines move later; Douala / Manila move to
-- the moment the rental actually starts there.
UPDATE public.rental_requests AS request
   SET respond_by = LEAST(
         public.rental_wall_to_instant(
           request.requested_start_at,
           public.rental_booking_country(request.rental_location_listing_id)
         ),
         GREATEST(request.created_at + interval '24 hours', request.respond_by)
       )
 WHERE request.status::text = 'pending'
   AND request.requested_start_at IS NOT NULL
   AND request.respond_by = request.requested_start_at;

-- Open reserved bookings: reserved_cancel_after written as the wall-clock end of the
-- start day becomes the real instant. Nothing cancels from this column (the cron
-- rechecks the start day in Nest); it only drives the countdown.
UPDATE public.rental_bookings AS booking
   SET reserved_cancel_after = public.rental_wall_to_instant(
         booking.reserved_cancel_after,
         public.rental_booking_country(booking.rental_location_listing_id)
       )
 WHERE booking.status::text = 'reserved'
   AND booking.actual_start_at IS NULL
   AND booking.reserved_cancel_after IS NOT NULL
   AND booking.reserved_cancel_after = public.rental_end_of_start_day(
         booking.start_at,
         public.rental_booking_country(booking.rental_location_listing_id)
       );
