-- Stripe Tax: persist at checkout what the backend already computes.
--
-- Until now the tax calculation id lived only in PaymentIntent metadata and the order kept
-- tax_status='estimated', tax_amount=0. This adds an append-mostly snapshot per order
-- (order_tax_snapshots) and a reversal ledger (order_tax_reversals). It deliberately does NOT
-- touch orders.tax_amount / orders.total_amount / orders.pre_tax_total, so payouts, refunds and
-- the cancellation-fee base keep reading exactly the columns they read today.
--
-- Apply this migration BEFORE deploying the backend that writes these tables
-- (the backend also writes orders.tax_status = 'void', which needs the widened check below).
SET LOCAL lock_timeout = '5s';

-- 1. orders.tax_status may now be 'void' (estimated, never captured: cancelled/expired).
ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_tax_status_check;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_tax_status_check
  CHECK (tax_status IN ('none', 'estimated', 'finalized', 'void')) NOT VALID;
ALTER TABLE public.orders VALIDATE CONSTRAINT orders_tax_status_check;

-- 2. One snapshot per order: the Stripe Tax calculation taken at checkout.
CREATE TABLE IF NOT EXISTS public.order_tax_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'estimated'
    CHECK (status IN ('estimated', 'finalized', 'void')),
  currency text NOT NULL,
  stripe_tax_calculation_id text NOT NULL,
  stripe_tax_transaction_id text,
  estimated_tax_amount numeric(12, 2) NOT NULL CHECK (estimated_tax_amount >= 0),
  pre_tax_amount numeric(12, 2) NOT NULL CHECK (pre_tax_amount >= 0),
  total_including_tax numeric(12, 2) NOT NULL CHECK (total_including_tax >= 0),
  effective_tax_rate numeric(8, 4),
  tax_breakdown jsonb,
  tax_jurisdiction jsonb,
  captured_total_including_tax numeric(12, 2),
  finalized_at timestamptz,
  voided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.order_tax_snapshots IS
  'Stripe Tax calculation captured at checkout (one row per order). Informational/accounting only: orders.total_amount, orders.tax_amount and payouts never read it.';
COMMENT ON COLUMN public.order_tax_snapshots.total_including_tax IS
  'Stripe calculation amount_total (pre-tax + tax_amount_exclusive); what the PaymentIntent was raised to.';
COMMENT ON COLUMN public.order_tax_snapshots.captured_total_including_tax IS
  'PaymentIntent amount_received at capture (can be below total_including_tax after a fee waiver).';

CREATE INDEX IF NOT EXISTS order_tax_snapshots_calculation_idx
  ON public.order_tax_snapshots (stripe_tax_calculation_id);

-- 3. Reversal ledger: one row per Stripe refund whose tax was reversed in Stripe Tax.
--    stripe_refund_id and reference are unique, so a replayed refund can never reverse twice.
CREATE TABLE IF NOT EXISTS public.order_tax_reversals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id uuid NOT NULL REFERENCES public.order_tax_snapshots(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  stripe_refund_id text NOT NULL UNIQUE,
  stripe_tax_reversal_id text,
  reference text NOT NULL UNIQUE,
  mode text NOT NULL CHECK (mode IN ('full', 'partial')),
  amount_minor bigint NOT NULL CHECK (amount_minor > 0),
  currency text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON COLUMN public.order_tax_reversals.amount_minor IS
  'Tax-inclusive amount reversed, positive, in the currency minor unit (Stripe flat_amount is the negative of this).';

CREATE INDEX IF NOT EXISTS order_tax_reversals_snapshot_idx
  ON public.order_tax_reversals (snapshot_id);
