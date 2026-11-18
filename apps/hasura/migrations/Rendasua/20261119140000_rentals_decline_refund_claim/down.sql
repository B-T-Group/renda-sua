ALTER TABLE public.rental_condition_declines
  DROP COLUMN IF EXISTS effects_recorded_at;

ALTER TABLE public.rental_bookings
  DROP COLUMN IF EXISTS refund_claim_token,
  DROP COLUMN IF EXISTS refund_claim_at;
