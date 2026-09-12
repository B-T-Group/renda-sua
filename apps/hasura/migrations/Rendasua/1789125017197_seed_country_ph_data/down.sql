-- Revert seed_country_ph_data: remove all Philippines (PH) seed rows.

DELETE FROM public.delivery_time_slots WHERE country_code = 'PH';

DELETE FROM public.supported_payment_systems WHERE name = 'stripe' AND country = 'PH';

DELETE FROM public.country_delivery_configs WHERE country_code = 'PH';

DELETE FROM public.supported_country_states WHERE country_code = 'PH';

DELETE FROM public.country_onboarding_configs WHERE country_code = 'PH';

DELETE FROM public.application_configurations WHERE country_code = 'PH';
