DELETE FROM public.application_configurations
 WHERE config_key = 'rentals_inspection_allow_self_booking' AND country_code IS NULL;
