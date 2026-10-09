-- Flat Rendasua service fee, snapshotted on the order at creation.
-- Country rows: CM/GA/CG = 100 XAF, CA = 0.99 CAD. No row means 0.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS service_fee DECIMAL(10, 2) NOT NULL DEFAULT 0;

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_service_fee_check;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_service_fee_check CHECK (service_fee >= 0);

COMMENT ON COLUMN public.orders.service_fee IS
  'Rendasua service fee charged on this order, in orders.currency. Snapshotted at creation. Not part of item commission or the agent delivery share.';

INSERT INTO public.application_configurations (
  config_key,
  config_name,
  description,
  data_type,
  number_value,
  min_value,
  country_code,
  tags,
  status
) VALUES
(
  'service_fee',
  'Service Fee (Cameroon)',
  'Flat Rendasua service fee added to each sale order in Cameroon (XAF).',
  'currency', 100, 0, 'CM', ARRAY['fees', 'checkout', 'order'], 'active'
),
(
  'service_fee',
  'Service Fee (Gabon)',
  'Flat Rendasua service fee added to each sale order in Gabon (XAF).',
  'currency', 100, 0, 'GA', ARRAY['fees', 'checkout', 'order'], 'active'
),
(
  'service_fee',
  'Service Fee (Congo)',
  'Flat Rendasua service fee added to each sale order in Congo (XAF).',
  'currency', 100, 0, 'CG', ARRAY['fees', 'checkout', 'order'], 'active'
),
(
  'service_fee',
  'Service Fee (Canada)',
  'Flat Rendasua service fee added to each sale order in Canada (CAD).',
  'currency', 0.99, 0, 'CA', ARRAY['fees', 'checkout', 'order'], 'active'
)
ON CONFLICT (config_key, country_code) DO NOTHING;

ALTER TABLE public.commission_payouts
  DROP CONSTRAINT IF EXISTS commission_payouts_commission_type_check;

ALTER TABLE public.commission_payouts
  ADD CONSTRAINT commission_payouts_commission_type_check CHECK (commission_type IN (
    'base_delivery_fee',
    'per_km_delivery_fee',
    'item_sale',
    'order_subtotal',
    'platform_funded_delivery',
    'service_fee'
  ));
