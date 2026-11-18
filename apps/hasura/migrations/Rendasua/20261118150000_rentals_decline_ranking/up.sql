-- Condition-decline ranking penalty and support exclusion.
-- Inserts the flag and the weights false / at their defaults. Does not enable ranking.
-- Production stays off. Do not enable this from apply-hasura or a workflow.

ALTER TABLE public.rental_condition_declines
  ADD COLUMN IF NOT EXISTS excluded_by uuid,
  ADD COLUMN IF NOT EXISTS excluded_at timestamptz,
  ADD COLUMN IF NOT EXISTS exclusion_note text;

COMMENT ON COLUMN public.rental_condition_declines.excluded_at IS
  'Set when support marks the decline as not the business fault. The renter count still includes it. The business count and ranking do not.';

COMMENT ON COLUMN public.rental_condition_declines.exclusion_note IS
  'Optional support note for a reversible exclusion. Cleared when the exclusion is reversed.';

CREATE OR REPLACE VIEW public.rental_condition_decline_counts_90d AS
SELECT
  ('renter:' || b.client_id::text) AS id,
  'renter'::text AS role,
  b.client_id AS party_id,
  count(DISTINCT d.rental_booking_id)::int AS decline_count,
  max(d.created_at) AS last_decline_at
FROM public.rental_condition_declines d
JOIN public.rental_bookings b ON b.id = d.rental_booking_id
WHERE d.created_at >= (now() - interval '90 days')
GROUP BY b.client_id
UNION ALL
SELECT
  ('business:' || b.business_id::text) AS id,
  'business'::text AS role,
  b.business_id AS party_id,
  count(DISTINCT d.rental_booking_id)::int AS decline_count,
  max(d.created_at) AS last_decline_at
FROM public.rental_condition_declines d
JOIN public.rental_bookings b ON b.id = d.rental_booking_id
WHERE d.created_at >= (now() - interval '90 days')
  AND d.excluded_at IS NULL
GROUP BY b.business_id;

COMMENT ON VIEW public.rental_condition_decline_counts_90d IS
  'Declines in 90 days. Renters include every decline. Businesses omit declines support marked as not their fault.';

INSERT INTO public.application_configurations
  (config_key, config_name, description, data_type, boolean_value, number_value, min_value, max_value,
   country_code, tags, status, version)
SELECT v.k, v.n, v.d, v.t, v.b, v.num, v.mn, v.mx, NULL, ARRAY['rentals', 'feature-flag']::text[], 'active', 1
FROM (VALUES
  ('rentals_decline_ranking_enabled', 'Condition-decline ranking penalty',
   'When true, rental search multiplies a business rank by its 90-day condition-decline rate. Listings stay visible. Support can exclude a decline that was not the business fault. Default false.',
   'boolean', false, NULL::numeric, NULL::numeric, NULL::numeric),
  ('rentals_decline_rank_weight', 'Decline ranking weight',
   'How far a high decline rate can move a listing. 0 leaves the order unchanged. Default 0.30.',
   'number', NULL, 0.30, 0, 0.9),
  ('rentals_decline_rank_min_sample', 'Decline ranking minimum pickups',
   'Pickups reached in 90 days before a business can be penalized. Default 10.',
   'number', NULL, 10, 1, 1000),
  ('rentals_decline_rank_start', 'Decline ranking start rate',
   'Smoothed decline rate where the penalty starts. Default 0.10.',
   'number', NULL, 0.10, 0, 1),
  ('rentals_decline_rank_full', 'Decline ranking full rate',
   'Smoothed decline rate where the penalty reaches the full weight. Default 0.40.',
   'number', NULL, 0.40, 0, 1)
) AS v(k, n, d, t, b, num, mn, mx)
WHERE NOT EXISTS (
  SELECT 1 FROM public.application_configurations c
  WHERE c.config_key = v.k AND c.country_code IS NULL
);

UPDATE public.application_configurations
SET number_value = 0.30
WHERE config_key = 'rentals_decline_rank_weight'
  AND (number_value IS NULL OR number_value < 0 OR number_value > 0.9);

UPDATE public.application_configurations
SET number_value = 10
WHERE config_key = 'rentals_decline_rank_min_sample'
  AND (number_value IS NULL OR number_value < 1);

UPDATE public.application_configurations
SET number_value = 0.10
WHERE config_key = 'rentals_decline_rank_start'
  AND (number_value IS NULL OR number_value < 0 OR number_value >= 1);

UPDATE public.application_configurations
SET number_value = 0.40
WHERE config_key = 'rentals_decline_rank_full'
  AND (number_value IS NULL OR number_value <= 0 OR number_value > 1);

ALTER TABLE public.application_configurations
  DROP CONSTRAINT IF EXISTS rentals_decline_rank_weight_range,
  DROP CONSTRAINT IF EXISTS rentals_decline_rank_min_sample_range,
  DROP CONSTRAINT IF EXISTS rentals_decline_rank_start_range,
  DROP CONSTRAINT IF EXISTS rentals_decline_rank_full_range;

ALTER TABLE public.application_configurations
  ADD CONSTRAINT rentals_decline_rank_weight_range CHECK (
    config_key <> 'rentals_decline_rank_weight'
    OR (number_value >= 0 AND number_value <= 0.9)
  ),
  ADD CONSTRAINT rentals_decline_rank_min_sample_range CHECK (
    config_key <> 'rentals_decline_rank_min_sample'
    OR number_value >= 1
  ),
  ADD CONSTRAINT rentals_decline_rank_start_range CHECK (
    config_key <> 'rentals_decline_rank_start'
    OR (number_value >= 0 AND number_value < 1)
  ),
  ADD CONSTRAINT rentals_decline_rank_full_range CHECK (
    config_key <> 'rentals_decline_rank_full'
    OR (number_value > 0 AND number_value <= 1)
  );
