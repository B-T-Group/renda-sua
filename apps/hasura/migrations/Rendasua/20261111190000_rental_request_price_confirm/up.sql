-- A higher re-quote must be confirmed inside the locked edit. Same or lower totals save
-- without a confirm. This replaces apply_rental_request_edit; it does not edit the prior migration.

ALTER TABLE public.rental_request_revisions
  ADD COLUMN IF NOT EXISTS price_confirmed boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.rental_request_revisions.price_confirmed IS
  'True when this edit raised the quote and the renter confirmed that new total.';

DROP FUNCTION IF EXISTS public.apply_rental_request_edit(
  uuid, uuid, uuid, integer, jsonb, integer, text, jsonb, timestamptz
);

CREATE FUNCTION public.apply_rental_request_edit(
  p_request_id uuid,
  p_client_id uuid,
  p_actor uuid,
  p_expected_version integer,
  p_windows jsonb,
  p_units integer,
  p_note text,
  p_change_summary jsonb,
  p_now timestamptz,
  p_confirmed_amount numeric,
  p_confirmed_currency text
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
  v_currency text;
  v_elem jsonb;
  v_start timestamptz;
  v_end timestamptz;
  v_new_start timestamptz;
  v_total numeric := 0;
  v_hours numeric;
  v_peak integer;
  v_note text;
  v_next integer;
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
  IF v_start IS NULL OR v_new_start IS NULL
     OR v_start <= p_now + interval '2 hours'
     OR v_new_start <= p_now + interval '2 hours' THEN
    RAISE EXCEPTION 'rental_request_window_closed' USING ERRCODE = 'check_violation';
  END IF;

  SELECT l.units_available, l.base_price_per_day, l.base_price_per_hour,
         COALESCE(NULLIF(btrim(i.currency), ''), 'XAF')
    INTO v_units_available, v_day, v_hour, v_currency
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
