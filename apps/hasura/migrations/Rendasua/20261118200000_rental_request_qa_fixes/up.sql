-- QA fixes for dashboard rental requests.
-- Converts a generated respond_by (if one was applied) into a nullable column,
-- writes the v4 quote on edit, cancels a proposed booking with the request,
-- reserves a unit under a row lock, and records a retry when a decline side effect fails.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM pg_attribute a
      JOIN pg_class c ON c.oid = a.attrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public'
       AND c.relname = 'rental_requests'
       AND a.attname = 'respond_by'
       AND a.attgenerated <> ''
  ) THEN
    ALTER TABLE public.rental_requests DROP COLUMN respond_by;
  END IF;
END $$;

ALTER TABLE public.rental_requests
  ADD COLUMN IF NOT EXISTS respond_by timestamptz;

-- Pending-row backfill is 20261118210000, after this column lock commits.

CREATE INDEX IF NOT EXISTS idx_rental_requests_status_respond_by
  ON public.rental_requests (status, respond_by);

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

  SELECT l.units_available, l.base_price_per_day, l.base_price_per_hour,
         COALESCE(l.security_deposit_amount, 0), COALESCE(i.currency::text, 'XAF')
    INTO v_units_available, v_day, v_hour, v_deposit, v_currency
    FROM public.rental_location_listings l
    JOIN public.rental_items i ON i.id = l.rental_item_id
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
  SELECT MAX((elem->>'end_at')::timestamptz) INTO v_end FROM jsonb_array_elements(p_windows) elem;
  SELECT MIN((elem->>'start_at')::timestamptz) INTO v_start FROM jsonb_array_elements(p_windows) elem;
  v_respond_by := p_now + interval '24 hours';
  IF v_start IS NOT NULL AND v_start < v_respond_by THEN
    v_respond_by := v_start;
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

CREATE OR REPLACE FUNCTION public.cancel_client_rental_request(
  p_request_id uuid,
  p_client_id uuid
) RETURNS SETOF public.rental_requests
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
  v_req public.rental_requests%ROWTYPE;
  v_saved public.rental_requests%ROWTYPE;
  v_booking uuid;
BEGIN
  SELECT * INTO v_req
    FROM public.rental_requests
   WHERE rental_requests.id = p_request_id
   FOR UPDATE;
  IF NOT FOUND OR v_req.client_id IS DISTINCT FROM p_client_id THEN
    RAISE EXCEPTION 'rental_request_forbidden' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF v_req.status::text NOT IN ('pending', 'available') THEN
    RAISE EXCEPTION 'rental_request_not_pending' USING ERRCODE = 'check_violation';
  END IF;

  UPDATE public.rental_bookings
     SET status = 'cancelled',
         payment_status = 'cancelled',
         contract_expires_at = NULL
   WHERE rental_bookings.rental_request_id = p_request_id
     AND rental_bookings.status::text = 'proposed'
   RETURNING rental_bookings.id INTO v_booking;

  IF v_booking IS NOT NULL THEN
    INSERT INTO public.rental_status_history (
      rental_booking_id, status, previous_status, changed_by_type, notes
    ) VALUES (
      v_booking, 'cancelled', 'proposed', 'client', 'Client withdrew before confirming'
    );
  END IF;

  UPDATE public.rental_requests
     SET status = 'cancelled'
   WHERE rental_requests.id = p_request_id
     AND rental_requests.status::text IN ('pending', 'available');
  IF NOT FOUND THEN
    RAISE EXCEPTION 'rental_request_not_pending' USING ERRCODE = 'check_violation';
  END IF;

  SELECT * INTO v_saved
    FROM public.rental_requests
   WHERE rental_requests.id = p_request_id;
  RETURN NEXT v_saved;
END;
$$;

CREATE OR REPLACE FUNCTION public.reserve_proposed_rental_booking(
  p_listing_id uuid,
  p_request_id uuid,
  p_client_id uuid,
  p_business_id uuid,
  p_start timestamptz,
  p_end timestamptz,
  p_total numeric,
  p_currency text,
  p_snapshot jsonb,
  p_booking_number text,
  p_contract_expires_at timestamptz,
  p_units integer,
  p_deposit numeric,
  p_windows jsonb,
  p_now timestamptz,
  p_policy_version integer
) RETURNS SETOF public.rental_bookings
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
  v_item uuid;
  v_cap integer;
  v_elem jsonb;
  v_peak integer;
  v_row public.rental_bookings%ROWTYPE;
BEGIN
  PERFORM 1 FROM public.rental_location_listings WHERE id = p_listing_id FOR NO KEY UPDATE;
  SELECT rental_item_id, GREATEST(COALESCE(units_available, 1), 1)
    INTO v_item, v_cap
    FROM public.rental_location_listings
   WHERE id = p_listing_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'rental_request_unavailable' USING ERRCODE = 'check_violation';
  END IF;
  PERFORM 1 FROM public.rental_items WHERE id = v_item FOR UPDATE;

  IF COALESCE(jsonb_array_length(p_windows), 0) < 1 OR p_units < 1 THEN
    RAISE EXCEPTION 'rental_request_unavailable' USING ERRCODE = 'check_violation';
  END IF;
  FOR v_elem IN SELECT value FROM jsonb_array_elements(p_windows)
  LOOP
    v_peak := public.rental_peak_units_held(
      p_listing_id,
      (v_elem->>'start_at')::timestamptz,
      (v_elem->>'end_at')::timestamptz,
      p_now
    );
    IF COALESCE(v_peak, 0) + p_units > v_cap THEN
      RAISE EXCEPTION 'rental_request_unavailable' USING ERRCODE = 'check_violation';
    END IF;
  END LOOP;

  INSERT INTO public.rental_bookings (
    rental_request_id, client_id, business_id, rental_location_listing_id,
    start_at, end_at, total_amount, currency, rental_pricing_snapshot,
    status, contract_expires_at, booking_number, units_booked,
    security_deposit_amount, inspection_policy_version
  ) VALUES (
    p_request_id, p_client_id, p_business_id, p_listing_id,
    p_start, p_end, p_total, p_currency::public.currency_enum, p_snapshot,
    'proposed', p_contract_expires_at, p_booking_number, p_units,
    GREATEST(COALESCE(p_deposit, 0), 0), p_policy_version
  )
  RETURNING * INTO v_row;

  INSERT INTO public.rental_booking_windows (rental_booking_id, start_at, end_at)
  SELECT v_row.id, (elem->>'start_at')::timestamptz, (elem->>'end_at')::timestamptz
    FROM jsonb_array_elements(p_windows) elem;

  RETURN NEXT v_row;
END;
$$;

CREATE TABLE IF NOT EXISTS public.rental_request_side_effects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rental_request_id uuid NOT NULL REFERENCES public.rental_requests(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('release', 'notify')),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT timezone('UTC', now()),
  CONSTRAINT rental_request_side_effects_request_kind_key UNIQUE (rental_request_id, kind)
);

CREATE OR REPLACE FUNCTION public.enqueue_rental_side_effect(
  p_request_id uuid,
  p_kind text,
  p_payload jsonb,
  p_error text
) RETURNS SETOF public.rental_request_side_effects
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
  v_row public.rental_request_side_effects%ROWTYPE;
BEGIN
  INSERT INTO public.rental_request_side_effects (
    rental_request_id, kind, payload, attempts, last_error
  ) VALUES (
    p_request_id, p_kind, COALESCE(p_payload, '{}'::jsonb), 1, left(COALESCE(p_error, ''), 500)
  )
  ON CONFLICT ON CONSTRAINT rental_request_side_effects_request_kind_key
  DO UPDATE SET
    payload = EXCLUDED.payload,
    attempts = public.rental_request_side_effects.attempts + 1,
    last_error = EXCLUDED.last_error
  RETURNING * INTO v_row;
  RETURN NEXT v_row;
END;
$$;

INSERT INTO public.application_configurations (
  config_key, config_name, description, data_type, number_value,
  country_code, status, version, tags
)
SELECT
  'rentals_dashboard_requests_autodecline_batch',
  'Rental auto-decline batch',
  'Maximum pending requests the 5-minute job declines in one run. Default 50.',
  'number', 50, NULL, 'active', 1,
  ARRAY['rentals']
WHERE NOT EXISTS (
  SELECT 1 FROM public.application_configurations
   WHERE config_key = 'rentals_dashboard_requests_autodecline_batch'
     AND country_code IS NULL
);

CREATE OR REPLACE FUNCTION public.stamp_rental_autodecline_since()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.config_key = 'rentals_dashboard_requests_enabled'
     AND COALESCE(NEW.boolean_value, false)
     AND COALESCE(NEW.status, '') = 'active'
     AND (
       TG_OP = 'INSERT'
       OR COALESCE(OLD.boolean_value, false) IS DISTINCT FROM TRUE
       OR COALESCE(OLD.status, '') IS DISTINCT FROM 'active'
     ) THEN
    INSERT INTO public.application_configurations (
      config_key, config_name, description, data_type, string_value,
      country_code, status, version, tags
    )
    SELECT
      'rentals_dashboard_requests_autodecline_since',
      'Rental auto-decline cutoff',
      'Pending requests with respond_by before this instant are left alone.',
      'string',
      to_char(timezone('UTC', now()), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      NEW.country_code,
      'active', 1,
      ARRAY['rentals']
    WHERE NOT EXISTS (
      SELECT 1 FROM public.application_configurations
       WHERE config_key = 'rentals_dashboard_requests_autodecline_since'
         AND country_code IS NOT DISTINCT FROM NEW.country_code
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS stamp_rental_autodecline_since ON public.application_configurations;
CREATE TRIGGER stamp_rental_autodecline_since
  AFTER INSERT OR UPDATE OF boolean_value, status
  ON public.application_configurations
  FOR EACH ROW
  EXECUTE FUNCTION public.stamp_rental_autodecline_since();
