DROP INDEX IF EXISTS public.rental_status_history_one_decline;

ALTER TABLE public.rental_bookings
  DROP CONSTRAINT IF EXISTS rental_bookings_refund_status_check;

ALTER TABLE public.rental_bookings
  ADD CONSTRAINT rental_bookings_refund_status_check
  CHECK (refund_status IN ('none', 'refund_pending', 'refunded', 'failed'));

ALTER TABLE public.rental_condition_declines
  DROP COLUMN IF EXISTS effects_recorded_at;

ALTER TABLE public.rental_bookings
  DROP COLUMN IF EXISTS refund_claim_token,
  DROP COLUMN IF EXISTS refund_claim_at;
