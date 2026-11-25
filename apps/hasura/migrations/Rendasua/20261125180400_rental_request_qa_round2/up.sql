-- Round 2: respond_by on every insert, a tracked cancel function, and a
-- backfill that does not share a transaction with ADD COLUMN.
-- The window guard lives in 20261125180100_rental_requests_respond_by_index.

DO $$
DECLARE
  n integer;
BEGIN
  LOOP
    UPDATE public.rental_requests
       SET respond_by = public.rental_request_respond_by(
         created_at, requested_start_at, rental_selection_windows
       )
     WHERE id IN (
       SELECT id FROM public.rental_requests
        WHERE respond_by IS NULL
          AND status::text = 'pending'
        LIMIT 500
     );
    GET DIAGNOSTICS n = ROW_COUNT;
    EXIT WHEN n = 0;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.set_rental_request_respond_by()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.respond_by IS NULL THEN
    NEW.respond_by := public.rental_request_respond_by(
      COALESCE(NEW.created_at, timezone('UTC', now())),
      NEW.requested_start_at,
      NEW.rental_selection_windows
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_rental_request_respond_by ON public.rental_requests;
CREATE TRIGGER set_rental_request_respond_by
  BEFORE INSERT ON public.rental_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.set_rental_request_respond_by();

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
  flag.country_code,
  'active',
  1,
  ARRAY['rentals']
FROM public.application_configurations AS flag
WHERE flag.config_key = 'rentals_dashboard_requests_enabled'
  AND COALESCE(flag.boolean_value, false)
  AND COALESCE(flag.status, '') = 'active'
  AND NOT EXISTS (
    SELECT 1 FROM public.application_configurations AS since
     WHERE since.config_key = 'rentals_dashboard_requests_autodecline_since'
       AND since.country_code IS NOT DISTINCT FROM flag.country_code
  );
