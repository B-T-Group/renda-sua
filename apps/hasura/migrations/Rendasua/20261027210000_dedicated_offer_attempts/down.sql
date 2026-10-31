DELETE FROM public.application_configurations
 WHERE country_code IS NULL AND config_key = 'dedicated_offer_max_attempts';

ALTER TABLE public.order_offers DROP COLUMN IF EXISTS dedicated_attempt;
