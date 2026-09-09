-- Revert MoMo reservation deposit feature

-- 1) Remove market flag
DELETE FROM public.application_configurations
WHERE config_key = 'momo_pay_now_delivery_enabled';

-- 2) Drop indexes
DROP INDEX IF EXISTS public.idx_orders_deposit_status;
DROP INDEX IF EXISTS public.idx_orders_deposit_mobile_payment_transaction_id;

-- 3) Remove orders deposit columns
ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_deposit_amount_check,
  DROP CONSTRAINT IF EXISTS orders_deposit_mobile_payment_transaction_id_fkey,
  DROP COLUMN IF EXISTS deposit_refunded_at,
  DROP COLUMN IF EXISTS deposit_forfeited_by_user_id,
  DROP COLUMN IF EXISTS deposit_forfeited_at,
  DROP COLUMN IF EXISTS deposit_forfeit_reason,
  DROP COLUMN IF EXISTS deposit_refund_status,
  DROP COLUMN IF EXISTS deposit_status,
  DROP COLUMN IF EXISTS deposit_mobile_payment_transaction_id,
  DROP COLUMN IF EXISTS deposit_amount;

-- 4) Drop enums (note: cannot remove 'order_deposit' from payment_entity_type enum easily)
DROP TYPE IF EXISTS public.order_deposit_refund_status_enum;
DROP TYPE IF EXISTS public.order_deposit_status_enum;

-- Note: Removing enum value 'order_deposit' from payment_entity_type requires more complex migration
-- and is typically not done in production. Leave it in place if already used.
