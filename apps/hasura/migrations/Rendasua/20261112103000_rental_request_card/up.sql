-- Business request card. The row stays false so production stays off.
-- The DEV API (NODE_ENV=development) forces the flag on in AppConfigService.
-- Do not flip this row to true in a migration: the same SQL runs in production.

INSERT INTO public.application_configurations (
  config_key, config_name, description, data_type, boolean_value,
  country_code, status, version, tags
)
SELECT
  'rentals_request_card_enabled',
  'Business rental request card',
  'Business incoming rental requests show dates, You receive, and a conflict check. Default false. Development runtimes force it on.',
  'boolean', false, NULL, 'active', 1,
  ARRAY['rentals', 'feature-flag']
WHERE NOT EXISTS (
  SELECT 1 FROM public.application_configurations
  WHERE config_key = 'rentals_request_card_enabled' AND country_code IS NULL
);

-- Backfill a quote only for pending requests we can price from current listing
-- rates. A missing rate for that window's billing mode leaves quoted_total null.
WITH elems AS (
  SELECT
    r.id,
    i.currency,
    GREATEST(COALESCE(r.units_requested, 1), 1) AS units,
    GREATEST(COALESCE(l.security_deposit_amount, 0), 0) AS deposit_per_unit,
    l.base_price_per_day AS day_rate,
    l.base_price_per_hour AS hour_rate,
    elem,
    ordinality
  FROM public.rental_requests r
  JOIN public.rental_location_listings l ON l.id = r.rental_location_listing_id
  JOIN public.rental_items i ON i.id = l.rental_item_id
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE
      WHEN jsonb_typeof(r.rental_selection_windows) = 'array' THEN r.rental_selection_windows
      ELSE '[]'::jsonb
    END
  ) WITH ORDINALITY AS w(elem, ordinality)
  WHERE r.status::text = 'pending'
    AND r.quoted_total IS NULL
),
priced_lines AS (
  SELECT
    e.*,
    CASE
      WHEN COALESCE(e.elem->>'billing', '') = 'all_day' THEN
        CASE
          WHEN e.day_rate IS NOT NULL AND e.day_rate > 0 THEN ROUND(e.day_rate * e.units, 2)
          ELSE NULL
        END
      WHEN e.hour_rate IS NULL
        OR COALESCE(e.elem->>'start_at', '') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'
        OR COALESCE(e.elem->>'end_at', '') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' THEN NULL
      ELSE ROUND(
        GREATEST(
          1,
          CEIL(EXTRACT(EPOCH FROM (
            (e.elem->>'end_at')::timestamptz - (e.elem->>'start_at')::timestamptz
          )) / 3600.0)
        ) * e.hour_rate * e.units,
        2
      )
    END AS subtotal,
    CASE
      WHEN COALESCE(e.elem->>'billing', '') = 'all_day' THEN 1
      WHEN COALESCE(e.elem->>'start_at', '') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'
        OR COALESCE(e.elem->>'end_at', '') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' THEN NULL
      ELSE GREATEST(
        1,
        CEIL(EXTRACT(EPOCH FROM (
          (e.elem->>'end_at')::timestamptz - (e.elem->>'start_at')::timestamptz
        )) / 3600.0)
      )
    END AS hours
  FROM elems e
),
ok AS (
  SELECT id
  FROM priced_lines
  GROUP BY id
  HAVING COUNT(*) > 0 AND BOOL_AND(subtotal IS NOT NULL)
),
rolled AS (
  SELECT
    p.id,
    MAX(p.currency) AS currency,
    MAX(p.units) AS units,
    MAX(p.deposit_per_unit) AS deposit_per_unit,
    ROUND(SUM(p.subtotal), 2) AS total,
    jsonb_agg(
      CASE
        WHEN COALESCE(p.elem->>'billing', '') = 'all_day' THEN jsonb_build_object(
          'kind', 'all_day',
          'calendarDate', COALESCE(p.elem->>'calendar_date', left(p.elem->>'start_at', 10)),
          'ratePerDay', p.day_rate,
          'subtotal', p.subtotal
        )
        ELSE jsonb_build_object(
          'kind', 'hourly',
          'startAt', p.elem->>'start_at',
          'endAt', p.elem->>'end_at',
          'billableHours', p.hours,
          'ratePerHour', p.hour_rate,
          'subtotal', p.subtotal
        )
      END
      ORDER BY p.ordinality
    ) AS lines
  FROM priced_lines p
  JOIN ok ON ok.id = p.id
  GROUP BY p.id
)
UPDATE public.rental_requests r
SET
  quoted_total = rolled.total,
  rental_pricing_snapshot = CASE
    WHEN r.rental_pricing_snapshot IS NULL THEN jsonb_build_object(
      'version', 4,
      'currency', COALESCE(rolled.currency, 'XAF'),
      'total', rolled.total,
      'unitsBooked', rolled.units,
      'securityDeposit', ROUND(rolled.deposit_per_unit * rolled.units, 2),
      'lines', rolled.lines,
      'computedAt', to_char(timezone('UTC', now()), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
    )
    ELSE r.rental_pricing_snapshot
  END
FROM rolled
WHERE r.id = rolled.id
  AND r.status::text = 'pending'
  AND r.quoted_total IS NULL;
