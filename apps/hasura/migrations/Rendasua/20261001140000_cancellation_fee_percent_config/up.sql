-- Migration: cancellation_fee_percent_config
-- Description: Client cancellation fee becomes a PERCENTAGE of the item subtotal after
--   discounts (excludes delivery fee and tax). Config key `cancellation_fee_percent`
--   (application_configurations.number_value, 0-100, per country).
--
--   * CM = 30, GA = 30, CA = 0 (explicit "free", so 0 is intentional and never "missing").
--   * A market WITHOUT a row is not silently free: the backend and the cancellation lambda
--     log `cancellation_fee_config_missing` at error level and apply the 30 default.
--     (TG, BJ, CI, CG, US, PH have no row yet - add rows before launching them if a
--     different value is wanted.)
--   * The legacy flat `cancellation_fee` key (GA = 500) is RETIRED for cancellations and is
--     intentionally left in place: it is still read ONLY by fail-pickup (customer no-show
--     at pickup), whose behaviour is unchanged.
--
-- Idempotent: existing rows are left untouched (unique_config_key_country).

INSERT INTO public.application_configurations (
    config_key,
    config_name,
    description,
    data_type,
    number_value,
    min_value,
    max_value,
    country_code,
    tags,
    status
) VALUES
(
    'cancellation_fee_percent',
    'Cancellation Fee Percent (Cameroon)',
    'Percent of the item subtotal after discounts (excluding delivery fee and tax) charged when the client cancels a confirmed order.',
    'number', 30, 0, 100, 'CM', ARRAY['cancellation', 'order'], 'active'
),
(
    'cancellation_fee_percent',
    'Cancellation Fee Percent (Gabon)',
    'Percent of the item subtotal after discounts (excluding delivery fee and tax) charged when the client cancels a confirmed order.',
    'number', 30, 0, 100, 'GA', ARRAY['cancellation', 'order'], 'active'
),
(
    'cancellation_fee_percent',
    'Cancellation Fee Percent (Canada)',
    'Explicit 0: no cancellation fee in Canada (a missing row would NOT mean free).',
    'number', 0, 0, 100, 'CA', ARRAY['cancellation', 'order'], 'active'
)
ON CONFLICT (config_key, country_code) DO NOTHING;
