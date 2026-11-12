-- Renter edits of a still-requested rental. Flag stays off. One revision per successful edit.
-- apply_rental_request_edit locks the listing, then the request, and re-checks
-- status, version, the 2h lead, and availability in that same transaction.

ALTER TABLE public.rental_requests
  ADD COLUMN IF NOT EXISTS edit_version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS quoted_total numeric(18, 2),
  ADD COLUMN IF NOT EXISTS change_summary jsonb;

ALTER TABLE public.rental_requests
  DROP CONSTRAINT IF EXISTS rental_requests_edit_version_check;

ALTER TABLE public.rental_requests
  ADD CONSTRAINT rental_requests_edit_version_check CHECK (edit_version >= 1);

COMMENT ON COLUMN public.rental_requests.edit_version IS
  'Starts at 1. Each renter edit increments it. Accept and decline must send the version they saw.';

COMMENT ON COLUMN public.rental_requests.change_summary IS
  'Structured diff of the latest edit (dates, quantity, notes). Null until the first edit.';

CREATE TABLE IF NOT EXISTS public.rental_request_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rental_request_id uuid NOT NULL REFERENCES public.rental_requests(id) ON UPDATE RESTRICT ON DELETE CASCADE,
  version integer NOT NULL,
  rental_selection_windows jsonb NOT NULL,
  units_requested integer NOT NULL,
  client_request_note text,
  quoted_total numeric(18, 2) NOT NULL,
  changed_fields jsonb NOT NULL,
  previous_windows jsonb NOT NULL,
  previous_units integer NOT NULL,
  previous_note text,
  previous_quoted_total numeric(18, 2),
  edited_by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rental_request_revisions_version_check CHECK (version >= 2),
  CONSTRAINT rental_request_revisions_units_check CHECK (units_requested >= 1),
  CONSTRAINT rental_request_revisions_request_version_uidx UNIQUE (rental_request_id, version)
);

COMMENT ON TABLE public.rental_request_revisions IS
  'One audit row per successful renter edit. version is the request edit_version after the edit.';

CREATE INDEX IF NOT EXISTS rental_request_revisions_request_idx
  ON public.rental_request_revisions (rental_request_id, version DESC);

INSERT INTO public.application_configurations (
  config_key, config_name, description, data_type, boolean_value,
  country_code, status, version, tags
)
SELECT
  'rentals_modify_request_enabled',
  'Modify rental request',
  'Renters can edit a Requested rental (dates, quantity, notes) until the business accepts, and not inside the 2 hour lead. Default false.',
  'boolean', false, NULL, 'active', 1,
  ARRAY['rentals', 'feature-flag']
WHERE NOT EXISTS (
  SELECT 1 FROM public.application_configurations
  WHERE config_key = 'rentals_modify_request_enabled' AND country_code IS NULL
);

INSERT INTO public.entity_types (id, comment)
VALUES ('rental_request', 'In-app notice that a renter edited a rental request')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.message_types (id, comment)
VALUES ('RENTAL_REQUEST_UPDATED', 'A renter updated a rental request the business has not accepted yet')
ON CONFLICT (id) DO NOTHING;

-- Same holds as rental_peak_units_held (create): reserved, confirmed, active,
-- awaiting_return, and unexpired proposed. This request's own booking windows
-- are excluded. Other Requested requests are not holds.
CREATE OR REPLACE FUNCTION public.rental_peak_units_held_except(
  p_listing_id uuid,
  p_start timestamptz,
  p_end timestamptz,
  p_now timestamptz,
  p_exclude_request_id uuid
) RETURNS integer
LANGUAGE sql
STABLE
AS $$
  WITH windows AS (
    SELECT
      GREATEST(w.start_at, p_start) AS s,
      LEAST(w.end_at, p_end) AS e,
      GREATEST(COALESCE(b.units_booked, 1), 1) AS units
    FROM public.rental_booking_windows w
    JOIN public.rental_bookings b ON b.id = w.rental_booking_id
    WHERE b.rental_location_listing_id = p_listing_id
      AND b.rental_request_id IS DISTINCT FROM p_exclude_request_id
      AND w.start_at < p_end
      AND w.end_at > p_start
      AND (
        b.status::text IN ('reserved', 'confirmed', 'active', 'awaiting_return')
        OR (b.status::text = 'proposed' AND b.contract_expires_at > p_now)
      )
  ),
  events AS (
    SELECT s AS t, units AS delta FROM windows WHERE e > s
    UNION ALL
    SELECT e AS t, -units AS delta FROM windows WHERE e > s
  ),
  ordered AS (
    SELECT SUM(delta) OVER (ORDER BY t, delta) AS running
    FROM events
  )
  SELECT COALESCE(MAX(running), 0)::integer FROM ordered;
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
  p_now timestamptz
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
  v_elem jsonb;
  v_start timestamptz;
  v_end timestamptz;
  v_new_start timestamptz;
  v_total numeric := 0;
  v_hours numeric;
  v_peak integer;
  v_note text;
  v_next integer;
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
  IF v_start IS NULL OR v_new_start IS NULL
     OR v_start <= p_now + interval '2 hours'
     OR v_new_start <= p_now + interval '2 hours' THEN
    RAISE EXCEPTION 'rental_request_window_closed' USING ERRCODE = 'check_violation';
  END IF;

  SELECT units_available, base_price_per_day, base_price_per_hour
    INTO v_units_available, v_day, v_hour
    FROM public.rental_location_listings
   WHERE id = v_listing;
  IF p_units < 1 OR p_units > GREATEST(COALESCE(v_units_available, 1), 1) THEN
    RAISE EXCEPTION 'rental_request_unavailable' USING ERRCODE = 'check_violation';
  END IF;

  FOR v_elem IN SELECT value FROM jsonb_array_elements(p_windows)
  LOOP
    IF COALESCE(v_elem->>'billing', '') = 'all_day'
       AND v_elem->>'calendar_date' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN
      v_start := (v_elem->>'calendar_date' || 'T00:00:00Z')::timestamptz;
      v_end := v_start + interval '1 day';
      v_total := v_total + COALESCE(v_day, 0) * p_units;
    ELSE
      v_start := (v_elem->>'start_at')::timestamptz;
      v_end := (v_elem->>'end_at')::timestamptz;
      v_hours := GREATEST(1, CEIL(EXTRACT(EPOCH FROM (v_end - v_start)) / 3600.0));
      v_total := v_total + v_hours * COALESCE(v_hour, 0) * p_units;
    END IF;
    v_peak := public.rental_peak_units_held_except(v_listing, v_start, v_end, p_now, p_request_id);
    IF v_peak + p_units > GREATEST(COALESCE(v_units_available, 1), 1) THEN
      RAISE EXCEPTION 'rental_request_unavailable' USING ERRCODE = 'check_violation';
    END IF;
  END LOOP;

  v_note := NULLIF(btrim(COALESCE(p_note, '')), '');
  v_next := v_req.edit_version + 1;
  v_total := ROUND(v_total, 2);
  SELECT MAX((elem->>'end_at')::timestamptz) INTO v_end FROM jsonb_array_elements(p_windows) elem;
  SELECT MIN((elem->>'start_at')::timestamptz) INTO v_start FROM jsonb_array_elements(p_windows) elem;

  UPDATE public.rental_requests
     SET rental_selection_windows = p_windows,
         requested_start_at = v_start,
         requested_end_at = v_end,
         units_requested = p_units,
         client_request_note = v_note,
         quoted_total = v_total,
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
    previous_units, previous_note, previous_quoted_total, edited_by_user_id
  ) VALUES (
    p_request_id, v_next, p_windows, p_units, v_note, v_total,
    COALESCE(p_change_summary->'fields', '[]'::jsonb),
    COALESCE(v_req.rental_selection_windows, '[]'::jsonb),
    GREATEST(COALESCE(v_req.units_requested, 1), 1),
    v_req.client_request_note,
    v_req.quoted_total,
    p_actor
  )
  RETURNING * INTO v_row;
  RETURN NEXT v_row;
END;
$$;
