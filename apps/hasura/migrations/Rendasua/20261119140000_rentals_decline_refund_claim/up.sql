-- Claim columns, a terminal manual refund state, and one history row per decline.
-- Nullable adds have no default, so they do not rewrite the table under an
-- exclusive lock. The effects backfill is a separate statement.
SET lock_timeout = '3s';

ALTER TABLE public.rental_bookings
  ADD COLUMN IF NOT EXISTS refund_claim_at timestamptz,
  ADD COLUMN IF NOT EXISTS refund_claim_token uuid;

ALTER TABLE public.rental_condition_declines
  ADD COLUMN IF NOT EXISTS effects_recorded_at timestamptz;

UPDATE public.rental_condition_declines
SET effects_recorded_at = created_at
WHERE effects_recorded_at IS NULL;

ALTER TABLE public.rental_bookings
  DROP CONSTRAINT IF EXISTS rental_bookings_refund_status_check;

ALTER TABLE public.rental_bookings
  ADD CONSTRAINT rental_bookings_refund_status_check
  CHECK (refund_status IN ('none', 'refund_pending', 'refunded', 'failed', 'manual'));

CREATE UNIQUE INDEX IF NOT EXISTS rental_status_history_one_decline
  ON public.rental_status_history (rental_booking_id)
  WHERE notes = 'Renter declined the pickup condition';

COMMENT ON COLUMN public.rental_bookings.refund_claim_at IS
  'When a worker claimed this pending decline refund. A fresh claim blocks a second payout.';
COMMENT ON COLUMN public.rental_bookings.refund_claim_token IS
  'Token the claiming worker must still hold before it calls the provider or writes the result.';
COMMENT ON COLUMN public.rental_condition_declines.effects_recorded_at IS
  'Set when history, PIN clear, and the business notice have been recorded for this decline.';
