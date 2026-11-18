-- Stored respond_by so the 5-minute expiry scan can use an index.
-- Equal to the earlier of created_at + 24 hours and the earliest window start.

CREATE OR REPLACE FUNCTION public.rental_request_respond_by(
  created_at timestamptz,
  requested_start_at timestamptz,
  windows jsonb
) RETURNS timestamptz
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  sla timestamptz;
  start_at timestamptz;
BEGIN
  sla := created_at + interval '24 hours';
  BEGIN
    SELECT min((elem->>'start_at')::timestamptz)
      INTO start_at
      FROM jsonb_array_elements(COALESCE(windows, '[]'::jsonb)) AS elem
     WHERE COALESCE(elem->>'start_at', '') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}';
  EXCEPTION WHEN OTHERS THEN
    start_at := NULL;
  END;
  IF start_at IS NULL THEN
    start_at := requested_start_at;
  END IF;
  IF start_at IS NULL OR start_at >= sla THEN
    RETURN sla;
  END IF;
  RETURN start_at;
END;
$$;

ALTER TABLE public.rental_requests
  ADD COLUMN respond_by timestamptz
  GENERATED ALWAYS AS (
    public.rental_request_respond_by(created_at, requested_start_at, rental_selection_windows)
  ) STORED;

CREATE INDEX idx_rental_requests_status_respond_by
  ON public.rental_requests (status, respond_by);
