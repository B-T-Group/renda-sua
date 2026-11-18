-- Stored respond_by so the 5-minute expiry scan can use an index.
-- Equal to the earlier of created_at + 24 hours and the earliest window start.
-- Nullable on purpose: adding it does not rewrite the table. A generated column would.
-- The function is STABLE, not IMMUTABLE: a timestamptz cast follows the session
-- TimeZone unless the text carries an explicit offset, so only offset strings are parsed.

CREATE OR REPLACE FUNCTION public.rental_request_respond_by(
  created_at timestamptz,
  requested_start_at timestamptz,
  windows jsonb
) RETURNS timestamptz
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  sla timestamptz;
  start_at timestamptz;
BEGIN
  sla := created_at + interval '24 hours';
  SELECT min((elem->>'start_at')::timestamptz)
    INTO start_at
    FROM jsonb_array_elements(COALESCE(windows, '[]'::jsonb)) AS elem
   WHERE COALESCE(elem->>'start_at', '') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'
     AND elem->>'start_at' ~ '(Z|[+-][0-9]{2}(:?[0-9]{2})?)$';
  IF start_at IS NULL THEN
    start_at := requested_start_at;
  END IF;
  IF start_at IS NULL OR start_at >= sla THEN
    RETURN sla;
  END IF;
  RETURN start_at;
END;
$$;

-- A previous draft of this file added a generated column. Drop that, then add a plain one.
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
        LIMIT 500
     );
    GET DIAGNOSTICS n = ROW_COUNT;
    EXIT WHEN n = 0;
  END LOOP;
END $$;

CREATE INDEX IF NOT EXISTS idx_rental_requests_status_respond_by
  ON public.rental_requests (status, respond_by);
