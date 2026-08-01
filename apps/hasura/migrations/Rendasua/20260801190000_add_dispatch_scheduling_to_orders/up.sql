-- Agent dispatch scheduling: hold agent dispatch + open-order visibility until
-- shortly before the scheduled delivery/pickup window, escalate the search
-- radius across two rounds, and track exhaustion for the client fallback flow.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS dispatch_ready_at timestamptz,
  ADD COLUMN IF NOT EXISTS pickup_by timestamptz,
  ADD COLUMN IF NOT EXISTS dispatch_round smallint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dispatch_exhausted_at timestamptz;

COMMENT ON COLUMN public.orders.dispatch_ready_at IS 'When agent dispatch/open-order visibility opens; null or <= now means dispatch immediately. Set to scheduled delivery window start minus the dispatch lead time.';
COMMENT ON COLUMN public.orders.pickup_by IS 'Deadline the assigned/claiming agent should collect the order by; mirrors the scheduled delivery window start.';
COMMENT ON COLUMN public.orders.dispatch_round IS 'Highest agent-dispatch radius round completed for this order (0 = not dispatched yet, 1 = close radius, 2 = wide radius).';
COMMENT ON COLUMN public.orders.dispatch_exhausted_at IS 'Set when both dispatch rounds failed to find an agent; drives the client no-agent-found fallback (cancel or switch to pickup).';

CREATE INDEX IF NOT EXISTS idx_orders_dispatch_ready
  ON public.orders (dispatch_ready_at)
  WHERE current_status = 'ready_for_pickup' AND assigned_agent_id IS NULL;
