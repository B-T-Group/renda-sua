-- One client acknowledgement per inspection version. A second accept, dispute,
-- or accept-after-correction conflicts instead of raising a raw unique violation.

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
             THEN GREATEST(start_at + interval '60 minutes', now() + interval '60 minutes')
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

CREATE OR REPLACE FUNCTION public.rental_accept_return_version(
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
       JOIN public.rental_inspection_versions v ON v.id = p_version_id AND v.status = 'submitted'
      WHERE b.id = p_booking_id
        AND b.return_current_version_id = p_version_id
        AND b.return_resolution = 'pending'
        AND b.settlement_claimed_at IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM public.rental_inspection_acks a
           WHERE a.version_id = p_version_id AND a.persona = 'client'
        )
   );
  IF NOT FOUND THEN
    RAISE EXCEPTION 'rental_inspection_ack_conflict' USING ERRCODE = 'unique_violation';
  END IF;
  UPDATE public.rental_bookings
     SET return_resolution = 'accepted', updated_at = now()
   WHERE id = p_booking_id
     AND return_current_version_id = p_version_id
     AND return_resolution = 'pending'
     AND settlement_claimed_at IS NULL;
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

CREATE OR REPLACE FUNCTION public.rental_open_return_dispute(
  p_booking_id uuid,
  p_version_id uuid,
  p_actor uuid,
  p_reason text,
  p_review_hours integer
) RETURNS SETOF public.rental_inspection_disputes
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
  v_rows integer;
  v_dispute public.rental_inspection_disputes%ROWTYPE;
  v_hours integer := GREATEST(COALESCE(p_review_hours, 48), 1);
BEGIN
  IF p_reason IS NULL OR length(btrim(p_reason)) = 0 THEN
    RAISE EXCEPTION 'rental_inspection_dispute_reason' USING ERRCODE = 'check_violation';
  END IF;

  PERFORM 1 FROM public.rental_bookings WHERE id = p_booking_id FOR UPDATE;

  INSERT INTO public.rental_inspection_acks (version_id, actor_user_id, persona, decision, reason)
  SELECT p_version_id, p_actor, 'client', 'dispute', btrim(p_reason)
   WHERE EXISTS (
     SELECT 1
       FROM public.rental_bookings b
       JOIN public.rental_inspection_versions v ON v.id = p_version_id AND v.status = 'submitted'
      WHERE b.id = p_booking_id
        AND b.inspection_policy_version IS NOT NULL
        AND b.return_current_version_id = p_version_id
        AND b.return_resolution = 'pending'
        AND b.settlement_claimed_at IS NULL
        AND b.settlement_completed_at IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM public.rental_inspection_acks a
           WHERE a.version_id = p_version_id AND a.persona = 'client'
        )
   );
  IF NOT FOUND THEN
    RAISE EXCEPTION 'rental_inspection_ack_conflict' USING ERRCODE = 'unique_violation';
  END IF;

  UPDATE public.rental_bookings
     SET return_resolution = 'disputed', updated_at = now()
   WHERE id = p_booking_id
     AND return_current_version_id = p_version_id
     AND return_resolution = 'pending'
     AND settlement_claimed_at IS NULL
     AND settlement_completed_at IS NULL;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 1 THEN
    RAISE EXCEPTION 'rental_inspection_ack_conflict' USING ERRCODE = 'unique_violation';
  END IF;

  INSERT INTO public.rental_inspection_disputes (
    rental_booking_id, version_id, status, reason, opened_by_user_id, sla_due_at
  ) VALUES (
    p_booking_id, p_version_id, 'open', btrim(p_reason), p_actor, now() + make_interval(hours => v_hours)
  ) RETURNING * INTO v_dispute;
  UPDATE public.rental_inspection_media
     SET dispute_id = v_dispute.id, status = 'locked', locked_at = now()
   WHERE inspection_id IN (
     SELECT id FROM public.rental_inspections
      WHERE rental_booking_id = p_booking_id AND stage = 'return'
   )
     AND role = 'counter'
     AND created_by = p_actor
     AND status = 'ready'
     AND dispute_id IS NULL;
  RETURN NEXT v_dispute;
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'rental_inspection_ack_conflict' USING ERRCODE = 'unique_violation';
END;
$$;

CREATE OR REPLACE FUNCTION public.rental_request_correction(
  p_booking_id uuid,
  p_stage text,
  p_version_id uuid,
  p_actor uuid,
  p_reason text
) RETURNS SETOF public.rental_inspection_acks
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
  v_ack public.rental_inspection_acks%ROWTYPE;
BEGIN
  IF p_reason IS NULL OR length(btrim(p_reason)) = 0 THEN
    RAISE EXCEPTION 'rental_inspection_correction_reason' USING ERRCODE = 'check_violation';
  END IF;
  PERFORM 1 FROM public.rental_bookings WHERE id = p_booking_id FOR UPDATE;
  INSERT INTO public.rental_inspection_acks (version_id, actor_user_id, persona, decision, reason)
  SELECT p_version_id, p_actor, 'client', 'correction', btrim(p_reason)
   WHERE EXISTS (
     SELECT 1
       FROM public.rental_bookings b
       JOIN public.rental_inspections i
         ON i.rental_booking_id = b.id AND i.stage = p_stage
       JOIN public.rental_inspection_versions v
         ON v.id = p_version_id AND v.inspection_id = i.id AND v.status = 'submitted'
      WHERE b.id = p_booking_id
        AND b.inspection_policy_version IS NOT NULL
        AND (
          (p_stage = 'pickup' AND b.pickup_current_version_id = p_version_id AND b.actual_start_at IS NULL)
          OR (p_stage = 'return' AND b.return_current_version_id = p_version_id AND b.settlement_claimed_at IS NULL)
        )
        AND NOT EXISTS (
          SELECT 1 FROM public.rental_inspection_acks a
           WHERE a.version_id = p_version_id AND a.persona = 'client'
        )
   );
  IF NOT FOUND THEN
    RAISE EXCEPTION 'rental_inspection_ack_conflict' USING ERRCODE = 'unique_violation';
  END IF;
  UPDATE public.rental_inspections
     SET status = 'correction_requested', updated_at = now()
   WHERE rental_booking_id = p_booking_id AND stage = p_stage;
  SELECT * INTO v_ack
    FROM public.rental_inspection_acks
   WHERE version_id = p_version_id AND persona = 'client';
  RETURN NEXT v_ack;
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'rental_inspection_ack_conflict' USING ERRCODE = 'unique_violation';
END;
$$;
