-- Rental condition inspections (Phase A).
-- inspection_policy_version NULL = legacy booking. The flag only stamps new rows.
-- Submitted versions, locked media, acknowledgments, and custody events are immutable.
-- Down migration drops the tables, functions, and columns.

ALTER TABLE public.rental_bookings
  ADD COLUMN IF NOT EXISTS inspection_policy_version integer,
  ADD COLUMN IF NOT EXISTS allocation_version integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pickup_current_version_id uuid,
  ADD COLUMN IF NOT EXISTS pickup_accepted_version_id uuid,
  ADD COLUMN IF NOT EXISTS pickup_ack_current boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pickup_inspection_pending boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reserved_cancel_after timestamptz,
  ADD COLUMN IF NOT EXISTS return_current_version_id uuid,
  ADD COLUMN IF NOT EXISTS return_handed_back_at timestamptz,
  ADD COLUMN IF NOT EXISTS return_resolution text,
  ADD COLUMN IF NOT EXISTS return_reminder_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS settlement_claimed_at timestamptz,
  ADD COLUMN IF NOT EXISTS settlement_completed_at timestamptz;

DO $$ BEGIN
  ALTER TABLE public.rental_bookings
    ADD CONSTRAINT rental_bookings_inspection_policy_check
    CHECK (inspection_policy_version IS NULL OR inspection_policy_version >= 1);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.rental_bookings
    ADD CONSTRAINT rental_bookings_return_resolution_check
    CHECK (
      return_resolution IS NULL
      OR return_resolution IN ('pending', 'accepted', 'disputed', 'review', 'admin_cleared')
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

COMMENT ON COLUMN public.rental_bookings.inspection_policy_version IS
  'NULL = legacy rental with no inspection gate. Stamped when the booking is proposed while rental_inspection_enabled is on for the listing country. Turning the flag off does not clear it.';
COMMENT ON COLUMN public.rental_bookings.pickup_ack_current IS
  'True only when the client has accepted the current pickup version. Cleared when a new version or allocation is submitted. Start requires this for enrolled bookings.';
COMMENT ON COLUMN public.rental_bookings.return_handed_back_at IS
  'Server time of physical handback. Independent of dispute and settlement.';
COMMENT ON COLUMN public.rental_bookings.settlement_claimed_at IS
  'Compare-and-set lease so an enrolled rental settles at most once, and not while a dispute or pending acknowledgment is open.';

CREATE TABLE IF NOT EXISTS public.rental_booking_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rental_booking_id uuid NOT NULL REFERENCES public.rental_bookings(id) ON DELETE CASCADE,
  slot_index integer NOT NULL CHECK (slot_index >= 1),
  display_label text NOT NULL,
  physical_label text,
  allocation_version integer NOT NULL CHECK (allocation_version >= 1),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (rental_booking_id, slot_index)
);

COMMENT ON TABLE public.rental_booking_units IS
  'Booking-scoped slots (Unit A/B/C). Not a persistent inventory. Labels are snapshotted into each submitted inspection version.';

CREATE TABLE IF NOT EXISTS public.rental_inspections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rental_booking_id uuid NOT NULL REFERENCES public.rental_bookings(id) ON DELETE CASCADE,
  stage text NOT NULL CHECK (stage IN ('pickup', 'return')),
  status text NOT NULL CHECK (status IN ('draft', 'submitted', 'correction_requested')),
  allocation_version integer NOT NULL CHECK (allocation_version >= 1),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (rental_booking_id, stage)
);

CREATE TABLE IF NOT EXISTS public.rental_inspection_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id uuid NOT NULL REFERENCES public.rental_inspections(id) ON DELETE RESTRICT,
  version_no integer NOT NULL CHECK (version_no >= 1),
  status text NOT NULL CHECK (status IN ('submitted', 'superseded')),
  allocation_version integer NOT NULL CHECK (allocation_version >= 1),
  manifest jsonb NOT NULL,
  manifest_sha256 text NOT NULL,
  submitted_by uuid,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (inspection_id, version_no)
);

COMMENT ON TABLE public.rental_inspection_versions IS
  'Immutable submitted condition reports. version_no is business/admin only and is not returned to clients.';

CREATE TABLE IF NOT EXISTS public.rental_inspection_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id uuid NOT NULL REFERENCES public.rental_inspections(id) ON DELETE CASCADE,
  version_id uuid REFERENCES public.rental_inspection_versions(id) ON DELETE RESTRICT,
  unit_id uuid NOT NULL REFERENCES public.rental_booking_units(id) ON DELETE RESTRICT,
  condition text NOT NULL CHECK (condition IN ('good', 'fair', 'damaged')),
  accessories jsonb NOT NULL DEFAULT '[]'::jsonb,
  wear text NOT NULL,
  checklist_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rental_inspection_items_wear_check CHECK (length(btrim(wear)) > 0),
  CONSTRAINT rental_inspection_items_accessories_check CHECK (jsonb_typeof(accessories) = 'array')
);

CREATE UNIQUE INDEX IF NOT EXISTS rental_inspection_items_draft_uidx
  ON public.rental_inspection_items (inspection_id, unit_id)
  WHERE version_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS rental_inspection_items_version_uidx
  ON public.rental_inspection_items (version_id, unit_id)
  WHERE version_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.rental_inspection_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id uuid NOT NULL REFERENCES public.rental_inspections(id) ON DELETE RESTRICT,
  version_id uuid REFERENCES public.rental_inspection_versions(id) ON DELETE RESTRICT,
  unit_id uuid NOT NULL REFERENCES public.rental_booking_units(id) ON DELETE RESTRICT,
  dispute_id uuid,
  role text NOT NULL CHECK (role IN ('overview', 'other_side', 'accessories', 'wear', 'counter')),
  object_key text NOT NULL,
  derivative_key text,
  s3_version_id text,
  sha256 text,
  content_type text,
  byte_size integer,
  expected_byte_size integer,
  status text NOT NULL CHECK (status IN ('pending', 'ready', 'locked')),
  locked_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rental_inspection_media_key_check CHECK (
    object_key ~ '^(dev|prod)/rental-inspection/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$'
  ),
  CONSTRAINT rental_inspection_media_derivative_check CHECK (
    derivative_key IS NULL
    OR derivative_key ~ '^(dev|prod)/rental-inspection/[0-9a-f-]{36}/[0-9a-f-]{36}\.view\.jpg$'
  ),
  UNIQUE (object_key)
);

COMMENT ON TABLE public.rental_inspection_media IS
  'Private proof in rendasua-user-uploads. Objects are never deleted by the app. Clients receive a short-lived presigned GET of the EXIF-stripped derivative.';

CREATE TABLE IF NOT EXISTS public.rental_inspection_acks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id uuid NOT NULL REFERENCES public.rental_inspection_versions(id) ON DELETE RESTRICT,
  actor_user_id uuid NOT NULL,
  persona text NOT NULL CHECK (persona IN ('client', 'business')),
  decision text NOT NULL CHECK (decision IN ('accept', 'correction', 'dispute')),
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (version_id, persona),
  CONSTRAINT rental_inspection_acks_reason_check CHECK (
    decision = 'accept' OR (reason IS NOT NULL AND length(btrim(reason)) > 0)
  )
);

CREATE TABLE IF NOT EXISTS public.rental_custody_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rental_booking_id uuid NOT NULL REFERENCES public.rental_bookings(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('handback_verified')),
  server_at timestamptz NOT NULL DEFAULT now(),
  actor_user_id uuid,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.rental_inspection_disputes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rental_booking_id uuid NOT NULL REFERENCES public.rental_bookings(id) ON DELETE CASCADE,
  version_id uuid REFERENCES public.rental_inspection_versions(id) ON DELETE RESTRICT,
  status text NOT NULL CHECK (status IN ('open', 'escalated', 'decided')),
  reason text NOT NULL CHECK (length(btrim(reason)) > 0),
  opened_by_user_id uuid,
  opened_at timestamptz NOT NULL DEFAULT now(),
  sla_due_at timestamptz NOT NULL,
  escalated_at timestamptz,
  decision text CHECK (
    decision IS NULL OR decision IN ('no_damage', 'damage_upheld', 'damage_rejected')
  ),
  decision_reason text,
  damage_amount numeric,
  damage_collected boolean NOT NULL DEFAULT false,
  decided_by_user_id uuid,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rental_inspection_disputes_decision_reason_check CHECK (
    status <> 'decided' OR (decision_reason IS NOT NULL AND length(btrim(decision_reason)) > 0)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS rental_inspection_disputes_one_open
  ON public.rental_inspection_disputes (rental_booking_id)
  WHERE status IN ('open', 'escalated');

CREATE INDEX IF NOT EXISTS rental_inspection_disputes_queue_idx
  ON public.rental_inspection_disputes (status, sla_due_at);

CREATE INDEX IF NOT EXISTS rental_bookings_inspection_settlement_idx
  ON public.rental_bookings (return_resolution, settlement_completed_at)
  WHERE inspection_policy_version IS NOT NULL;

DO $$ BEGIN
  ALTER TABLE public.rental_bookings
    ADD CONSTRAINT rental_bookings_pickup_current_version_fkey
    FOREIGN KEY (pickup_current_version_id) REFERENCES public.rental_inspection_versions(id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.rental_bookings
    ADD CONSTRAINT rental_bookings_pickup_accepted_version_fkey
    FOREIGN KEY (pickup_accepted_version_id) REFERENCES public.rental_inspection_versions(id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.rental_bookings
    ADD CONSTRAINT rental_bookings_return_current_version_fkey
    FOREIGN KEY (return_current_version_id) REFERENCES public.rental_inspection_versions(id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.rental_inspection_media
    ADD CONSTRAINT rental_inspection_media_dispute_fkey
    FOREIGN KEY (dispute_id) REFERENCES public.rental_inspection_disputes(id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE OR REPLACE FUNCTION public.rental_inspection_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_TABLE_NAME = 'rental_inspection_versions' THEN
    IF TG_OP = 'DELETE' THEN
      RAISE EXCEPTION 'rental_inspection_version_immutable' USING ERRCODE = 'check_violation';
    END IF;
    IF OLD.status = 'submitted'
       AND NEW.status = 'superseded'
       AND NEW.inspection_id = OLD.inspection_id
       AND NEW.version_no = OLD.version_no
       AND NEW.allocation_version = OLD.allocation_version
       AND NEW.manifest = OLD.manifest
       AND NEW.manifest_sha256 = OLD.manifest_sha256
       AND NEW.submitted_by IS NOT DISTINCT FROM OLD.submitted_by
       AND NEW.submitted_at = OLD.submitted_at
    THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'rental_inspection_version_immutable' USING ERRCODE = 'check_violation';
  ELSIF TG_TABLE_NAME = 'rental_inspection_items' THEN
    IF TG_OP = 'DELETE' OR OLD.version_id IS NOT NULL THEN
      RAISE EXCEPTION 'rental_inspection_item_immutable' USING ERRCODE = 'check_violation';
    END IF;
  ELSIF TG_TABLE_NAME = 'rental_inspection_media' THEN
    IF TG_OP = 'DELETE' OR OLD.status = 'locked' OR NEW.object_key IS DISTINCT FROM OLD.object_key THEN
      RAISE EXCEPTION 'rental_inspection_media_immutable' USING ERRCODE = 'check_violation';
    END IF;
  ELSIF TG_TABLE_NAME = 'rental_inspection_acks' THEN
    RAISE EXCEPTION 'rental_inspection_ack_immutable' USING ERRCODE = 'check_violation';
  ELSIF TG_TABLE_NAME = 'rental_custody_events' THEN
    RAISE EXCEPTION 'rental_custody_event_immutable' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS rental_inspection_versions_guard ON public.rental_inspection_versions;
CREATE TRIGGER rental_inspection_versions_guard
  BEFORE UPDATE OR DELETE ON public.rental_inspection_versions
  FOR EACH ROW EXECUTE FUNCTION public.rental_inspection_guard();

DROP TRIGGER IF EXISTS rental_inspection_items_guard ON public.rental_inspection_items;
CREATE TRIGGER rental_inspection_items_guard
  BEFORE UPDATE OR DELETE ON public.rental_inspection_items
  FOR EACH ROW EXECUTE FUNCTION public.rental_inspection_guard();

DROP TRIGGER IF EXISTS rental_inspection_media_guard ON public.rental_inspection_media;
CREATE TRIGGER rental_inspection_media_guard
  BEFORE UPDATE OR DELETE ON public.rental_inspection_media
  FOR EACH ROW EXECUTE FUNCTION public.rental_inspection_guard();

DROP TRIGGER IF EXISTS rental_inspection_acks_guard ON public.rental_inspection_acks;
CREATE TRIGGER rental_inspection_acks_guard
  BEFORE UPDATE OR DELETE ON public.rental_inspection_acks
  FOR EACH ROW EXECUTE FUNCTION public.rental_inspection_guard();

DROP TRIGGER IF EXISTS rental_custody_events_guard ON public.rental_custody_events;
CREATE TRIGGER rental_custody_events_guard
  BEFORE UPDATE OR DELETE ON public.rental_custody_events
  FOR EACH ROW EXECUTE FUNCTION public.rental_inspection_guard();

-- Start wins only when the client has accepted the version that is still current.
CREATE OR REPLACE FUNCTION public.rental_mark_started(p_booking_id uuid, p_at timestamptz)
RETURNS SETOF public.rental_bookings
LANGUAGE sql
VOLATILE
AS $$
  UPDATE public.rental_bookings
     SET status = 'active',
         actual_start_at = p_at,
         updated_at = now()
   WHERE id = p_booking_id
     AND status = 'confirmed'
     AND (
       inspection_policy_version IS NULL
       OR (
         pickup_ack_current = true
         AND pickup_accepted_version_id IS NOT NULL
         AND pickup_accepted_version_id IS NOT DISTINCT FROM pickup_current_version_id
       )
     )
  RETURNING *;
$$;

CREATE OR REPLACE FUNCTION public.rental_submit_inspection(
  p_booking_id uuid,
  p_stage text,
  p_actor uuid,
  p_manifest_text text,
  p_manifest_sha256 text,
  p_min_photos integer
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

  SELECT COALESCE(max(version_no), 0) + 1 INTO v_next
    FROM public.rental_inspection_versions
   WHERE inspection_id = v_inspection.id;

  UPDATE public.rental_inspection_versions
     SET status = 'superseded'
   WHERE inspection_id = v_inspection.id AND status = 'submitted';

  INSERT INTO public.rental_inspection_versions (
    inspection_id, version_no, status, allocation_version,
    manifest, manifest_sha256, submitted_by
  ) VALUES (
    v_inspection.id, v_next, 'submitted', v_booking.allocation_version,
    p_manifest_text::jsonb, p_manifest_sha256, p_actor
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
           updated_at = now()
     WHERE id = p_booking_id
       AND settlement_claimed_at IS NULL;
  END IF;

  RETURN NEXT v_version;
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
BEGIN
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
   );
  IF NOT FOUND THEN
    RETURN;
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
    RAISE EXCEPTION 'pickup_accept_conflict' USING ERRCODE = 'check_violation';
  END IF;
  RETURN QUERY SELECT * FROM public.rental_bookings WHERE id = p_booking_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.rental_record_handback(
  p_booking_id uuid,
  p_actor uuid
) RETURNS SETOF public.rental_bookings
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
  v_at timestamptz := now();
  v_booking public.rental_bookings%ROWTYPE;
BEGIN
  UPDATE public.rental_bookings b
     SET return_handed_back_at = v_at,
         actual_end_at = v_at,
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
  INSERT INTO public.rental_custody_events (rental_booking_id, kind, server_at, actor_user_id)
  VALUES (p_booking_id, 'handback_verified', v_at, p_actor);
  RETURN NEXT v_booking;
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
   );
  IF NOT FOUND THEN
    RETURN;
  END IF;
  UPDATE public.rental_bookings
     SET return_resolution = 'accepted', updated_at = now()
   WHERE id = p_booking_id
     AND return_current_version_id = p_version_id
     AND return_resolution = 'pending'
     AND settlement_claimed_at IS NULL;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 1 THEN
    RAISE EXCEPTION 'return_accept_conflict' USING ERRCODE = 'check_violation';
  END IF;
  RETURN QUERY SELECT * FROM public.rental_bookings WHERE id = p_booking_id;
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
  UPDATE public.rental_bookings
     SET return_resolution = 'disputed', updated_at = now()
   WHERE id = p_booking_id
     AND inspection_policy_version IS NOT NULL
     AND return_current_version_id = p_version_id
     AND return_resolution = 'pending'
     AND settlement_claimed_at IS NULL
     AND settlement_completed_at IS NULL;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 1 THEN
    RETURN;
  END IF;
  INSERT INTO public.rental_inspection_acks (version_id, actor_user_id, persona, decision, reason)
  VALUES (p_version_id, p_actor, 'client', 'dispute', btrim(p_reason));
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
END;
$$;

CREATE OR REPLACE FUNCTION public.rental_escalate_return_review(
  p_booking_id uuid,
  p_review_hours integer
) RETURNS SETOF public.rental_inspection_disputes
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
  v_booking public.rental_bookings%ROWTYPE;
  v_dispute public.rental_inspection_disputes%ROWTYPE;
  v_hours integer := GREATEST(COALESCE(p_review_hours, 48), 1);
BEGIN
  UPDATE public.rental_bookings
     SET return_resolution = 'review', updated_at = now()
   WHERE id = p_booking_id
     AND inspection_policy_version IS NOT NULL
     AND return_resolution = 'pending'
     AND return_handed_back_at IS NOT NULL
     AND settlement_claimed_at IS NULL
     AND settlement_completed_at IS NULL
  RETURNING * INTO v_booking;
  IF NOT FOUND THEN
    RETURN;
  END IF;
  INSERT INTO public.rental_inspection_disputes (
    rental_booking_id, version_id, status, reason, sla_due_at, escalated_at
  ) VALUES (
    p_booking_id,
    v_booking.return_current_version_id,
    'escalated',
    'No response before the review deadline. This is not an acceptance.',
    v_booking.return_handed_back_at + make_interval(hours => v_hours),
    now()
  ) RETURNING * INTO v_dispute;
  RETURN NEXT v_dispute;
END;
$$;

CREATE OR REPLACE FUNCTION public.rental_apply_inspection_decision(
  p_booking_id uuid,
  p_actor uuid,
  p_outcome text,
  p_reason text,
  p_damage numeric
) RETURNS SETOF public.rental_inspection_disputes
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
  v_rows integer;
  v_dispute public.rental_inspection_disputes%ROWTYPE;
BEGIN
  IF p_outcome NOT IN ('no_damage', 'damage_upheld', 'damage_rejected') THEN
    RAISE EXCEPTION 'rental_inspection_decision' USING ERRCODE = 'check_violation';
  END IF;
  IF p_reason IS NULL OR length(btrim(p_reason)) = 0 THEN
    RAISE EXCEPTION 'rental_inspection_decision_reason' USING ERRCODE = 'check_violation';
  END IF;
  IF p_outcome = 'damage_upheld' AND (p_damage IS NULL OR p_damage <= 0) THEN
    RAISE EXCEPTION 'rental_inspection_damage_amount' USING ERRCODE = 'check_violation';
  END IF;

  UPDATE public.rental_bookings
     SET return_resolution = 'admin_cleared', updated_at = now()
   WHERE id = p_booking_id
     AND inspection_policy_version IS NOT NULL
     AND return_resolution IN ('disputed', 'review')
     AND return_handed_back_at IS NOT NULL
     AND settlement_claimed_at IS NULL
     AND settlement_completed_at IS NULL;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 1 THEN
    RETURN;
  END IF;

  UPDATE public.rental_inspection_disputes
     SET status = 'decided',
         decision = p_outcome,
         decision_reason = btrim(p_reason),
         damage_amount = CASE WHEN p_outcome = 'damage_upheld' THEN p_damage ELSE NULL END,
         decided_by_user_id = p_actor,
         decided_at = now()
   WHERE rental_booking_id = p_booking_id
     AND status IN ('open', 'escalated')
  RETURNING * INTO v_dispute;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'rental_inspection_decision_missing' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEXT v_dispute;
END;
$$;

-- Exactly one claim. A loser, a pending ack, or an open dispute settles nothing.
CREATE OR REPLACE FUNCTION public.rental_claim_inspection_settlement(p_booking_id uuid)
RETURNS SETOF public.rental_bookings
LANGUAGE sql
VOLATILE
AS $$
  UPDATE public.rental_bookings b
     SET settlement_claimed_at = now(), updated_at = now()
   WHERE b.id = p_booking_id
     AND b.inspection_policy_version IS NOT NULL
     AND b.return_handed_back_at IS NOT NULL
     AND b.settlement_claimed_at IS NULL
     AND b.settlement_completed_at IS NULL
     AND b.return_resolution IN ('accepted', 'admin_cleared')
     AND b.status::text IN ('active', 'awaiting_return')
     AND NOT EXISTS (
       SELECT 1 FROM public.rental_inspection_disputes d
        WHERE d.rental_booking_id = b.id
          AND d.status IN ('open', 'escalated')
     )
  RETURNING *;
$$;

CREATE OR REPLACE FUNCTION public.rental_relabel_unit(
  p_booking_id uuid,
  p_unit_id uuid,
  p_label text
) RETURNS SETOF public.rental_booking_units
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
  v_rows integer;
  v_unit public.rental_booking_units%ROWTYPE;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.rental_bookings
     WHERE id = p_booking_id
       AND inspection_policy_version IS NOT NULL
       AND actual_start_at IS NULL
       AND status::text IN ('reserved', 'confirmed')
  ) THEN
    RETURN;
  END IF;
  UPDATE public.rental_bookings
     SET allocation_version = allocation_version + 1,
         pickup_current_version_id = NULL,
         pickup_accepted_version_id = NULL,
         pickup_ack_current = false,
         pickup_inspection_pending = (status::text = 'reserved'),
         updated_at = now()
   WHERE id = p_booking_id
     AND actual_start_at IS NULL
     AND status::text IN ('reserved', 'confirmed')
     AND pickup_current_version_id IS NOT NULL;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 AND EXISTS (
    SELECT 1 FROM public.rental_bookings
     WHERE id = p_booking_id AND pickup_current_version_id IS NOT NULL
  ) THEN
    RETURN;
  END IF;
  UPDATE public.rental_booking_units
     SET physical_label = NULLIF(btrim(p_label), ''),
         updated_at = now()
   WHERE id = p_unit_id
     AND rental_booking_id = p_booking_id
     AND EXISTS (
       SELECT 1 FROM public.rental_bookings b
        WHERE b.id = p_booking_id AND b.actual_start_at IS NULL
     )
  RETURNING * INTO v_unit;
  IF NOT FOUND THEN
    RETURN;
  END IF;
  RETURN NEXT v_unit;
END;
$$;

INSERT INTO public.application_configurations
  (config_key, config_name, description, data_type, boolean_value, number_value, min_value, max_value,
   country_code, tags, status, version)
SELECT v.k, v.n, v.d, v.t, v.b, v.num, v.mn, v.mx, NULL, ARRAY['rentals', 'inspection']::text[], 'active', 1
FROM (VALUES
  ('rental_inspection_enabled', 'Rental condition inspections enabled',
   'When true for a country (or the global row), new rental bookings stamp inspection_policy_version. Existing and NULL bookings stay on the legacy path. Default false.',
   'boolean', false, NULL::numeric, NULL::numeric, NULL::numeric),
  ('rental_inspection_min_photos', 'Minimum inspection photos per unit',
   'Finalized photos required on each unit before a condition report can be submitted. Overview, other side, and accessories are always required. Default 3.',
   'number', NULL, 3, 3, 12),
  ('rental_inspection_return_reminder_hours', 'Return report reminder (hours)',
   'Hours after physical handback before the renter is reminded to review the return report. Never auto-accepts. Default 24.',
   'number', NULL, 24, 1, 168),
  ('rental_inspection_return_review_hours', 'Return report human review (hours)',
   'Hours after physical handback with no acceptance before the return is escalated to admin review. Never auto-accepts a damage claim. Default 48.',
   'number', NULL, 48, 1, 336),
  ('rental_inspection_stripe_review_hours', 'Stripe review headroom (hours)',
   'Enrolled card bookings are rejected unless the booked end plus this many hours fits inside the 6-day card authorization window. Default 72.',
   'number', NULL, 72, 1, 144)
) AS v(k, n, d, t, b, num, mn, mx)
WHERE NOT EXISTS (
  SELECT 1 FROM public.application_configurations c
   WHERE c.config_key = v.k AND c.country_code IS NULL
);
