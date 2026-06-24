-- Migration: seed_country_ca_data
-- Description: Onboard country CA (Canada) - seed supported_country_states (all provinces/territories),
--              country_delivery_configs (CAD / America/Toronto with PLACEHOLDER fees),
--              delivery_time_slots, and supported_payment_systems (stripe).

-- 1. Seed supported_country_states for Canada (all 13 provinces/territories, active)
--    Clean province/territory names (no suffix) so delivery_time_slots.state can match state_name.
INSERT INTO public.supported_country_states (
    country_code, country_name, state_name, currency_code,
    service_status, delivery_enabled, launch_date
)
SELECT v.country_code, v.country_name, v.state_name, v.currency_code,
       v.service_status, v.delivery_enabled, v.launch_date
FROM (VALUES
    ('CA', 'Canada', 'Ontario', 'CAD', 'active', true, DATE '2026-06-24'),
    ('CA', 'Canada', 'Quebec', 'CAD', 'active', true, DATE '2026-06-24'),
    ('CA', 'Canada', 'British Columbia', 'CAD', 'active', true, DATE '2026-06-24'),
    ('CA', 'Canada', 'Alberta', 'CAD', 'active', true, DATE '2026-06-24'),
    ('CA', 'Canada', 'Manitoba', 'CAD', 'active', true, DATE '2026-06-24'),
    ('CA', 'Canada', 'Saskatchewan', 'CAD', 'active', true, DATE '2026-06-24'),
    ('CA', 'Canada', 'Nova Scotia', 'CAD', 'active', true, DATE '2026-06-24'),
    ('CA', 'Canada', 'New Brunswick', 'CAD', 'active', true, DATE '2026-06-24'),
    ('CA', 'Canada', 'Newfoundland and Labrador', 'CAD', 'active', true, DATE '2026-06-24'),
    ('CA', 'Canada', 'Prince Edward Island', 'CAD', 'active', true, DATE '2026-06-24'),
    ('CA', 'Canada', 'Northwest Territories', 'CAD', 'active', true, DATE '2026-06-24'),
    ('CA', 'Canada', 'Yukon', 'CAD', 'active', true, DATE '2026-06-24'),
    ('CA', 'Canada', 'Nunavut', 'CAD', 'active', true, DATE '2026-06-24')
) AS v(country_code, country_name, state_name, currency_code, service_status, delivery_enabled, launch_date)
WHERE NOT EXISTS (
    SELECT 1 FROM public.supported_country_states s
    WHERE s.country_code = v.country_code AND s.state_name = v.state_name
);

-- 2. Seed country_delivery_configs for CA.
--    NOTE: numeric fee values below are PLACEHOLDERS in CAD - TODO confirm real amounts.
INSERT INTO public.country_delivery_configs (country_code, config_key, config_value, data_type) VALUES
    ('CA', 'normal_delivery_base_fee', '5', 'number'),       -- TODO confirm (CAD)
    ('CA', 'fast_delivery_base_fee', '8', 'number'),         -- TODO confirm (CAD)
    ('CA', 'per_km_delivery_fee', '1', 'number'),            -- TODO confirm (CAD)
    ('CA', 'max_per_km_delivery_fee', '15', 'number'),       -- TODO confirm (CAD)
    ('CA', 'fast_delivery_sla', '4', 'number'),              -- TODO confirm (hours)
    ('CA', 'fast_delivery_service_hours', '{"friday": {"end": "20:00", "start": "08:00", "enabled": true}, "monday": {"end": "20:00", "start": "08:00", "enabled": true}, "sunday": {"end": "16:00", "start": "10:00", "enabled": false}, "tuesday": {"end": "20:00", "start": "08:00", "enabled": true}, "saturday": {"end": "18:00", "start": "09:00", "enabled": true}, "thursday": {"end": "20:00", "start": "08:00", "enabled": true}, "wednesday": {"end": "20:00", "start": "08:00", "enabled": true}}', 'json'),
    ('CA', 'fast_delivery_enabled', 'true', 'boolean'),
    ('CA', 'currency', 'CAD', 'string'),
    ('CA', 'timezone', 'America/Toronto', 'string'),
    ('CA', 'failed_delivery_fees', '5', 'number')            -- TODO confirm (CAD)
ON CONFLICT (country_code, config_key) DO UPDATE
SET config_value = EXCLUDED.config_value,
    data_type = EXCLUDED.data_type,
    updated_at = NOW();

-- 3. Seed delivery_time_slots for CA.
--    state values MUST match supported_country_states.state_name above.
--    Standard slots for every province/territory; fast slots for major provinces (ON, QC, BC, AB).
INSERT INTO public.delivery_time_slots (country_code, state, slot_name, slot_type, start_time, end_time, max_orders_per_slot, display_order) VALUES
-- Ontario - Standard + Fast
('CA', 'Ontario', 'Morning', 'standard', '08:00', '12:00', 15, 1),
('CA', 'Ontario', 'Afternoon', 'standard', '12:00', '16:00', 15, 2),
('CA', 'Ontario', 'Evening', 'standard', '16:00', '20:00', 15, 3),
('CA', 'Ontario', 'Morning Fast', 'fast', '09:00', '12:00', 5, 4),
('CA', 'Ontario', 'Afternoon Fast', 'fast', '13:00', '16:00', 5, 5),
('CA', 'Ontario', 'Evening Fast', 'fast', '17:00', '20:00', 5, 6),
-- Quebec - Standard + Fast
('CA', 'Quebec', 'Morning', 'standard', '08:00', '12:00', 15, 1),
('CA', 'Quebec', 'Afternoon', 'standard', '12:00', '16:00', 15, 2),
('CA', 'Quebec', 'Evening', 'standard', '16:00', '20:00', 15, 3),
('CA', 'Quebec', 'Morning Fast', 'fast', '09:00', '12:00', 5, 4),
('CA', 'Quebec', 'Afternoon Fast', 'fast', '13:00', '16:00', 5, 5),
('CA', 'Quebec', 'Evening Fast', 'fast', '17:00', '20:00', 5, 6),
-- British Columbia - Standard + Fast
('CA', 'British Columbia', 'Morning', 'standard', '08:00', '12:00', 15, 1),
('CA', 'British Columbia', 'Afternoon', 'standard', '12:00', '16:00', 15, 2),
('CA', 'British Columbia', 'Evening', 'standard', '16:00', '20:00', 15, 3),
('CA', 'British Columbia', 'Morning Fast', 'fast', '09:00', '12:00', 5, 4),
('CA', 'British Columbia', 'Afternoon Fast', 'fast', '13:00', '16:00', 5, 5),
('CA', 'British Columbia', 'Evening Fast', 'fast', '17:00', '20:00', 5, 6),
-- Alberta - Standard + Fast
('CA', 'Alberta', 'Morning', 'standard', '08:00', '12:00', 15, 1),
('CA', 'Alberta', 'Afternoon', 'standard', '12:00', '16:00', 15, 2),
('CA', 'Alberta', 'Evening', 'standard', '16:00', '20:00', 15, 3),
('CA', 'Alberta', 'Morning Fast', 'fast', '09:00', '12:00', 5, 4),
('CA', 'Alberta', 'Afternoon Fast', 'fast', '13:00', '16:00', 5, 5),
('CA', 'Alberta', 'Evening Fast', 'fast', '17:00', '20:00', 5, 6),
-- Manitoba - Standard
('CA', 'Manitoba', 'Morning', 'standard', '08:00', '12:00', 10, 1),
('CA', 'Manitoba', 'Afternoon', 'standard', '12:00', '16:00', 10, 2),
('CA', 'Manitoba', 'Evening', 'standard', '16:00', '20:00', 10, 3),
-- Saskatchewan - Standard
('CA', 'Saskatchewan', 'Morning', 'standard', '08:00', '12:00', 10, 1),
('CA', 'Saskatchewan', 'Afternoon', 'standard', '12:00', '16:00', 10, 2),
('CA', 'Saskatchewan', 'Evening', 'standard', '16:00', '20:00', 10, 3),
-- Nova Scotia - Standard
('CA', 'Nova Scotia', 'Morning', 'standard', '08:00', '12:00', 10, 1),
('CA', 'Nova Scotia', 'Afternoon', 'standard', '12:00', '16:00', 10, 2),
('CA', 'Nova Scotia', 'Evening', 'standard', '16:00', '20:00', 10, 3),
-- New Brunswick - Standard
('CA', 'New Brunswick', 'Morning', 'standard', '08:00', '12:00', 8, 1),
('CA', 'New Brunswick', 'Afternoon', 'standard', '12:00', '16:00', 8, 2),
('CA', 'New Brunswick', 'Evening', 'standard', '16:00', '20:00', 8, 3),
-- Newfoundland and Labrador - Standard
('CA', 'Newfoundland and Labrador', 'Morning', 'standard', '08:00', '12:00', 8, 1),
('CA', 'Newfoundland and Labrador', 'Afternoon', 'standard', '12:00', '16:00', 8, 2),
('CA', 'Newfoundland and Labrador', 'Evening', 'standard', '16:00', '20:00', 8, 3),
-- Prince Edward Island - Standard
('CA', 'Prince Edward Island', 'Morning', 'standard', '08:00', '12:00', 8, 1),
('CA', 'Prince Edward Island', 'Afternoon', 'standard', '12:00', '16:00', 8, 2),
('CA', 'Prince Edward Island', 'Evening', 'standard', '16:00', '20:00', 8, 3),
-- Northwest Territories - Standard
('CA', 'Northwest Territories', 'Morning', 'standard', '08:00', '12:00', 5, 1),
('CA', 'Northwest Territories', 'Afternoon', 'standard', '12:00', '16:00', 5, 2),
('CA', 'Northwest Territories', 'Evening', 'standard', '16:00', '20:00', 5, 3),
-- Yukon - Standard
('CA', 'Yukon', 'Morning', 'standard', '08:00', '12:00', 5, 1),
('CA', 'Yukon', 'Afternoon', 'standard', '12:00', '16:00', 5, 2),
('CA', 'Yukon', 'Evening', 'standard', '16:00', '20:00', 5, 3),
-- Nunavut - Standard
('CA', 'Nunavut', 'Morning', 'standard', '08:00', '12:00', 5, 1),
('CA', 'Nunavut', 'Afternoon', 'standard', '12:00', '16:00', 5, 2),
('CA', 'Nunavut', 'Evening', 'standard', '16:00', '20:00', 5, 3)
ON CONFLICT ON CONSTRAINT unique_slot_per_location DO NOTHING;

-- 4. Add stripe to supported_payment_systems (enabled for CA)
INSERT INTO public.supported_payment_systems (name, country, active) VALUES
    ('stripe', 'CA', true)
ON CONFLICT (name, country) DO UPDATE
SET active = EXCLUDED.active,
    updated_at = NOW();
