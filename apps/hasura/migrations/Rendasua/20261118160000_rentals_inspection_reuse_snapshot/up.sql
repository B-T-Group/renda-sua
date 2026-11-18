-- Reuse copies and the request-time inspection snapshot.
-- captured_at stays the server receive time. EXIF is extra and is not the shown date.

ALTER TABLE public.rental_inspection_media
  ADD COLUMN IF NOT EXISTS exif_captured_at timestamptz;

ALTER TABLE public.rental_item_baseline_photos
  ADD COLUMN IF NOT EXISTS exif_captured_at timestamptz;

COMMENT ON COLUMN public.rental_inspection_media.captured_at IS
  'Server clock when the upload was received. This is the date shown to the renter. Never a client timestamp.';

COMMENT ON COLUMN public.rental_inspection_media.exif_captured_at IS
  'Optional camera time, clamped to a sane window. Not the date shown to the renter.';

COMMENT ON COLUMN public.rental_item_baseline_photos.exif_captured_at IS
  'Optional camera time, clamped to a sane window. Not the date shown to the renter.';

ALTER TABLE public.rental_requests
  ADD COLUMN IF NOT EXISTS inspection_policy_version integer;

COMMENT ON COLUMN public.rental_requests.inspection_policy_version IS
  'Inspection decision snapshotted when the renter created the request. Later opt-in changes do not rewrite it.';

ALTER TABLE public.rental_inspection_media
  DROP CONSTRAINT IF EXISTS rental_inspection_media_derivative_check;

ALTER TABLE public.rental_inspection_media
  ADD CONSTRAINT rental_inspection_media_derivative_check CHECK (
    derivative_key IS NULL
    OR derivative_key ~ '^(dev|prod)/rental-inspection/[0-9a-f-]{36}/[0-9a-f-]{36}\.view\.(jpg|png|webp)$'
  );

CREATE OR REPLACE FUNCTION public.rental_apply_pickup_reuse(p_booking_id uuid, p_copies jsonb)
RETURNS SETOF integer
LANGUAGE plpgsql
AS $function$
DECLARE
  v_listing uuid;
  v_inspection uuid;
  v_copy jsonb;
  v_slot integer;
  v_version uuid;
  v_latest uuid;
  v_dirty boolean;
  v_count integer := 0;
BEGIN
  IF p_copies IS NULL OR jsonb_typeof(p_copies) <> 'array' OR jsonb_array_length(p_copies) = 0 THEN
    RAISE EXCEPTION 'PICKUP_REUSE_UNAVAILABLE';
  END IF;

  SELECT rental_location_listing_id INTO v_listing
  FROM public.rental_bookings
  WHERE id = p_booking_id
  FOR UPDATE;

  IF v_listing IS NULL THEN
    RAISE EXCEPTION 'PICKUP_REUSE_UNAVAILABLE';
  END IF;

  PERFORM 1
  FROM public.rental_bookings b
  WHERE b.rental_location_listing_id = v_listing
  ORDER BY b.id
  FOR UPDATE;

  PERFORM v.id
  FROM public.rental_inspection_versions v
  JOIN public.rental_inspections i ON i.id = v.inspection_id
  JOIN public.rental_bookings b ON b.id = i.rental_booking_id
  WHERE b.rental_location_listing_id = v_listing
    AND i.stage = 'return'
    AND v.status = 'submitted'
  FOR UPDATE OF v;

  SELECT EXISTS (
    SELECT 1
    FROM (
      SELECT DISTINCT ON (u.slot_index)
        b.id AS source_booking_id,
        b.return_resolution,
        b.claimed_damage_amount,
        it.condition
      FROM public.rental_inspection_versions v
      JOIN public.rental_inspections i ON i.id = v.inspection_id
      JOIN public.rental_bookings b ON b.id = i.rental_booking_id
      JOIN public.rental_inspection_items it ON it.version_id = v.id
      JOIN public.rental_booking_units u ON u.id = it.unit_id
      WHERE b.rental_location_listing_id = v_listing
        AND b.id <> p_booking_id
        AND i.stage = 'return'
        AND v.status = 'submitted'
      ORDER BY u.slot_index, v.submitted_at DESC
    ) latest
    WHERE latest.return_resolution IS DISTINCT FROM 'accepted'
       OR COALESCE(latest.claimed_damage_amount, 0) > 0
       OR latest.condition = 'damaged'
       OR EXISTS (
         SELECT 1 FROM public.rental_inspection_disputes d
         WHERE d.rental_booking_id = latest.source_booking_id
           AND d.decision = 'damage_upheld'
       )
  ) INTO v_dirty;

  IF v_dirty THEN
    RAISE EXCEPTION 'PICKUP_REUSE_BLOCKED_DAMAGE';
  END IF;

  SELECT i.id INTO v_inspection
  FROM public.rental_inspections i
  WHERE i.rental_booking_id = p_booking_id
    AND i.stage = 'pickup';

  IF v_inspection IS NULL THEN
    RAISE EXCEPTION 'PICKUP_REUSE_UNAVAILABLE';
  END IF;

  FOR v_copy IN SELECT value FROM jsonb_array_elements(p_copies)
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.rental_booking_units u
      WHERE u.id = (v_copy->>'unitId')::uuid
        AND u.rental_booking_id = p_booking_id
    ) THEN
      RAISE EXCEPTION 'PICKUP_REUSE_UNAVAILABLE';
    END IF;

    v_slot := (v_copy->>'slotIndex')::integer;
    v_version := NULLIF(v_copy->>'sourceVersionId', '')::uuid;
    IF v_version IS NULL THEN
      IF EXISTS (
        SELECT 1
        FROM public.rental_inspection_versions v
        JOIN public.rental_inspections i ON i.id = v.inspection_id
        JOIN public.rental_bookings b ON b.id = i.rental_booking_id
        WHERE b.rental_location_listing_id = v_listing
          AND b.id <> p_booking_id
          AND i.stage = 'return'
          AND v.status = 'submitted'
      ) THEN
        RAISE EXCEPTION 'PICKUP_REUSE_CHANGED';
      END IF;
    ELSE
      SELECT latest.version_id INTO v_latest
      FROM (
        SELECT DISTINCT ON (u.slot_index)
          v.id AS version_id,
          u.slot_index
        FROM public.rental_inspection_versions v
        JOIN public.rental_inspections i ON i.id = v.inspection_id
        JOIN public.rental_bookings b ON b.id = i.rental_booking_id
        JOIN public.rental_inspection_items it ON it.version_id = v.id
        JOIN public.rental_booking_units u ON u.id = it.unit_id
        WHERE b.rental_location_listing_id = v_listing
          AND b.id <> p_booking_id
          AND i.stage = 'return'
          AND v.status = 'submitted'
        ORDER BY u.slot_index, v.submitted_at DESC
      ) latest
      WHERE latest.slot_index = v_slot;
      IF v_latest IS DISTINCT FROM v_version THEN
        RAISE EXCEPTION 'PICKUP_REUSE_CHANGED';
      END IF;
    END IF;
  END LOOP;

  DELETE FROM public.rental_inspection_media m
  WHERE m.inspection_id = v_inspection
    AND m.reused = true
    AND m.version_id IS NULL;

  INSERT INTO public.rental_inspection_media (
    inspection_id, unit_id, role, slot_key, object_key, derivative_key,
    content_type, byte_size, sha256, status, reused, reused_from_media_id,
    captured_at, captured_at_source, capture_source
  )
  SELECT
    v_inspection,
    (copy->>'unitId')::uuid,
    copy->>'role',
    copy->>'slotKey',
    copy->>'objectKey',
    copy->>'derivativeKey',
    copy->>'contentType',
    (copy->>'byteSize')::integer,
    copy->>'sha256',
    'ready',
    true,
    NULLIF(copy->>'sourceMediaId', '')::uuid,
    (copy->>'captured_at')::timestamptz,
    copy->>'captured_at_source',
    copy->>'capture_source'
  FROM jsonb_array_elements(p_copies) AS copy;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count < 1 THEN
    RAISE EXCEPTION 'PICKUP_REUSE_UNAVAILABLE';
  END IF;
  RETURN QUERY SELECT v_count;
END;
$function$;

COMMENT ON FUNCTION public.rental_apply_pickup_reuse(uuid, jsonb) IS
  'Locks the listing bookings, rechecks the latest return per unit, deletes prior reused draft photos, and inserts the copies.';
