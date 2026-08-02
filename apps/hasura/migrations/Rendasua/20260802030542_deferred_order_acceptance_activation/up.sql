-- Deferred acceptance for future orders: scheduled state + activation time + per-business timing

ALTER TYPE public.order_acceptance_state ADD VALUE IF NOT EXISTS 'scheduled';

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS acceptance_activates_at timestamptz;

COMMENT ON COLUMN public.orders.acceptance_activates_at IS
  'When scheduled acceptance SLA should start; null once active or for ASAP orders';

-- Note: the partial index on acceptance_activates_at is in a separate migration
-- (20260802030543) because PostgreSQL requires a new enum value to be committed
-- before it can be used in an index predicate (error 55P04).

ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS future_acceptance_timeout_seconds integer,
  ADD COLUMN IF NOT EXISTS order_activation_lead_minutes integer,
  ADD COLUMN IF NOT EXISTS default_estimated_prep_minutes integer;

COMMENT ON COLUMN public.businesses.future_acceptance_timeout_seconds IS
  'Confirm window (seconds) after future-order activation; null uses platform default';
COMMENT ON COLUMN public.businesses.order_activation_lead_minutes IS
  'Minutes before prep start to activate acceptance SLA; null uses platform default (30/60/120)';
COMMENT ON COLUMN public.businesses.default_estimated_prep_minutes IS
  'Default prep minutes for this business; null uses platform default';
