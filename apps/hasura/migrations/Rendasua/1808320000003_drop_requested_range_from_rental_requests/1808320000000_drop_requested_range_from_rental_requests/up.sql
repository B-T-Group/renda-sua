ALTER TABLE public.rental_requests
DROP CONSTRAINT IF EXISTS rental_requests_time_order;

ALTER TABLE public.rental_requests
DROP COLUMN IF EXISTS requested_start_at,
DROP COLUMN IF EXISTS requested_end_at;
