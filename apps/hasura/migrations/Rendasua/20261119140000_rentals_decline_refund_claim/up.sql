-- One worker claims a pending decline refund before the provider is called.
-- The claim goes stale so a crashed worker can be taken over. The provider
-- reference stored before the call is reused, so a takeover does not pay twice.

ALTER TABLE public.rental_bookings
  ADD COLUMN IF NOT EXISTS refund_claim_at timestamptz,
  ADD COLUMN IF NOT EXISTS refund_claim_token uuid;

COMMENT ON COLUMN public.rental_bookings.refund_claim_at IS
  'Set when a worker claims a pending condition-decline refund. Another worker may claim only after this is stale.';

COMMENT ON COLUMN public.rental_bookings.refund_claim_token IS
  'Token of the worker that currently owns the pending condition-decline refund.';

ALTER TABLE public.rental_condition_declines
  ADD COLUMN IF NOT EXISTS effects_recorded_at timestamptz;

COMMENT ON COLUMN public.rental_condition_declines.effects_recorded_at IS
  'Set after the decline history row and the business notice were attempted. Null means a retry should run them again.';
