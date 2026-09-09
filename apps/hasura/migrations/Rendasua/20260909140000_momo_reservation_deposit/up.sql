-- MoMo reservation deposit feature
-- Adds deposit payment support for pay-at-delivery/pickup orders on mobile money rails

-- 1) Market configuration for MoMo pay-now+delivery gate
ALTER TABLE public.items
  ADD COLUMN IF NOT EXISTS momo_pay_now_delivery_enabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.items.momo_pay_now_delivery_enabled IS
  'When true, full pay-now+delivery is available on MoMo for this item. When false (default), only pay-at-delivery with deposit or store pickup.';

-- 2) Order deposit fields
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS deposit_amount numeric(10,2),
  ADD COLUMN IF NOT EXISTS deposit_paid boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deposit_transaction_id text,
  ADD COLUMN IF NOT EXISTS deposit_status text,
  ADD COLUMN IF NOT EXISTS deposit_captured_at timestamptz,
  ADD COLUMN IF NOT EXISTS deposit_refund_status text,
  ADD COLUMN IF NOT EXISTS deposit_refund_transaction_id text,
  ADD COLUMN IF NOT EXISTS deposit_refund_attempted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deposit_refund_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS deposit_forfeit_reason text,
  ADD COLUMN IF NOT EXISTS deposit_forfeit_at timestamptz;

COMMENT ON COLUMN public.orders.deposit_amount IS 'Reservation deposit collected at place-order for pay-at-delivery/pickup (XAF integers, max(150, round(total * rate)))';
COMMENT ON COLUMN public.orders.deposit_paid IS 'True when deposit callback SUCCESS received and deposit captured';
COMMENT ON COLUMN public.orders.deposit_transaction_id IS 'MoMo provider transaction ID for the deposit collect';
COMMENT ON COLUMN public.orders.deposit_status IS 'Deposit payment status: pending, captured, refunded, forfeited';
COMMENT ON COLUMN public.orders.deposit_captured_at IS 'Timestamp when deposit was successfully captured';
COMMENT ON COLUMN public.orders.deposit_refund_status IS 'Refund status: pending, succeeded, failed';
COMMENT ON COLUMN public.orders.deposit_refund_transaction_id IS 'MoMo provider transaction ID for the deposit refund (withdraw)';
COMMENT ON COLUMN public.orders.deposit_refund_attempted_at IS 'When deposit refund was first attempted';
COMMENT ON COLUMN public.orders.deposit_refund_completed_at IS 'When deposit refund succeeded';
COMMENT ON COLUMN public.orders.deposit_forfeit_reason IS 'Immutable reason code for deposit forfeit (customer_cancel_after_lock, customer_no_show, etc.)';
COMMENT ON COLUMN public.orders.deposit_forfeit_at IS 'Timestamp when deposit was forfeited';

-- 3) Add index for deposit transaction lookups
CREATE INDEX IF NOT EXISTS idx_orders_deposit_transaction_id
  ON public.orders(deposit_transaction_id)
  WHERE deposit_transaction_id IS NOT NULL;

-- 4) Add check constraint for deposit amount (must be positive when set)
ALTER TABLE public.orders
  ADD CONSTRAINT orders_deposit_amount_positive
  CHECK (deposit_amount IS NULL OR deposit_amount > 0);
