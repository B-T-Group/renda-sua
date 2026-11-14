DELETE FROM public.application_configurations
 WHERE config_key = 'rentals_my_rentals_entry_enabled' AND country_code IS NULL;
