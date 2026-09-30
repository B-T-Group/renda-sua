-- Delivery pricing: total cap, free-delivery commission threshold, and a 5 km
-- agent eligibility radius for every seeded market. Client distance is derived
-- from the cap, not stored as its own key.

INSERT INTO public.delivery_configs (config_key, description) VALUES
    ('max_delivery_fee', 'Maximum total delivery fee charged to the customer. Also sets how far delivery can go: (max fee - base) / per km.'),
    ('free_delivery_commission_threshold', 'When the order platform commission is at least this amount and the client is within the fee-derived distance, the customer delivery fee is waived.')
ON CONFLICT (config_key) DO NOTHING;

INSERT INTO public.country_delivery_configs (country_code, config_key, config_value, data_type) VALUES
    ('GA', 'max_delivery_fee', '1000', 'number'),
    ('CM', 'max_delivery_fee', '1000', 'number'),
    ('GA', 'free_delivery_commission_threshold', '10000', 'number'),
    ('CM', 'free_delivery_commission_threshold', '10000', 'number')
ON CONFLICT (country_code, config_key) DO UPDATE
SET config_value = EXCLUDED.config_value,
    data_type = EXCLUDED.data_type,
    updated_at = NOW();

UPDATE public.country_delivery_configs
SET config_value = '500', updated_at = NOW()
WHERE country_code IN ('GA', 'CM')
  AND config_key = 'normal_delivery_base_fee';

UPDATE public.country_delivery_configs
SET config_value = '100', updated_at = NOW()
WHERE country_code IN ('GA', 'CM')
  AND config_key = 'per_km_delivery_fee';

UPDATE public.country_delivery_configs
SET config_value = '5', updated_at = NOW()
WHERE config_key = 'delivery_availability_radius_km';

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS delivery_fee_waived BOOLEAN NOT NULL DEFAULT false;
