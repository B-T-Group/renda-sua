-- Note: Booking numbers are populated based on the existing UUID id.
-- This migration can be rolled back by dropping the column and its index.

DROP INDEX IF EXISTS public.idx_rental_bookings_booking_number_unique;

ALTER TABLE public.rental_bookings
  DROP COLUMN IF EXISTS booking_number;

