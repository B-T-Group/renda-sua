-- Add human-readable booking number to rental_bookings
ALTER TABLE public.rental_bookings
  ADD COLUMN IF NOT EXISTS booking_number TEXT;

-- Backfill existing rows (best-effort deterministic value)
UPDATE public.rental_bookings
SET booking_number =
  'RB-' || substr(id::text, 1, 8) || '-' || substr(id::text, 9, 4)
WHERE booking_number IS NULL OR booking_number = '';

ALTER TABLE public.rental_bookings
  ALTER COLUMN booking_number SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_rental_bookings_booking_number_unique
ON public.rental_bookings (booking_number);

