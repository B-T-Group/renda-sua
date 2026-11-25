DROP INDEX IF EXISTS public.idx_rental_requests_status_respond_by;

ALTER TABLE public.rental_requests
  DROP COLUMN IF EXISTS respond_by;

DROP FUNCTION IF EXISTS public.rental_request_respond_by(timestamptz, timestamptz, jsonb);
