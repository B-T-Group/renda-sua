ALTER TABLE public.rental_requests
ADD COLUMN requested_start_at TIMESTAMPTZ,
ADD COLUMN requested_end_at TIMESTAMPTZ;

UPDATE public.rental_requests
SET
  requested_start_at = (
    SELECT MIN((item->>'start_at')::timestamptz)
    FROM jsonb_array_elements(rental_selection_windows) AS item
  ),
  requested_end_at = (
    SELECT MAX((item->>'end_at')::timestamptz)
    FROM jsonb_array_elements(rental_selection_windows) AS item
  );

ALTER TABLE public.rental_requests
ALTER COLUMN requested_start_at SET NOT NULL,
ALTER COLUMN requested_end_at SET NOT NULL;

ALTER TABLE public.rental_requests
ADD CONSTRAINT rental_requests_time_order CHECK (requested_end_at > requested_start_at);
