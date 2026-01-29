-- Migration: enable_country_cm_data
-- Description: Enable country CM (Cameroon) - add country_delivery_configs, delivery_time_slots,
--              add freemopay to supported_payment_systems, and set CM supported_country_states to active.

-- 1. Add country_delivery_configs for CM (Cameroon), similar to GA (Gabon)
INSERT INTO public.country_delivery_configs (country_code, config_key, config_value, data_type) VALUES
    ('CM', 'normal_delivery_base_fee', '1000', 'number'),
    ('CM', 'fast_delivery_base_fee', '1500', 'number'),
    ('CM', 'per_km_delivery_fee', '200', 'number'),
    ('CM', 'fast_delivery_sla', '4', 'number'),
    ('CM', 'fast_delivery_service_hours', '{"friday": {"end": "20:00", "start": "08:00", "enabled": true}, "monday": {"end": "20:00", "start": "08:00", "enabled": true}, "sunday": {"end": "16:00", "start": "10:00", "enabled": false}, "tuesday": {"end": "20:00", "start": "08:00", "enabled": true}, "saturday": {"end": "18:00", "start": "09:00", "enabled": true}, "thursday": {"end": "20:00", "start": "08:00", "enabled": true}, "wednesday": {"end": "20:00", "start": "08:00", "enabled": true}}', 'json'),
    ('CM', 'fast_delivery_enabled', 'true', 'boolean'),
    ('CM', 'currency', 'XAF', 'string'),
    ('CM', 'timezone', 'Africa/Douala', 'string'),
    ('CM', 'failed_delivery_fees', '200', 'number')
ON CONFLICT (country_code, config_key) DO UPDATE
SET config_value = EXCLUDED.config_value,
    data_type = EXCLUDED.data_type,
    updated_at = NOW();

-- 2. Add delivery_time_slots for CM (Cameroon states, matching supported_country_states state names after Province suffix)
-- CM states: Littoral Region Province, Centre Region Province, Ouest Region Province, Nord-Ouest Region Province, Sud-Ouest Region Province
INSERT INTO public.delivery_time_slots (country_code, state, slot_name, slot_type, start_time, end_time, max_orders_per_slot, display_order) VALUES
-- Littoral Region Province - Standard and Fast (main city area)
('CM', 'Littoral Region Province', 'Morning', 'standard', '08:00', '12:00', 15, 1),
('CM', 'Littoral Region Province', 'Afternoon', 'standard', '12:00', '16:00', 15, 2),
('CM', 'Littoral Region Province', 'Evening', 'standard', '16:00', '20:00', 15, 3),
('CM', 'Littoral Region Province', 'Morning Fast', 'fast', '09:00', '12:00', 5, 4),
('CM', 'Littoral Region Province', 'Afternoon Fast', 'fast', '13:00', '16:00', 5, 5),
('CM', 'Littoral Region Province', 'Evening Fast', 'fast', '17:00', '20:00', 5, 6),
-- Centre Region Province - Standard delivery slots
('CM', 'Centre Region Province', 'Morning', 'standard', '08:00', '12:00', 10, 1),
('CM', 'Centre Region Province', 'Afternoon', 'standard', '12:00', '16:00', 10, 2),
('CM', 'Centre Region Province', 'Evening', 'standard', '16:00', '20:00', 10, 3),
-- Ouest Region Province - Standard delivery slots
('CM', 'Ouest Region Province', 'Morning', 'standard', '08:00', '12:00', 10, 1),
('CM', 'Ouest Region Province', 'Afternoon', 'standard', '12:00', '16:00', 10, 2),
('CM', 'Ouest Region Province', 'Evening', 'standard', '16:00', '20:00', 10, 3),
-- Nord-Ouest Region Province - Standard delivery slots
('CM', 'Nord-Ouest Region Province', 'Morning', 'standard', '08:00', '12:00', 8, 1),
('CM', 'Nord-Ouest Region Province', 'Afternoon', 'standard', '12:00', '16:00', 8, 2),
('CM', 'Nord-Ouest Region Province', 'Evening', 'standard', '16:00', '20:00', 8, 3),
-- Sud-Ouest Region Province - Standard delivery slots
('CM', 'Sud-Ouest Region Province', 'Morning', 'standard', '08:00', '12:00', 8, 1),
('CM', 'Sud-Ouest Region Province', 'Afternoon', 'standard', '12:00', '16:00', 8, 2),
('CM', 'Sud-Ouest Region Province', 'Evening', 'standard', '16:00', '20:00', 8, 3)
ON CONFLICT ON CONSTRAINT unique_slot_per_location DO NOTHING;

-- 3. Add freemopay to supported_payment_systems (enabled for CM)
INSERT INTO public.supported_payment_systems (name, country, active) VALUES
    ('freemopay', 'CM', true)
ON CONFLICT (name, country) DO UPDATE
SET active = EXCLUDED.active,
    updated_at = NOW();

-- 4. Enable all CM entries in supported_country_states (service_status = active, delivery_enabled = true, supported_payment_methods = freemopay)
UPDATE public.supported_country_states
SET service_status = 'active',
    delivery_enabled = true,
    supported_payment_methods = ARRAY['freemopay']::text[],
    updated_at = NOW()
WHERE country_code = 'CM';
