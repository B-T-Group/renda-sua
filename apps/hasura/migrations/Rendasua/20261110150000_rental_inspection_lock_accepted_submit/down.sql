-- Restore rental_submit_inspection_with_claim from 20261110060000.

CREATE OR REPLACE FUNCTION public.rental_submit_inspection_with_claim(
  p_booking_id uuid,
  p_stage text,
  p_actor uuid,
  p_manifest_text text,
  p_manifest_sha256 text,
  p_min_photos integer,
  p_claimed_damage_amount numeric,
  p_set_claimed_damage boolean
) RETURNS SETOF public.rental_inspection_versions
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
  v_booking public.rental_bookings%ROWTYPE;
  v_inspection public.rental_inspections%ROWTYPE;
  v_version public.rental_inspection_versions%ROWTYPE;
  v_next integer;
  v_units integer;
  v_items integer;
  v_missing integer;
  v_hash text;
BEGIN
  IF p_stage NOT IN ('pickup', 'return') THEN
    RAISE EXCEPTION 'rental_inspection_stage' USING ERRCODE = 'check_violation';
  END IF;
  IF p_min_photos IS NULL OR p_min_photos < 3 THEN
    p_min_photos := 3;
  END IF;

  SELECT * INTO v_booking
    FROM public.rental_bookings
   WHERE id = p_booking_id
   FOR UPDATE;
  IF NOT FOUND OR v_booking.inspection_policy_version IS NULL THEN
    RAISE EXCEPTION 'rental_inspection_not_enrolled' USING ERRCODE = 'check_violation';
  END IF;

  IF p_stage = 'pickup' THEN
    IF v_booking.status::text NOT IN ('reserved', 'confirmed')
       OR v_booking.actual_start_at IS NOT NULL THEN
      RAISE EXCEPTION 'rental_inspection_stage_closed' USING ERRCODE = 'check_violation';
    END IF;
  ELSIF v_booking.status::text NOT IN ('active', 'awaiting_return')
        OR v_booking.settlement_claimed_at IS NOT NULL
        OR v_booking.return_resolution IN ('disputed', 'review', 'admin_cleared') THEN
    RAISE EXCEPTION 'rental_inspection_return_locked' USING ERRCODE = 'check_violation';
  END IF;

  SELECT * INTO v_inspection
    FROM public.rental_inspections
   WHERE rental_booking_id = p_booking_id AND stage = p_stage
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'rental_inspection_draft_missing' USING ERRCODE = 'check_violation';
  END IF;

  SELECT count(*) INTO v_units
    FROM public.rental_booking_units
   WHERE rental_booking_id = p_booking_id;
  IF v_units < 1 OR v_units <> v_booking.units_booked THEN
    RAISE EXCEPTION 'rental_inspection_units' USING ERRCODE = 'check_violation';
  END IF;

  SELECT count(*) INTO v_items
    FROM public.rental_inspection_items it
    JOIN public.rental_booking_units u ON u.id = it.unit_id
   WHERE it.inspection_id = v_inspection.id
     AND it.version_id IS NULL
     AND u.rental_booking_id = p_booking_id;
  IF v_items <> v_units THEN
    RAISE EXCEPTION 'rental_inspection_items_incomplete' USING ERRCODE = 'check_violation';
  END IF;

  SELECT count(*) INTO v_missing
    FROM public.rental_booking_units u
   WHERE u.rental_booking_id = p_booking_id
     AND (
       (SELECT count(*) FROM public.rental_inspection_media m
         WHERE m.inspection_id = v_inspection.id
           AND m.unit_id = u.id
           AND m.version_id IS NULL
           AND m.status = 'ready'
           AND m.role <> 'counter') < p_min_photos
       OR NOT EXISTS (
         SELECT 1 FROM public.rental_inspection_media m
          WHERE m.inspection_id = v_inspection.id AND m.unit_id = u.id
            AND m.version_id IS NULL AND m.status = 'ready' AND m.role = 'overview')
       OR NOT EXISTS (
         SELECT 1 FROM public.rental_inspection_media m
          WHERE m.inspection_id = v_inspection.id AND m.unit_id = u.id
            AND m.version_id IS NULL AND m.status = 'ready' AND m.role = 'other_side')
       OR NOT EXISTS (
         SELECT 1 FROM public.rental_inspection_media m
          WHERE m.inspection_id = v_inspection.id AND m.unit_id = u.id
            AND m.version_id IS NULL AND m.status = 'ready' AND m.role = 'accessories')
     );
  IF v_missing > 0 THEN
    RAISE EXCEPTION 'rental_inspection_photos' USING ERRCODE = 'check_violation';
  END IF;

  v_hash := encode(sha256(convert_to(p_manifest_text, 'UTF8')), 'hex');
  IF v_hash IS DISTINCT FROM p_manifest_sha256 THEN
    RAISE EXCEPTION 'rental_inspection_manifest' USING ERRCODE = 'check_violation';
  END IF;

  -- Hold pending and ready rows so a finalize cannot land between this check and the lock.
  PERFORM m.id
    FROM public.rental_inspection_media m
   WHERE m.inspection_id = v_inspection.id
     AND m.version_id IS NULL
     AND m.status IN ('pending', 'ready')
   FOR UPDATE;
  IF EXISTS (
    SELECT m.id
      FROM public.rental_inspection_media m
     WHERE m.inspection_id = v_inspection.id
       AND m.version_id IS NULL
       AND m.status = 'ready'
       AND m.role <> 'counter'
    EXCEPT
    SELECT (photo->>'id')::uuid
      FROM jsonb_array_elements(p_manifest_text::jsonb -> 'units') unit
      CROSS JOIN LATERAL jsonb_array_elements(COALESCE(unit -> 'photos', '[]'::jsonb)) photo
  ) OR EXISTS (
    SELECT (photo->>'id')::uuid
      FROM jsonb_array_elements(p_manifest_text::jsonb -> 'units') unit
      CROSS JOIN LATERAL jsonb_array_elements(COALESCE(unit -> 'photos', '[]'::jsonb)) photo
    EXCEPT
    SELECT m.id
      FROM public.rental_inspection_media m
     WHERE m.inspection_id = v_inspection.id
       AND m.version_id IS NULL
       AND m.status = 'ready'
       AND m.role <> 'counter'
  ) THEN
    RAISE EXCEPTION 'rental_inspection_manifest_stale' USING ERRCODE = 'check_violation';
  END IF;

  -- Reject a damaged return with no positive claim before any version row exists.
  IF p_set_claimed_damage AND p_stage = 'return' AND EXISTS (
    SELECT 1
      FROM public.rental_inspection_items it
     WHERE it.inspection_id = v_inspection.id
       AND it.version_id IS NULL
       AND it.condition = 'damaged'
  ) AND (p_claimed_damage_amount IS NULL OR p_claimed_damage_amount <= 0) THEN
    RAISE EXCEPTION 'rental_inspection_damage_amount' USING ERRCODE = 'check_violation';
  END IF;

  SELECT COALESCE(max(version_no), 0) + 1 INTO v_next
    FROM public.rental_inspection_versions
   WHERE inspection_id = v_inspection.id;

  UPDATE public.rental_inspection_versions
     SET status = 'superseded'
   WHERE inspection_id = v_inspection.id AND status = 'submitted';

  INSERT INTO public.rental_inspection_versions (
    inspection_id, version_no, status, allocation_version,
    manifest, manifest_text, manifest_sha256, submitted_by
  ) VALUES (
    v_inspection.id, v_next, 'submitted', v_booking.allocation_version,
    p_manifest_text::jsonb, p_manifest_text, p_manifest_sha256, p_actor
  ) RETURNING * INTO v_version;

  UPDATE public.rental_inspection_items
     SET version_id = v_version.id
   WHERE inspection_id = v_inspection.id AND version_id IS NULL;

  UPDATE public.rental_inspection_media
     SET version_id = v_version.id, status = 'locked', locked_at = now()
   WHERE inspection_id = v_inspection.id
     AND version_id IS NULL
     AND status = 'ready'
     AND role <> 'counter';

  UPDATE public.rental_inspections
     SET status = 'submitted',
         allocation_version = v_booking.allocation_version,
         updated_at = now()
   WHERE id = v_inspection.id;

  IF p_stage = 'pickup' THEN
    UPDATE public.rental_bookings
       SET pickup_current_version_id = v_version.id,
           pickup_accepted_version_id = NULL,
           pickup_ack_current = false,
           pickup_inspection_pending = (status::text = 'reserved'),
           updated_at = now()
     WHERE id = p_booking_id;
  ELSE
    UPDATE public.rental_bookings
       SET return_current_version_id = v_version.id,
           return_resolution = CASE
             WHEN return_resolution IS NULL OR return_resolution = 'accepted' THEN 'pending'
             ELSE return_resolution
           END,
           claimed_damage_amount = CASE
             WHEN p_set_claimed_damage THEN p_claimed_damage_amount
             ELSE claimed_damage_amount
           END,
           updated_at = now()
     WHERE id = p_booking_id
       AND settlement_claimed_at IS NULL;
  END IF;

  RETURN NEXT v_version;
END;
$$;


-- The previous six-argument function stays for a backend that still writes the claim
-- after the call. It does not change claimed_damage_amount.
CREATE OR REPLACE FUNCTION public.rental_submit_inspection(
  p_booking_id uuid,
  p_stage text,
  p_actor uuid,
  p_manifest_text text,
  p_manifest_sha256 text,
  p_min_photos integer
) RETURNS SETOF public.rental_inspection_versions
LANGUAGE sql
VOLATILE
AS $$
  SELECT * FROM public.rental_submit_inspection_with_claim(
    p_booking_id,
    p_stage,
    p_actor,
    p_manifest_text,
    p_manifest_sha256,
    p_min_photos,
    NULL,
    false
  );
$$;
