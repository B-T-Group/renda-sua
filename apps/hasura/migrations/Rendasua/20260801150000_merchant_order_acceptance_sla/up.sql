-- Merchant order acceptance SLA: order substates, business reliability + availability

CREATE TYPE public.order_acceptance_state AS ENUM (
  'awaiting_acceptance',
  'no_response',
  'grace',
  'accepted'
);

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS acceptance_state public.order_acceptance_state,
  ADD COLUMN IF NOT EXISTS acceptance_deadline_at timestamptz,
  ADD COLUMN IF NOT EXISTS grace_deadline_at timestamptz,
  ADD COLUMN IF NOT EXISTS accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS busy_extra_prep_minutes integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS estimated_prep_minutes integer;

COMMENT ON COLUMN public.orders.acceptance_state IS 'SLA substate while current_status is pending';
COMMENT ON COLUMN public.orders.acceptance_deadline_at IS 'When awaiting_acceptance expires into no_response';
COMMENT ON COLUMN public.orders.grace_deadline_at IS 'When grace expires into system auto-decline';
COMMENT ON COLUMN public.orders.accepted_at IS 'When business confirmed (accepted) the order';
COMMENT ON COLUMN public.orders.busy_extra_prep_minutes IS 'Extra prep minutes from Busy taps (capped in app)';
COMMENT ON COLUMN public.orders.estimated_prep_minutes IS 'Base prep + busy extra, shown to client';

CREATE INDEX IF NOT EXISTS idx_orders_acceptance_deadline
  ON public.orders (acceptance_deadline_at)
  WHERE current_status = 'pending' AND acceptance_state = 'awaiting_acceptance';

CREATE INDEX IF NOT EXISTS idx_orders_grace_deadline
  ON public.orders (grace_deadline_at)
  WHERE current_status = 'pending' AND acceptance_state = 'grace';

ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS acceptance_timeout_seconds integer,
  ADD COLUMN IF NOT EXISTS orders_accepted_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS orders_auto_declined_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS orders_merchant_cancelled_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS acceptance_latency_sum_ms bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reliability_score numeric(6, 2) NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS reliability_tier text NOT NULL DEFAULT 'ok',
  ADD COLUMN IF NOT EXISTS accepting_orders boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS paused_until timestamptz,
  ADD COLUMN IF NOT EXISTS auto_decline_rolling_30d integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.businesses.acceptance_timeout_seconds IS 'Per-business accept window; null uses platform default';
COMMENT ON COLUMN public.businesses.reliability_tier IS 'ok | warn | demote | restrict | suspend';
COMMENT ON COLUMN public.businesses.accepting_orders IS 'Merchant toggle / hours / pause gate for new orders';
COMMENT ON COLUMN public.businesses.paused_until IS 'When pause ends; null with accepting_orders=false means indefinite';

ALTER TABLE public.businesses
  DROP CONSTRAINT IF EXISTS businesses_reliability_tier_check;
ALTER TABLE public.businesses
  ADD CONSTRAINT businesses_reliability_tier_check
  CHECK (reliability_tier IN ('ok', 'warn', 'demote', 'restrict', 'suspend'));

INSERT INTO public.order_cancellation_reasons (id, value, display, rank, persona)
VALUES (
  19,
  'merchant_no_response',
  'Merchant did not accept the order in time',
  18,
  ARRAY['system']
)
ON CONFLICT (id) DO NOTHING;
