-- Revert per-km delivery config defaults for CM/GA and remove max_per_km_delivery_fee.

UPDATE public.country_delivery_configs
SET config_value = '200',
    data_type = 'number',
    updated_at = NOW()
WHERE country_code IN ('CM', 'GA')
  AND config_key = 'per_km_delivery_fee';

DELETE FROM public.country_delivery_configs
WHERE country_code IN ('CM', 'GA')
  AND config_key = 'max_per_km_delivery_fee';

DELETE FROM public.delivery_configs
WHERE config_key = 'max_per_km_delivery_fee';
