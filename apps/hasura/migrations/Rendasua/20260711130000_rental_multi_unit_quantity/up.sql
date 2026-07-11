-- Multi-unit rentals: quantity on requests and bookings (listing.units_available already exists).

ALTER TABLE public.rental_requests
  ADD COLUMN IF NOT EXISTS units_requested INTEGER NOT NULL DEFAULT 1;

ALTER TABLE public.rental_requests
  DROP CONSTRAINT IF EXISTS rental_requests_units_requested_check;

ALTER TABLE public.rental_requests
  ADD CONSTRAINT rental_requests_units_requested_check CHECK (units_requested >= 1);

ALTER TABLE public.rental_bookings
  ADD COLUMN IF NOT EXISTS units_booked INTEGER NOT NULL DEFAULT 1;

ALTER TABLE public.rental_bookings
  DROP CONSTRAINT IF EXISTS rental_bookings_units_booked_check;

ALTER TABLE public.rental_bookings
  ADD CONSTRAINT rental_bookings_units_booked_check CHECK (units_booked >= 1);

COMMENT ON COLUMN public.rental_requests.units_requested IS
  'Number of identical listing units requested for every selection window';
COMMENT ON COLUMN public.rental_bookings.units_booked IS
  'Number of listing units reserved by this booking';
