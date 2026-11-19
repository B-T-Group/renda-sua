ALTER TABLE public.application_configurations
  DROP CONSTRAINT IF EXISTS rentals_decline_rank_full_range,
  DROP CONSTRAINT IF EXISTS rentals_decline_rank_start_range,
  DROP CONSTRAINT IF EXISTS rentals_decline_rank_min_sample_range,
  DROP CONSTRAINT IF EXISTS rentals_decline_rank_weight_range;

-- Tag only rows that are still active. An admin-inactive row stays untagged, so up does not turn it back on.
UPDATE public.application_configurations
SET boolean_value = false,
    status = 'inactive',
    tags = CASE
      WHEN tags IS NULL THEN ARRAY['ranking_migration_off']::text[]
      WHEN 'ranking_migration_off' = ANY(tags) THEN tags
      ELSE tags || ARRAY['ranking_migration_off']::text[]
    END
WHERE status = 'active'
  AND config_key IN (
  'rentals_decline_ranking_enabled',
  'rentals_decline_rank_weight',
  'rentals_decline_rank_min_sample',
  'rentals_decline_rank_start',
  'rentals_decline_rank_full'
);

CREATE OR REPLACE VIEW public.rental_condition_decline_counts_90d AS
SELECT
  ('renter:' || b.client_id::text) AS id,
  'renter'::text AS role,
  b.client_id AS party_id,
  count(*)::int AS decline_count,
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
  count(*)::int AS decline_count,
  max(d.created_at) AS last_decline_at
FROM public.rental_condition_declines d
JOIN public.rental_bookings b ON b.id = d.rental_booking_id
WHERE d.created_at >= (now() - interval '90 days')
GROUP BY b.business_id;

ALTER TABLE public.rental_condition_declines
  DROP COLUMN IF EXISTS exclusion_note,
  DROP COLUMN IF EXISTS excluded_at,
  DROP COLUMN IF EXISTS excluded_by;
