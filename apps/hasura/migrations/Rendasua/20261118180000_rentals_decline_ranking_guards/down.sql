ALTER TABLE public.application_configurations
  DROP CONSTRAINT IF EXISTS rentals_decline_rank_full_range,
  DROP CONSTRAINT IF EXISTS rentals_decline_rank_start_range,
  DROP CONSTRAINT IF EXISTS rentals_decline_rank_min_sample_range,
  DROP CONSTRAINT IF EXISTS rentals_decline_rank_weight_range;

UPDATE public.application_configurations
SET boolean_value = false,
    status = 'inactive'
WHERE config_key IN (
  'rentals_decline_ranking_enabled',
  'rentals_decline_rank_weight',
  'rentals_decline_rank_min_sample',
  'rentals_decline_rank_start',
  'rentals_decline_rank_full'
);
