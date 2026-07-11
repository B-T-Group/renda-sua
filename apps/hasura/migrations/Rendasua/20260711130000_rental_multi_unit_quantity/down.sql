ALTER TABLE public.rental_bookings
  DROP CONSTRAINT IF EXISTS rental_bookings_units_booked_check;

ALTER TABLE public.rental_bookings
  DROP COLUMN IF EXISTS units_booked;

ALTER TABLE public.rental_requests
  DROP CONSTRAINT IF EXISTS rental_requests_units_requested_check;

ALTER TABLE public.rental_requests
  DROP COLUMN IF EXISTS units_requested;
