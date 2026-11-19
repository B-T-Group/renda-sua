-- Global keys are unique. Postgres UNIQUE does not treat NULL country_code as equal.
-- Keep the oldest row when a global key was inserted twice. The previous values are not restored on down.
DELETE FROM public.application_configurations extra
USING public.application_configurations keep
WHERE extra.country_code IS NULL
  AND keep.country_code IS NULL
  AND extra.config_key = keep.config_key
  AND extra.id <> keep.id
  AND (
    extra.created_at > keep.created_at
    OR (extra.created_at = keep.created_at AND extra.id > keep.id)
  );

CREATE UNIQUE INDEX IF NOT EXISTS application_configurations_global_key_uidx
  ON public.application_configurations (config_key)
  WHERE country_code IS NULL;

UPDATE public.application_configurations
SET number_value = 1
WHERE config_key = 'rentals_fedapay_unknown_notice_after'
  AND number_value IS NOT NULL
  AND number_value < 1;

UPDATE public.application_configurations
SET number_value = 100
WHERE config_key = 'rentals_fedapay_unknown_notice_after'
  AND number_value IS NOT NULL
  AND number_value > 100;

UPDATE public.application_configurations
SET min_value = 1
WHERE config_key = 'rentals_fedapay_unknown_notice_after'
  AND (min_value IS NULL OR min_value < 1);

UPDATE public.application_configurations
SET max_value = 100
WHERE config_key = 'rentals_fedapay_unknown_notice_after'
  AND (max_value IS NULL OR max_value > 100);

ALTER TABLE public.application_configurations
  DROP CONSTRAINT IF EXISTS rentals_fedapay_unknown_notice_bounds;

ALTER TABLE public.application_configurations
  ADD CONSTRAINT rentals_fedapay_unknown_notice_bounds CHECK (
    config_key <> 'rentals_fedapay_unknown_notice_after'
    OR number_value IS NULL
    OR (number_value >= 1 AND number_value <= 100)
  );
