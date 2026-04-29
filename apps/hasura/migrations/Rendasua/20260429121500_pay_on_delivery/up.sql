-- Pay-on-delivery feature:
-- - Item-level flag enabling pay-at-delivery UX
-- - Order-level timing + reconciliation metadata for cash-exception fallback

-- 1) Item-level configuration
ALTER TABLE public.items
  ADD COLUMN IF NOT EXISTS pay_on_delivery_enabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.items.pay_on_delivery_enabled IS
  'When true, clients may choose to pay at delivery (mobile money in-app). Default false.';

-- 2) Order-level configuration
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_payment_timing_enum') THEN
    CREATE TYPE public.order_payment_timing_enum AS ENUM ('pay_now', 'pay_at_delivery');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_reconciliation_status_enum') THEN
    CREATE TYPE public.order_reconciliation_status_enum AS ENUM ('none', 'pending_manual_reconciliation', 'reconciled');
  END IF;
END$$;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_timing public.order_payment_timing_enum NOT NULL DEFAULT 'pay_now',
  ADD COLUMN IF NOT EXISTS reconciliation_status public.order_reconciliation_status_enum NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS cash_exception_reported_by_agent_id uuid NULL REFERENCES public.agents(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cash_exception_reported_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS reconciled_by_business_id uuid NULL REFERENCES public.businesses(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reconciled_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS reconciliation_reference text NULL,
  ADD COLUMN IF NOT EXISTS reconciliation_notes text NULL;

COMMENT ON COLUMN public.orders.payment_timing IS
  'Client-selected timing: pay_now (current behavior) or pay_at_delivery (mobile payment at doorstep).';
COMMENT ON COLUMN public.orders.reconciliation_status IS
  'Used only for cash-exception fallback: none, pending_manual_reconciliation, reconciled.';
COMMENT ON COLUMN public.orders.cash_exception_reported_by_agent_id IS
  'Agent who reported paid-in-cash exception at delivery (requires business reconciliation).';
COMMENT ON COLUMN public.orders.reconciled_by_business_id IS
  'Business that manually reconciled a cash-exception order.';

