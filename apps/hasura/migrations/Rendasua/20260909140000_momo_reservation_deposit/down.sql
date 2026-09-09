-- Revert MoMo reservation deposit feature

-- Remove check constraint
ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_deposit_amount_positive;

-- Remove index
DROP INDEX IF EXISTS idx_orders_deposit_transaction_id;

-- Remove order deposit fields
ALTER TABLE public.orders
  DROP COLUMN IF EXISTS deposit_forfeit_at,
  DROP COLUMN IF EXISTS deposit_forfeit_reason,
  DROP COLUMN IF EXISTS deposit_refund_completed_at,
  DROP COLUMN IF EXISTS deposit_refund_attempted_at,
  DROP COLUMN IF EXISTS deposit_refund_transaction_id,
  DROP COLUMN IF EXISTS deposit_refund_status,
  DROP COLUMN IF EXISTS deposit_captured_at,
  DROP COLUMN IF EXISTS deposit_status,
  DROP COLUMN IF EXISTS deposit_transaction_id,
  DROP COLUMN IF EXISTS deposit_paid,
  DROP COLUMN IF EXISTS deposit_amount;

-- Remove market configuration
ALTER TABLE public.items
  DROP COLUMN IF EXISTS momo_pay_now_delivery_enabled;
