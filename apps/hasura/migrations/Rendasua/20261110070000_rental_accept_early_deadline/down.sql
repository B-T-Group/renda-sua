-- Restores the deadline applied by 20261110013000: now() + 60 minutes.

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

  UPDATE public.rental_bookings
     SET pickup_accepted_version_id = p_version_id,
         pickup_ack_current = true,
         pickup_inspection_pending = false,
         reserved_cancel_after = CASE
           WHEN status::text = 'reserved'
             THEN now() + interval '60 minutes'
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
