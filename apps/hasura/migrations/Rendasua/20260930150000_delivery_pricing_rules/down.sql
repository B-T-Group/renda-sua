ALTER TABLE orders DROP COLUMN IF EXISTS delivery_fee_waived;

UPDATE public.country_delivery_configs
SET config_value = '20', updated_at = NOW()
WHERE config_key = 'delivery_availability_radius_km';

UPDATE public.country_delivery_configs
SET config_value = '1000', updated_at = NOW()
WHERE country_code IN ('GA', 'CM')
  AND config_key = 'normal_delivery_base_fee';

DELETE FROM public.country_delivery_configs
WHERE config_key IN ('max_delivery_fee', 'free_delivery_commission_threshold');

DELETE FROM public.delivery_configs
WHERE config_key IN ('max_delivery_fee', 'free_delivery_commission_threshold');
