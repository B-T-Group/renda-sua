DELETE FROM public.application_configurations
WHERE config_key IN ('address_geocode_cron_enabled', 'address_geocode_cron_lock') AND country_code IS NULL;
