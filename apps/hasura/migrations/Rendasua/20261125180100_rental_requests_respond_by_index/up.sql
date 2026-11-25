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
  elem jsonb;
  candidate timestamptz;
BEGIN
  sla := created_at + interval '24 hours';
  IF jsonb_typeof(windows) = 'array' THEN
    FOR elem IN SELECT value FROM jsonb_array_elements(windows)
    LOOP
      BEGIN
        IF COALESCE(elem->>'start_at', '') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'
           AND elem->>'start_at' ~ '(Z|[+-][0-9]{2}(:?[0-9]{2})?)$' THEN
          candidate := (elem->>'start_at')::timestamptz;
          IF start_at IS NULL OR candidate < start_at THEN
            start_at := candidate;
          END IF;
        END IF;
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'rental_request_respond_by skipped window: %', SQLERRM;
      END;
    END LOOP;
  ELSIF windows IS NOT NULL THEN
    RAISE WARNING 'rental_request_respond_by skipped windows of type %', jsonb_typeof(windows);
  END IF;
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

-- The backfill lives in 20261125180400 so this ADD COLUMN lock is not held
-- through the table update.

CREATE INDEX IF NOT EXISTS idx_rental_requests_status_respond_by
  ON public.rental_requests (status, respond_by);
