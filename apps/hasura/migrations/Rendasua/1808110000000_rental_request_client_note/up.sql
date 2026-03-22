ALTER TABLE public.rental_requests
  ADD COLUMN IF NOT EXISTS client_request_note TEXT NULL;

COMMENT ON COLUMN public.rental_requests.client_request_note IS 'Optional message from the client when submitting the rental request';
