-- One ledger attempt per contract hold, so a released hold can be placed again
-- without the next hold or release matching the previous attempt.
ALTER TABLE public.rental_holds
  ADD COLUMN IF NOT EXISTS ledger_attempt_id uuid;

COMMENT ON COLUMN public.rental_holds.ledger_attempt_id IS
  'Account-transaction reference for this hold attempt. Changes when a cancelled hold is placed again.';
