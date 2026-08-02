-- Partial index for efficient polling of scheduled orders awaiting activation.
-- This is a separate migration from 20260802030542 because PostgreSQL requires
-- the 'scheduled' enum value to be committed before it can appear in an index
-- predicate (error 55P04: "unsafe use of new value of enum type").

CREATE INDEX IF NOT EXISTS idx_orders_acceptance_activates_at
  ON public.orders (acceptance_activates_at)
  WHERE current_status = 'pending' AND acceptance_state = 'scheduled';
