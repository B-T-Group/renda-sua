DELETE FROM public.application_configurations
WHERE config_key = 'rentals_default_list_enabled' AND country_code IS NULL;
