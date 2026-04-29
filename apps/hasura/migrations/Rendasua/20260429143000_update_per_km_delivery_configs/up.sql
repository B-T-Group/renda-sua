-- Migration: update_per_km_delivery_configs
-- Description: Add max_per_km_delivery_fee config and update CM/GA defaults.

INSERT INTO public.delivery_configs (config_key, description)
VALUES (
  'max_per_km_delivery_fee',
  'Minimum floor applied to per-km fee component using max(config, distance * per_km_delivery_fee)'
)
ON CONFLICT (config_key) DO UPDATE
SET description = EXCLUDED.description,
    updated_at = NOW();

INSERT INTO public.country_delivery_configs (
  country_code,
  config_key,
  config_value,
  data_type
)
VALUES
  ('GA', 'per_km_delivery_fee', '100', 'number'),
  ('CM', 'per_km_delivery_fee', '100', 'number'),
  ('GA', 'max_per_km_delivery_fee', '1500', 'number'),
  ('CM', 'max_per_km_delivery_fee', '1500', 'number')
ON CONFLICT (country_code, config_key) DO UPDATE
SET config_value = EXCLUDED.config_value,
    data_type = EXCLUDED.data_type,
    updated_at = NOW();
