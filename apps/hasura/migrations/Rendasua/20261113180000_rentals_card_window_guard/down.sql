DELETE FROM public.application_configurations
 WHERE config_key = 'rentals_card_window_guard_enabled' AND country_code IS NULL;

DELETE FROM public.application_configurations
 WHERE config_key = 'rentals_card_charge_at_pickup_enabled' AND country_code IS NULL;
