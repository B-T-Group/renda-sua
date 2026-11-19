-- Global keys are unique. Postgres UNIQUE does not treat NULL country_code as equal.
-- This migration has not run on DEV. The dedupe stays here, before the unique index.
-- Only the three FedaPay timing keys are deleted. Keep the active row, then the latest updated_at.
-- A tie, or a duplicate of any other global key, stops the migration instead of deleting.
DO $$
DECLARE
  watched text[] := ARRAY[
    'rentals_fedapay_list_lag_minutes',
    'rentals_fedapay_list_confirm_minutes',
    'rentals_fedapay_unknown_notice_after'
  ];
  other_dups text;
  key text;
  active_count int;
  tie_count int;
  keep_id uuid;
BEGIN
  SELECT string_agg(config_key, ', ' ORDER BY config_key)
    INTO other_dups
  FROM (
    SELECT config_key
    FROM public.application_configurations
    WHERE country_code IS NULL
      AND NOT (config_key = ANY (watched))
    GROUP BY config_key
    HAVING COUNT(*) > 1
  ) d;

  IF other_dups IS NOT NULL THEN
    RAISE EXCEPTION 'Duplicate global configuration keys (%) must be resolved by hand', other_dups;
  END IF;

  FOREACH key IN ARRAY watched LOOP
    SELECT COUNT(*) INTO active_count
    FROM public.application_configurations
    WHERE country_code IS NULL AND config_key = key AND status = 'active';

    IF active_count > 0 THEN
      SELECT COUNT(*) INTO tie_count
      FROM public.application_configurations
      WHERE country_code IS NULL
        AND config_key = key
        AND status = 'active'
        AND updated_at IS NOT DISTINCT FROM (
          SELECT MAX(updated_at)
          FROM public.application_configurations
          WHERE country_code IS NULL AND config_key = key AND status = 'active'
        );
      IF tie_count > 1 THEN
        RAISE EXCEPTION 'Ambiguous active rows for %; keep one and rerun the migration', key;
      END IF;
      SELECT id INTO keep_id
      FROM public.application_configurations
      WHERE country_code IS NULL AND config_key = key AND status = 'active'
      ORDER BY updated_at DESC NULLS LAST
      LIMIT 1;
    ELSE
      SELECT COUNT(*) INTO tie_count
      FROM public.application_configurations
      WHERE country_code IS NULL
        AND config_key = key
        AND updated_at IS NOT DISTINCT FROM (
          SELECT MAX(updated_at)
          FROM public.application_configurations
          WHERE country_code IS NULL AND config_key = key
        );
      IF tie_count > 1 THEN
        RAISE EXCEPTION 'Ambiguous rows for %; keep one and rerun the migration', key;
      END IF;
      SELECT id INTO keep_id
      FROM public.application_configurations
      WHERE country_code IS NULL AND config_key = key
      ORDER BY updated_at DESC NULLS LAST
      LIMIT 1;
    END IF;

    IF keep_id IS NOT NULL THEN
      DELETE FROM public.application_configurations
      WHERE country_code IS NULL AND config_key = key AND id <> keep_id;
    END IF;
  END LOOP;
END $$;

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
