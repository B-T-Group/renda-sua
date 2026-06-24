-- Revert seed_country_ca_data: remove all Canada (CA) seed rows.

DELETE FROM public.delivery_time_slots WHERE country_code = 'CA';

DELETE FROM public.supported_payment_systems WHERE name = 'stripe' AND country = 'CA';

DELETE FROM public.country_delivery_configs WHERE country_code = 'CA';

DELETE FROM public.supported_country_states WHERE country_code = 'CA';
