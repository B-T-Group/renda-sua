-- Handback end time = earliest of now, the renter's return report
-- (renter_reported_returned_at) and the renter's ack of the return report.
-- Same function otherwise (20261109120000_rental_condition_inspections).
CREATE OR REPLACE FUNCTION public.rental_record_handback(
  p_booking_id uuid,
  p_actor uuid,
  p_note text DEFAULT NULL
) RETURNS SETOF public.rental_bookings
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
  v_at timestamptz := now();
  v_reported timestamptz;
  v_end timestamptz;
  v_booking public.rental_bookings%ROWTYPE;
BEGIN
  SELECT MIN(a.created_at) INTO v_reported
    FROM public.rental_inspection_acks a
    JOIN public.rental_bookings b ON b.return_current_version_id = a.version_id
   WHERE b.id = p_booking_id
     AND a.persona = 'client'
     AND a.decision IN ('accept', 'dispute');
  -- Early return: the renter's "I've returned it" tap counts too, so a slow
  -- business check never turns an early return into overtime.
  SELECT LEAST(COALESCE(v_reported, v_at), COALESCE(b.renter_reported_returned_at, v_at))
    INTO v_reported
    FROM public.rental_bookings b
   WHERE b.id = p_booking_id;
  v_end := LEAST(v_at, COALESCE(v_reported, v_at));

  UPDATE public.rental_bookings b
     SET return_handed_back_at = v_at,
         actual_end_at = v_end,
         return_resolution = COALESCE(b.return_resolution, 'pending'),
         status = CASE
           WHEN b.status::text = 'active' THEN 'awaiting_return'::public.rental_booking_status_enum
           ELSE b.status
         END,
         updated_at = v_at
   WHERE b.id = p_booking_id
     AND b.inspection_policy_version IS NOT NULL
     AND b.return_handed_back_at IS NULL
     AND b.status::text IN ('active', 'awaiting_return')
     AND b.return_current_version_id IS NOT NULL
     AND (
       SELECT count(*) FROM public.rental_booking_units u
        WHERE u.rental_booking_id = b.id
     ) > 0
     AND NOT EXISTS (
       SELECT 1 FROM public.rental_booking_units u
        WHERE u.rental_booking_id = b.id
          AND NOT EXISTS (
            SELECT 1 FROM public.rental_inspection_items it
             WHERE it.version_id = b.return_current_version_id
               AND it.unit_id = u.id
          )
     )
  RETURNING * INTO v_booking;
  IF NOT FOUND THEN
    RETURN;
  END IF;
  INSERT INTO public.rental_custody_events (rental_booking_id, kind, server_at, actor_user_id, note)
  VALUES (p_booking_id, 'handback_verified', v_at, p_actor, NULLIF(btrim(p_note), ''));
  RETURN NEXT v_booking;
END;
$$;
