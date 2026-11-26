DROP TRIGGER IF EXISTS rental_bookings_require_paid_start ON public.rental_bookings;
DROP FUNCTION IF EXISTS public.rental_bookings_require_paid_start();
ALTER TABLE public.rental_bookings
  DROP CONSTRAINT IF EXISTS rental_bookings_reservation_fee_rail_check,
  DROP CONSTRAINT IF EXISTS rental_bookings_reservation_fee_nonneg,
  DROP COLUMN IF EXISTS reservation_fee_settled_at,
  DROP COLUMN IF EXISTS reservation_fee_rail,
  DROP COLUMN IF EXISTS reservation_fee_ref,
  DROP COLUMN IF EXISTS reservation_fee_status,
  DROP COLUMN IF EXISTS reservation_fee_amount,
  DROP COLUMN IF EXISTS card_pay_at_pickup;
ALTER TABLE public.rental_location_listings
  DROP COLUMN IF EXISTS reservation_fee_enabled;
