-- MoMo reservation deposit feature
-- Schema locked by Database & Platform Engineer

-- 1) Enums for deposit status
CREATE TYPE public.order_deposit_status_enum AS ENUM (
  'none',
  'pending',
  'paid',
  'failed',
  'forfeited',
  'refunded'
);

CREATE TYPE public.order_deposit_refund_status_enum AS ENUM (
  'none',
  'pending',
  'refunded',
  'failed'
);

COMMENT ON TYPE public.order_deposit_status_enum IS 
  'Deposit payment status: none (no deposit), pending (awaiting callback), paid (captured), failed (callback failed), forfeited (after lock), refunded (before lock)';

COMMENT ON TYPE public.order_deposit_refund_status_enum IS 
  'Deposit refund status: none (no refund), pending (refund initiated), refunded (refund completed), failed (refund failed)';

-- 2) Add order_deposit to payment_entity_type enum
ALTER TYPE public.payment_entity_type ADD VALUE IF NOT EXISTS 'order_deposit';

-- 3) Orders table deposit columns (additive, nullable/defaulted)
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS deposit_amount DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS deposit_mobile_payment_transaction_id uuid,
  ADD COLUMN IF NOT EXISTS deposit_status public.order_deposit_status_enum NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS deposit_refund_status public.order_deposit_refund_status_enum NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS deposit_forfeit_reason text,
  ADD COLUMN IF NOT EXISTS deposit_forfeited_at timestamptz,
  ADD COLUMN IF NOT EXISTS deposit_forfeited_by_user_id uuid,
  ADD COLUMN IF NOT EXISTS deposit_refunded_at timestamptz;

-- 4) Foreign key constraint
ALTER TABLE public.orders
  ADD CONSTRAINT orders_deposit_mobile_payment_transaction_id_fkey
  FOREIGN KEY (deposit_mobile_payment_transaction_id)
  REFERENCES public.mobile_payment_transactions(id)
  ON DELETE SET NULL;

-- 5) Check constraint (deposit_amount >= 0 when not null)
ALTER TABLE public.orders
  ADD CONSTRAINT orders_deposit_amount_check
  CHECK (deposit_amount IS NULL OR deposit_amount >= 0);

-- 6) Column comments
COMMENT ON COLUMN public.orders.deposit_amount IS 
  'Reservation deposit amount for pay-at-delivery/pickup MoMo orders (XAF). Calculated at place-order as max(151, round(total * rate))';

COMMENT ON COLUMN public.orders.deposit_mobile_payment_transaction_id IS 
  'Link to mobile_payment_transactions row for deposit payment (payment_entity=order_deposit). NOT the MoMo provider transaction_id.';

COMMENT ON COLUMN public.orders.deposit_status IS 
  'Deposit lifecycle: none (no deposit required), pending (awaiting MoMo callback), paid (captured), failed (payment failed), forfeited (customer forfeit after lock), refunded (refunded before lock)';

COMMENT ON COLUMN public.orders.deposit_refund_status IS 
  'Deposit refund status: none (no refund), pending (refund initiated via MoMo withdraw), refunded (refund completed), failed (refund failed - ops visible)';

COMMENT ON COLUMN public.orders.deposit_forfeit_reason IS 
  'Immutable reason code for deposit forfeit: customer_cancel_after_lock, customer_refuse_delivery, customer_no_show_pickup, customer_no_show_delivery';

COMMENT ON COLUMN public.orders.deposit_forfeited_at IS 
  'Timestamp when deposit was forfeited (after lock point: out_for_delivery / ready_for_pickup)';

COMMENT ON COLUMN public.orders.deposit_forfeited_by_user_id IS 
  'User ID who triggered forfeit (usually system, or admin in dispute resolution)';

COMMENT ON COLUMN public.orders.deposit_refunded_at IS 
  'Timestamp when deposit refund completed (before lock point)';

-- 7) Indexes
CREATE INDEX IF NOT EXISTS idx_orders_deposit_mobile_payment_transaction_id
  ON public.orders(deposit_mobile_payment_transaction_id)
  WHERE deposit_mobile_payment_transaction_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_deposit_status
  ON public.orders(deposit_status)
  WHERE deposit_status != 'none';

-- 8) Per-market flag via application_configurations (not items table, not country_delivery_configs)
-- Global default: false (MoMo pay-now+delivery hidden by default)
INSERT INTO public.application_configurations (
  config_key,
  data_type,
  boolean_value,
  country_code,
  description,
  created_at,
  updated_at
) VALUES (
  'momo_pay_now_delivery_enabled',
  'boolean',
  false,
  NULL,  -- Global default
  'When false, hide/block full pay-now+delivery on MoMo; only pay-at-delivery with deposit or store pickup. When true, allow full pay-now+delivery.',
  NOW(),
  NOW()
)
ON CONFLICT (config_key, COALESCE(country_code, '')) DO NOTHING;

-- Per-country overrides can be added later as needed:
-- INSERT INTO application_configurations (config_key, data_type, boolean_value, country_code, ...)
-- VALUES ('momo_pay_now_delivery_enabled', 'boolean', true, 'GA', ...) ON CONFLICT DO NOTHING;
