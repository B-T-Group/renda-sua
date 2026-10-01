-- Migration: failed_delivery_fee_percent_config
-- Description: The client-fault failed delivery fee becomes a PERCENTAGE of the item subtotal
--   after discounts (excludes delivery fee and tax), same base/rounding as the cancellation
--   fee. Config key `failed_delivery_fee_percent` (application_configurations.number_value,
--   0-100, per country).
--
--   * CM = 30, GA = 30. No row for other markets (CA, TG, BJ, CI, CG, PH, US): the backend logs
--     `failed_delivery_fee_config_missing` at error level and applies the 30 default -
--     never a silent 0. Add explicit rows before launch if a different value is wanted.
--   * The flat delivery_configs.failed_delivery_fees (200 etc.) is RETIRED: no code reads it
--     any more. Rows are left in place (harmless, reversible).
-- Idempotent: existing rows are untouched.

INSERT INTO public.application_configurations (
    config_key, config_name, description, data_type,
    number_value, min_value, max_value, country_code, tags, status
) VALUES
(
    'failed_delivery_fee_percent',
    'Failed Delivery Fee Percent (Cameroon)',
    'Percent of the item subtotal after discounts (excluding delivery fee and tax) charged to the client when a delivery fails because of the client.',
    'number', 30, 0, 100, 'CM', ARRAY['failed_delivery', 'order'], 'active'
),
(
    'failed_delivery_fee_percent',
    'Failed Delivery Fee Percent (Gabon)',
    'Percent of the item subtotal after discounts (excluding delivery fee and tax) charged to the client when a delivery fails because of the client.',
    'number', 30, 0, 100, 'GA', ARRAY['failed_delivery', 'order'], 'active'
)
ON CONFLICT (config_key, country_code) DO NOTHING;
