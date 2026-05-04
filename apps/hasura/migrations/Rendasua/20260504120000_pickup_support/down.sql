-- Revert pickup support (best-effort; enum values cannot be removed in PG easily)

ALTER TABLE public.orders
  ALTER COLUMN delivery_address_id SET NOT NULL;

ALTER TABLE public.orders DROP COLUMN IF EXISTS fulfillment_method;

ALTER TABLE public.items DROP COLUMN IF EXISTS pay_at_pickup_enabled;

-- order_payment_timing_enum value 'pay_at_pickup' is left in place (PG limitation)
-- order_fulfillment_method_enum can be dropped if no column uses it
DROP TYPE IF EXISTS public.order_fulfillment_method_enum;
