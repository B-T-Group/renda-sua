DROP TABLE IF EXISTS public.assistant_rental_zero_results;

ALTER TABLE public.rental_requests
  DROP COLUMN IF EXISTS price_change_seen_at;

DELETE FROM public.message_types WHERE id = 'RENTAL_PRICE_CHANGED';

DELETE FROM public.application_configurations
WHERE config_key = 'assistant_rentals_enabled'
  AND country_code IS NULL
  AND boolean_value = false;
