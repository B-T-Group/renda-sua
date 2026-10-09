-- Nightly address geocode cron is OFF until ops flips it (UPDATE ... SET boolean_value = true).
INSERT INTO public.application_configurations (
  config_key, config_name, description, data_type, boolean_value,
  country_code, status, version, tags
)
SELECT
  'address_geocode_cron_enabled',
  'Address geocode cron enabled',
  'Master switch for the 03:00 nightly job that fills missing address coordinates. Global row only. Default false.',
  'boolean', false, NULL, 'active', 1,
  ARRAY['address', 'cron', 'feature-flag']
WHERE NOT EXISTS (
  SELECT 1 FROM public.application_configurations
  WHERE config_key = 'address_geocode_cron_enabled' AND country_code IS NULL
);

-- Single-run lock for the same cron: date_value is the lock expiry; the epoch (1970-01-01) means free (config_value_not_null forbids NULL). Not a flag; do not edit by hand.
INSERT INTO public.application_configurations (
  config_key, config_name, description, data_type, date_value,
  country_code, status, version, tags
)
SELECT
  'address_geocode_cron_lock',
  'Address geocode cron lock',
  'Compare-and-set lock for the nightly geocode job. date_value = expiry, epoch = free. Managed by the backend.',
  'date', '1970-01-01T00:00:00Z'::timestamptz, NULL, 'active', 1,
  ARRAY['address', 'cron', 'lock']
WHERE NOT EXISTS (
  SELECT 1 FROM public.application_configurations
  WHERE config_key = 'address_geocode_cron_lock' AND country_code IS NULL
);
