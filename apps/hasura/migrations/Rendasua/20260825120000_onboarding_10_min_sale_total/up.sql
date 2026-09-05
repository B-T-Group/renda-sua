-- Minimum cumulative in-window sales for the 10-item onboarding bonus.
-- XAF markets: 2,500. CAD: 0 (any positive sale still qualifies).

INSERT INTO public.application_configurations (
  config_key, config_name, description, data_type, number_value, country_code, tags, status
) VALUES
  (
    'onboarding_10_min_sale_total',
    'Onboarding 10 items min sale total (Cameroon)',
    'Minimum cumulative completed sales (XAF) in the 30-day window, on top of ≥10 approved items, before the onboarding bonus pays.',
    'number', 2500.00, 'CM',
    ARRAY['agents', 'referrals', 'compensation', 'onboarding'],
    'active'
  ),
  (
    'onboarding_10_min_sale_total',
    'Onboarding 10 items min sale total (Gabon)',
    'Minimum cumulative completed sales (XAF) in the 30-day window, on top of ≥10 approved items, before the onboarding bonus pays.',
    'number', 2500.00, 'GA',
    ARRAY['agents', 'referrals', 'compensation', 'onboarding'],
    'active'
  ),
  (
    'onboarding_10_min_sale_total',
    'Onboarding 10 items min sale total (Canada)',
    'Minimum cumulative completed sales (CAD) in the 30-day window. 0 means any positive sale still qualifies.',
    'number', 0.00, 'CA',
    ARRAY['agents', 'referrals', 'compensation', 'onboarding'],
    'active'
  )
ON CONFLICT (config_key, country_code) DO NOTHING;

UPDATE public.application_configurations
SET description = 'Gross onboarding bonus when a referred business has ≥10 approved items and cumulative completed sales of at least onboarding_10_min_sale_total within 30 days (XAF).'
WHERE config_key = 'onboarding_10_first_sale_amount'
  AND country_code IN ('CM', 'GA');

UPDATE public.application_configurations
SET description = 'Gross onboarding bonus when a referred business has ≥10 approved items and a completed sale within 30 days (CAD).'
WHERE config_key = 'onboarding_10_first_sale_amount'
  AND country_code = 'CA';
