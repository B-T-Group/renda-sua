-- Rollback: enable_country_cm_data
-- Revert CM (Cameroon) enablement: remove country_delivery_configs, delivery_time_slots,
-- remove/disable freemopay, and set CM supported_country_states back to coming_soon.

-- 4. Revert CM supported_country_states to coming_soon
UPDATE public.supported_country_states
SET service_status = 'coming_soon',
    delivery_enabled = false,
    supported_payment_methods = ARRAY['mtn', 'orange']::text[],
    updated_at = NOW()
WHERE country_code = 'CM';

-- 3. Remove freemopay from supported_payment_systems for CM (or set active = false)
DELETE FROM public.supported_payment_systems
WHERE name = 'freemopay' AND country = 'CM';

-- 2. Remove delivery_time_slots for CM
DELETE FROM public.delivery_time_slots
WHERE country_code = 'CM';

-- 1. Remove country_delivery_configs for CM
DELETE FROM public.country_delivery_configs
WHERE country_code = 'CM';
