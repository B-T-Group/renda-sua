DROP TABLE IF EXISTS public.rental_booking_windows;

ALTER TABLE public.rental_requests
DROP COLUMN IF EXISTS rental_selection_windows;
