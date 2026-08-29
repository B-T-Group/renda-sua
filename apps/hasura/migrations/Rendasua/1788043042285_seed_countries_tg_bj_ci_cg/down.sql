-- Revert seed_countries_tg_bj_ci_cg: remove TG, BJ, CI, CG market seed rows.

DELETE FROM public.delivery_time_slots
WHERE country_code IN ('TG', 'BJ', 'CI', 'CG');

DELETE FROM public.country_delivery_configs
WHERE country_code IN ('TG', 'BJ', 'CI', 'CG');

DELETE FROM public.supported_country_states
WHERE country_code IN ('TG', 'BJ', 'CI', 'CG');

DELETE FROM public.country_onboarding_configs
WHERE country_code IN ('TG', 'BJ', 'CI', 'CG');

DELETE FROM public.application_configurations
WHERE country_code IN ('TG', 'BJ', 'CI', 'CG');
