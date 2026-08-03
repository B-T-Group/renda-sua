DELETE FROM public.country_onboarding_configs
WHERE country_code IN ('CM', 'GA', 'US', 'CA');

DROP TABLE IF EXISTS public.country_onboarding_configs;

DROP TYPE IF EXISTS public.country_verification_flow;
