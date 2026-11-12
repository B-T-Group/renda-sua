DELETE FROM public.application_configurations
 WHERE config_key = 'rentals_client_tab_enabled' AND country_code IS NULL;
