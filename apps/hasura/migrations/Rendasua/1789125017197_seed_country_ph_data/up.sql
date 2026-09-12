-- Migration: seed_country_ph_data
-- Description: Onboard country PH (Philippines) - seed supported_country_states (all 17 regions),
--              country_delivery_configs (PHP / Asia/Manila with PLACEHOLDER fees),
--              delivery_time_slots, supported_payment_systems (stripe),
--              country_onboarding_configs (stripe_connect), and clone CA application_configurations.

-- 1. Seed supported_country_states for Philippines (all 17 regions, active)
INSERT INTO public.supported_country_states (
    country_code, country_name, state_name, currency_code,
    service_status, delivery_enabled, launch_date
)
SELECT v.country_code, v.country_name, v.state_name, v.currency_code,
       v.service_status, v.delivery_enabled, v.launch_date
FROM (VALUES
    ('PH', 'Philippines', 'National Capital Region', 'PHP', 'active', true, DATE '2026-09-11'),
    ('PH', 'Philippines', 'Cordillera Administrative Region', 'PHP', 'active', true, DATE '2026-09-11'),
    ('PH', 'Philippines', 'Ilocos Region', 'PHP', 'active', true, DATE '2026-09-11'),
    ('PH', 'Philippines', 'Cagayan Valley', 'PHP', 'active', true, DATE '2026-09-11'),
    ('PH', 'Philippines', 'Central Luzon', 'PHP', 'active', true, DATE '2026-09-11'),
    ('PH', 'Philippines', 'Calabarzon', 'PHP', 'active', true, DATE '2026-09-11'),
    ('PH', 'Philippines', 'Mimaropa', 'PHP', 'active', true, DATE '2026-09-11'),
    ('PH', 'Philippines', 'Bicol Region', 'PHP', 'active', true, DATE '2026-09-11'),
    ('PH', 'Philippines', 'Western Visayas', 'PHP', 'active', true, DATE '2026-09-11'),
    ('PH', 'Philippines', 'Central Visayas', 'PHP', 'active', true, DATE '2026-09-11'),
    ('PH', 'Philippines', 'Eastern Visayas', 'PHP', 'active', true, DATE '2026-09-11'),
    ('PH', 'Philippines', 'Zamboanga Peninsula', 'PHP', 'active', true, DATE '2026-09-11'),
    ('PH', 'Philippines', 'Northern Mindanao', 'PHP', 'active', true, DATE '2026-09-11'),
    ('PH', 'Philippines', 'Davao Region', 'PHP', 'active', true, DATE '2026-09-11'),
    ('PH', 'Philippines', 'Soccsksargen', 'PHP', 'active', true, DATE '2026-09-11'),
    ('PH', 'Philippines', 'Caraga', 'PHP', 'active', true, DATE '2026-09-11'),
    ('PH', 'Philippines', 'Bangsamoro', 'PHP', 'active', true, DATE '2026-09-11')
) AS v(country_code, country_name, state_name, currency_code, service_status, delivery_enabled, launch_date)
WHERE NOT EXISTS (
    SELECT 1 FROM public.supported_country_states s
    WHERE s.country_code = v.country_code AND s.state_name = v.state_name
);

-- 2. Seed country_delivery_configs for PH.
--    NOTE: numeric fee values below are PLACEHOLDERS in PHP - TODO confirm real amounts.
INSERT INTO public.country_delivery_configs (country_code, config_key, config_value, data_type) VALUES
    ('PH', 'normal_delivery_base_fee', '200', 'number'),      -- TODO confirm (PHP)
    ('PH', 'fast_delivery_base_fee', '350', 'number'),        -- TODO confirm (PHP)
    ('PH', 'per_km_delivery_fee', '40', 'number'),            -- TODO confirm (PHP)
    ('PH', 'max_per_km_delivery_fee', '600', 'number'),       -- TODO confirm (PHP)
    ('PH', 'fast_delivery_sla', '4', 'number'),               -- TODO confirm (hours)
    ('PH', 'fast_delivery_service_hours', '{"friday": {"end": "20:00", "start": "08:00", "enabled": true}, "monday": {"end": "20:00", "start": "08:00", "enabled": true}, "sunday": {"end": "16:00", "start": "10:00", "enabled": false}, "tuesday": {"end": "20:00", "start": "08:00", "enabled": true}, "saturday": {"end": "18:00", "start": "09:00", "enabled": true}, "thursday": {"end": "20:00", "start": "08:00", "enabled": true}, "wednesday": {"end": "20:00", "start": "08:00", "enabled": true}}', 'json'),
    ('PH', 'fast_delivery_enabled', 'true', 'boolean'),
    ('PH', 'currency', 'PHP', 'string'),
    ('PH', 'timezone', 'Asia/Manila', 'string'),
    ('PH', 'failed_delivery_fees', '200', 'number'),         -- TODO confirm (PHP)
    ('PH', 'delivery_availability_radius_km', '20', 'number')
ON CONFLICT (country_code, config_key) DO UPDATE
SET config_value = EXCLUDED.config_value,
    data_type = EXCLUDED.data_type,
    updated_at = NOW();

-- 3. Seed delivery_time_slots for PH.
--    state values MUST match supported_country_states.state_name above.
--    Standard slots for every region; fast slots for major metros + __DEFAULT__.
INSERT INTO public.delivery_time_slots (country_code, state, slot_name, slot_type, start_time, end_time, max_orders_per_slot, display_order) VALUES
-- National Capital Region - Standard + Fast
('PH', 'National Capital Region', 'Morning', 'standard', '08:00', '12:00', 15, 1),
('PH', 'National Capital Region', 'Afternoon', 'standard', '12:00', '16:00', 15, 2),
('PH', 'National Capital Region', 'Evening', 'standard', '16:00', '20:00', 15, 3),
('PH', 'National Capital Region', 'Morning Fast', 'fast', '09:00', '12:00', 5, 4),
('PH', 'National Capital Region', 'Afternoon Fast', 'fast', '13:00', '16:00', 5, 5),
('PH', 'National Capital Region', 'Evening Fast', 'fast', '17:00', '20:00', 5, 6),
-- Cordillera Administrative Region - Standard
('PH', 'Cordillera Administrative Region', 'Morning', 'standard', '08:00', '12:00', 10, 1),
('PH', 'Cordillera Administrative Region', 'Afternoon', 'standard', '12:00', '16:00', 10, 2),
('PH', 'Cordillera Administrative Region', 'Evening', 'standard', '16:00', '20:00', 10, 3),
-- Ilocos Region - Standard
('PH', 'Ilocos Region', 'Morning', 'standard', '08:00', '12:00', 10, 1),
('PH', 'Ilocos Region', 'Afternoon', 'standard', '12:00', '16:00', 10, 2),
('PH', 'Ilocos Region', 'Evening', 'standard', '16:00', '20:00', 10, 3),
-- Cagayan Valley - Standard
('PH', 'Cagayan Valley', 'Morning', 'standard', '08:00', '12:00', 10, 1),
('PH', 'Cagayan Valley', 'Afternoon', 'standard', '12:00', '16:00', 10, 2),
('PH', 'Cagayan Valley', 'Evening', 'standard', '16:00', '20:00', 10, 3),
-- Central Luzon - Standard + Fast
('PH', 'Central Luzon', 'Morning', 'standard', '08:00', '12:00', 15, 1),
('PH', 'Central Luzon', 'Afternoon', 'standard', '12:00', '16:00', 15, 2),
('PH', 'Central Luzon', 'Evening', 'standard', '16:00', '20:00', 15, 3),
('PH', 'Central Luzon', 'Morning Fast', 'fast', '09:00', '12:00', 5, 4),
('PH', 'Central Luzon', 'Afternoon Fast', 'fast', '13:00', '16:00', 5, 5),
('PH', 'Central Luzon', 'Evening Fast', 'fast', '17:00', '20:00', 5, 6),
-- Calabarzon - Standard + Fast
('PH', 'Calabarzon', 'Morning', 'standard', '08:00', '12:00', 15, 1),
('PH', 'Calabarzon', 'Afternoon', 'standard', '12:00', '16:00', 15, 2),
('PH', 'Calabarzon', 'Evening', 'standard', '16:00', '20:00', 15, 3),
('PH', 'Calabarzon', 'Morning Fast', 'fast', '09:00', '12:00', 5, 4),
('PH', 'Calabarzon', 'Afternoon Fast', 'fast', '13:00', '16:00', 5, 5),
('PH', 'Calabarzon', 'Evening Fast', 'fast', '17:00', '20:00', 5, 6),
-- Mimaropa - Standard
('PH', 'Mimaropa', 'Morning', 'standard', '08:00', '12:00', 10, 1),
('PH', 'Mimaropa', 'Afternoon', 'standard', '12:00', '16:00', 10, 2),
('PH', 'Mimaropa', 'Evening', 'standard', '16:00', '20:00', 10, 3),
-- Bicol Region - Standard
('PH', 'Bicol Region', 'Morning', 'standard', '08:00', '12:00', 10, 1),
('PH', 'Bicol Region', 'Afternoon', 'standard', '12:00', '16:00', 10, 2),
('PH', 'Bicol Region', 'Evening', 'standard', '16:00', '20:00', 10, 3),
-- Western Visayas - Standard
('PH', 'Western Visayas', 'Morning', 'standard', '08:00', '12:00', 10, 1),
('PH', 'Western Visayas', 'Afternoon', 'standard', '12:00', '16:00', 10, 2),
('PH', 'Western Visayas', 'Evening', 'standard', '16:00', '20:00', 10, 3),
-- Central Visayas - Standard + Fast
('PH', 'Central Visayas', 'Morning', 'standard', '08:00', '12:00', 15, 1),
('PH', 'Central Visayas', 'Afternoon', 'standard', '12:00', '16:00', 15, 2),
('PH', 'Central Visayas', 'Evening', 'standard', '16:00', '20:00', 15, 3),
('PH', 'Central Visayas', 'Morning Fast', 'fast', '09:00', '12:00', 5, 4),
('PH', 'Central Visayas', 'Afternoon Fast', 'fast', '13:00', '16:00', 5, 5),
('PH', 'Central Visayas', 'Evening Fast', 'fast', '17:00', '20:00', 5, 6),
-- Eastern Visayas - Standard
('PH', 'Eastern Visayas', 'Morning', 'standard', '08:00', '12:00', 10, 1),
('PH', 'Eastern Visayas', 'Afternoon', 'standard', '12:00', '16:00', 10, 2),
('PH', 'Eastern Visayas', 'Evening', 'standard', '16:00', '20:00', 10, 3),
-- Zamboanga Peninsula - Standard
('PH', 'Zamboanga Peninsula', 'Morning', 'standard', '08:00', '12:00', 10, 1),
('PH', 'Zamboanga Peninsula', 'Afternoon', 'standard', '12:00', '16:00', 10, 2),
('PH', 'Zamboanga Peninsula', 'Evening', 'standard', '16:00', '20:00', 10, 3),
-- Northern Mindanao - Standard
('PH', 'Northern Mindanao', 'Morning', 'standard', '08:00', '12:00', 10, 1),
('PH', 'Northern Mindanao', 'Afternoon', 'standard', '12:00', '16:00', 10, 2),
('PH', 'Northern Mindanao', 'Evening', 'standard', '16:00', '20:00', 10, 3),
-- Davao Region - Standard + Fast
('PH', 'Davao Region', 'Morning', 'standard', '08:00', '12:00', 15, 1),
('PH', 'Davao Region', 'Afternoon', 'standard', '12:00', '16:00', 15, 2),
('PH', 'Davao Region', 'Evening', 'standard', '16:00', '20:00', 15, 3),
('PH', 'Davao Region', 'Morning Fast', 'fast', '09:00', '12:00', 5, 4),
('PH', 'Davao Region', 'Afternoon Fast', 'fast', '13:00', '16:00', 5, 5),
('PH', 'Davao Region', 'Evening Fast', 'fast', '17:00', '20:00', 5, 6),
-- Soccsksargen - Standard
('PH', 'Soccsksargen', 'Morning', 'standard', '08:00', '12:00', 10, 1),
('PH', 'Soccsksargen', 'Afternoon', 'standard', '12:00', '16:00', 10, 2),
('PH', 'Soccsksargen', 'Evening', 'standard', '16:00', '20:00', 10, 3),
-- Caraga - Standard
('PH', 'Caraga', 'Morning', 'standard', '08:00', '12:00', 10, 1),
('PH', 'Caraga', 'Afternoon', 'standard', '12:00', '16:00', 10, 2),
('PH', 'Caraga', 'Evening', 'standard', '16:00', '20:00', 10, 3),
-- Bangsamoro - Standard
('PH', 'Bangsamoro', 'Morning', 'standard', '08:00', '12:00', 10, 1),
('PH', 'Bangsamoro', 'Afternoon', 'standard', '12:00', '16:00', 10, 2),
('PH', 'Bangsamoro', 'Evening', 'standard', '16:00', '20:00', 10, 3),
-- Country-level defaults (standard + fast)
('PH', '__DEFAULT__', 'Morning', 'standard', '08:00', '12:00', 10, 1),
('PH', '__DEFAULT__', 'Afternoon', 'standard', '12:00', '16:00', 10, 2),
('PH', '__DEFAULT__', 'Evening', 'standard', '16:00', '20:00', 10, 3),
('PH', '__DEFAULT__', 'Morning Fast', 'fast', '09:00', '12:00', 5, 4),
('PH', '__DEFAULT__', 'Afternoon Fast', 'fast', '13:00', '16:00', 5, 5),
('PH', '__DEFAULT__', 'Evening Fast', 'fast', '17:00', '20:00', 5, 6)
ON CONFLICT ON CONSTRAINT unique_slot_per_location DO NOTHING;

-- 4. Add stripe to supported_payment_systems (enabled for PH)
INSERT INTO public.supported_payment_systems (name, country, active) VALUES
    ('stripe', 'PH', true)
ON CONFLICT (name, country) DO UPDATE
SET active = EXCLUDED.active,
    updated_at = NOW();

-- 5. country_onboarding_configs (Stripe Connect, postal required)
INSERT INTO public.country_onboarding_configs (
  country_code, signup_enabled, postal_code_required, verification_flow, default_currency
) VALUES
  ('PH', true, true, 'stripe_connect', 'PHP')
ON CONFLICT (country_code) DO UPDATE
SET signup_enabled = EXCLUDED.signup_enabled,
    postal_code_required = EXCLUDED.postal_code_required,
    verification_flow = EXCLUDED.verification_flow,
    default_currency = EXCLUDED.default_currency,
    updated_at = NOW();

-- 6. Clone Canada application_configurations for PH (Stripe-shaped).
--    NOTE: number_value amounts remain CAD-scale placeholders - TODO confirm PHP amounts.
INSERT INTO public.application_configurations (
  config_key, config_name, description, data_type,
  string_value, number_value, boolean_value, json_value, array_value, date_value,
  country_code, status, version, tags, validation_rules,
  min_value, max_value, allowed_values
)
SELECT
  config_key,
  replace(config_name, 'Canada', 'Philippines'),
  replace(replace(description, 'CAD', 'PHP'), 'Canada', 'Philippines'),
  data_type,
  string_value, number_value, boolean_value, json_value, array_value, date_value,
  'PH',
  status, version, tags, validation_rules,
  min_value, max_value, allowed_values
FROM public.application_configurations
WHERE country_code = 'CA'
ON CONFLICT (config_key, country_code) DO NOTHING;

-- 7. In-app merchant agreement for PH
INSERT INTO public.application_configurations (
  config_key,
  config_name,
  description,
  data_type,
  string_value,
  country_code,
  tags,
  status,
  allowed_values
) VALUES (
  'merchant_agreement_provider',
  'Merchant Agreement Provider (PH)',
  'How merchant partnership agreements are collected for this country. Values: boldsign | in_app. Absence of a row defaults to in_app.',
  'string',
  'in_app',
  'PH',
  ARRAY['merchant', 'agreement', 'boldsign'],
  'active',
  ARRAY['boldsign', 'in_app']
)
ON CONFLICT (config_key, country_code) DO UPDATE
SET
  string_value = 'in_app',
  status = 'active',
  description = EXCLUDED.description,
  updated_at = NOW();
