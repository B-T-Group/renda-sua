DELETE FROM public.application_configurations
WHERE config_key = 'service_fee'
  AND country_code IN ('CM', 'GA', 'CG', 'CA');

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_service_fee_check;

ALTER TABLE public.orders
  DROP COLUMN IF EXISTS service_fee;

ALTER TABLE public.commission_payouts
  DROP CONSTRAINT IF EXISTS commission_payouts_commission_type_check;

ALTER TABLE public.commission_payouts
  ADD CONSTRAINT commission_payouts_commission_type_check CHECK (commission_type IN (
    'base_delivery_fee',
    'per_km_delivery_fee',
    'item_sale',
    'order_subtotal',
    'platform_funded_delivery'
  ));
