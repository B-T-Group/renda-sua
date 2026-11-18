-- One booking counts once. Rank config stays inside the formula's range.

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
